import { z } from 'zod';
import { gateAtelierPro } from '@/lib/billing';
import { getSouqyAuditForStorefront, getSouqyMonthlyCount } from '@/lib/souqy/db';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const QuerySchema = z.object({
  store: z.string().trim().min(1),
});

const MONTHLY_GENERATION_CAP = Number.parseInt(process.env.SOUQY_MONTHLY_CAP ?? '50', 10);

export async function GET(req: Request): Promise<Response> {
  const parsed = QuerySchema.safeParse({ store: searchParam(req, 'store') });
  if (!parsed.success) {
    return mobileError(400, 'missing_store', 'Choose a storefront first.');
  }

  const gate = await requireMobileStoreAccess(parsed.data.store, 'builder.edit');
  if (!gate.ok) return gate.response;

  const planGate = await gateAtelierPro(gate.user.userId);
  if (!planGate.ok) {
    return mobileError(
      planGate.reason === 'unauthenticated' ? 401 : 402,
      'souqy_requires_pro_plus',
      'Souqy is available on Pro + and above.',
    );
  }

  const [monthlyUsed, audit] = await Promise.all([
    getSouqyMonthlyCount(gate.user.userId),
    getSouqyAuditForStorefront(gate.access.storefront.slug, 8),
  ]);
  const latest = audit[0] ?? null;

  return mobileJson({
    store: {
      slug: gate.access.storefront.slug,
      businessName: gate.access.storefront.businessName,
      locale: gate.access.storefront.locale,
    },
    access: {
      allowed: true,
      reason: 'ok',
      monthlyUsed,
      monthlyLimit: MONTHLY_GENERATION_CAP,
    },
    published: {
      revision: gate.access.storefront.souqyRevision,
      blobUrl: gate.access.storefront.souqyBlobUrl,
      hasSource: Boolean(gate.access.storefront.souqySource),
      briefSummary: briefSummary(gate.access.storefront.souqyBrief),
    },
    latest: latest
      ? {
          id: latest.id,
          occurredAt: latest.occurredAt.toISOString(),
          kind: latest.kind,
          status: latest.status,
          prompt: latest.prompt,
        }
      : null,
    audit: audit.map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt.toISOString(),
      kind: entry.kind,
      status: entry.status,
      prompt: entry.prompt,
      source: entry.source,
    })),
  });
}

function briefSummary(brief: unknown): string | null {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) return null;
  const record = brief as Record<string, unknown>;
  const parts = [record.businessName, record.businessType, record.locale]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
  return parts.length ? parts.join(' · ') : null;
}
