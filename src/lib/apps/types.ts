/**
 * Shared types for the Souqna Apps marketplace + plugin runtime.
 *
 * The descriptor lives in `registry.ts`; this module is the single
 * import surface for the data layer (`installed.ts`), the OAuth
 * routes, and the dashboard UI.
 */

export type AppCategory =
  | 'finance'
  | 'marketing'
  | 'analytics'
  | 'media'
  | 'sales'
  | 'support'
  | 'logistics';

/**
 * Authentication style for a plugin. Drives the configure screen and
 * which server route handles install:
 *
 *   - 'oauth'    → /api/apps/oauth/start kicks off a 3-leg OAuth dance
 *   - 'api_key'  → founder pastes a key, validated by the plugin's
 *                  `validateConfig()` before being persisted (encrypted)
 *   - 'none'     → no credentials needed (e.g. open public APIs like
 *                  open.er-api.com used by the Currency Converter)
 */
export type AppAuthKind = 'oauth' | 'api_key' | 'none';

export type AppDescriptor = {
  /** Stable id used as the URL slug + DB key. Never renamed. */
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: AppCategory;
  authKind: AppAuthKind;
  /** When false, the marketplace tile shows "Coming soon" and the
   *  Install button is disabled. v1 ships two `available: true` apps
   *  (Currency Converter + Giphy); the rest are scaffolding. */
  available: boolean;
  /** Friendly vendor name shown on tiles + detail page. We deliberately
   *  do NOT expose upstream service names ("open.er-api.com" etc.) to
   *  founders — the brand experience reads as "by Souqna" or the
   *  partner name only. */
  vendor: string;
  /** Marketing icon glyph (Souqna ◈ etc) — used as a fallback when no
   *  `markSrc` is provided. */
  glyph: string;
  /** Tailwind-compatible css colour for the icon backdrop. Pulls from
   *  Souqna palette tokens. */
  accentVar: string;
  /** Optional path to an SVG/PNG brand mark in /public/apps/<id>/.
   *  When set, marketplace tiles + the detail page render this in
   *  place of the glyph fallback. */
  markSrc?: string;
  /** Optional array of preview screenshots. Rendered as a horizontal
   *  carousel on the app detail page. Use SVG illustrations stored in
   *  /public/apps/<id>/. */
  previews?: { src: string; caption: string }[];
  /** When true, the configure screen shows a Settings panel for the
   *  app (currencies, default, label, position, etc). The plugin owns
   *  the actual UI — this flag just toggles the chrome. */
  customizable?: boolean;
  /** Friendly install copy — replaces all technical jargon (OAuth,
   *  API key, etc.) with marketing language. */
  connectCopy?: {
    /** Headline shown on the install card, e.g. "Connect your account". */
    headline: string;
    /** Body paragraph — short marketing copy, no jargon. */
    body: string;
    /** Label on the primary CTA, e.g. "Install", "Connect WhatsApp". */
    ctaLabel: string;
  };
  /** Where the founder lands when they click Install on an OAuth app.
   *  Plain redirect URL — query string adds &state=… &storefront=…. */
  oauthAuthorizationUrl?: string;
  /** Token exchange endpoint — POSTed to with the auth code. */
  oauthTokenUrl?: string;
  /** Comma-separated scope string for OAuth apps. */
  oauthScope?: string;
  /** External setup/docs links shown when a real provider connection
   *  is unavailable or needs operator configuration. */
  docs?: { label: string; href: string }[];
  /** When true, the Apps page surfaces a "Open in builder" CTA after
   *  install (currently used by Giphy → opens the GIF picker dialog). */
  surfacesInBuilder?: boolean;
  /** Optional list of provider env-var names the plugin needs at
   *  runtime. Surfaced as "Setup required" if any are unset, so we
   *  don't fail silently in the OAuth callback. */
  requiredEnv?: string[];
};
