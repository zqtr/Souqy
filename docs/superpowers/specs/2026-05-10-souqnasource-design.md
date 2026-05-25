# SouqnaSource — Design Spec

**Date:** 2026-05-10
**Status:** Design (pre-plan)
**Author:** Brainstorming session, Souqna founder + Claude
**Plugin id:** `souqnasource`
**Marketplace category:** `sales`
**Plan gating:** Free for all founders. Supplier-side monetization is v2 (verified badges, featured slots).

---

## 0. Summary

SouqnaSource is a Souqna marketplace plugin that turns scraped Qatari B2B
listings (qatarliving.com, marhaba.qa, qmart.qa) into a live, AI-ranked
directory of local wholesalers. Founders browse by category, see suppliers
ranked by an AI trust score, and one-click import a product into their
storefront with bilingual (English + Khaleeji Arabic) copy and a margin
already calculated. Suppliers can claim their listings via WhatsApp OTP
and chat with founders in real time, with auto-translation, read receipts,
and typing indicators.

The plugin is **free for founders** in v1; revenue comes from supplier-side
monetization in v2 (verified badges, featured listings).

### Locked decisions
| Decision | Choice |
|---|---|
| MVP slice | Finished goods from Qatari importers/wholesalers (not packaging, not raw materials) |
| Data source | Apify scrapers against qatarliving.com, marhaba.qa, qmart.qa |
| Entry flow | Browse by category (search is v2) |
| AI roles | Classifier (rule-first + LLM fallback), supplier trust score, bilingual copy rewrite at import, retail price suggestion at import, message translation |
| Plan gating | Fully free in v1; supplier monetization v2 |
| Import depth | Full draft product + ongoing price-sync cron + delisted detection |
| No-price flow | Two listing types — `priced` (importable) + `contact` (WhatsApp deep-link with claim-line appended) |
| Async pattern | Indexer cron pre-builds catalog every 6h; founder browse is over the cached index |
| Realtime infra | Pusher Channels (managed pub/sub) |
| Supplier auth | WhatsApp OTP via Meta Cloud API |
| wa.me vs chat | Coexist — claimed suppliers route to in-app chat; unclaimed suppliers stay on wa.me with a claim-line append |
| Notification fan-out | In-app inbox unread state (always) + WhatsApp push (recipient offline) + daily email digest (founders) |
| Chat features | Read receipts (✓/✓✓), typing indicators, auto-translate (EN ↔ Khaleeji AR) |
| Mobile | Web responsive in v1; PWA + push for supplier inbox in v1.5; native iOS as separate future spec |

---

## 1. Data model

One migration: `032_souqnasource.sql`. Adds 9 tables, alters one (`products`).

### 1.1 Catalog tables

```sql
-- The supplier directory. One row per discovered Qatari wholesaler.
create table souqnasource_suppliers (
  id text primary key,                        -- slug-style, e.g. 'doha-perfume-house-najma'
  display_name text not null,
  cr_number text,                             -- Qatar Commercial Registration; null until verified
  whatsapp text,                              -- E.164 (+974...)
  area text,                                  -- 'najma' | 'souq-waqif' | 'industrial-area' | ...
  source_network text not null,               -- 'qatarliving' | 'marhaba' | 'qmart' | 'manual'
  source_profile_url text,
  trust_score numeric(3,1),                   -- 0.0-10.0, AI-computed at index time, cached
  trust_reason text,                          -- ≤ 12 words, surfaced on supplier card
  verified boolean not null default false,    -- true once a Souqna admin confirms CR
  claimed_at timestamptz,                     -- v1: set when supplier completes claim flow
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now()
);
create index on souqnasource_suppliers (area);
create index on souqnasource_suppliers (trust_score desc);

-- The pre-indexed catalog. One row per scraped listing.
create table souqnasource_listings (
  id text primary key,                        -- hash(network + source_listing_id)
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  network text not null,
  source_listing_url text not null,
  title text not null,
  description text,
  image_url text,
  category text not null,                     -- canonical taxonomy code, see §1.4
  subcategory text,
  listing_type text not null,                 -- 'priced' | 'contact'
  price numeric(10,2),                        -- null when listing_type='contact'
  currency text,                              -- 'QAR' default; null for contact listings
  moq int,                                    -- minimum order quantity if extractable
  raw jsonb not null,                         -- vendor payload kept for re-extraction
  first_seen_at timestamptz not null default now(),
  last_indexed_at timestamptz not null default now(),
  delisted_at timestamptz                     -- set when nightly refresh can't find it
);
create index on souqnasource_listings (category, listing_type, last_indexed_at desc);
create index on souqnasource_listings (supplier_id);

-- Map an imported product back to the listing + supplier it came from.
create table souqnasource_links (
  product_id text primary key references products(id) on delete cascade,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  listing_id text not null references souqnasource_listings(id) on delete set null,
  supplier_id text not null references souqnasource_suppliers(id) on delete set null,
  supplier_cost numeric(10,2) not null,
  supplier_currency text not null,
  last_synced_at timestamptz not null default now(),
  last_seen_price numeric(10,2),
  price_drift_pct numeric(5,2)
);
create index on souqnasource_links (storefront_slug);
-- prevent accidental double-imports
create unique index on souqnasource_links (storefront_slug, listing_id) where listing_id is not null;

-- Founder lead/inquiry log for 'contact' listings.
create table souqnasource_quote_requests (
  id bigserial primary key,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  listing_id text not null references souqnasource_listings(id) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  prefilled_message text not null,
  created_at timestamptz not null default now()
);
create index on souqnasource_quote_requests (supplier_id, created_at desc);

-- Add source column to products (single column serves all source-of-truth plugins).
alter table products add column if not exists source text not null default 'manual';
```

### 1.2 Supplier auth tables

```sql
-- Supplier auth identity. Separate from Clerk because suppliers are a
-- different constituency from founders.
create table souqnasource_supplier_accounts (
  id text primary key,                        -- stable account id
  whatsapp text not null unique,              -- E.164, the auth identifier
  display_name text,                          -- supplier-provided on claim
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

-- Many-to-many: one human can manage multiple scraped supplier rows.
create table souqnasource_supplier_account_links (
  account_id text not null references souqnasource_supplier_accounts(id) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  primary key (account_id, supplier_id)
);

-- One claim flow per (supplier, claimer attempt). OTP lives ~10 min, single-use.
create table souqnasource_claim_otps (
  id text primary key,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  whatsapp text not null,
  code_hash text not null,                    -- never store the OTP plaintext
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,            -- max 5
  created_at timestamptz not null default now()
);
create index on souqnasource_claim_otps (whatsapp, expires_at);
```

### 1.3 Chat tables

