// Fetches official app/brand logos and writes them to public/apps/<id>/mark.<ext>.
//
// Usage:
//   1. Edit scripts/app-logos.json — for each app id, paste the direct URL of
//      the official SVG (or PNG) from the vendor's brand kit. Leave entries as
//      null to skip them and keep the existing Souqna-styled placeholder.
//   2. node scripts/fetch-app-logos.mjs              # fetch every non-null entry
//      node scripts/fetch-app-logos.mjs --only=hubspot,notion
//      node scripts/fetch-app-logos.mjs --dry        # just print what would change
//
// Behaviour:
//   - Detects content-type to pick the right extension (.svg / .png / .webp).
//   - Refuses files >250 KB (sanity guard against full marketing PDFs).
//   - If the saved extension differs from registry.markSrc, prints the
//     registry edit you need to make (does NOT auto-edit the registry).
//   - Always overwrites the existing mark file for that app.
//
// Trademark note:
//   Marks fetched by this script remain trademarks of their respective owners.
//   Souqna uses them under each vendor's brand guidelines for the purpose of
//   listing the integration. Add a LICENSES.md note if your legal review
//   requires explicit attribution.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST = join(__dirname, 'app-logos.json');
const PUBLIC_APPS = join(ROOT, 'public', 'apps');
const REGISTRY = join(ROOT, 'src', 'lib', 'apps', 'registry.ts');

const MAX_BYTES = 250 * 1024;

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const dry = argv.get('dry') === true;
const only = typeof argv.get('only') === 'string'
  ? new Set(String(argv.get('only')).split(',').map((s) => s.trim()))
  : null;

const EXT_BY_TYPE = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

function extFromUrl(url) {
  const m = url.toLowerCase().match(/\.(svg|png|webp|jpe?g)(?:[?#]|$)/);
  return m ? m[1].replace('jpeg', 'jpg') : null;
}

async function loadManifest() {
  const raw = await readFile(MANIFEST, 'utf8');
  const json = JSON.parse(raw);
  delete json.$schema;
  delete json._comment;
  return json;
}

async function loadRegistryMarkSrcs() {
  const src = await readFile(REGISTRY, 'utf8');
  const map = new Map();
  const re = /markSrc:\s*'\/apps\/([^/]+)\/mark\.(svg|png|webp|jpg)'/g;
  let m;
  while ((m = re.exec(src)) !== null) map.set(m[1], m[2]);
  return map;
}

async function fetchOne(id, url, registryExt) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'souqna-logo-fetcher/1.0 (+https://souqna.qa)',
      accept: 'image/svg+xml,image/png,image/webp,image/*;q=0.9,*/*;q=0.5',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[ct] || extFromUrl(url);
  if (!ext) throw new Error(`Unknown image type (content-type=${ct || 'none'})`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`File too large: ${(buf.byteLength / 1024).toFixed(0)} KB > ${MAX_BYTES / 1024} KB`);
  }
  if (buf.byteLength < 200) {
    throw new Error(`Suspiciously small file: ${buf.byteLength} bytes`);
  }

  const dir = join(PUBLIC_APPS, id);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const dest = join(dir, `mark.${ext}`);

  if (dry) {
    console.log(`  [dry] would write ${dest} (${(buf.byteLength / 1024).toFixed(1)} KB, ${ct || 'no ct'})`);
  } else {
    await writeFile(dest, buf);
    console.log(`  wrote ${dest} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
  }

  if (registryExt && registryExt !== ext) {
    console.log(
      `  ! registry edit needed: change markSrc for "${id}" from .${registryExt} -> .${ext} in src/lib/apps/registry.ts`,
    );
  }
  return ext;
}

async function main() {
  const manifest = await loadManifest();
  const registry = await loadRegistryMarkSrcs();

  const entries = Object.entries(manifest).filter(([id, url]) => {
    if (only && !only.has(id)) return false;
    return typeof url === 'string' && url.length > 0;
  });

  if (entries.length === 0) {
    console.log('Nothing to fetch. Add URLs to scripts/app-logos.json first.');
    return;
  }

  console.log(`Fetching ${entries.length} logo${entries.length === 1 ? '' : 's'}${dry ? ' (dry-run)' : ''}...\n`);

  const failures = [];
  for (const [id, url] of entries) {
    console.log(`${id}  <-  ${url}`);
    try {
      await fetchOne(id, url, registry.get(id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAILED: ${msg}`);
      failures.push({ id, url, msg });
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`Done with ${failures.length} failure${failures.length === 1 ? '' : 's'}:`);
    for (const f of failures) console.log(`  - ${f.id}: ${f.msg}`);
    process.exitCode = 1;
  } else {
    console.log('Done.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
