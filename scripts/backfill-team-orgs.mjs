#!/usr/bin/env node
/**
 * Optional backfill — creates one Clerk Organization per existing
 * storefront and writes the org id back to `briefs.clerk_org_id`.
 *
 * Not strictly required: the Settings → Team tab calls
 * `ensureOrgForStorefront` lazily on the first invite, so untouched
 * storefronts simply stay org-less. Running this script up-front is
 * useful if you want every existing storefront to already have an org
 * (e.g. before bulk-importing members).
 *
 * Usage:
 *   CLERK_SECRET_KEY=... DATABASE_URL=... node scripts/backfill-team-orgs.mjs
 *
 * Idempotent: storefronts that already have a `clerk_org_id` are
 * skipped. Failures are logged and skipped — re-run to retry.
 */

import { neon } from '@neondatabase/serverless';
import { createClerkClient } from '@clerk/backend';

const dbUrl = process.env.DATABASE_URL?.trim();
const clerkKey = process.env.CLERK_SECRET_KEY?.trim();

if (!dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!clerkKey) {
  console.error('CLERK_SECRET_KEY is required');
  process.exit(1);
}

const sql = neon(dbUrl, { fetchOptions: { cache: 'no-store' } });
const clerk = createClerkClient({ secretKey: clerkKey });

const rows = await sql`
  select slug, business_name, clerk_user_id
  from briefs
  where clerk_org_id is null and clerk_user_id is not null
  order by created_at asc
`;

console.log(`[backfill-team-orgs] ${rows.length} storefront(s) without an org.`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  try {
    const org = await clerk.organizations.createOrganization({
      name: row.business_name || row.slug,
      slug: `souqna-${row.slug}`.slice(0, 50),
      createdBy: row.clerk_user_id,
    });
    await sql`update briefs set clerk_org_id = ${org.id} where slug = ${row.slug}`;
    console.log(`  ✓ ${row.slug} → ${org.id}`);
    ok++;
  } catch (err) {
    console.warn(`  ✗ ${row.slug}: ${err?.message ?? err}`);
    fail++;
  }
}

console.log(`[backfill-team-orgs] done — ${ok} ok, ${fail} failed.`);
