import 'server-only';
import { randomUUID } from 'node:crypto';
import { Sandbox } from '@vercel/sandbox';
import { put } from '@vercel/blob';
import { env } from '@/lib/env';
import {
  souqnaSdkDts,
  souqnaSdkPackageJson,
  souqnaSdkStubJs,
} from './sdk-stub';

/**
 * Build pipeline for Souqy-generated TSX.
 *
 * Steps inside an ephemeral Vercel Sandbox microVM:
 *
 *   1. Materialize the project: write Claude's `index.tsx` + `theme.ts`,
 *      a `tsconfig.json`, and a synthetic `@souqna/sdk` type stub.
 *   2. Run `tsc --noEmit` so type errors surface before we waste an
 *      esbuild pass.
 *   3. Bundle with `tsup --format cjs --external react,@souqna/sdk` so
 *      the artifact is a plain CommonJS module the dynamic loader can
 *      `new Function`-eval at request time.
 *   4. Upload the compiled JS to Vercel Blob, returning a stable
 *      `souqy_revision` id and the public URL.
 *
 * The sandbox boot uses a pre-baked snapshot when
 * `SOUQY_BUILD_SNAPSHOT_ID` is set (created via
 * `scripts/create-souqy-snapshot.ts`); without one, every build pays a
 * ~30s tool-install cost — workable for local dev, painful for prod.
 */

export type BuildInput = {
  slug: string;
  /** Source files from the validated Souqy output. */
  files: { 'index.tsx': string; 'theme.ts': string };
};

export type BuildOk = {
  status: 'ok';
  revision: string;
  blobUrl: string;
  /** Compiled artifact size in bytes — useful for surfacing in the UI. */
  bytes: number;
  /** Wall-clock build time in milliseconds. */
  buildMs: number;
};

export type BuildErr = {
  status: 'tsc_failed' | 'bundle_failed' | 'sandbox_failed' | 'upload_failed';
  message: string;
  log?: string;
};

export type BuildResult = BuildOk | BuildErr;

const BUILD_TIMEOUT_MS = 180_000;
const PROJECT_ROOT = '/tmp/souqy';

