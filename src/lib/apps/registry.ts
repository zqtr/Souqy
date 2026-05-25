import type { AppDescriptor } from './types';

/**
 * Single source of truth for every plugin Souqna lists in Souqna
 * Marketplace. Marketplace entries are limited to integrations that
 * support account-based OAuth connection flows.
 */
export const APP_REGISTRY: AppDescriptor[] = [
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    vendor: 'by Klaviyo',
    tagline: 'High-deliverability flows for serious brands',
    description:
      'Push customers + orders to Klaviyo for SMS + email automation. Better suited to higher-volume founders.',
    category: 'marketing',
    authKind: 'oauth',
    available: true,
    glyph: 'K',
    accentVar: '--color-maroon',
    markSrc: '/apps/klaviyo/mark.svg',
    oauthAuthorizationUrl: 'https://www.klaviyo.com/oauth/authorize',
    oauthTokenUrl: 'https://a.klaviyo.com/oauth/token',
    oauthScope: 'accounts:read profiles:read profiles:write events:read events:write',
    requiredEnv: ['KLAVIYO_CLIENT_ID', 'KLAVIYO_CLIENT_SECRET'],
    docs: [
      {
        label: 'Klaviyo OAuth setup',
        href: 'https://developers.klaviyo.com/en/docs/set_up_oauth',
      },
      {
        label: 'Klaviyo OAuth flow handling',
        href: 'https://developers.klaviyo.com/en/docs/handle_your_apps_oauth_flow',
      },
    ],
    connectCopy: {
      headline: 'Connect your Klaviyo account',
      body: 'One-tap sign-in. We will keep your list and order data in sync.',
      ctaLabel: 'Connect Klaviyo',
    },
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    vendor: 'by Meta',
    tagline: 'Convert inquiries into chats with one tap',
    description:
      'Connect a WhatsApp Business number. The Inquire button opens a pre-filled WhatsApp thread, and inbound messages can be logged as inquiries.',
    category: 'sales',
    authKind: 'oauth',
    available: true,
    glyph: 'W',
    accentVar: '--color-gold-deep',
    markSrc: '/apps/whatsapp-business/mark.svg',
    oauthAuthorizationUrl: 'https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth',
    oauthTokenUrl: 'https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token',
    oauthScope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    docs: [
      {
        label: 'Meta WhatsApp Embedded Signup',
        href: 'https://developers.facebook.com/docs/whatsapp/embedded-signup/',
      },
      {
        label: 'Meta Graph API',
        href: 'https://developers.facebook.com/docs/graph-api/',
      },
    ],
    connectCopy: {
      headline: 'Connect your WhatsApp Business',
      body: 'One-tap sign-in with Meta. Souqna routes inquiries to the number you choose.',
      ctaLabel: 'Connect WhatsApp',
    },
  },
  {
    id: 'instagram-shop',
    name: 'Instagram Shop',
    vendor: 'by Meta',
    tagline: 'Tag products in your IG posts and reels',
    description:
      'Push your product catalogue to Meta Commerce so you can tag them in Instagram posts, reels, and stories.',
    category: 'sales',
    authKind: 'oauth',
    available: true,
    glyph: 'IG',
    accentVar: '--color-maroon',
    markSrc: '/apps/instagram-shop/mark.svg',
    oauthAuthorizationUrl: 'https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth',
    oauthTokenUrl: 'https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token',
    oauthScope: 'business_management,catalog_management,instagram_basic,pages_show_list',
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    docs: [
      {
        label: 'Meta Commerce Catalog API',
        href: 'https://developers.facebook.com/docs/marketing-api/catalog-reference/',
      },
      {
        label: 'Meta Graph API',
        href: 'https://developers.facebook.com/docs/graph-api/',
      },
    ],
    connectCopy: {
      headline: 'Connect your Instagram',
      body: 'One-tap sign-in with Meta. We will mirror your products to your Instagram Shop.',
      ctaLabel: 'Connect Instagram',
    },
  },
  {
    id: 'tap-payments',
    name: 'Tap Payments',
    vendor: 'by Tap',
    tagline: 'Cards + wallets for the GCC',
    description:
      'KNet, mada, Apple Pay, Visa, Mastercard - Tap is the default merchant gateway across the GCC.',
    category: 'finance',
    authKind: 'oauth',
    available: false,
    glyph: 'T',
    accentVar: '--color-maroon',
    oauthAuthorizationUrl: 'https://accounts.tap.company/authorize',
    oauthTokenUrl: 'https://api.tap.company/v2/oauth/token',
    requiredEnv: ['TAP_CLIENT_ID', 'TAP_CLIENT_SECRET'],
    connectCopy: {
      headline: 'Connect your Tap account',
      body: 'One-tap sign-in. Tap handles the cards, Souqna handles the rest.',
      ctaLabel: 'Connect Tap',
    },
  },
];

const REGISTRY_BY_ID = new Map(APP_REGISTRY.map((a) => [a.id, a]));

export function getAppDescriptor(id: string): AppDescriptor | undefined {
  return REGISTRY_BY_ID.get(id);
}

export function listAvailableApps(): AppDescriptor[] {
  return APP_REGISTRY.filter((a) => a.available);
}
