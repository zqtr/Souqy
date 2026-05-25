'use client';

import { useState, useTransition } from 'react';
import { saveSeoAssistantAction, runSeoAuditAction } from '@/app/actions/apps';
import type {
  SeoAssistantSettings as Settings,
  SeoReport,
} from '@/lib/apps/seo-audit';
import {
  AppSettingsCard,
  AppField,
  AppToggle,
  appCodeInputStyle,
} from './AppSettingsCard';

const SEVERITY_COLOUR: Record<'pass' | 'warn' | 'fail', string> = {
  pass: 'var(--admin-accent)',
  warn: '#a86b18',
  fail: 'var(--color-maroon, #8b3a3a)',
};

export function SeoAssistantSettingsForm({
  storefrontSlug,
  initial,
  initialReport,
}: {
  storefrontSlug: string;
  initial: Settings;
  initialReport: SeoReport;
}) {
  const [allowIndex, setAllowIndex] = useState(initial.allowIndex);
  const [pagespeedKey, setPagespeedKey] = useState(initial.pagespeedKey);
  const [report, setReport] = useState<SeoReport>(initialReport);
  const [pending, start] = useTransition();

  function rerun() {
    start(async () => {
      const res = await runSeoAuditAction({ storefrontSlug });
      if (res.status === 'success' && res.report) {
        setReport(res.report);
      }
    });
  }

  return (
    <>
      <AppSettingsCard
        eyebrow="Customise"
        title="SEO Assistant"
        description="Audits run locally against your storefront, products, and builder blocks. Optionally paste a Google PageSpeed Insights API key to get live Lighthouse scores too."
        onSave={async () =>
          saveSeoAssistantAction({ storefrontSlug, allowIndex, pagespeedKey: pagespeedKey.trim() })
        }
      >
        <AppToggle
          label="Allow search engines to index this storefront"
          hint="By default Souqna keeps brief storefronts noindex. Flip this to opt in once you’re ready to be discovered."
          value={allowIndex}
          onChange={setAllowIndex}
        />
        <AppField
          label="PageSpeed Insights API key (optional)"
          hint="Free key from Google Cloud Console. Unlocks Lighthouse scores in the report below."
        >
          <input
            type="password"
            value={pagespeedKey}
            onChange={(e) => setPagespeedKey(e.target.value)}
            placeholder="AIzaSy…"
            style={appCodeInputStyle}
            autoComplete="off"
          />
        </AppField>
      </AppSettingsCard>

      <div
        style={{
          marginTop: 16,
          padding: 20,
          borderRadius: 14,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--surface-rule)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 14,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--admin-accent)',
              }}
            >
              ◈ Audit
            </div>
            <h3
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 17,
                color: 'var(--ink-strong)',
              }}
            >
              Score · {report.score}/100
            </h3>
          </div>
          <button
            type="button"
            onClick={rerun}
            disabled={pending}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--surface-rule-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: pending ? 'default' : 'pointer',
            }}
          >
            {pending ? 'Running…' : 'Re-run audit'}
          </button>
        </header>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {report.findings.map((f) => (
            <li
              key={f.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
                border: `1px solid color-mix(in srgb, ${SEVERITY_COLOUR[f.severity]} 30%, transparent)`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  marginTop: 6,
                  background: SEVERITY_COLOUR[f.severity],
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-strong)' }}>
                  {f.title}
                </div>
                {f.detail ? (
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-muted)' }}>
                    {f.detail}
                  </p>
                ) : null}
              </div>
              {f.fixHref ? (
                <a
                  href={f.fixHref}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: 'var(--admin-accent)',
                    textDecoration: 'underline',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  Fix →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {report.lighthouse ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <Score label="Performance" value={report.lighthouse.performance} />
            <Score label="Accessibility" value={report.lighthouse.accessibility} />
            <Score label="Best practices" value={report.lighthouse.bestPractices} />
            <Score label="SEO" value={report.lighthouse.seo} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-serif, var(--font-sans))', color: 'var(--ink-strong)' }}>
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </div>
    </div>
  );
}
