'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import { MetalFrame } from '@/components/primitives/MetalFrame';
import { palette } from '@/lib/tokens';
import { TemplatePreview as ParametricTemplatePreview } from '@/components/templates/previews';
import { isTemplateUnlocked, sortedTemplateIdsForPicker, templatePresets } from '@/lib/templates';
import { PLAN_LIMITS, type Plan } from '@/lib/plans';
import { StorefrontGlyph } from '@/lib/storefront-glyphs';
import {
  createBrief,
  type CreateBriefInput,
  type CreateBriefState,
} from '@/app/actions/createBrief';
import { checkSlugAvailability, type SlugAvailability } from '@/app/actions/checkSlug';
import { importProductsFromCsv } from '@/app/actions/importProducts';
import { env } from '@/lib/env';

/**
 * BeginIntake — the welcoming /begin onboarding flow.
 *
 * Two paths share most of the UI but diverge in the middle:
 *
 *   - "I run a business already" → name + CR (optional) + template + CSV import + launch
 *   - "I'm starting from scratch" → name + business type + template + launch
 *
 * Things this flow no longer asks about (they live in the dashboard now):
 *   palette, tagline, phone, area, hours, instagram, market volume,
 *   payments, founder experience.
 *
 * The slug field has a debounced live availability tracker that hits
 * `checkSlugAvailability` so two founders can never claim the same
 * subdomain. CSV import is invoked optimistically *after* the storefront
 * row is created; failures don't block the launch — they're shown on the
 * dashboard.
 */

type Path = 'have_business' | 'want_to_start';

const ROOT_DOMAIN = env.BRIEF_ROOT_DOMAIN;

type FormState = {
  ownership: '' | Path;
  businessName: string;
  slug: string;
  businessType: '' | CreateBriefInput['businessType'];
  templateId: '' | CreateBriefInput['templateId'];
  crNumber: string;
  logoUrl: string;
  logoPrompt: string;
  /** Honeypot — real users leave it empty; bots fill it. */
  website: string;
  csvFile: File | null;
};

type Props = {
  locale: Locale;
  copy: Copy;
  currentPlan?: Plan;
};

function naiveSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function BeginIntake({ locale, copy, currentPlan = 'free' }: Props) {
  const reduced = useReducedMotion();
  const isRtl = locale === 'ar';
  const t = copy.begin;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    ownership: '',
    businessName: '',
    slug: '',
    businessType: '',
    templateId: '',
    crNumber: '',
    logoUrl: '',
    logoPrompt: '',
    website: '',
    csvFile: null,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugAvailability | { status: 'idle' }>({
    status: 'idle',
  });
  const [createState, setCreateState] = useState<CreateBriefState>({ status: 'idle' });
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';

  // Step plan branches on ownership choice.
  // shared: welcome → name → … → template → summary
  // have_business inserts cr + csv; want_to_start inserts businessType.
  type StepKey =
    | 'welcome'
    | 'name'
    | 'logo'
    | 'businessType'
    | 'cr'
    | 'template'
    | 'csv'
    | 'summary';
  const stepsForPath = (p: '' | Path): StepKey[] => {
    if (p === 'want_to_start')
      return ['welcome', 'name', 'logo', 'businessType', 'template', 'summary'];
    if (p === 'have_business')
      return ['welcome', 'name', 'logo', 'cr', 'template', 'csv', 'summary'];
    return ['welcome'];
  };
  const steps = stepsForPath(form.ownership);
  const currentKey: StepKey = steps[Math.min(step, steps.length - 1)] ?? 'welcome';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (createState.status === 'error') setCreateState({ status: 'idle' });
  }

  // Auto-derive slug from business name unless the founder explicitly typed.
  useEffect(() => {
    if (slugTouched) return;
    const candidate = naiveSlug(form.businessName);
    setForm((prev) => (prev.slug === candidate ? prev : { ...prev, slug: candidate }));
  }, [form.businessName, slugTouched]);

  // Debounced slug availability check. While the request is in flight we
  // park the status at `loading` (NOT `invalid`) so canAdvance can stay
  // permissive — otherwise a slow cold start makes Continue feel dead.
  useEffect(() => {
    if (form.slug.length < 3) {
      setSlugStatus({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setSlugStatus({ status: 'loading', slug: form.slug });
    const handle = window.setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(form.slug);
        if (!cancelled) setSlugStatus(result);
      } catch {
        // Network/server hiccup — let the founder proceed; createBrief
        // re-validates server-side at launch time.
        if (!cancelled) setSlugStatus({ status: 'available', slug: form.slug });
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [form.slug]);

  function canAdvance(key: StepKey): boolean {
    if (key === 'welcome') return form.ownership !== '';
    if (key === 'name') {
      // Pure client-side gate. The live availability check is purely
      // informational (renders a helper line + suggestion) and never
      // blocks Continue — `createBrief` re-checks at launch as the source
      // of truth, so a slow/failed/rate-limited probe can't strand the UI.
      const nameOk = form.businessName.trim().length > 0;
      const slugSyntaxOk = form.slug.length >= 3 && /^[a-z0-9-]+$/.test(form.slug);
      return nameOk && slugSyntaxOk;
    }
    if (key === 'businessType') return form.businessType !== '';
    if (key === 'cr') return true; // optional
    if (key === 'template') return form.templateId !== '';
    if (key === 'csv') return true; // optional
    return true;
  }

  // NOTE: deliberately NOT memoized. canAdvance reads the latest form +
  // slugStatus closures from this render; stable identity here would let
  // a stale goNext run against an outdated form (the "Back+Forward fixes
  // it" bug) — the symptom of memoizing a function whose closures aren't
  // covered by the dep array.
  function goNext() {
    if (step < steps.length - 1 && canAdvance(currentKey)) {
      setStep((s) => s + 1);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (currentKey !== 'summary') {
      goNext();
      return;
    }
    if (!canAdvance(currentKey)) return;

    startTransition(async () => {
      // Default the business type for "have_business" path; this slot is only
      // an explicit step for the "want_to_start" path.
      const businessType =
        form.businessType !== '' ? form.businessType : ('something_else' as const);

      const payload: CreateBriefInput = {
        businessName: form.businessName.trim(),
        ownership: form.ownership as Path,
        businessType,
        templateId: form.templateId as CreateBriefInput['templateId'],
        crNumber: form.crNumber.trim(),
        logoUrl: form.logoUrl.trim(),
        slug: form.slug,
        website: form.website,
        locale,
      };
      const result = await createBrief(payload);
      setCreateState(result);
      if (result.status !== 'success') return;

      // Optimistic CSV import after the row exists. Failures are
      // surfaced but never block the launch.
      if (form.csvFile) {
        try {
          const csv = await form.csvFile.text();
          const importResult = await importProductsFromCsv({ slug: result.slug, csv });
          if (importResult.status === 'success') {
            const tmpl =
              importResult.skipped > 0
                ? t.step6.partial
                    .replace('{n}', String(importResult.inserted))
                    .replace('{skipped}', String(importResult.skipped))
                : t.step6.success.replace('{n}', String(importResult.inserted));
            setImportMessage(tmpl);
          } else {
            setImportMessage(t.step6.failed);
          }
        } catch (err) {
          console.error('[begin] csv import failed', err);
          setImportMessage(t.step6.failed);
        }
      }

      // Land directly in the dashboard so the founder can keep editing.
      window.setTimeout(() => {
        window.location.href = result.dashboardUrl;
      }, 1100);
    });
  }

  if (createState.status === 'success') {
    return (
      <SuccessPanel
        title={t.success.title}
        body={t.success.body}
        url={createState.dashboardUrl}
        importMessage={importMessage}
        fontFamily={fontFamily}
      />
    );
  }

  const errorMessage = createState.status === 'error' ? createState.message : null;
  const stepLabel = `${t.progress.step} ${String(step + 1).padStart(2, '0')} ${t.progress.of} ${String(steps.length).padStart(2, '0')}`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-[6px]"
      style={{
        background:
          'linear-gradient(180deg, rgba(232,220,196,0.05) 0%, rgba(232,220,196,0.02) 100%)',
        border: `1px solid ${palette.gold}24`,
        padding: 'clamp(24px, 3.5vw, 44px)',
        fontFamily,
      }}
    >
      <div aria-hidden style={{ position: 'absolute', left: '-9999px' }}>
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
          />
        </label>
      </div>

      <ProgressBar step={step} total={steps.length} label={stepLabel} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentKey}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.15, 1] }}
        >
          {currentKey === 'welcome' && (
            <WelcomeStep
              t={t.step1}
              value={form.ownership}
              onChange={(v) => {
                update('ownership', v);
                // Reset secondary fields if the founder switches paths
                if (v === 'have_business') update('businessType', '');
                if (v === 'want_to_start') {
                  update('crNumber', '');
                  update('csvFile', null);
                }
              }}
              isRtl={isRtl}
            />
          )}

          {currentKey === 'name' && (
            <NameStep
              t={t.step3}
              businessName={form.businessName}
              slug={form.slug}
              status={slugStatus}
              onBusinessName={(v) => update('businessName', v)}
              onSlug={(v) => {
                setSlugTouched(true);
                update('slug', naiveSlug(v));
              }}
              isRtl={isRtl}
            />
          )}

          {currentKey === 'businessType' && (
            <BusinessTypeStep
              t={t.step2}
              value={form.businessType}
              onChange={(v) => update('businessType', v)}
              isRtl={isRtl}
            />
          )}

          {currentKey === 'logo' && (
            <LogoStep
              businessName={form.businessName}
              logoUrl={form.logoUrl}
              logoPrompt={form.logoPrompt}
              onLogoUrl={(v) => update('logoUrl', v)}
              onLogoPrompt={(v) => update('logoPrompt', v)}
              isRtl={isRtl}
            />
          )}

          {currentKey === 'cr' && (
            <CrStep t={t.step5} value={form.crNumber} onChange={(v) => update('crNumber', v)} />
          )}

          {currentKey === 'template' && (
            <TemplateStep
              t={t.step4}
              value={form.templateId}
              onChange={(v) => update('templateId', v)}
              isRtl={isRtl}
              currentPlan={currentPlan}
            />
          )}

          {currentKey === 'csv' && (
            <CsvStep
              t={t.step6}
              file={form.csvFile}
              onFile={(f) => update('csvFile', f)}
              isRtl={isRtl}
            />
          )}

          {currentKey === 'summary' && <SummaryStep t={t.step7} form={form} isRtl={isRtl} />}
        </motion.div>
      </AnimatePresence>

      {errorMessage && (
        <p
          role="alert"
          className="mt-5"
          style={{
            color: '#f1b1a1',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.03em',
          }}
        >
          {errorMessage}
        </p>
      )}

      <NavRow
        t={t.nav}
        canBack={step > 0 && !pending}
        canNext={canAdvance(currentKey) && !pending}
        canSkip={currentKey === 'logo' || currentKey === 'cr' || currentKey === 'csv'}
        isLast={currentKey === 'summary'}
        pending={pending}
        isRtl={isRtl}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onSkip={() => {
          if (currentKey === 'cr') update('crNumber', '');
          if (currentKey === 'logo') {
            update('logoUrl', '');
            update('logoPrompt', '');
          }
          if (currentKey === 'csv') update('csvFile', null);
          goNext();
        }}
        fontFamily={fontFamily}
      />

      <p
        className="mt-7"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(232,220,196,0.4)',
          letterSpacing: '0.04em',
          lineHeight: 1.6,
        }}
      >
        {t.pledge}
      </p>
    </form>
  );
}

