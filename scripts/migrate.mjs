#!/usr/bin/env node
/**
 * Migration runner — applied at build time on Vercel and runnable
 * locally via `npm run migrate`.
 *
 * Why this exists: until 2026-05 migrations were applied by hand
 * against Neon, which created a race window between deploy ("the new
 * code references column X") and the operator remembering to run
 * `psql -f migration_NNN.sql`. The first time we hit the race, the
 * production app threw `column "..." does not exist` from the SSR
 * render of `/account/settings/domain`. Wiring the runner into
 * `npm run build` closes the race: every deploy applies pending
 * migrations *before* `next build` starts compiling, so by the time
 * the new code serves traffic the schema is already there.
 *
 * Tracking table:
 *
 *   create table _migrations (
 *     filename    text primary key,
 *     applied_at  timestamptz not null default now()
 *   )
 *
 * Each `*.sql` file in `src/db/migrations/` is applied in
 * lexicographic order if its filename is not already in the table.
 * Statements are split on top-level `;` (string-literal-aware) and
 * issued one-at-a-time over the Neon HTTP driver, which doesn't
 * support multi-statement requests. Migrations should keep using
 * `if not exists` / `if exists` so an ad-hoc partial apply doesn't
 * wedge the next run.
 *
 * Skip cases:
 *   - DATABASE_URL unset → log + exit 0 so local builds without a DB
 *     URL (e.g. `next build` to typecheck) still succeed.
 *   - Migrations dir missing → exit 0 (fresh checkout, nothing to do).
 *
 * Failure case:
 *   - Any SQL statement throws → exit 1 so the Vercel build aborts
 *     and the broken migration doesn't ship behind a green build.
 */

import { neon } from '@neondatabase/serverless';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');

function log(msg) {
  process.stdout.write(`[migrate] ${msg}\n`);
}

/**
 * Strip line comments and split on top-level semicolons. Tracks single
 * quotes + dollar-quoted strings so a `';'` in a string literal or
 * inside `$$ ... $$` body doesn't end the statement prematurely.
 *
 * Also skips bare `begin` / `commit` keywords because the Neon HTTP
 * driver runs every statement in its own implicit transaction; an
 * explicit `begin` issued alone confuses the wire protocol.
 */
function splitSql(sql) {
  const noLineComments = sql.replace(/^\s*--.*$/gm, '');
  const out = [];
  let buf = '';
  let inSingle = false;
  let inDollar = false;
  let dollarTag = '';
  for (let i = 0; i < noLineComments.length; i++) {
    const ch = noLineComments[i];
    if (inSingle) {
      buf += ch;
      if (ch === "'" && noLineComments[i + 1] !== "'") inSingle = false;
      continue;
    }
    if (inDollar) {
      buf += ch;
      if (ch === '$' && noLineComments.slice(i, i + dollarTag.length) === dollarTag) {
        buf += noLineComments.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        inDollar = false;
        dollarTag = '';
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '$') {
      const m = noLineComments.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        inDollar = true;
        buf += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt && !/^(begin|commit|start transaction|end)\s*$/i.test(stmt)) {
        out.push(stmt);
      }
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail && !/^(begin|commit|start transaction|end)\s*$/i.test(tail)) {
    out.push(tail);
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    log('DATABASE_URL not set; skipping (build will continue).');
    return;
  }
  if (!existsSync(MIGRATIONS_DIR)) {
    log(`no migrations dir at ${MIGRATIONS_DIR}; nothing to do.`);
    return;
  }

  const sql = neon(url, { fetchOptions: { cache: 'no-store' } });

  await sql`
    create table if not exists _migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql`select filename from _migrations`).map((r) => r.filename),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    log(`up to date (${files.length} migrations, 0 pending).`);
    return;
  }

  log(`applying ${pending.length} pending migration(s)…`);
  for (const f of pending) {
    const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    const stmts = splitSql(body);
    log(`→ ${f} (${stmts.length} statement${stmts.length === 1 ? '' : 's'})`);
    for (const stmt of stmts) {
      try {
        await sql.query(stmt);
      } catch (err) {
        log(`✗ ${f} failed on statement:\n${stmt.slice(0, 200)}`);
        throw err;
      }
    }
    await sql`insert into _migrations (filename) values (${f})`;
    log(`✓ ${f}`);
  }
  log(`done — ${pending.length} applied.`);
}

main().catch((err) => {
  log(`ERROR: ${err?.message ?? err}`);
  process.exit(1);
});
