import { cache } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';
import type { Locale } from '@/i18n/locales';
import type { PaletteId } from './palettes';
import type { Block, ThemeOverrides } from './blocks/types';
import type {
  BankDetails,
  CheckoutSettings,
  PaymentMethod,
  PayLink,
  PolicyKey,
  StorefrontPolicies,
} from './storefrontSettings';

export type Ownership = 'have_business' | 'want_to_start';
export type Experience = 'first_time' | 'one_before' | 'multiple';
export type MarketVolume = 'local' | 'qatar' | 'gcc' | 'global';
export type Payments = 'accepting' | 'planning' | 'not_applicable';
export type BusinessType =
  | 'graphic_design'
  | 'clothing_store'
  | 'home_kitchen'
  | 'salon'
  | 'cafe'
  | 'ecommerce'
  | 'real_estate'
  | 'photography'
  | 'tutoring'
  | 'fitness'
  | 'perfume_oud'
  | 'auto_detailing'
  | 'events_weddings'
  | 'agriculture'
  | 'courier_delivery'
  | 'contracting'
  | 'art_gallery'
  | 'tailoring_abaya'
  | 'fnb_brand'
  | 'something_else';

export type DesignId = 'atrium' | 'souk';
export const DESIGN_IDS = ['atrium', 'souk'] as const satisfies readonly DesignId[];

/**
 * Storefront templates the founder picks once during /begin. Each
 * bundles its own palette, typography, and a seed block stack that
 * resolves products dynamically from the storefront's own catalogue —
 * never from inline mock arrays. Founders can still tweak palette
 * later from the dashboard Theme page.
 *
 * Internal id (left) is DB-persisted; display label (right) was
 * refreshed in 2026-05 to a premium commerce lineup.
 *
 *  - atrium    → Executive OS          commerce operating shell (free)
 *  - souqline  → Fast Market           dense catalogue and quick-buy lanes
 *  - kiosk     → Launch Lab            single-product launch and waitlist
 *  - lounge    → Minimal Checkout      monochrome rows and bundle upsell
 *  - studio    → Service Shop          services + bookings (free)
 *  - bazaar    → Drop Engine           limited editions by collection
 *  - vitrine   → Product Suite         Max+ productized offer system
 *  - monoline  → Hospitality Commerce  menu, gifts, reservation CTA
 *  - harvest   → Maker Supply          provenance and artisan catalogue
 *  - launchpad → Digital Store         software/services/digital packs
 *  - frame     → Portfolio Shop        gallery-led product selling
 *
 * Internal IDs are stable and DB-persisted: renaming would require a
 * migration. Display labels and palettes can be tweaked freely in
 * `src/lib/templates.ts` and `src/content/copy.{en,ar}.ts`.
 *
 * Migration 015 maps every legacy template id (atelier, souq, pavilion,
 * salon, maison, noctis, bento, gazette) onto one of the originals so
 * existing storefront rows keep rendering after deploy. The five
 * 2026-04 additions (vitrine, monoline, harvest, launchpad, frame) are
 * net-new — no row exists with these ids before deploy, so no further
 * migration is required to introduce them.
 */
export type TemplateId =
  | 'atrium'
  | 'souqline'
  | 'kiosk'
  | 'lounge'
  | 'studio'
  | 'bazaar'
  | 'vitrine'
  | 'monoline'
  | 'harvest'
  | 'launchpad'
  | 'frame';
/**
 * Order matters — TEMPLATE_IDS drives the order of the picker rail in
 * `/begin`. The original six lead in their established order
 * (atrium → bazaar) so existing founders find their template where
 * they left it; the 2026-04 additions are appended in roughly
 * increasing specificity (editorial → minimal → maker → tech →
 * portfolio).
 */
export const TEMPLATE_IDS = [
  'atrium',
  'souqline',
  'kiosk',
  'lounge',
  'studio',
  'bazaar',
  'vitrine',
  'monoline',
  'harvest',
  'launchpad',
  'frame',
] as const satisfies readonly TemplateId[];

