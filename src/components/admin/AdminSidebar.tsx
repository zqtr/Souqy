'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createPortal, flushSync } from 'react-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { RouteSkeleton } from '@/components/system/RouteSkeleton';
import { StoreSwitcher } from './StoreSwitcher';
import { SETTINGS_NAV_SECTIONS } from './settingsNav';
import {
  HomeGlyph,
  OrdersGlyph,
  ProductsGlyph,
  CustomersGlyph,
  InquiriesGlyph,
  MarketingGlyph,
  MessagesGlyph,
  DiscountsGlyph,
  AnalyticsGlyph,
  StorageGlyph,
  AppsGlyph,
  BuilderGlyph,
  SettingsGlyph,
  PosGlyph,
} from './glyphs';
import { adminNavLabel, adminText } from './adminLocale';

type NavItem = {
  href: string;
  label: string;
  glyph: React.ComponentType<{ size?: number }>;
  prefix?: boolean;
};

export type InstalledAppNavItem = {
  id: string;
  name: string;
  glyph: string;
  accentVar: string;
  markSrc?: string;
  enabled: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/account', label: 'Home', glyph: HomeGlyph },
  { href: '/account/orders', label: 'Orders', glyph: OrdersGlyph, prefix: true },
  { href: '/account/products', label: 'Products', glyph: ProductsGlyph, prefix: true },
  { href: '/account/customers', label: 'Customers', glyph: CustomersGlyph, prefix: true },
  { href: '/account/inquiries', label: 'Inquiries', glyph: InquiriesGlyph, prefix: true },
  { href: '/account/marketing', label: 'Marketing', glyph: MarketingGlyph, prefix: true },
  { href: '/account/messages', label: 'Messages', glyph: MessagesGlyph, prefix: true },
  { href: '/account/discounts', label: 'Discounts', glyph: DiscountsGlyph, prefix: true },
  { href: '/account/analytics', label: 'Analytics', glyph: AnalyticsGlyph },
  { href: '/account/storage-library', label: 'Storage', glyph: StorageGlyph, prefix: true },
];

const SALES_CHANNELS_ITEMS: NavItem[] = [
  { href: '/account/builder', label: 'Online store', glyph: BuilderGlyph, prefix: true },
  { href: '/account/pos', label: 'Point of sale', glyph: PosGlyph, prefix: true },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: '/account/settings', label: 'Settings', glyph: SettingsGlyph, prefix: true },
];

const STORE_SCOPED_NAV_EXCLUDED_PREFIXES = ['/account/souqna'] as const;

function isStoreScopedNavHref(href: string): boolean {
  const bare = href.split('?')[0] ?? href;
  return !STORE_SCOPED_NAV_EXCLUDED_PREFIXES.some(
    (prefix) => bare === prefix || bare.startsWith(`${prefix}/`),
  );
}

