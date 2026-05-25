import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { getStorefrontsForUser } from '@/lib/brief';
import { listInstalledApps } from '@/lib/apps/installed';
import { APP_REGISTRY } from '@/lib/apps/registry';
import type { AppDescriptor } from '@/lib/apps/types';
import { env } from '@/lib/env';
import { EmptyState } from '@/components/admin/primitives';
import { AppMark } from '@/components/admin/apps/AppMark';
import { adminPhrase } from '@/components/admin/adminLocale';

type MarketplaceApp = {
  app: AppDescriptor;
  ctaHref: string;
  ctaLabel: string;
  configured: boolean;
  installed: boolean;
  primaryCta: boolean;
  setupRequired: boolean;
};

/**
 * Souqna Marketplace shell. The page is intentionally server-rendered:
 * app install/configure routing stays stable, while CSS handles the
 * animated AI signal layer.
 */
export default async function AppsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/apps');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <EmptyState
          eyebrow={t('Marketplace')}
          title={t('Souqna Marketplace')}
          body={t('Marketplace tools are scoped per-storefront. Set up a store to unlock Souqna Marketplace.')}
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }

  const known = storefronts.map((s) => s.slug);
  const storefront =
    storefronts.find((store) => requested && known.includes(requested) && store.slug === requested) ??
    storefronts[0]!;
  const slug = storefront.slug;
  const installed = await listInstalledApps(slug);
  const installedSet = new Set(installed.map((a) => a.appId));
  const availableApps = APP_REGISTRY.filter((app) => app.available);
  const marketplaceApps = availableApps.map((app) =>
    toMarketplaceApp({
      app,
      installed: installedSet.has(app.id),
      storeSlug: slug,
      t,
    }),
  );
  return (
    <div className="souqna-marketplace">
      <MarketplaceHero t={t} />

      <section className="marketplace-section" aria-labelledby="marketplace-apps-title">
        <div className="marketplace-section__header">
          <div>
            <p className="marketplace-kicker">{t('Available in Souqna Marketplace')}</p>
            <h2 id="marketplace-apps-title">{t('AI-ready tools for this store')}</h2>
          </div>
        </div>

        <div className="marketplace-grid">
          {marketplaceApps.map((item, index) => (
            <MarketplaceAppCard
              key={item.app.id}
              item={item}
              index={index}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: marketplaceStyles }} />
    </div>
  );
}

