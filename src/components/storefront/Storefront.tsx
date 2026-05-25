import type { ReactNode } from 'react';
import { palettes, paletteCssVars, type PaletteId } from '@/lib/palettes';
import type { Theme } from '@/lib/theme';
import type { Storefront as StorefrontData } from '@/lib/brief';
import type { Product } from '@/lib/products';
import { getCopy } from '@/content/copy';
import { getVocabulary } from '@/lib/storefront-vocabulary';
import type { Block } from '@/lib/blocks/types';
import type { Locale } from '@/i18n/locales';
import { bootBlocksFromStorefront } from '@/lib/blocks/boot';
import { SouqyMount as RawSouqyMount } from './SouqyMount';

// React 18 ambient types still flag async server components as
// `Promise<ReactNode>` returns; Next.js handles them correctly at
// runtime. The cast here is the standard interim fix used throughout
// the App Router ecosystem until the React 19 types land.
type SouqyMountProps = {
  data: StorefrontData;
  products: Product[];
  fallback: ReactNode;
  categoriesBySlug?: Map<string, Set<string>>;
};
const SouqyMount = RawSouqyMount as unknown as (props: SouqyMountProps) => JSX.Element;
import { BlockRenderer } from './BlockRenderer';
import { SouqnaSignature } from './SouqnaSignature';
import { FloatingInquireButton } from './FloatingInquireButton';
import { SouqyCustomerChat } from './SouqyCustomerChat';
import { CurrencyToggle } from './CurrencyToggle';
import { AppScripts as RawAppScripts } from './AppScripts';
import { MawidBanner as RawMawidBanner } from './MawidBanner';
import { StorefrontChrome, type ChromeLegalPolicy, type ChromeNavPage } from './StorefrontChrome';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';
import type { BlockContext } from './blocks/BlockContext';
import { BlockBackgroundFrame } from './blocks/BlockBackgroundFrame';
import { PremiumCursor } from './PremiumCursor';
import { StorefrontPoliciesPanel } from './StorefrontPoliciesPanel';

type AppScriptsProps = { storefrontSlug: string; installedAppIds: string[] };
const AppScripts = RawAppScripts as unknown as (props: AppScriptsProps) => JSX.Element;
type MawidBannerProps = {
  storefrontSlug: string;
  installedAppIds: string[];
  locale: string;
};
const MawidBanner = RawMawidBanner as unknown as (props: MawidBannerProps) => JSX.Element;

type Props = {
  data: StorefrontData;
  products: Product[];
  /** Override the rendered blocks (used by the dashboard preview route to
   * show `draft_blocks` instead of `published_blocks`). */
  overrideBlocks?: Block[];
  /** When true, every block gets a `data-block-id` for postMessage selection. */
  selectable?: boolean;
  /**
   * Active theme used to pick the palette's light/dark sister triplet.
   * The storefront wrapper reconciles this with the owner's
   * `themeOverrides.themeBehaviour` lock — owners can keep their public
   * site visually anchored to a single theme even if the visitor prefers
   * the other.
   */
  visitorTheme?: Theme;
  /** App ids the founder has installed on this storefront. Used to
   * conditionally mount client islands like the Currency Toggle. */
  installedApps?: string[];
  /** First-class category slug → product-id set. Loaded once per
   * request by the brief page and threaded down so every product-
   * bearing block can resolve `categorySlug` against real categories. */
  categoriesBySlug?: Map<string, Set<string>>;
  /** Pages with `showInNav=true` (excluding home), loaded once at the
   * route boundary and threaded into the chrome. Defaults to empty so
   * older callers that haven't been migrated still render. */
  navPages?: ChromeNavPage[];
  /** Non-empty policies (terms / privacy / refund / shipping) the
   * footer should expose. Same defaulting story as `navPages`. */
  legalPolicies?: ChromeLegalPolicy[];
  /**
   * Optional escape hatch: when provided, replaces the entire
   * templated/block-pipeline main with a caller-supplied node (e.g.
   * the Markdown body for legal pages). Chrome — cart, header nav,
   * footer links, signature, app scripts — still mounts, so policy
   * pages stay visually anchored to the rest of the storefront.
   */
  overrideMain?: ReactNode;
  /** Optional preview-only override for policy fallback copy/titles. */
  policyLocale?: Locale;
  /**
   * When true, the storefront is being rendered as a non-interactive
   * showcase (the dashboard's "Browse all templates" iframe). Suppress
   * cart trigger/drawer + floating inquire so a click can't pollute the
   * buyer's real localStorage cart or dispatch a phantom inquiry, and
   * so the visual showcase isn't cluttered with chrome the founder
   * already understands. Page nav + legal footer still render.
   */
  showcaseOnly?: boolean;
  showSouqnaSignature?: boolean;
};