```sql
-- One conversation per (storefront, supplier) pair. Lazy-created on first message.
create table souqnasource_conversations (
  id text primary key,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  account_id text references souqnasource_supplier_accounts(id) on delete set null,
  -- account_id is null for unclaimed-supplier conversations seeded by the wa.me funnel.
  founder_unread int not null default 0,
  supplier_unread int not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  context_listing_id text references souqnasource_listings(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storefront_slug, supplier_id)
);
create index on souqnasource_conversations (storefront_slug, last_message_at desc);
create index on souqnasource_conversations (account_id, last_message_at desc);

-- One row per message. Append-only.
create table souqnasource_messages (
  id text primary key,
  conversation_id text not null references souqnasource_conversations(id) on delete cascade,
  sender_kind text not null,                  -- 'founder' | 'supplier' | 'system'
  sender_ref text not null,                   -- founder: clerk user id; supplier: account_id; system: 'souqnasource'
  body text not null,                         -- markdown-light, max 4000 chars
  body_lang text not null default 'en',       -- 'en' | 'ar' (detected at send)
  body_translated jsonb not null default '{}'::jsonb,
                                              -- e.g. { "ar": "..." } when body_lang='en'
                                              -- {} when sender_lang === recipient_lang
  translation_status text not null default 'none',
                                              -- 'none' | 'ok' | 'failed' | 'skipped_same_lang' | 'skipped_trivial'
  attachments jsonb not null default '[]'::jsonb,
                                              -- [{kind:'image'|'pdf', url, name, size}]
  created_at timestamptz not null default now()
);
create index on souqnasource_messages (conversation_id, created_at);

-- One read-receipt row per (message, recipient-side).
create table souqnasource_message_reads (
  message_id text not null references souqnasource_messages(id) on delete cascade,
  reader_kind text not null,                  -- 'founder' | 'supplier'
  reader_ref text not null,                   -- clerk user id OR supplier account_id
  read_at timestamptz not null default now(),
  primary key (message_id, reader_kind)
);
create index on souqnasource_message_reads (message_id);
```

### 1.4 Category taxonomy

Plain TypeScript enum in `src/lib/apps/souqnasource/types.ts`. Promote to a
table only when admin-side curation appears (post-v1).

```ts
export const CATEGORIES = [
  'perfume-oud', 'perfume-modern', 'fashion-abaya', 'fashion-modest',
  'electronics-phones', 'electronics-accessories',
  'home-decor', 'home-textiles', 'beauty-skincare', 'beauty-cosmetics',
  'food-dates', 'food-spices', 'jewelry-gold', 'jewelry-fashion',
  'kids-toys', 'kids-clothing', 'sports-fitness', 'gifts-corporate',
] as const;
```

Bilingual labels live in `src/i18n/messages/apps/souqnasource/categories.{en,ar}.json`.

### 1.5 Why these shapes

- **Two-entity model (suppliers + listings)** — trust attaches to the supplier, not the listing. One supplier with 50 listings has 1 trust score, not 50.
- **`listing_type` discriminator** — priced vs contact in one table; same browse query, branch in the UI, no fragmented schema.
- **`raw jsonb`** kept on every listing — re-derive fields after a parser fix without re-scraping.
- **`delisted_at` marker, no hard delete** — preserves history; flags imports whose source vanished without orphaning `souqnasource_links`.
- **Supplier accounts separate from Clerk** — suppliers shouldn't appear in founder user-counts, billing, or storefront-creation flows.
- **`account_id` nullable on conversations** — record outbound founder→unclaimed-supplier touches as conversation rows; backfill `account_id` once the supplier claims.
- **`body_translated` as jsonb keyed by lang code** — open to a third language later (Hindi, Tagalog) without another schema change.
- **One read row per (message, side)** — multi-user-per-side comes later via `reader_ref`.
- **Append-only messages** — no edit/delete in v1; lower abuse surface, matches WhatsApp/Slack norms for B2B trust.

---

## 2. Indexer cron + SupplierClient interface

The core inversion vs. an on-demand model: scraping is **scheduled
background**, not founder-triggered.

### 2.1 SupplierClient interface

`src/lib/apps/souqnasource/clients/types.ts`:

```ts
export type SourceNetwork = 'qatarliving' | 'marhaba' | 'qmart';

export type RawSupplier = {
  network: SourceNetwork;
  sourceSupplierId: string;
  displayName: string;
  whatsapp: string | null;                    // raw, normalized to E.164 by indexer
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
  price: number | null;                       // null if contact-only
  currency: string | null;
  moq: number | null;
  raw: Record<string, unknown>;
};

export interface SupplierClient {
  network: SourceNetwork;
  /** One scheduled crawl pass. Implementations page the source. */
  crawl(opts: { sinceCursor: string | null }): Promise<{
    suppliers: RawSupplier[];
    listings: RawListing[];
    nextCursor: string | null;
  }>;
  /** Re-fetch one listing for the price-sync cron. */
  refreshListing(sourceListingId: string): Promise<RawListing | null>;
}
```

Three implementations: `clients/apify-qatarliving.ts`, `clients/apify-marhaba.ts`, `clients/apify-qmart.ts`. Registered in `clients/index.ts` as `Record<SourceNetwork, SupplierClient>`. Adding a 4th source = one new file + one entry.

### 2.2 Indexer cron — `/api/apps/souqnasource/cron/index/route.ts`

Runs **every 6 hours** (configured in `vercel.json`).

```
1. Auth: verify SOUQNASOURCE_INDEX_CRON_SECRET header (constant-time compare)
2. For each network in ['qatarliving', 'marhaba', 'qmart']:
     a. Postgres advisory lock keyed on ('souqnasource:index', network)
     b. cursor = read app_state key='index:cursor:<network>'
     c. { suppliers, listings, nextCursor } = await client.crawl({ sinceCursor: cursor })
     d. upsertSuppliers(suppliers)        -- normalize WhatsApp, area; preserve trust_score, verified, claimed_at
     e. upsertListings(listings)          -- classify category + listing_type before insert
     f. mark vanished listings: any souqnasource_listings row from this network not seen in 3 consecutive runs → set delisted_at = now()
     g. enqueue trustScoreJob for new suppliers (batched, max 50 per run)
     h. write app_state cursor = nextCursor, release lock
3. Hard time-budget: 250s (Vercel cron 300s limit).
```

Networks are sequential in v1 for predictability. Per-network parallelism is a v1.1 optimization.

### 2.3 Classifier — rule-first, LLM-fallback

`src/lib/apps/souqnasource/classifier.ts`:

```ts
export function classifyListing(raw: RawListing): {
  category: Category;
  subcategory: string | null;
  listingType: 'priced' | 'contact';
} {
  const listingType =
    typeof raw.price === 'number' && raw.price > 0 ? 'priced' : 'contact';
  const ruleHit = ruleBasedCategory(raw.title, raw.rawCategory);
  if (ruleHit) return { ...ruleHit, listingType };
  return { ...llmCategory(raw), listingType };
}
```

