# SouqnaSource PR 1 — Catalog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SouqnaSource catalog backend — DB schema, scraper clients, indexer cron, and AI scoring — with zero founder-facing UI and `available: false` on the marketplace tile. Lays the foundation every subsequent PR builds on.

**Architecture:** Three Apify-backed `SupplierClient` implementations crawl qatarliving / marhaba / qmart on a 6-hour cron. A rule-first / LLM-fallback classifier maps raw listings to a canonical category enum. Suppliers get an AI-derived trust score cached on `souqnasource_suppliers`. All inserts are Postgres upserts keyed on stable network ids. No founder action surfaces yet.

**Tech Stack:** Next.js 14 App Router, Neon Postgres (`@neondatabase/serverless`), Apify (`apify-client`), OpenAI (`openai`), zod, Vitest (newly added), TypeScript 5.

**Spec reference:** `docs/superpowers/specs/2026-05-10-souqnasource-design.md` §1.1, §1.4, §1.5, §2, §3.1–3.3.

**Pre-flight:** This directory is not a git repo. If you haven't already, run `git init && git add -A && git commit -m "chore: pre-souqnasource baseline"` once before starting Task 1 so the per-task commits below land cleanly. From this point forward every task ends with `git add` + `git commit`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Add `apify-client`, `openai`, `vitest`, `@vitest/ui` deps + `test` scripts |
| `vitest.config.ts` | Vitest config (jsdom for UI later, node default for now) |
| `src/db/migrations/032_souqnasource.sql` | Catalog tables only (suppliers, listings, links, quote_requests + alter products). Auth + chat tables come in PR 3 / PR 4. |
| `src/lib/apps/souqnasource/types.ts` | Canonical `Category`, `Supplier`, `Listing` types + zod schemas |
| `src/lib/apps/souqnasource/suppliers.ts` | Read/upsert helpers for `souqnasource_suppliers` |
| `src/lib/apps/souqnasource/listings.ts` | Read/upsert helpers for `souqnasource_listings` + delisted-detection |
| `src/lib/apps/souqnasource/classifier.ts` | Rule-first + LLM-fallback category classification |
| `src/lib/apps/souqnasource/ai/client.ts` | Shared OpenAI client + `safeJsonArray` + `safeJsonObject` |
| `src/lib/apps/souqnasource/ai/classifier.ts` | LLM fallback prompt + schema |
| `src/lib/apps/souqnasource/ai/trust.ts` | Supplier trust score, batched |
| `src/lib/apps/souqnasource/clients/types.ts` | `SupplierClient` interface + `RawSupplier` / `RawListing` |
| `src/lib/apps/souqnasource/clients/apify-base.ts` | Shared Apify run helper (token, run-actor-and-wait) |
| `src/lib/apps/souqnasource/clients/apify-qatarliving.ts` | qatarliving.com scraper |
| `src/lib/apps/souqnasource/clients/apify-marhaba.ts` | marhaba.qa scraper |
| `src/lib/apps/souqnasource/clients/apify-qmart.ts` | qmart.qa scraper |
| `src/lib/apps/souqnasource/clients/index.ts` | `Record<SourceNetwork, SupplierClient>` registry |
| `src/app/api/apps/souqnasource/cron/index/route.ts` | 6-hourly indexer entrypoint |
| `src/app/api/apps/souqnasource/cron/trust-refresh/route.ts` | Monthly trust catch-up |
| `src/lib/apps/registry.ts` | Add SouqnaSource descriptor with `available: false` |
| `vercel.json` | Cron entries for `/cron/index` and `/cron/trust-refresh` |
| `tests/unit/souqnasource/*.test.ts` | Unit tests per module (rules, types, ai mocks) |
| `tests/integration/souqnasource/indexer.test.ts` | Indexer cron integration test against a seeded DB |

File-size discipline: ≤ 200 LOC per source file. Split inline if a file crosses (e.g. `clients/apify-qatarliving/{search,parse}.ts`).

---

## Task 1: Add test runner + dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/unit/.gitkeep`
- Create: `tests/integration/.gitkeep`

- [ ] **Step 1: Install deps**

```bash
npm install --save apify-client openai pusher
npm install --save-dev vitest @vitest/ui @types/node
```

Expected: `package-lock.json` updated; no install errors.

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    testTimeout: 15_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 4: Create placeholder dirs**

```bash
mkdir -p tests/unit/souqnasource tests/integration/souqnasource
touch tests/unit/.gitkeep tests/integration/.gitkeep
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: "No test files found" (zero failures).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "chore: add vitest + apify-client + openai + pusher deps"
```

---

## Task 2: Migration 032 — catalog tables

**Files:**
- Create: `src/db/migrations/032_souqnasource.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 032_souqnasource.sql
-- SouqnaSource catalog foundation (PR 1).
-- Auth + chat tables land in later PRs.

create table souqnasource_suppliers (
  id text primary key,
  display_name text not null,
  cr_number text,
  whatsapp text,
  area text,
  source_network text not null,
  source_profile_url text,
  trust_score numeric(3,1),
  trust_reason text,
  verified boolean not null default false,
  claimed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now()
);
create index on souqnasource_suppliers (area);
create index on souqnasource_suppliers (trust_score desc);

create table souqnasource_listings (
  id text primary key,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  network text not null,
  source_listing_url text not null,
  title text not null,
  description text,
  image_url text,
  category text not null,
  subcategory text,
  listing_type text not null,
  price numeric(10,2),
  currency text,
  moq int,
  raw jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now(),
  delisted_at timestamptz
);
create index on souqnasource_listings (category, listing_type, last_indexed_at desc);
create index on souqnasource_listings (supplier_id);

alter table products add column if not exists source text not null default 'manual';

create table souqnasource_links (
  product_id text primary key references products(id) on delete cascade,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  listing_id text references souqnasource_listings(id) on delete set null,
  supplier_id text references souqnasource_suppliers(id) on delete set null,
  supplier_cost numeric(10,2) not null,
  supplier_currency text not null,
  last_synced_at timestamptz not null default now(),
  last_seen_price numeric(10,2),
  price_drift_pct numeric(5,2)
);
create index on souqnasource_links (storefront_slug);
create unique index on souqnasource_links (storefront_slug, listing_id) where listing_id is not null;

create table souqnasource_quote_requests (
  id bigserial primary key,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  listing_id text not null references souqnasource_listings(id) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  prefilled_message text not null,
  created_at timestamptz not null default now()
);
create index on souqnasource_quote_requests (supplier_id, created_at desc);
```

- [ ] **Step 2: Run the migrate script**

```bash
npm run migrate
```

Expected: prints "Applied 032_souqnasource.sql" (or equivalent based on `scripts/migrate.mjs`). If migrate is not idempotent, it should auto-skip already-applied; otherwise rerun against a fresh DB.

- [ ] **Step 3: Verify schema**

```bash
psql "$DATABASE_URL" -c "\d souqnasource_suppliers"
psql "$DATABASE_URL" -c "\d souqnasource_listings"
psql "$DATABASE_URL" -c "\d souqnasource_links"
psql "$DATABASE_URL" -c "\d souqnasource_quote_requests"
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='products' and column_name='source';"
```

Expected: all four tables exist; `products.source` column present.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/032_souqnasource.sql
git commit -m "feat(souqnasource): add catalog migration 032"
```

---

## Task 3: Canonical types + category enum

**Files:**
- Create: `src/lib/apps/souqnasource/types.ts`
- Create: `tests/unit/souqnasource/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/souqnasource/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  isCategory,
  ListingSchema,
  SupplierSchema,
} from '@/lib/apps/souqnasource/types';

describe('CATEGORIES', () => {
  it('contains expected core categories', () => {
    expect(CATEGORIES).toContain('perfume-oud');
    expect(CATEGORIES).toContain('fashion-abaya');
    expect(CATEGORIES).toContain('electronics-accessories');
  });
});

describe('isCategory', () => {
  it('accepts known category', () => {
    expect(isCategory('perfume-oud')).toBe(true);
  });
  it('rejects unknown category', () => {
    expect(isCategory('hovercraft-eels')).toBe(false);
  });
});

