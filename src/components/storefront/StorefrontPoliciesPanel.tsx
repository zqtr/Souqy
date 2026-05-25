import type { Storefront as StorefrontData } from '@/lib/brief';
import type { Locale } from '@/i18n/locales';
import {
  normalizePolicyDisplayMode,
  resolveInlinePolicyEntries,
} from '@/lib/storefrontPolicies';

export function StorefrontPoliciesPanel({
  storefront,
  locale,
}: {
  storefront: StorefrontData;
  locale?: Locale;
}): JSX.Element {
  const displayLocale = locale ?? storefront.locale;
  const mode = normalizePolicyDisplayMode(storefront.themeOverrides.policyDisplayMode);
  const entries = resolveInlinePolicyEntries({
    policies: storefront.policies,
    locale: displayLocale,
    businessName: storefront.businessName,
  });
  const isColumns = mode === 'columns';
  const isRtl = displayLocale === 'ar';

  return (
    <section
      aria-label={isRtl ? 'سياسات المتجر' : 'Store policies'}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: 'min(1180px, 92vw)',
        marginInline: 'auto',
        marginTop: 'clamp(52px, 7vw, 92px)',
        paddingBlock: 'clamp(24px, 4vw, 42px)',
        borderTop: '1px solid color-mix(in srgb, var(--sf-accent) 22%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--sf-accent) 14%, transparent)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isColumns
            ? 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))'
            : 'minmax(0, 1fr)',
          gap: isColumns ? 'clamp(22px, 4vw, 48px)' : 'clamp(22px, 3vw, 34px)',
        }}
      >
        {entries.map((entry, index) => (
          <article
            key={entry.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: 0,
              paddingInlineStart: isColumns && index > 0 ? 'clamp(0px, 1.5vw, 20px)' : undefined,
              borderInlineStart:
                isColumns && index > 0
                  ? '1px solid color-mix(in srgb, var(--sf-accent) 16%, transparent)'
                  : undefined,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif), serif',
                fontWeight: 'var(--sf-heading-weight, 500)',
                fontSize: isColumns
                  ? 'clamp(18px, 2.2vw, 24px)'
                  : 'clamp(22px, 3vw, 32px)',
                lineHeight: 1.15,
                color: 'var(--sf-ink)',
              }}
            >
              {entry.title}
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(13.5px, 1.2vw, 15px)',
                lineHeight: 1.75,
                color: 'color-mix(in srgb, var(--sf-ink) 72%, transparent)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
