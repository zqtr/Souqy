import { decryptToken } from './crypto';
import { getInstalledApp } from './installed';
import { getStorefront } from '@/lib/brief';
import { getAllProducts } from '@/lib/products';
import type { Block } from '@/lib/blocks/types';

/**
 * Bilingual SEO assistant.
 *
 * Local-first audit: every check runs against the founder's own data
 * (`briefs`, `products`, `published_blocks`) and produces a scored
 * report card. No third-party API is required.
 *
 * Optional add-on: when the founder pastes a Google PageSpeed
 * Insights API key, the assistant also runs a Lighthouse audit on
 * their public storefront URL. The key belongs to the founder and is
 * stored encrypted at rest.
 */

export type SeoAssistantSettings = {
  /** When true, also flag pages that haven't been indexed by search
   *  engines yet (i.e. opt-in to allowing crawlers on the brief
   *  subdomain — by default Souqna sets `noindex`). */
  allowIndex: boolean;
  /** Optional founder-supplied Google PageSpeed Insights key. When set,
   *  the audit runs Lighthouse against the live storefront URL. */
  pagespeedKey: string;
};

export const DEFAULT_SEO_SETTINGS: SeoAssistantSettings = {
  allowIndex: false,
  pagespeedKey: '',
};

export function normaliseSettings(
  raw: Partial<SeoAssistantSettings> | null | undefined,
): SeoAssistantSettings {
  if (!raw) return DEFAULT_SEO_SETTINGS;
  return {
    allowIndex: typeof raw.allowIndex === 'boolean' ? raw.allowIndex : false,
    pagespeedKey: typeof raw.pagespeedKey === 'string' ? raw.pagespeedKey.trim() : '',
  };
}

export type SeoSeverity = 'pass' | 'warn' | 'fail';

export type SeoFinding = {
  id: string;
  severity: SeoSeverity;
  category: 'metadata' | 'bilingual' | 'imagery' | 'structure' | 'discoverability';
  title: string;
  detail: string;
  /** Optional dashboard link the founder can click to fix it. */
  fixHref?: string;
};

export type SeoReport = {
  storefrontSlug: string;
  generatedAt: string;
  score: number; // 0..100
  findings: SeoFinding[];
  /** Optional Lighthouse summary when the PSI key is configured. */
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    fetchedAt: string;
  };
};

export async function runAudit(slug: string): Promise<SeoReport> {
  const storefront = await getStorefront(slug);
  if (!storefront) {
    return {
      storefrontSlug: slug,
      generatedAt: new Date().toISOString(),
      score: 0,
      findings: [
        {
          id: 'no-storefront',
          severity: 'fail',
          category: 'discoverability',
          title: 'Storefront not found',
          detail: 'Could not load the storefront row to audit.',
        },
      ],
    };
  }

  const products = await getAllProducts(slug);
  const findings: SeoFinding[] = [];

  // ---------- Metadata ----------
  const seo = storefront.themeOverrides.seo ?? {};
  findings.push(
    seo.title?.trim()
      ? pass('seo-title', 'metadata', 'Storefront title set')
      : fail('seo-title', 'metadata', 'Missing storefront SEO title', 'Open Theme → SEO and add a 50–60 char title.', `/account/${slug}/edit#theme-seo`),
  );
  findings.push(
    seo.description?.trim()
      ? pass('seo-description', 'metadata', 'Storefront description set')
      : warn('seo-description', 'metadata', 'Missing meta description', 'A 140–160 char summary helps search engines and previews.', `/account/${slug}/edit#theme-seo`),
  );
  findings.push(
    seo.ogImage?.trim()
      ? pass('seo-og', 'metadata', 'Open Graph image set')
      : warn('seo-og', 'metadata', 'No Open Graph image', 'Without one, social shares fall back to a generic Souqna card.', `/account/${slug}/edit#theme-seo`),
  );

  // ---------- Bilingual parity ----------
  const expectsArabic = storefront.locale === 'ar';
  const productCount = products.length;
  const titlesMissing = products.filter((p) => !p.title.trim()).length;
  if (titlesMissing > 0) {
    findings.push(
      fail(
        'product-titles',
        'bilingual',
        `${titlesMissing} product${titlesMissing === 1 ? '' : 's'} without a title`,
        'Empty product titles never rank.',
        `/account/products`,
      ),
    );
  }
  if (productCount > 0) {
    const missingDesc = products.filter((p) => !p.description?.trim()).length;
    findings.push(
      missingDesc / Math.max(productCount, 1) > 0.4
        ? warn(
            'product-descriptions',
            'bilingual',
            `${missingDesc}/${productCount} products lack descriptions`,
            'Descriptions are the main signal for long-tail search.',
            `/account/products`,
          )
        : pass(
            'product-descriptions',
            'bilingual',
            'Most products have descriptions',
          ),
    );
  }
  if (expectsArabic) {
    // Stretch goal: detect mostly-Latin-script titles on Arabic stores.
    const latinHeavy = products.filter((p) => isLatinHeavy(p.title)).length;
    if (latinHeavy > 0) {
      findings.push(
        warn(
          'arabic-parity',
          'bilingual',
          `${latinHeavy} product titles look like English on an Arabic store`,
          'Either translate the title or duplicate it as a sub-title.',
          `/account/products`,
        ),
      );
    }
  }

  // ---------- Imagery ----------
  const noImage = products.filter((p) => !p.imageUrl).length;
  if (noImage > 0) {
    findings.push(
      warn(
        'product-imagery',
        'imagery',
        `${noImage} product${noImage === 1 ? '' : 's'} without an image`,
        'Image-less products get hidden in most archetype templates.',
        `/account/products`,
      ),
    );
  }
  const blockImageGaps = scanBlocksForImageGaps(storefront.publishedBlocks);
  if (blockImageGaps.empty > 0 || blockImageGaps.altMissing > 0) {
    findings.push(
      warn(
        'block-images',
        'imagery',
        `${blockImageGaps.empty} empty image slots, ${blockImageGaps.altMissing} missing alt text`,
        'Open the builder and fill them in for accessibility + SEO.',
        `/account/builder?store=${slug}`,
      ),
    );
  } else {
    findings.push(pass('block-images', 'imagery', 'All builder image slots are filled with alt text'));
  }

  // ---------- Discoverability ----------
  findings.push(
    storefront.isPublished
      ? pass('published', 'discoverability', 'Storefront is published')
      : fail('published', 'discoverability', 'Storefront is not published yet', 'Open the builder and hit Publish.', `/account/builder?store=${slug}`),
  );
  findings.push(
    warn(
      'noindex',
      'discoverability',
      'Storefronts are noindex by default',
      'Souqna keeps brief storefronts out of search engines until you explicitly opt in. Toggle "Allow indexing" in the SEO Assistant settings to flip this for this store.',
    ),
  );

  const score = scoreFindings(findings);
  return {
    storefrontSlug: slug,
    generatedAt: new Date().toISOString(),
    score,
    findings,
  };
}

