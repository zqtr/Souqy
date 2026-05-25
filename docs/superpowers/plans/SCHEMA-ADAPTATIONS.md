# SouqnaSource — Schema Adaptations vs. Plans

The PR 1–5 plans were written without verifying actual `src/db/schema.sql`. This file records every delta between the plans and what landed.

**Source of truth from this point on:** the actual code in `src/`, not the plans. Plans become reference docs.

## Discovered schema facts

- The "storefronts" entity in the spec maps to the **`briefs`** table in this codebase. FK convention: `storefront_slug text references briefs(slug) on delete cascade`. There is no `storefronts` table.
- `products.id` is **`uuid`** (default `gen_random_uuid()`), not `text`. Any FK to `products(id)` must declare `uuid`.
- `products` has `price_qar numeric(10,2)`, NOT a `price` + `currency` pair. Storefront currency is implicitly QAR.
- `products` has `title text`, `description text`, `image_url text`, `category text`, `status text` (with check constraint `'active'|'draft'|'sold_out'`).
- `products` has NO bilingual columns (`title_ar`, `description_ar`). Migration 032 adds them.
- `briefs` is the storefronts table. Owner column TBD when we read it; assume `owner_user_id text` until proven otherwise.

## Adaptations applied

### Migration 032 (PR 1 Task 2)
- All four `references storefronts(slug)` rewritten to `references briefs(slug)`.
- `souqnasource_links.product_id` declared as `uuid` (was `text`).
- Added two `alter table products add column if not exists` for `title_ar` + `description_ar` to support PR 2 bilingual import.
- `alter table products add column source` kept as-is (text, default 'manual').

### PR 2 adaptations applied

- **Task 7 (`addToCatalog`):** `insert into products` uses `price_qar` (no `currency` column), `title_ar`, `description_ar`. `id` allocated via `crypto.randomUUID()` because `products.id` is a uuid with `default gen_random_uuid()`. Storefront-currency lookup dropped — Souqna is QAR-only.
- **Task 9 (server actions):** `assertStorefrontOwner` uses `getStorefront(slug)` from `@/lib/brief` and compares against `clerk_user_id` (the actual column name; not `owner_user_id`). For `requestQuote`, founder name comes from `briefs.business_name` and locale from `briefs.locale`.
- **Task 10 (sync notifications):** `notifications` table is per-user (`clerk_user_id`), NOT per-storefront. The sync helper looks up `briefs.clerk_user_id` from the storefront slug, then writes via `pushNotification` from `@/lib/notifications` (columns: `clerk_user_id, kind, title, title_ar, body, body_ar, meta`). The plan's `body_en` does not exist — use `body` for English. `meta.dedupeKey` enables idempotency.
- **Task 12 route layout:** the plan's `src/app/[locale]/dashboard/[slug]/apps/souqnasource/...` does not exist in Souqna. UI lives at `src/app/account/apps/souqnasource/page.tsx` with `?store=<slug>` query param, matching the existing `/account/apps/<id>` layout (lookbook precedent).
- **Task 11 next-intl wiring:** `src/i18n/request.ts` was previously empty (`messages: {}`). Now imports the four JSON files and structures them under `apps.souqnasource.{...}` and `apps.souqnasource.categories.{...}` to support `useTranslations('apps.souqnasource.x')` paths used in client components.
- **Task 13 import-modal redirect:** the plan redirects to `/${locale}/dashboard/${slug}/products/${id}` — adapted to `/account/products/${id}` (Souqna's actual products surface).
- **Test isolation:** integration test files use distinct timestamped slugs (`test-store-import-${Date.now()}`, `test-store-settings-${Date.now()}`, `test-store-quotes-${Date.now()}`) to avoid races when vitest runs files in parallel — the original shared `'test-store'` would have one file's `afterAll` delete the brief mid-flight for another.
- **Vitest `server-only` stub:** `src/lib/notifications.ts` (and other server-only deps) carry `import 'server-only'`, which throws under vitest's node runtime. `tests/stubs/server-only.ts` plus a `resolve.alias` entry in `vitest.config.ts` short-circuits this.
- **Task 15 badge wiring (deferred):** the badge component ships and `Product.source` is now exposed on the type, but the plan's "left-join `souqnasource_links` to enrich `priceDriftPct` + `delisted` on every products list query" is NOT yet implemented. Wiring the badge into `src/app/account/(chrome)/products/page.tsx` is left as a follow-up commit so it can be reviewed against the products query change in isolation.

### Pending adaptations (PR 4–5)

- **PR 4 Task 1 (migration 034):** `souqnasource_conversations.storefront_slug` FK → `briefs(slug)`.
- **PR 4 Task 6 (`notifyMessage`):** use `pushNotification` from `@/lib/notifications` (clerk_user_id-keyed); resolve owner via `briefs.clerk_user_id` lookup. Same pattern as Task 10's `notifyOwner`.
- All future server actions referencing `from storefronts` → `from briefs`.
