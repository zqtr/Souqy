'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useStorefronts } from './StorefrontContext';
import { SearchGlyph, HelpGlyph, ExternalGlyph } from './glyphs';
import { NotificationsBell } from './NotificationsBell';
import { PLAN_LIMITS, planUnlocksSouqy } from '@/lib/plans';
import { SouqyChatDrawer } from './SouqyChatDrawer';
import { SouqyLogo } from './SouqyLogo';
import { LocaleToggle } from '@/components/souqna/LocaleToggle';
import { adminText } from './adminLocale';
import type { Locale } from '@/i18n/locales';

type SearchResult = {
  type: 'product' | 'order' | 'customer';
  id: string | number;
  title: string;
  subtitle: string;
  href: string;
};

type SearchResponse = {
  products: SearchResult[];
  orders: SearchResult[];
  customers: SearchResult[];
};

const EMPTY_RESULTS: SearchResponse = {
  products: [],
  orders: [],
  customers: [],
};

export function AdminTopBar({ initialSouqyOpen = false }: { initialSouqyOpen?: boolean }) {
  const { active, plan, planPeriodEnd } = useStorefronts();
  const locale = useLocale() as Locale;
  const t = adminText(locale);
  const router = useRouter();
  const [assistantOpen, setAssistantOpen] = useState(initialSouqyOpen);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  const souqyPortalHref = active ? (locale === 'ar' ? '/ar/begin/souqy' : '/begin/souqy') : null;
  const canUseSouqy = planUnlocksSouqy(plan);

  useEffect(() => {
    if (canUseSouqy && window.location.search.includes('souqy=1')) {
      setAssistantOpen(true);
    }
  }, [canUseSouqy]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULTS);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: trimmed });
      if (active?.slug) params.set('store', active.slug);
      fetch(`/api/admin/search?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: SearchResponse | null) => {
          if (!body) return;
          setResults({
            products: Array.isArray(body.products) ? body.products : [],
            orders: Array.isArray(body.orders) ? body.orders : [],
            customers: Array.isArray(body.customers) ? body.customers : [],
          });
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            setResults(EMPTY_RESULTS);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [active?.slug, query]);

  const openResult = (href: string) => {
    setCommandOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: topBarPortalStyles }} />
      <header
        className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-border px-3 backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--surface-bg) 92%, transparent)',
        }}
      >
        <SidebarTrigger className="shrink-0 border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground" />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted px-3 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground md:max-w-xl"
          dir="ltr"
        >
          <SearchGlyph size={15} />
          <span className="min-w-0 flex-1 truncate">{t.searchPlaceholder}</span>
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
            Ctrl K
          </kbd>
        </button>

        <div className="flex flex-1 items-center justify-end gap-2">
          {souqyPortalHref ? (
            <Link
              href={souqyPortalHref}
              className="souqy-portal-link hidden sm:inline-flex"
              aria-label={`${t.viewStore}: ${active?.businessName ?? active?.slug}`}
            >
              <span className="souqy-portal-link-orb" aria-hidden>
                <span />
              </span>
              <span className="souqy-portal-link-label">{t.viewStore}</span>
              <ExternalGlyph size={14} />
            </Link>
          ) : null}

          <IconLink href="/docs" ariaLabel={t.docs} newTab>
            <HelpGlyph size={18} />
          </IconLink>
          <NotificationsBell />
          <ThemeToggle compact />
          <LocaleToggle
            locale={locale}
            mode="account"
            style={{ minHeight: 34, padding: '7px 10px' }}
          />
          <PlanBadge plan={plan} periodEnd={planPeriodEnd} />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title={t.searchTitle}
        description={t.searchDescription}
        className="border-border bg-popover text-popover-foreground"
      >
        <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className={locale === 'ar' ? 'text-right' : 'text-left'}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t.searchInputPlaceholder}
          />
          <CommandList>
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {t.searching}
              </div>
            ) : null}
            <CommandEmpty>
              {query.trim().length < 2 ? t.typeTwo : t.noMatches}
            </CommandEmpty>
            <SearchGroup label={t.products} items={results.products} onSelect={openResult} />
            <SearchGroup label={t.orders} items={results.orders} onSelect={openResult} />
            <SearchGroup label={t.customers} items={results.customers} onSelect={openResult} />
          </CommandList>
        </div>
      </CommandDialog>

      {canUseSouqy ? (
        <SouqyFloatingTrigger hidden={assistantOpen} onOpen={() => setAssistantOpen(true)} />
      ) : null}

      {canUseSouqy ? (
        <SouqyChatDrawer
          open={assistantOpen}
          storefront={active}
          onClose={() => setAssistantOpen(false)}
        />
      ) : null}
    </>
  );
}

function SouqyFloatingTrigger({ hidden, onOpen }: { hidden: boolean; onOpen: () => void }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: souqyLauncherStyles }} />
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open assistant chat"
        title="Open assistant chat"
        className={`souqy-launcher${hidden ? ' is-hidden' : ''}`}
      >
        <span className="souqy-launcher-handle" aria-hidden>
          <SouqyLogo size={54} className="souqy-launcher-logo" />
        </span>
      </button>
    </>
  );
}

const topBarPortalStyles = `
.souqy-portal-link {
  position: relative;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 38px;
  padding: 0 16px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgba(216, 202, 139, 0.58);
  border-radius: 18px;
  color: rgba(255, 252, 240, 0.96);
  background:
    radial-gradient(circle at 13% 48%, rgba(255, 227, 93, 0.24), transparent 16%),
    linear-gradient(110deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.08) 34%, rgba(255, 250, 226, 0.14) 68%, rgba(255, 255, 255, 0.09)),
    rgba(46, 45, 34, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    inset 0 -1px 0 rgba(255, 225, 135, 0.13),
    0 0 0 1px rgba(68, 56, 28, 0.2),
    0 10px 24px rgba(31, 26, 13, 0.12);
  font-size: 14px;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(20px) saturate(1.08);
  -webkit-backdrop-filter: blur(20px) saturate(1.08);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.souqy-portal-link::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  border-radius: 15px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04) 48%, rgba(0, 0, 0, 0.08)),
    radial-gradient(circle at 12% 50%, rgba(255, 225, 102, 0.14), transparent 28%);
  opacity: 1;
  pointer-events: none;
}

