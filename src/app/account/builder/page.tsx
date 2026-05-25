import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { defaultLocale, isLocale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { getStorefront, getStorefrontsForUser } from '@/lib/brief';
import { getAllProducts } from '@/lib/products';
import { getServerTheme } from '@/components/theme/ServerThemeScript';
import { BuilderShell } from '@/components/builder/BuilderShell';
import { seedBuilderIfEmpty } from '@/app/actions/builder';
import { EmptyState, PageHeader } from '@/components/admin/primitives';
import { listInstalledApps } from '@/lib/apps/installed';
import { getPlan } from '@/lib/billing';
import {
  getHomePage,
  getPageBySlug,
  listPages,
  normalizePageSlug,
} from '@/lib/storefrontPages';

/**
 * Builder route — full-bleed, lives outside the (chrome) group so the
 * sidebar and topbar don't compete with the 3-pane editor for space.
 *
 * The page resolves the active store via `?store=<slug>`, seeds the
 * draft if empty, then hands off to `<BuilderShell>` which owns its
 * own header + publish bar + side panels.
 */
export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: Promise<{
    store?: string | string[];
    page?: string | string[];
    generated?: string | string[];
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/builder');

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const builderCopy = getCopy(locale).builder;

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const requestedPageSlug = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const generatedFlag = Array.isArray(sp.generated) ? sp.generated[0] : sp.generated;
  const souqyLivePublishHint = generatedFlag === '1';
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '60px 24px',
        }}
      >
        <PageHeader
          title={builderCopy.empty.pageTitle}
          subtitle={builderCopy.empty.pageSubtitle}
        />
        <EmptyState
          eyebrow={builderCopy.empty.eyebrow}
          title={builderCopy.empty.title}
          body={builderCopy.empty.body}
          action={{ label: builderCopy.empty.cta, href: '/begin' }}
        />
      </main>
    );
  }
  const known = new Set(storefronts.map((s) => s.slug));
  const slug =
    requested && known.has(requested) ? requested : storefronts[0]!.slug;
  const storefront = await getStorefront(slug);
  if (!storefront) redirect('/account');

  const theme = await getServerTheme();

  // Seed home page (and home-mirrored briefs row) if empty. The action
  // ensures a `home` row exists in `storefront_pages` so the rest of
  // this loader can rely on `listPages(slug)` returning at least one
  // entry.
  await seedBuilderIfEmpty({ slug });

  const allPages = await listPages(slug);

  // Resolve the active page from `?page=<slug>`, falling back to home.
  // The slug is normalised through the same helper the create action
  // uses so a typo'd querystring doesn't 404 — we coerce to home if
  // the requested slug doesn't resolve.
  const wantedSlug = requestedPageSlug
    ? normalizePageSlug(requestedPageSlug)
    : null;
  let activePage =
    (wantedSlug ? await getPageBySlug(slug, wantedSlug) : null) ??
    (await getHomePage(slug));
  if (!activePage) activePage = allPages[0] ?? null;
  if (!activePage) redirect('/account');

  const initialBlocks = activePage.draftBlocks;

  const products = await getAllProducts(slug);
  const installed = await listInstalledApps(slug).catch(() => []);
  const installedAppIds = installed.filter((a) => a.enabled).map((a) => a.appId);
  const callerPlan = await getPlan(userId).catch(() => 'free' as const);

  await currentUser();

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BuilderShell
          locale={locale}
          // Remount cleanly when the founder swaps the active page.
          // The shell snapshots `initialBlocks` into local state on
          // mount, so without a fresh key the canvas would still show
          // the previous page's tree even after the URL changed.
          key={`${slug}:${activePage.id}`}
          slug={slug}
          liveUrl={`https://${slug}.${env.BRIEF_ROOT_DOMAIN}`}
          businessName={storefront.businessName}
          pages={allPages}
          activePageId={activePage.id}
          initialBlocks={initialBlocks}
          publishedAt={
            storefront.publishedAt ? storefront.publishedAt.toISOString() : null
          }
          isPublished={storefront.isPublished}
          productOptions={products.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            imageUrl: p.imageUrl,
            priceQar: p.priceQar,
            status: p.status,
            createdAt: p.createdAt.toISOString(),
            isCustomizable: p.isCustomizable,
            customizationLabel: p.customizationLabel,
            allowCustomSize: p.allowCustomSize,
            requiresHeightInput: p.requiresHeightInput,
            heightInputLabel: p.heightInputLabel,
            heightOptions: p.heightOptions,
          }))}
          categoryOptions={Array.from(
            new Set(
              products
                .map((p) => (p.category ?? '').trim())
                .filter((c): c is string => Boolean(c)),
            ),
          ).sort((a, b) => a.localeCompare(b))}
          initialTheme={storefront.themeOverrides}
          initialPalette={storefront.palette}
          initialTemplate={storefront.templateId}
          initialPolicies={storefront.policies}
          currentPlan={callerPlan}
          // The builder chrome follows the founder's account-wide
          // light/dark preference (the same `souqna-theme` cookie that
          // drives the marketing site, /account, etc.) — and *only*
          // that. We deliberately do not consult
          // `themeOverrides.themeBehaviour` here: that setting controls
          // how the public storefront renders (light-locked,
          // dark-locked, or auto), not how the editor chrome renders
          // around it. Coupling them surprised founders — flipping the
          // storefront to "dark" silently darkened the builder UI too.
          effectiveTheme={theme}
          installedAppIds={installedAppIds}
          souqyLivePublishHint={souqyLivePublishHint}
        />
      </main>
    );
}
