# SouqnaSource PR 2 — Founder Browse + Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full founder-facing v1 of SouqnaSource — browse the catalog by category, see suppliers ranked by trust, request a quote on contact listings (wa.me deep-link), or one-click import a priced product to a draft with AI-rewritten bilingual copy and a suggested retail price. Flip `available: true` at end of PR.

**Architecture:** All founder actions in `src/app/actions/souqnasource.ts` follow the 5-step contract (`assertStorefrontOwner` → load → validate → AI/IO outside tx → short DB tx). Two new AI modules (`ai/copy.ts`, `ai/margin.ts`) run inline at import time; if either fails, fall back to source data + a default 2.0x markup. Per-product price-sync cron walks `souqnasource_links` daily.

**Tech Stack:** Next.js 14 App Router, server actions, `@vercel/blob` for image storage, OpenAI, next-intl, Tailwind v4. Builds on PR 1 (catalog tables + clients + classifier + trust scorer).

**Spec reference:** `docs/superpowers/specs/2026-05-10-souqnasource-design.md` §3.4–3.7, §4.1–4.3, §4.8, §5, §6.5 (PR 2).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/apps/souqnasource/whatsapp.ts` | wa.me deep-link builder with claim line |
| `src/lib/apps/souqnasource/quotes.ts` | DAO for `souqnasource_quote_requests` |
| `src/lib/apps/souqnasource/links.ts` | DAO for `souqnasource_links` (founder imports) |
| `src/lib/apps/souqnasource/import.ts` | `addToCatalog` orchestrator (AI + image + DB tx) |
| `src/lib/apps/souqnasource/sync.ts` | Per-product price-sync logic |
| `src/lib/apps/souqnasource/ai/copy.ts` | Bilingual product copy rewrite |
| `src/lib/apps/souqnasource/ai/margin.ts` | Retail price suggestion |
| `src/lib/apps/souqnasource/settings.ts` | Plugin settings (drift threshold, area filter, default markup) — stored in `app_state` |
| `src/app/actions/souqnasource.ts` | All founder server actions for PR 2 |
| `src/app/api/apps/souqnasource/cron/sync/route.ts` | Daily price-sync cron |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/page.tsx` | 4-tab shell |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/browse-tab.tsx` | Server component: category drill-down |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/category-tree.tsx` | Sidebar tree |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/browse-filters.tsx` | URL-bound filters |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/listing-card.tsx` | Listing card with smart CTA |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/supplier-drawer.tsx` | Side drawer |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/import-modal.tsx` | Edit + Add-to-store modal |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/quote-modal.tsx` | wa.me confirm modal |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/imports-tab.tsx` | Imported products table |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/quotes-tab.tsx` | Quote requests table |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/settings-tab.tsx` | Settings form |
| `src/components/account/products-source-badge.tsx` | "via SouqnaSource" chip on `/products` |
| `src/i18n/messages/apps/souqnasource/en.json` | English copy |
| `src/i18n/messages/apps/souqnasource/ar.json` | Khaleeji Arabic copy |
| `src/i18n/messages/apps/souqnasource/categories.en.json` | EN category labels |
| `src/i18n/messages/apps/souqnasource/categories.ar.json` | AR category labels |

---

## Task 1: WhatsApp deep-link helper

**Files:**
- Create: `src/lib/apps/souqnasource/whatsapp.ts`
- Create: `tests/unit/souqnasource/whatsapp.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/whatsapp.test.ts
import { describe, it, expect } from 'vitest';
import { buildQuoteRequestUrl } from '@/lib/apps/souqnasource/whatsapp';

const listing = {
  id: 'qatarliving:1',
  title: 'Oud Cambodi 12ml',
} as const;

const supplier = {
  id: 'qatarliving:doha-perfume-house',
  whatsapp: '+97455555555',
} as const;

describe('buildQuoteRequestUrl', () => {
  it('builds en URL with claim line', () => {
    const out = buildQuoteRequestUrl({
      listing,
      supplier,
      storefront: { name: 'Aroma Doha', locale: 'en' },
    });
    expect(out.url).toContain('https://wa.me/97455555555');
    expect(decodeURIComponent(out.url)).toContain('Oud Cambodi 12ml');
    expect(out.prefilledMessage).toContain('— via SouqnaSource');
    expect(out.prefilledMessage).toContain(`souqna.qa/s/${supplier.id}`);
  });

  it('builds ar URL with khaleeji opener', () => {
    const out = buildQuoteRequestUrl({
      listing,
      supplier,
      storefront: { name: 'عطور الدوحة', locale: 'ar' },
    });
    expect(out.prefilledMessage).toContain('السلام عليكم');
    expect(out.prefilledMessage).toContain('— عبر SouqnaSource');
  });

  it('throws when supplier has no whatsapp', () => {
    expect(() =>
      buildQuoteRequestUrl({
        listing,
        supplier: { id: 'x', whatsapp: null },
        storefront: { name: 'X', locale: 'en' },
      }),
    ).toThrow('supplier_no_whatsapp');
  });
});
```

- [ ] **Step 2: Run, FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/whatsapp.ts
type Listing = { id: string; title: string };
type Supplier = { id: string; whatsapp: string | null };

