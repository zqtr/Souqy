import 'server-only';
import { LRUCache } from 'lru-cache';
import * as React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import * as SouqnaSdk from '@/sdk';
import type { SouqyContext } from '@/sdk/runtime';
import { withSouqyContext } from '@/sdk/runtime';

/**
 * Souqy artifact loader.
 *
 * The compiled per-tenant artifact is a CommonJS module emitted by tsup
 * inside Vercel Sandbox (see `src/lib/souqy/build.ts`). We:
 *
 *   1. Fetch the bundle text from Vercel Blob (cached in-memory by
 *      `<slug>:<revision>` so repeat hits don't pay a network roundtrip).
 *   2. Wrap it in `new Function` with a captive `require()` that
 *      resolves only `react` and `@souqna/sdk` against our app's module
 *      instances — no other module name resolves, so a generated artifact
 *      cannot reach Node builtins, fs, network, or env.
 *   3. Cache the resulting React component by content key.
 *   4. Render it inside `withSouqyContext(ctx, …)` so SDK hooks
 *      (`useStorefront`, `useProducts`, …) read the right per-request
 *      context.
 *
 * The cache is in-memory per server instance; that's fine for read
 * traffic since revisions are immutable. On revision rollover we
 * `revalidatePath` the storefront, which busts Next's render cache; the
 * next request rehydrates this LRU.
 */

type LoadedComponent = React.ComponentType;

type LoadResult =
  | { ok: true; Component: LoadedComponent }
  | { ok: false; reason: 'fetch_failed' | 'eval_failed' | 'no_default'; message: string };

const CACHE_MAX = 128;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h — revisions are immutable; 1h is conservative

const cache = new LRUCache<string, LoadedComponent>({
  max: CACHE_MAX,
  ttl: CACHE_TTL_MS,
});

const ALLOWED_MODULES: Record<string, unknown> = {
  react: React,
  // Some bundlers (esbuild via tsup) emit JSX as `react/jsx-runtime`
  // imports; resolve them through the same React instance we control.
  'react/jsx-runtime': ReactJsxRuntime,
  '@souqna/sdk': SouqnaSdk,
};

export async function loadSouqyComponent(args: {
  slug: string;
  revision: string;
  blobUrl: string;
}): Promise<LoadResult> {
  const key = `${args.slug}:${args.revision}`;
  const cached = cache.get(key);
  if (cached) return { ok: true, Component: cached };

  let source: string;
  try {
    // Vercel Blob URLs are immutable per-revision; cache aggressively at
    // the network layer too. The artifact is small (a few KB) so no
    // streaming dance — just read the body.
    const res = await fetch(args.blobUrl, {
      cache: 'force-cache',
      next: { tags: [`souqy:${args.slug}`] },
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: 'fetch_failed',
        message: `Souqy bundle fetch failed: ${res.status} ${res.statusText}`,
      };
    }
    source = await res.text();
  } catch (err) {
    return {
      ok: false,
      reason: 'fetch_failed',
      message: `Souqy bundle fetch threw: ${(err as Error).message}`,
    };
  }

  let exportedDefault: unknown;
  try {
    // Build a CJS-shaped scope and execute the bundle inside it. The
    // captive require throws on any module we didn't allowlist, so
    // generated code cannot reach `fs`, `child_process`, `process`, etc.
    const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
    const captiveRequire = (name: string): unknown => {
      const allowed = ALLOWED_MODULES[name];
      if (!allowed) {
        throw new Error(`Souqy bundle attempted to require disallowed module: '${name}'`);
      }
      return allowed;
    };
    const fn = new Function('module', 'exports', 'require', source);
    fn(moduleObj, moduleObj.exports, captiveRequire);
    exportedDefault =
      moduleObj.exports.default ??
      moduleObj.exports.Storefront ??
      // tsup's CJS interop sometimes flattens default to module.exports.
      (moduleObj.exports as { __esModule?: boolean; default?: unknown }).default ??
      moduleObj.exports;
  } catch (err) {
    return {
      ok: false,
      reason: 'eval_failed',
      message: `Souqy bundle eval failed: ${(err as Error).message}`,
    };
  }

  if (typeof exportedDefault !== 'function') {
    return {
      ok: false,
      reason: 'no_default',
      message: 'Souqy bundle does not default-export a React component.',
    };
  }
  const Component = exportedDefault as LoadedComponent;
  cache.set(key, Component);
  return { ok: true, Component };
}

/**
 * Convenience render helper. Most callers want "give me the rendered
 * tree, set up the context for me." Bundles the AsyncLocalStorage entry
 * + JSX creation so the page handler stays a one-liner.
 */
export function renderSouqyComponent(
  Component: LoadedComponent,
  ctx: SouqyContext,
): React.ReactNode {
  return withSouqyContext(ctx, () => React.createElement(Component));
}

/**
 * Drop a single revision from the in-memory cache. Called after a
 * successful regenerate / reprompt / rollback. Cheap — usually 0–1
 * matching keys per call.
 */
export function evictSouqyRevision(slug: string, revision: string): void {
  cache.delete(`${slug}:${revision}`);
}

/** Drop every cached revision for a slug — used by `souqyClear`. */
export function evictSouqyForSlug(slug: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${slug}:`)) cache.delete(key);
  }
}