describe('ListingSchema', () => {
  it('parses a priced listing', () => {
    const out = ListingSchema.parse({
      id: 'qatarliving:abc',
      supplierId: 'doha-perfume-house-najma',
      network: 'qatarliving',
      sourceListingUrl: 'https://qatarliving.com/x',
      title: 'Oud 12ml',
      description: null,
      imageUrl: null,
      category: 'perfume-oud',
      subcategory: null,
      listingType: 'priced',
      price: 85,
      currency: 'QAR',
      moq: null,
      raw: {},
      firstSeenAt: new Date().toISOString(),
      lastIndexedAt: new Date().toISOString(),
      delistedAt: null,
    });
    expect(out.listingType).toBe('priced');
  });

  it('rejects priced listing without price', () => {
    expect(() =>
      ListingSchema.parse({
        id: 'x',
        supplierId: 's',
        network: 'qatarliving',
        sourceListingUrl: 'https://x',
        title: 't',
        description: null,
        imageUrl: null,
        category: 'perfume-oud',
        subcategory: null,
        listingType: 'priced',
        price: null,
        currency: null,
        moq: null,
        raw: {},
        firstSeenAt: new Date().toISOString(),
        lastIndexedAt: new Date().toISOString(),
        delistedAt: null,
      }),
    ).toThrow();
  });
});

