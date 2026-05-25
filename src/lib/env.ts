import { z } from 'zod';

/**
 * Treat empty strings as missing so optional vars don't bypass `.default()`.
 * Vercel sometimes saves blank values during interactive CLI cancellations.
 *
 * Also trims surrounding whitespace, including the trailing CR/LF that
 * `vercel env pull` on Windows bakes into every value (a known CLI issue
 * that would otherwise corrupt DATABASE_URL, BRIEF_ROOT_DOMAIN, etc).
 */
const clean = (v: string | undefined) => {
  if (!v) return undefined;
  const trimmed = v.replace(/[\s\r\n]+$/u, '').replace(/^[\s\r\n]+/u, '');
  return trimmed || undefined;
};

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('https://souqna.qa'),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_TO: z.string().email().default('support@souqna.qa'),
  CONTACT_FROM: z.string().min(1).default('Souqna Atelier <support@souqna.qa>'),
  DATABASE_URL: z.string().min(1).optional(),
  BRIEF_ROOT_DOMAIN: z.string().min(1).default('souqna.qa'),
  BRIEF_FALLBACK_ROOT_DOMAIN: z.string().min(1).default('souqna.co'),
  SOUQNA_FEATURED_STOREFRONT_SLUGS: z.string().default(''),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  // Signing secret for the Clerk → /api/clerk-webhooks bridge. Pulled from
  // the Clerk Dashboard webhook endpoint. `verifyWebhook()` reads it from
  // the env directly; we declare it here so the schema documents it and
  // local startup warns when it's missing.
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  // Souqna Pulse — personal Mac dashboard for the founder/operator.
  // PULSE_ADMIN_TOKEN authenticates every read against /api/dashboard/*.
  // PULSE_IP_SALT salts hashed visitor IPs so we never store raw addresses.
  PULSE_ADMIN_TOKEN: z.string().min(16).optional(),
  PULSE_IP_SALT: z.string().min(8).optional(),
  // Souqy — paid-tier AI code-emit feature.
  // SOUQY_ADMIN_TOKEN gates the manual `grantAtelierPro` server action
  // until billing (Stripe / Vercel Marketplace) is wired. Operator-only.
  SOUQY_ADMIN_TOKEN: z.string().min(16).optional(),
  // Pre-baked Vercel Sandbox snapshot ID with tsup + the SDK type defs
  // already installed. Without it every Souqy build pays a ~30s cold
  // start. Created once via `scripts/create-souqy-snapshot.ts`.
  SOUQY_BUILD_SNAPSHOT_ID: z.string().min(1).optional(),
  // Cheap tool-only model used by the in-builder Souqy block editor
  // (`src/lib/souqy/editBlock.ts`). Routed through the Vercel AI
  // Gateway like the rest of the Souqy stack — see SDK docs at
  // https://sdk.vercel.ai/providers/ai-sdk-providers — so any
  // `provider/model` slug the gateway supports works here.
  SOUQY_BLOCK_EDIT_MODEL: z.string().min(1).default('google/gemini-2.5-flash-lite'),
  SOUQY_CHAT_MODEL: z.string().min(1).default('google/gemini-2.5-flash-lite'),
  // Souqy Studio — creative asset generation. These are optional at
  // build-time; the Studio actions return a typed configuration error
  // when none are present rather than falling back to fake assets.
  REPLICATE_API_TOKEN: z.string().min(1).optional(),
  IDEOGRAM_API_KEY: z.string().min(1).optional(),
  FAL_KEY: z.string().min(1).optional(),
  // Apps marketplace.
  // APPS_ENCRYPTION_KEY is a 32-byte secret used by AES-256-GCM to
  // encrypt OAuth tokens + API keys at rest. Generate with
  //   `openssl rand -base64 32`. We auto-derive a deterministic dev key
  // from CLERK_SECRET_KEY when it's missing so local builds don't break.
  APPS_ENCRYPTION_KEY: z.string().min(16).optional(),
  MAILCHIMP_CLIENT_ID: z.string().min(1).optional(),
  MAILCHIMP_CLIENT_SECRET: z.string().min(1).optional(),
  KLAVIYO_CLIENT_ID: z.string().min(1).optional(),
  KLAVIYO_CLIENT_SECRET: z.string().min(1).optional(),
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/u)
    .default('v24.0'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(8).optional(),
  SOUQNA_WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  SOUQNA_WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  // Sent.dm — Souqna-owned unified SMS/WhatsApp/RCS templates.
  SENT_API_KEY: z.string().min(1).optional(),
  SENT_TEMPLATE_MARKETING_ID: z
    .string()
    .uuid()
    .default('298977b3-2b1e-417f-b21a-01cb736f7e74'),
  SENT_TEMPLATE_CUSTOMER_CARE_ID: z
    .string()
    .uuid()
    .default('8681a1e0-70af-4960-8874-3668917bfdb6'),
  SENT_TEMPLATE_FRAUD_ALERT_ID: z
    .string()
    .uuid()
    .default('8f800498-7173-4385-b6ba-dc3947e6ba7d'),
  SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID: z
    .string()
    .uuid()
    .default('0507e170-a5f5-4cdd-8762-5da349c2851b'),
  SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID: z
    .string()
    .uuid()
    .default('46ce102a-e54d-4ce0-a177-683133b0c551'),
  SENT_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  GIPHY_API_KEY: z.string().min(1).optional(),
  // XAPI — server-only market and social research feed for Souqy. Kept
  // behind src/lib/xapi so vendor-specific action IDs do not
  // leak into actions or generated storefront code.
  XAPI_KEY: z.string().min(1).optional(),
  XAPI_ACTION_HOST: z.string().url().default('https://action.xapi.to'),
  // Souqna mobile companion push notifications. Optional unless Expo
  // push security is enabled in EAS; when present it is sent as the
  // bearer token to Expo's push API.
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  // The AI SDK reads VERCEL_OIDC_TOKEN automatically (auto-refreshed on
  // Vercel). Locally `vercel env pull` populates it. We don't validate
  // it in our env schema because the @ai-sdk/gateway package owns the
  // auth lifecycle entirely.
  //
  // ── Observability ─────────────────────────────────────────────────
  // Sentry. `SENTRY_DSN` is the server/edge ingest URL; the public DSN
  // exposed to the browser bundle is `NEXT_PUBLIC_SENTRY_DSN` (often the
  // same value, but split so we can rotate independently). The remaining
  // three are only consumed by `withSentryConfig` at build time to
  // upload sourcemaps from CI.
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  // Postmark — second transactional provider behind `src/lib/mailer.ts`.
  // Optional `POSTMARK_MESSAGE_STREAM` overrides the default `outbound`
  // stream (useful when separating broadcast vs transactional mail).
  POSTMARK_API_TOKEN: z.string().min(1).optional(),
  POSTMARK_MESSAGE_STREAM: z.string().min(1).optional(),
  // `auto` (default) picks Postmark when configured, otherwise Resend.
  MAILER_PROVIDER: z.enum(['postmark', 'resend', 'auto']).optional(),
  // PostHog product analytics. Public key is fine in the browser
  // bundle. `POSTHOG_API_KEY` is the optional server-only override
  // (defaults to the public key when unset).
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  POSTHOG_API_KEY: z.string().min(1).optional(),
  // ── Stripe billing (self-serve checkout + webhook) ────────────────
  // `STRIPE_SECRET_KEY` is the server-only API key (sk_live_… / sk_test_…).
  // `STRIPE_WEBHOOK_SECRET` is the signing secret for the
  // `/api/billing/webhook` endpoint, copied from the Stripe Dashboard
  // when the webhook is created. Without these, `startCheckout` returns
  // a typed error and the webhook 503s — gating logic still works.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Stripe Price IDs — six SKUs (paid plan × billing cycle). Created in
  // the Stripe Dashboard against three Products (Pro / Pro+ / Max+),
  // each with a recurring monthly QAR price and a recurring annual QAR
  // price. The numeric amounts stay the source of truth in
  // `src/lib/plans.ts`; these env vars only point Stripe Checkout at
  // the matching SKU.
  STRIPE_PRICE_STARTER_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_STARTER_ANNUAL: z.string().min(1).optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1).optional(),
  STRIPE_PRICE_ATELIER_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_ATELIER_ANNUAL: z.string().min(1).optional(),
  // ── Billing: SkipCash (active provider) ──────────────────────────
  // SkipCash hosted payment links for the three paid plans. Credentials
  // stay server-only; the browser only receives the returned payUrl.
  BILLING_PROVIDER: z.enum(['skipcash', 'stripe']).default('skipcash'),
  SKIPCASH_ENV: z.enum(['live', 'sandbox']).default('sandbox'),
  SKIPCASH_CLIENT_ID: z.string().min(1).optional(),
  SKIPCASH_KEY_ID: z.string().min(1).optional(),
  SKIPCASH_KEY_SECRET: z.string().min(1).optional(),
  SKIPCASH_WEBHOOK_KEY: z.string().min(1).optional(),
  SKIPCASH_DEFAULT_PHONE: z.string().min(1).optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SITE_URL: clean(process.env.NEXT_PUBLIC_SITE_URL),
  RESEND_API_KEY: clean(process.env.RESEND_API_KEY),
  CONTACT_TO: clean(process.env.CONTACT_TO),
  CONTACT_FROM: clean(process.env.CONTACT_FROM),
  DATABASE_URL: clean(process.env.DATABASE_URL),
  BRIEF_ROOT_DOMAIN: clean(process.env.BRIEF_ROOT_DOMAIN),
  BRIEF_FALLBACK_ROOT_DOMAIN: clean(process.env.BRIEF_FALLBACK_ROOT_DOMAIN),
  SOUQNA_FEATURED_STOREFRONT_SLUGS: clean(process.env.SOUQNA_FEATURED_STOREFRONT_SLUGS),
  BLOB_READ_WRITE_TOKEN: clean(process.env.BLOB_READ_WRITE_TOKEN),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  CLERK_SECRET_KEY: clean(process.env.CLERK_SECRET_KEY),
  CLERK_WEBHOOK_SIGNING_SECRET: clean(process.env.CLERK_WEBHOOK_SIGNING_SECRET),
  PULSE_ADMIN_TOKEN: clean(process.env.PULSE_ADMIN_TOKEN),
  PULSE_IP_SALT: clean(process.env.PULSE_IP_SALT),
  SOUQY_ADMIN_TOKEN: clean(process.env.SOUQY_ADMIN_TOKEN),
  SOUQY_BUILD_SNAPSHOT_ID: clean(process.env.SOUQY_BUILD_SNAPSHOT_ID),
  SOUQY_BLOCK_EDIT_MODEL: clean(process.env.SOUQY_BLOCK_EDIT_MODEL),
  SOUQY_CHAT_MODEL: clean(process.env.SOUQY_CHAT_MODEL),
  REPLICATE_API_TOKEN: clean(process.env.REPLICATE_API_TOKEN),
  IDEOGRAM_API_KEY: clean(process.env.IDEOGRAM_API_KEY),
  FAL_KEY: clean(process.env.FAL_KEY),
  APPS_ENCRYPTION_KEY: clean(process.env.APPS_ENCRYPTION_KEY),
  MAILCHIMP_CLIENT_ID: clean(process.env.MAILCHIMP_CLIENT_ID),
  MAILCHIMP_CLIENT_SECRET: clean(process.env.MAILCHIMP_CLIENT_SECRET),
  KLAVIYO_CLIENT_ID: clean(process.env.KLAVIYO_CLIENT_ID),
  KLAVIYO_CLIENT_SECRET: clean(process.env.KLAVIYO_CLIENT_SECRET),
  META_APP_ID: clean(process.env.META_APP_ID),
  META_APP_SECRET: clean(process.env.META_APP_SECRET),
  META_GRAPH_VERSION: clean(process.env.META_GRAPH_VERSION),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: clean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  SOUQNA_WHATSAPP_PHONE_NUMBER_ID: clean(process.env.SOUQNA_WHATSAPP_PHONE_NUMBER_ID),
  SOUQNA_WHATSAPP_ACCESS_TOKEN: clean(process.env.SOUQNA_WHATSAPP_ACCESS_TOKEN),
  SENT_API_KEY: clean(process.env.SENT_API_KEY),
  SENT_TEMPLATE_MARKETING_ID: clean(process.env.SENT_TEMPLATE_MARKETING_ID),
  SENT_TEMPLATE_CUSTOMER_CARE_ID: clean(process.env.SENT_TEMPLATE_CUSTOMER_CARE_ID),
  SENT_TEMPLATE_FRAUD_ALERT_ID: clean(process.env.SENT_TEMPLATE_FRAUD_ALERT_ID),
  SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID: clean(process.env.SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID),
  SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID: clean(process.env.SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID),
  SENT_WEBHOOK_SIGNING_SECRET: clean(process.env.SENT_WEBHOOK_SIGNING_SECRET),
  GIPHY_API_KEY: clean(process.env.GIPHY_API_KEY),
  XAPI_KEY: clean(process.env.XAPI_KEY),
  XAPI_ACTION_HOST: clean(process.env.XAPI_ACTION_HOST),
  EXPO_ACCESS_TOKEN: clean(process.env.EXPO_ACCESS_TOKEN),
  SENTRY_DSN: clean(process.env.SENTRY_DSN),
  NEXT_PUBLIC_SENTRY_DSN: clean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  SENTRY_ORG: clean(process.env.SENTRY_ORG),
  SENTRY_PROJECT: clean(process.env.SENTRY_PROJECT),
  SENTRY_AUTH_TOKEN: clean(process.env.SENTRY_AUTH_TOKEN),
  POSTMARK_API_TOKEN: clean(process.env.POSTMARK_API_TOKEN),
  POSTMARK_MESSAGE_STREAM: clean(process.env.POSTMARK_MESSAGE_STREAM),
  MAILER_PROVIDER: clean(process.env.MAILER_PROVIDER) as 'postmark' | 'resend' | 'auto' | undefined,
  NEXT_PUBLIC_POSTHOG_KEY: clean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  NEXT_PUBLIC_POSTHOG_HOST: clean(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  POSTHOG_API_KEY: clean(process.env.POSTHOG_API_KEY),
  STRIPE_SECRET_KEY: clean(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: clean(process.env.STRIPE_WEBHOOK_SECRET),
  STRIPE_PRICE_STARTER_MONTHLY: clean(process.env.STRIPE_PRICE_STARTER_MONTHLY),
  STRIPE_PRICE_STARTER_ANNUAL: clean(process.env.STRIPE_PRICE_STARTER_ANNUAL),
  STRIPE_PRICE_PRO_MONTHLY: clean(process.env.STRIPE_PRICE_PRO_MONTHLY),
  STRIPE_PRICE_PRO_ANNUAL: clean(process.env.STRIPE_PRICE_PRO_ANNUAL),
  STRIPE_PRICE_ATELIER_MONTHLY: clean(process.env.STRIPE_PRICE_ATELIER_MONTHLY),
  STRIPE_PRICE_ATELIER_ANNUAL: clean(process.env.STRIPE_PRICE_ATELIER_ANNUAL),
  BILLING_PROVIDER: clean(process.env.BILLING_PROVIDER) as 'skipcash' | 'stripe' | undefined,
  SKIPCASH_ENV: clean(process.env.SKIPCASH_ENV) as 'live' | 'sandbox' | undefined,
  SKIPCASH_CLIENT_ID: clean(process.env.SKIPCASH_CLIENT_ID),
  SKIPCASH_KEY_ID: clean(process.env.SKIPCASH_KEY_ID),
  SKIPCASH_KEY_SECRET: clean(process.env.SKIPCASH_KEY_SECRET),
  SKIPCASH_WEBHOOK_KEY: clean(process.env.SKIPCASH_WEBHOOK_KEY),
  SKIPCASH_DEFAULT_PHONE: clean(process.env.SKIPCASH_DEFAULT_PHONE),
});

