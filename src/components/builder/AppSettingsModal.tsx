'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { APP_REGISTRY } from '@/lib/apps/registry';
import { AppMark } from '@/components/admin/apps/AppMark';
import {
  loadAppConfigContext,
  type AppConfigContext,
} from '@/app/actions/appConfig';

/**
 * Centered modal that mounts the per-app settings React form directly
 * (no iframe). Each settings form is dynamically imported so the
 * builder bundle stays slim and only the requested form is downloaded.
 *
 * Data flow:
 *   open(appId) → loadAppConfigContext(slug, appId) server action →
 *   render the matching form with its initial settings + supporting
 *   data (products, categories, drops, kits, etc.).
 *
 * Esc, the close button, and clicks outside the panel all dismiss.
 */
const MawidSettingsForm = dynamic(
  () => import('@/components/admin/apps/MawidSettings').then((m) => m.MawidSettingsForm),
  { ssr: false },
);
const TaqimSettingsForm = dynamic(
  () => import('@/components/admin/apps/TaqimSettings').then((m) => m.TaqimSettingsForm),
  { ssr: false },
);
const DropManagerSettingsForm = dynamic(
  () => import('@/components/admin/apps/DropManagerSettings').then((m) => m.DropManagerSettingsForm),
  { ssr: false },
);
const LookbookSettingsForm = dynamic(
  () => import('@/components/admin/apps/LookbookSettings').then((m) => m.LookbookSettingsForm),
  { ssr: false },
);
const CurrencyConverterSettingsForm = dynamic(
  () => import('@/components/admin/apps/CurrencyConverterSettings').then((m) => m.CurrencyConverterSettingsForm),
  { ssr: false },
);
const TikTokPixelSettingsForm = dynamic(
  () => import('@/components/admin/apps/TikTokPixelSettings').then((m) => m.TikTokPixelSettingsForm),
  { ssr: false },
);
const ZapierSettingsForm = dynamic(
  () => import('@/components/admin/apps/ZapierSettings').then((m) => m.ZapierSettingsForm),
  { ssr: false },
);
const NotionSettingsForm = dynamic(
  () => import('@/components/admin/apps/NotionSettings').then((m) => m.NotionSettingsForm),
  { ssr: false },
);
const GoogleSheetsSettingsForm = dynamic(
  () => import('@/components/admin/apps/GoogleSheetsSettings').then((m) => m.GoogleSheetsSettingsForm),
  { ssr: false },
);
const CrispSettingsForm = dynamic(
  () => import('@/components/admin/apps/CrispSettings').then((m) => m.CrispSettingsForm),
  { ssr: false },
);
const IntercomSettingsForm = dynamic(
  () => import('@/components/admin/apps/IntercomSettings').then((m) => m.IntercomSettingsForm),
  { ssr: false },
);
const HubspotSettingsForm = dynamic(
  () => import('@/components/admin/apps/HubspotSettings').then((m) => m.HubspotSettingsForm),
  { ssr: false },
);
const SeoAssistantSettingsForm = dynamic(
  () => import('@/components/admin/apps/SeoAssistantSettings').then((m) => m.SeoAssistantSettingsForm),
  { ssr: false },
);
const AramexSettingsForm = dynamic(
  () => import('@/components/admin/apps/AramexSettings').then((m) => m.AramexSettingsForm),
  { ssr: false },
);

export function AppSettingsModal({
  appId,
  storeSlug,
  onClose,
}: {
  appId: string;
  storeSlug: string;
  onClose: () => void;
}) {
  const app = APP_REGISTRY.find((a) => a.id === appId);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; ctx: AppConfigContext }
  >({ kind: 'loading' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadAppConfigContext(storeSlug, appId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setState({ kind: 'error', message: res.error });
        else setState({ kind: 'ready', ctx: res.context });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load app settings.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [appId, storeSlug]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={app ? `${app.name} settings` : 'App settings'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 12, 10, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(8px, 2.5vw, 28px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'min(900px, 92vh)',
          background: 'var(--surface-bg)',
          color: 'var(--ink-strong)',
          borderRadius: 16,
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 18px',
            borderBottom: '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
            background: 'var(--surface-elevated, transparent)',
          }}
        >
          {app ? <AppMark app={app} size={36} /> : null}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
              }}
            >
              App settings
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 19,
                lineHeight: 1.2,
                color: 'var(--ink-strong)',
              }}
            >
              {app?.name ?? appId}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close app settings"
            style={{
              border: '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
              background: 'transparent',
              borderRadius: 8,
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-strong)',
              cursor: 'pointer',
            }}
          >
            Close · Esc
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'clamp(14px, 2vw, 22px)',
            background: 'var(--surface-bg)',
          }}
        >
          {state.kind === 'loading' ? (
            <Loading />
          ) : state.kind === 'error' ? (
            <ErrorState message={state.message} />
          ) : (
            <FormFor ctx={state.ctx} />
          )}
        </div>
      </div>
    </div>
  );
}

function FormFor({ ctx }: { ctx: AppConfigContext }) {
  const slug = ctx.storefrontSlug;
  const slimProducts = ctx.products.map((p) => ({
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
  }));

  switch (ctx.appId) {
    case 'mawid':
      return (
        <MawidSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.mawidSettings as any}
          products={slimProducts.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl }))}
          categories={ctx.categories}
        />
      );
    case 'taqim':
      return (
        <TaqimSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.taqimSettings as any}
          products={slimProducts.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl }))}
        />
      );
    case 'drop-manager':
      return (
        <DropManagerSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          drops={ctx.drops as any}
          products={slimProducts}
        />
      );
    case 'lookbook':
      return (
        <LookbookSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          kits={ctx.kits as any}
          products={slimProducts}
        />
      );
    case 'currency-converter':
      return (
        <CurrencyConverterSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.ccSettings as any}
        />
      );
    case 'tiktok-pixel':
      return (
        <TikTokPixelSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.tiktokSettings as any}
        />
      );
    case 'zapier':
      return (
        <ZapierSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.zapierSettings as any}
        />
      );
    case 'notion':
      return (
        <NotionSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.notionSettings as any}
        />
      );
    case 'google-sheets':
      return (
        <GoogleSheetsSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.sheetsSettings as any}
        />
      );
    case 'crisp':
      return (
        <CrispSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.crispSettings as any}
        />
      );
    case 'intercom':
      return (
        <IntercomSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.intercomSettings as any}
        />
      );
    case 'hubspot':
      return (
        <HubspotSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.hubspotSettings as any}
        />
      );
    case 'seo-assistant':
      return (
        <SeoAssistantSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.seoSettings as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialReport={ctx.seoReport as any}
        />
      );
    case 'aramex':
      return (
        <AramexSettingsForm
          storefrontSlug={slug}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={ctx.aramexSettings as any}
        />
      );
    default:
      return (
        <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
          This app has no in-builder settings yet. Open it from the marketplace to configure it.
        </div>
      );
  }
}

function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: 10,
            background:
              'linear-gradient(90deg, color-mix(in srgb, var(--ink-strong) 5%, transparent) 0%, color-mix(in srgb, var(--ink-strong) 9%, transparent) 50%, color-mix(in srgb, var(--ink-strong) 5%, transparent) 100%)',
          }}
        />
      ))}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        Loading settings…
      </span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: 16,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, #b54141 35%, transparent)',
        background: 'color-mix(in srgb, #b54141 8%, transparent)',
        color: 'var(--ink-strong)',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