Rule layer covers the predictable Qatari vocabulary (Arabic + English + transliteration). LLM only handles the long tail (~30% of listings).

```ts
const KEYWORD_RULES: Array<[RegExp, Category]> = [
  [/\b(oud|عود|دهن العود|musk|مسك)\b/i, 'perfume-oud'],
  [/\b(perfume|عطر|fragrance|cologne|edp|edt)\b/i, 'perfume-modern'],
  [/\b(abaya|عباية|jalabiya)\b/i, 'fashion-abaya'],
  [/\b(iphone|samsung|xiaomi|case|charger|cable)\b/i, 'electronics-accessories'],
  [/\b(date|تمر|spice|بهار|saffron|زعفران)\b/i, 'food-dates'],
  // ...
];
```

### 2.4 Trust-score worker

Batched LLM call, **once per supplier**, cached on `souqnasource_suppliers.trust_score`. Triggered:
- New suppliers (no `trust_score` yet)
- Suppliers whose last index revealed material new info
- All suppliers monthly via `/cron/trust-refresh`

Founders never pay for a fresh score on click.

### 2.5 Per-product price-sync cron — `/api/apps/souqnasource/cron/sync/route.ts`

Runs **daily at 03:00 UTC**. Walks `souqnasource_links`.

```
1. Verify SOUQNASOURCE_SYNC_CRON_SECRET (constant-time)
2. Page links oldest last_synced_at first, batches of 50
3. For each link:
     a. listing = getListing(link.listing_id)
     b. if listing IS NULL OR listing.delisted_at IS NOT NULL:
          • set products.status = 'draft' (auto-unpublish)
          • notify('souqnasource:delisted', bilingual)
          • update link.last_synced_at = now()
          • continue
     c. if listing.last_indexed_at < 24h old AND priced:
          fresh_price = listing.price  -- piggyback on indexer
        else if priced:
          fresh = await client.refreshListing(listing.source_listing_id)
          fresh_price = fresh?.price ?? null
        else: fresh_price = null  -- contact listing
     d. drift = (fresh_price - link.supplier_cost) / link.supplier_cost
     e. update link.{last_synced_at, last_seen_price, price_drift_pct}
     f. if |drift| ≥ SOUQNASOURCE_DRIFT_THRESHOLD (default 0.10): notify
     g. if supplier trust dropped ≥ 2 since import: notify
4. Time budget 250s. Per-store advisory lock prevents concurrency starvation.
```

### 2.6 Failure-mode notifications (existing `notifications` table, bilingual)

| kind | trigger | severity | auto-action |
|---|---|---|---|
| `souqnasource:delisted` | `delisted_at` set OR refresh returns null | high | auto-set product to draft |
| `souqnasource:price_up` | drift ≥ +10% | medium | none |
| `souqnasource:price_down` | drift ≤ −10% | low | none |
| `souqnasource:supplier_lost_trust` | trust dropped ≥ 2 since import | medium | none |

### 2.7 Cost envelope (catalog only)

| Item | Daily cost |
|---|---|
| Apify: 3 networks × 4 runs/day × ~$0.05 | ~$0.60 |
| Trust LLM: ~50 new suppliers/day batched | ~$0.10 |
| Classifier LLM fallback: ~30% of new listings | ~$0.05 |
| Per-product sync: dominated by indexer cache hits | near-zero |
| **Catalog subtotal** | **~$0.75/day** |

---

## 3. AI prompts + WhatsApp deep-link helper

### 3.1 `ai/client.ts` — shared

`gpt-4o-mini` (default) or `claude-haiku-4-5` (if Anthropic stack). One HTTP client, `safeJsonArray()` helper, zod schemas, retry-once-then-fail. Single config: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

### 3.2 `ai/classifier.ts` — taxonomy LLM fallback

```
Classify this Qatari B2B listing into ONE of these categories:
<canonical category list with bilingual labels>

Output JSON only:
{ "category": "<code>", "subcategory": "<short label or null>",
  "confidence": 0.0-1.0 }

If confidence < 0.6, return category = "uncategorized".

Listing:
  Title: <title>
  Vendor category label: <rawCategory>
  Description: <description, truncated to 200 chars>
```

### 3.3 `ai/trust.ts` — supplier trust score

```
You are evaluating Qatari wholesale suppliers from public B2B listings.
For each supplier below, output a trust score 0-10 with a short reason.

Score rubric (be conservative — when in doubt, score lower):
  • CR (Commercial Registration) number visible      → +2
  • Verified by Souqna admin                         → +1
  • WhatsApp present + valid Qatar (+974) format     → baseline OK; missing → cap 5
  • Listings ≥ 5 AND span ≤ 2 categories             → +1 (focused seller)
  • Listings span ≥ 5 unrelated categories           → -2 (likely reseller spam)
  • First seen < 30 days AND < 3 listings            → cap at 4 (too new)
  • Title patterns: ALL CAPS, !!!, "ORIGINAL!!!"     → -1 each
  • Area set + listings consistent with area         → +1
  • Description missing on majority of listings      → -1

Output JSON array:
  { "id": "<supplierId>", "trustScore": <0-10>, "reason": "<≤12 words>" }

Suppliers:
<JSON: [{ id, displayName, area, hasCR, verified, hasWhatsapp,
          listingCount, categorySpan, sampleTitles[3], firstSeenDaysAgo }]>
```

### 3.4 `ai/copy.ts` — bilingual rewrite at import time

```
You are Souqna's brand copywriter. Rewrite this Qatari supplier listing into
clean, on-brand copy in BOTH English and Khaleeji Arabic (informal Qatari
Gulf register — NOT MSA, NOT Egyptian, NOT Levantine).

Strip: emojis, ALL CAPS, marketing spam ("BEST!!!", "ORIGINAL!!!"),
unit-mixing, vendor contact info baked into the title, repeated punctuation.
Keep: concrete specs (size, material, ml, color, MOQ if relevant).

If the source is partially Arabic, treat it as authoritative for product
identity but still produce both languages cleanly.

Output JSON:
  { "title":       { "en": "...", "ar": "..." },
    "description": { "en": "...", "ar": "..." } }

Title ≤ 60 chars EN, ≤ 50 chars AR.
Description 2-3 sentences each language.

Source listing:
  Title: <title>
  Description: <description>
  Category: <category>
  Supplier area: <area>
```

### 3.5 `ai/margin.ts` — retail price suggestion

