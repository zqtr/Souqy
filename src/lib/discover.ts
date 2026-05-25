import { unstable_noStore as noStore } from 'next/cache';
import { db, hasDb } from './db';
import { env } from './env';
import { storefrontBaseUrl } from './storefrontUrl';
import type { BusinessType } from './brief';
import type { Locale } from '@/i18n/locales';

export type DiscoverStorefront = {
  slug: string;
  locale: Locale;
  businessName: string;
  founderName: string;
  businessType: BusinessType;
  tagline: string | null;
  logoUrl: string | null;
  liveUrl: string;
  domainLabel: string;
  isVerified: boolean;
  isFeatured: boolean;
  isSouqyBuilt: boolean;
  isPublished: boolean;
  isHiddenFromDiscover: boolean;
  isSpamShutdown: boolean;
  isDeleted: boolean;
  hiddenReason: string | null;
  discoverFeaturedAt: Date | null;
  discoverUpdatedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedReason: string | null;
  templateId: string;
  publishedAt: Date | null;
  createdAt: Date;
};

type DiscoverStorefrontRow = {
  slug: string;
  locale: Locale;
  business_name: string;
  founder_name: string;
  business_type: BusinessType;
  tagline: string | null;
  logo_url: string | null;
  cr_number: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  souqy_revision: string | null;
  is_published: boolean;
  discover_featured_at: string | null;
  discover_hidden_at: string | null;
  discover_hidden_reason: string | null;
  discover_spam_shutdown_at: string | null;
  discover_updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  template_id: string | null;
  published_at: string | null;
  created_at: string;
};

export type DiscoverAdminStorefront = DiscoverStorefront & {
  contactEmail: string;
  ownerClerkUserId: string;
  managedBy: string | null;
  expiresAt: Date;
};

type DiscoverAdminStorefrontRow = DiscoverStorefrontRow & {
  contact_email: string;
  clerk_user_id: string;
  discover_managed_by: string | null;
  expires_at: string;
};

export type DiscoverPageData = {
  top: DiscoverStorefront[];
  newlyLaunched: DiscoverStorefront[];
  spotlight: DiscoverStorefront | null;
  categories: { type: BusinessType; count: number }[];
  totalPublished: number;
};

function featuredSlugs(): string[] {
  return env.SOUQNA_FEATURED_STOREFRONT_SLUGS.split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean)
    .filter((slug, index, all) => all.indexOf(slug) === index);
}