/**
 * The full record persisted per slug. The intake answers (ownership,
 * experience, marketVolume, payments) live alongside the storefront
 * customization (palette, tagline, details, logo). The same row is read
 * by the public storefront page and rewritten by the dashboard edit page.
 *
 * Type kept named `Storefront` to match the user-facing concept; the DB
 * table is still `briefs` for migration continuity.
 *
 * `clerkUserId` is the only auth identity. It's set at creation time from
 * `auth().userId` and never changes. Every dashboard surface checks
 * `currentUserId === storefront.clerkUserId` before rendering.
 */
export type Storefront = {
  slug: string;
  locale: Locale;
  founderName: string;
  businessName: string;
  contactEmail: string;
  ownership: Ownership;
  experience: Experience;
  businessType: BusinessType;
  marketVolume: MarketVolume;
  payments: Payments;
  tagline: string | null;
  phone: string | null;
  area: string | null;
  hours: string | null;
  instagram: string | null;
  logoUrl: string | null;
  /** Optional small (≤1 MB) icon used by browser tab + PWA install. NULL
   *  → Souqna mark fallback. Stored under Vercel Blob `favicons/<slug>`. */
  faviconUrl: string | null;
  design: DesignId;
  palette: PaletteId;
  templateId: TemplateId;
  /** Optional Qatari Commercial Registration. Surfaces a "Verified" chip
   * publicly when present; the raw number is never displayed. */
  crNumber: string | null;
  clerkUserId: string;
  /** Live page seen at {slug}.souqna.qa. Empty array → archetype fallback. */
  publishedBlocks: Block[];
  /** Working copy edited inside the builder. Empty array → seed on first open. */
  draftBlocks: Block[];
  themeOverrides: ThemeOverrides;
  isPublished: boolean;
  publishedAt: Date | null;
  /**
   * When non-null, the public storefront is rendered by the Souqy
   * code-emit pipeline (see `src/lib/souqy/load.ts`) instead of the
   * `published_blocks` JSON pipeline. Holds the latest revision id,
   * which doubles as the Vercel Blob path suffix.
   */
  souqyRevision: string | null;
  /** Public Vercel Blob URL of the compiled artifact for this revision.
   * Persisted directly so the renderer never has to reconstruct it
   * from the BLOB_READ_WRITE_TOKEN. */
  souqyBlobUrl: string | null;
  /** Last-known raw TSX source (concatenated `index.tsx` + `theme.ts`)
   * used for re-prompt context and rollback. */
  souqySource: string | null;
  /** Original Souqy brief (businessName, slug, businessType, vibe, locale)
   * Claude was asked from. JSON because it grows over time. */
  souqyBrief: Record<string, unknown>;
  /**
   * Per-storefront policy text. NULL means the founder hasn't written
   * the policy yet — the storefront footer hides the corresponding
   * link in that case. See migration 016 + `src/lib/storefrontSettings.ts`.
   */
  policies: StorefrontPolicies;
  /**
   * Checkout configuration: payment methods, optional bank details for
   * manual transfers, optional SkipCash / SADAD online payments,
   * required policy acceptances, currency, minimum order, flat shipping.
   * Defaults to COD + bank transfer requiring terms + privacy. See
   * migration 016.
   */
  checkout: CheckoutSettings;
  /** Founder self-attestation that the storefront CR belongs to the business. */
  crConfirmedAt: Date | null;
  /**
   * Founder-owned hostname (e.g. `shop.brand.com`) routed to this
   * storefront. NULL when the founder hasn't attached one yet — they
   * always have the free `{slug}.souqna.qa` subdomain regardless.
   * Lowercased on write; middleware lookup is case-insensitive.
   */
  customDomain: string | null;
  /** First-attached timestamp; used to time-out long-pending verifications. */
  customDomainAddedAt: Date | null;
  /** Set when Vercel reports the cert as live. NULL → still pending DNS. */
  customDomainVerifiedAt: Date | null;
  /**
   * Vercel-managed `{slug}.souqna.qa` cert provisioning state. After
   * publish we set `'pending'`; the bell popover polls Vercel and
   * flips it to `'live'` once HTTP-01 ACME completes (~30s-3min) or
   * `'failed'` on a hard error (bad token, taken hostname).
   */
  subdomainStatus: 'pending' | 'live' | 'failed';
  subdomainProvisionedAt: Date | null;
  subdomainError: string | null;
  createdAt: Date;
  expiresAt: Date;
};