```
You are a Qatar e-commerce pricing analyst. Suggest a retail price in QAR for
this product. The supplier is a Qatari wholesaler (local — no import duty,
short lead time).

Apply category-typical Qatar D2C retail markup:
  • perfume / oud:       2.0 - 3.0x
  • fashion / abaya:     2.5 - 3.5x
  • electronics access.: 1.5 - 2.0x
  • home / decor:        2.0 - 3.0x
  • beauty / skincare:   3.0 - 4.5x
  • food / dates:        1.8 - 2.5x

Round to clean .00 or .99 ending. MOQ discount is already priced in
(don't double-discount).

Output JSON:
  { "suggestedRetail": <number>, "currency": "QAR",
    "markupApplied": <number>, "rationale": "<≤15 words>" }

Item:
  Title: <title>
  Category: <category>
  Supplier cost: <price> <currency>
  MOQ: <moq or null>
  Supplier area: <area>
```

### 3.6 `ai/translate.ts` — message translation

```
You are translating B2B sourcing messages between Khaleeji Arabic (Qatari
Gulf register, NOT MSA) and English. Translate the message into <targetLang>.

Hard rules:
  • Preserve verbatim: prices (QAR 80), product codes, URLs, phone numbers,
    quantities ("MOQ 50"), brand names.
  • If source mixes Arabic + English (common in Khaleeji), translate the
    NON-target-lang segments only; keep target-lang segments untouched.
  • Khaleeji informal register on AR output ("أبي" not "أريد", "تمام"
    not "حسناً"). Avoid Egyptian or Levantine markers.
  • If the message is < 3 words OR is just numbers/punctuation, return it
    unchanged with status='skipped_trivial'.
  • Output JSON only:
      { "translated": "<text>", "status": "ok" | "skipped_trivial" }

Source (lang=<sourceLang>):
<message body>
```

### 3.7 WhatsApp deep-link helper

`src/lib/apps/souqnasource/whatsapp.ts`:

```ts
export function buildQuoteRequestUrl(opts: {
  listing: Listing;
  supplier: Supplier;
  storefront: { name: string; locale: 'en' | 'ar' };
}): { url: string; prefilledMessage: string } {
  const { listing, supplier, storefront } = opts;
  const phone = supplier.whatsapp;
  if (!phone) throw new Error('supplier_no_whatsapp');

  const claimLine = `\n— عبر SouqnaSource\nرد على Souqna: souqna.qa/s/${supplier.id}`;

  const message = storefront.locale === 'ar'
    ? `السلام عليكم،\nشفت إعلانكم على Souqna: «${listing.title}»\nأبي أعرف السعر والكمية اللي تقدرون توفرونها.\nمتجري: ${storefront.name}${claimLine}`
    : `Hello,\nI saw your listing on Souqna: "${listing.title}".\nCould you share pricing and minimum order quantity?\nMy store: ${storefront.name}${claimLine}`;

  const url = `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
  return { url, prefilledMessage: message };
}
```

The `souqna.qa/s/<supplierId>` line is the supplier-acquisition funnel: every wa.me touch is also a claim invitation.

### 3.8 Supplier claim flow — `claim.ts`

```
1. Supplier visits /supplier/claim/<supplierId>:
     a. Server resolves the supplier row. Shows display_name + "is this you?"
     b. Supplier enters their WhatsApp number.
     c. Server validates: does the entered number match supplier.whatsapp?
        • Match → straight to OTP step.
        • Mismatch → still allow, flag as 'unverified-claimant'. Souqna
          admin reviews unverified claims before granting access.
     d. Generate 6-digit OTP, store hashed (bcrypt cost 12), expires_at = now + 10min.
     e. Send via WhatsApp Cloud API template message ('Your Souqna code is ###').

2. Supplier enters OTP:
     a. Validate not expired, not consumed, attempts < 5.
     b. Constant-time compare hashed code.
     c. Upsert souqnasource_supplier_accounts (whatsapp).
     d. Insert souqnasource_supplier_account_links (account_id, supplier_id).
     e. Consume OTP.
     f. Issue session: signed JWT cookie, scope='supplier', subject=account_id,
        expires 30 days, HttpOnly + Secure + SameSite=Lax,
        cookie name 'sq_supplier_session'.
     g. Set souqnasource_suppliers.claimed_at = now().
     h. Backfill conversations where supplier_id matches and account_id is null.
     i. Redirect to /supplier/inbox.
```

### 3.9 Pusher auth helper — `pusher.ts`

```
POST /api/apps/souqnasource/pusher/auth
Body: { channel_name: 'private-conv-<convId>', socket_id: '...' }

1. Resolve session: founder (Clerk) OR supplier (sq_supplier_session JWT).
2. Parse convId from channel_name.
3. Load conversation. Authorize:
     • founder: conversation.storefront_slug owned by current Clerk user.
     • supplier: conversation.account_id == current supplier session's account_id.
   Else 403.
4. Return Pusher's signed auth payload (HMAC of socket_id + channel_name with PUSHER_SECRET).
```

---

## 4. Server actions: import, quote, message, sync

All actions follow Souqna's 5-step server-action contract: assert ownership, gate, load, validate, persist (transactional).

### 4.1 `addToCatalog(slug, listingId, overrides)`

Triggered when founder clicks "Add to my store" on a **priced** listing.

```
[1] assertStorefrontOwner(slug)
[2] (no plan gate — SouqnaSource is fully free in v1)
[3] load listing, validate listing_type='priced' AND price IS NOT NULL
    AND delisted_at IS NULL
    → if any fail, throw 'listing_unavailable'
[4] load supplier
[5a] OUTSIDE any DB transaction (these are slow HTTP calls):
       • call ai/copy.rewrite(listing) and ai/margin.suggest(listing, storefront.currency)
         — if EITHER fails, fall back to source title/description and a default 2.0x markup
       • download listing.image_url to object storage
         → /storefronts/<slug>/products/<productId>/cover.<ext>
         Size cap 5 MB, content-type whitelist
[5b] In a single short DB transaction:
       • insert into products (title, description, price, image_url,
         currency = storefront.currency, status = 'draft', source = 'souqnasource')
       • insert into souqnasource_links (...)
       • audit.ts entry: kind='souqnasource:import'
[6] return { productId }

NOTE: AI calls + image downloads are NEVER held inside a DB transaction.
The pattern across this spec is: do all slow I/O first, then a short tx
for the actual writes. Same pattern applies to §4.2 / §4.3 / §4.4.
```

### 4.2 `requestQuote(slug, listingId)`

Triggered when founder clicks "Get a quote on WhatsApp" on a **contact** listing AND the supplier is unclaimed.

```
[1] assertStorefrontOwner(slug)
[3] load listing, validate listing_type='contact' AND delisted_at IS NULL
[4] load supplier, validate supplier.whatsapp IS NOT NULL
[5] in a single transaction:
      • { url, prefilledMessage } = buildQuoteRequestUrl({ listing, supplier, storefront })
      • insert into souqnasource_quote_requests (...)
      • audit.ts entry: kind='souqnasource:quote_request'
