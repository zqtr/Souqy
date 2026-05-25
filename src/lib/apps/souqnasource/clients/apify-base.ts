// src/lib/apps/souqnasource/clients/apify-base.ts
import { ApifyClient } from 'apify-client';

let _client: ApifyClient | null = null;
export function apify(): ApifyClient {
  if (_client) return _client;
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN not set');
  _client = new ApifyClient({ token });
  return _client;
}

/**
 * Run an Apify actor to completion and return its dataset items.
 * `timeoutSecs` defaults to 240s to stay under the Vercel cron 300s limit.
 */
export async function runActor<T = Record<string, unknown>>(opts: {
  actorId: string;
  input: Record<string, unknown>;
  timeoutSecs?: number;
}): Promise<T[]> {
  const client = apify();
  const run = await client.actor(opts.actorId).call(opts.input, {
    timeout: opts.timeoutSecs ?? 240,
  });
  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Apify actor ${opts.actorId} ended with ${run.status}`);
  }
  const ds = client.dataset(run.defaultDatasetId);
  const { items } = await ds.listItems();
  return items as T[];
}

export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 8) return null;
  // Qatari numbers: 8 digits → prepend +974. Otherwise treat as already E.164-ish.
  if (digits.length === 8) return `+974${digits}`;
  if (digits.startsWith('974')) return `+${digits}`;
  return `+${digits}`;
}

export function listingId(network: string, sourceId: string): string {
  // Stable hash-like id; cheap, no collision risk at our cardinality.
  return `${network}:${sourceId}`;
}
