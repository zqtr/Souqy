import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import { getAppDescriptor } from '@/lib/apps/registry';
import { getInstalledApp } from '@/lib/apps/installed';
import { getCurrencyConverterSettings } from '@/lib/apps/currency-converter';
import { getAllProducts } from '@/lib/products';
import {
  normaliseSettings as normaliseTikTok,
  DEFAULT_TIKTOK_SETTINGS,
} from '@/lib/apps/tiktok-pixel';
import {
  normaliseSettings as normaliseZapier,
  DEFAULT_ZAPIER_SETTINGS,
} from '@/lib/apps/zapier';
import {
  normaliseSettings as normaliseNotion,
  DEFAULT_NOTION_SETTINGS,
} from '@/lib/apps/notion';
import {
  normaliseSettings as normaliseSheets,
  DEFAULT_SHEETS_SETTINGS,
} from '@/lib/apps/google-sheets';
import {
  normaliseSettings as normaliseCrisp,
  DEFAULT_CRISP_SETTINGS,
} from '@/lib/apps/crisp';
import {
  normaliseSettings as normaliseIntercom,
  DEFAULT_INTERCOM_SETTINGS,
} from '@/lib/apps/intercom';
import {
  normaliseSettings as normaliseHubspot,
  DEFAULT_HUBSPOT_SETTINGS,
} from '@/lib/apps/hubspot';
import {
  normaliseSettings as normaliseSeo,
  DEFAULT_SEO_SETTINGS,
  runAudit,
} from '@/lib/apps/seo-audit';
import {
  normaliseSettings as normaliseAramex,
  DEFAULT_ARAMEX_SETTINGS,
} from '@/lib/apps/aramex';
import { listDrops } from '@/lib/apps/drop-manager';
import { getCategories } from '@/lib/categories';
import { listKits } from '@/lib/apps/lookbook';
import { getMawidSettings } from '@/lib/apps/mawid';
import { getTaqimSettings } from '@/lib/apps/taqim';
import {
  normaliseSettings as normaliseWhatsApp,
  whatsappDigits,
} from '@/lib/apps/whatsapp';
import {
  PageHeader,
  Surface,
  StatusBadge,
} from '@/components/admin/primitives';
import { UninstallButton } from '@/components/admin/apps/UninstallButton';
import { CurrencyConverterPanel } from '@/components/admin/apps/CurrencyConverterPanel';
import { CurrencyConverterSettingsForm } from '@/components/admin/apps/CurrencyConverterSettings';
import { GiphyPanel } from '@/components/admin/apps/GiphyPanel';
import { TikTokPixelSettingsForm } from '@/components/admin/apps/TikTokPixelSettings';
import { ZapierSettingsForm } from '@/components/admin/apps/ZapierSettings';
import { NotionSettingsForm } from '@/components/admin/apps/NotionSettings';
import { GoogleSheetsSettingsForm } from '@/components/admin/apps/GoogleSheetsSettings';
import { CrispSettingsForm } from '@/components/admin/apps/CrispSettings';
import { IntercomSettingsForm } from '@/components/admin/apps/IntercomSettings';
import { HubspotSettingsForm } from '@/components/admin/apps/HubspotSettings';
import { DropManagerSettingsForm } from '@/components/admin/apps/DropManagerSettings';
import { LookbookSettingsForm } from '@/components/admin/apps/LookbookSettings';
import { SeoAssistantSettingsForm } from '@/components/admin/apps/SeoAssistantSettings';
import { AramexSettingsForm } from '@/components/admin/apps/AramexSettings';
import { MawidSettingsForm } from '@/components/admin/apps/MawidSettings';
import { TaqimSettingsForm } from '@/components/admin/apps/TaqimSettings';
import { WhatsAppBusinessSettingsForm } from '@/components/admin/apps/WhatsAppBusinessSettings';
import { AppMark } from '@/components/admin/apps/AppMark';

