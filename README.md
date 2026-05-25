# Souqna

**Audience:** developers · **Arabic:** [README.ar.md](README.ar.md)

Souqna is a bilingual (English / Arabic, full RTL) commerce and storefront platform for founders: authenticated dashboard, visual page builder, product and order flows, plans and billing, and a **per-storefront Apps marketplace**. Public storefronts resolve under the brief subdomain pattern; optional **Souqy** publishes an AI-generated bundle when a storefront has a Souqy revision.

## Stack

- **Next.js 14** (App Router), TypeScript, Tailwind v4, **next-intl** (`en` / `ar`)
- **Clerk** authentication
- **Neon Postgres** via `@neondatabase/serverless` (tagged template SQL only)
- **Vercel Blob** storage
- **Vercel AI SDK** + AI Gateway (gateway auth on Vercel; `AI_GATEWAY_API_KEY` locally)
- **Postmark** (transactional) + **Resend** (legacy / marketing) behind `src/lib/mailer.ts`
- **Sentry**, **PostHog**, **Vercel Analytics**

Detailed conventions for contributors: [AGENTS.md](AGENTS.md).

## Where things live

| Area | Path |
|------|------|
| Routing, auth gate, subdomain rewrite | `src/middleware.ts` |
| Environment schema | `src/lib/env.ts` |
| Apps marketplace descriptors | `src/lib/apps/registry.ts` |
| Souqy generation / validation | `src/lib/souqy/` |
| Souqy server actions | `src/app/actions/souqy.ts` |
| Builder UI | `src/components/builder/BuilderShell.tsx`, `src/app/account/builder/page.tsx` |
| Live storefront | `src/app/brief/[slug]/[[...path]]/page.tsx` |
| Draft preview (builder iframe) | `src/app/account/[slug]/preview/page.tsx` |
| Marketing home (`/`, `/ar`, …) | `src/app/[locale]/page.tsx`, `src/components/souqna/SouqnaHomeExperience.tsx`, route-owned header and footer |

The public home, docs, legal, journal, and Markdown-backed product notes share the current Souqna editorial system:

- **Palette:** black `#0A0A0A`, charcoal `#2A2A2A`, cream `#E8DCC4`, quiet border `#D1C7B2`, pale text `#F7F7F3`, white `#FFFFFF`.
- **Typography:** Exo 2 for English UI/body/headlines, Thmanyah Serif Display Bold for Arabic headlines, Thmanyah Sans or Thmanyah Serif Text for Arabic UI/body, and JetBrains Mono for small operational labels.
- **Homepage language:** grayscale/cream halftone hero, centered capsule navigation, monochrome SVG integration marquees, thin grid lines, restrained cards, and no orange/purple/blue SaaS accents.
- **Plans:** Free, Pro `QR 49/mo`, Pro+ `QR 145/mo`, Max+ `QR 235/mo`; keep all plan copy aligned with `src/lib/plans.ts` and the homepage `#plans` section.

Founder-facing narrative and integration inventory: [docs/README.md](docs/README.md).

## Local development

1. Create `.env.local` from your private secret manager and fill the values required by `src/lib/env.ts`.
2. Install dependencies and run the dev server (`npm install`, `npm run dev`).
3. Production builds run `node scripts/migrate.mjs` before `next build`; ensure DB credentials allow migrations when testing builds locally.

If the dev server throws `Cannot find module './vendor-chunks/@vercel.js'` (or other missing files under `.next/server/vendor-chunks/`), stop the server, run `rm -rf .next`, and start `npm run dev` again — the output directory was partial or stale.

## Related repo apps

**CranL Runtime** - standalone Node.js worker/API service for Souqy Studio AI workloads and background generation tasks. It lives at [apps/cranl-runtime](apps/cranl-runtime/README.md) and deploys separately from the Vercel frontend.

### CranL deployment settings

- Repository: Souqna monorepo
- Build Path: `/apps/cranl-runtime`
- Build Type: Dockerfile
- Port: `3000`

**Souqna Pulse** — optional macOS companion that streams dashboard events. See [apps/pulse/README.md](apps/pulse/README.md). Uses `PULSE_ADMIN_TOKEN` from env (see `src/lib/env.ts`).
