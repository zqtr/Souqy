// Tiny one-shot migration runner — reads a single .sql file and runs it
// against DATABASE_URL via the Neon HTTP driver. Idempotent guards live
// inside each migration; this runner only orchestrates I/O.

import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

// Inline parse of .env.local so we don't take a dependency on dotenv.
try {
  const env = await readFile('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // file optional; rely on already-set env
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/run-migration.mjs <path.sql>');
  process.exit(1);
}

const url = (process.env.DATABASE_URL ?? '').trim().replace(/\\r\\n$/, '');
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(url);
const text = await readFile(file, 'utf8');

// Strip leading SQL comments and split on top-level semicolons. We do
// not have a real lexer here, but our migrations only contain plain
// DDL/DML so this is enough to handle them.
const statements = [];
let buf = '';
let inDollar = false;
for (const line of text.split(/\r?\n/)) {
  buf += line + '\n';
  if (/\$\$/.test(line)) inDollar = !inDollar;
  if (!inDollar && /;\s*$/.test(line.trim())) {
    statements.push(buf.trim());
    buf = '';
  }
}
if (buf.trim()) statements.push(buf.trim());

function stripLeadingComments(stmt) {
  // Drop SQL `--` line comments and blank lines from the top so the
  // first non-comment line surfaces (used to skip pure-comment + tx
  // delimiter blocks).
  const lines = stmt.split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('--')) i++;
    else break;
  }
  return lines.slice(i).join('\n').trim();
}

console.log(`Running ${statements.length} statements from ${file}`);
for (const raw of statements) {
  const stmt = stripLeadingComments(raw);
  if (!stmt || stmt === 'begin;' || stmt === 'commit;') continue;
  const summary = stmt.split('\n')[0].slice(0, 80);
  process.stdout.write(`  → ${summary} … `);
  try {
    await sql.query(stmt);
    console.log('ok');
  } catch (err) {
    console.log('FAILED');
    console.error(err);
    process.exit(1);
  }
}
console.log('Migration complete');