function MarketplaceHero({
  t,
}: {
  t: (text: string) => string;
}) {
  return (
    <section className="marketplace-hero" aria-labelledby="marketplace-title">
      <div className="marketplace-hero__scan" aria-hidden="true" />
      <div className="marketplace-hero__content">
        <div className="marketplace-hero__copy">
          <p className="marketplace-kicker">{t('Marketplace')}</p>
          <h1 id="marketplace-title">{t('Souqna Marketplace')}</h1>
          <p>
            {t('An AI-tuned command center for connecting the tools that help this storefront sell, support, and grow.')}
          </p>
          <div className="marketplace-hero__chips" aria-label={t('Marketplace signals')}>
            <span>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('AI fit scan')}
            </span>
            <span>
              <Zap className="h-4 w-4" aria-hidden="true" />
              {t('Per-storefront install')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketplaceAppCard({
  item,
  index,
  locale,
  t,
}: {
  item: MarketplaceApp;
  index: number;
  locale?: string;
  t: (text: string) => string;
}) {
  const { app, ctaHref, ctaLabel, installed, primaryCta, setupRequired } = item;
  const actionIcon = installed ? CheckCircle2 : ArrowUpRight;
  const ActionIcon = actionIcon;

  return (
    <article className="marketplace-card" style={{ ['--delay' as string]: `${index * 80}ms` }}>
      <div className="marketplace-card__glow" aria-hidden="true" />
      <header className="marketplace-card__header">
        <AppMark app={app} size={64} radius={18} />
        <div className="marketplace-card__title">
          <p>{locale === 'ar' ? `بواسطة ${app.vendor.replace(/^by\s+/i, '')}` : app.vendor}</p>
          <h3>{app.name}</h3>
        </div>
        {installed ? (
          <span className="marketplace-card__status marketplace-card__status--installed">
            {t('installed')}
          </span>
        ) : setupRequired ? (
          <span className="marketplace-card__status marketplace-card__status--setup">
            {t('setup')}
          </span>
        ) : null}
      </header>

      <div className="marketplace-card__body">
        <h4>{t(app.tagline)}</h4>
        <p>{t(app.description)}</p>
      </div>

      {setupRequired ? (
        <p className="marketplace-card__setup-note">
          {t('Operator setup needed before activation')}
        </p>
      ) : null}

      <Link
        href={ctaHref}
        className={[
          'marketplace-card__cta',
          primaryCta ? 'marketplace-card__cta--primary' : '',
          setupRequired ? 'marketplace-card__cta--setup' : '',
        ].filter(Boolean).join(' ')}
      >
        {ctaLabel}
        <ActionIcon className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function toMarketplaceApp({
  app,
  installed,
  storeSlug,
  t,
}: {
  app: AppDescriptor;
  installed: boolean;
  storeSlug: string;
  t: (text: string) => string;
}): MarketplaceApp {
  const configured = isConfigured(app);
  const setupRequired = app.available && !configured && !installed;
  const primaryCta = app.available && !setupRequired && !installed;
  const ctaHref = installed
    ? `/account/apps/${app.id}/configure?store=${storeSlug}`
    : app.available
      ? `/account/apps/${app.id}?store=${storeSlug}`
      : '#';
  const ctaLabel = installed
    ? t('Configure')
    : setupRequired
      ? t('Setup required')
      : app.available
        ? t('View details')
        : t('Coming soon');

  return {
    app,
    configured,
    ctaHref,
    ctaLabel,
    installed,
    primaryCta,
    setupRequired,
  };
}

function isConfigured(app: AppDescriptor): boolean {
  const envReady = (app.requiredEnv ?? []).every((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
  if (!envReady) return false;
  if (app.authKind === 'oauth' || app.authKind === 'api_key') {
    return Boolean(env.APPS_ENCRYPTION_KEY);
  }
  return true;
}

const marketplaceStyles = `
.souqna-marketplace {
  --market-bg: color-mix(in srgb, var(--surface-bg) 82%, #050507);
  --market-panel: color-mix(in srgb, var(--surface-elevated) 88%, #0d0d11);
  --market-line: color-mix(in srgb, var(--ink-strong) 13%, transparent);
  --market-line-strong: color-mix(in srgb, var(--ink-strong) 22%, transparent);
  --market-gold: #d8b56b;
  --market-maroon: #5a202a;
  --market-blue: #6f83ff;
  --market-mint: #7ce7c8;
  color: var(--ink-strong);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.marketplace-kicker {
  margin: 0;
  color: color-mix(in srgb, var(--market-gold) 78%, var(--ink-muted));
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.marketplace-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--market-line);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--market-maroon) 18%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--market-panel) 96%, transparent), var(--market-bg));
  box-shadow: 0 28px 90px color-mix(in srgb, #000 32%, transparent);
}

.marketplace-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--market-gold) 8%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--market-blue) 9%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
  opacity: 0.42;
  transform: translate3d(0, 0, 0);
  animation: marketplace-grid 18s linear infinite;
}

.marketplace-hero__scan {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--market-blue) 16%, transparent) 46%, color-mix(in srgb, var(--market-gold) 20%, transparent) 50%, transparent 54%),
    repeating-linear-gradient(0deg, transparent 0 16px, color-mix(in srgb, var(--ink-strong) 4%, transparent) 17px 18px);
  opacity: 0.5;
  transform: translateX(-85%);
  animation: marketplace-scan 7s ease-in-out infinite;
}

.marketplace-hero__content {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 26px;
  padding: clamp(24px, 4vw, 42px);
}

.marketplace-hero__copy {
  align-self: center;
  max-width: 720px;
}

.marketplace-hero h1 {
  margin: 10px 0 0;
  color: var(--ink-strong);
  font-family: var(--font-sans);
  font-size: clamp(34px, 6vw, 68px);
  font-weight: 720;
  letter-spacing: 0;
  line-height: 0.95;
}

.marketplace-hero__copy > p:not(.marketplace-kicker) {
  margin: 16px 0 0;
  max-width: 680px;
  color: var(--ink-muted);
  font-size: clamp(14px, 1.5vw, 17px);
  line-height: 1.65;
}

.marketplace-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.marketplace-hero__chips span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border: 1px solid var(--market-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-elevated) 72%, transparent);
  color: var(--ink-strong);
  font-size: 12px;
  font-weight: 650;
  padding: 0 12px;
}

.marketplace-hero__chips svg {
  color: var(--market-gold);
}

.marketplace-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.marketplace-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--market-line);
  padding-bottom: 14px;
}

.marketplace-section__header h2 {
  margin: 6px 0 0;
  color: var(--ink-strong);
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 720;
  letter-spacing: 0;
}

.marketplace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.marketplace-card {
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: 320px;
  flex-direction: column;
  border: 1px solid var(--market-line);
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 90%, #111), color-mix(in srgb, var(--surface-bg) 72%, #08080a)),
    var(--surface-elevated);
  padding: 18px;
  box-shadow: 0 20px 60px color-mix(in srgb, #000 18%, transparent);
  opacity: 0;
  transform: translateY(12px);
  animation: marketplace-card-in 520ms ease forwards;
  animation-delay: var(--delay);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.marketplace-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--market-gold) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--market-blue) 6%, transparent) 1px, transparent 1px);
  background-size: 34px 34px;
  opacity: 0;
  transition: opacity 180ms ease;
}

.marketplace-card:hover,
.marketplace-card:focus-within {
  border-color: color-mix(in srgb, var(--market-gold) 42%, var(--market-blue));
  box-shadow: 0 28px 80px color-mix(in srgb, #000 26%, transparent);
  transform: translateY(-2px);
}

.marketplace-card:hover::before,
.marketplace-card:focus-within::before {
  opacity: 1;
}

.marketplace-card__glow {
  position: absolute;
  inset: auto 18px -1px 18px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--market-blue), var(--market-gold), transparent);
  opacity: 0.8;
  transform: translateX(-110%);
  transition: transform 260ms ease;
}

.marketplace-card:hover .marketplace-card__glow,
.marketplace-card:focus-within .marketplace-card__glow {
  transform: translateX(0);
}

.marketplace-card > *:not(.marketplace-card__glow) {
  position: relative;
  z-index: 1;
}

.marketplace-card__header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.marketplace-card__title {
  min-width: 0;
  flex: 1;
}

.marketplace-card__title p {
  margin: 0;
  color: var(--ink-muted);
  font-size: 12px;
}

.marketplace-card__title h3 {
  margin: 3px 0 0;
  color: var(--ink-strong);
  font-size: 20px;
  font-weight: 720;
  line-height: 1.12;
}

.marketplace-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0 9px;
  text-transform: uppercase;
}

.marketplace-card__status--installed {
  border-color: color-mix(in srgb, #8fd6a1 30%, transparent);
  background: color-mix(in srgb, #8fd6a1 12%, transparent);
  color: color-mix(in srgb, #bff2c8 88%, var(--ink-strong));
}

.marketplace-card__status--setup {
  border-color: color-mix(in srgb, var(--market-gold) 34%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--market-gold) 20%, transparent), color-mix(in srgb, var(--market-maroon) 10%, transparent)),
    color-mix(in srgb, var(--surface-elevated) 78%, transparent);
  color: color-mix(in srgb, #f2dfb6 90%, var(--ink-strong));
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
}

.marketplace-card__body {
  margin-top: 20px;
  margin-bottom: auto;
}

.marketplace-card__body h4 {
  margin: 0;
  color: var(--ink-strong);
  font-size: 16px;
  font-weight: 720;
  line-height: 1.35;
}

.marketplace-card__body p {
  margin: 9px 0 0;
  color: var(--ink-muted);
  font-size: 13.5px;
  line-height: 1.6;
}

.marketplace-card__setup-note {
  margin: 18px 0 0;
  border: 1px solid color-mix(in srgb, var(--market-gold) 34%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--market-gold) 16%, transparent), color-mix(in srgb, var(--market-maroon) 10%, transparent)),
    color-mix(in srgb, var(--surface-elevated) 72%, transparent);
  color: color-mix(in srgb, #f2dfb6 88%, var(--ink-strong));
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  padding: 12px 14px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
}

.marketplace-card__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  margin-top: 16px;
  border: 1px solid var(--market-line-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-elevated) 62%, transparent);
  color: var(--ink-strong);
  font-size: 13.5px;
  font-weight: 750;
  text-decoration: none;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.marketplace-card__cta:hover,
.marketplace-card__cta:focus-visible {
  border-color: color-mix(in srgb, var(--market-gold) 50%, transparent);
  background: color-mix(in srgb, var(--market-gold) 16%, var(--surface-elevated));
  outline: none;
}

.marketplace-card__cta--primary {
  border-color: color-mix(in srgb, var(--market-blue) 60%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--market-blue) 80%, #fff), color-mix(in srgb, var(--market-gold) 72%, #fff));
  color: #08080a;
}

.marketplace-card__cta--setup {
  border-color: color-mix(in srgb, var(--market-gold) 40%, transparent);
  background: color-mix(in srgb, var(--market-gold) 13%, var(--surface-elevated));
  color: color-mix(in srgb, #f5e4bd 90%, var(--ink-strong));
}

.marketplace-card__cta--setup:hover,
.marketplace-card__cta--setup:focus-visible {
  border-color: color-mix(in srgb, var(--market-gold) 62%, transparent);
  background: color-mix(in srgb, var(--market-gold) 22%, var(--surface-elevated));
}

@keyframes marketplace-grid {
  from { background-position: 0 0, 0 0; }
  to { background-position: 44px 44px, 44px 44px; }
}

@keyframes marketplace-scan {
  0%, 18% { transform: translateX(-85%); }
  48%, 58% { transform: translateX(85%); }
  100% { transform: translateX(85%); }
}

@keyframes marketplace-card-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 920px) {
  .marketplace-hero__content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .marketplace-hero__content {
    padding: 22px;
  }

  .marketplace-section__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .marketplace-grid {
    grid-template-columns: 1fr;
  }

  .marketplace-card {
    min-height: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .marketplace-hero::before,
  .marketplace-hero__scan,
  .marketplace-card {
    animation: none;
  }

  .marketplace-card {
    opacity: 1;
    transform: none;
  }
}
`;
