import { db } from '@/lib/db';
import { pushNotification } from '@/lib/notifications';
import { listLinksForSync, updateLinkSync } from './links';
import { getListingById } from './listings';
import { CLIENTS } from './clients';
import type { SourceNetwork } from './types';

const DRIFT_THRESHOLD = Number(process.env.SOUQNASOURCE_DRIFT_THRESHOLD ?? '0.10');
const TIME_BUDGET_MS = 250_000;

export type SyncSummary = {
  walked: number;
  delistedNotified: number;
  driftNotified: number;
};

async function getOwner(slug: string): Promise<string | null> {
  const rows = (await db()`
    select clerk_user_id from briefs where slug = ${slug} limit 1
  `) as unknown as { clerk_user_id: string }[];
  return rows[0]?.clerk_user_id ?? null;
}

async function notifyOwner(
  slug: string,
  kind: string,
  productId: string,
  copy: { en: string; ar: string },
): Promise<void> {
  const userId = await getOwner(slug);
  if (!userId) return;
  await pushNotification({
    userId,
    kind,
    title: copy.en,
    titleAr: copy.ar,
    body: null,
    bodyAr: null,
    meta: { dedupeKey: `${kind}:${productId}`, productId, storefrontSlug: slug },
  });
}

export async function runSync(): Promise<SyncSummary> {
  const start = Date.now();
  const out: SyncSummary = { walked: 0, delistedNotified: 0, driftNotified: 0 };

  const links = await listLinksForSync(500);
  for (const link of links) {
    if (Date.now() - start > TIME_BUDGET_MS) break;
    if (!link.listingId) continue;

    const listing = await getListingById(link.listingId);
    if (!listing || listing.delistedAt) {
      await db()`update products set status = 'draft' where id = ${link.productId}::uuid`;
      await notifyOwner(link.storefrontSlug, 'souqnasource:delisted', link.productId, {
        en: 'A SouqnaSource product was delisted by the supplier — your listing was unpublished.',
        ar: 'منتج من SouqnaSource تم إزالته من المورد — تم إخفاء منتجك.',
      });
      await updateLinkSync(link.productId, { lastSeenPrice: null, priceDriftPct: null });
      out.delistedNotified++;
      out.walked++;
      continue;
    }

    let freshPrice: number | null = null;
    const indexedAge = Date.now() - new Date(listing.lastIndexedAt).getTime();
    if (listing.listingType === 'priced' && indexedAge < 24 * 3600 * 1000) {
      freshPrice = listing.price;
    } else if (listing.listingType === 'priced') {
      const client = CLIENTS[listing.network as SourceNetwork];
      const fresh = await client
        .refreshListing(listing.sourceListingUrl.split('/').pop() ?? '')
        .catch(() => null);
      freshPrice = fresh?.price ?? null;
    }

    if (freshPrice === null) {
      await updateLinkSync(link.productId, { lastSeenPrice: null, priceDriftPct: null });
      out.walked++;
      continue;
    }

    const drift = (freshPrice - link.supplierCost) / Math.max(link.supplierCost, 1);
    await updateLinkSync(link.productId, {
      lastSeenPrice: freshPrice,
      priceDriftPct: Math.round(drift * 10000) / 100,
    });
    if (Math.abs(drift) >= DRIFT_THRESHOLD) {
      const direction = drift > 0 ? 'up' : 'down';
      await notifyOwner(
        link.storefrontSlug,
        `souqnasource:price_${direction}`,
        link.productId,
        direction === 'up'
          ? {
              en: `Supplier raised price by ${Math.round(drift * 100)}%. Review your margin.`,
              ar: `رفع المورد السعر بنسبة ${Math.round(drift * 100)}%. راجع الهامش.`,
            }
          : {
              en: `Supplier dropped price by ${Math.round(drift * 100)}%. Margin opportunity.`,
              ar: `خفّض المورد السعر بنسبة ${Math.round(drift * 100)}%. فرصة لزيادة الهامش.`,
            },
      );
      out.driftNotified++;
    }
    out.walked++;
  }

  return out;
}