describe('SupplierSchema', () => {
  it('parses minimal supplier', () => {
    const s = SupplierSchema.parse({
      id: 's1',
      displayName: 'Doha Perfume House',
      crNumber: null,
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: null,
      trustScore: null,
      trustReason: null,
      verified: false,
      claimedAt: null,
      firstSeenAt: new Date().toISOString(),
      lastIndexedAt: new Date().toISOString(),
    });
    expect(s.id).toBe('s1');
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `types.ts`**

```ts
// src/lib/apps/souqnasource/types.ts
import { z } from 'zod';

export const CATEGORIES = [
  'perfume-oud',
  'perfume-modern',
  'fashion-abaya',
  'fashion-modest',
  'electronics-phones',
  'electronics-accessories',
  'home-decor',
  'home-textiles',
  'beauty-skincare',
  'beauty-cosmetics',
  'food-dates',
  'food-spices',
  'jewelry-gold',
  'jewelry-fashion',
  'kids-toys',
  'kids-clothing',
  'sports-fitness',
  'gifts-corporate',
  'uncategorized',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);
export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && CATEGORY_SET.has(v);
}

export const SourceNetworkSchema = z.enum(['qatarliving', 'marhaba', 'qmart']);
export type SourceNetwork = z.infer<typeof SourceNetworkSchema>;

export const ListingTypeSchema = z.enum(['priced', 'contact']);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const SupplierSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  crNumber: z.string().nullable(),
  whatsapp: z.string().nullable(),
  area: z.string().nullable(),
  sourceNetwork: z.string(),
  sourceProfileUrl: z.string().nullable(),
  trustScore: z.number().min(0).max(10).nullable(),
  trustReason: z.string().nullable(),
  verified: z.boolean(),
  claimedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  lastIndexedAt: z.string(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const ListingSchema = z
  .object({
    id: z.string().min(1),
    supplierId: z.string().min(1),
    network: SourceNetworkSchema,
    sourceListingUrl: z.string().url(),
    title: z.string().min(1),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    category: z.enum(CATEGORIES),
    subcategory: z.string().nullable(),
    listingType: ListingTypeSchema,
    price: z.number().nullable(),
    currency: z.string().nullable(),
    moq: z.number().int().nullable(),
    raw: z.record(z.unknown()),
    firstSeenAt: z.string(),
    lastIndexedAt: z.string(),
    delistedAt: z.string().nullable(),
  })
  .refine(
    (l) =>
      l.listingType === 'contact' ||
      (typeof l.price === 'number' && l.price > 0),
    { message: 'priced listing must have a positive price' },
  );
export type Listing = z.infer<typeof ListingSchema>;
```

- [ ] **Step 4: Run tests**

Run: `npm test -- types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/types.ts tests/unit/souqnasource/types.test.ts
git commit -m "feat(souqnasource): add canonical types + category enum"
```

---

## Task 4: Rule-based classifier (no AI)

**Files:**
- Create: `src/lib/apps/souqnasource/classifier.ts`
- Create: `tests/unit/souqnasource/classifier.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/classifier.test.ts
import { describe, it, expect } from 'vitest';
import { ruleBasedCategory, classifyListingType } from '@/lib/apps/souqnasource/classifier';

describe('ruleBasedCategory', () => {
  const cases: Array<[string, string | null]> = [
    ['Oud Cambodi 12ml premium', 'perfume-oud'],
    ['دهن العود مميز', 'perfume-oud'],
    ['EDP fragrance for men', 'perfume-modern'],
    ['Black abaya for sale wholesale', 'fashion-abaya'],
    ['عباية سوداء', 'fashion-abaya'],
    ['iPhone 15 silicone case bulk', 'electronics-accessories'],
    ['Saffron 50g زعفران', 'food-dates'],
    ['Random unrelated text', null],
  ];
  for (const [title, expected] of cases) {
    it(`maps ${JSON.stringify(title)} → ${expected}`, () => {
      const got = ruleBasedCategory(title, null);
      expect(got?.category ?? null).toBe(expected);
    });
  }
});

describe('classifyListingType', () => {
  it('priced when positive number', () => {
    expect(classifyListingType(85)).toBe('priced');
  });
  it('contact when null', () => {
    expect(classifyListingType(null)).toBe('contact');
  });
  it('contact when zero or negative', () => {
    expect(classifyListingType(0)).toBe('contact');
    expect(classifyListingType(-1)).toBe('contact');
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npm test -- classifier.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write classifier**

```ts
// src/lib/apps/souqnasource/classifier.ts
import type { Category, ListingType } from './types';

type Hit = { category: Category; subcategory: string | null };

const RULES: Array<[RegExp, Category]> = [
  [/\b(oud|عود|دهن العود|musk|مسك)\b/iu, 'perfume-oud'],
  [/\b(perfume|عطر|fragrance|cologne|edp|edt)\b/iu, 'perfume-modern'],
  [/\b(abaya|عباية|jalabiya)\b/iu, 'fashion-abaya'],
  [/\b(modest|hijab|حجاب|kaftan)\b/iu, 'fashion-modest'],
  [/\b(iphone|samsung|xiaomi|redmi|case|charger|cable|adapter|airpods|earbuds)\b/iu, 'electronics-accessories'],
  [/\b(phone|smartphone|هاتف|جوال)\b/iu, 'electronics-phones'],
  [/\b(decor|vase|فازة|lamp|مصباح)\b/iu, 'home-decor'],
  [/\b(bedding|towel|fabric|سرير|منشفة)\b/iu, 'home-textiles'],
  [/\b(skincare|cream|serum|كريم|مرطب)\b/iu, 'beauty-skincare'],
  [/\b(lipstick|mascara|makeup|maquillage|مكياج)\b/iu, 'beauty-cosmetics'],
  [/\b(date|تمر|spice|بهار|saffron|زعفران)\b/iu, 'food-dates'],
  [/\b(gold|ذهب|jewelry)\b/iu, 'jewelry-gold'],
  [/\b(toy|لعبة|kids)\b/iu, 'kids-toys'],
  [/\b(sports|fitness|رياضة|treadmill|dumbbell)\b/iu, 'sports-fitness'],
  [/\b(corporate|gift|هدية|مكتبية)\b/iu, 'gifts-corporate'],
];

export function ruleBasedCategory(
  title: string,
  rawCategory: string | null,
): Hit | null {
  const haystack = `${title} ${rawCategory ?? ''}`;
  for (const [re, cat] of RULES) {
    if (re.test(haystack)) {
      return { category: cat, subcategory: null };
    }
  }
  return null;
}

export function classifyListingType(price: number | null): ListingType {
  return typeof price === 'number' && price > 0 ? 'priced' : 'contact';
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- classifier.test.ts`
Expected: PASS (10 cases + 3 type cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/classifier.ts tests/unit/souqnasource/classifier.test.ts
git commit -m "feat(souqnasource): add rule-based classifier"
```

---

## Task 5: Shared AI client

**Files:**
- Create: `src/lib/apps/souqnasource/ai/client.ts`
- Create: `tests/unit/souqnasource/ai-client.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/ai-client.test.ts
import { describe, it, expect } from 'vitest';
import { safeJsonObject, safeJsonArray } from '@/lib/apps/souqnasource/ai/client';

describe('safeJsonObject', () => {
  it('parses a JSON object', () => {
    expect(safeJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ``` fences', () => {
    expect(safeJsonObject('```json\n{"x":2}\n```')).toEqual({ x: 2 });
  });
  it('returns null on garbage', () => {
    expect(safeJsonObject('hello world')).toBeNull();
  });
});

describe('safeJsonArray', () => {
  it('parses an array', () => {
    expect(safeJsonArray('[1,2]')).toEqual([1, 2]);
  });
  it('returns null when not an array', () => {
    expect(safeJsonArray('{"x":1}')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify fails**

Run: `npm test -- ai-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `ai/client.ts`**

```ts
// src/lib/apps/souqnasource/ai/client.ts
import OpenAI from 'openai';

let _client: OpenAI | null = null;
export function aiClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  _client = new OpenAI({ apiKey });
  return _client;
}

export const DEFAULT_MODEL = 'gpt-4o-mini';

export async function chatJson(opts: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const client = aiClient();
  const r = await client.chat.completions.create({
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: opts.maxTokens ?? 1500,
    temperature: 0.2,
  });
  return r.choices[0]?.message?.content ?? '';
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

export function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const out = JSON.parse(stripFences(raw));
    return out && typeof out === 'object' && !Array.isArray(out)
      ? (out as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function safeJsonArray(raw: string): unknown[] | null {
  try {
    const out = JSON.parse(stripFences(raw));
    return Array.isArray(out) ? out : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ai-client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/ai/client.ts tests/unit/souqnasource/ai-client.test.ts
git commit -m "feat(souqnasource): add shared AI client + JSON helpers"
```

---

## Task 6: AI classifier fallback

**Files:**
- Create: `src/lib/apps/souqnasource/ai/classifier.ts`
- Create: `tests/unit/souqnasource/ai-classifier.test.ts`

- [ ] **Step 1: Failing test (mocks LLM)**

```ts
// tests/unit/souqnasource/ai-classifier.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonObject: (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  },
}));

import { llmCategory } from '@/lib/apps/souqnasource/ai/classifier';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

describe('llmCategory', () => {
  it('returns parsed category when confidence high', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify({ category: 'perfume-modern', subcategory: 'eau de parfum', confidence: 0.85 }),
    );
    const out = await llmCategory({
      title: 'Designer Eau de Parfum 100ml',
      rawCategory: 'fragrance',
      description: null,
    });
    expect(out.category).toBe('perfume-modern');
    expect(out.subcategory).toBe('eau de parfum');
  });

  it('falls back to uncategorized when confidence low', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify({ category: 'perfume-oud', subcategory: null, confidence: 0.3 }),
    );
    const out = await llmCategory({ title: 'mystery item', rawCategory: null, description: null });
    expect(out.category).toBe('uncategorized');
  });

  it('falls back to uncategorized when LLM returns garbage', async () => {
    (chatJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('not json');
    const out = await llmCategory({ title: 'x', rawCategory: null, description: null });
    expect(out.category).toBe('uncategorized');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- ai-classifier.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/ai/classifier.ts
import { chatJson, safeJsonObject } from './client';
import { CATEGORIES, isCategory } from '../types';
import type { Category } from '../types';

const SYSTEM = `Classify a Qatari B2B listing into ONE of: ${CATEGORIES.join(', ')}.
Return JSON only: {"category": "<code>", "subcategory": "<short label or null>", "confidence": 0.0-1.0}.
If confidence < 0.6, return category = "uncategorized".`;

export async function llmCategory(input: {
  title: string;
  rawCategory: string | null;
  description: string | null;
}): Promise<{ category: Category; subcategory: string | null }> {
  const user = JSON.stringify({
    title: input.title,
    vendorCategory: input.rawCategory,
    description: (input.description ?? '').slice(0, 200),
  });
  let raw = '';
  try {
    raw = await chatJson({ system: SYSTEM, user });
  } catch {
    return { category: 'uncategorized', subcategory: null };
  }
  const obj = safeJsonObject(raw);
  if (!obj) return { category: 'uncategorized', subcategory: null };
  const cat = obj.category;
  const conf = typeof obj.confidence === 'number' ? obj.confidence : 0;
  if (!isCategory(cat) || conf < 0.6) {
    return { category: 'uncategorized', subcategory: null };
  }
  const sub = typeof obj.subcategory === 'string' ? obj.subcategory : null;
  return { category: cat, subcategory: sub };
}
```

- [ ] **Step 4: Run tests**

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/ai/classifier.ts tests/unit/souqnasource/ai-classifier.test.ts
git commit -m "feat(souqnasource): add LLM classifier fallback"
```

---

## Task 7: AI trust scorer

**Files:**
- Create: `src/lib/apps/souqnasource/ai/trust.ts`
- Create: `tests/unit/souqnasource/ai-trust.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/ai-trust.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/ai/client', () => ({
  chatJson: vi.fn(),
  safeJsonArray: (s: string) => {
    try { const o = JSON.parse(s); return Array.isArray(o) ? o : null; } catch { return null; }
  },
}));

import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';
import { chatJson } from '@/lib/apps/souqnasource/ai/client';

const mockChat = chatJson as unknown as ReturnType<typeof vi.fn>;

describe('scoreSuppliersTrust', () => {
  it('returns parsed scores', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify([
        { id: 's1', trustScore: 8.4, reason: 'CR verified, focused listings' },
        { id: 's2', trustScore: 4.5, reason: 'no whatsapp, very new' },
      ]),
    );
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: 'najma', hasCR: true, verified: true, hasWhatsapp: true, listingCount: 8, categorySpan: 1, sampleTitles: ['Oud 12ml'], firstSeenDaysAgo: 365 },
      { id: 's2', displayName: 'B', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 2, categorySpan: 1, sampleTitles: ['x'], firstSeenDaysAgo: 4 },
    ]);
    expect(out).toEqual([
      { id: 's1', trustScore: 8.4, reason: 'CR verified, focused listings' },
      { id: 's2', trustScore: 4.5, reason: 'no whatsapp, very new' },
    ]);
  });

  it('returns empty array on garbage', async () => {
    mockChat.mockResolvedValueOnce('not json');
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 0, categorySpan: 0, sampleTitles: [], firstSeenDaysAgo: 0 },
    ]);
    expect(out).toEqual([]);
  });

  it('clamps scores to 0..10', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify([{ id: 's1', trustScore: 99, reason: 'x' }]),
    );
    const out = await scoreSuppliersTrust([
      { id: 's1', displayName: 'A', area: null, hasCR: false, verified: false, hasWhatsapp: false, listingCount: 0, categorySpan: 0, sampleTitles: [], firstSeenDaysAgo: 0 },
    ]);
    expect(out[0]?.trustScore).toBe(10);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/ai/trust.ts
import { chatJson, safeJsonArray } from './client';

export type TrustInput = {
  id: string;
  displayName: string;
  area: string | null;
  hasCR: boolean;
  verified: boolean;
  hasWhatsapp: boolean;
  listingCount: number;
  categorySpan: number;
  sampleTitles: string[];
  firstSeenDaysAgo: number;
};

export type TrustOutput = {
  id: string;
  trustScore: number;
  reason: string;
};

const SYSTEM = `You are evaluating Qatari wholesale suppliers from public B2B listings.
For each supplier, output a trust score 0-10 with a short reason.

Rubric (be conservative — when in doubt, score lower):
  - CR (Commercial Registration) visible              -> +2
  - Verified by Souqna admin                          -> +1
  - WhatsApp present + valid Qatar (+974) format      -> baseline OK; missing -> cap 5
  - Listings >= 5 AND span <= 2 categories            -> +1 (focused seller)
  - Listings span >= 5 unrelated categories           -> -2 (likely reseller spam)
  - First seen < 30 days AND < 3 listings             -> cap at 4 (too new)
  - Title patterns: ALL CAPS, !!!, "ORIGINAL!!!"      -> -1 each
  - Area set + listings consistent with area          -> +1
  - Description missing on majority of listings       -> -1

Output JSON array, one object per supplier:
  {"id": "<supplierId>", "trustScore": <0-10>, "reason": "<<= 12 words>"}.
Return ONLY the JSON array.`;

function clamp(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

export async function scoreSuppliersTrust(
  suppliers: TrustInput[],
): Promise<TrustOutput[]> {
  if (suppliers.length === 0) return [];
  let raw = '';
  try {
    raw = await chatJson({
      system: SYSTEM,
      user: JSON.stringify(suppliers),
      maxTokens: 1200,
    });
  } catch {
    return [];
  }
  // The Chat Completions json_object response_format wraps arrays under {result: ...}.
  // We try array-first, then fall back to {result: [...]}.
  let arr = safeJsonArray(raw);
  if (!arr) {
    try {
      const obj = JSON.parse(raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, ''));
      if (obj && Array.isArray(obj.result)) arr = obj.result;
    } catch {
      arr = null;
    }
  }
  if (!arr) return [];
  const out: TrustOutput[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const i = item as Record<string, unknown>;
    if (typeof i.id !== 'string') continue;
    out.push({
      id: i.id,
      trustScore: clamp(i.trustScore),
      reason: typeof i.reason === 'string' ? i.reason.slice(0, 80) : '',
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/ai/trust.ts tests/unit/souqnasource/ai-trust.test.ts
git commit -m "feat(souqnasource): add AI trust scorer"
```

---

## Task 8: Suppliers DAO

**Files:**
- Create: `src/lib/apps/souqnasource/suppliers.ts`
- Create: `tests/integration/souqnasource/suppliers.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/suppliers.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import {
  upsertSupplier,
  getSupplierById,
  setSupplierTrust,
} from '@/lib/apps/souqnasource/suppliers';

describe('suppliers DAO', () => {
  const id = `test-supplier-${Date.now()}`;
  afterAll(async () => {
    await db()`delete from souqnasource_suppliers where id = ${id}`;
  });

  it('upserts new supplier', async () => {
    await upsertSupplier({
      id,
      displayName: 'Test Wholesaler',
      crNumber: null,
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: 'https://qatarliving.com/u/test',
    });
    const got = await getSupplierById(id);
    expect(got?.displayName).toBe('Test Wholesaler');
    expect(got?.verified).toBe(false);
    expect(got?.trustScore).toBeNull();
  });

  it('preserves trust_score + claimed_at on subsequent upsert', async () => {
    await setSupplierTrust(id, 7.5, 'looks legit');
    await upsertSupplier({
      id,
      displayName: 'Test Wholesaler Updated',
      crNumber: '0123456',
      whatsapp: '+97455555555',
      area: 'najma',
      sourceNetwork: 'qatarliving',
      sourceProfileUrl: 'https://qatarliving.com/u/test',
    });
    const got = await getSupplierById(id);
    expect(got?.trustScore).toBe(7.5);
    expect(got?.trustReason).toBe('looks legit');
    expect(got?.crNumber).toBe('0123456');
    expect(got?.displayName).toBe('Test Wholesaler Updated');
  });
});
```

- [ ] **Step 2: Run with DATABASE_URL set, expect FAIL**

```bash
DATABASE_URL=$DATABASE_URL npm test -- suppliers.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/suppliers.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import type { Supplier } from './types';

type Row = {
  id: string;
  display_name: string;
  cr_number: string | null;
  whatsapp: string | null;
  area: string | null;
  source_network: string;
  source_profile_url: string | null;
  trust_score: string | null;
  trust_reason: string | null;
  verified: boolean;
  claimed_at: string | null;
  first_seen_at: string;
  last_indexed_at: string;
};

function fromRow(r: Row): Supplier {
  return {
    id: r.id,
    displayName: r.display_name,
    crNumber: r.cr_number,
    whatsapp: r.whatsapp,
    area: r.area,
    sourceNetwork: r.source_network,
    sourceProfileUrl: r.source_profile_url,
    trustScore: r.trust_score === null ? null : Number(r.trust_score),
    trustReason: r.trust_reason,
    verified: r.verified,
    claimedAt: r.claimed_at,
    firstSeenAt: r.first_seen_at,
    lastIndexedAt: r.last_indexed_at,
  };
}

export type UpsertSupplier = Pick<
  Supplier,
  | 'id'
  | 'displayName'
  | 'crNumber'
  | 'whatsapp'
  | 'area'
  | 'sourceNetwork'
  | 'sourceProfileUrl'
>;

export async function upsertSupplier(s: UpsertSupplier): Promise<void> {
  await db()`
    insert into souqnasource_suppliers
      (id, display_name, cr_number, whatsapp, area, source_network, source_profile_url, last_indexed_at)
    values
      (${s.id}, ${s.displayName}, ${s.crNumber}, ${s.whatsapp}, ${s.area}, ${s.sourceNetwork}, ${s.sourceProfileUrl}, now())
    on conflict (id) do update set
      display_name = excluded.display_name,
      cr_number = excluded.cr_number,
      whatsapp = excluded.whatsapp,
      area = excluded.area,
      source_profile_url = excluded.source_profile_url,
      last_indexed_at = now()
  `;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers where id = ${id} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function setSupplierTrust(
  id: string,
  score: number,
  reason: string,
): Promise<void> {
  await db()`
    update souqnasource_suppliers
    set trust_score = ${score}, trust_reason = ${reason}, last_indexed_at = now()
    where id = ${id}
  `;
}

export async function listSuppliersNeedingTrust(
  limit: number,
): Promise<Supplier[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers
    where trust_score is null
    order by first_seen_at desc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listAllSuppliersForRefresh(
  limit: number,
): Promise<Supplier[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers
    order by last_indexed_at asc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}
```

- [ ] **Step 4: Run with seeded DB**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/suppliers.ts tests/integration/souqnasource/suppliers.test.ts
git commit -m "feat(souqnasource): add suppliers DAO + trust setter"
```

---

## Task 9: Listings DAO + delisted detection

**Files:**
- Create: `src/lib/apps/souqnasource/listings.ts`
- Create: `tests/integration/souqnasource/listings.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/listings.test.ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import {
  upsertListing,
  markVanishedAsDelisted,
  getListingById,
  listListingsByCategory,
} from '@/lib/apps/souqnasource/listings';

const sid = `t-supplier-${Date.now()}`;
const lid = `t-listing-${Date.now()}`;

beforeAll(async () => {
  await upsertSupplier({
    id: sid,
    displayName: 'Listings Test Supplier',
    crNumber: null,
    whatsapp: '+97455555555',
    area: 'najma',
    sourceNetwork: 'qatarliving',
    sourceProfileUrl: null,
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_listings where supplier_id = ${sid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('listings DAO', () => {
  it('upserts a priced listing', async () => {
    await upsertListing({
      id: lid,
      supplierId: sid,
      network: 'qatarliving',
      sourceListingUrl: 'https://qatarliving.com/test',
      title: 'Oud Cambodi 12ml',
      description: null,
      imageUrl: null,
      category: 'perfume-oud',
      subcategory: null,
      listingType: 'priced',
      price: 85,
      currency: 'QAR',
      moq: 10,
      raw: { sample: true },
    });
    const got = await getListingById(lid);
    expect(got?.title).toBe('Oud Cambodi 12ml');
    expect(got?.delistedAt).toBeNull();
    expect(got?.price).toBe(85);
  });

  it('lists by category', async () => {
    const list = await listListingsByCategory('perfume-oud', 'priced', 10);
    expect(list.some((l) => l.id === lid)).toBe(true);
  });

  it('marks vanished after 3 missed runs', async () => {
    // Simulate 3 indexer passes that did NOT include this listing.
    await markVanishedAsDelisted('qatarliving', new Set([]));
    await markVanishedAsDelisted('qatarliving', new Set([]));
    await markVanishedAsDelisted('qatarliving', new Set([]));
    const got = await getListingById(lid);
    expect(got?.delistedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, FAIL**

- [ ] **Step 3: Implement**

The "missed for 3 consecutive runs" check uses an `app_state` row keyed by `souqnasource_missed_streak:<network>:<listing_id>`. Simplification for v1: track per-listing `last_indexed_at`; if the listing wasn't seen this run, increment a `raw.missedStreak` counter; at 3 → set `delisted_at`.

```ts
// src/lib/apps/souqnasource/listings.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import type { Listing, Category, ListingType, SourceNetwork } from './types';

type Row = {
  id: string;
  supplier_id: string;
  network: SourceNetwork;
  source_listing_url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: Category;
  subcategory: string | null;
  listing_type: ListingType;
  price: string | null;
  currency: string | null;
  moq: number | null;
  raw: Record<string, unknown>;
  first_seen_at: string;
  last_indexed_at: string;
  delisted_at: string | null;
};

function fromRow(r: Row): Listing {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    network: r.network,
    sourceListingUrl: r.source_listing_url,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    category: r.category,
    subcategory: r.subcategory,
    listingType: r.listing_type,
    price: r.price === null ? null : Number(r.price),
    currency: r.currency,
    moq: r.moq,
    raw: r.raw,
    firstSeenAt: r.first_seen_at,
    lastIndexedAt: r.last_indexed_at,
    delistedAt: r.delisted_at,
  };
}

export type UpsertListing = Omit<
  Listing,
  'firstSeenAt' | 'lastIndexedAt' | 'delistedAt'
>;

export async function upsertListing(l: UpsertListing): Promise<void> {
  await db()`
    insert into souqnasource_listings
      (id, supplier_id, network, source_listing_url, title, description, image_url,
       category, subcategory, listing_type, price, currency, moq, raw,
       last_indexed_at, delisted_at)
    values
      (${l.id}, ${l.supplierId}, ${l.network}, ${l.sourceListingUrl}, ${l.title},
       ${l.description}, ${l.imageUrl}, ${l.category}, ${l.subcategory}, ${l.listingType},
       ${l.price}, ${l.currency}, ${l.moq}, ${JSON.stringify(l.raw)}::jsonb,
       now(), null)
    on conflict (id) do update set
      supplier_id = excluded.supplier_id,
      title = excluded.title,
      description = excluded.description,
      image_url = excluded.image_url,
      category = excluded.category,
      subcategory = excluded.subcategory,
      listing_type = excluded.listing_type,
      price = excluded.price,
      currency = excluded.currency,
      moq = excluded.moq,
      raw = excluded.raw,
      last_indexed_at = now(),
      delisted_at = null
  `;
}

export async function getListingById(id: string): Promise<Listing | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_listings where id = ${id} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listListingsByCategory(
  category: Category,
  listingType: ListingType | null,
  limit: number,
): Promise<Listing[]> {
  noStore();
  const rows = (await (listingType
    ? db()`
        select * from souqnasource_listings
        where category = ${category}
          and listing_type = ${listingType}
          and delisted_at is null
        order by last_indexed_at desc
        limit ${limit}
      `
    : db()`
        select * from souqnasource_listings
        where category = ${category} and delisted_at is null
        order by last_indexed_at desc
        limit ${limit}
      `)) as unknown as Row[];
  return rows.map(fromRow);
}

/**
 * Mark listings as delisted after 3 consecutive missed indexer runs.
 * Caller passes the set of source_listing_ids that WERE seen this pass.
 * We track miss streak in raw.missedStreak.
 */
export async function markVanishedAsDelisted(
  network: SourceNetwork,
  seenIds: Set<string>,
): Promise<number> {
  const rows = (await db()`
    select id, raw from souqnasource_listings
    where network = ${network} and delisted_at is null
  `) as unknown as { id: string; raw: Record<string, unknown> }[];

  let delisted = 0;
  for (const row of rows) {
    if (seenIds.has(row.id)) {
      // Reset streak. Upsert will overwrite raw, so this branch only runs
      // when the indexer failed to upsert that id (e.g. partial network result).
      const newRaw = { ...row.raw, missedStreak: 0 };
      await db()`
        update souqnasource_listings
        set raw = ${JSON.stringify(newRaw)}::jsonb, last_indexed_at = now()
        where id = ${row.id}
      `;
      continue;
    }
    const streak = (row.raw.missedStreak as number | undefined) ?? 0;
    const next = streak + 1;
    if (next >= 3) {
      await db()`
        update souqnasource_listings
        set delisted_at = now(), raw = ${JSON.stringify({
          ...row.raw,
          missedStreak: next,
        })}::jsonb
        where id = ${row.id}
      `;
      delisted++;
    } else {
      await db()`
        update souqnasource_listings
        set raw = ${JSON.stringify({
          ...row.raw,
          missedStreak: next,
        })}::jsonb
        where id = ${row.id}
      `;
    }
  }
  return delisted;
}
```

- [ ] **Step 4: Run tests**

Expected: PASS (3 tests; the "marks vanished" test runs 3 sweeps).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/listings.ts tests/integration/souqnasource/listings.test.ts
git commit -m "feat(souqnasource): add listings DAO + delisted detection"
```

---

## Task 10: SupplierClient interface + Apify base helper

**Files:**
- Create: `src/lib/apps/souqnasource/clients/types.ts`
- Create: `src/lib/apps/souqnasource/clients/apify-base.ts`

- [ ] **Step 1: Write `clients/types.ts`** (no test — pure types)

```ts
// src/lib/apps/souqnasource/clients/types.ts
import type { SourceNetwork } from '../types';

export type RawSupplier = {
  network: SourceNetwork;
  sourceSupplierId: string;
  displayName: string;
  whatsapp: string | null;
  area: string | null;
  sourceProfileUrl: string;
};

export type RawListing = {
  network: SourceNetwork;
  sourceListingId: string;
  sourceListingUrl: string;
  sourceSupplierId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rawCategory: string | null;
  price: number | null;
  currency: string | null;
  moq: number | null;
  raw: Record<string, unknown>;
};

export type CrawlResult = {
  suppliers: RawSupplier[];
  listings: RawListing[];
  nextCursor: string | null;
};

export interface SupplierClient {
  network: SourceNetwork;
  crawl(opts: { sinceCursor: string | null }): Promise<CrawlResult>;
  refreshListing(sourceListingId: string): Promise<RawListing | null>;
}
```

- [ ] **Step 2: Write `apify-base.ts`**

```ts
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
```

- [ ] **Step 3: Quick test for `normalizeWhatsapp` + `listingId`**

```ts
// tests/unit/souqnasource/apify-base.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeWhatsapp, listingId } from '@/lib/apps/souqnasource/clients/apify-base';

describe('normalizeWhatsapp', () => {
  it('null on empty', () => expect(normalizeWhatsapp(null)).toBeNull());
  it('prepends +974 to 8-digit Qatari', () =>
    expect(normalizeWhatsapp('5555 5555')).toBe('+97455555555'));
  it('keeps 974 prefix', () =>
    expect(normalizeWhatsapp('+97455555555')).toBe('+97455555555'));
  it('handles digits with leading 974', () =>
    expect(normalizeWhatsapp('97455555555')).toBe('+97455555555'));
});

describe('listingId', () => {
  it('joins with colon', () =>
    expect(listingId('qatarliving', 'abc123')).toBe('qatarliving:abc123'));
});
```

Run: `npm test -- apify-base.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/apps/souqnasource/clients/types.ts src/lib/apps/souqnasource/clients/apify-base.ts tests/unit/souqnasource/apify-base.test.ts
git commit -m "feat(souqnasource): add SupplierClient interface + Apify base"
```

---

## Task 11: Qatarliving Apify client

**Files:**
- Create: `src/lib/apps/souqnasource/clients/apify-qatarliving.ts`
- Create: `tests/unit/souqnasource/apify-qatarliving.test.ts`

The actor id below (`epctex/qatarliving-classifieds-scraper`) is a placeholder — confirm a viable Apify Marketplace actor during implementation; if none exists, build one in a separate spike. The payload-shape mapping below uses representative qatarliving fields that are well-documented public listings.

- [ ] **Step 1: Failing test (mocks `runActor`)**

```ts
// tests/unit/souqnasource/apify-qatarliving.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/clients/apify-base', async () => {
  const actual: typeof import('@/lib/apps/souqnasource/clients/apify-base') =
    await vi.importActual('@/lib/apps/souqnasource/clients/apify-base');
  return { ...actual, runActor: vi.fn() };
});

import { qatarlivingClient } from '@/lib/apps/souqnasource/clients/apify-qatarliving';
import { runActor } from '@/lib/apps/souqnasource/clients/apify-base';

const mockRun = runActor as unknown as ReturnType<typeof vi.fn>;

describe('qatarlivingClient.crawl', () => {
  it('maps actor items into suppliers + listings', async () => {
    mockRun.mockResolvedValueOnce([
      {
        id: 'ql-listing-1',
        url: 'https://qatarliving.com/classifieds/1',
        title: 'Oud Cambodi 12ml',
        description: 'Premium grade',
        image: 'https://qatarliving.com/img/1.jpg',
        price: 85,
        currency: 'QAR',
        moq: 10,
        category: 'Perfume',
        sellerId: 'ql-seller-1',
        sellerName: 'Doha Perfume House',
        sellerWhatsapp: '55555555',
        sellerArea: 'Najma',
        sellerProfileUrl: 'https://qatarliving.com/u/dph',
      },
    ]);
    const out = await qatarlivingClient.crawl({ sinceCursor: null });
    expect(out.suppliers).toHaveLength(1);
    expect(out.suppliers[0]?.displayName).toBe('Doha Perfume House');
    expect(out.suppliers[0]?.whatsapp).toBe('+97455555555');
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0]?.price).toBe(85);
    expect(out.listings[0]?.sourceSupplierId).toBe('ql-seller-1');
  });

  it('coerces missing price to null (contact listing)', async () => {
    mockRun.mockResolvedValueOnce([
      {
        id: 'ql-listing-2',
        url: 'https://qatarliving.com/classifieds/2',
        title: 'Wholesale electronics',
        description: null,
        image: null,
        price: null,
        currency: null,
        sellerId: 'ql-seller-2',
        sellerName: 'Najma Electronics',
        sellerWhatsapp: null,
        sellerArea: null,
        sellerProfileUrl: 'https://qatarliving.com/u/ne',
      },
    ]);
    const out = await qatarlivingClient.crawl({ sinceCursor: null });
    expect(out.listings[0]?.price).toBeNull();
  });
});
```

- [ ] **Step 2: Run, FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/clients/apify-qatarliving.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp, listingId } from './apify-base';

const ACTOR_ID =
  process.env.APIFY_QATARLIVING_ACTOR_ID ?? 'epctex/qatarliving-classifieds-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  moq?: number | null;
  category?: string | null;
  sellerId: string;
  sellerName: string;
  sellerWhatsapp: string | null;
  sellerArea: string | null;
  sellerProfileUrl: string;
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliersById = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliersById.has(it.sellerId)) {
      suppliersById.set(it.sellerId, {
        network: 'qatarliving',
        sourceSupplierId: it.sellerId,
        displayName: it.sellerName,
        whatsapp: normalizeWhatsapp(it.sellerWhatsapp),
        area: it.sellerArea ? it.sellerArea.toLowerCase() : null,
        sourceProfileUrl: it.sellerProfileUrl,
      });
    }
    listings.push({
      network: 'qatarliving',
      sourceListingId: it.id,
      sourceListingUrl: it.url,
      sourceSupplierId: it.sellerId,
      title: it.title,
      description: it.description,
      imageUrl: it.image,
      rawCategory: it.category ?? null,
      price: typeof it.price === 'number' && it.price > 0 ? it.price : null,
      currency: it.currency,
      moq: it.moq ?? null,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliersById.values()),
    listings,
    nextCursor: items.length < PAGE_SIZE ? null : items[items.length - 1]?.id ?? null,
  };
}

export const qatarlivingClient: SupplierClient = {
  network: 'qatarliving',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: {
        startUrls: [
          { url: 'https://www.qatarliving.com/classifieds/business-industrial' },
        ],
        sinceListingId: sinceCursor,
        maxItems: PAGE_SIZE,
      },
    });
    return mapItems(items);
  },
  async refreshListing(sourceListingId) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { listingIds: [sourceListingId] },
    });
    if (items.length === 0) return null;
    const mapped = mapItems(items);
    return mapped.listings[0] ?? null;
  },
};

// listingId() is exported from apify-base; the indexer composes the canonical
// listings.id via listingId('qatarliving', sourceListingId).
export { listingId };
```

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/clients/apify-qatarliving.ts tests/unit/souqnasource/apify-qatarliving.test.ts
git commit -m "feat(souqnasource): add qatarliving Apify client"
```

---

## Task 12: Marhaba + Qmart Apify clients

**Files:**
- Create: `src/lib/apps/souqnasource/clients/apify-marhaba.ts`
- Create: `src/lib/apps/souqnasource/clients/apify-qmart.ts`
- Create: `tests/unit/souqnasource/apify-marhaba.test.ts`
- Create: `tests/unit/souqnasource/apify-qmart.test.ts`

These mirror Task 11. Same interface, different actor id + slightly different field shapes.

- [ ] **Step 1: Marhaba test**

```ts
// tests/unit/souqnasource/apify-marhaba.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/apps/souqnasource/clients/apify-base', async () => {
  const actual: typeof import('@/lib/apps/souqnasource/clients/apify-base') =
    await vi.importActual('@/lib/apps/souqnasource/clients/apify-base');
  return { ...actual, runActor: vi.fn() };
});

import { marhabaClient } from '@/lib/apps/souqnasource/clients/apify-marhaba';
import { runActor } from '@/lib/apps/souqnasource/clients/apify-base';

const mockRun = runActor as unknown as ReturnType<typeof vi.fn>;

describe('marhabaClient.crawl', () => {
  it('maps marhaba payload', async () => {
    mockRun.mockResolvedValueOnce([
      {
        listingId: 'mh-1',
        url: 'https://marhaba.qa/listing/1',
        title: 'Black abaya wholesale',
        body: null,
        thumbnail: 'https://marhaba.qa/i/1.jpg',
        priceQar: 120,
        seller: {
          id: 'mh-seller-1',
          name: 'Souq Waqif Abayas',
          whatsapp: '+97444444444',
          location: 'souq-waqif',
          profileUrl: 'https://marhaba.qa/u/swa',
        },
      },
    ]);
    const out = await marhabaClient.crawl({ sinceCursor: null });
    expect(out.listings[0]?.title).toBe('Black abaya wholesale');
    expect(out.listings[0]?.price).toBe(120);
    expect(out.suppliers[0]?.area).toBe('souq-waqif');
  });
});
```

- [ ] **Step 2: Implement marhaba**

```ts
// src/lib/apps/souqnasource/clients/apify-marhaba.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp } from './apify-base';

const ACTOR_ID = process.env.APIFY_MARHABA_ACTOR_ID ?? 'souqna/marhaba-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  listingId: string;
  url: string;
  title: string;
  body: string | null;
  thumbnail: string | null;
  priceQar: number | null;
  seller: {
    id: string;
    name: string;
    whatsapp: string | null;
    location: string | null;
    profileUrl: string;
  };
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliers = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliers.has(it.seller.id)) {
      suppliers.set(it.seller.id, {
        network: 'marhaba',
        sourceSupplierId: it.seller.id,
        displayName: it.seller.name,
        whatsapp: normalizeWhatsapp(it.seller.whatsapp),
        area: it.seller.location,
        sourceProfileUrl: it.seller.profileUrl,
      });
    }
    listings.push({
      network: 'marhaba',
      sourceListingId: it.listingId,
      sourceListingUrl: it.url,
      sourceSupplierId: it.seller.id,
      title: it.title,
      description: it.body,
      imageUrl: it.thumbnail,
      rawCategory: null,
      price: typeof it.priceQar === 'number' && it.priceQar > 0 ? it.priceQar : null,
      currency: typeof it.priceQar === 'number' ? 'QAR' : null,
      moq: null,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliers.values()),
    listings,
    nextCursor:
      items.length < PAGE_SIZE ? null : items[items.length - 1]?.listingId ?? null,
  };
}

export const marhabaClient: SupplierClient = {
  network: 'marhaba',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: {
        startUrls: [{ url: 'https://www.marhaba.qa/category/business' }],
        sinceListingId: sinceCursor,
        maxItems: PAGE_SIZE,
      },
    });
    return mapItems(items);
  },
  async refreshListing(sourceListingId) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { listingIds: [sourceListingId] },
    });
    if (items.length === 0) return null;
    return mapItems(items).listings[0] ?? null;
  },
};
```

- [ ] **Step 3: Qmart test + implement** (analogous; use a `Map<sellerId, supplier>` and the actor id `process.env.APIFY_QMART_ACTOR_ID ?? 'souqna/qmart-scraper'`).

```ts
// src/lib/apps/souqnasource/clients/apify-qmart.ts
import type { SupplierClient, CrawlResult, RawListing } from './types';
import { runActor, normalizeWhatsapp } from './apify-base';

const ACTOR_ID = process.env.APIFY_QMART_ACTOR_ID ?? 'souqna/qmart-scraper';
const PAGE_SIZE = 100;

type ActorItem = {
  productId: string;
  productUrl: string;
  name: string;
  desc: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  moqUnits: number | null;
  vendor: {
    id: string;
    name: string;
    whatsapp: string | null;
    area: string | null;
    storeUrl: string;
  };
  taxonomyLabel: string | null;
};

function mapItems(items: ActorItem[]): CrawlResult {
  const suppliers = new Map<string, NonNullable<CrawlResult['suppliers']>[number]>();
  const listings: RawListing[] = [];
  for (const it of items) {
    if (!suppliers.has(it.vendor.id)) {
      suppliers.set(it.vendor.id, {
        network: 'qmart',
        sourceSupplierId: it.vendor.id,
        displayName: it.vendor.name,
        whatsapp: normalizeWhatsapp(it.vendor.whatsapp),
        area: it.vendor.area,
        sourceProfileUrl: it.vendor.storeUrl,
      });
    }
    listings.push({
      network: 'qmart',
      sourceListingId: it.productId,
      sourceListingUrl: it.productUrl,
      sourceSupplierId: it.vendor.id,
      title: it.name,
      description: it.desc,
      imageUrl: it.imageUrl,
      rawCategory: it.taxonomyLabel,
      price: typeof it.price === 'number' && it.price > 0 ? it.price : null,
      currency: it.currency,
      moq: it.moqUnits,
      raw: it as unknown as Record<string, unknown>,
    });
  }
  return {
    suppliers: Array.from(suppliers.values()),
    listings,
    nextCursor:
      items.length < PAGE_SIZE ? null : items[items.length - 1]?.productId ?? null,
  };
}

export const qmartClient: SupplierClient = {
  network: 'qmart',
  async crawl({ sinceCursor }) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { sinceProductId: sinceCursor, maxItems: PAGE_SIZE },
    });
    return mapItems(items);
  },
  async refreshListing(id) {
    const items = await runActor<ActorItem>({
      actorId: ACTOR_ID,
      input: { productIds: [id] },
    });
    if (items.length === 0) return null;
    return mapItems(items).listings[0] ?? null;
  },
};
```

Qmart test mirrors marhaba's; `expect(out.listings[0]?.title).toBe('...')` etc.

- [ ] **Step 4: Run all client tests** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/clients/apify-marhaba.ts src/lib/apps/souqnasource/clients/apify-qmart.ts tests/unit/souqnasource/apify-marhaba.test.ts tests/unit/souqnasource/apify-qmart.test.ts
git commit -m "feat(souqnasource): add marhaba + qmart Apify clients"
```