export default async function AppConfigurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[]; embed?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/apps');
  const { id } = await params;
  const desc = getAppDescriptor(id);
  if (!desc) notFound();

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const embedParam = Array.isArray(sp.embed) ? sp.embed[0] : sp.embed;
  const embed = embedParam === '1';
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) redirect('/begin');
  const known = new Set(storefronts.map((s) => s.slug));
  const slug = requested && known.has(requested) ? requested : storefronts[0]!.slug;

  const installed = await getInstalledApp(slug, desc.id);
  if (!installed) {
    redirect(`/account/apps/${desc.id}?store=${slug}`);
  }

  const ccSettings =
    desc.id === 'currency-converter'
      ? await getCurrencyConverterSettings(slug)
      : null;

  // Pre-load per-plugin settings for the new marketplace apps. Each
  // plugin owns a `normaliseSettings` so the form receives a defaulted
  // shape even when the JSONB blob is empty (first save after install).
  const pluginSettings = installed.settings as Record<string, unknown>;
  const tiktokSettings =
    desc.id === 'tiktok-pixel' ? normaliseTikTok(pluginSettings) ?? DEFAULT_TIKTOK_SETTINGS : null;
  const zapierSettings =
    desc.id === 'zapier' ? normaliseZapier(pluginSettings) ?? DEFAULT_ZAPIER_SETTINGS : null;
  const notionSettings =
    desc.id === 'notion' ? normaliseNotion(pluginSettings) ?? DEFAULT_NOTION_SETTINGS : null;
  const sheetsSettings =
    desc.id === 'google-sheets' ? normaliseSheets(pluginSettings) ?? DEFAULT_SHEETS_SETTINGS : null;
  const crispSettings =
    desc.id === 'crisp' ? normaliseCrisp(pluginSettings) ?? DEFAULT_CRISP_SETTINGS : null;
  const intercomSettings =
    desc.id === 'intercom' ? normaliseIntercom(pluginSettings) ?? DEFAULT_INTERCOM_SETTINGS : null;
  const hubspotSettings =
    desc.id === 'hubspot' ? normaliseHubspot(pluginSettings) ?? DEFAULT_HUBSPOT_SETTINGS : null;
  const seoSettings =
    desc.id === 'seo-assistant' ? normaliseSeo(pluginSettings) ?? DEFAULT_SEO_SETTINGS : null;
  const aramexSettings =
    desc.id === 'aramex' ? normaliseAramex(pluginSettings) ?? DEFAULT_ARAMEX_SETTINGS : null;

  const drops = desc.id === 'drop-manager' ? await listDrops(slug) : null;
  const kits = desc.id === 'lookbook' ? await listKits(slug) : null;
  const mawidSettings = desc.id === 'mawid' ? await getMawidSettings(slug) : null;
  const taqimSettings = desc.id === 'taqim' ? await getTaqimSettings(slug) : null;
  const whatsappSettings =
    desc.id === 'whatsapp-business'
      ? normaliseWhatsApp(installed.settings)
      : null;
  const needsProducts =
    desc.id === 'drop-manager' ||
    desc.id === 'lookbook' ||
    desc.id === 'mawid' ||
    desc.id === 'taqim';
  const slimProducts = needsProducts
    ? (await getAllProducts(slug)).map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
      }))
    : null;
  const seoReport =
    desc.id === 'seo-assistant' ? await runAudit(slug) : null;
  const mawidCategories =
    desc.id === 'mawid'
      ? (await getCategories(slug)).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl,
          productCount: c.productCount,
        }))
      : null;

  return (
    <>
      {embed ? null : (
        <PageHeader
          eyebrow={`Apps · ${desc.name}`}
          title="Configure"
          subtitle={desc.tagline}
          secondaryActions={[{ label: '← Marketplace', href: `/account/apps?store=${slug}` }]}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: embed ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px',
          gap: 20,
          alignItems: 'flex-start',
        }}
        className="souqna-app-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Surface padding={20}>
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 12,
              }}
            >
              <AppMark app={desc} size={48} />
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif, var(--font-sans))',
                    fontWeight: 400,
                    fontSize: 20,
                    color: 'var(--ink-strong)',
                  }}
                >
                  {desc.name}
                </h2>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: 12,
                    color: 'var(--ink-muted)',
                  }}
                >
                  {desc.vendor} · running on this store
                </p>
              </div>
            </header>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: 'var(--ink-strong)',
                lineHeight: 1.6,
              }}
            >
              {desc.description}
            </p>
          </Surface>

          {ccSettings ? (
            <CurrencyConverterSettingsForm
              storefrontSlug={slug}
              initial={ccSettings}
            />
          ) : null}
          {tiktokSettings ? (
            <TikTokPixelSettingsForm storefrontSlug={slug} initial={tiktokSettings} />
          ) : null}
          {zapierSettings ? (
            <ZapierSettingsForm storefrontSlug={slug} initial={zapierSettings} />
          ) : null}
          {notionSettings ? (
            <NotionSettingsForm storefrontSlug={slug} initial={notionSettings} />
          ) : null}
          {sheetsSettings ? (
            <GoogleSheetsSettingsForm storefrontSlug={slug} initial={sheetsSettings} />
          ) : null}
          {crispSettings ? (
            <CrispSettingsForm storefrontSlug={slug} initial={crispSettings} />
          ) : null}
          {intercomSettings ? (
            <IntercomSettingsForm storefrontSlug={slug} initial={intercomSettings} />
          ) : null}
          {hubspotSettings ? (
            <HubspotSettingsForm storefrontSlug={slug} initial={hubspotSettings} />
          ) : null}
          {drops && slimProducts ? (
            <DropManagerSettingsForm
              storefrontSlug={slug}
              drops={drops}
              products={slimProducts}
            />
          ) : null}
          {kits && slimProducts ? (
            <LookbookSettingsForm
              storefrontSlug={slug}
              kits={kits}
              products={slimProducts}
            />
          ) : null}
          {seoSettings && seoReport ? (
            <SeoAssistantSettingsForm
              storefrontSlug={slug}
              initial={seoSettings}
              initialReport={seoReport}
            />
          ) : null}
          {aramexSettings ? (
            <AramexSettingsForm storefrontSlug={slug} initial={aramexSettings} />
          ) : null}
          {mawidSettings && slimProducts ? (
            <MawidSettingsForm
              storefrontSlug={slug}
              initial={mawidSettings}
              products={slimProducts.map((p) => ({
                id: p.id,
                title: p.title,
                imageUrl: p.imageUrl,
              }))}
              categories={mawidCategories ?? []}
            />
          ) : null}
          {taqimSettings && slimProducts ? (
            <TaqimSettingsForm
              storefrontSlug={slug}
              initial={taqimSettings}
              products={slimProducts.map((p) => ({
                id: p.id,
                title: p.title,
                imageUrl: p.imageUrl,
              }))}
            />
          ) : null}
          {whatsappSettings ? (
            <WhatsAppBusinessSettingsForm
              storefrontSlug={slug}
              initial={whatsappSettings}
              connectedPhone={
                typeof installed.providerAccount.displayPhoneNumber === 'string'
                  ? installed.providerAccount.displayPhoneNumber
                  : whatsappDigits(installed)
              }
            />
          ) : null}

          {desc.id === 'currency-converter' ? (
            <CurrencyConverterPanel storefrontSlug={slug} />
          ) : null}
          {desc.id === 'giphy' ? (
            <GiphyPanel
              storefrontSlug={slug}
              installedAt={installed.installedAt.toISOString()}
            />
          ) : null}
          {desc.authKind === 'oauth' ? (
            <OAuthProviderPanel
              providerAccount={installed.providerAccount}
              settings={installed.settings}
              lastError={installed.lastError}
            />
          ) : null}
        </div>

        {embed ? null : (
        <Surface padding={20}>
          <h3
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 17,
              color: 'var(--ink-strong)',
            }}
          >
            Status
          </h3>
          <Row label="On this store">
            <StatusBadge tone={installed.enabled ? 'success' : 'warning'}>
              {installed.enabled ? 'on' : 'off'}
            </StatusBadge>
          </Row>
          <Row label="Installed">
            {installed.installedAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Row>
          {installed.lastSuccessAt ? (
            <Row label="Last refresh">
              {installed.lastSuccessAt.toLocaleString('en-GB')}
            </Row>
          ) : null}
          <div style={{ marginTop: 14 }}>
            <UninstallButton
              storefrontSlug={slug}
              appId={desc.id}
              appName={desc.name}
            />
          </div>
        </Surface>
        )}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-app-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-strong)' }}>{children}</span>
    </div>
  );
}