export function AdminSidebar({
  installedApps = [],
  souqnaOperator = false,
  side = 'left',
}: {
  installedApps?: InstalledAppNavItem[];
  souqnaOperator?: boolean;
  side?: 'left' | 'right';
}) {
  const pathname = usePathname() ?? '/account';
  const locale = useLocale();
  const t = adminText(locale);
  const searchParams = useSearchParams();
  const store = searchParams?.get('store');
  const [mounted, setMounted] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pendingTarget) return;
    const id = window.setTimeout(() => setPendingTarget(null), 8_000);
    return () => window.clearTimeout(id);
  }, [pendingTarget]);

  useEffect(() => {
    if (!pendingTarget) return;
    const targetPath = pendingTarget.split('?')[0] ?? '';
    if (pathname === targetPath || pathname.startsWith(`${targetPath}/`)) {
      const id = window.setTimeout(() => setPendingTarget(null), 320);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [pathname, pendingTarget]);

  const hrefFor = (href: string) =>
    store && isStoreScopedNavHref(href) ? `${href}?store=${encodeURIComponent(store)}` : href;
  const startNavLoading = (href: string) => {
    try {
      const url = new URL(href, window.location.href);
      if (!isStoreScopedNavHref(url.pathname)) {
        setPendingTarget(null);
        return;
      }
      if (url.pathname === window.location.pathname) return;
      flushSync(() => setPendingTarget(url.pathname + url.search));
    } catch {
      // Ignore malformed hrefs; the browser/Next will handle the click.
    }
  };
  const salesChannelsOpen =
    pathname === '/account/builder' ||
    pathname.startsWith('/account/builder/') ||
    pathname === '/account/pos' ||
    pathname.startsWith('/account/pos/');
  const settingsOpen =
    pathname === '/account/settings' || pathname.startsWith('/account/settings/');

  const loadingOverlay =
    mounted && pendingTarget
      ? createPortal(<AdminNavLoadingOverlay target={pendingTarget} />, document.body)
      : null;

  return (
    <>
    <Sidebar
      side={side}
      collapsible="icon"
      className="border-sidebar-border bg-sidebar text-sidebar-foreground"
      aria-label="Admin navigation"
    >
      <SidebarHeader className="gap-3 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={t.souqnaHome}
              className="h-auto items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
            >
              <Link href="/" aria-label={t.souqnaHome} className="flex items-center justify-center">
                <Image
                  src="/favicon.svg"
                  alt=""
                  width={96}
                  height={44}
                  priority
                  className="h-8 w-20 shrink-0 object-contain grayscale opacity-90 [filter:grayscale(1)_contrast(1.08)_brightness(1.08)] group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="group-data-[collapsible=icon]:hidden">
          <StoreSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {settingsOpen ? (
          <SettingsNavMode pathname={pathname} hrefFor={hrefFor} />
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {PRIMARY_ITEMS.map((item) => (
                    <AdminNavItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      href={hrefFor(item.href)}
                      onNavigate={startNavLoading}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <NavGroup
              title={t.salesChannels}
              defaultOpen={salesChannelsOpen}
              items={SALES_CHANNELS_ITEMS}
              pathname={pathname}
              hrefFor={hrefFor}
              onNavigate={startNavLoading}
            />

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <AdminNavItem
                    item={{
                      href: '/account/apps',
                      label: 'Souqna Marketplace',
                      glyph: AppsGlyph,
                      prefix: true,
                    }}
                    pathname={pathname}
                    href={hrefFor('/account/apps')}
                    onNavigate={startNavLoading}
                  />
                  {installedApps.length > 0 ? (
                    <InstalledAppsList
                      apps={installedApps}
                      pathname={pathname}
                      hrefFor={hrefFor}
                      onNavigate={startNavLoading}
                    />
                  ) : null}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {souqnaOperator ? (
              <>
                <SidebarSeparator />
                <NavGroup
                  title={adminNavLabel('Souqna', locale)}
                  defaultOpen={pathname.startsWith('/account/souqna')}
                  items={[
                    {
                      href: '/account/souqna',
                      label: 'Operations',
                      glyph: AnalyticsGlyph,
                      prefix: true,
                    },
                  ]}
                  pathname={pathname}
                  hrefFor={hrefFor}
                  onNavigate={startNavLoading}
                />
              </>
            ) : null}
          </>
        )}
      </SidebarContent>

      {settingsOpen ? null : (
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            {SETTINGS_ITEMS.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                href={hrefFor(item.href)}
                onNavigate={startNavLoading}
              />
            ))}
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail className="after:bg-sidebar-border hover:after:bg-sidebar-foreground/45" />
    </Sidebar>
    {loadingOverlay}
    </>
  );
}

function NavGroup({
  title,
  defaultOpen,
  items,
  pathname,
  hrefFor,
  onNavigate,
}: {
  title: string;
  defaultOpen?: boolean;
  items: NavItem[];
  pathname: string;
  hrefFor: (href: string) => string;
  onNavigate: (href: string) => void;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full justify-between">
            <span
              className="truncate text-[10.5px] font-medium uppercase tracking-[0.14em]"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-muted)',
              }}
            >
              {title}
            </span>
            <span
              aria-hidden
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-foreground/10 text-[11px] font-semibold text-sidebar-foreground/80 opacity-100 transition-[background-color,color,transform] hover:bg-sidebar-foreground/15 hover:text-sidebar-foreground group-data-[state=open]/collapsible:rotate-90"
            >
              &gt;
            </span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <AdminNavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  href={hrefFor(item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function SettingsNavMode({
  pathname,
  hrefFor,
}: {
  pathname: string;
  hrefFor: (href: string) => string;
}) {
  const locale = useLocale();
  const t = adminText(locale);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <span
          className="truncate text-[10.5px] font-medium uppercase tracking-[0.14em]"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-muted)',
          }}
        >
          {t.settings}
        </span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t.backToDashboard}
              className="h-auto min-h-9 items-start gap-3 rounded-lg py-2 text-sidebar-foreground/75"
            >
              <Link href={hrefFor('/account')}>
                <span className="mt-0.5 shrink-0 opacity-75">
                  <HomeGlyph size={16} />
                </span>
                <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
                  {t.backToDashboard}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/account/settings'}
              tooltip={t.settings}
              className="h-auto min-h-10 items-start gap-3 rounded-lg py-2"
            >
              <Link
                href={hrefFor('/account/settings')}
                aria-current={pathname === '/account/settings' ? 'page' : undefined}
              >
                <span className="mt-0.5 shrink-0 opacity-80">
                  <SettingsGlyph size={17} />
                </span>
                <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
                  {t.settingsOverview}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-3 flex flex-col gap-4 group-data-[collapsible=icon]:hidden">
          {SETTINGS_NAV_SECTIONS.map((section) => (
            <nav key={section.id} aria-label={`${adminNavLabel(section.title, locale)} ${t.settings}`}>
              <div
                className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-muted)',
                }}
              >
                {adminNavLabel(section.title, locale)}
              </div>
              <SidebarMenuSub className="mx-0 border-sidebar-border px-2 py-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuSubItem key={item.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={active}
                        size="sm"
                        className="h-auto min-h-7 py-1.5"
                      >
                        <Link
                          href={hrefFor(item.href)}
                          aria-current={active ? 'page' : undefined}
                          title={adminNavLabel(item.label, locale)}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {adminNavLabel(item.label, locale)}
                          </span>
                          {item.soon ? (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.08em]"
                              style={{
                                border:
                                  '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
                                color: 'var(--ink-muted)',
                                fontFamily: 'var(--font-mono)',
                                marginInlineStart: 'auto',
                              }}
                            >
                              {t.soon}
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </nav>
          ))}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AdminNavItem({
  item,
  pathname,
  href,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  href: string;
  onNavigate: (href: string) => void;
}) {
  const active = item.prefix
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : pathname === item.href;
  const Glyph = item.glyph;
  const locale = useLocale();
  const label = adminNavLabel(item.label, locale);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className="h-auto min-h-10 items-start gap-3 rounded-lg py-2"
      >
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          onClick={(event) => {
            if (
              active ||
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            ) {
              return;
            }
            onNavigate(href);
          }}
        >
          <span className="mt-0.5 shrink-0 opacity-80">
            <Glyph size={17} />
          </span>
          <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
            {label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function InstalledAppsList({
  apps,
  pathname,
  hrefFor,
  onNavigate,
}: {
  apps: InstalledAppNavItem[];
  pathname: string;
  hrefFor: (href: string) => string;
  onNavigate: (href: string) => void;
}) {
  return (
    <SidebarMenuSub>
      {apps.map((app) => {
        const base = `/account/apps/${app.id}/configure`;
        const active =
          pathname === base ||
          pathname === `/account/apps/${app.id}` ||
          pathname.startsWith(`${base}/`);
        return (
          <SidebarMenuSubItem key={app.id}>
            <SidebarMenuSubButton
              asChild
              isActive={active}
              className={app.enabled ? '' : 'opacity-55'}
              title={app.enabled ? app.name : `${app.name} paused`}
            >
              <Link
                href={hrefFor(base)}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    active ||
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  onNavigate(hrefFor(base));
                }}
              >
                <AppNavMark app={app} />
                <span>{app.name}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function AdminNavLoadingOverlay({ target }: { target: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        background: 'color-mix(in srgb, var(--surface-bg) 72%, transparent)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        overflow: 'hidden',
        animation: 'souqnaSkelFade 150ms ease-out both',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      >
        <RouteSkeleton pathname={target.split('?')[0] ?? '/account'} />
      </div>
    </div>
  );
}

function AppNavMark({ app }: { app: InstalledAppNavItem }) {
  if (app.markSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={app.markSrc}
        alt=""
        width={16}
        height={16}
        className="block rounded"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex size-4 items-center justify-center rounded text-[8px] font-semibold"
      style={{
        background: `color-mix(in srgb, var(${app.accentVar}) 16%, var(--surface-bg))`,
        border: `1px solid color-mix(in srgb, var(${app.accentVar}) 28%, transparent)`,
        color: `var(${app.accentVar})`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {app.glyph.slice(0, 2)}
    </span>
  );
}