function ProgressBar({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div
      className="flex items-center justify-between mb-7"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'rgba(232,220,196,0.5)',
        letterSpacing: '0.05em',
      }}
    >
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: step === i ? 28 : 14,
              height: 2,
              background: i <= step ? palette.gold : 'rgba(232,220,196,0.2)',
              transition: 'all 400ms cubic-bezier(.2,.7,.3,1)',
            }}
          />
        ))}
      </div>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</span>
    </div>
  );
}

function StepHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-7">
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: palette.gold,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <h2
        className="m-0 text-balance"
        style={{
          color: 'var(--color-sand-pale)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: 'clamp(26px, 3vw, 38px)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className="mt-3"
          style={{
            color: 'rgba(232,220,196,0.65)',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            lineHeight: 1.6,
            margin: 0,
            maxWidth: '60ch',
          }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function WelcomeStep({
  t,
  value,
  onChange,
  isRtl,
}: {
  t: Copy['begin']['step1'];
  value: '' | Path;
  onChange: (v: Path) => void;
  isRtl: boolean;
}) {
  // Souqy card copy is intentionally inline rather than threaded through
  // the bilingual `Copy` type so adding the paid-tier shortcut doesn't
  // require touching every consumer of `step1`. Translation parity is
  // preserved in the only string that visibly changes (the helper line).
  const souqy = isRtl
    ? {
        label: 'دع سوقي يبني المتجر',
        helper:
          'استوديو ذكاء اصطناعي يكتب متجرًا متكاملًا — تصميم، نسخ، صور — تتمكّن من تعديله بنفسك.',
        chip: 'باقة مدفوعة',
      }
    : {
        label: 'Let Souqy build it for you',
        helper:
          'An AI atelier writes a full storefront — code, copy, imagery — that you can keep editing.',
        chip: 'Paid tier',
      };
  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {t.ownership.options.map((opt) => {
          const active = value === opt.id;
          const id = opt.id as Path;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              style={{
                position: 'relative',
                padding: '24px 22px',
                background: active ? 'rgba(201,169,97,0.10)' : 'rgba(232,220,196,0.02)',
                border: `1px solid ${active ? palette.gold : 'rgba(232,220,196,0.18)'}`,
                color: 'var(--color-sand-pale)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 14,
                textAlign: isRtl ? 'right' : 'left',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'all 220ms',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 10,
                minHeight: 130,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 20,
                  color: active ? palette.gold : 'rgba(201,169,97,0.55)',
                }}
              >
                {id === 'have_business' ? '◈' : '◯'}
              </span>
              <span style={{ fontWeight: 500, fontSize: 18, color: 'var(--color-sand-pale)' }}>
                {opt.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'rgba(232,220,196,0.6)',
                  lineHeight: 1.55,
                }}
              >
                {opt.helper}
              </span>
            </button>
          );
        })}
      </div>

      <MetalFrame
        strength={0.65}
        borderRadius={6}
        style={{ display: 'flex', width: '100%', marginTop: 18 }}
      >
        <a
        href="/begin/souqy"
        className="souqy-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          width: '100%',
          padding: '20px 22px',
          background: 'linear-gradient(135deg, rgba(201,169,97,0.12), rgba(201,169,97,0.04))',
          border: `1px solid ${palette.gold}55`,
          borderRadius: 6,
          textDecoration: 'none',
          color: 'var(--color-sand-pale)',
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          textAlign: isRtl ? 'right' : 'left',
          transition: 'all 220ms',
          flexDirection: isRtl ? 'row-reverse' : 'row',
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 28,
            color: palette.gold,
            fontFamily: 'var(--font-serif), serif',
            fontStyle: 'italic',
            flex: '0 0 auto',
            lineHeight: 1,
          }}
        >
          ✶
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              flexWrap: 'wrap',
              flexDirection: isRtl ? 'row-reverse' : 'row',
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 18 }}>{souqy.label}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: palette.gold,
                border: `1px solid ${palette.gold}66`,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {souqy.chip}
            </span>
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 6,
              fontSize: 13,
              color: 'rgba(232,220,196,0.65)',
              lineHeight: 1.55,
            }}
          >
            {souqy.helper}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            color: palette.gold,
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            transform: isRtl ? 'scaleX(-1)' : undefined,
          }}
        >
          →
        </span>
        </a>
      </MetalFrame>
    </div>
  );
}