[6] return { url }
```

UI receives `url`, `window.open(url, '_blank')` to launch WhatsApp.

### 4.3 `importFromQuote(slug, quoteRequestId, manualPrice, manualCurrency, overrides)`

For founders who got a price back via WhatsApp and want to import the product manually. Same shape as `addToCatalog` but `supplier_cost` comes from the founder.

### 4.4 `sendMessage(seedOrConvId, body, attachments)`

```
[1] Resolve sender: founder (Clerk → assertStorefrontOwner via convOrSeed.slug)
    OR supplier (sq_supplier_session → load account → check conv.account_id match).
[2] (no plan gate)
[3] Resolve OR create conversation:
      • If convOrSeed is { convId } → load and validate participant.
      • If convOrSeed is { slug, supplierId, contextListingId? }:
          - Load supplier. If supplier.claimed_at IS NULL:
              → Create conversation row (account_id=null), persist message,
                ALSO trigger the wa.me deep-link with claim line.
                Return { convId, claimPendingNote: true }.
          - If claimed: load conversation by (slug, supplierId) or create.
[4] Validate body (≤ 4000 chars, no script tags, basic markdown allowed),
    validate attachments (whitelist image/pdf, ≤ 10 MB each, ≤ 5).
[4b] OUTSIDE any DB transaction:
      sender_lang = detectMessageLang(body, sender.session.locale)
      recipient_lang = recipient.session.locale OR account_lang OR 'ar'
      { translated, status } = await maybeTranslate(body, sender_lang, recipient_lang)
[5] In a single short DB transaction:
      • insert message with body, body_lang, body_translated, translation_status
      • update conversation: last_message_at, last_message_preview, increment OTHER side's unread
      • audit.ts entry: kind='souqnasource:message_sent'
[6] Outside the transaction:
      • Publish to Pusher channel `private-conv-<convId>` event 'message'.
      • Schedule notification fan-out (§4.7).
[7] Return { messageId, convId }.
```

### 4.5 `markRead(convId)`

```
[1] Resolve sender side.
[3] Load conversation, validate participant.
[5] In a single transaction:
      • find all messages in convId where sender_kind != current_side AND
        no row in souqnasource_message_reads for (message_id, current_side)
      • bulk insert message_reads
      • zero out conversation.<side>_unread