---

## Task 13: Client registry

**Files:**
- Create: `src/lib/apps/souqnasource/clients/index.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/clients/index.ts
import type { SourceNetwork } from '../types';
import type { SupplierClient } from './types';
import { qatarlivingClient } from './apify-qatarliving';
import { marhabaClient } from './apify-marhaba';
import { qmartClient } from './apify-qmart';

export const CLIENTS: Record<SourceNetwork, SupplierClient> = {
  qatarliving: qatarlivingClient,
  marhaba: marhabaClient,
  qmart: qmartClient,
};

export const ALL_NETWORKS: SourceNetwork[] = ['qatarliving', 'marhaba', 'qmart'];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/clients/index.ts
git commit -m "feat(souqnasource): register supplier clients"
```

---

## Task 14: Indexer cron route

**Files:**
- Create: `src/app/api/apps/souqnasource/cron/index/route.ts`
- Create: `tests/integration/souqnasource/indexer.test.ts`

- [ ] **Step 1: Failing integration test**

```ts
// tests/integration/souqnasource/indexer.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { POST } from '@/app/api/apps/souqnasource/cron/index/route';
import { CLIENTS } from '@/lib/apps/souqnasource/clients';

beforeAll(() => {
  process.env.SOUQNASOURCE_INDEX_CRON_SECRET = 'test-secret';
});

afterAll(async () => {
  await db()`delete from souqnasource_listings where supplier_id like 'idx-test-%'`;
  await db()`delete from souqnasource_suppliers where id like 'idx-test-%'`;
});

describe('indexer cron', () => {
  it('rejects on missing secret', async () => {
    const res = await POST(new Request('http://t/api/apps/souqnasource/cron/index'));
    expect(res.status).toBe(401);
  });

  it('runs all 3 networks and upserts', async () => {
    // Mock each client.crawl
    for (const c of Object.values(CLIENTS)) {
      vi.spyOn(c, 'crawl').mockResolvedValue({
        suppliers: [
          {
            network: c.network,
            sourceSupplierId: `idx-test-${c.network}-s`,
            displayName: `Test ${c.network}`,
            whatsapp: '+97455555555',
            area: 'najma',
            sourceProfileUrl: `https://${c.network}.test/u/x`,
          },
        ],
        listings: [
          {
            network: c.network,
            sourceListingId: `idx-test-${c.network}-l`,
            sourceListingUrl: `https://${c.network}.test/l/x`,
            sourceSupplierId: `idx-test-${c.network}-s`,
            title: 'Oud Cambodi 12ml',
            description: null,
            imageUrl: null,
            rawCategory: 'perfume',
            price: 85,
            currency: 'QAR',
            moq: null,
            raw: {},
          },
        ],
        nextCursor: null,
      });
    }

    const res = await POST(
      new Request('http://t/api/apps/souqnasource/cron/index', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    expect(res.status).toBe(200);

    const rows = (await db()`
      select id from souqnasource_suppliers
      where id like 'idx-test-%'
    `) as unknown as { id: string }[];
    expect(rows.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run, FAIL**

- [ ] **Step 3: Implement**

```ts
// src/app/api/apps/souqnasource/cron/index/route.ts
import { NextResponse } from 'next/server';
import { CLIENTS, ALL_NETWORKS } from '@/lib/apps/souqnasource/clients';
import { upsertSupplier, listSuppliersNeedingTrust, setSupplierTrust } from '@/lib/apps/souqnasource/suppliers';
import { upsertListing, markVanishedAsDelisted } from '@/lib/apps/souqnasource/listings';
import { ruleBasedCategory, classifyListingType } from '@/lib/apps/souqnasource/classifier';
import { llmCategory } from '@/lib/apps/souqnasource/ai/classifier';
import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';
import { listingId } from '@/lib/apps/souqnasource/clients/apify-base';

export const runtime = 'nodejs';
export const maxDuration = 280;

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.SOUQNASOURCE_INDEX_CRON_SECRET;
  const got = req.headers.get('x-cron-secret') ?? '';
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const summary: Record<string, { suppliers: number; listings: number; delisted: number }> = {};

  for (const network of ALL_NETWORKS) {
    const client = CLIENTS[network];
    const seen = new Set<string>();
    try {
      const { suppliers, listings } = await client.crawl({ sinceCursor: null });
      for (const s of suppliers) {
        await upsertSupplier({
          id: `${network}:${s.sourceSupplierId}`,
          displayName: s.displayName,
          crNumber: null,
          whatsapp: s.whatsapp,
          area: s.area,
          sourceNetwork: network,
          sourceProfileUrl: s.sourceProfileUrl,
        });
      }
      for (const l of listings) {
        const id = listingId(network, l.sourceListingId);
        seen.add(id);
        const ruleHit = ruleBasedCategory(l.title, l.rawCategory);
        const cat = ruleHit ?? (await llmCategory({
          title: l.title,
          rawCategory: l.rawCategory,
          description: l.description,
        }));
        await upsertListing({
          id,
          supplierId: `${network}:${l.sourceSupplierId}`,
          network,
          sourceListingUrl: l.sourceListingUrl,
          title: l.title,
          description: l.description,
          imageUrl: l.imageUrl,
          category: cat.category,
          subcategory: cat.subcategory,
          listingType: classifyListingType(l.price),
          price: l.price,
          currency: l.currency,
          moq: l.moq,
          raw: l.raw,
        });
      }
      const delisted = await markVanishedAsDelisted(network, seen);
      summary[network] = {
        suppliers: suppliers.length,
        listings: listings.length,
        delisted,
      };
    } catch (err) {
      summary[network] = { suppliers: 0, listings: 0, delisted: 0 };
      // Sentry tagging + structured log goes here in production, kept terse for v1.
    }
  }

  // Trust scoring batch (max 50 suppliers per indexer pass)
  const needTrust = await listSuppliersNeedingTrust(50);
  if (needTrust.length > 0) {
    const scores = await scoreSuppliersTrust(
      needTrust.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        area: s.area,
        hasCR: Boolean(s.crNumber),
        verified: s.verified,
        hasWhatsapp: Boolean(s.whatsapp),
        listingCount: 0, // will be enriched in PR 2; v1 indexer passes 0
        categorySpan: 0,
        sampleTitles: [],
        firstSeenDaysAgo: Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(s.firstSeenAt).getTime()) / (24 * 3600 * 1000),
          ),
        ),
      })),
    );
    for (const sc of scores) {
      await setSupplierTrust(sc.id, sc.trustScore, sc.reason);
    }
  }

  return NextResponse.json({ ok: true, summary });
}

export const GET = POST;
```

- [ ] **Step 4: Run integration test**

```bash
DATABASE_URL=$DATABASE_URL OPENAI_API_KEY=stub npm test -- indexer.test.ts
```

Note: `OPENAI_API_KEY=stub` is fine because all `llmCategory` calls in the test path will be triggered only on listings whose title matches no rule, and the seeded "Oud Cambodi" hits the perfume-oud rule. If the test stalls waiting on OpenAI, mock `llmCategory` directly.

Expected: PASS — both 401-on-missing-secret and 200-on-valid-secret.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/apps/souqnasource/cron/index/route.ts tests/integration/souqnasource/indexer.test.ts
git commit -m "feat(souqnasource): add indexer cron route"
```

---

## Task 15: Trust-refresh cron route

**Files:**
- Create: `src/app/api/apps/souqnasource/cron/trust-refresh/route.ts`

- [ ] **Step 1: Implement (small surface, monthly catch-up)**

```ts
// src/app/api/apps/souqnasource/cron/trust-refresh/route.ts
import { NextResponse } from 'next/server';
import { listAllSuppliersForRefresh, setSupplierTrust } from '@/lib/apps/souqnasource/suppliers';
import { scoreSuppliersTrust } from '@/lib/apps/souqnasource/ai/trust';

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
  const got = req.headers.get('x-cron-secret') ?? '';
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  const batch = await listAllSuppliersForRefresh(200);
  if (batch.length === 0) return NextResponse.json({ ok: true, refreshed: 0 });
  const scores = await scoreSuppliersTrust(
    batch.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      area: s.area,
      hasCR: Boolean(s.crNumber),
      verified: s.verified,
      hasWhatsapp: Boolean(s.whatsapp),
      listingCount: 0,
      categorySpan: 0,
      sampleTitles: [],
      firstSeenDaysAgo: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(s.firstSeenAt).getTime()) / (24 * 3600 * 1000),
        ),
      ),
    })),
  );
  for (const sc of scores) {
    await setSupplierTrust(sc.id, sc.trustScore, sc.reason);
  }
  return NextResponse.json({ ok: true, refreshed: scores.length });
}

