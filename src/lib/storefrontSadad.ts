import 'server-only';

import { db } from './db';
import { decryptToken } from './apps/crypto';
import type { SadadMerchantCredentials } from './sadad';

type CredentialsRow = {
  checkout_sadad_credentials: unknown;
};

export async function getStorefrontSadadCredentials(
  slug: string,
): Promise<SadadMerchantCredentials | null> {
  const rows = (await db()`
    select checkout_sadad_credentials
    from briefs
    where slug = ${slug} and expires_at > now()
    limit 1
  `) as unknown as CredentialsRow[];
  const raw = rows[0]?.checkout_sadad_credentials;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ct = (raw as Record<string, unknown>).ct;
  if (typeof ct !== 'string' || ct.length === 0) return null;

  const json = decryptToken(ct);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<SadadMerchantCredentials>;
    if (!parsed.merchantId || !parsed.website || !parsed.secretKey) return null;
    return {
      merchantId: parsed.merchantId,
      website: parsed.website,
      secretKey: parsed.secretKey,
    };
  } catch {
    return null;
  }
}