function NameStep({
  t,
  businessName,
  slug,
  status,
  onBusinessName,
  onSlug,
  isRtl,
}: {
  t: Copy['begin']['step3'];
  businessName: string;
  slug: string;
  status: SlugAvailability | { status: 'idle' };
  onBusinessName: (v: string) => void;
  onSlug: (v: string) => void;
  isRtl: boolean;
}) {
  const idBase = useId();
  const previewSlug = slug || 'your-name';

  let statusNode: React.ReactNode = null;
  let statusColor = 'rgba(232,220,196,0.5)';
  if (slug.length >= 3) {
    if (status.status === 'available') {
      statusColor = '#9bc89b';
      statusNode = (
        <>
          <span aria-hidden>✓</span> {t.helpers.slugAvailable}
        </>
      );
    } else if (status.status === 'taken') {
      statusColor = '#f1b1a1';
      statusNode = (
        <>
          <span aria-hidden>✗</span> {t.helpers.slugTaken}{' '}
          <button
            type="button"
            onClick={() => onSlug(status.suggestion)}
            style={{
              background: 'transparent',
              border: 'none',
              color: palette.gold,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {status.suggestion}
          </button>
        </>
      );
    } else if (status.status === 'reserved' || status.status === 'rate_limited') {
      statusColor = '#f1b1a1';
      statusNode = t.helpers.slugReserved;
    } else if (status.status === 'loading') {
      statusColor = 'rgba(232,220,196,0.5)';
      statusNode = t.helpers.slugChecking;
    }
  }

  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />

      <div className="flex flex-col gap-6">
        <Field
          id={`${idBase}-biz`}
          label={t.labels.businessName}
          value={businessName}
          onChange={onBusinessName}
          autoComplete="organization"
          placeholder={t.placeholders.businessName}
          isRtl={isRtl}
        />

        <div>
          <FormLabel htmlFor={`${idBase}-slug`}>{t.labels.slug}</FormLabel>
          <div className="flex items-baseline gap-2 mt-2 flex-wrap" dir="ltr">
            <input
              id={`${idBase}-slug`}
              type="text"
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${palette.gold}66`,
                color: palette.gold,
                padding: '8px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 18,
                letterSpacing: '0.01em',
                outline: 'none',
                width: '100%',
                minWidth: 0,
                maxWidth: 280,
              }}
            />
            <span
              style={{
                color: 'rgba(232,220,196,0.55)',
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                wordBreak: 'break-all',
              }}
            >
              .{ROOT_DOMAIN}
            </span>
          </div>

          <p
            className="mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'rgba(232,220,196,0.5)',
              letterSpacing: '0.03em',
            }}
          >
            {t.helpers.slug}
          </p>
          {statusNode ? (
            <p
              className="mt-2"
              role="status"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: statusColor,
                letterSpacing: '0.03em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {statusNode}
            </p>
          ) : null}
        </div>

        <div
          className="rounded-[3px] flex items-center gap-3"
          style={{
            background: 'rgba(201,169,97,0.06)',
            border: `1px solid ${palette.gold}33`,
            padding: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: palette.gold,
            letterSpacing: '0.03em',
          }}
        >
          <span aria-hidden>◈</span>
          <span>
            {t.preview}{' '}
            <strong style={{ fontWeight: 500 }}>
              {previewSlug}.{ROOT_DOMAIN}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function BusinessTypeStep({
  t,
  value,
  onChange,
  isRtl,
}: {
  t: Copy['begin']['step2'];
  value: FormState['businessType'];
  onChange: (v: FormState['businessType']) => void;
  isRtl: boolean;
}) {
  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {t.options.map((opt) => {
          const active = value === opt.id;
          const typeId = opt.id as Exclude<FormState['businessType'], ''>;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(typeId)}
              style={{
                padding: '14px 12px',
                background: active ? 'rgba(201,169,97,0.15)' : 'transparent',
                border: `1px solid ${active ? palette.gold : 'rgba(232,220,196,0.18)'}`,
                color: active ? palette.gold : 'var(--color-sand-pale)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 13,
                textAlign: isRtl ? 'right' : 'left',
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 180ms',
                minHeight: 84,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  flex: '0 0 auto',
                  color: active ? palette.gold : 'rgba(232,220,196,0.5)',
                }}
              >
                <StorefrontGlyph type={typeId} size={28} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{opt.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: active ? 'rgba(201,169,97,0.75)' : 'rgba(232,220,196,0.5)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {opt.helper}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogoStep({
  businessName,
  logoUrl,
  logoPrompt,
  onLogoUrl,
  onLogoPrompt,
  isRtl,
}: {
  businessName: string;
  logoUrl: string;
  logoPrompt: string;
  onLogoUrl: (v: string) => void;
  onLogoPrompt: (v: string) => void;
  isRtl: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBase = useId();
  const copy = isRtl
    ? {
        eyebrow: 'الشعار',
        title: 'عندك شعار؟',
        sub: 'إذا ما عندك، اكتب وصف بسيط وسوقي يولّد أيقونة جاهزة للمتجر.',
        prompt: 'وصف الأيقونة',
        placeholder: 'مثال: حرف عربي هندسي مع لمسة ذهبية لبراند عطور',
        button: 'ولّد أيقونة',
        busy: 'سوقي يولّد بالذكاء الاصطناعي...',
        ready: 'تم تجهيز الأيقونة. تقدر تكمل أو تولّد نسخة ثانية.',
        empty: 'أيقونة مؤقتة',
        remove: 'إزالة',
        failed: 'تعذر توليد الأيقونة الآن. جرّب وصف أقصر أو كمل بدون شعار.',
      }
    : {
        eyebrow: 'Logo',
        title: 'Do you have a logo?',
        sub: 'If not, write a quick prompt and Souqy will generate a storefront-ready icon.',
        prompt: 'Icon prompt',
        placeholder:
          'Example: geometric Arabic monogram with a warm gold accent for a perfume brand',
        button: 'Generate icon',
        busy: 'Souqy is generating with AI...',
        ready: 'Icon ready. Continue, or generate another version.',
        empty: 'Placeholder icon',
        remove: 'Remove',
        failed:
          'Could not generate the icon right now. Try a shorter prompt or continue without a logo.',
      };

  async function generateIcon() {
    const prompt = logoPrompt.trim();
    if (prompt.length < 8 || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const icon = await generatePromptIconPng(prompt, businessName);
      onLogoUrl(icon);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <StepHeading eyebrow={copy.eyebrow} title={copy.title} sub={copy.sub} />
      <div className="grid gap-5 md:grid-cols-[160px_1fr]" style={{ alignItems: 'center' }}>
        <div
          aria-label={logoUrl ? copy.ready : copy.empty}
          role="img"
          style={{
            width: 148,
            height: 148,
            borderRadius: '50%',
            border: `1px solid ${logoUrl ? palette.gold : 'rgba(232,220,196,0.22)'}`,
            background: logoUrl
              ? 'rgba(201,169,97,0.08)'
              : 'radial-gradient(circle at 35% 25%, rgba(201,169,97,0.22), rgba(232,220,196,0.04) 48%, rgba(22,21,18,0.3))',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: logoUrl ? '0 18px 42px rgba(0,0,0,0.26)' : undefined,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ProfileIcon />
          )}
          {generating ? <LogoLoadingRing /> : null}
        </div>

        <div>
          <FormLabel htmlFor={`${idBase}-logo-prompt`}>{copy.prompt}</FormLabel>
          <div className="mt-2 flex gap-2" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <input
              id={`${idBase}-logo-prompt`}
              type="text"
              value={logoPrompt}
              onChange={(e) => onLogoPrompt(e.target.value)}
              placeholder={copy.placeholder}
              dir="auto"
              maxLength={220}
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void generateIcon();
                }
              }}
              style={{
                width: '100%',
                minWidth: 0,
                border: `1px solid ${generating ? palette.gold : 'rgba(232,220,196,0.22)'}`,
                borderRadius: 999,
                background: 'rgba(232,220,196,0.04)',
                color: 'var(--color-sand-pale)',
                padding: '12px 15px',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void generateIcon()}
              disabled={generating || logoPrompt.trim().length < 8}
              style={{
                flex: '0 0 auto',
                border: 'none',
                borderRadius: 999,
                background:
                  generating || logoPrompt.trim().length < 8
                    ? 'rgba(201,169,97,0.32)'
                    : palette.gold,
                color: palette.ink,
                padding: '0 16px',
                minHeight: 44,
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 500,
                cursor: generating || logoPrompt.trim().length < 8 ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              {generating ? (
                <>
                  <MiniSpinner /> {copy.busy}
                </>
              ) : (
                copy.button
              )}
            </button>
          </div>
          <div
            className="mt-3 flex items-center gap-3"
            style={{
              minHeight: 22,
              flexDirection: isRtl ? 'row-reverse' : 'row',
              justifyContent: isRtl ? 'flex-end' : 'flex-start',
            }}
          >
            {error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: '#f1b1a1',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.03em',
                  lineHeight: 1.45,
                }}
              >
                {error}
              </p>
            ) : logoUrl ? (
              <>
                <p
                  role="status"
                  style={{
                    margin: 0,
                    color: '#9bc89b',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.03em',
                  }}
                >
                  {copy.ready}
                </p>
                <button
                  type="button"
                  onClick={() => onLogoUrl('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'rgba(232,220,196,0.55)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {copy.remove}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

async function generatePromptIconPng(prompt: string, businessName: string): Promise<string> {
  type GenerateResponse =
    | { status: 'success'; assets: Array<{ kind: string; url: string; mimeType: string }> }
    | { status: 'error'; message: string };
  const response = await fetch('/api/souqy-studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${businessName ? `${businessName}: ` : ''}${prompt}. Create a premium AI-generated storefront icon logo. Raster image only, no SVG.`,
      template: 'logo',
      locale: document.documentElement.lang === 'ar' ? 'ar' : 'en',
      references: [],
    }),
  });
  const result = (await response.json().catch(() => null)) as GenerateResponse | null;
  if (!result) throw new Error('Souqy Studio returned an empty response.');
  if (result.status === 'error') throw new Error(result.message);
  const logo = result.assets.find((asset) => asset.kind === 'logo') ?? result.assets[0];
  if (!logo?.url) throw new Error('Souqy did not return an icon.');
  if (logo.mimeType === 'image/svg+xml') throw new Error('Souqy returned SVG instead of a raster icon.');
  return logo.url;
}

