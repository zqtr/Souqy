import { TemplatePreview } from '@/components/templates/previews';
import { Surface } from '@/components/admin/primitives';
import type { TemplateId } from '@/lib/brief';
import { templatePresets } from '@/lib/templates';

/**
 * Read-only live preview of the storefront's branding identity, sitting
 * beside the editable BrandSettings form. Composed of three layers:
 *  - A miniature header bar showing the logo (or an outlined avatar
 *    fallback) and the business name.
 *  - The active template's parametric SVG preview underneath, with the
 *    template's palette so the founder sees how their brand sits in the
 *    storefront context.
 *  - A small tagline strip if one is set.
 *
 * Server component. Re-renders on save because the parent page passes
 * fresh storefront values.
 */
type Props = {
  businessName: string;
  tagline: string | null;
  logoUrl: string | null;
  templateId: TemplateId;
  locale: 'en' | 'ar';
  labels: {
    section: string;
    storefront: string;
    logoMissing: string;
  };
};

export function BrandPreview({
  businessName,
  tagline,
  logoUrl,
  templateId,
  locale,
  labels,
}: Props) {
  const preset = templatePresets[templateId];
  return (
    <Surface padding={0} style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          borderBottom: '1px solid var(--surface-rule)',
        }}
      >
        {labels.section}
      </div>
      <div
        style={{
          padding: '18px',
          background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <LogoTile logoUrl={logoUrl} initials={initials(businessName)} fallbackLabel={labels.logoMissing} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--ink-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={businessName}
          >
            {businessName}
          </div>
          {tagline ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--ink-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tagline}
            >
              {tagline}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            marginBottom: 10,
          }}
        >
          {labels.storefront}
        </div>
        <TemplatePreview
          templateId={templateId}
          paletteId={preset.palette}
          variant="thumb"
          locale={locale}
        />
      </div>
    </Surface>
  );
}

function LogoTile({
  logoUrl,
  initials,
  fallbackLabel,
}: {
  logoUrl: string | null;
  initials: string;
  fallbackLabel: string;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        width={56}
        height={56}
        style={{
          width: 56,
          height: 56,
          objectFit: 'cover',
          borderRadius: 8,
          background: 'var(--surface-bg)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={fallbackLabel}
      style={{
        width: 56,
        height: 56,
        borderRadius: 8,
        border: '1px dashed color-mix(in srgb, var(--ink-strong) 18%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 16,
        color: 'var(--ink-muted)',
        background: 'var(--surface-bg)',
      }}
    >
      {initials || '—'}
    </div>
  );
}

function initials(name: string): string {
  const tokens = name.trim().split(/\s+/).slice(0, 2);
  return tokens.map((t) => t[0]?.toUpperCase() ?? '').join('');
}