export async function buildSouqyArtifact(input: BuildInput): Promise<BuildResult> {
  const startedAt = Date.now();
  const revision = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

  let sandbox: InstanceType<typeof Sandbox>;
  try {
    sandbox = await openSandbox();
  } catch (err) {
    return {
      status: 'sandbox_failed',
      message: `Could not open sandbox: ${(err as Error).message}`,
    };
  }

  try {
    await materialize(sandbox, input.files);

    const tsc = await sandbox.runCommand('npx', [
      'tsc',
      '--noEmit',
      '-p',
      `${PROJECT_ROOT}/tsconfig.json`,
    ]);
    if (tsc.exitCode !== 0) {
      const log = `${await tsc.stdout()}\n${await tsc.stderr()}`.trim();
      return {
        status: 'tsc_failed',
        message: 'Souqy output failed type check.',
        log: log.slice(0, 4000),
      };
    }

    // tsup writes the bundle to /tmp/souqy/dist/index.js. We mark react
    // and @souqna/sdk as external so the runtime can inject our app's
    // own React + SDK module instances (avoids two-React bugs and keeps
    // the artifact ~5KB instead of ~150KB).
    // Sandbox.runCommand has no cwd flag; chain via `sh -c` so the
    // bundler runs against the project we materialized.
    const tsupCmd = [
      `cd ${PROJECT_ROOT}`,
      [
        'npx tsup index.tsx',
        '--format cjs',
        '--external react',
        '--external react-dom',
        '--external @souqna/sdk',
        '--out-dir dist',
        '--target es2022',
        '--no-splitting',
        '--no-dts',
        '--no-shims',
        '--minify',
        '--clean',
      ].join(' '),
    ].join(' && ');
    const tsup = await sandbox.runCommand('sh', ['-c', tsupCmd]);
    if (tsup.exitCode !== 0) {
      const log = `${await tsup.stdout()}\n${await tsup.stderr()}`.trim();
      return {
        status: 'bundle_failed',
        message: 'Souqy bundle step failed.',
        log: log.slice(0, 4000),
      };
    }

    const cat = await sandbox.runCommand('cat', [`${PROJECT_ROOT}/dist/index.js`]);
    if (cat.exitCode !== 0) {
      return {
        status: 'bundle_failed',
        message: 'Bundle output not found after tsup ran.',
      };
    }
    const bundle = await cat.stdout();

    if (!env.BLOB_READ_WRITE_TOKEN) {
      // The repo's existing convention: actions throw a soft error
      // when blob is unconfigured. The dashboard surfaces it; founder
      // sees "Please contact support" which beats a half-deployed file.
      return {
        status: 'upload_failed',
        message: 'Blob storage is not configured (BLOB_READ_WRITE_TOKEN missing).',
      };
    }

    let blobUrl: string;
    try {
      const result = await put(`souqy/${input.slug}/${revision}.js`, bundle, {
        access: 'public',
        // Compiled artifact is content-immutable per revision id; aggressive
        // immutable cache keeps blob bandwidth low when many visitors hit
        // a popular storefront.
        cacheControlMaxAge: 60 * 60 * 24 * 30,
        contentType: 'application/javascript',
        token: env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      blobUrl = result.url;
    } catch (err) {
      return {
        status: 'upload_failed',
        message: `Blob upload failed: ${(err as Error).message}`,
      };
    }

    return {
      status: 'ok',
      revision,
      blobUrl,
      bytes: Buffer.byteLength(bundle, 'utf8'),
      buildMs: Date.now() - startedAt,
    };
  } finally {
    try {
      await sandbox.stop();
    } catch (err) {
      // Sandbox cleanup is best-effort; an orphaned VM idles out within
      // its own timeout and Vercel reaps it.
      console.warn('[souqy/build] sandbox stop failed', err);
    }
  }
}

async function openSandbox(): Promise<InstanceType<typeof Sandbox>> {
  const credentials = sandboxCredentials();
  const snapshotId = env.SOUQY_BUILD_SNAPSHOT_ID;
  if (snapshotId) {
    return Sandbox.create({
      ...credentials,
      source: { type: 'snapshot', snapshotId },
      timeout: BUILD_TIMEOUT_MS,
    });
  }
  // Cold path — install the toolchain inline. Slower (~30s) but lets
  // local dev run without first creating a snapshot.
  const sandbox = await Sandbox.create({
    ...credentials,
    runtime: 'node24',
    timeout: BUILD_TIMEOUT_MS,
  });
  await sandbox.runCommand('npm', [
    'install',
    '-g',
    'tsup@^8',
    'typescript@^5.7',
    'react@^18.3',
    'react-dom@^18.3',
    '@types/react@^18.3',
    '@types/react-dom@^18.3',
  ]);
  return sandbox;
}

function sandboxCredentials(): Record<string, string> {
  // On Vercel deployments OIDC handles auth automatically. Locally the
  // operator passes their own VERCEL_TOKEN + team + project.
  if (
    process.env.VERCEL_TOKEN &&
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID
  ) {
    return {
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };
  }
  return {};
}

/**
 * Write the project skeleton inside the sandbox: source files, the
 * synthetic `@souqna/sdk` package, and a minimal tsconfig that mirrors
 * the host project's settings.
 */
async function materialize(
  sandbox: InstanceType<typeof Sandbox>,
  files: BuildInput['files'],
): Promise<void> {
  await sandbox.runCommand('mkdir', ['-p', `${PROJECT_ROOT}/node_modules/@souqna/sdk`]);
  await writeFile(sandbox, `${PROJECT_ROOT}/index.tsx`, files['index.tsx']);
  await writeFile(sandbox, `${PROJECT_ROOT}/theme.ts`, files['theme.ts']);
  await writeFile(sandbox, `${PROJECT_ROOT}/tsconfig.json`, tsconfigJson());
  await writeFile(
    sandbox,
    `${PROJECT_ROOT}/node_modules/@souqna/sdk/package.json`,
    souqnaSdkPackageJson(),
  );
  await writeFile(
    sandbox,
    `${PROJECT_ROOT}/node_modules/@souqna/sdk/index.d.ts`,
    souqnaSdkDts(),
  );
  await writeFile(
    sandbox,
    `${PROJECT_ROOT}/node_modules/@souqna/sdk/index.js`,
    souqnaSdkStubJs(),
  );
}

async function writeFile(
  sandbox: InstanceType<typeof Sandbox>,
  path: string,
  contents: string,
): Promise<void> {
  // Sandbox SDK exposes `runCommand`. Use `sh -c` with a heredoc so we
  // don't have to deal with argv quoting on contents that can contain
  // newlines, dollar signs, backticks, etc. Base64 round-trip avoids
  // any shell-interpretation surprise: nothing in `contents` reaches a
  // shell parser.
  const b64 = Buffer.from(contents, 'utf8').toString('base64');
  const cmd = `printf '%s' '${b64}' | base64 -d > '${path}'`;
  const result = await sandbox.runCommand('sh', ['-c', cmd]);
  if (result.exitCode !== 0) {
    const err = await result.stderr();
    throw new Error(`writeFile(${path}) failed: ${err.trim() || `exit ${result.exitCode}`}`);
  }
}

function tsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'es2022',
        lib: ['dom', 'dom.iterable', 'esnext'],
        module: 'esnext',
        moduleResolution: 'bundler',
        jsx: 'preserve',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        noEmit: true,
        isolatedModules: true,
        types: ['react'],
      },
      include: ['index.tsx', 'theme.ts'],
    },
    null,
    2,
  );
}