function ProfileIcon() {
  return (
    <svg
      width="78"
      height="78"
      viewBox="0 0 78 78"
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="39" cy="39" r="37" stroke="rgba(201,169,97,0.58)" strokeWidth="1.5" />
      <circle cx="39" cy="30" r="12" fill="rgba(232,220,196,0.24)" />
      <path
        d="M18 62c4.8-13.2 13.1-19.8 21-19.8S55.2 48.8 60 62"
        stroke="rgba(232,220,196,0.45)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoLoadingRing() {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360, opacity: [0.58, 1, 0.58] }}
      transition={{
        rotate: { duration: 1.1, repeat: Infinity, ease: 'linear' },
        opacity: { duration: 1.3, repeat: Infinity },
      }}
      style={{
        position: 'absolute',
        inset: 8,
        borderRadius: '50%',
        border: `2px solid ${palette.gold}`,
        borderInlineStartColor: 'transparent',
        boxShadow: `0 0 26px ${palette.gold}55`,
      }}
    />
  );
}

function MiniSpinner() {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        border: `2px solid ${palette.ink}66`,
        borderTopColor: palette.ink,
        display: 'inline-block',
      }}
    />
  );
}

function CrStep({
  t,
  value,
  onChange,
}: {
  t: Copy['begin']['step5'];
  value: string;
  onChange: (v: string) => void;
}) {
  const idBase = useId();
  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <Field
        id={`${idBase}-cr`}
        label={t.labels.crNumber}
        value={value}
        onChange={onChange}
        placeholder={t.placeholders.crNumber}
        isRtl={false}
        autoComplete="off"
      />
      <p
        className="mt-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(232,220,196,0.5)',
          letterSpacing: '0.03em',
        }}
      >
        {t.helpers.crNumber}
      </p>
    </div>
  );
}