function toDiscoverStorefront(
  row: DiscoverStorefrontRow,
  featured: Set<string>,
): DiscoverStorefront {
  const customDomain = row.custom_domain?.trim().toLowerCase() || null;
  const customDomainIsLive = Boolean(customDomain && row.custom_domain_verified_at);
  const liveUrl = customDomainIsLive ? `https://${customDomain}` : storefrontBaseUrl(row.slug);

  return {
    slug: row.slug,
    locale: row.locale,
    businessName: row.business_name,
    founderName: row.founder_name,
    businessType: row.business_type,
    tagline: row.tagline,
    logoUrl: row.logo_url,
    liveUrl,
    domainLabel: customDomainIsLive ? customDomain! : `${row.slug}.${env.BRIEF_ROOT_DOMAIN}`,
    isVerified: Boolean(row.cr_number),
    isFeatured: Boolean(row.discover_featured_at) || featured.has(row.slug),
    isSouqyBuilt: Boolean(row.souqy_revision),
    isPublished: row.is_published,
    isHiddenFromDiscover: Boolean(row.discover_hidden_at),
    isSpamShutdown: Boolean(row.discover_spam_shutdown_at),
    isDeleted: Boolean(row.deleted_at),
    hiddenReason: row.discover_hidden_reason,
    discoverFeaturedAt: row.discover_featured_at ? new Date(row.discover_featured_at) : null,
    discoverUpdatedAt: row.discover_updated_at ? new Date(row.discover_updated_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    deletedBy: row.deleted_by,
    deletedReason: row.deleted_reason,
    templateId: row.template_id ?? 'atrium',
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    createdAt: new Date(row.created_at),
  };
}

function toDiscoverAdminStorefront(
  row: DiscoverAdminStorefrontRow,
  featured: Set<string>,
): DiscoverAdminStorefront {
  return {
    ...toDiscoverStorefront(row, featured),
    contactEmail: row.contact_email,
    ownerClerkUserId: row.clerk_user_id,
    managedBy: row.discover_managed_by,
    expiresAt: new Date(row.expires_at),
  };
}

function sortByFeatured(stores: DiscoverStorefront[], orderedFeatured: string[]) {
  const order = new Map(orderedFeatured.map((slug, index) => [slug, index]));
  return [...stores].sort((a, b) => {
    if (a.discoverFeaturedAt && b.discoverFeaturedAt) {
      return b.discoverFeaturedAt.getTime() - a.discoverFeaturedAt.getTime();
    }
    if (a.discoverFeaturedAt) return -1;
    if (b.discoverFeaturedAt) return 1;
    const aRank = order.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const bRank = order.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const aDate = a.publishedAt ?? a.createdAt;
    const bDate = b.publishedAt ?? b.createdAt;
    return bDate.getTime() - aDate.getTime();
  });
}

export async function getDiscoverPageData(): Promise<DiscoverPageData> {
  noStore();

  if (!hasDb()) {
    return {
      top: [],
      newlyLaunched: [],
      spotlight: null,
      categories: [],
      totalPublished: 0,
    };
  }

  const orderedFeatured = featuredSlugs();
  const featured = new Set(orderedFeatured);
  const rows = (await db()`
    select
      slug,
      locale,
      business_name,
      founder_name,
      business_type,
      tagline,
      logo_url,
      cr_number,
      custom_domain,
      custom_domain_verified_at,
      souqy_revision,
      is_published,
      discover_featured_at,
      discover_hidden_at,
      discover_hidden_reason,
      discover_spam_shutdown_at,
      discover_updated_at,
      deleted_at,
      deleted_by,
      deleted_reason,
      template_id,
      published_at,
      created_at
    from briefs
    where is_published = true
      and discover_hidden_at is null
      and discover_spam_shutdown_at is null
      and deleted_at is null
      and expires_at > now()
    order by
      discover_featured_at desc nulls last,
      published_at desc nulls last,
      created_at desc
    limit 48
  `) as unknown as DiscoverStorefrontRow[];

  const stores = rows.map((row) => toDiscoverStorefront(row, featured));
  const sorted = sortByFeatured(stores, orderedFeatured);
  const top = sorted.slice(0, 6);
  const topSlugs = new Set(top.map((store) => store.slug));
  const newlyLaunched = stores.filter((store) => !topSlugs.has(store.slug)).slice(0, 12);

  const categoryCounts = new Map<BusinessType, number>();
  for (const store of stores) {
    categoryCounts.set(store.businessType, (categoryCounts.get(store.businessType) ?? 0) + 1);
  }

  return {
    top,
    newlyLaunched,
    spotlight: top[0] ?? stores[0] ?? null,
    categories: [...categoryCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    totalPublished: stores.length,
  };
}

export async function listDiscoverAdminStorefronts(): Promise<DiscoverAdminStorefront[]> {
  noStore();

  if (!hasDb()) return [];

  const featured = new Set(featuredSlugs());
  const rows = (await db()`
    select
      slug,
      locale,
      business_name,
      founder_name,
      contact_email,
      clerk_user_id,
      business_type,
      tagline,
      logo_url,
      cr_number,
      custom_domain,
      custom_domain_verified_at,
      souqy_revision,
      is_published,
      discover_featured_at,
      discover_hidden_at,
      discover_hidden_reason,
      discover_spam_shutdown_at,
      discover_managed_by,
      discover_updated_at,
      deleted_at,
      deleted_by,
      deleted_reason,
      template_id,
      published_at,
      created_at,
      expires_at
    from briefs
    where expires_at > now() or deleted_at is not null
    order by
      deleted_at desc nulls last,
      discover_spam_shutdown_at desc nulls last,
      discover_hidden_at desc nulls last,
      discover_featured_at desc nulls last,
      published_at desc nulls last,
      created_at desc
    limit 200
  `) as unknown as DiscoverAdminStorefrontRow[];

  return rows.map((row) => toDiscoverAdminStorefront(row, featured));
}
