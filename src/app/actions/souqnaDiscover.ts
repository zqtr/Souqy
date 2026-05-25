'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, hasDb } from '@/lib/db';
import { assertSouqnaOperator } from '@/lib/souqna-operator';
import { recordAudit } from '@/lib/audit';

const SlugSchema = z.object({
  slug: z.string().trim().min(1).max(80),
});

const RemoveSchema = SlugSchema.extend({
  reason: z.string().trim().max(180).optional(),
});

export type SouqnaDiscoverActionState =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function refreshDiscoverPaths() {
  revalidatePath('/souqna');
  revalidatePath('/account/souqna');
}

async function audit(slug: string, userId: string, action: string, summary: string) {
  await recordAudit({
    storefrontSlug: slug,
    clerkUserId: userId,
    action,
    summary,
    meta: { surface: 'souqna_discover' },
  }).catch((err) => {
    console.warn('[souqnaDiscover] audit failed', err);
  });
}

export async function featureSouqnaWebsite(
  input: z.input<typeof SlugSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = SlugSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const rows = (await db()`
    update briefs
       set discover_featured_at = coalesce(discover_featured_at, now()),
           discover_hidden_at = null,
           discover_hidden_reason = null,
           discover_spam_shutdown_at = null,
           discover_managed_by = ${operator.email},
           discover_updated_at = now()
     where slug = ${parsed.data.slug}
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.feature', 'Featured on Souqna');
  refreshDiscoverPaths();
  return { status: 'success', message: 'Website featured' };
}

export async function unfeatureSouqnaWebsite(
  input: z.input<typeof SlugSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = SlugSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const rows = (await db()`
    update briefs
       set discover_featured_at = null,
           discover_managed_by = ${operator.email},
           discover_updated_at = now()
     where slug = ${parsed.data.slug}
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.unfeature', 'Removed from featured Souqna rail');
  refreshDiscoverPaths();
  return { status: 'success', message: 'Website unfeatured' };
}

export async function removeSouqnaWebsite(
  input: z.input<typeof RemoveSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const reason = parsed.data.reason || 'Removed by Souqna operator';
  const rows = (await db()`
    update briefs
       set discover_featured_at = null,
           discover_hidden_at = now(),
           discover_hidden_reason = ${reason},
           discover_managed_by = ${operator.email},
           discover_updated_at = now()
     where slug = ${parsed.data.slug}
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.remove', `Removed from Souqna: ${reason}`);
  refreshDiscoverPaths();
  return { status: 'success', message: 'Website removed from Souqna' };
}

export async function restoreSouqnaWebsite(
  input: z.input<typeof SlugSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = SlugSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const rows = (await db()`
    update briefs
       set discover_hidden_at = null,
           discover_hidden_reason = null,
           discover_spam_shutdown_at = null,
           discover_managed_by = ${operator.email},
           discover_updated_at = now()
     where slug = ${parsed.data.slug}
       and deleted_at is null
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.restore', 'Restored to Souqna discovery eligibility');
  refreshDiscoverPaths();
  return { status: 'success', message: 'Website restored' };
}

export async function deleteSouqnaWebsite(
  input: z.input<typeof RemoveSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const reason = parsed.data.reason || 'Deleted by Souqna operator';
  const rows = (await db()`
    update briefs
       set is_published = false,
           discover_featured_at = null,
           discover_hidden_at = coalesce(discover_hidden_at, now()),
           discover_hidden_reason = ${reason},
           discover_spam_shutdown_at = null,
           discover_managed_by = ${operator.email},
           discover_updated_at = now(),
           deleted_at = coalesce(deleted_at, now()),
           deleted_by = ${operator.email},
           deleted_reason = ${reason},
           expires_at = least(expires_at, now())
     where slug = ${parsed.data.slug}
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.delete', `Deleted website: ${reason}`);
  refreshDiscoverPaths();
  revalidatePath(`/brief/${parsed.data.slug}`);
  return { status: 'success', message: 'Website deleted and removed from public access' };
}

export async function shutDownSpamWebsite(
  input: z.input<typeof RemoveSchema>,
): Promise<SouqnaDiscoverActionState> {
  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid website' };
  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const operator = await assertSouqnaOperator();
  const reason = parsed.data.reason || 'Spam or abuse';
  const rows = (await db()`
    update briefs
       set is_published = false,
           discover_featured_at = null,
           discover_hidden_at = now(),
           discover_hidden_reason = ${reason},
           discover_spam_shutdown_at = now(),
           discover_managed_by = ${operator.email},
           discover_updated_at = now()
     where slug = ${parsed.data.slug}
     returning slug
  `) as unknown as Array<{ slug: string }>;

  if (!rows[0]) return { status: 'error', message: 'Website not found' };
  await audit(parsed.data.slug, operator.userId, 'souqna_discover.spam_shutdown', `Spam shutdown: ${reason}`);
  refreshDiscoverPaths();
  return { status: 'success', message: 'Spam website shut down' };
}