function TemplateStep({
  t,
  value,
  onChange,
  isRtl,
  currentPlan,
}: {
  t: Copy['begin']['step4'];
  value: FormState['templateId'];
  onChange: (v: FormState['templateId']) => void;
  isRtl: boolean;
  currentPlan: Plan;
}) {
  const optionsById = new Map(t.options.map((opt) => [opt.id, opt]));
  const orderedOptions = sortedTemplateIdsForPicker()
    .map((id) => optionsById.get(id))
    .filter((opt): opt is (typeof t.options)[number] => Boolean(opt));

  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {orderedOptions.map((opt) => {
          const active = value === opt.id;
          const tid = opt.id as Exclude<FormState['templateId'], ''>;
          const preset = templatePresets[tid];
          const unlocked = isTemplateUnlocked(tid, currentPlan);
          const minLabel = PLAN_LIMITS[preset.tier].label;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (!unlocked) {
                  window.location.href = '/account/settings/plan';
                  return;
                }
                onChange(tid);
              }}
              style={{
                padding: 0,
                background: 'transparent',
                border: `1px solid ${active ? palette.gold : 'rgba(232,220,196,0.18)'}`,
                color: 'var(--color-sand-pale)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                textAlign: isRtl ? 'right' : 'left',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'all 200ms',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: !unlocked
                  ? '0 0 0 1px rgba(201,169,97,0.14), 0 18px 40px rgba(0,0,0,0.22)'
                  : undefined,
              }}
            >
              <TemplateTierBadge plan={preset.tier} />
              {!unlocked ? <UpgradeRibbon label={`Upgrade to ${minLabel}`} /> : null}
              <div
                aria-hidden
                style={{
                  background: 'color-mix(in srgb, var(--color-charcoal) 86%, transparent)',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: active ? 1 : 0.94,
                  transition: 'opacity 200ms',
                }}
              >
                <ParametricTemplatePreview
                  templateId={tid}
                  paletteId={preset.palette}
                  variant="card"
                  locale={isRtl ? 'ar' : 'en'}
                  dimmed={!unlocked}
                />
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  background: active ? 'rgba(201,169,97,0.10)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 16,
                    color: active ? palette.gold : 'var(--color-sand-pale)',
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: active ? 'rgba(201,169,97,0.75)' : 'rgba(232,220,196,0.55)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.02em',
                    marginTop: 6,
                    lineHeight: 1.55,
                  }}
                >
                  {opt.helper}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function TemplateTierBadge({ plan }: { plan: Plan }) {
  const limits = PLAN_LIMITS[plan];
  return (
    <span
      aria-label={`${limits.label} template`}
      style={{
        position: 'absolute',
        zIndex: 3,
        top: 10,
        insetInlineEnd: 10,
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid rgba(241,233,215,0.30)',
        background:
          plan === 'free'
            ? 'rgba(22,21,18,0.44)'
            : 'linear-gradient(135deg, rgba(201,169,97,0.95), rgba(91,39,31,0.92))',
        color: '#fff',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
      }}
    >
      {limits.label}
    </span>
  );
}