export async function runLighthouseFor(
  slug: string,
  publicUrl: string,
): Promise<SeoReport['lighthouse'] | null> {
  const installed = await getInstalledApp(slug, 'seo-assistant');
  if (!installed || !installed.enabled) return null;
  const settings = normaliseSettings(installed.settings as Partial<SeoAssistantSettings>);
  const key = settings.pagespeedKey || decryptToken(installed.oauthAccessTokenCt);
  if (!key) return null;

  const params = new URLSearchParams({
    url: publicUrl,
    strategy: 'mobile',
    category: 'performance',
  });
  // PSI accepts repeated `category` params; tack the rest on without
  // dropping the existing one.
  for (const c of ['accessibility', 'best-practices', 'seo']) {
    params.append('category', c);
  }
  params.set('key', key);
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    lighthouseResult?: { categories?: Record<string, { score: number }> };
  };
  const cats = json.lighthouseResult?.categories ?? {};
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// helpers
// ---------------------------------------------------------------

function pass(id: string, category: SeoFinding['category'], title: string): SeoFinding {
  return { id, severity: 'pass', category, title, detail: '' };
}
function warn(
  id: string,
  category: SeoFinding['category'],
  title: string,
  detail: string,
  fixHref?: string,
): SeoFinding {
  return fixHref
    ? { id, severity: 'warn', category, title, detail, fixHref }
    : { id, severity: 'warn', category, title, detail };
}
function fail(
  id: string,
  category: SeoFinding['category'],
  title: string,
  detail: string,
  fixHref?: string,
): SeoFinding {
  return fixHref
    ? { id, severity: 'fail', category, title, detail, fixHref }
    : { id, severity: 'fail', category, title, detail };
}

function isLatinHeavy(s: string): boolean {
  if (!s) return false;
  let arabic = 0;
  let latin = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0600 && code <= 0x06ff) arabic += 1;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin += 1;
  }
  return latin > 4 && arabic === 0;
}

function scanBlocksForImageGaps(blocks: Block[]): { empty: number; altMissing: number } {
  let empty = 0;
  let altMissing = 0;
  for (const b of blocks) {
    if (b.type === 'image' || b.type === 'banner' || b.type === 'hero') {
      const url = (b.props as Record<string, unknown>).imageUrl;
      const alt = (b.props as Record<string, unknown>).alt;
      if (b.type !== 'hero' && (!url || (typeof url === 'string' && url.trim() === ''))) empty += 1;
      if (typeof url === 'string' && url.trim() !== '' && (!alt || (typeof alt === 'string' && alt.trim() === ''))) {
        altMissing += 1;
      }
    }
    if (b.type === 'gallery') {
      const items = (b.props as { items?: { imageUrl?: string; alt?: string }[] }).items ?? [];
      for (const it of items) {
        if (!it.imageUrl?.trim()) empty += 1;
        else if (!it.alt?.trim()) altMissing += 1;
      }
    }
  }
  return { empty, altMissing };
}

function scoreFindings(findings: SeoFinding[]): number {
  if (findings.length === 0) return 100;
  const weights: Record<SeoSeverity, number> = { pass: 1, warn: 0.6, fail: 0 };
  const total = findings.reduce((sum, f) => sum + weights[f.severity], 0);
  return Math.round((total / findings.length) * 100);
}