.souqy-portal-link::after {
  content: '';
  position: absolute;
  inset: -55% -24%;
  z-index: -2;
  background:
    linear-gradient(105deg, transparent 30%, rgba(255, 252, 224, 0.34) 46%, transparent 62%),
    radial-gradient(circle at 22% 52%, rgba(255, 222, 82, 0.2), transparent 20%);
  transform: translateX(-48%) rotate(8deg);
  opacity: 0;
  animation: souqy-portal-sweep 6.2s ease-in-out infinite;
  pointer-events: none;
}

.souqy-portal-link-orb {
  position: relative;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 999px;
  background:
    radial-gradient(circle at 42% 38%, #ffe985 0 22%, #f7cf48 23% 42%, rgba(117, 92, 28, 0.98) 74%),
    #f5d35e;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.72),
    0 0 0 5px rgba(255, 219, 78, 0.12),
    0 0 18px rgba(255, 223, 88, 0.48);
  animation: souqy-portal-pulse 3.4s ease-in-out infinite;
}

.souqy-portal-link-orb span {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    repeating-linear-gradient(164deg, transparent 0 4px, rgba(18, 17, 12, 0.32) 5px 7px, rgba(255, 255, 255, 0.18) 8px 9px);
  mix-blend-mode: soft-light;
  opacity: 0.78;
}

.souqy-portal-link-label,
.souqy-portal-link svg {
  position: relative;
  z-index: 1;
}

.souqy-portal-link:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 231, 129, 0.72);
  color: #fff9df;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    inset 0 -1px 0 rgba(255, 225, 135, 0.18),
    0 0 0 1px rgba(255, 226, 118, 0.1),
    0 14px 30px rgba(31, 26, 13, 0.16);
}

.souqy-portal-link:active {
  transform: translateY(0);
}

.souqy-portal-link:focus-visible {
  outline: 2px solid color-mix(in srgb, #f5d35e 72%, white);
  outline-offset: 3px;
}

[data-theme='dark'] .souqy-portal-link {
  border-color: rgba(255, 235, 142, 0.36);
  color: rgba(255, 248, 223, 0.96);
  background:
    radial-gradient(circle at 13% 48%, rgba(255, 227, 93, 0.2), transparent 16%),
    linear-gradient(110deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06) 38%, rgba(255, 250, 226, 0.1) 68%, rgba(255, 255, 255, 0.05)),
    rgba(32, 31, 24, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(255, 242, 168, 0.1),
    0 12px 30px rgba(0, 0, 0, 0.24);
}

@keyframes souqy-portal-sweep {
  0%, 28% { transform: translateX(-48%) rotate(8deg); opacity: 0; }
  46% { opacity: 0.7; }
  70%, 100% { transform: translateX(48%) rotate(8deg); opacity: 0; }
}

@keyframes souqy-portal-pulse {
  0%, 100% { transform: scale(1); opacity: 0.78; }
  50% { transform: scale(1.18); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .souqy-portal-link,
  .souqy-portal-link::after,
  .souqy-portal-link-orb {
    animation: none !important;
  }
}
`;

const souqyLauncherStyles = `
.souqy-launcher {
  position: fixed;
  right: 18px;
  bottom: calc(22px + env(safe-area-inset-bottom));
  z-index: 70;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: var(--foreground);
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  isolation: isolate;
  overflow: visible;
  transform: translateY(0) scale(1);
  opacity: 1;
  transition: transform 180ms ease, opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  animation: souqy-launcher-settle 4.6s ease-in-out infinite;
}

.souqy-launcher::before {
  content: '';
  position: absolute;
  inset: 4px;
  z-index: -1;
  border: 1px solid color-mix(in srgb, var(--color-gold) 26%, transparent);
  border-radius: 999px;
  opacity: 0.42;
  transform: scale(1);
  transition: opacity 180ms ease, transform 180ms ease;
}

.souqy-launcher::after {
  content: '';
  position: absolute;
  inset: 8px;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-gold) 18%, transparent), transparent 70%);
  opacity: 0.7;
  transition: opacity 180ms ease;
  pointer-events: none;
}

