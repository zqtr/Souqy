# Souqna — agent instructions

Context for AI code reviewers (Vercel Agent, Cursor, Copilot review). Keep
this short; treat it as a contract, not a spec.

## Stack

- Next.js 14 App Router · TypeScript · Tailwind v4 · `next-intl` (ar/en).
- Auth: Clerk (`@clerk/nextjs`).
- DB: Neon Postgres via `@neondatabase/serverless` (tagged template SQL).
- Storage: Vercel Blob.
- AI: Vercel AI SDK + AI Gateway (OIDC on Vercel; `AI_GATEWAY_API_KEY` locally).
- Email: Postmark (transactional) + Resend (legacy / marketing) — both behind `src/lib/mailer.ts`.
- Errors: Sentry (`@sentry/nextjs`, instrumentation hook).
- Product analytics: PostHog (`posthog-js` + `posthog-node`).
- Web analytics: Vercel Analytics.

## Conventions

- All env access goes through `src/lib/env.ts`. Add new keys to the zod
  schema + `.env.local.example` in the same PR.
- Server actions live in `src/app/actions/*` and must validate input with
  zod, check Clerk auth, then assert storefront ownership via
  `assertStorefrontOwner` before touching the DB.
- Never log PII or full request bodies. Audit-worthy actions go through
  `recordAudit({ action, summary, meta })`.
- Don't add `// step 1`, `// import …` style narration comments. Comments
  explain *why*, never *what*.
- RTL support is non-negotiable — anything new must render correctly in
  Arabic. Prefer logical CSS properties (`margin-inline-start` over
  `margin-left`).
- Middleware order matters: subdomain rewrite → legacy redirects → Clerk
  protect → next-intl. Don't reorder without reading `src/middleware.ts`.

## Don't do

- Don't introduce new ORMs (no Prisma, no Drizzle). Stick to tagged SQL.
- Don't add a third email provider — extend `src/lib/mailer.ts` instead.
- Don't disable Sentry sourcemap upload to silence build warnings.
- Don't ship `console.log` calls outside of `scripts/`.
- Don't bypass `Suspense` around `useSearchParams()` — App Router will
  bail out static rendering otherwise.

## Useful entry points

- `src/middleware.ts` — routing, auth gate, subdomain logic.
- `src/lib/env.ts` — every env var, validated.
- `src/lib/mailer.ts` — unified Postmark/Resend send.
- `src/lib/posthog.ts` — server-side PostHog client.
- `src/instrumentation.ts` + `sentry.*.config.ts` — observability boot.
- `src/app/layout.tsx` — Clerk + PostHog + Vercel Analytics providers.

## Product surfaces

- **Marketing / apex home** — `src/app/[locale]/page.tsx` via [`SouqnaHomeExperience`](src/components/souqna/SouqnaHomeExperience.tsx); the route owns its own header/footer and hides the shared public chrome. Longer-form editorial pages still use shared public chrome unless the route intentionally owns the full layout.
- **Homepage design system** — use black `#0A0A0A`, charcoal `#2A2A2A`, cream `#E8DCC4`, quiet border `#D1C7B2`, pale text `#F7F7F3`, and white `#FFFFFF`. Avoid orange, purple, and generic blue SaaS accents on public Souqna surfaces unless the user explicitly asks for a temporary experiment.
- **Editorial typography** — use Exo 2 for English UI/body/headlines, Thmanyah Serif Display Bold for Arabic display headings, Thmanyah Sans or Thmanyah Serif Text for Arabic UI/body, and JetBrains Mono for labels. Arabic headings should use the Thmanyah serif display variable, not a generic Arabic fallback.
- **Homepage motion** — the hero is a living grayscale/cream halftone field; integration rows use monochrome SVG marquees; text animation should be subtle and respect `prefers-reduced-motion`.
- **Account / dashboard chrome** — `/account/*` routes under the `(chrome)` layout; products, orders, settings, Apps marketplace.
- **Builder** — `/account/builder` full-bleed editor ([`src/app/account/builder/page.tsx`](src/app/account/builder/page.tsx), [`src/components/builder/BuilderShell.tsx`](src/components/builder/BuilderShell.tsx)); draft preview loads in an iframe from `/account/[slug]/preview`.
- **Public storefront** — `/brief/[slug]` (and paths) for the live buyer-facing site.
- Narrative docs for founders: [`docs/founder/product-overview.md`](docs/founder/product-overview.md).

## Plugins & Souqy

- **Marketplace** — descriptors in [`src/lib/apps/registry.ts`](src/lib/apps/registry.ts); installs in [`src/lib/apps/installed.ts`](src/lib/apps/installed.ts); snippet-style scripts via [`src/components/storefront/AppScripts.tsx`](src/components/storefront/AppScripts.tsx); per-app HTTP under `src/app/api/apps/**`; shared actions in [`src/app/actions/apps.ts`](src/app/actions/apps.ts). Integration matrix: [`docs/founder/integration-matrix.md`](docs/founder/integration-matrix.md). Extension checklist: [`docs/founder/extending-integrations.md`](docs/founder/extending-integrations.md).
- **Souqy** — model pipeline in [`src/lib/souqy/generate.ts`](src/lib/souqy/generate.ts) (plus `validate`, `build`, `load`, `prompt` in the same folder); dashboard actions in [`src/app/actions/souqy.ts`](src/app/actions/souqy.ts). When a storefront has a published Souqy revision and the route is not passing draft `overrideBlocks`, the storefront prefers Souqy over the JSON block pipeline ([`src/components/storefront/Storefront.tsx`](src/components/storefront/Storefront.tsx)).
