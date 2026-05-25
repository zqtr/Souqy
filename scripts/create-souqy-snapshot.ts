#!/usr/bin/env -S npx tsx
/**
 * Create a Vercel Sandbox snapshot pre-baked with the Souqy build
 * toolchain (tsup + typescript + react types). Run once after any
 * change to the build-time tool versions; the resulting snapshot id
 * gets baked into `SOUQY_BUILD_SNAPSHOT_ID` so every Souqy generation
 * boots in <1s instead of paying a ~30s cold install.
 *
 * Usage:
 *
 *   pnpm tsx scripts/create-souqy-snapshot.ts
 *
 * Requires VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID in env. On
 * Vercel deployments these are auto-resolved via OIDC.
 *
 * The actual `@souqna/sdk` type stub is materialized fresh on every
 * build (see `src/lib/souqy/build.ts`) — this snapshot only ships the
 * tools that don't change per-request.
 */
import { Sandbox } from '@vercel/sandbox';

async function main() {
  console.log('[souqy/snapshot] booting sandbox…');
  const sandbox = await Sandbox.create({
    runtime: 'node24',
    timeout: 600_000,
  });

  console.log('[souqy/snapshot] installing build toolchain (tsup, typescript, react types)…');
  // Pin versions explicitly so the snapshot is reproducible across
  // recreations. Bump these in lockstep with `package.json` whenever
  // the host project upgrades.
  const pkgs = [
    'tsup@^8',
    'typescript@^5.7',
    'react@^18.3',
    'react-dom@^18.3',
    '@types/react@^18.3',
    '@types/react-dom@^18.3',
  ];
  await runOrThrow(sandbox, 'npm', ['install', '-g', ...pkgs]);

  console.log('[souqy/snapshot] sanity-checking…');
  await runOrThrow(sandbox, 'npx', ['tsup', '--version']);
  await runOrThrow(sandbox, 'npx', ['tsc', '--version']);

  console.log('[souqy/snapshot] taking snapshot (this can take a minute)…');
  const snapshot = await sandbox.snapshot();
  await sandbox.stop();

  console.log('');
  console.log('[souqy/snapshot] SUCCESS');
  console.log(`  Snapshot id: ${snapshot.snapshotId}`);
  console.log('');
  console.log('Add this to your Vercel project envs:');
  console.log(`  SOUQY_BUILD_SNAPSHOT_ID=${snapshot.snapshotId}`);
}

async function runOrThrow(
  sandbox: InstanceType<typeof Sandbox>,
  cmd: string,
  args: string[],
): Promise<void> {
  const result = await sandbox.runCommand(cmd, args);
  const out = await result.stdout();
  const err = await result.stderr();
  if (out.trim()) console.log(`  $ ${cmd} ${args.join(' ')}\n${indent(out)}`);
  if (err.trim()) console.error(`  $ ${cmd} ${args.join(' ')} (stderr)\n${indent(err)}`);
  if (result.exitCode !== 0) {
    throw new Error(
      `command failed (exit ${result.exitCode}): ${cmd} ${args.join(' ')}\n${err}`,
    );
  }
}

function indent(s: string): string {
  return s
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}

main().catch((err) => {
  console.error('[souqy/snapshot] failed:', err);
  process.exit(1);
});
