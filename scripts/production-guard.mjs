import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mode = args[0] ?? 'all';
const isProd = args.includes('--prod') || mode === 'prod';

const override = process.env.SOUQNA_GUARD_OVERRIDE === '1';

function runGit(gitArgs, options = {}) {
  try {
    return execFileSync('git', gitArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch {
    return '';
  }
}

const gitRoot = runGit(['rev-parse', '--show-toplevel']);
const root = gitRoot ? path.resolve(gitRoot) : process.cwd();
const configPath = path.join(root, 'production-guard.config.json');

function fail(message, details = []) {
  if (override) {
    console.warn(`[souqna-guard] OVERRIDE: ${message}`);
    for (const detail of details) console.warn(`  - ${detail}`);
    return;
  }

  console.error(`\n[souqna-guard] Blocked: ${message}`);
  for (const detail of details) console.error(`  - ${detail}`);
  console.error('  - Set SOUQNA_GUARD_OVERRIDE=1 only if you intentionally accept this risk.\n');
  process.exit(1);
}

function warn(message) {
  console.warn(`[souqna-guard] ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Could not read ${path.relative(root, filePath)}`, [String(error)]);
  }
}

function isPathEntry(target) {
  const full = path.join(root, target);
  return existsSync(full);
}

function matchesPattern(value, pattern) {
  if (pattern.endsWith('/*')) return value.startsWith(pattern.slice(0, -1));
  return value === pattern;
}

function normalizeRemote(remote) {
  return remote.replace(/\/$/, '');
}

function checkRootIdentity(config) {
  const pkg = readJson(path.join(root, 'package.json'));

  if (pkg.name !== config.expectedPackageName) {
    fail('This is not the Souqna web package.', [
      `Expected package name: ${config.expectedPackageName}`,
      `Actual package name: ${pkg.name ?? '(missing)'}`,
      `Root: ${root}`,
    ]);
  }

  const missing = config.requiredRootFiles.filter((entry) => !isPathEntry(entry));
  if (missing.length > 0) {
    fail('This folder does not look like the Souqna Next.js web root.', [
      `Missing: ${missing.join(', ')}`,
      `Root: ${root}`,
    ]);
  }

  const rootMarkers = config.blockedRootMarkers.filter((entry) => isPathEntry(entry));
  if (rootMarkers.length > 0) {
    fail('This folder looks like a Flutter/mobile root, not the Souqna web root.', [
      `Blocked root markers: ${rootMarkers.join(', ')}`,
      `Root: ${root}`,
    ]);
  }
}

function checkGitIdentity(config) {
  const remote = normalizeRemote(runGit(['remote', 'get-url', 'origin']));
  const allowed = config.allowedGitRemotes.map(normalizeRemote);

  if (!allowed.includes(remote)) {
    fail('Git origin does not match the approved Souqna web repo.', [
      `Expected one of: ${allowed.join(', ')}`,
      `Actual: ${remote || '(missing)'}`,
    ]);
  }
}

function checkBranch(config, productionOnly = false) {
  const branch = runGit(['branch', '--show-current']);
  const patterns = productionOnly ? config.allowedProductionBranches : config.allowedCommitBranches;

  if (!branch) {
    fail('Detached HEAD commits/pushes are blocked for Souqna web.', [
      'Checkout an approved branch first, usually: git checkout main',
    ]);
  }

  if (!patterns.some((pattern) => matchesPattern(branch, pattern))) {
    fail(productionOnly ? 'Production deploys are only allowed from approved branches.' : 'Commits are only allowed from approved branches.', [
      `Allowed: ${patterns.join(', ')}`,
      `Current: ${branch}`,
    ]);
  }
}

function checkStagedPaths(config) {
  const staged = runGit(['diff', '--cached', '--name-only'])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const blocked = staged.filter((entry) =>
    config.blockedStagedPaths.some((blockedPath) =>
      blockedPath.endsWith('/') ? entry.startsWith(blockedPath) : entry === blockedPath,
    ),
  );

  if (blocked.length > 0) {
    fail('Staged files include mobile/local deployment material that must not be committed to Souqna web.', blocked);
  }
}

function checkVercelIdentity(config) {
  const projectPath = path.join(root, '.vercel', 'project.json');
  if (!existsSync(projectPath)) {
    fail('This folder is not linked to the Souqna Vercel project.', [
      'Run vercel link in the approved Souqna web folder before deploying.',
    ]);
  }

  const actual = readJson(projectPath);
  const expected = config.expectedVercel;
  const mismatches = ['orgId', 'projectId', 'projectName'].filter((key) => actual[key] !== expected[key]);

  if (mismatches.length > 0) {
    fail('Vercel project link does not match Souqna production.', [
      ...mismatches.map((key) => `${key}: expected ${expected[key]}, actual ${actual[key] ?? '(missing)'}`),
      `Protected domains: ${config.protectedProductionDomains.join(', ')}`,
    ]);
  }
}

function checkVercelIgnore(config) {
  const ignorePath = path.join(root, '.vercelignore');
  const text = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  const missing = config.requiredVercelIgnoreEntries.filter((entry) => !text.includes(entry));

  if (missing.length > 0) {
    fail('.vercelignore is missing entries that keep mobile/sibling apps out of web deployments.', missing);
  }
}

function checkProductionCleanTree() {
  const dirty = runGit(['status', '--short']);
  if (dirty) {
    fail('Production deploys require a clean Git tree.', dirty.split(/\r?\n/));
  }
}

function checkNoSouqnaSourceCrons() {
  const vercelPath = path.join(root, 'vercel.json');
  const text = existsSync(vercelPath) ? readFileSync(vercelPath, 'utf8') : '';
  if (text.includes('/api/apps/souqnasource')) {
    fail('SouqnaSource cron routes are still configured for deployment.', [
      'Remove SouqnaSource crons before deploying to production.',
    ]);
  }
}

function checkVercelBuildEnvironment(config) {
  if (process.env.VERCEL !== '1') return;

  const expected = config.expectedVercel;
  const actualProjectId = process.env.VERCEL_PROJECT_ID;

  if (actualProjectId && actualProjectId !== expected.projectId) {
    fail('Vercel build is running under the wrong project.', [
      `Expected project id: ${expected.projectId}`,
      `Actual project id: ${actualProjectId}`,
    ]);
  }

  if (process.env.VERCEL_ENV !== 'production') return;

  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repoSlug = process.env.VERCEL_GIT_REPO_SLUG;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (owner && owner.toLowerCase() !== config.expectedGit.owner.toLowerCase()) {
    fail('Production Vercel build is from the wrong GitHub owner.', [
      `Expected owner: ${config.expectedGit.owner}`,
      `Actual owner: ${owner}`,
    ]);
  }

  if (repoSlug && repoSlug.toLowerCase() !== config.expectedGit.repoSlug.toLowerCase()) {
    fail('Production Vercel build is from the wrong GitHub repo.', [
      `Expected repo: ${config.expectedGit.repoSlug}`,
      `Actual repo: ${repoSlug}`,
    ]);
  }

  if (branch && !config.allowedProductionBranches.some((pattern) => matchesPattern(branch, pattern))) {
    fail('Production Vercel build is from a non-production branch.', [
      `Allowed: ${config.allowedProductionBranches.join(', ')}`,
      `Actual: ${branch}`,
    ]);
  }

  if (productionUrl && !config.protectedProductionDomains.includes(productionUrl)) {
    fail('Production Vercel build is targeting an unexpected production domain.', [
      `Expected one of: ${config.protectedProductionDomains.join(', ')}`,
      `Actual: ${productionUrl}`,
    ]);
  }
}

function readPrePushRefs() {
  if (mode !== 'push') return [];
  try {
    const input = readFileSync(0, 'utf8').trim();
    if (!input) return [];
    return input.split(/\r?\n/).map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
  } catch {
    return [];
  }
}

const config = readJson(configPath);

checkRootIdentity(config);
if (!(mode === 'build' && process.env.VERCEL === '1')) {
  checkGitIdentity(config);
}

if (mode === 'commit') {
  checkBranch(config);
  checkStagedPaths(config);
} else if (mode === 'push') {
  checkBranch(config);
  checkVercelIdentity(config);
  checkVercelIgnore(config);

  const protectedPush = readPrePushRefs().some((ref) => ref.remoteRef === 'refs/heads/main');
  if (protectedPush) {
    checkBranch(config, true);
    checkNoSouqnaSourceCrons();
  }
} else if (mode === 'deploy' || mode === 'prod') {
  checkVercelIdentity(config);
  checkVercelIgnore(config);
  checkNoSouqnaSourceCrons();

  if (isProd) {
    checkBranch(config, true);
    checkProductionCleanTree();
  }
} else if (mode === 'build') {
  checkVercelIgnore(config);
  checkNoSouqnaSourceCrons();
  checkVercelBuildEnvironment(config);
} else {
  checkBranch(config);
  checkStagedPaths(config);
  checkVercelIdentity(config);
  checkVercelIgnore(config);
}

warn(`Passed ${mode}${isProd ? ' --prod' : ''} checks for ${path.basename(root)}.`);
