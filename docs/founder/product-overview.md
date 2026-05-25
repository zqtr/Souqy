# Souqna product overview

**Audience:** founder · **Arabic:** [product-overview.ar.md](product-overview.ar.md)

Souqna is a bilingual storefront platform. Each **storefront** (historically backed by the `briefs` row) has its own locale, theme, catalogue, pages, and **installed apps**. Founders work mostly in the authenticated **account** area; buyers see the **public storefront** on the brief route pattern.

## Marketing homepage

The localized apex routes (`/` for default English, `/ar` for Arabic) render through `src/app/[locale]/page.tsx` → [`SouqnaHomeExperience`](../../src/components/souqna/SouqnaHomeExperience.tsx). The home route owns its own header/footer and hides the shared public chrome; docs, journal, policy, and other editorial routes continue through the shared public layout unless they intentionally opt into a full-route composition.

The current homepage design is intentionally grayscale and cream: black `#0A0A0A`, charcoal `#2A2A2A`, cream `#E8DCC4`, quiet border `#D1C7B2`, pale text `#F7F7F3`, and white `#FFFFFF`. Avoid orange, purple, neon gradients, and generic blue SaaS accents on this route.

Typography is part of the product identity: Exo 2 for English UI/body/headlines, Thmanyah Serif Display Bold for Arabic display headings, Thmanyah Sans or Thmanyah Serif Text for Arabic UI/body, and JetBrains Mono for small meta labels. Arabic headings should use the Thmanyah serif display variable so `/ar` keeps the same brand voice as `/`.

The current public composition is: a living halftone hero, capsule navigation, monochrome integration-logo marquees, onboarding/how-to sections, account/workspace proof, founder journal cards, plans, contact, and the ReactBits footer. Keep motion controlled and provide a static fallback through `prefers-reduced-motion`.

## Storefront rendering pipeline

The [`Storefront`](../../src/components/storefront/Storefront.tsx) dispatcher chooses among:

1. **Souqy** — If the storefront has a published Souqy revision **and** the caller did not pass draft `overrideBlocks` (dashboard preview always passes overrides), the AI-generated bundle wins over the JSON block tree.
2. **Block pipeline** — When `published_blocks` (or preview `override_blocks`) is non-empty, blocks render through [`BlockRenderer`](../../src/components/storefront/BlockRenderer.tsx) with shared context (palette, RTL, products).
3. **Legacy templates** — If there are no blocks yet, archetype templates ([`Menu`](../../src/components/storefront/templates/Menu.tsx), Lookbook, etc.) keep older storefronts rendering until the founder publishes from the builder.

Fallback: if Souqy fails to load at runtime, the pipeline can degrade to `published_blocks` (see comments in `Storefront.tsx`).

## Builder and publish flow

- **Editor:** [`/account/builder`](../../src/app/account/builder/page.tsx) loads [`BuilderShell`](../../src/components/builder/BuilderShell.tsx): block library, outline, inspector, and an iframe hitting [`/account/[slug]/preview`](../../src/app/account/[slug]/preview/page.tsx) for draft-accurate preview.
- **Persistence:** Draft blocks live per page in `storefront_pages`; publishing promotes draft to published where applicable (see builder actions under `src/app/actions/builder.ts`).
- **Templates:** Initial layouts come from template presets ([`src/lib/templates.ts`](../../src/lib/templates.ts)) and `bootBlocksFromStorefront`; founders can swap presets from the Site inspector within plan limits ([`src/lib/plans.ts`](../../src/lib/plans.ts)).

## Apps marketplace

- **Registry:** [`APP_REGISTRY`](../../src/lib/apps/registry.ts) lists OAuth-capable marketplace tiles only. Installs are **per storefront slug** (`installed_apps` table via [`src/lib/apps/installed.ts`](../../src/lib/apps/installed.ts)).
- **Surfaces:** OAuth apps may add storefront scripts, dashboard configuration, server-side sync, or checkout behavior depending on the provider. See [integration-matrix.md](integration-matrix.md).
- **Growth:** New integrations follow [extending-integrations.md](extending-integrations.md).

## Souqy

**Souqy** generates a validated multi-file storefront artifact through the AI Gateway ([`src/lib/souqy/generate.ts`](../../src/lib/souqy/generate.ts)); reprompts for iterative edits use the same pipeline with a diff-oriented prompt. Dashboard orchestration lives in [`src/app/actions/souqy.ts`](../../src/app/actions/souqy.ts). Optional screenshot capture is gated by env (see `src/lib/souqy/screenshot.ts`).

Souqy is intentionally **downstream** of billing/plan checks where those gates exist in actions — do not bypass plan enforcement when wiring new entry points.

## Plans and billing

Plan tiers and feature limits are defined in [`src/lib/plans.ts`](../../src/lib/plans.ts); subscription / marketplace billing integration is in [`src/lib/billing.ts`](../../src/lib/billing.ts) and related dashboard UI. The public pricing surface currently shows Free, Pro `QR 49/mo`, Pro+ `QR 145/mo`, and Max+ `QR 235/mo`. Treat `src/lib/plans.ts` as source of truth and update the docs and homepage together when prices or labels change.

## Related docs

- [integration-matrix.md](integration-matrix.md)
- [extending-integrations.md](extending-integrations.md)
- [AGENTS.md](../../AGENTS.md)