type StorefrontRow = {
  slug: string;
  locale: Locale;
  founder_name: string;
  business_name: string;
  contact_email: string;
  ownership: Ownership;
  experience: Experience;
  business_type: BusinessType;
  market_volume: MarketVolume;
  payments: Payments;
  tagline: string | null;
  phone: string | null;
  area: string | null;
  hours: string | null;
  instagram: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  design: DesignId;
  palette: PaletteId;
  template_id: TemplateId;
  cr_number: string | null;
  cr_confirmed_at: string | null;
  clerk_user_id: string;
  published_blocks: unknown;
  draft_blocks: unknown;
  theme_overrides: unknown;
  is_published: boolean;
  published_at: string | null;
  souqy_revision: string | null;
  souqy_blob_url: string | null;
  souqy_source: string | null;
  souqy_brief: unknown;
  policies_terms: string | null;
  policies_privacy: string | null;
  policies_refund: string | null;
  policies_shipping: string | null;
  checkout_payment_methods: string[] | null;
  checkout_bank_details: unknown;
  checkout_pay_link_url: string | null;
  checkout_pay_link_label: string | null;
  checkout_skipcash_credentials: unknown;
  checkout_sadad_credentials: unknown;
  checkout_required_policies: string[] | null;
  checkout_currency: string | null;
  checkout_min_order_qar: number | null;
  checkout_shipping_flat_qar: number | null;
  custom_domain: string | null;
  custom_domain_added_at: string | null;
  custom_domain_verified_at: string | null;
  subdomain_status: 'pending' | 'live' | 'failed' | null;
  subdomain_provisioned_at: string | null;
  subdomain_error: string | null;
  created_at: string;
  expires_at: string;
};

