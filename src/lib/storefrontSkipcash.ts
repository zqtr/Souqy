import 'server-only';

import { db } from './db';
import { decryptToken } from './apps/crypto';
import type { SkipCashMerchantCredentials } from './skipcash';

type CredentialsRow = {
  checkout_skipcash_credentials: unknown;
};

export async function getStorefrontSkipCashCredentials(
  slug: string,
): Promise<SkipCashMerchantCredentials | null> {
  const rows = (await db()`
    select checkout_skipcash_credentials
    from briefs
    where slug = ${slug} and expires_at > now()
    limit 1
  `) as unknown as CredentialsRow[];
  const raw = rows[0]?.checkout_skipcash_credentials;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ct = (raw as Record<string, unknown>).ct;
  if (typeof ct !== 'string' || ct.length === 0) return null;

  const json = decryptToken(ct);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<SkipCashMerchantCredentials>;
    if (!parsed.clientId || !parsed.keyId || !parsed.keySecret) return null;
    return {
      clientId: parsed.clientId,
      keyId: parsed.keyId,
      keySecret: parsed.keySecret,
      webhookKey: parsed.webhookKey ?? null,
    };
  } catch {
    return null;
  }
}