export type TemplateProps = {
  data: StorefrontData;
  copy: ReturnType<typeof getCopy>;
  vocabulary: ReturnType<typeof getVocabulary>;
  products: Product[];
};

/**
 * Storefront dispatcher.
 *
 * Storefronts render through the template block pipeline. If a row is
 * missing saved blocks, we synthesize the selected template's seed
 * layout on the fly instead of falling back to the retired archetype
 * templates. That keeps /begin, builder previews, and the public
 * webstore visually aligned to the same template choice.
 *
 * The palette the founder chose is always injected as CSS vars
 * (--sf-ink / --sf-ground / --sf-accent) on a wrapper, so every template
 * and block stays palette-agnostic.
 */
export function Storefront({
  data,
  products,
  overrideBlocks,
  selectable = false,
  visitorTheme = 'light',
  installedApps = [],
  categoriesBySlug,
  navPages = [],
  legalPolicies = [],
  overrideMain,
  policyLocale,
  showcaseOnly = false,
  showSouqnaSignature = true,
}: Props) {
  const categories = categoriesBySlug ?? new Map<string, Set<string>>();
  const hasCurrency = !showcaseOnly && installedApps.includes('currency-converter');
  const cartEnabled = !showcaseOnly && data.checkout.paymentMethods.length > 0;
  const cartCurrency = data.checkout.currency;
  const chromeProps = {
    storefrontSlug: data.slug,
    storefrontBaseHref: storefrontBaseUrl(data.slug),
    enabled: cartEnabled,
    currency: cartCurrency,
    navPages,
    legalPolicies,
  };
  // Theme overrides win over the founder's palette pick (the Theme page
  // is the more recent, more granular surface).
  const paletteId = (data.themeOverrides.palette ?? data.palette) as PaletteId;
  const palette = palettes[paletteId] ?? palettes.sand_gold;
  const copy = getCopy(data.locale);
  const vocabulary = getVocabulary(data.locale, data.businessType);

  // Owner theme-lock wins over visitor preference. Default = follow visitor.
  const behaviour = data.themeOverrides.themeBehaviour ?? 'auto';
  const effectiveTheme: Theme =
    behaviour === 'light' ? 'light' : behaviour === 'dark' ? 'dark' : visitorTheme;

  const savedBlocks = overrideBlocks ?? data.publishedBlocks;
  const blocks = savedBlocks.length > 0 ? savedBlocks : bootBlocksFromStorefront(data);
  // Souqy wins over the block pipeline whenever a revision is published
  // AND the caller didn't explicitly pass `overrideBlocks` (preview
  // routes still want to see the JSON draft, not the AI artifact).
  const useSouqy = data.souqyRevision != null && !overrideBlocks;

  const headingWeight = data.themeOverrides.headingWeight;
  const sectionSpacing =
    data.themeOverrides.sectionSpacing === 'tight'
      ? 'clamp(20px, 3vw, 36px)'
      : data.themeOverrides.sectionSpacing === 'spacious'
        ? 'clamp(56px, 8vw, 112px)'
        : 'clamp(36px, 5vw, 64px)';

  const wrapperStyle: React.CSSProperties = {
    ...paletteCssVars(palette, effectiveTheme),
    ['--sf-section-y' as string]: sectionSpacing,
    ...(headingWeight ? { ['--sf-heading-weight' as string]: String(headingWeight) } : {}),
    background: data.themeOverrides.pageBg ?? 'var(--sf-ground)',
    color: 'var(--sf-ink)',
    minHeight: '100dvh',
    colorScheme: effectiveTheme,
  };

  if (overrideMain != null) {
    return (
      <div style={wrapperStyle} dir={data.locale === 'ar' ? 'rtl' : 'ltr'}>
        <PremiumCursor effect={data.themeOverrides.cursorEffect} />
        <BlockBackgroundFrame effect={data.themeOverrides.backgroundEffect}>
        <StorefrontChrome {...chromeProps}>
          {overrideMain}
          {showSouqnaSignature ? (
            <SouqnaSignature locale={data.locale} verified={Boolean(data.crNumber)} />
          ) : null}
          <CustomerTools data={data} showcaseOnly={showcaseOnly} />
          {hasCurrency ? <CurrencyToggle storefrontSlug={data.slug} /> : null}
          <AppScripts storefrontSlug={data.slug} installedAppIds={installedApps} />
          <MawidBanner
            storefrontSlug={data.slug}
            installedAppIds={installedApps}
            locale={data.locale}
          />
        </StorefrontChrome>
        </BlockBackgroundFrame>
      </div>
    );
  }

  if (useSouqy) {
    return (
      <div style={wrapperStyle} dir={data.locale === 'ar' ? 'rtl' : 'ltr'}>
        <PremiumCursor effect={data.themeOverrides.cursorEffect} />
        <BlockBackgroundFrame effect={data.themeOverrides.backgroundEffect}>
        <StorefrontChrome {...chromeProps}>
          <SouqyMount
            data={data}
            products={products}
            categoriesBySlug={categories}
            fallback={
              <FallbackToBlockPipeline
                data={data}
                products={products}
                copy={copy}
                vocabulary={vocabulary}
                blocks={blocks}
                selectable={selectable}
                categoriesBySlug={categories}
              />
            }
          />
          <StorefrontPoliciesPanel storefront={data} locale={policyLocale} />
          {showSouqnaSignature ? (
            <SouqnaSignature locale={data.locale} verified={Boolean(data.crNumber)} />
          ) : null}
          <CustomerTools data={data} showcaseOnly={showcaseOnly} />
          {hasCurrency ? <CurrencyToggle storefrontSlug={data.slug} /> : null}
          <AppScripts storefrontSlug={data.slug} installedAppIds={installedApps} />
          <MawidBanner
            storefrontSlug={data.slug}
            installedAppIds={installedApps}
            locale={data.locale}
          />
        </StorefrontChrome>
        </BlockBackgroundFrame>
      </div>
    );
  }

  {
    const ctx: BlockContext = {
      storefront: data,
      storefrontBaseHref: chromeProps.storefrontBaseHref,
      products,
      theme: data.themeOverrides,
      copy,
      vocabulary,
      isRtl: data.locale === 'ar',
      isPreview: selectable,
      categoriesBySlug: categories,
    };
    return (
      <div style={wrapperStyle} dir={data.locale === 'ar' ? 'rtl' : 'ltr'}>
        <PremiumCursor effect={data.themeOverrides.cursorEffect} />
        <BlockBackgroundFrame effect={data.themeOverrides.backgroundEffect}>
        <StorefrontChrome {...chromeProps}>
          <main
            style={{
              maxWidth: 'min(1280px, 92vw)',
              marginInline: 'auto',
              paddingBlock: 'clamp(24px, 4vw, 56px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sf-section-y)',
            }}
          >
            <BlockRenderer blocks={blocks} ctx={ctx} selectable={selectable} />
          </main>
          <StorefrontPoliciesPanel storefront={data} locale={policyLocale} />
          {showSouqnaSignature ? (
            <SouqnaSignature locale={data.locale} verified={Boolean(data.crNumber)} />
          ) : null}
          <CustomerTools data={data} showcaseOnly={showcaseOnly} />
          {hasCurrency ? <CurrencyToggle storefrontSlug={data.slug} /> : null}
          <AppScripts storefrontSlug={data.slug} installedAppIds={installedApps} />
          <MawidBanner
            storefrontSlug={data.slug}
            installedAppIds={installedApps}
            locale={data.locale}
          />
        </StorefrontChrome>
        </BlockBackgroundFrame>
      </div>
    );
  }
}

