import { Eyebrow } from '@/components/primitives/Eyebrow';
import type { PolicyContent } from '@/content/policies';
import type { Locale } from '@/i18n/locales';

type Props = {
  locale: Locale;
  policy: PolicyContent;
};

export function PolicyPage({ locale, policy }: Props) {
  const isRtl = locale === 'ar';
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const displayFontFamily = isRtl ? 'var(--font-arabic-serif)' : 'var(--font-serif)';

  return (
    <article
      className="min-h-dvh px-6 pb-24 pt-36 text-[color:var(--ink-strong)] md:px-12 md:pb-32 md:pt-44"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        background:
          'linear-gradient(color-mix(in srgb, var(--ink-strong) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ink-strong) 8%, transparent) 1px, transparent 1px), var(--surface-bg)',
        backgroundSize: '44px 44px',
      }}
    >
      <div className="mx-auto max-w-[var(--max-w-editorial)]">
        <header className="max-w-[860px]">
          <Eyebrow tone="maroon">{policy.eyebrow}</Eyebrow>
          <h1
            className="m-0 mt-6 text-balance"
            style={{
              fontFamily: displayFontFamily,
              fontWeight: isRtl ? 700 : 300,
              fontSize: 'clamp(42px, 6vw, 92px)',
              lineHeight: isRtl ? 1.08 : 0.95,
              letterSpacing: 0,
            }}
          >
            {policy.title}
          </h1>
          <p
            className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--accent)' }}
          >
            {policy.lastUpdated}
          </p>
          <div
            className="mt-8 max-w-[74ch] space-y-4 text-[17px] leading-[1.75]"
            style={{ color: 'var(--ink-muted)', fontFamily }}
          >
            {policy.intro.map((paragraph) => (
              <p key={paragraph} className="m-0">
                {paragraph}
              </p>
            ))}
          </div>
        </header>

        <div className="mt-14 grid gap-5">
          {policy.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[8px] border p-6 md:p-8"
              style={{
                borderColor: 'var(--surface-rule)',
                background: 'color-mix(in srgb, var(--surface-elevated) 78%, transparent)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <h2
                className="m-0 text-[22px] leading-[1.25] md:text-[26px]"
                style={{
                  fontFamily: displayFontFamily,
                  fontWeight: isRtl ? 700 : 500,
                  letterSpacing: 0,
                }}
              >
                {section.title}
              </h2>
              <div
                className="mt-5 space-y-4 text-[15px] leading-[1.75]"
                style={{ color: 'var(--ink-muted)', fontFamily }}
              >
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="m-0">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="m-0 list-disc space-y-2 ps-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <footer
          className="mt-12 border-t pt-6 text-[15px] leading-[1.7]"
          style={{ borderTopColor: 'var(--surface-rule)', color: 'var(--ink-muted)', fontFamily }}
        >
          <span>{policy.contact.label}</span>{' '}
          <a
            href={`mailto:${policy.contact.email}`}
            className="font-medium text-[color:var(--ink-strong)] underline decoration-[color:var(--accent)] underline-offset-4 transition-colors hover:text-[color:var(--accent)]"
          >
            {policy.contact.email}
          </a>
        </footer>
      </div>
    </article>
  );
}
