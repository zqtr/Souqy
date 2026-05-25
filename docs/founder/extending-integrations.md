# Extending integrations

**Audience:** founder · **Arabic:** [extending-integrations.ar.md](extending-integrations.ar.md)

Use this as a checklist when adding a **new** marketplace app or extending an existing one. Platform-wide behavior (install lifecycle, dispatcher ordering) may need review by the plugin-platform owner; per-app behavior is owned by the integrations track.

## Agent roles

- **[`.cursor/agents/integrations-engineer.md`](../../.cursor/agents/integrations-engineer.md)** — single-app implementation: `src/lib/apps/<id>.ts`, registry row, actions, `src/app/api/apps/**`, `public/apps/<id>/`.
- **[`.cursor/agents/plugin-platform-architect.md`](../../.cursor/agents/plugin-platform-architect.md)** — cross-cutting install/dispatch/registry semantics.

## Checklist

1. **Descriptor** — Add or update an OAuth-capable entry in [`APP_REGISTRY`](../../src/lib/apps/registry.ts): `id`, `name`, `vendor`, `tagline`, `description`, `category`, `authKind: 'oauth'`, `available`, `connectCopy`, `requiredEnv`, OAuth URLs/scopes, previews/mark assets.
2. **Persistence** — Use existing `installed_apps` / `app_state` patterns ([`src/lib/apps/installed.ts`](../../src/lib/apps/installed.ts)); avoid ad-hoc tables unless migrations are explicitly approved.
3. **Server actions** — Validate with zod, Clerk auth, `assertStorefrontOwner`; implement in [`src/app/actions/apps.ts`](../../src/app/actions/apps.ts) or a focused `src/app/actions/<app>.ts` if size warrants.
4. **HTTP surface** — Prefer `src/app/api/apps/<id>/…` for proxies or webhooks; enforce storefront ownership or signed secrets as appropriate.
5. **Storefront** — If an OAuth provider requires buyer-facing scripts or widgets, extend [`AppScripts.tsx`](../../src/components/storefront/AppScripts.tsx) or mount a dedicated client island from [`Storefront.tsx`](../../src/components/storefront/Storefront.tsx).
6. **OAuth** — Implement real provider start/callback, state verification, token exchange, encrypted token persistence, refresh handling, and provider account metadata before setting `available: true`.
7. **Assets** — Brand marks under `public/apps/<id>/`; keep marketplace copy free of raw OAuth/API jargon (use `connectCopy`).
8. **Env** — New secrets must flow through [`src/lib/env.ts`](../../src/lib/env.ts) and `.env.local.example`.
9. **Docs drift** — Update [integration-matrix.md](integration-matrix.md) and audit [`DocsContent.tsx`](../../src/app/[locale]/docs/DocsContent.tsx).

## Visual rules for integration surfaces

Homepage ecosystem chips and marketplace tiles must inherit the Souqna homepage system: charcoal `#2A2A2A`, black `#0A0A0A`, cream `#E8DCC4`, quiet borders, pale marks, and monochrome SVGs. Do not paste full-color vendor marks into the homepage marquee; convert them to `currentColor` or render them through a mask so dark/light mode stays consistent.

The homepage marquee can mention recognizable infrastructure and channel partners as a product story. The authenticated Apps marketplace should only expose providers with real install/config flows and `available: true`.

## Souqy

Souqy is **not** an Apps marketplace plugin; it lives under [`src/lib/souqy/`](../../src/lib/souqy/) and [`src/app/actions/souqy.ts`](../../src/app/actions/souqy.ts). Template changes and AI prompts follow the builder/Souqy track, not this checklist.

## Related

- [integration-matrix.md](integration-matrix.md)
- [product-overview.md](product-overview.md)