if (!parsed.success) {
  console.warn('[env] invalid environment variables', parsed.error.flatten().fieldErrors);
}

export const env = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_SITE_URL: 'https://souqna.qa',
      RESEND_API_KEY: undefined as string | undefined,
      CONTACT_TO: 'support@souqna.qa',
      CONTACT_FROM: 'Souqna Atelier <support@souqna.qa>',
      DATABASE_URL: undefined as string | undefined,
      BRIEF_ROOT_DOMAIN: 'souqna.qa',
      BRIEF_FALLBACK_ROOT_DOMAIN: 'souqna.co',
      SOUQNA_FEATURED_STOREFRONT_SLUGS: '',
      BLOB_READ_WRITE_TOKEN: undefined as string | undefined,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined as string | undefined,
      CLERK_SECRET_KEY: undefined as string | undefined,
      CLERK_WEBHOOK_SIGNING_SECRET: undefined as string | undefined,
      PULSE_ADMIN_TOKEN: undefined as string | undefined,
      PULSE_IP_SALT: undefined as string | undefined,
      SOUQY_ADMIN_TOKEN: undefined as string | undefined,
      SOUQY_BUILD_SNAPSHOT_ID: undefined as string | undefined,
      SOUQY_BLOCK_EDIT_MODEL: 'google/gemini-2.5-flash-lite',
      SOUQY_CHAT_MODEL: 'google/gemini-2.5-flash-lite',
      REPLICATE_API_TOKEN: undefined as string | undefined,
      IDEOGRAM_API_KEY: undefined as string | undefined,
      FAL_KEY: undefined as string | undefined,
      APPS_ENCRYPTION_KEY: undefined as string | undefined,
      MAILCHIMP_CLIENT_ID: undefined as string | undefined,
      MAILCHIMP_CLIENT_SECRET: undefined as string | undefined,
      KLAVIYO_CLIENT_ID: undefined as string | undefined,
      KLAVIYO_CLIENT_SECRET: undefined as string | undefined,
      META_APP_ID: undefined as string | undefined,
      META_APP_SECRET: undefined as string | undefined,
      META_GRAPH_VERSION: 'v24.0',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined as string | undefined,
      SOUQNA_WHATSAPP_PHONE_NUMBER_ID: undefined as string | undefined,
      SOUQNA_WHATSAPP_ACCESS_TOKEN: undefined as string | undefined,
      SENT_API_KEY: undefined as string | undefined,
      SENT_TEMPLATE_MARKETING_ID: '298977b3-2b1e-417f-b21a-01cb736f7e74',
      SENT_TEMPLATE_CUSTOMER_CARE_ID: '8681a1e0-70af-4960-8874-3668917bfdb6',
      SENT_TEMPLATE_FRAUD_ALERT_ID: '8f800498-7173-4385-b6ba-dc3947e6ba7d',
      SENT_TEMPLATE_DELIVERY_NOTIFICATION_ID: '0507e170-a5f5-4cdd-8762-5da349c2851b',
      SENT_TEMPLATE_ACCOUNT_NOTIFICATION_ID: '46ce102a-e54d-4ce0-a177-683133b0c551',
      SENT_WEBHOOK_SIGNING_SECRET: undefined as string | undefined,
      GIPHY_API_KEY: undefined as string | undefined,
      XAPI_KEY: undefined as string | undefined,
      XAPI_ACTION_HOST: 'https://action.xapi.to',
      EXPO_ACCESS_TOKEN: undefined as string | undefined,
      SENTRY_DSN: undefined as string | undefined,
      NEXT_PUBLIC_SENTRY_DSN: undefined as string | undefined,
      SENTRY_ORG: undefined as string | undefined,
      SENTRY_PROJECT: undefined as string | undefined,
      SENTRY_AUTH_TOKEN: undefined as string | undefined,
      POSTMARK_API_TOKEN: undefined as string | undefined,
      POSTMARK_MESSAGE_STREAM: undefined as string | undefined,
      MAILER_PROVIDER: undefined as 'postmark' | 'resend' | 'auto' | undefined,
      NEXT_PUBLIC_POSTHOG_KEY: undefined as string | undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined as string | undefined,
      POSTHOG_API_KEY: undefined as string | undefined,
      STRIPE_SECRET_KEY: undefined as string | undefined,
      STRIPE_WEBHOOK_SECRET: undefined as string | undefined,
      STRIPE_PRICE_STARTER_MONTHLY: undefined as string | undefined,
      STRIPE_PRICE_STARTER_ANNUAL: undefined as string | undefined,
      STRIPE_PRICE_PRO_MONTHLY: undefined as string | undefined,
      STRIPE_PRICE_PRO_ANNUAL: undefined as string | undefined,
      STRIPE_PRICE_ATELIER_MONTHLY: undefined as string | undefined,
      STRIPE_PRICE_ATELIER_ANNUAL: undefined as string | undefined,
      BILLING_PROVIDER: 'skipcash' as 'skipcash' | 'stripe',
      SKIPCASH_ENV: 'sandbox' as 'live' | 'sandbox',
      SKIPCASH_CLIENT_ID: undefined as string | undefined,
      SKIPCASH_KEY_ID: undefined as string | undefined,
      SKIPCASH_KEY_SECRET: undefined as string | undefined,
      SKIPCASH_WEBHOOK_KEY: undefined as string | undefined,
      SKIPCASH_DEFAULT_PHONE: undefined as string | undefined,
    };
