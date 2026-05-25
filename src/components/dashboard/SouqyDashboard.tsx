'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Storefront } from '@/lib/brief';
import type { SouqyAuditRow } from '@/lib/souqy/db';
import {
  souqyRegenerate,
  souqyReprompt,
  souqyRollback,
  souqyClear,
  type SouqyActionState,
} from '@/app/actions/souqy';

/**
 * Founder-facing Souqy editor.
 *
 * Three columns on wide viewports:
 *
 *   1. **Source viewer** — read-only Monaco-style preview of the
 *      current `index.tsx` + `theme.ts`. Founders rarely edit this
 *      directly; it's there so they can see what Souqy actually wrote.
 *   2. **Re-prompt textarea** — the primary interaction. Plain English
 *      ("make the hero darker, drop the gallery") becomes a new build.
 *   3. **Revision history** — every successful generate/reprompt is a
 *      row; click to roll back.
 *
 * On narrow viewports the columns stack. The whole thing is a single
 * client component because it needs `useTransition` for the long-running
 * generate calls and inline state for the textarea / collapsed source.
 */

type Props = {
  storefront: Storefront;
  audit: SouqyAuditRow[];
};

export function SouqyDashboard({ storefront, audit }: Props) {
  const router = useRouter();
  const isAr = storefront.locale === 'ar';
  const t = isAr ? T_AR : T_EN;
  const [state, setState] = useState<SouqyActionState | null>(null);
  const [request, setRequest] = useState('');
  const [pending, startTransition] = useTransition();
  const [showSource, setShowSource] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(() => Math.floor(Math.random() * 1000));

  const sourceFiles = useMemo(() => parseSource(storefront.souqySource), [storefront.souqySource]);
  const suggestions = useMemo(
    () => pickDashboardSuggestions(suggestionSeed),
    [suggestionSeed],
  );
  const successfulRevisions = useMemo(
    () => audit.filter((row) => row.status === 'success' && row.kind !== 'paywall_hit'),
    [audit],
  );

  function runReprompt() {
    if (!request.trim() || pending) return;
    startTransition(async () => {
      const result = await souqyReprompt({ slug: storefront.slug, request: request.trim() });
      setState(result);
      if (result.status === 'success') {
        setRequest('');
        router.refresh();
      }
    });
  }

  function runRegenerate() {
    if (pending) return;
    startTransition(async () => {
      const result = await souqyRegenerate({ slug: storefront.slug });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  function runRollback(auditId: number) {
    if (pending) return;
    startTransition(async () => {
      const result = await souqyRollback({ slug: storefront.slug, auditId });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  function runClear() {
    if (pending) return;
    if (!window.confirm(t.confirmClear)) return;
    startTransition(async () => {
      const result = await souqyClear({ slug: storefront.slug });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  return (
    <div
      style={{
        padding: 'clamp(20px, 3vw, 36px)',
        maxWidth: 1480,
        margin: '0 auto',
        fontFamily: isAr ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingBottom: 24,
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Souqy · {storefront.slug}
          </p>
          <h1 style={{ margin: '6px 0 0', fontWeight: 400, fontSize: 'clamp(24px, 3vw, 36px)' }}>
            {t.title}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {storefront.souqyRevision
              ? `${t.currentRev}: ${storefront.souqyRevision}`
              : t.noRevYet}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href={`https://${storefront.slug}.souqna.qa`}
            target="_blank"
            rel="noreferrer"
            style={btnGhost(isAr)}
          >
            {t.viewLive} ↗
          </Link>
          {storefront.souqyRevision ? (
            <button type="button" onClick={runClear} disabled={pending} style={btnGhost(isAr)}>
              {t.switchBack}
            </button>
          ) : null}
          <button
            type="button"
            onClick={runRegenerate}
            disabled={pending}
            style={btnPrimary(pending, isAr)}
          >
            {pending ? t.busy : t.regenerate}
          </button>
        </div>
      </header>

      {state?.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      {state?.status === 'success' ? <Alert tone="success">{t.published}</Alert> : null}

      <div
        style={{
          display: 'grid',
          gap: 24,
          marginTop: 32,
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 360px)',
        }}
        className="souqy-dashboard-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <Section title={t.repromptTitle} subtitle={t.repromptHelper}>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder={t.repromptPlaceholder}
              rows={4}
              disabled={pending || !storefront.souqyRevision}
              style={{
                width: '100%',
                background: 'var(--surface-page)',
                border: '1px solid var(--surface-border)',
                borderRadius: 6,
                color: 'var(--text-strong)',
                padding: '14px 16px',
                fontFamily: 'inherit',
                fontSize: 15,
                lineHeight: 1.55,
                resize: 'vertical',
                outline: 'none',
                opacity: pending || !storefront.souqyRevision ? 0.55 : 1,
              }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={runReprompt}
                disabled={pending || !request.trim() || !storefront.souqyRevision}
                style={btnPrimary(pending || !request.trim() || !storefront.souqyRevision, isAr)}
              >
                {pending ? t.busy : t.applyRequest}
              </button>
              {suggestions.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setRequest(ex)}
                  style={btnGhost(isAr)}
                >
                  {ex}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSuggestionSeed((seed) => seed + 5)}
                style={btnGhost(isAr)}
              >
                {t.randomExamples}
              </button>
            </div>
          </Section>

          <Section
            title={t.sourceTitle}
            subtitle={t.sourceHelper}
            action={
              <button
                type="button"
                onClick={() => setShowSource((v) => !v)}
                style={btnGhost(isAr)}
              >
                {showSource ? t.hide : t.show}
              </button>
            }
          >
            {showSource ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(sourceFiles).map(([name, body]) => (
                  <div key={name}>
                    <p
                      style={{
                        margin: '0 0 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {name}
                    </p>
                    <pre
                      dir="ltr"
                      style={{
                        margin: 0,
                        padding: 16,
                        background: 'var(--surface-page)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: 6,
                        overflow: 'auto',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: 'var(--text-strong)',
                        maxHeight: 420,
                      }}
                    >
                      <code>{body}</code>
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                {storefront.souqySource ? t.sourceCollapsed : t.noSourceYet}
              </p>
            )}
          </Section>
        </div>

        <Section title={t.historyTitle} subtitle={t.historyHelper}>
          {successfulRevisions.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{t.noHistory}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {successfulRevisions.map((row) => {
                const meta = row.meta as { revision?: string; bytes?: number; buildMs?: number };
                const isCurrent = meta.revision != null && meta.revision === storefront.souqyRevision;
                return (
                  <li
                    key={row.id}
                    style={{
                      padding: '12px 14px',
                      border: `1px solid ${isCurrent ? 'var(--text-accent)' : 'var(--surface-border)'}`,
                      borderRadius: 6,
                      background: isCurrent ? 'color-mix(in oklab, var(--text-accent) 8%, transparent)' : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatTime(row.occurredAt, isAr)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {row.kind}
                      </span>
                    </div>
                    {row.prompt ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: 'var(--text-strong)',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.prompt}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {meta.bytes != null ? `${(meta.bytes / 1024).toFixed(1)} KB` : ''}
                        {meta.buildMs != null ? ` · ${meta.buildMs} ms` : ''}
                      </span>
                      {isCurrent ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-accent)' }}>
                          {t.currentBadge}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => runRollback(row.id)}
                          disabled={pending}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-accent)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            cursor: pending ? 'default' : 'pointer',
                            padding: 0,
                          }}
                        >
                          {t.rollback} ↺
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqy-dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 10,
        padding: 'clamp(16px, 2.5vw, 28px)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 500, fontSize: 17 }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function Alert({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        marginTop: 16,
        padding: '10px 14px',
        borderRadius: 6,
        background:
          tone === 'success'
            ? 'color-mix(in oklab, #6cb46c 18%, transparent)'
            : 'color-mix(in oklab, #d97a6a 18%, transparent)',
        color: tone === 'success' ? '#3f7a3f' : '#a55044',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </p>
  );
}

function btnPrimary(disabled: boolean, isRtl: boolean): React.CSSProperties {
  return {
    background: disabled ? 'color-mix(in oklab, var(--text-accent) 30%, transparent)' : 'var(--text-accent)',
    color: 'var(--ink-on-accent)',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 999,
    fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer',
  };
}

function btnGhost(isRtl: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--surface-border)',
    color: 'var(--text-strong)',
    padding: '8px 14px',
    borderRadius: 999,
    fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'none',
  };
}

function parseSource(serialized: string | null): Record<string, string> {
  if (!serialized) return {};
  const files: Record<string, string> = {};
  const re = /\n\/\/=== ([\w./-]+) ===\n([\s\S]*?)(?=\n\/\/=== |\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serialized))) {
    const name = m[1];
    const body = m[2];
    if (name && body !== undefined) files[name] = body;
  }
  return files;
}

function formatTime(d: Date, isAr: boolean): string {
  return new Intl.DateTimeFormat(isAr ? 'ar' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const DASHBOARD_PROMPTS = [
  'Make the hero darker, add a gold glow, and keep the copy premium.',
  'Add a delivery and pickup section under the product area.',
  'Rewrite the page to feel more Qatari, warm, and boutique.',
  'Make the layout more compact on mobile and keep the CTA visible.',
  'حوّل الصفحة لأسلوب أفخم مع خلفية داكنة ولمسات ذهبية.',
  'أضف قسم توصيل واستلام واضح بعد المنتجات.',
  'خل النص عربي/إنجليزي بشكل طبيعي وبنبرة قطرية راقية.',
  'رتّب الصفحة للموبايل وخلي زر التواصل أوضح.',
];

function pickDashboardSuggestions(seed: number): string[] {
  return [0, 3, 5].map((offset) => DASHBOARD_PROMPTS[(seed + offset) % DASHBOARD_PROMPTS.length]!);
}

const T_EN = {
  title: 'Souqy editor',
  currentRev: 'Current revision',
  noRevYet: 'No revision yet — kick one off to get started.',
  viewLive: 'View live',
  regenerate: 'Regenerate',
  switchBack: 'Switch back to builder',
  busy: 'Souqy is working…',
  published: 'Published. The live storefront updates within seconds.',
  repromptTitle: 'Re-prompt',
  repromptHelper: 'Plain English. Souqy keeps everything else the same.',
  repromptPlaceholder: 'Make the hero darker. Add a delivery section under the menu.',
  applyRequest: 'Apply',
  randomExamples: 'More ideas',
  sourceTitle: 'Generated source',
  sourceHelper: 'Read-only. The truth lives here.',
  show: 'Show',
  hide: 'Hide',
  sourceCollapsed: 'Hidden — click Show to read the TSX.',
  noSourceYet: 'No source generated yet.',
  historyTitle: 'Revisions',
  historyHelper: 'Every successful build is a row. Click to roll back.',
  noHistory: 'No revisions yet.',
  rollback: 'Roll back',
  currentBadge: 'CURRENT',
  confirmClear:
    'Switch back to the JSON builder? Souqy revisions are preserved and you can switch back at any time.',
};

const T_AR = {
  title: 'محرر سوقي',
  currentRev: 'النسخة الحالية',
  noRevYet: 'لا توجد نسخة بعد — ابدأ واحدة.',
  viewLive: 'مشاهدة',
  regenerate: 'إعادة التوليد',
  switchBack: 'العودة إلى المحرر اليدوي',
  busy: 'سوقي يعمل…',
  published: 'تم النشر. يتحدّث المتجر خلال ثوانٍ.',
  repromptTitle: 'تعديل بالنص',
  repromptHelper: 'بلغتك. سوقي يحافظ على بقية الصفحة كما هي.',
  repromptPlaceholder: 'اجعل البطل أغمق، وأضف قسم توصيل تحت القائمة.',
  applyRequest: 'تطبيق',
  randomExamples: 'اقتراحات أكثر',
  sourceTitle: 'الكود المولّد',
  sourceHelper: 'للقراءة فقط. الحقيقة هنا.',
  show: 'عرض',
  hide: 'إخفاء',
  sourceCollapsed: 'مخفي — اضغط على عرض لقراءة الـ TSX.',
  noSourceYet: 'لم يُولَّد كود بعد.',
  historyTitle: 'النسخ',
  historyHelper: 'كل بناء ناجح هو صف. اضغط للعودة إليه.',
  noHistory: 'لا توجد نسخ بعد.',
  rollback: 'الرجوع',
  currentBadge: 'الحالية',
  confirmClear: 'العودة إلى المحرر اليدوي؟ نسخ سوقي محفوظة ويمكن العودة لاحقًا.',
};