function parseBlocks(value: unknown): Block[] {
  // Neon's HTTP driver returns JSONB as a parsed value already (object or
  // array). Some adapters surface it as a string; handle both conservatively.
  if (Array.isArray(value)) return value as Block[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as Block[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseThemeOverrides(value: unknown): ThemeOverrides {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ThemeOverrides;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as ThemeOverrides)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function fromRow(row: StorefrontRow): Storefront {
  return {
    slug: row.slug,
    locale: row.locale,
    founderName: row.founder_name,
    businessName: row.business_name,
    contactEmail: row.contact_email,
    ownership: row.ownership,
    experience: row.experience,
    businessType: row.business_type,
    marketVolume: row.market_volume,
    payments: row.payments,
    tagline: row.tagline,
    phone: row.phone,
    area: row.area,
    hours: row.hours,
    instagram: row.instagram,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    design: row.design,
    palette: row.palette,
    templateId: normalizeTemplateId(row.template_id),
    crNumber: row.cr_number,
    crConfirmedAt: row.cr_confirmed_at ? new Date(row.cr_confirmed_at) : null,
    clerkUserId: row.clerk_user_id,
    publishedBlocks: parseBlocks(row.published_blocks),
    draftBlocks: parseBlocks(row.draft_blocks),
    themeOverrides: parseThemeOverrides(row.theme_overrides),
    isPublished: row.is_published,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    souqyRevision: row.souqy_revision,
    souqyBlobUrl: row.souqy_blob_url,
    souqySource: row.souqy_source,
    souqyBrief: parseSouqyBrief(row.souqy_brief),
    policies: {
      terms: row.policies_terms,
      privacy: row.policies_privacy,
      refund: row.policies_refund,
      shipping: row.policies_shipping,
    },
    checkout: parseCheckoutFromRow(row),
    customDomain: row.custom_domain,
    customDomainAddedAt: row.custom_domain_added_at ? new Date(row.custom_domain_added_at) : null,
    customDomainVerifiedAt: row.custom_domain_verified_at
      ? new Date(row.custom_domain_verified_at)
      : null,
    subdomainStatus: row.subdomain_status ?? 'pending',
    subdomainProvisionedAt: row.subdomain_provisioned_at
      ? new Date(row.subdomain_provisioned_at)
      : null,
    subdomainError: row.subdomain_error,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
  };
}

const ALLOWED_PAYMENT_METHODS = new Set<string>([
  'cod',
  'bank_transfer',
  'skipcash',
  'sadad',
  'pay_link',
]);
const ALLOWED_REQUIRED_POLICIES = new Set<string>(['terms', 'privacy', 'refund', 'shipping']);

function parseBankDetailsFromRow(value: unknown): BankDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.accountName !== 'string' ||
    typeof v.iban !== 'string' ||
    typeof v.bankName !== 'string'
  ) {
    return null;
  }
  return {
    accountName: v.accountName,
    iban: v.iban,
    bankName: v.bankName,
    swift: typeof v.swift === 'string' && v.swift.length > 0 ? v.swift : null,
    notes: typeof v.notes === 'string' && v.notes.length > 0 ? v.notes : null,
  };
}

function parseCheckoutFromRow(row: StorefrontRow): CheckoutSettings {
  const paymentMethods: PaymentMethod[] = (row.checkout_payment_methods ?? ['cod', 'bank_transfer'])
    .filter((m): m is PaymentMethod => ALLOWED_PAYMENT_METHODS.has(m))
    .filter((m, i, arr) => arr.indexOf(m) === i);
  if (paymentMethods.length === 0) paymentMethods.push('cod', 'bank_transfer');

  const requiredPolicies: PolicyKey[] = (row.checkout_required_policies ?? ['terms', 'privacy', 'refund'])
    .filter((p): p is PolicyKey => ALLOWED_REQUIRED_POLICIES.has(p))
    .filter((p, i, arr) => arr.indexOf(p) === i);

  const payLink: PayLink | null =
    row.checkout_pay_link_url && row.checkout_pay_link_label
      ? { url: row.checkout_pay_link_url, label: row.checkout_pay_link_label }
      : null;
  const skipCashRef = parseSkipCashCredentialsRef(row.checkout_skipcash_credentials);
  const sadadRef = parseSadadCredentialsRef(row.checkout_sadad_credentials);

  return {
    paymentMethods,
    bankDetails: parseBankDetailsFromRow(row.checkout_bank_details),
    payLink,
    skipCash: skipCashRef
      ? {
          hasCredentials: true,
          clientIdHint: skipCashRef.clientIdHint,
          crConfirmedAt: row.cr_confirmed_at,
          enabled: Boolean(row.cr_number && row.cr_confirmed_at),
        }
      : {
          hasCredentials: false,
          clientIdHint: null,
          crConfirmedAt: row.cr_confirmed_at,
          enabled: Boolean(row.cr_number && row.cr_confirmed_at),
        },
    sadad: sadadRef
      ? {
          hasCredentials: true,
          merchantIdHint: sadadRef.merchantIdHint,
          websiteHint: sadadRef.websiteHint,
          verifiedMode: sadadRef.verifiedMode,
          verifiedAt: sadadRef.verifiedAt,
          enabled: true,
        }
      : {
          hasCredentials: false,
          merchantIdHint: null,
          websiteHint: null,
          verifiedMode: null,
          verifiedAt: null,
          enabled: false,
        },
    requiredPolicies,
    currency: (row.checkout_currency ?? 'QAR').toUpperCase(),
    minOrderQar: row.checkout_min_order_qar,
    shippingFlatQar: row.checkout_shipping_flat_qar,
  };
}

function parseSadadCredentialsRef(value: unknown): {
  merchantIdHint: string | null;
  websiteHint: string | null;
  verifiedMode: 'live' | 'sandbox' | null;
  verifiedAt: string | null;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.v !== 1 || typeof obj.ct !== 'string') return null;
  return {
    merchantIdHint: typeof obj.merchantIdHint === 'string' ? obj.merchantIdHint : null,
    websiteHint: typeof obj.websiteHint === 'string' ? obj.websiteHint : null,
    verifiedMode:
      obj.verifiedMode === 'live' || obj.verifiedMode === 'sandbox' ? obj.verifiedMode : null,
    verifiedAt: typeof obj.verifiedAt === 'string' ? obj.verifiedAt : null,
  };
}

function parseSkipCashCredentialsRef(value: unknown): { clientIdHint: string | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.ct !== 'string' || v.ct.length === 0) return null;
  return {
    clientIdHint:
      typeof v.clientIdHint === 'string' && v.clientIdHint.length > 0 ? v.clientIdHint : null,
  };
}