.souqy-launcher:hover {
  transform: translateY(-2px);
}

.souqy-launcher:hover::before {
  opacity: 1;
  transform: scale(1.02);
}

.souqy-launcher:hover::after {
  opacity: 1;
}

.souqy-launcher:active {
  transform: translateY(-1px) scale(0.99);
}

.souqy-launcher:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--admin-accent) 70%, white);
  outline-offset: 4px;
}

.souqy-launcher.is-hidden {
  pointer-events: none;
  transform: translateY(12px) scale(0.96);
  opacity: 0;
}

.souqy-launcher-handle {
  position: relative;
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  animation: souqy-launcher-mark 3.4s ease-in-out infinite;
}

.souqy-launcher-handle::after {
  display: none;
}

.souqy-launcher-logo {
  position: relative;
  width: 54px;
  height: 54px;
}

[data-theme='dark'] .souqy-launcher {
  background: transparent;
  box-shadow: none;
}

@keyframes souqy-launcher-settle {
  0%, 100% { transform: translateY(0); }
  46% { transform: translateY(0); }
  52% { transform: translateY(-2px); }
  58% { transform: translateY(0); }
}

@keyframes souqy-launcher-mark {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}

@keyframes souqy-launcher-orbit {
  0%, 100% { opacity: 0.42; transform: scale(1); }
  50% { opacity: 0.78; transform: scale(1.06); }
}

@media (max-width: 640px) {
  .souqy-launcher {
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    width: 58px;
    height: 58px;
  }

  .souqy-launcher-handle,
  .souqy-launcher-logo {
    width: 50px;
    height: 50px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .souqy-launcher,
  .souqy-launcher-handle,
  .souqy-launcher-handle::after {
    animation: none !important;
  }
}
`;

function SearchGroup({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: SearchResult[];
  onSelect: (href: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <CommandGroup heading={label}>
      {items.map((item) => (
        <CommandItem
          key={`${item.type}-${item.id}`}
          value={`${item.type} ${item.title} ${item.subtitle}`}
          onSelect={() => onSelect(item.href)}
          className="items-start"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.title}</span>
            <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function PlanBadge({
  plan,
  periodEnd,
}: {
  plan: keyof typeof PLAN_LIMITS;
  periodEnd: string | null;
}) {
  const locale = useLocale();
  const label =
    locale === 'ar'
      ? ({ free: 'مجاني', starter: 'برو', pro: 'برو+', atelier: 'ماكس+' } as Record<string, string>)[plan] ??
        PLAN_LIMITS[plan].label
      : PLAN_LIMITS[plan].label;
  const renews =
    periodEnd && plan !== 'free'
      ? `${locale === 'ar' ? 'يتجدد' : 'Renews'} ${new Date(periodEnd).toLocaleDateString(
          locale === 'ar' ? 'ar-QA' : 'en-GB',
          {
          day: 'numeric',
          month: 'short',
          },
        )}`
      : null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="hidden rounded-full text-xs lg:inline-flex"
    >
      <Link href="/account/settings/plan" title={renews ?? (locale === 'ar' ? 'إدارة الخطة' : 'Manage plan')}>
        <span className="font-semibold">{label}</span>
        {renews ? <span className="text-muted-foreground">{renews}</span> : null}
      </Link>
    </Button>
  );
}

function IconLink({
  href,
  ariaLabel,
  newTab,
  children,
}: {
  href: string;
  ariaLabel: string;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" size="icon">
      <Link
        href={href}
        aria-label={ariaLabel}
        title={ariaLabel}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
      >
        {children}
      </Link>
    </Button>
  );
}