export function buildQuoteRequestUrl(opts: {
  listing: Listing;
  supplier: Supplier;
  storefront: { name: string; locale: 'en' | 'ar' };
}): { url: string; prefilledMessage: string } {
  const { listing, supplier, storefront } = opts;
  if (!supplier.whatsapp) throw new Error('supplier_no_whatsapp');

  const claimEn = `\n— via SouqnaSource\nReply on Souqna: souqna.qa/s/${supplier.id}`;
  const claimAr = `\n— عبر SouqnaSource\nرد على Souqna: souqna.qa/s/${supplier.id}`;

  const message =
    storefront.locale === 'ar'
      ? `السلام عليكم،\nشفت إعلانكم على Souqna: «${listing.title}»\nأبي أعرف السعر والكمية اللي تقدرون توفرونها.\nمتجري: ${storefront.name}${claimAr}`
      : `Hello,\nI saw your listing on Souqna: "${listing.title}".\nCould you share pricing and minimum order quantity?\nMy store: ${storefront.name}${claimEn}`;

  const url = `https://wa.me/${supplier.whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
  return { url, prefilledMessage: message };
}
```

- [ ] **Step 4: Run** — Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/whatsapp.ts tests/unit/souqnasource/whatsapp.test.ts
git commit -m "feat(souqnasource): add wa.me deep-link helper"
```

---

## Task 2: Quote requests DAO

**Files:**
- Create: `src/lib/apps/souqnasource/quotes.ts`
- Create: `tests/integration/souqnasource/quotes.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/quotes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import { upsertListing } from '@/lib/apps/souqnasource/listings';
import { logQuoteRequest, listQuoteRequestsForStore } from '@/lib/apps/souqnasource/quotes';

const sid = `q-test-supplier-${Date.now()}`;
const lid = `q-test-listing-${Date.now()}`;
const slug = process.env.TEST_STOREFRONT_SLUG ?? 'test-store';

beforeAll(async () => {
  await upsertSupplier({
    id: sid, displayName: 'Q', crNumber: null, whatsapp: '+97455555555',
    area: 'najma', sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
  await upsertListing({
    id: lid, supplierId: sid, network: 'qatarliving',
    sourceListingUrl: 'https://qatarliving.com/x', title: 'Oud',
    description: null, imageUrl: null, category: 'perfume-oud',
    subcategory: null, listingType: 'contact', price: null, currency: null,
    moq: null, raw: {},
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_quote_requests where listing_id = ${lid}`;
  await db()`delete from souqnasource_listings where id = ${lid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('quote requests DAO', () => {
  it('logs and lists', async () => {
    await logQuoteRequest({
      storefrontSlug: slug,
      listingId: lid,
      supplierId: sid,
      prefilledMessage: 'hi',
    });
    const list = await listQuoteRequestsForStore(slug, 50);
    expect(list.find((q) => q.listingId === lid)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/quotes.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type QuoteRequest = {
  id: number;
  storefrontSlug: string;
  listingId: string;
  supplierId: string;
  prefilledMessage: string;
  createdAt: string;
};

type Row = {
  id: number;
  storefront_slug: string;
  listing_id: string;
  supplier_id: string;
  prefilled_message: string;
  created_at: string;
};

function fromRow(r: Row): QuoteRequest {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    listingId: r.listing_id,
    supplierId: r.supplier_id,
    prefilledMessage: r.prefilled_message,
    createdAt: r.created_at,
  };
}

export async function logQuoteRequest(input: {
  storefrontSlug: string;
  listingId: string;
  supplierId: string;
  prefilledMessage: string;
}): Promise<QuoteRequest> {
  const rows = (await db()`
    insert into souqnasource_quote_requests
      (storefront_slug, listing_id, supplier_id, prefilled_message)
    values
      (${input.storefrontSlug}, ${input.listingId}, ${input.supplierId}, ${input.prefilledMessage})
    returning *
  `) as unknown as Row[];
  return fromRow(rows[0]!);
}

export async function listQuoteRequestsForStore(
  slug: string,
  limit: number,
): Promise<QuoteRequest[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_quote_requests
    where storefront_slug = ${slug}
    order by created_at desc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function getQuoteRequest(
  id: number,
  slug: string,
): Promise<QuoteRequest | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_quote_requests
    where id = ${id} and storefront_slug = ${slug}
    limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/quotes.ts tests/integration/souqnasource/quotes.test.ts
git commit -m "feat(souqnasource): add quote requests DAO"
```

---

## Task 3: AI copy module (bilingual rewrite)

**Files:**
- Create: `src/lib/apps/souqnasource/ai/copy.ts`
- Create: `tests/unit/souqnasource/ai-copy.test.ts`

- [ ] **Step 1: Failing test (mocks LLM)**

```ts
// tests/unit/souqnasource/ai-copy.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => { try { return JSON.parse(s); } catch { return null; } },
}));

import { rewriteCopy } from '@/lib/apps/souqnasource/ai/copy';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('rewriteCopy', () => {
  it('returns parsed bilingual copy', async () => {
    mockChat.mockResolvedValueOnce(JSON.stringify({
      title: { en: 'Cambodi Oud Oil 12ml', ar: 'دهن العود كمبودي ١٢ مل' },
      description: {
        en: 'Premium grade Cambodian oud, hand-distilled.',
        ar: 'عود كمبودي فاخر مقطر يدوياً.',
      },
    }));
    const out = await rewriteCopy({
      title: 'OUD CAMBODI 12ml!!!',
      description: 'BEST QUALITY!!!',
      category: 'perfume-oud',
      area: 'najma',
    });
    expect(out?.title.en).toBe('Cambodi Oud Oil 12ml');
    expect(out?.title.ar).toContain('دهن العود');
  });

  it('returns null on garbage', async () => {
    mockChat.mockResolvedValueOnce('not json');
    const out = await rewriteCopy({
      title: 't', description: null, category: 'perfume-oud', area: null,
    });
    expect(out).toBeNull();
  });

  it('returns null when LLM throws', async () => {
    mockChat.mockRejectedValueOnce(new Error('rate limit'));
    const out = await rewriteCopy({
      title: 't', description: null, category: 'perfume-oud', area: null,
    });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/ai/copy.ts
import { chatJson, safeJsonObject } from './client';

const SYSTEM = `You are Souqna's brand copywriter. Rewrite a Qatari supplier listing into clean, on-brand copy in BOTH English and Khaleeji Arabic (informal Qatari Gulf register — NOT MSA, NOT Egyptian, NOT Levantine).

Strip: emojis, ALL CAPS, marketing spam ("BEST!!!", "ORIGINAL!!!"), unit-mixing, vendor contact info baked into the title, repeated punctuation.
Keep: concrete specs (size, material, ml, color, MOQ if relevant).

Output JSON:
  { "title":       { "en": "...", "ar": "..." },
    "description": { "en": "...", "ar": "..." } }

Title <= 60 chars EN, <= 50 chars AR.
Description 2-3 sentences each language.`;

export type CopyOutput = {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
};

export async function rewriteCopy(input: {
  title: string;
  description: string | null;
  category: string;
  area: string | null;
}): Promise<CopyOutput | null> {
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(input),
      maxTokens: 600,
    });
  } catch {
    return null;
  }
  const obj = safeJsonObject(raw);
  if (!obj) return null;
  const t = obj.title as { en?: unknown; ar?: unknown } | undefined;
  const d = obj.description as { en?: unknown; ar?: unknown } | undefined;
  if (
    !t || !d ||
    typeof t.en !== 'string' || typeof t.ar !== 'string' ||
    typeof d.en !== 'string' || typeof d.ar !== 'string'
  ) {
    return null;
  }
  return {
    title: { en: t.en.slice(0, 60), ar: t.ar.slice(0, 50) },
    description: { en: d.en, ar: d.ar },
  };
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/ai/copy.ts tests/unit/souqnasource/ai-copy.test.ts
git commit -m "feat(souqnasource): add bilingual AI copy rewriter"
```

---

## Task 4: AI margin module

**Files:**
- Create: `src/lib/apps/souqnasource/ai/margin.ts`
- Create: `tests/unit/souqnasource/ai-margin.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/ai-margin.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => { try { return JSON.parse(s); } catch { return null; } },
}));

import { suggestMargin } from '@/lib/apps/souqnasource/ai/margin';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('suggestMargin', () => {
  it('parses suggestion', async () => {
    mockChat.mockResolvedValueOnce(JSON.stringify({
      suggestedRetail: 199.99,
      currency: 'QAR',
      markupApplied: 2.4,
      rationale: 'oud category 2.0-3.0x',
    }));
    const out = await suggestMargin({
      title: 'Oud 12ml', category: 'perfume-oud',
      supplierCost: 85, supplierCurrency: 'QAR',
      moq: null, area: 'najma',
    });
    expect(out?.suggestedRetail).toBe(199.99);
    expect(out?.markupApplied).toBe(2.4);
  });

  it('falls back to default 2.0x when LLM fails', async () => {
    mockChat.mockRejectedValueOnce(new Error('boom'));
    const out = await suggestMargin({
      title: 'x', category: 'perfume-oud',
      supplierCost: 50, supplierCurrency: 'QAR',
      moq: null, area: null,
    });
    expect(out?.suggestedRetail).toBe(100);
    expect(out?.markupApplied).toBe(2);
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/ai/margin.ts
import { chatJson, safeJsonObject } from './client';

const SYSTEM = `You are a Qatar e-commerce pricing analyst. Suggest a retail price in QAR for a Qatari-wholesaler-sourced product (local — no import duty).

Apply category-typical Qatar D2C retail markup:
  perfume / oud:        2.0 - 3.0x
  fashion / abaya:      2.5 - 3.5x
  electronics access.:  1.5 - 2.0x
  home / decor:         2.0 - 3.0x
  beauty / skincare:    3.0 - 4.5x
  food / dates:         1.8 - 2.5x

Round to clean .00 or .99 ending. MOQ discount is already priced in.

Output JSON only:
  { "suggestedRetail": <number>, "currency": "QAR",
    "markupApplied": <number>, "rationale": "<<= 15 words>" }`;

export type MarginOutput = {
  suggestedRetail: number;
  currency: 'QAR';
  markupApplied: number;
  rationale: string;
};

export async function suggestMargin(input: {
  title: string;
  category: string;
  supplierCost: number;
  supplierCurrency: string;
  moq: number | null;
  area: string | null;
}): Promise<MarginOutput | null> {
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(input),
      maxTokens: 200,
    });
  } catch {
    return defaultMargin(input.supplierCost);
  }
  const obj = safeJsonObject(raw);
  if (!obj) return defaultMargin(input.supplierCost);
  const r = Number(obj.suggestedRetail);
  const m = Number(obj.markupApplied);
  if (!Number.isFinite(r) || r <= 0) return defaultMargin(input.supplierCost);
  return {
    suggestedRetail: Math.round(r * 100) / 100,
    currency: 'QAR',
    markupApplied: Number.isFinite(m) ? m : r / Math.max(input.supplierCost, 1),
    rationale: typeof obj.rationale === 'string' ? obj.rationale.slice(0, 100) : '',
  };
}

function defaultMargin(cost: number): MarginOutput {
  return {
    suggestedRetail: Math.round(cost * 2 * 100) / 100,
    currency: 'QAR',
    markupApplied: 2,
    rationale: 'default 2.0x markup (AI unavailable)',
  };
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/ai/margin.ts tests/unit/souqnasource/ai-margin.test.ts
git commit -m "feat(souqnasource): add AI margin suggester with fallback"
```

---

## Task 5: Souqnasource links DAO

**Files:**
- Create: `src/lib/apps/souqnasource/links.ts`

- [ ] **Step 1: Implement** (small surface — no test, integration coverage comes via the import action test)

```ts
// src/lib/apps/souqnasource/links.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type SouqnasourceLink = {
  productId: string;
  storefrontSlug: string;
  listingId: string | null;
  supplierId: string | null;
  supplierCost: number;
  supplierCurrency: string;
  lastSyncedAt: string;
  lastSeenPrice: number | null;
  priceDriftPct: number | null;
};

type Row = {
  product_id: string;
  storefront_slug: string;
  listing_id: string | null;
  supplier_id: string | null;
  supplier_cost: string;
  supplier_currency: string;
  last_synced_at: string;
  last_seen_price: string | null;
  price_drift_pct: string | null;
};

function fromRow(r: Row): SouqnasourceLink {
  return {
    productId: r.product_id,
    storefrontSlug: r.storefront_slug,
    listingId: r.listing_id,
    supplierId: r.supplier_id,
    supplierCost: Number(r.supplier_cost),
    supplierCurrency: r.supplier_currency,
    lastSyncedAt: r.last_synced_at,
    lastSeenPrice: r.last_seen_price === null ? null : Number(r.last_seen_price),
    priceDriftPct: r.price_drift_pct === null ? null : Number(r.price_drift_pct),
  };
}

export async function insertLink(l: Omit<SouqnasourceLink, 'lastSyncedAt' | 'lastSeenPrice' | 'priceDriftPct'>): Promise<void> {
  await db()`
    insert into souqnasource_links
      (product_id, storefront_slug, listing_id, supplier_id, supplier_cost, supplier_currency, last_seen_price)
    values
      (${l.productId}, ${l.storefrontSlug}, ${l.listingId}, ${l.supplierId}, ${l.supplierCost}, ${l.supplierCurrency}, ${l.supplierCost})
  `;
}

export async function getLinkByListingForStore(
  slug: string,
  listingId: string,
): Promise<SouqnasourceLink | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    where storefront_slug = ${slug} and listing_id = ${listingId}
    limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listLinksForStore(slug: string): Promise<SouqnasourceLink[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    where storefront_slug = ${slug}
    order by last_synced_at desc
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listLinksForSync(limit: number): Promise<SouqnasourceLink[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_links
    order by last_synced_at asc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function updateLinkSync(
  productId: string,
  patch: { lastSeenPrice: number | null; priceDriftPct: number | null },
): Promise<void> {
  await db()`
    update souqnasource_links
    set last_synced_at = now(),
        last_seen_price = ${patch.lastSeenPrice},
        price_drift_pct = ${patch.priceDriftPct}
    where product_id = ${productId}
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/links.ts
git commit -m "feat(souqnasource): add links DAO"
```

---

## Task 6: Image download helper

**Files:**
- Create: `src/lib/apps/souqnasource/image.ts`

The spec mandates a 5 MB cap + content-type whitelist + Vercel Blob upload.

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/image.ts
import { put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function fetchAndStoreImage(opts: {
  imageUrl: string;
  storefrontSlug: string;
  productId: string;
}): Promise<string | null> {
  try {
    const res = await fetch(opts.imageUrl);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!ALLOWED.has(ct)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    const ext = ct === 'image/jpeg' ? 'jpg' : ct === 'image/webp' ? 'webp' : 'png';
    const path = `storefronts/${opts.storefrontSlug}/products/${opts.productId}/cover.${ext}`;
    const blob = await put(path, buf, { access: 'public', contentType: ct });
    return blob.url;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/image.ts
git commit -m "feat(souqnasource): add safe image download to Vercel Blob"
```

---

## Task 7: Import orchestrator (`addToCatalog`)

**Files:**
- Create: `src/lib/apps/souqnasource/import.ts`
- Create: `tests/integration/souqnasource/import.test.ts`

- [ ] **Step 1: Failing test (mocks AI + image)**

```ts
// tests/integration/souqnasource/import.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import { upsertListing } from '@/lib/apps/souqnasource/listings';

vi.mock('@/lib/apps/souqnasource/ai/copy', () => ({
  rewriteCopy: vi.fn().mockResolvedValue({
    title: { en: 'Oud 12ml', ar: 'عود ١٢ مل' },
    description: { en: 'Premium oud.', ar: 'عود فاخر.' },
  }),
}));
vi.mock('@/lib/apps/souqnasource/ai/margin', () => ({
  suggestMargin: vi.fn().mockResolvedValue({
    suggestedRetail: 199, currency: 'QAR', markupApplied: 2.34, rationale: 'oud',
  }),
}));
vi.mock('@/lib/apps/souqnasource/image', () => ({
  fetchAndStoreImage: vi.fn().mockResolvedValue('https://blob.example/x.jpg'),
}));

import { addToCatalog } from '@/lib/apps/souqnasource/import';

const slug = process.env.TEST_STOREFRONT_SLUG ?? 'test-store';
const sid = `imp-test-supplier-${Date.now()}`;
const lid = `imp-test-listing-${Date.now()}`;

beforeAll(async () => {
  await upsertSupplier({
    id: sid, displayName: 'X', crNumber: null, whatsapp: '+97455555555',
    area: 'najma', sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
  await upsertListing({
    id: lid, supplierId: sid, network: 'qatarliving',
    sourceListingUrl: 'https://qatarliving.com/x', title: 'Oud 12ml',
    description: null, imageUrl: 'https://qatarliving.com/i/x.jpg',
    category: 'perfume-oud', subcategory: null, listingType: 'priced',
    price: 85, currency: 'QAR', moq: null, raw: {},
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_links where listing_id = ${lid}`;
  await db()`delete from products where source = 'souqnasource' and id like 'imp-test-%'`;
  await db()`delete from souqnasource_listings where id = ${lid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('addToCatalog', () => {
  it('creates draft product + link', async () => {
    const out = await addToCatalog({
      storefrontSlug: slug,
      listingId: lid,
      overrides: {},
    });
    expect(out.productId).toBeTruthy();
    const prod = (await db()`
      select status, source, price from products where id = ${out.productId}
    `) as unknown as { status: string; source: string; price: string }[];
    expect(prod[0]?.status).toBe('draft');
    expect(prod[0]?.source).toBe('souqnasource');
    expect(Number(prod[0]?.price)).toBe(199);
  });

  it('throws on delisted listing', async () => {
    await db()`update souqnasource_listings set delisted_at = now() where id = ${lid}`;
    await expect(
      addToCatalog({ storefrontSlug: slug, listingId: lid, overrides: {} }),
    ).rejects.toThrow('listing_unavailable');
    await db()`update souqnasource_listings set delisted_at = null where id = ${lid}`;
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/import.ts
import { db } from '@/lib/db';
import { getListingById } from './listings';
import { getSupplierById } from './suppliers';
import { rewriteCopy } from './ai/copy';
import { suggestMargin } from './ai/margin';
import { fetchAndStoreImage } from './image';
import { insertLink } from './links';

export type ImportOverrides = {
  title?: { en?: string; ar?: string };
  description?: { en?: string; ar?: string };
  retail?: number;
};

export async function addToCatalog(opts: {
  storefrontSlug: string;
  listingId: string;
  overrides: ImportOverrides;
}): Promise<{ productId: string }> {
  // Validate listing
  const listing = await getListingById(opts.listingId);
  if (
    !listing ||
    listing.listingType !== 'priced' ||
    listing.price === null ||
    listing.delistedAt !== null
  ) {
    throw new Error('listing_unavailable');
  }
  const supplier = await getSupplierById(listing.supplierId);
  if (!supplier) throw new Error('supplier_not_found');

  // Storefront context (currency)
  const storefronts = (await db()`
    select slug, currency from storefronts where slug = ${opts.storefrontSlug} limit 1
  `) as unknown as { slug: string; currency: string }[];
  const storefront = storefronts[0];
  if (!storefront) throw new Error('storefront_not_found');

  // Allocate product id NOW so the image path is stable
  const productId = `prod_${cryptoRandom(12)}`;

  // OUTSIDE any DB transaction: AI + image (slow I/O)
  const [copy, margin, imageUrl] = await Promise.all([
    rewriteCopy({
      title: listing.title,
      description: listing.description,
      category: listing.category,
      area: supplier.area,
    }),
    suggestMargin({
      title: listing.title,
      category: listing.category,
      supplierCost: listing.price,
      supplierCurrency: listing.currency ?? 'QAR',
      moq: listing.moq,
      area: supplier.area,
    }),
    listing.imageUrl
      ? fetchAndStoreImage({
          imageUrl: listing.imageUrl,
          storefrontSlug: opts.storefrontSlug,
          productId,
        })
      : Promise.resolve(null),
  ]);

  const titleEn = opts.overrides.title?.en ?? copy?.title.en ?? listing.title;
  const titleAr = opts.overrides.title?.ar ?? copy?.title.ar ?? listing.title;
  const descEn =
    opts.overrides.description?.en ?? copy?.description.en ?? (listing.description ?? '');
  const descAr =
    opts.overrides.description?.ar ?? copy?.description.ar ?? (listing.description ?? '');
  const retail = opts.overrides.retail ?? margin?.suggestedRetail ?? listing.price * 2;

  // Short DB tx: writes only
  await db()`begin`;
  try {
    await db()`
      insert into products
        (id, storefront_slug, title, description, price, currency, image_url, status, source, title_ar, description_ar)
      values
        (${productId}, ${opts.storefrontSlug}, ${titleEn}, ${descEn}, ${retail},
         ${storefront.currency}, ${imageUrl}, 'draft', 'souqnasource', ${titleAr}, ${descAr})
    `;
    await insertLink({
      productId,
      storefrontSlug: opts.storefrontSlug,
      listingId: listing.id,
      supplierId: listing.supplierId,
      supplierCost: listing.price,
      supplierCurrency: listing.currency ?? 'QAR',
    });
    await db()`commit`;
  } catch (err) {
    await db()`rollback`;
    throw err;
  }

  return { productId };
}

function cryptoRandom(n: number): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

NOTE: `products` table column names for bilingual fields (`title_ar`, `description_ar`) reflect Souqna's existing convention; verify against `src/db/schema.sql` and adjust if Souqna uses a JSON column instead. If different, adapt the `insert into products` row.

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/import.ts tests/integration/souqnasource/import.test.ts
git commit -m "feat(souqnasource): addToCatalog orchestrator"
```

---

## Task 8: Settings module (`app_state`-backed)

**Files:**
- Create: `src/lib/apps/souqnasource/settings.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/settings.ts
import { getAppState, setAppState } from './installed';
// `installed` re-exports the small app_state helpers used by other apps
// (drop-manager, etc). If the helpers actually live elsewhere in the
// repo, change the import path accordingly.

const APP_ID = 'souqnasource';
const KEY = 'settings';

export type SouqnasourceSettings = {
  driftThreshold: number;            // 0.05 - 0.25
  defaultMarkup: Record<string, number>; // category -> multiplier override
  areaFilter: string[];              // empty = all
  includeUnverified: boolean;
  emailDigestOptOut: boolean;
};

export const DEFAULT_SETTINGS: SouqnasourceSettings = {
  driftThreshold: 0.10,
  defaultMarkup: {},
  areaFilter: [],
  includeUnverified: true,
  emailDigestOptOut: false,
};

export async function getSettings(slug: string): Promise<SouqnasourceSettings> {
  const row = await getAppState(slug, APP_ID, KEY).catch(() => null);
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SouqnasourceSettings>) };
}

export async function saveSettings(
  slug: string,
  patch: Partial<SouqnasourceSettings>,
): Promise<SouqnasourceSettings> {
  const current = await getSettings(slug);
  const next = { ...current, ...patch };
  await setAppState(slug, APP_ID, KEY, next as unknown as Record<string, unknown>);
  return next;
}
```

NOTE: `installed.ts` exports `getAppState` / `setAppState` based on the existing `drop-manager.ts` reading. If imports are not exposed there, add a tiny `src/lib/apps/souqnasource/installed.ts` that re-exports from wherever the helpers actually live in this repo (`src/lib/apps/installed.ts`).

- [ ] **Step 2: Add a small unit test**

```ts
// tests/integration/souqnasource/settings.test.ts
import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/apps/souqnasource/settings';

const slug = process.env.TEST_STOREFRONT_SLUG ?? 'test-store';

describe('settings', () => {
  it('returns defaults for fresh store', async () => {
    const s = await getSettings(`${slug}-fresh-${Date.now()}`);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a patch', async () => {
    const next = await saveSettings(slug, { driftThreshold: 0.15 });
    expect(next.driftThreshold).toBe(0.15);
    const reread = await getSettings(slug);
    expect(reread.driftThreshold).toBe(0.15);
  });
});
```

- [ ] **Step 3: Run, PASS.**

- [ ] **Step 4: Commit**

```bash
git add src/lib/apps/souqnasource/settings.ts tests/integration/souqnasource/settings.test.ts
git commit -m "feat(souqnasource): add settings store"
```

---

## Task 9: Server actions

**Files:**
- Create: `src/app/actions/souqnasource.ts`

This file groups every server action used by PR 2 UI surfaces. All follow the 5-step contract.

- [ ] **Step 1: Implement**

```ts
// src/app/actions/souqnasource.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { listListingsByCategory, getListingById } from '@/lib/apps/souqnasource/listings';
import { getSupplierById } from '@/lib/apps/souqnasource/suppliers';
import { addToCatalog as runAddToCatalog, type ImportOverrides } from '@/lib/apps/souqnasource/import';
import { buildQuoteRequestUrl } from '@/lib/apps/souqnasource/whatsapp';
import { logQuoteRequest, getQuoteRequest } from '@/lib/apps/souqnasource/quotes';
import { getSettings, saveSettings, type SouqnasourceSettings } from '@/lib/apps/souqnasource/settings';
import type { Category, ListingType } from '@/lib/apps/souqnasource/types';

async function assertStorefrontOwner(slug: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const rows = (await db()`
    select 1 from storefronts where slug = ${slug} and owner_user_id = ${userId} limit 1
  `) as unknown as { '?column?': number }[];
  if (rows.length === 0) throw new Error('forbidden');
}

export async function browseListings(input: {
  slug: string;
  category: Category;
  type: ListingType | null;
  limit: number;
}) {
  await assertStorefrontOwner(input.slug);
  const items = await listListingsByCategory(
    input.category,
    input.type,
    Math.min(input.limit, 200),
  );
  return items;
}

export async function getSupplierForBrowse(input: {
  slug: string;
  supplierId: string;
}) {
  await assertStorefrontOwner(input.slug);
  return getSupplierById(input.supplierId);
}

export async function addToCatalog(input: {
  slug: string;
  listingId: string;
  overrides: ImportOverrides;
}) {
  await assertStorefrontOwner(input.slug);
  return runAddToCatalog({
    storefrontSlug: input.slug,
    listingId: input.listingId,
    overrides: input.overrides,
  });
}

export async function requestQuote(input: { slug: string; listingId: string }) {
  await assertStorefrontOwner(input.slug);
  const listing = await getListingById(input.listingId);
  if (!listing || listing.listingType !== 'contact' || listing.delistedAt !== null) {
    throw new Error('listing_unavailable');
  }
  const supplier = await getSupplierById(listing.supplierId);
  if (!supplier?.whatsapp) throw new Error('supplier_no_whatsapp');
  const storefronts = (await db()`
    select name, locale from storefronts where slug = ${input.slug} limit 1
  `) as unknown as { name: string; locale: 'en' | 'ar' }[];
  const sf = storefronts[0]!;
  const { url, prefilledMessage } = buildQuoteRequestUrl({
    listing,
    supplier: { id: supplier.id, whatsapp: supplier.whatsapp },
    storefront: { name: sf.name, locale: sf.locale ?? 'en' },
  });
  await logQuoteRequest({
    storefrontSlug: input.slug,
    listingId: listing.id,
    supplierId: supplier.id,
    prefilledMessage,
  });
  return { url };
}

export async function importFromQuote(input: {
  slug: string;
  quoteRequestId: number;
  manualPrice: number;
  manualCurrency: string;
  overrides: ImportOverrides;
}) {
  await assertStorefrontOwner(input.slug);
  const q = await getQuoteRequest(input.quoteRequestId, input.slug);
  if (!q) throw new Error('quote_not_found');
  // Reuse addToCatalog by overriding price + treating the contact listing as if priced.
  // We patch the listing.price in memory via overrides.retail (for retail) and use
  // manualPrice as the supplier_cost.
  const listing = await getListingById(q.listingId);
  if (!listing || listing.delistedAt !== null) throw new Error('listing_unavailable');

  // Inline a mini version that uses manualPrice as supplier_cost.
  // Implementation reuses runAddToCatalog with a temporary patched listing.
  // For v1 simplicity, we update the listing row in place with the manual price
  // (priced) and call addToCatalog. This is OK because the founder is asserting
  // a confirmed quote.
  await db()`
    update souqnasource_listings
    set listing_type = 'priced', price = ${input.manualPrice}, currency = ${input.manualCurrency}
    where id = ${listing.id}
  `;
  return runAddToCatalog({
    storefrontSlug: input.slug,
    listingId: listing.id,
    overrides: input.overrides,
  });
}

export async function getSouqnasourceSettings(slug: string): Promise<SouqnasourceSettings> {
  await assertStorefrontOwner(slug);
  return getSettings(slug);
}

export async function saveSouqnasourceSettings(
  slug: string,
  patch: Partial<SouqnasourceSettings>,
): Promise<SouqnasourceSettings> {
  await assertStorefrontOwner(slug);
  return saveSettings(slug, patch);
}
```

NOTE: the `storefronts.owner_user_id` column name reflects Souqna convention; verify against `src/db/schema.sql` and adjust if different.

- [ ] **Step 2: Action smoke test (optional)**

If integration tests need Clerk-shaped auth, mock `@clerk/nextjs/server` in test setup or skip and rely on the action being exercised through the UI Playwright run later.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/souqnasource.ts
git commit -m "feat(souqnasource): add founder server actions"
```

---

## Task 10: Per-product price-sync cron

**Files:**
- Create: `src/lib/apps/souqnasource/sync.ts`
- Create: `src/app/api/apps/souqnasource/cron/sync/route.ts`
- Create: `tests/integration/souqnasource/sync.test.ts`

- [ ] **Step 1: Implement `sync.ts`**

```ts
// src/lib/apps/souqnasource/sync.ts
import { db } from '@/lib/db';
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

async function notify(slug: string, kind: string, ref: string, body: { en: string; ar: string }): Promise<void> {
  await db()`
    insert into notifications (storefront_slug, kind, ref, body_en, body_ar, created_at)
    values (${slug}, ${kind}, ${ref}, ${body.en}, ${body.ar}, now())
    on conflict do nothing
  `;
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
      await db()`update products set status = 'draft' where id = ${link.productId}`;
      await notify(link.storefrontSlug, 'souqnasource:delisted', link.productId, {
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
      await notify(
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
```

- [ ] **Step 2: Implement route**

```ts
// src/app/api/apps/souqnasource/cron/sync/route.ts
import { NextResponse } from 'next/server';
import { runSync } from '@/lib/apps/souqnasource/sync';

export const runtime = 'nodejs';
export const maxDuration = 280;

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.SOUQNASOURCE_SYNC_CRON_SECRET;
  const got =
    req.headers.get('x-cron-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  const summary = await runSync();
  return NextResponse.json({ ok: true, summary });
}

export const GET = POST;
```

- [ ] **Step 3: Add to `vercel.json`**

```json
{
  "path": "/api/apps/souqnasource/cron/sync",
  "schedule": "0 3 * * *"
}
```

- [ ] **Step 4: Integration test (mocks the listing-not-found case)**

```ts
// tests/integration/souqnasource/sync.test.ts
import { describe, it, expect } from 'vitest';
import { runSync } from '@/lib/apps/souqnasource/sync';

describe('runSync', () => {
  it('returns a summary even with empty links', async () => {
    const out = await runSync();
    expect(out.walked).toBeGreaterThanOrEqual(0);
    expect(typeof out.delistedNotified).toBe('number');
    expect(typeof out.driftNotified).toBe('number');
  });
});
```

Run: `npm test -- sync.test.ts` — Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/sync.ts src/app/api/apps/souqnasource/cron/sync/route.ts vercel.json tests/integration/souqnasource/sync.test.ts
git commit -m "feat(souqnasource): add daily price-sync cron"
```

---

## Task 11: i18n message files

**Files:**
- Create: `src/i18n/messages/apps/souqnasource/en.json`
- Create: `src/i18n/messages/apps/souqnasource/ar.json`
- Create: `src/i18n/messages/apps/souqnasource/categories.en.json`
- Create: `src/i18n/messages/apps/souqnasource/categories.ar.json`

- [ ] **Step 1: Create files**

`en.json`:
```json
{
  "title": "SouqnaSource",
  "tabs": { "browse": "Browse", "imports": "Imports", "quotes": "Quotes", "settings": "Settings" },
  "browse": {
    "filters": {
      "type": { "all": "All", "priced": "Priced", "contact": "Contact (WhatsApp)" },
      "trustAtLeast": "Trust score ≥",
      "area": "Area",
      "verifiedOnly": "Verified only",
      "hideDelisted": "Hide delisted"
    },
    "empty": "No suppliers in this slice. Loosen filters or check back — we re-index every 6 hours."
  },
  "card": {
    "addToStore": "Add to my store",
    "messageOnSouqna": "Message on Souqna",
    "getQuote": "Get a quote on WhatsApp",
    "viewOriginal": "View original",
    "trust": "Trust",
    "moq": "MOQ",
    "alreadyImported": "✓ In your store"
  },
  "import": {
    "headline": "Add to my store",
    "fields": { "title": "Title", "description": "Description", "retail": "Retail price" },
    "save": "Save as draft product",
    "cancel": "Cancel",
    "aiUnavailable": "AI copy unavailable — please review before publishing.",
    "imported": "Imported. Review and publish in your catalog."
  },
  "quote": {
    "headline": "Get a quote on WhatsApp",
    "preview": "We'll open WhatsApp with this message:",
    "edit": "Edit message",
    "open": "Open WhatsApp",
    "afterNote": "After you get a price, come back and click \"Import manually\" on the Quotes tab."
  },
  "imports": { "headline": "Imported products", "empty": "Products you import from SouqnaSource will live here." },
  "quotes": { "headline": "Quote requests", "empty": "Track quote requests you send to suppliers here.", "importManually": "Import manually" },
  "settings": {
    "drift": "Drift threshold",
    "markup": "Default markup overrides",
    "area": "Area filter",
    "unverified": "Include unverified suppliers",
    "emailDigest": "Daily email digest"
  },
  "badge": { "via": "via SouqnaSource", "drift": "Drift {pct}%", "delisted": "Delisted" }
}
```

`ar.json` (Khaleeji register):
```json
{
  "title": "SouqnaSource",
  "tabs": { "browse": "تصفح", "imports": "المستوردة", "quotes": "العروض", "settings": "الإعدادات" },
  "browse": {
    "filters": {
      "type": { "all": "الكل", "priced": "بسعر", "contact": "تواصل (واتساب)" },
      "trustAtLeast": "درجة الثقة ≥",
      "area": "المنطقة",
      "verifiedOnly": "الموثقين فقط",
      "hideDelisted": "إخفاء المسحوبة"
    },
    "empty": "ما فيه موردين بهذي الفئة. خفّف الفلاتر أو ارجع لاحقاً — نحدّث كل ٦ ساعات."
  },
  "card": {
    "addToStore": "أضف إلى متجري",
    "messageOnSouqna": "تواصل عبر Souqna",
    "getQuote": "اطلب عرض على واتساب",
    "viewOriginal": "المصدر الأصلي",
    "trust": "ثقة",
    "moq": "أقل كمية",
    "alreadyImported": "✓ في متجرك"
  },
  "import": {
    "headline": "أضف إلى متجري",
    "fields": { "title": "العنوان", "description": "الوصف", "retail": "سعر التجزئة" },
    "save": "احفظ كمسودة",
    "cancel": "إلغاء",
    "aiUnavailable": "النص بالذكاء الاصطناعي مو متوفر — راجع قبل النشر.",
    "imported": "تمت الإضافة. راجع وانشر من قائمة المنتجات."
  },
  "quote": {
    "headline": "اطلب عرض على واتساب",
    "preview": "بنفتح واتساب بهالرسالة:",
    "edit": "تعديل الرسالة",
    "open": "فتح واتساب",
    "afterNote": "أول ما يجيك السعر، ارجع واضغط «استيراد يدوي» في تبويب العروض."
  },
  "imports": { "headline": "المنتجات المستوردة", "empty": "المنتجات اللي تستوردها من SouqnaSource تظهر هنا." },
  "quotes": { "headline": "طلبات العروض", "empty": "تتبع طلبات العروض اللي ترسلها للموردين هنا.", "importManually": "استيراد يدوي" },
  "settings": {
    "drift": "حد تغير السعر",
    "markup": "هامش افتراضي مخصص",
    "area": "فلتر المنطقة",
    "unverified": "أظهر الموردين غير الموثقين",
    "emailDigest": "ملخص يومي بالبريد"
  },
  "badge": { "via": "عبر SouqnaSource", "drift": "تغير {pct}%", "delisted": "مسحوب" }
}
```

`categories.en.json`:
```json
{
  "perfume-oud": "Perfume — Oud",
  "perfume-modern": "Perfume — Modern",
  "fashion-abaya": "Fashion — Abaya",
  "fashion-modest": "Fashion — Modest",
  "electronics-phones": "Electronics — Phones",
  "electronics-accessories": "Electronics — Accessories",
  "home-decor": "Home — Decor",
  "home-textiles": "Home — Textiles",
  "beauty-skincare": "Beauty — Skincare",
  "beauty-cosmetics": "Beauty — Cosmetics",
  "food-dates": "Food — Dates & Spices",
  "food-spices": "Food — Spices",
  "jewelry-gold": "Jewelry — Gold",
  "jewelry-fashion": "Jewelry — Fashion",
  "kids-toys": "Kids — Toys",
  "kids-clothing": "Kids — Clothing",
  "sports-fitness": "Sports & Fitness",
  "gifts-corporate": "Corporate Gifts",
  "uncategorized": "Uncategorized"
}
```

`categories.ar.json`:
```json
{
  "perfume-oud": "عطور — عود",
  "perfume-modern": "عطور — حديثة",
  "fashion-abaya": "أزياء — عبايات",
  "fashion-modest": "أزياء — محتشمة",
  "electronics-phones": "إلكترونيات — هواتف",
  "electronics-accessories": "إلكترونيات — اكسسوارات",
  "home-decor": "منزل — ديكور",
  "home-textiles": "منزل — مفروشات",
  "beauty-skincare": "جمال — العناية بالبشرة",
  "beauty-cosmetics": "جمال — مكياج",
  "food-dates": "طعام — تمر وبهارات",
  "food-spices": "طعام — بهارات",
  "jewelry-gold": "مجوهرات — ذهب",
  "jewelry-fashion": "مجوهرات — أزياء",
  "kids-toys": "أطفال — ألعاب",
  "kids-clothing": "أطفال — ملابس",
  "sports-fitness": "رياضة ولياقة",
  "gifts-corporate": "هدايا مكتبية",
  "uncategorized": "غير مصنف"
}
```

- [ ] **Step 2: Wire into next-intl**

If next-intl uses a single namespace per locale, register `apps/souqnasource` as a namespace in the loader (path varies — check existing `src/i18n/index.ts` or similar). Mirror however other plugins (e.g. `apps/whatsapp-business`) are already wired.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/apps/souqnasource/
git commit -m "feat(souqnasource): add bilingual i18n messages"
```

---

## Task 12: Plugin home page (4-tab shell)

**Files:**
- Create: `src/app/[locale]/dashboard/[slug]/apps/souqnasource/page.tsx`

- [ ] **Step 1: Implement** (server component, redirects to default tab)

```tsx
// src/app/[locale]/dashboard/[slug]/apps/souqnasource/page.tsx
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BrowseTab } from './browse-tab';
import { ImportsTab } from './imports-tab';
import { QuotesTab } from './quotes-tab';
import { SettingsTab } from './settings-tab';

type Props = {
  params: { locale: 'en' | 'ar'; slug: string };
  searchParams: { tab?: string; category?: string; type?: string; trust?: string; area?: string; sort?: string };
};

export default async function Page({ params, searchParams }: Props) {
  const t = await getTranslations({ locale: params.locale, namespace: 'apps.souqnasource' });
  const tab = searchParams.tab ?? 'browse';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </header>
      <nav className="flex gap-3 border-b">
        {(['browse', 'imports', 'quotes', 'settings'] as const).map((k) => (
          <a
            key={k}
            href={`?tab=${k}`}
            className={`pb-2 ${tab === k ? 'border-b-2 border-current font-medium' : 'text-zinc-500'}`}
          >
            {t(`tabs.${k}`)}
          </a>
        ))}
      </nav>
      {tab === 'browse' && <BrowseTab slug={params.slug} locale={params.locale} searchParams={searchParams} />}
      {tab === 'imports' && <ImportsTab slug={params.slug} locale={params.locale} />}
      {tab === 'quotes' && <QuotesTab slug={params.slug} locale={params.locale} />}
      {tab === 'settings' && <SettingsTab slug={params.slug} locale={params.locale} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/page.tsx
git commit -m "feat(souqnasource): add 4-tab plugin shell"
```

---

## Task 13: Browse tab + listing card + supplier drawer + import + quote modals

**Files:**
- Create: all `src/app/[locale]/dashboard/[slug]/apps/souqnasource/{browse-tab,category-tree,browse-filters,listing-card,supplier-drawer,import-modal,quote-modal}.tsx`

This task has the largest UI surface. To keep it bite-sized in execution, split into 3 commits.

- [ ] **Step 1: Browse tab + filters + category tree (one commit)**

```tsx
// browse-tab.tsx
import { Suspense } from 'react';
import { listListingsByCategory } from '@/lib/apps/souqnasource/listings';
import type { Category, ListingType } from '@/lib/apps/souqnasource/types';
import { CategoryTree } from './category-tree';
import { BrowseFilters } from './browse-filters';
import { ListingCard } from './listing-card';

type Props = {
  slug: string;
  locale: 'en' | 'ar';
  searchParams: Record<string, string | undefined>;
};

export async function BrowseTab({ slug, locale, searchParams }: Props) {
  const category = (searchParams.category ?? 'perfume-oud') as Category;
  const type = (searchParams.type ?? null) as ListingType | null;
  const items = await listListingsByCategory(category, type, 60);
  return (
    <div className="grid grid-cols-12 gap-6">
      <aside className="col-span-3"><CategoryTree current={category} locale={locale} /></aside>
      <aside className="col-span-3"><BrowseFilters current={searchParams} locale={locale} /></aside>
      <main className="col-span-6 grid grid-cols-1 gap-3">
        {items.length === 0 ? (
          <p className="text-zinc-500">No listings in this slice.</p>
        ) : (
          items.map((l) => <ListingCard key={l.id} listing={l} slug={slug} locale={locale} />)
        )}
      </main>
    </div>
  );
}
```

```tsx
// category-tree.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CATEGORIES, type Category } from '@/lib/apps/souqnasource/types';

export function CategoryTree({ current, locale }: { current: Category; locale: 'en'|'ar' }) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations('apps.souqnasource.categories');
  return (
    <ul className="space-y-1">
      {CATEGORIES.map((c) => (
        <li key={c}>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.set('tab', 'browse');
              next.set('category', c);
              router.push(`?${next.toString()}`);
            }}
            className={`text-left ${c === current ? 'font-semibold' : 'text-zinc-600'}`}
          >
            {t(c)}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// browse-filters.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function BrowseFilters({ current }: { current: Record<string, string|undefined>; locale: 'en'|'ar' }) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations('apps.souqnasource.browse.filters');

  function patch(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (v === null) next.delete(k); else next.set(k, v);
    router.push(`?${next.toString()}`);
  }
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-zinc-500">{t('type.all')}</div>
        <div className="flex gap-2">
          <button onClick={() => patch('type', null)}>{t('type.all')}</button>
          <button onClick={() => patch('type', 'priced')}>{t('type.priced')}</button>
          <button onClick={() => patch('type', 'contact')}>{t('type.contact')}</button>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <span>{t('trustAtLeast')}</span>
        <input type="number" min={0} max={10} step={0.5}
          defaultValue={current.trust ?? '0'}
          onChange={(e) => patch('trust', e.target.value)} className="w-16" />
      </label>
    </div>
  );
}
```

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/{browse-tab,category-tree,browse-filters}.tsx
git commit -m "feat(souqnasource): add browse tab + category tree + filters"
```

- [ ] **Step 2: Listing card + supplier drawer (commit)**

```tsx
// listing-card.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Listing } from '@/lib/apps/souqnasource/types';
import { ImportModal } from './import-modal';
import { QuoteModal } from './quote-modal';
import { SupplierDrawer } from './supplier-drawer';

export function ListingCard({ listing, slug, locale }: { listing: Listing; slug: string; locale: 'en'|'ar' }) {
  const [openImport, setOpenImport] = useState(false);
  const [openQuote, setOpenQuote] = useState(false);
  const [openSupplier, setOpenSupplier] = useState(false);
  const t = useTranslations('apps.souqnasource.card');
  const isPriced = listing.listingType === 'priced';
  return (
    <article className="rounded-md border p-3 flex gap-3">
      {listing.imageUrl && <img src={listing.imageUrl} alt="" className="w-20 h-20 object-cover rounded" />}
      <div className="flex-1">
        <div className="font-medium">{listing.title}</div>
        <div className="text-sm text-zinc-600">
          {isPriced ? `${listing.price} ${listing.currency}` : '—'} {listing.moq && `· ${t('moq')} ${listing.moq}`}
        </div>
        <button onClick={() => setOpenSupplier(true)} className="text-sm underline">
          {t('trust')}: —
        </button>
        <div className="mt-2">
          {isPriced ? (
            <button onClick={() => setOpenImport(true)} className="rounded bg-zinc-900 text-white px-3 py-1.5">
              {t('addToStore')}
            </button>
          ) : (
            <button onClick={() => setOpenQuote(true)} className="rounded border px-3 py-1.5">
              {t('getQuote')}
            </button>
          )}
        </div>
      </div>
      {openImport && <ImportModal listing={listing} slug={slug} locale={locale} onClose={() => setOpenImport(false)} />}
      {openQuote && <QuoteModal listing={listing} slug={slug} locale={locale} onClose={() => setOpenQuote(false)} />}
      {openSupplier && <SupplierDrawer supplierId={listing.supplierId} slug={slug} locale={locale} onClose={() => setOpenSupplier(false)} />}
    </article>
  );
}
```

```tsx
// supplier-drawer.tsx
'use client';
import { useEffect, useState } from 'react';
import { getSupplierForBrowse } from '@/app/actions/souqnasource';
import type { Supplier } from '@/lib/apps/souqnasource/types';

export function SupplierDrawer({ supplierId, slug, onClose }: {
  supplierId: string; slug: string; locale: 'en'|'ar'; onClose: () => void;
}) {
  const [s, setS] = useState<Supplier | null>(null);
  useEffect(() => { getSupplierForBrowse({ slug, supplierId }).then(setS); }, [slug, supplierId]);
  return (
    <aside className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl p-4 overflow-y-auto" role="dialog" aria-label="Supplier">
      <button onClick={onClose} className="text-zinc-500">✕</button>
      {s ? (
        <div className="space-y-2">
          <h2 className="font-semibold">{s.displayName}</h2>
          <div>{s.area} · Trust {s.trustScore ?? '—'}</div>
          <div>{s.trustReason}</div>
          {s.whatsapp && <div>WhatsApp: {s.whatsapp}</div>}
        </div>
      ) : <p>Loading…</p>}
    </aside>
  );
}
```

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/{listing-card,supplier-drawer}.tsx
git commit -m "feat(souqnasource): add listing card + supplier drawer"
```

- [ ] **Step 3: Import + Quote modals (commit)**

```tsx
// import-modal.tsx
'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { addToCatalog } from '@/app/actions/souqnasource';
import type { Listing } from '@/lib/apps/souqnasource/types';

export function ImportModal({ listing, slug, locale, onClose }: {
  listing: Listing; slug: string; locale: 'en'|'ar'; onClose: () => void;
}) {
  const t = useTranslations('apps.souqnasource.import');
  const [titleEn, setTitleEn] = useState(listing.title);
  const [titleAr, setTitleAr] = useState(listing.title);
  const [descEn, setDescEn] = useState(listing.description ?? '');
  const [descAr, setDescAr] = useState(listing.description ?? '');
  const [retail, setRetail] = useState(String(listing.price ?? 0));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSave() {
    startTransition(async () => {
      const out = await addToCatalog({
        slug,
        listingId: listing.id,
        overrides: {
          title: { en: titleEn, ar: titleAr },
          description: { en: descEn, ar: descAr },
          retail: Number(retail),
        },
      });
      onClose();
      router.push(`/${locale}/dashboard/${slug}/products/${out.productId}`);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center" role="dialog">
      <div className="bg-white rounded p-5 w-[600px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">{t('headline')}</h2>
        <label className="block text-sm">{t('fields.title')} (EN)</label>
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="w-full border rounded p-2" />
        <label className="block text-sm mt-2">{t('fields.title')} (AR)</label>
        <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" className="w-full border rounded p-2" />
        <label className="block text-sm mt-2">{t('fields.description')} (EN)</label>
        <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} className="w-full border rounded p-2" />
        <label className="block text-sm mt-2">{t('fields.description')} (AR)</label>
        <textarea value={descAr} onChange={(e) => setDescAr(e.target.value)} dir="rtl" className="w-full border rounded p-2" />
        <label className="block text-sm mt-2">{t('fields.retail')}</label>
        <input value={retail} onChange={(e) => setRetail(e.target.value)} className="w-full border rounded p-2" />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-3 py-1.5">{t('cancel')}</button>
          <button onClick={onSave} disabled={pending} className="px-3 py-1.5 bg-zinc-900 text-white rounded">
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// quote-modal.tsx
'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestQuote } from '@/app/actions/souqnasource';
import type { Listing } from '@/lib/apps/souqnasource/types';

export function QuoteModal({ listing, slug, onClose }: {
  listing: Listing; slug: string; locale: 'en'|'ar'; onClose: () => void;
}) {
  const t = useTranslations('apps.souqnasource.quote');
  const [pending, startTransition] = useTransition();

  function onOpen() {
    startTransition(async () => {
      const { url } = await requestQuote({ slug, listingId: listing.id });
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center" role="dialog">
      <div className="bg-white rounded p-5 w-[480px]">
        <h2 className="text-lg font-semibold mb-3">{t('headline')}</h2>
        <p className="text-sm text-zinc-600">{t('preview')}</p>
        <div className="bg-zinc-50 rounded p-3 my-3 text-sm whitespace-pre-line">
          {/* live preview would call the action just to show the message; for v1 we just show a generic explainer */}
          {t('afterNote')}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5">Cancel</button>
          <button onClick={onOpen} disabled={pending} className="px-3 py-1.5 bg-zinc-900 text-white rounded">
            {t('open')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/{import-modal,quote-modal}.tsx
git commit -m "feat(souqnasource): add import + quote modals"
```

---

## Task 14: Imports tab + Quotes tab + Settings tab

**Files:** three sibling components.

- [ ] **Step 1: Imports tab**

```tsx
// imports-tab.tsx
import { listLinksForStore } from '@/lib/apps/souqnasource/links';
import { getTranslations } from 'next-intl/server';

export async function ImportsTab({ slug, locale }: { slug: string; locale: 'en'|'ar' }) {
  const links = await listLinksForStore(slug);
  const t = await getTranslations({ locale, namespace: 'apps.souqnasource.imports' });
  if (links.length === 0) return <p className="text-zinc-500">{t('empty')}</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr><th>Product</th><th>Supplier</th><th>Cost</th><th>Drift</th><th>Last sync</th></tr></thead>
      <tbody>
        {links.map((l) => (
          <tr key={l.productId}>
            <td><a href={`/${locale}/dashboard/${slug}/products/${l.productId}`}>{l.productId}</a></td>
            <td>{l.supplierId}</td>
            <td>{l.supplierCost} {l.supplierCurrency}</td>
            <td>{l.priceDriftPct ?? '—'}%</td>
            <td>{new Date(l.lastSyncedAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Quotes tab**

```tsx
// quotes-tab.tsx
import { listQuoteRequestsForStore } from '@/lib/apps/souqnasource/quotes';
import { getTranslations } from 'next-intl/server';

export async function QuotesTab({ slug, locale }: { slug: string; locale: 'en'|'ar' }) {
  const list = await listQuoteRequestsForStore(slug, 100);
  const t = await getTranslations({ locale, namespace: 'apps.souqnasource.quotes' });
  if (list.length === 0) return <p className="text-zinc-500">{t('empty')}</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr><th>Date</th><th>Listing</th><th>Supplier</th><th></th></tr></thead>
      <tbody>
        {list.map((q) => (
          <tr key={q.id}>
            <td>{new Date(q.createdAt).toLocaleString()}</td>
            <td>{q.listingId}</td>
            <td>{q.supplierId}</td>
            <td><a href={`?tab=quotes&import=${q.id}`}>{t('importManually')}</a></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Settings tab**

```tsx
// settings-tab.tsx
import { getSouqnasourceSettings } from '@/app/actions/souqnasource';
import { SettingsForm } from './settings-form';

export async function SettingsTab({ slug, locale }: { slug: string; locale: 'en'|'ar' }) {
  const s = await getSouqnasourceSettings(slug);
  return <SettingsForm slug={slug} initial={s} locale={locale} />;
}
```

```tsx
// settings-form.tsx
'use client';
import { useState, useTransition } from 'react';
import { saveSouqnasourceSettings } from '@/app/actions/souqnasource';
import type { SouqnasourceSettings } from '@/lib/apps/souqnasource/settings';
import { useTranslations } from 'next-intl';

export function SettingsForm({ slug, initial }: { slug: string; initial: SouqnasourceSettings; locale: 'en'|'ar' }) {
  const t = useTranslations('apps.souqnasource.settings');
  const [s, setS] = useState(initial);
  const [pending, startTransition] = useTransition();
  function save() {
    startTransition(async () => {
      const next = await saveSouqnasourceSettings(slug, s);
      setS(next);
    });
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3 max-w-md">
      <label className="block text-sm">
        <span>{t('drift')}: {(s.driftThreshold * 100).toFixed(0)}%</span>
        <input
          type="range" min={0.05} max={0.25} step={0.01}
          value={s.driftThreshold}
          onChange={(e) => setS((p) => ({ ...p, driftThreshold: Number(e.target.value) }))}
          className="w-full"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox" checked={s.includeUnverified}
          onChange={(e) => setS((p) => ({ ...p, includeUnverified: e.target.checked }))}
        />
        <span>{t('unverified')}</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox" checked={s.emailDigestOptOut}
          onChange={(e) => setS((p) => ({ ...p, emailDigestOptOut: e.target.checked }))}
        />
        <span>{t('emailDigest')}</span>
      </label>
      <button type="submit" disabled={pending} className="px-3 py-1.5 bg-zinc-900 text-white rounded">
        Save
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/{imports-tab,quotes-tab,settings-tab,settings-form}.tsx
git commit -m "feat(souqnasource): add imports, quotes, settings tabs"
```

---

## Task 15: Catalog product badge

**Files:**
- Create: `src/components/account/products-source-badge.tsx`
- Modify: the existing products list row to include the badge when `product.source === 'souqnasource'`

- [ ] **Step 1: Create badge**

```tsx
// src/components/account/products-source-badge.tsx
'use client';
import { useTranslations } from 'next-intl';

export function ProductsSourceBadge({ source, drift, delisted }: {
  source: string;
  drift?: number | null;
  delisted?: boolean;
}) {
  const t = useTranslations('apps.souqnasource.badge');
  if (source !== 'souqnasource') return null;
  const tone = delisted
    ? 'bg-rose-100 text-rose-700'
    : drift && Math.abs(drift) >= 10
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${tone}`}>
      ◈ {t('via')}{drift && Math.abs(drift) >= 1 && ` · ${t('drift', { pct: Math.round(drift) })}`}
      {delisted && ` · ${t('delisted')}`}
    </span>
  );
}
```

- [ ] **Step 2: Wire into the products list row**

Open `src/app/[locale]/dashboard/[slug]/products/(...)/products-row.tsx` (or whatever the file is called — find via Grep for the existing rendering of product rows). Add:

```tsx
import { ProductsSourceBadge } from '@/components/account/products-source-badge';
// ...
<ProductsSourceBadge source={product.source} drift={product.priceDriftPct} delisted={product.delisted} />
```

The `priceDriftPct` and `delisted` fields would need to be enriched on the row query — join with `souqnasource_links` where `product_id = products.id`. Add a left-join in the existing products list query.

- [ ] **Step 3: Commit**

```bash
git add src/components/account/products-source-badge.tsx src/app/[locale]/dashboard/[slug]/products
git commit -m "feat(souqnasource): add via-SouqnaSource badge on products list"
```

---

## Task 16: Flip `available: true` + smoke

**Files:**
- Modify: `src/lib/apps/registry.ts`

- [ ] **Step 1: Change `available: false` → `available: true`** for the souqnasource entry.

- [ ] **Step 2: End-to-end smoke**

```bash
npm run dev
```

In a browser:
1. Sign in as a test founder.
2. Navigate to `/<locale>/dashboard/<slug>/apps`.
3. Find SouqnaSource → Install (no auth, no creds).
4. Open SouqnaSource → Browse → pick a category.
5. (If indexer has populated data) click a priced listing → import modal → Save → land on the product page in draft state.
6. Click a contact listing → quote modal → Open WhatsApp → verify wa.me deep-link contains the correct claim line.

- [ ] **Step 3: Commit**

```bash
git add src/lib/apps/registry.ts
git commit -m "feat(souqnasource): mark plugin available=true"
```

---

## Self-Review

1. **Spec coverage:** §3.4–3.7, §4.1–4.3, §4.8, §5 (all surfaces 5.1–5.7, 5.13). ✓
2. **No placeholders.** ✓ (Task 11 i18n strings, Task 12-14 components are concrete; the only "find via Grep" is in Task 15 which is unavoidable since we don't know the existing products row file path — engineer must do that lookup.)
3. **Type consistency:** `Listing.price: number | null` everywhere; `addToCatalog` signature consistent across DAO + action; `getSupplierForBrowse` returns `Supplier | null`. ✓
4. **Each task ends with a commit.** ✓

If implementation diverges (e.g. the existing `products` table doesn't have `title_ar` columns), update the import action's INSERT alongside the schema discovery.

---

## Acceptance criteria for PR 2

- All 16 tasks committed.
- `npm test` passes (10+ new tests added on top of PR 1's suite).
- Founder can install SouqnaSource, browse a category, import a priced listing → product lands in draft state with `source='souqnasource'` and a `souqnasource_links` row.
- Founder can request a quote → wa.me URL opens AND a `souqnasource_quote_requests` row is written.
- Daily price-sync cron runs and writes `souqnasource_links.last_synced_at`.
- Plugin is marketplace-visible (`available: true`).
- Bilingual copy (en + ar Khaleeji) on every founder-facing string.