/**
 * Migration 015 rewrites `template_id` for every storefront row in
 * place, but the picker, intake form and SQL default may still contain
 * a legacy id between deploy and the migration running on a fresh
 * environment. Map every retired id onto the closest live template so
 * the dashboard never renders an unknown template.
 */
const LEGACY_TEMPLATE_MAP: Record<string, TemplateId> = {
  atelier: 'atrium',
  noctis: 'atrium',
  gazette: 'atrium',
  salon: 'atrium',
  bento: 'souqline',
  souq: 'souqline',
  pavilion: 'bazaar',
  maison: 'lounge',
};

function normalizeTemplateId(raw: string | null | undefined): TemplateId {
  const id = (raw ?? '').trim();
  if (
    (TEMPLATE_IDS as readonly string[]).includes(id)
  ) {
    return id as TemplateId;
  }
  return LEGACY_TEMPLATE_MAP[id] ?? 'atrium';
}

function parseSouqyBrief(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Insert payload — block columns are seeded server-side at creation, so
 * callers don't have to know about them. They default to empty arrays /
 * empty object via the DB schema, mirroring the migration defaults.
 */
export type CreateStorefrontInput = Omit<
  Storefront,
  | 'createdAt'
  | 'expiresAt'
  | 'publishedBlocks'
  | 'draftBlocks'
  | 'themeOverrides'
  | 'isPublished'
  | 'publishedAt'
  | 'souqyRevision'
  | 'souqyBlobUrl'
  | 'souqySource'
  | 'souqyBrief'
  | 'policies'
  | 'checkout'
  | 'crConfirmedAt'
  | 'customDomain'
  | 'customDomainAddedAt'
  | 'customDomainVerifiedAt'
  | 'subdomainStatus'
  | 'subdomainProvisionedAt'
  | 'subdomainError'
>;

/**
 * Form-driven update — used by the dashboard "Edit storefront" surface.
 * Block columns are written by separate server actions
 * (`saveDraftBlocks`, `publishStorefront`, `discardDraft`) and excluded
 * from this shape.
 */
export type UpdateStorefrontInput = Omit<
  Storefront,
  | 'slug'
  | 'locale'
  | 'createdAt'
  | 'expiresAt'
  | 'contactEmail'
  | 'clerkUserId'
  | 'publishedBlocks'
  | 'draftBlocks'
  | 'themeOverrides'
  | 'isPublished'
  | 'publishedAt'
  | 'souqyRevision'
  | 'souqyBlobUrl'
  | 'souqySource'
  | 'souqyBrief'
  | 'policies'
  | 'checkout'
  | 'crConfirmedAt'
  | 'customDomain'
  | 'customDomainAddedAt'
  | 'customDomainVerifiedAt'
  | 'subdomainStatus'
  | 'subdomainProvisionedAt'
  | 'subdomainError'
>;

export async function insertStorefront(b: CreateStorefrontInput): Promise<Storefront> {
  const rows = (await db()`
    insert into briefs (
      slug, locale, founder_name, business_name, contact_email,
      ownership, experience, business_type, market_volume, payments,
      tagline, phone, area, hours, instagram, logo_url, design, palette,
      template_id, cr_number, clerk_user_id, is_published
    ) values (
      ${b.slug}, ${b.locale}, ${b.founderName}, ${b.businessName}, ${b.contactEmail},
      ${b.ownership}, ${b.experience}, ${b.businessType}, ${b.marketVolume}, ${b.payments},
      ${b.tagline}, ${b.phone}, ${b.area}, ${b.hours}, ${b.instagram}, ${b.logoUrl}, ${b.design}, ${b.palette},
      ${b.templateId}, ${b.crNumber}, ${b.clerkUserId}, false
    )
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  if (!row) throw new Error('insert failed');
  return fromRow(row);
}

/**
 * Per-request cached storefront lookup. layout.tsx + page.tsx in the same
 * request share a single DB roundtrip thanks to React's `cache()`.
 */
export const getStorefront = cache(async (slug: string): Promise<Storefront | null> => {
  // The owner edits this row via the dashboard; the change must surface on
  // the live storefront on the very next request. Neon's HTTP driver issues
  // a fetch under the hood, and Next.js auto-caches every fetch in the App
  // Router, so without this opt-out edits would appear stale.
  noStore();
  const rows = (await db()`
    select * from briefs
    where slug = ${slug} and expires_at > now()
    limit 1
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
});

/**
 * Returns every storefront a Clerk user owns. Used by /account to list
 * the founder's stores.
 */
export async function getStorefrontsForUser(clerkUserId: string): Promise<Storefront[]> {
  if (!clerkUserId) return [];
  noStore();
  const rows = (await db()`
    select * from briefs
    where clerk_user_id = ${clerkUserId} and expires_at > now()
    order by created_at desc
  `) as unknown as StorefrontRow[];
  return rows.map(fromRow);
}

export async function updateStorefront(
  slug: string,
  patch: UpdateStorefrontInput,
): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs set
      founder_name  = ${patch.founderName},
      business_name = ${patch.businessName},
      ownership     = ${patch.ownership},
      experience    = ${patch.experience},
      business_type = ${patch.businessType},
      market_volume = ${patch.marketVolume},
      payments      = ${patch.payments},
      tagline       = ${patch.tagline},
      phone         = ${patch.phone},
      area          = ${patch.area},
      hours         = ${patch.hours},
      instagram     = ${patch.instagram},
      logo_url      = ${patch.logoUrl},
      favicon_url   = ${patch.faviconUrl},
      design        = ${patch.design},
      palette       = ${patch.palette},
      template_id   = ${patch.templateId},
      cr_number     = ${patch.crNumber}
    where slug = ${slug} and expires_at > now()
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Switch a storefront's `template_id` in isolation. The full
 * `updateStorefront` patch above clobbers every founder field, which is
 * the wrong shape for an in-builder template switch — the founder
 * already filled out their intake answers, we only want to swap the
 * template choice and leave everything else (founder name, business
 * name, tagline, contact, palette overrides, etc.) untouched.
 *
 * Callers are expected to follow up with `saveDraft` (re-seeded blocks)
 * and `saveTheme` (template preset) so the visible storefront actually
 * reflects the new template. See `switchBuilderTemplate` in
 * `src/app/actions/builder.ts` for the full orchestration.
 */
export async function setStorefrontTemplate(
  slug: string,
  templateId: TemplateId,
): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs
       set template_id = ${templateId}
     where slug = ${slug} and expires_at > now()
     returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Persist a builder draft. Theme is optional — passing `null` leaves the
 * existing override row untouched, which is what we want for actions that
 * only edit blocks (most of them).
 */
export async function saveDraft(
  slug: string,
  blocks: Block[],
  theme: ThemeOverrides | null,
): Promise<Storefront | null> {
  const blocksJson = JSON.stringify(blocks);
  const rows =
    theme === null
      ? ((await db()`
          update briefs set draft_blocks = ${blocksJson}::jsonb
          where slug = ${slug} and expires_at > now()
          returning *
        `) as unknown as StorefrontRow[])
      : ((await db()`
          update briefs set
            draft_blocks    = ${blocksJson}::jsonb,
            theme_overrides = ${JSON.stringify(theme)}::jsonb
          where slug = ${slug} and expires_at > now()
          returning *
        `) as unknown as StorefrontRow[]);
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Copy `draft_blocks` → `published_blocks`, stamp `published_at`, set
 * `is_published = true`. Returns the updated row so the caller can
 * revalidate paths from a fresh snapshot.
 */
export async function publishDraft(slug: string): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs set
      published_blocks = draft_blocks,
      is_published     = true,
      published_at     = now()
    where slug = ${slug} and expires_at > now()
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Flip `is_published` to false without touching `published_blocks` or
 * `published_at`. The public storefront pipeline reads `is_published`
 * before serving content, so an unpublish hides the storefront from
 * buyers while preserving the last published tree (the founder can
 * republish without re-saving). Returns the updated row, or null when
 * the slug doesn't match an active row.
 */
export async function unpublishStorefront(
  slug: string,
): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs set is_published = false
    where slug = ${slug} and expires_at > now()
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Persist only the theme overrides (palette, typography, page background,
 * SEO meta). Used by the dedicated Theme page; block-level edits go
 * through `saveDraft` instead.
 */
export async function saveTheme(
  slug: string,
  theme: ThemeOverrides,
): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs set theme_overrides = ${JSON.stringify(theme)}::jsonb
    where slug = ${slug} and expires_at > now()
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Permanently delete a storefront row. Products cascade automatically
 * via the `on delete cascade` foreign key on `products.storefront_slug`,
 * so this single statement removes the entire project. Caller is
 * responsible for owner-gating before invoking — this helper trusts
 * `slug` and does not check `clerk_user_id`.
 *
 * Returns true if a row was deleted, false if no row matched.
 */
export async function deleteStorefront(slug: string): Promise<boolean> {
  const rows = (await db()`
    delete from briefs where slug = ${slug} returning slug
  `) as unknown as { slug: string }[];
  return rows.length > 0;
}

/**
 * Reset the draft to whatever's currently published. Used by the
 * builder's "Discard changes" affordance.
 */
/**
 * Attach (or detach) a founder-owned hostname to a storefront row.
 *
 * `host` is lowercased before insert so the unique index on
 * `lower(custom_domain)` doubles as the case-insensitive uniqueness
 * guarantee. Passing `null` clears the column AND both timestamps so a
 * re-attach later starts a fresh verification window.
 *
 * Cert-issued bookkeeping is split out into `markCustomDomainVerified`
 * — verification can succeed on a poll long after the original attach,
 * and we want `custom_domain_added_at` to keep its original value as
 * the founder-visible "attached on" timestamp.
 */
export async function setCustomDomain(
  slug: string,
  host: string | null,
): Promise<Storefront | null> {
  const normalized = host ? host.trim().toLowerCase() : null;
  const rows = normalized
    ? ((await db()`
        update briefs set
          custom_domain             = ${normalized},
          custom_domain_added_at    = coalesce(custom_domain_added_at, now()),
          custom_domain_verified_at = case
            when lower(coalesce(custom_domain, '')) = ${normalized} then custom_domain_verified_at
            else null
          end
        where slug = ${slug} and expires_at > now()
        returning *
      `) as unknown as StorefrontRow[])
    : ((await db()`
        update briefs set
          custom_domain             = null,
          custom_domain_added_at    = null,
          custom_domain_verified_at = null
        where slug = ${slug} and expires_at > now()
        returning *
      `) as unknown as StorefrontRow[]);
  const row = rows[0];
  return row ? fromRow(row) : null;
}

/**
 * Stamp `custom_domain_verified_at = now()` once Vercel reports the
 * cert as live. Idempotent — no-op when already verified or when the
 * stored host no longer matches (founder swapped domains in flight).
 */
export async function markCustomDomainVerified(
  slug: string,
  host: string,
): Promise<void> {
  const normalized = host.trim().toLowerCase();
  await db()`
    update briefs
       set custom_domain_verified_at = coalesce(custom_domain_verified_at, now())
     where slug = ${slug}
       and lower(custom_domain) = ${normalized}
       and expires_at > now()
  `;
}

/**
 * Update the Vercel cert provisioning state for `{slug}.souqna.qa`.
 * Stamps `subdomain_provisioned_at` on the `pending → live` transition
 * and clears any prior error message. Used by the bell popover poller
 * and `publishStorefront`. Idempotent — safe to call repeatedly with
 * the same status.
 */
export async function updateSubdomainStatus(
  slug: string,
  status: 'pending' | 'live' | 'failed',
  error?: string | null,
): Promise<void> {
  if (status === 'live') {
    await db()`
      update briefs
         set subdomain_status = 'live',
             subdomain_provisioned_at = coalesce(subdomain_provisioned_at, now()),
             subdomain_error = null
       where slug = ${slug} and expires_at > now()
    `;
    return;
  }
  await db()`
    update briefs
       set subdomain_status = ${status},
           subdomain_error = ${error ?? null}
     where slug = ${slug} and expires_at > now()
  `;
}

export async function discardDraft(slug: string): Promise<Storefront | null> {
  const rows = (await db()`
    update briefs set draft_blocks = published_blocks
    where slug = ${slug} and expires_at > now()
    returning *
  `) as unknown as StorefrontRow[];
  const row = rows[0];
  return row ? fromRow(row) : null;
}