function CustomerTools({
  data,
  showcaseOnly,
}: {
  data: StorefrontData;
  showcaseOnly: boolean;
}): ReactNode {
  if (showcaseOnly) return null;
  return (
    <>
      <SouqyCustomerChat
        storefrontSlug={data.slug}
        locale={data.locale}
        businessName={data.businessName}
      />
      <FloatingInquireButton
        storefrontSlug={data.slug}
        locale={data.locale}
        whatsappPhone={data.phone}
        businessName={data.businessName}
      />
    </>
  );
}

/**
 * Fallback render path used when Souqy is published BUT the bundle
 * fails to load at request time (network error, eval failure). We
 * gracefully degrade to whatever the founder had in `published_blocks`
 * — usually the seed layout from the time of `souqyKickoff` — so the
 * storefront stays alive while Souqna ops investigates.
 */
function FallbackToBlockPipeline({
  data,
  products,
  copy,
  vocabulary,
  blocks,
  selectable,
  categoriesBySlug,
}: {
  data: StorefrontData;
  products: Product[];
  copy: ReturnType<typeof getCopy>;
  vocabulary: ReturnType<typeof getVocabulary>;
  blocks: Block[];
  selectable: boolean;
  categoriesBySlug: Map<string, Set<string>>;
}): ReactNode {
  const ctx: BlockContext = {
    storefront: data,
    storefrontBaseHref: storefrontBaseUrl(data.slug),
    products,
    theme: data.themeOverrides,
    copy,
    vocabulary,
    isRtl: data.locale === 'ar',
    isPreview: selectable,
    categoriesBySlug,
  };
  if (blocks.length === 0) {
    blocks = bootBlocksFromStorefront(data);
  }
  return (
    <main
      style={{
        maxWidth: 'min(1280px, 92vw)',
        marginInline: 'auto',
        paddingBlock: 'clamp(24px, 4vw, 56px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sf-section-y)',
      }}
    >
      <BlockRenderer blocks={blocks} ctx={ctx} selectable={selectable} />
    </main>
  );
}