function OAuthProviderPanel({
  providerAccount,
  settings,
  lastError,
}: {
  providerAccount: Record<string, unknown>;
  settings: Record<string, unknown>;
  lastError: string | null;
}) {
  const gated = providerAccount.gated === true;
  const displayName =
    text(providerAccount.loginName) ||
    text(providerAccount.name) ||
    text(providerAccount.businessName) ||
    text(providerAccount.userName) ||
    'Connected account';
  return (
    <Surface padding={20}>
      <h3
        style={{
          margin: '0 0 12px',
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 17,
          color: 'var(--ink-strong)',
        }}
      >
        Connected account
      </h3>
      <Row label="Account">{displayName}</Row>
      {text(providerAccount.dc) ? <Row label="Data center">{text(providerAccount.dc)}</Row> : null}
      {text(settings.audienceName) ? (
        <Row label="Audience">{text(settings.audienceName)}</Row>
      ) : null}
      {text(providerAccount.displayPhoneNumber) ? (
        <Row label="WhatsApp">{text(providerAccount.displayPhoneNumber)}</Row>
      ) : null}
      {text(settings.catalogName) ? (
        <Row label="Catalog">{text(settings.catalogName)}</Row>
      ) : null}
      {gated ? (
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
          Connected, but this Meta feature still needs the matching Business asset,
          permission, or app review approval before Souqna can sync it.
        </p>
      ) : null}
      {lastError ? (
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-maroon)' }}>
          Last sync issue: {lastError}
        </p>
      ) : null}
    </Surface>
  );
}

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '';
}