function UpgradeRibbon({ label }: { label: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ y: [0, -4, 0], opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        zIndex: 3,
        insetInlineStart: 12,
        bottom: 98,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(22,21,18,0.78)',
        border: `1px solid ${palette.gold}`,
        color: palette.gold,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
      }}
    >
      {label}
    </motion.span>
  );
}

function CsvStep({
  t,
  file,
  onFile,
  isRtl,
}: {
  t: Copy['begin']['step6'];
  file: File | null;
  onFile: (f: File | null) => void;
  isRtl: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          border: `1px dashed ${file ? palette.gold + '88' : 'rgba(232,220,196,0.25)'}`,
          borderRadius: 6,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
          background: file ? 'rgba(201,169,97,0.06)' : 'rgba(232,220,196,0.02)',
        }}
      >
        <div
          aria-hidden
          style={{
            fontFamily: 'var(--font-serif), serif',
            fontSize: 32,
            color: file ? palette.gold : 'rgba(232,220,196,0.45)',
          }}
        >
          {file ? '✓' : '↥'}
        </div>
        <div
          style={{
            fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
            color: 'var(--color-sand-pale)',
            fontSize: 15,
            wordBreak: 'break-all',
          }}
        >
          {file ? file.name : t.pickFile}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              background: 'transparent',
              border: `1px solid ${palette.gold}66`,
              color: palette.gold,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              padding: '8px 14px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {file ? t.change : t.pickFile}
          </button>
          {file ? (
            <button
              type="button"
              onClick={() => onFile(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(232,220,196,0.55)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(232,220,196,0.5)',
            letterSpacing: '0.03em',
            maxWidth: '52ch',
          }}
        >
          {t.hint}
        </p>
      </div>
    </div>
  );
}

