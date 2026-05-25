'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { hasDb } from '@/lib/db';
import { assertStorefrontOwner, insertProduct, type ProductStatus } from '@/lib/products';
import { recordPulseActivity } from '@/lib/pulseActivity';

/**
 * CSV bulk-import. Accepts a single CSV blob and inserts every parseable
 * row as a product against the given storefront slug. Tolerant on header
 * casing and column order; missing columns become null. Headers we
 * understand (case-insensitive):
 *
 *   - title           required, ≤180 chars
 *   - price | price_qar
 *   - description
 *   - image | image_url
 *   - category
 *   - sku             stored as a tag prefix; not its own column today
 *   - in_stock        'true'/'1'/'yes' → status=active, otherwise sold_out
 *   - tags            comma- or pipe-separated, joined into description tail
 *
 * Hard-capped at 200 rows per call so a runaway CSV can't fan out into
 * thousands of insert statements.
 */

const Schema = z.object({
  slug: z.string().trim().min(3).max(40),
  csv: z.string().min(1).max(500_000),
});

const MAX_ROWS = 200;

export type ImportState =
  | { status: 'idle' }
  | { status: 'success'; inserted: number; skipped: number }
  | { status: 'error'; message: string };

export async function importProductsFromCsv(input: z.input<typeof Schema>): Promise<ImportState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug, csv } = parsed.data;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateLimit(`csv:${ip}`, 6, 60_000).ok) {
    return { status: 'error', message: 'Too many imports — try again in a moment.' };
  }

  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };

  const { userId } = await auth();
  const sf = await assertStorefrontOwner(slug, userId);
  if (!sf) return { status: 'error', message: 'Forbidden' };

  let rows: Array<Record<string, string>>;
  try {
    rows = parseCsv(csv).slice(0, MAX_ROWS);
  } catch (err) {
    console.error('[importProductsFromCsv] parse failed', err);
    return { status: 'error', message: 'Could not parse CSV — check headers and quoting.' };
  }
  if (rows.length === 0) return { status: 'error', message: 'No rows found in CSV.' };

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const title = pick(row, ['title', 'name', 'product', 'item'])?.trim();
    if (!title) {
      skipped += 1;
      continue;
    }
    const description = pick(row, ['description', 'desc', 'body'])?.trim() || null;
    const priceText = pick(row, ['price_qar', 'price', 'amount', 'cost']);
    const price = priceText ? parsePrice(priceText) : null;
    const imageUrl = pick(row, ['image_url', 'image', 'photo', 'picture'])?.trim() || null;
    const category = pick(row, ['category', 'type', 'collection'])?.trim() || null;
    const sku = pick(row, ['sku', 'code'])?.trim() || null;
    const inStockRaw = pick(row, ['in_stock', 'stock', 'available'])?.trim().toLowerCase();
    const tagsRaw = pick(row, ['tags', 'tag'])?.trim();

    const status: ProductStatus =
      inStockRaw === undefined || inStockRaw === ''
        ? 'active'
        : ['true', '1', 'yes', 'y', 'available'].includes(inStockRaw)
          ? 'active'
          : 'sold_out';

    // Fold SKU + tags into the description tail so the import is lossless
    // without us having to add new columns to the products table.
    const extras: string[] = [];
    if (sku) extras.push(`SKU: ${sku}`);
    if (tagsRaw) {
      const tags = tagsRaw
        .split(/[,|]/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) extras.push(`Tags: ${tags.join(', ')}`);
    }
    const finalDescription = [description, extras.join(' · ')].filter(Boolean).join('\n\n') || null;

    try {
      const product = await insertProduct(slug, {
        title: title.slice(0, 180),
        description: finalDescription,
        priceQar: price,
        imageUrl,
        category,
        eventAt: null,
        status,
      });
      await recordPulseActivity({
        source: 'products',
        kind: 'product.created',
        actorClerkUserId: sf.clerkUserId,
        ownerClerkUserId: sf.clerkUserId,
        storefrontSlug: slug,
        resourceType: 'product',
        resourceId: product.id,
        title: product.title,
        summary: `Imported product ${product.title}`,
        metadata: {
          imported: true,
          priceQar: product.priceQar,
          status: product.status,
          category: product.category,
          imageUrl: product.imageUrl,
          position: product.position,
        },
      });
      inserted += 1;
    } catch (err) {
      console.error('[importProductsFromCsv] insert failed', err);
      skipped += 1;
    }
  }

  revalidatePath('/account');
  revalidatePath(`/account/${slug}/preview`);

  return { status: 'success', inserted, skipped };
}

/**
 * Tiny RFC-4180-ish parser. Handles quoted fields with embedded commas,
 * doubled-quote escapes, and CRLF line endings. Lower-cases header keys
 * so the column-name lookup is case-insensitive.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      cur.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      cur.push(field);
      records.push(cur);
      cur = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    records.push(cur);
  }

  const filtered = records.filter((r) => r.some((c) => c.trim().length > 0));
  if (filtered.length < 2) return [];
  const header = filtered[0]!.map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < filtered.length; i++) {
    const r = filtered[i]!;
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      if (!key) continue;
      obj[key] = (r[j] ?? '').trim();
    }
    rows.push(obj);
  }
  return rows;
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return undefined;
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