export const GET = POST;
```

- [ ] **Step 2: Smoke test (manual)**

```bash
curl -X POST -H "x-cron-secret: $SOUQNASOURCE_SYNC_CRON_SECRET" \
  http://localhost:3000/api/apps/souqnasource/cron/trust-refresh
```

Expected: `{"ok":true,"refreshed":N}` where N ≥ 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/apps/souqnasource/cron/trust-refresh/route.ts
git commit -m "feat(souqnasource): add monthly trust-refresh cron"
```

---

## Task 16: Plugin descriptor (available: false)

**Files:**
- Modify: `src/lib/apps/registry.ts` — append a new entry
- Create: `public/apps/souqnasource/mark.svg` (minimal Souqna `◈` mark, copied from `/public/apps/<existing>` — placeholder until brand designs land)

- [ ] **Step 1: Add descriptor at the end of `APP_REGISTRY` (in `src/lib/apps/registry.ts`)**

```ts
{
  id: 'souqnasource',
  name: 'SouqnaSource',
  vendor: 'by Souqna',
  tagline: 'Source finished products from Qatari wholesalers',
  description:
    'Browse a live, AI-ranked directory of Qatari wholesalers. Compare suppliers by trust score and price, request a WhatsApp quote, or one-click add a product to your store with bilingual copy and a margin already calculated.',
  category: 'sales',
  authKind: 'none',
  available: false, // PR 2 flips this to true once browse + import ship
  glyph: '◈',
  accentVar: '--color-maroon',
  markSrc: '/apps/souqnasource/mark.svg',
  customizable: true,
  surfacesInBuilder: false,
  requiredEnv: [
    'APIFY_TOKEN',
    'OPENAI_API_KEY',
    'SOUQNASOURCE_INDEX_CRON_SECRET',
    'SOUQNASOURCE_SYNC_CRON_SECRET',
  ],
  connectCopy: {
    headline: 'Source from Qatar in seconds',
    body: 'Skip the import shipping wait. Find vetted Qatari wholesalers across every category, compare them by trust + price, and add products to your store in one click.',
    ctaLabel: 'Install SouqnaSource',
  },
},
```