function SummaryStep({
  t,
  form,
  isRtl,
}: {
  t: Copy['begin']['step7'];
  form: FormState;
  isRtl: boolean;
}) {
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const rows: Array<{ label: string; value: string }> = [
    { label: t.summary.name, value: form.businessName || '—' },
    {
      label: t.summary.slug,
      value: `${form.slug || 'your-name'}.${ROOT_DOMAIN}`,
    },
    {
      label: t.summary.template,
      value: form.templateId ? form.templateId : '—',
    },
    {
      label: isRtl ? 'الشعار' : 'Logo',
      value: form.logoUrl
        ? isRtl
          ? 'أيقونة سوقي جاهزة'
          : 'Souqy icon ready'
        : isRtl
          ? 'بدون شعار'
          : 'No logo',
    },
  ];
  if (form.ownership === 'have_business') {
    rows.push({
      label: t.summary.cr,
      value: form.crNumber.trim() ? '••••' + form.crNumber.slice(-2) : t.summary.crNone,
    });
    rows.push({
      label: t.summary.products,
      value: form.csvFile ? form.csvFile.name : t.summary.productsNone,
    });
  }
  return (
    <div>
      <StepHeading eyebrow={t.eyebrow} title={t.title} sub={t.sub} />
      <div
        style={{
          border: '1px solid rgba(232,220,196,0.18)',
          borderRadius: 6,
          padding: 4,
          background: 'rgba(232,220,196,0.02)',
          fontFamily,
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: palette.gold,
            borderBottom: '1px solid rgba(232,220,196,0.12)',
          }}
        >
          {t.summary.title}
        </div>
        <dl style={{ margin: 0 }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                gap: 16,
                padding: '12px 18px',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(232,220,196,0.08)' : 'none',
                fontSize: 14,
              }}
            >
              <dt
                style={{
                  flex: '0 0 100px',
                  color: 'rgba(232,220,196,0.5)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  alignSelf: 'center',
                }}
              >
                {row.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  color: 'var(--color-sand-pale)',
                  wordBreak: 'break-word',
                  flex: 1,
                  textAlign: isRtl ? 'right' : 'left',
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function NavRow({
  t,
  canBack,
  canNext,
  canSkip,
  isLast,
  pending,
  isRtl,
  onBack,
  onSkip,
  fontFamily,
}: {
  t: Copy['begin']['nav'];
  canBack: boolean;
  canNext: boolean;
  canSkip: boolean;
  isLast: boolean;
  pending: boolean;
  isRtl: boolean;
  onBack: () => void;
  onSkip: () => void;
  fontFamily: string;
}) {
  return (
    <div className="flex items-center justify-between mt-9 flex-wrap gap-4">
      <button
        type="button"
        onClick={onBack}
        disabled={!canBack}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: canBack ? 'pointer' : 'default',
          color: canBack ? 'rgba(232,220,196,0.7)' : 'rgba(232,220,196,0.3)',
          fontFamily,
          fontSize: 14,
          padding: 0,
        }}
      >
        {isRtl ? `→ ${t.back}` : `← ${t.back}`}
      </button>

      <div className="flex items-center gap-4">
        {canSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={pending}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: pending ? 'default' : 'pointer',
              color: 'rgba(232,220,196,0.6)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: 0,
            }}
          >
            {t.skip}
          </button>
        ) : null}

        {isLast ? (
          <MetalFrame strength={0.65} borderRadius={999}>
            <button
              type="submit"
              disabled={!canNext}
              style={{
                background: !canNext ? 'rgba(201,169,97,0.3)' : palette.gold,
                color: palette.ink,
                border: 'none',
                padding: '14px 22px',
                borderRadius: 999,
                fontFamily,
                fontSize: 14,
                fontWeight: 500,
                cursor: !canNext ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 200ms',
              }}
            >
              {pending ? (
                <>{t.launch}…</>
              ) : (
                <>
                  {t.launch} <span aria-hidden>◈</span>
                </>
              )}
            </button>
          </MetalFrame>
        ) : (
          <button
            type="submit"
            disabled={!canNext}
            style={{
              background: !canNext ? 'rgba(201,169,97,0.3)' : palette.gold,
              color: palette.ink,
              border: 'none',
              padding: '14px 22px',
              borderRadius: 999,
              fontFamily,
              fontSize: 14,
              fontWeight: 500,
              cursor: !canNext ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 200ms',
            }}
          >
            {t.next}{' '}
            <span aria-hidden style={{ fontSize: 16 }} className="rtl-flip-arrow">
              →
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function SuccessPanel({
  title,
  body,
  url,
  importMessage,
  fontFamily,
}: {
  title: string;
  body: string;
  url: string;
  importMessage: string | null;
  fontFamily: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[6px] p-9 text-center"
      style={{
        background: 'rgba(232,220,196,0.04)',
        border: `1px solid ${palette.gold}55`,
        color: 'var(--color-sand-pale)',
        fontFamily,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: palette.gold,
          marginBottom: 18,
        }}
      >
        ◈ {title.toUpperCase()}
      </div>
      <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0, marginBottom: 16 }}>{body}</p>
      {importMessage ? (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'rgba(232,220,196,0.65)',
            marginBottom: 22,
          }}
        >
          {importMessage}
        </p>
      ) : null}
      <a
        href={url}
        style={{
          display: 'inline-block',
          color: palette.gold,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '0.04em',
          wordBreak: 'break-all',
        }}
      >
        {url} →
      </a>
    </div>
  );
}

function FormLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'rgba(232,220,196,0.55)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  type = 'text',
  isRtl,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  type?: 'text' | 'email';
  isRtl: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${focused ? palette.gold : 'rgba(232,220,196,0.25)'}`,
          color: 'var(--color-sand-pale)',
          padding: '10px 0',
          marginTop: 8,
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 18,
          letterSpacing: '-0.005em',
          outline: 'none',
          transition: 'border-color 200ms',
        }}
      />
    </div>
  );
}