[6] Publish to Pusher: event 'read' { side, upToMessageId }.
[7] Return { messagesMarked: N }.
```

Client debounces: fire 1.5s after last visible-message change.

### 4.6 `publishTyping(convId, isTyping)`

```
[1] Resolve sender side; validate participant.
Pure pub/sub — NOT persisted. Publish to Pusher event 'typing'
{ side, isTyping, expiresAt: now+3s }.
```

Client throttles to max 1 publish per 2s.

### 4.7 Notification fan-out — `notifications.ts`

```
notifyOnNewMessage({ convId, messageId, recipientKind }):
  conv = load conversation
  recipient = founder OR supplier per recipientKind

  // 1. ALWAYS: in-app inbox unread state (already incremented in tx).
  //    Header badge polls /api/apps/souqnasource/unread-count every 30s.
  //    Note: this is implicit/table-stakes for any inbox to function — not a
  //    separate notification channel. The two user-selected push channels
  //    (WhatsApp + email digest) layer on top.

  // 2. WhatsApp ping:
  if recipientKind === 'supplier' AND supplier.account is claimed:
    if not recentlyPinged(convId, 'wa', 5min):
      sendWhatsAppTemplate(supplier.whatsapp, {
        template: WHATSAPP_NEW_MESSAGE_TEMPLATE_NAME,
        vars: [
          founder.storefront_name,
          truncate(message.body, 80),
          `https://souqna.qa/supplier/inbox?conv=${convId}`,
        ],
      })
      markRecentlyPinged(convId, 'wa')

  if recipientKind === 'founder' AND founder is offline > 10 min:
    (same shape with founder's WA, if available)

  // 3. Email digest (founders only):
  // Daily at 8am Doha time (cron/email-digest), one summary email per founder
  // for conversations with founder_unread > 0 since the last digest.
  // Founders opt out in account settings.
```

Hard caps: 50 WhatsApp notifications per supplier per day, 50 per founder per day.

### 4.8 Other actions

| Action | Caller | Purpose |
|---|---|---|
| `browseListings(slug, filters)` | founder | Paginated catalog |
| `getSupplier(slug, supplierId)` | founder | Drawer data |
| `getMessagesSince(convId, lastMessageId)` | either | Pusher fallback polling |
| `requestSupplierOtp(supplierId, whatsapp)` | anonymous (rate-limited) | Starts claim |
| `verifySupplierOtp(claimOtpId, code)` | anonymous (rate-limited) | Completes claim |
| `supplierSignOut()` | supplier | Clears cookie |
| `getUnreadCount(slugOrSupplier)` | either | Header badge |
| `getSettings(slug)` / `saveSettings(slug, patch)` | founder | Drift threshold, area filter, default markup |

---

## 5. UI surfaces

All under existing Souqna patterns — no new layout primitives.

### 5.1 Marketplace tile

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
  available: true,
  glyph: '◈',
  accentVar: '--color-maroon',
  markSrc: '/apps/souqnasource/mark.svg',
  customizable: true,
  surfacesInBuilder: false,
  requiredEnv: ['APIFY_TOKEN', 'OPENAI_API_KEY', 'PUSHER_APP_ID',
                'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER',
                'META_APP_ID', 'META_APP_SECRET',
                'SOUQNASOURCE_SUPPLIER_JWT_SECRET'],
  connectCopy: {
    headline: 'Source from Qatar in seconds',
    body: 'Skip the import shipping wait. Find vetted Qatari wholesalers across every category, compare them by trust + price, and add products to your store in one click.',
    ctaLabel: 'Install SouqnaSource',
  },
}
```

### 5.2 Plugin home — four tabs

`/dashboard/[slug]/apps/souqnasource`:

- **Browse** (default) — category-first directory
- **Imports** — `souqnasource_links` rows, sortable by drift %, supplier trust delta, last-synced
- **Quotes** — `souqnasource_quote_requests` rows, deep-link back to WhatsApp, "import manually" CTA
- **Messages [N]** — founder inbox; `[N]` is sum of `founder_unread`
- **Settings** — drift threshold slider 5–25%, default markup overrides per category, area filter, "include unverified suppliers" toggle, email digest opt-out

### 5.3 Browse tab

Three-pane layout (categories | filters | listing grid). Filters bind to URL search params (`?type=priced&trust=6&area=najma&sort=trust`).

### 5.4 Listing card

For **priced** listings:
```
[img]   Oud Cambodi 12ml — Premium Grade
        QAR 85   ·   MOQ 10
        🟢 Doha Perfume House · Najma
        Trust 8.4 · CR verified
        [ Add to my store ]   [ ⤴ ]
```

For **contact** listings, the price line and CTA change. CTA depends on supplier claim state (smart routing):

| Listing type | Supplier claimed | CTA |
|---|---|---|
| `priced` | any | `Add to my store` |
| `contact` | yes | `Message on Souqna` (opens chat drawer) |
| `contact` | no | `Get a quote on WhatsApp` (wa.me + claim line) |

Card states: default, hover (peek supplier), already-imported (✓ chip + "Open product"), delisted (desaturated + warning), quote-previously-requested (💬 chip).

### 5.5 Supplier drawer

Side drawer triggered by clicking supplier name on a card. Shows display name, area, CR status, trust score + reason, WhatsApp, listing categories, "View all listings" CTA, "Get a quote / Message" CTA.

### 5.6 Import modal

Three editable fields prefilled by inline AI calls:
- Title (EN/AR tabs) — from `ai/copy.rewrite`
- Description (EN/AR tabs) — from `ai/copy.rewrite`
- Retail price (storefront currency, live margin %) — from `ai/margin.suggest`

Footer:
```
Source: Doha Perfume House (Trust 8.4) · QAR 85 cost
Margin if accepted: 2.4x · QAR 119 retail
[ Save as draft product ]      [ Cancel ]
```

Inline progress bar while AI runs (~3–6s). On AI failure, fields show source data with a banner: "AI copy unavailable — please review before publishing."

### 5.7 Quote modal

Locale-aware preview of the WhatsApp message with edit option, then "Open WhatsApp" CTA. Submission persists the quote-request row first.

### 5.8 Founder Messages tab

Two-pane (conversation list | active thread). Conversation list sorted by `last_message_at desc`, unread bold. Thread shows message bubbles with translation chip + read ticks + typing indicator.

### 5.9 Supplier inbox — `/supplier/inbox`

Same two-pane layout. Supplier shell is minimal: logo, inbox, "claimed listings" link, sign out. Localized en/ar.

### 5.10 Claim landing — `/supplier/claim/<supplierId>`

Three states: input form → OTP entry → success redirect. RTL-flipped Arabic available via `?lang=ar` (auto-detected from Accept-Language).

### 5.11 Catalog product badge

`via SouqnaSource` chip on `/dashboard/[slug]/products` rows when `products.source = 'souqnasource'`. Hover tooltip shows supplier, cost, sync status. States: ok, amber (drift > 10%), warning (trust dropped), red (delisted, auto-unpublish notice).

### 5.12 Message bubble affordances

- **`✦ Translated from Arabic` chip** when `translation_status === 'ok'`. Click "show original" toggles between `body` and `body_translated[viewerLang]`.
- **`translation_status === 'failed'`** shows ⓘ tooltip: "Auto-translation unavailable — showing original."
- **Read ticks** under outgoing messages (✓ sent, ✓✓ read; no "delivered" intermediate).
- **Typing indicator** ephemeral row with 3-dot animation, fades after 3s of no `publishTyping(true)`.

### 5.13 Cross-surface conventions

- All copy through `next-intl`. RTL parity verified.
- Khaleeji register on Arabic strings (`souqna-qatari-translator` rules).
- Empty states for every tab.
- No emojis in product-data UI strings (founder professionalism). Inline SVG icons only.
- "Free" messaged once on the install card; never repeated in-flow.

### 5.14 What's NOT built in v1

- Search bar (Browse-by-category is locked v1; search is v2).
- Voice notes.
- Group conversations.
- In-thread payments.
- Supplier dashboard analytics (data is collected; surface in v2).
- Founder ratings of suppliers (v2 — needs moderation).
- Multi-user per supplier account (schema supports; no UI).
- Per-message edit/delete (append-only).
- "Delivered" receipt intermediate state (only sent + read).

---

## 6. File map, env, testing, security, rollout

### 6.1 File map

```
src/
├── lib/
│   └── apps/
│       ├── registry.ts                                        [edit: add souqnasource entry]
│       └── souqnasource/                                      [NEW folder]
│           ├── index.ts                                       -- public surface, re-exports
│           ├── types.ts                                       -- Listing, Supplier, Conversation, Message
│           ├── suppliers.ts
│           ├── listings.ts
│           ├── classifier.ts
│           ├── import.ts                                      -- addToCatalog
│           ├── quotes.ts                                      -- requestQuote + importFromQuote
│           ├── sync.ts
│           ├── whatsapp.ts                                    -- wa.me deep-link
│           ├── claim.ts                                       -- supplier claim flow + OTP
│           ├── pusher.ts                                      -- Pusher auth + publish helpers
│           ├── conversations.ts
│           ├── messages.ts                                    -- sendMessage, markRead
│           ├── typing.ts                                      -- publishTyping
│           ├── langDetect.ts                                  -- character-ratio heuristic
│           ├── notifications.ts                               -- WhatsApp + email + in-app fan-out
│           ├── clients/
│           │   ├── types.ts
│           │   ├── index.ts
│           │   ├── apify-qatarliving.ts
│           │   ├── apify-marhaba.ts
│           │   └── apify-qmart.ts
│           └── ai/
│               ├── client.ts
│               ├── classifier.ts
│               ├── trust.ts
│               ├── copy.ts
│               ├── margin.ts
│               └── translate.ts
├── app/
│   ├── actions/
│   │   └── souqnasource.ts                                    [NEW]
│   ├── api/
│   │   └── apps/
│   │       └── souqnasource/
│   │           ├── cron/
│   │           │   ├── index/route.ts
│   │           │   ├── sync/route.ts
│   │           │   ├── trust-refresh/route.ts
│   │           │   └── email-digest/route.ts
│   │           ├── pusher/auth/route.ts
│   │           ├── unread-count/route.ts
│   │           └── claim/otp/route.ts
│   ├── [locale]/
│   │   └── dashboard/
│   │       └── [slug]/
│   │           └── apps/
│   │               └── souqnasource/
│   │                   ├── page.tsx                           -- 4-tab shell
│   │                   ├── browse-tab.tsx
│   │                   ├── browse-filters.tsx
│   │                   ├── category-tree.tsx
│   │                   ├── listing-card.tsx                   -- smart-routing CTA
│   │                   ├── supplier-drawer.tsx
│   │                   ├── import-modal.tsx
│   │                   ├── quote-modal.tsx
│   │                   ├── imports-tab.tsx
│   │                   ├── quotes-tab.tsx
│   │                   ├── messages-tab.tsx                   -- founder inbox
│   │                   ├── conversation-list.tsx              -- shared with supplier shell
│   │                   ├── thread-view.tsx                    -- shared with supplier shell
│   │                   ├── message-bubble.tsx                 -- translation chip + read ticks
│   │                   ├── typing-indicator.tsx
│   │                   └── settings-tab.tsx
│   └── supplier/                                              [NEW top-level shell, no [slug]]
│       ├── layout.tsx                                         -- minimal supplier chrome
│       ├── claim/[supplierId]/page.tsx
│       ├── claim/[supplierId]/otp.tsx
│       └── inbox/page.tsx
├── middleware.ts                                              [edit: add /supplier/* JWT check]
├── components/
│   └── apps/souqnasource/
│       ├── translation-toggle.tsx
│       ├── read-ticks.tsx
│       ├── pusher-provider.tsx
│       └── inbox-header-badge.tsx
├── i18n/messages/apps/souqnasource/
│   ├── en.json
│   ├── ar.json
│   └── categories.{en,ar}.json
├── db/migrations/
│   └── 032_souqnasource.sql
public/apps/souqnasource/
├── mark.svg
└── preview-{1,2,3}.svg
vercel.json                                                    [edit: 4 cron entries]
```

File-size discipline: ≤ 200 LOC per file. Split inline if any file crosses (e.g. `messages/send.ts`, `messages/read.ts`).

### 6.2 Env vars

```
APIFY_TOKEN
SOUQNASOURCE_INDEX_CRON_SECRET
SOUQNASOURCE_SYNC_CRON_SECRET                # also used by trust-refresh + email-digest
OPENAI_API_KEY                                # or ANTHROPIC_API_KEY
META_APP_ID                                   # reused from existing whatsapp-business plugin
META_APP_SECRET
META_GRAPH_VERSION                            # e.g. v22.0
WHATSAPP_OTP_TEMPLATE_NAME                    # pre-approved Meta template
WHATSAPP_NEW_MESSAGE_TEMPLATE_NAME            # pre-approved Meta template
WHATSAPP_PHONE_NUMBER_ID
SOUQNASOURCE_SUPPLIER_JWT_SECRET              # 32+ bytes
PUSHER_APP_ID
PUSHER_KEY                                    # exposed to NEXT_PUBLIC_PUSHER_KEY
PUSHER_SECRET
PUSHER_CLUSTER                                # 'eu' (closest to GCC)
SOUQNASOURCE_DRIFT_THRESHOLD                  # default 0.10
SOUQNASOURCE_INDEX_INTERVAL_HOURS             # default 6
```

### 6.3 Testing strategy

| Layer | What | How |
|---|---|---|
| `clients/*` | Crawl pagination, refreshListing, payload normalization | Mock Apify HTTP + qatarliving HTML fixtures |
| `classifier.ts` (rules) | Keyword → category coverage (AR + EN + transliteration) | ~80 fixture titles |
| `ai/*` | Prompt → JSON shape | Snapshot prompts; mock model client; assert `safeJsonArray` |
| `ai/translate.ts` | Round-trip EN→AR→EN preserves prices, SKUs, brand names | Golden-file tests with held-out Khaleeji samples |
| `langDetect.ts` | Mixed-script detection ratios | ~30 fixtures |
| `claim.ts` + OTP route | Code generation, hashing, expiry, attempt limits, replay safety | Direct route tests + DB integration |
| `messages.ts` send + translation | Send latency, fallback when AI fails, read counter increments | Integration with seeded conversation. Mock Pusher |
| `markRead`, `publishTyping` | Side-only auth, Pusher event payload | Mock publisher |
| `notifications.ts` | WhatsApp rate-limit dedupe, email digest grouping | Time-mocked |
| Sync cron | Time budget exit, advisory lock, delisted notifications | Seeded links + listings |
| Indexer cron | Cursor advance, advisory lock per network, delisted-after-3-misses | Seeded scrape results, multiple sequential runs |
| Pusher auth route | Rejects non-participants | Crafted sessions |
| UI | Browse → import happy path, send → translate → render → markRead | Playwright e2e (mock Pusher with stub provider) |

Translation has its own fixture suite: 30 EN→AR pairs vetted by `souqna-qatari-translator`, regression-checked on every prompt change.

### 6.4 Security

**Catalog + import:**
- All founder actions through `assertStorefrontOwner`.
- Cron routes use **separate secrets** for blast-radius isolation. Constant-time compare.
- Apify crawl URLs allowlisted to known network hostnames.
- Image download size cap (5 MB) + content-type whitelist.
- Audit log every state change.

**Supplier auth + OTP:**
- OTPs **stored hashed** (bcrypt cost 12). Never log plaintext anywhere.
- Max 5 attempts per OTP; lock for 15 min on exhaustion.
- Rate-limit `requestSupplierOtp` per (whatsapp, supplier_id): 3/hour, 10/day.
- `sq_supplier_session` cookie: HttpOnly + Secure + SameSite=Lax, signed JWT.
- Middleware order: Clerk first; supplier second; explicit 403 if both sessions present.
- Supplier session cannot access `/dashboard/*` routes.
- **Unverified-claimant** (entered WA ≠ scraped supplier WA) goes to admin review, NOT auto-granted.

**Chat:**
- Pusher private-channel auth: only conversation participants subscribe.
- Channel naming `private-conv-<id>` — conv IDs are 16+ random bytes. Never log channel names client-side.
- Message body sanitized: strip `<script>`, normalize markdown, max 4000 chars.
- Attachments: whitelist `image/png|jpeg|webp`, `application/pdf`. Max 5 per message, 10 MB each. Random filenames in object storage.
- WhatsApp template variables substituted server-side; user content escaped + truncated. Template structure never user-controlled.
- WhatsApp rate-limit: 1 per (conversation, recipient_kind) per 5 min. Hard cap: 50/supplier/day, 50/founder/day.
- No PII in audit logs (IDs + lengths only).

**Translation:**
- Sender-side `body` always persisted unmodified — auditability + "show original" toggle.
- LLM prompt explicitly instructs to NOT execute embedded instructions in message body (prompt-injection defense).
- Translation output sanitized through the same path as `body`.
- Translation failures degrade silently; never block delivery on AI availability.

**General:**
- No `console.log` in committed code.
- Sentry tag `plugin:souqnasource` on all errors; PII scrubbed.
- Per-store advisory locks on sync + indexer crons.

### 6.5 Rollout — five sequential PRs

| # | PR contents | Founder visible? |
|---|---|---|
| 1 | **Catalog foundation.** Migration 032 catalog tables + alter products. Three Apify clients. Indexer cron. Trust + classifier AI. No UI. `available: false`. | No |
| 2 | **Founder browse + import.** Browse tab, listing card (wa.me CTA only), supplier drawer, import modal, quote modal, imports tab, quotes tab, settings tab, catalog badge. Per-product sync cron. `available: true` end of PR. | Yes — full v1 of §5 |
| 3 | **Supplier auth + claim flow.** Migration adds supplier_accounts + claim_otps. Claim landing, OTP entry, supplier middleware, JWT session. wa.me message gains claim line. No chat UI yet. | Suppliers see "chat coming next week" banner |
| 4 | **Chat + realtime + read receipts + typing.** Migration adds conversations + messages + message_reads. Pusher provider, sendMessage, markRead, publishTyping, founder Messages tab, supplier inbox, notification fan-out (WA + email digest cron + header badge). Listing card swaps to smart-routing CTA. | Yes — full chat |
| 5 | **Translation + polish.** `ai/translate.ts`, send-time translation, message bubble translation chip + show-original toggle. Email digest formatting polish. Sentry dashboards (cost per network/day, message latency, translation success rate). Docs in `docs/apps/souqnasource/`. Founder-facing changelog. | Yes — translation auto-on |

Each PR's tests must pass before the next opens. No big-bang.

### 6.6 Cost envelope (full design, daily, platform-wide)

| Item | Daily |
|---|---|
| Apify catalog refresh | ~$0.60 |
| Trust + classifier + import-time copy/margin | ~$0.22 |
| Pusher Channels (free tier) | $0 |
| WhatsApp OTP (~30 claims/day) | ~$0.15 |
| WhatsApp message notifications (~200/day, rate-limited) | ~$1.00 |
| Translation LLM (~1000 cross-lang messages/day) | ~$0.10 |
| Email digest (Postmark, ~50/day) | ~$0.05 |
| **Total** | **~$2.12/day** |

---

## 7. Supplier mobile path (post-v1)

This section is forward-looking — not part of the v1 build, but locked in
here so the v1 design choices stay compatible.

### 7.1 v1.5 — PWA + Web Push for supplier inbox

**Why first:** Suppliers in Qatari souqs are phone-first. Native WhatsApp pings cover the offline notification case in v1, but suppliers in active conversation benefit from push to a Souqna-branded surface.

**Scope (~1 week of work):**
- Add a service worker scoped to `/supplier/*` (does NOT touch founder routes).
- Add web manifest at `/supplier/manifest.webmanifest` with Souqna branding (icon, theme color `--color-maroon`, `display: standalone`).
- Implement Web Push: subscribe on first inbox visit; store push subscription on `souqnasource_supplier_accounts` (new column `push_subscription jsonb`); fan-out from `notifications.ts` adds Web Push as a fourth channel (after in-app, WhatsApp, email).
- iOS support requires PWA installed-to-home-screen + iOS 16.4+ (Safari Web Push). Android works in Chrome out of the box.
- Service worker handles message cache for read-after-tap UX.

**Reuses 100% of the v1 supplier inbox web UI.** Zero re-architecture.

### 7.2 v2 — Native iOS app for suppliers (separate spec)

**Why later, not now:**
- App Store review (2–7 days), can be rejected — incompatible with iterative web shipping.
- Requires Apple Developer account, separate Connect setup, APNs cert + Pusher Beams or OneSignal integration.
- Native Swift/SwiftUI codebase (or React Native), separate from the Next.js codebase. Auth must be re-bridged (JWT cookies don't carry over to native).
- Realtime path: native Pusher SDK exists, but reconnect/background behavior needs platform-specific testing.
- ~6+ weeks of work, ongoing maintenance burden.

**Audience-fit check:** founders are desktop-first (managing storefronts), and the v1 web responsive design covers their mobile needs. A founder-side iOS app is **not justified** in any foreseeable horizon.

**Scope when built:**
- Supplier-only — no founder dashboard.
- Surfaces: inbox (list + thread), claim flow (deep link from WhatsApp message), claimed-listings view, settings.
- Auth: WhatsApp OTP (same flow as web), JWT issued by Souqna, stored in iOS Keychain.
- Realtime: Pusher iOS SDK on the same `private-conv-<id>` channels as web.
- Translation: same `ai/translate.ts` server endpoint; client just renders.
- Notifications: APNs via Pusher Beams or OneSignal, fanned out from the same `notifications.ts` module (additional channel).

**Native iOS gets its own design spec and rollout milestone when the v1.5 PWA metrics justify it** (target threshold: 200+ claimed suppliers active in chat per month).

### 7.3 Founder mobile

Stays web-responsive. The v1 dashboard already responds; no separate spec. Revisit only if usage analytics show a meaningful share of founder traffic from mobile.

---

## 8. Open questions / known unknowns

These are deferred for now but should be revisited before or during implementation:

1. **Apify actor selection per network.** v1 design assumes a working off-the-shelf or custom actor exists for each of qatarliving, marhaba, qmart. Spike during PR 1 to confirm; if a network has no viable actor, we drop it from v1 and document the loss in coverage.
2. **Meta WhatsApp template approval lead time.** `souqna_otp_v1` and `souqna_new_message` templates need pre-approval in Meta Business Manager. Submit during PR 1; can take 1–2 weeks. Block PR 3 (claim flow) and PR 4 (chat) on approval.
3. **CR verification UX.** "Verified by Souqna admin" requires an admin queue we haven't designed. v1 ships without a verified-supplier flow; everything is `verified=false` initially. Admin queue is a follow-up phase.
4. **Translation prompt drift.** The Khaleeji output quality depends on the model. Set up the translation eval suite (§6.3) on day 1 of PR 5; monitor over time.
5. **Pusher pricing escalation.** Free tier covers ~100 daily concurrent users. If chat adoption blows past that, evaluate Pusher paid tier vs. self-hosted Centrifugo. Document the breakpoint in observability dashboards.
6. **Founder offline detection.** "Founder is offline > 10 min" used in notification fan-out is currently fuzzy — needs a concrete signal (last Souqna page load? Pusher presence?). Tighten in PR 4.

---

## 9. Acceptance — when v1 is "done"

v1 ships when:

- All 5 rollout PRs are merged and deployed to production.
- A founder can install SouqnaSource, browse 3 categories, see at least 50 listings across the 3 networks combined, request a quote on at least one contact listing, and import a priced product to draft.
- A supplier can receive a wa.me message with a claim line, complete the OTP claim flow, see one founder conversation in their inbox, send a reply, and that reply arrives in the founder's Messages tab in <5 seconds with read receipt acknowledgment.
- Translation works for at least 95% of EN ↔ AR messages tested in the eval suite, preserving prices and brand names verbatim.
- Cost dashboards show daily spend within 2x of the projected $2.12/day envelope.
- All security checklist items in §6.4 pass review.
- No `console.log` in committed code; bilingual copy paired in `i18n/messages/apps/souqnasource/{en,ar}.json` for every founder-facing string.

---

*End of design spec. Implementation plan to follow via `superpowers:writing-plans`.*