- [ ] **Step 2: Copy or create the brand mark**

```bash
# Placeholder: reuse existing Souqna ◈ mark; designer replaces in PR 2.
mkdir -p public/apps/souqnasource
cp public/apps/whatsapp-business/mark.svg public/apps/souqnasource/mark.svg
```

- [ ] **Step 3: Verify dev build doesn't break**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/apps/registry.ts public/apps/souqnasource/
git commit -m "feat(souqnasource): register marketplace descriptor (available:false)"
```

---

## Task 17: Vercel cron config

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add cron entries**

If `vercel.json` exists, merge into the `crons` array. Otherwise create:

```json
{
  "crons": [
    {
      "path": "/api/apps/souqnasource/cron/index",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/apps/souqnasource/cron/trust-refresh",
      "schedule": "0 4 1 * *"
    }
  ]
}
```

The cron secret must be passed as a header. Vercel cron supports a static `Authorization: Bearer <CRON_SECRET>` automatically; the route reads `x-cron-secret`. Either:
- (preferred for v1) Add a small wrapper that reads `Authorization` and falls back to `x-cron-secret`, OR
- configure the cron via `vercel.json` with a `headers` block — but Vercel cron does NOT yet support custom headers in `vercel.json`.

Use the simpler path: add an `Authorization` fallback in both cron routes.

- [ ] **Step 2: Update both cron routes to also accept `Authorization: Bearer`**

In `src/app/api/apps/souqnasource/cron/index/route.ts` and `.../trust-refresh/route.ts`, replace the secret-extraction line with:

```ts
const got =
  req.headers.get('x-cron-secret') ??
  (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
```

Vercel cron sets `Authorization: Bearer $CRON_SECRET` when the env var `CRON_SECRET` is set. Set `CRON_SECRET = SOUQNASOURCE_INDEX_CRON_SECRET` value for the project. Document this in `.env.example` (Task 18).

- [ ] **Step 3: Commit**

```bash
git add vercel.json src/app/api/apps/souqnasource/cron/
git commit -m "chore(souqnasource): wire vercel cron + dual-header secret"
```

---

## Task 18: Env documentation

**Files:**
- Modify: `.env.example` (or create if absent)

- [ ] **Step 1: Append SouqnaSource block**

```bash
# --- SouqnaSource ---
APIFY_TOKEN=
APIFY_QATARLIVING_ACTOR_ID=
APIFY_MARHABA_ACTOR_ID=
APIFY_QMART_ACTOR_ID=
OPENAI_API_KEY=
SOUQNASOURCE_INDEX_CRON_SECRET=
SOUQNASOURCE_SYNC_CRON_SECRET=
# Vercel Cron sets Authorization: Bearer $CRON_SECRET. Set CRON_SECRET to whichever
# of the two SOUQNASOURCE_* secrets above you want the schedules to use.
CRON_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(souqnasource): document required env vars"
```

---

## Task 19: End-to-end smoke

**Files:** none new. This task verifies prior tasks integrate.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all 30+ tests pass.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Trigger indexer locally (with stubbed actors)**

```bash
npm run dev
# in another shell:
curl -X POST -H "x-cron-secret: $SOUQNASOURCE_INDEX_CRON_SECRET" \
  http://localhost:3000/api/apps/souqnasource/cron/index | jq
```

Expected: `{"ok":true,"summary":{"qatarliving":{...},"marhaba":{...},"qmart":{...}}}`. If actor ids are unset, networks return 0 counts — that's acceptable for v1 baseline.

- [ ] **Step 4: Commit nothing — task is verification only**

---

## Self-Review (run before declaring PR 1 done)

1. **Spec coverage:** Every requirement from spec §1.1, §1.4, §1.5, §2, §3.1–3.3 has a task above. ✓
2. **Placeholders:** Search for `TBD`, `TODO`, `implement later` in plan — none present. ✓ Task 11 mentions "actor id placeholder — confirm during implementation"; this is an explicitly-flagged spike, not a plan placeholder.
3. **Type consistency:** `Listing.price` is `number | null` everywhere; `Supplier.trustScore` is `number | null` everywhere; `SupplierClient.crawl` signature matches across all three implementations. ✓
4. **Test runner consistency:** Vitest installed in Task 1, used in every subsequent test. ✓

If implementation diverges from this plan (e.g. an Apify actor returns a different shape), update the per-network client + its test fixture together, not just the implementation.

---

## Acceptance criteria for PR 1

- All 19 tasks committed.
- `npm test` passes.
- Migration 032 applies cleanly to a fresh DB.
- Triggering `/api/apps/souqnasource/cron/index` with the right secret returns `{ok: true}` and writes rows to `souqnasource_suppliers` + `souqnasource_listings` (when actors return data).
- Marketplace tile is registered with `available: false` — tile does not render to founders.
- No `console.log` calls in committed code.
