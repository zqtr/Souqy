import { PageHeader, Surface, StatusBadge } from '@/components/admin/primitives';
import { resolveSettingsContext } from '../_helpers';

/**
 * Languages — Souqna ships fully bilingual storefronts (Arabic + English)
 * out of the box, so there's nothing to "enable" per se. The page exists
 * for parity with Shopify's IA and to let founders confirm which locale
 * is the primary surface.
 */
export default async function LanguagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/languages');
  return (
    <>
      <PageHeader
        eyebrow="Store · Languages"
        title="Languages"
        subtitle="Souqna storefronts are bilingual by design — every block ships in Arabic and English. Pick which one is primary."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        <LangCard
          label="English"
          script="Latin"
          dir="ltr"
          active={storefront.locale === 'en'}
        />
        <LangCard
          label="العربية"
          script="Arabic"
          dir="rtl"
          active={storefront.locale === 'ar'}
        />
      </div>

      <Surface padding={20} style={{ marginTop: 20 }}>
        <h3
          style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 17,
            color: 'var(--ink-strong)',
          }}
        >
          Switching primary language
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--ink-muted)',
          }}
        >
          The primary language is set when you create the store and is used
          for SEO meta tags, the default storefront direction, and the order
          email templates. To change it, send a note to{' '}
          <a
            href="mailto:support@souqna.qa"
            style={{ color: 'var(--admin-accent)' }}
          >
            support@souqna.qa
          </a>{' '}
          — we&rsquo;ll re-issue the storefront with the new locale and migrate
          your block content over. Self-serve switching lands in a follow-up.
        </p>
      </Surface>
    </>
  );
}

function LangCard({
  label,
  script,
  dir,
  active,
}: {
  label: string;
  script: string;
  dir: 'ltr' | 'rtl';
  active: boolean;
}) {
  return (
    <Surface padding={18}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h3
          dir={dir}
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 18,
            color: 'var(--ink-strong)',
          }}
        >
          {label}
        </h3>
        {active ? <StatusBadge tone="success">primary</StatusBadge> : null}
      </header>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-muted)',
          letterSpacing: '0.04em',
        }}
      >
        {script} · {dir.toUpperCase()}
      </p>
    </Surface>
  );
}
