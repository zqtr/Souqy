'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { palettes, type PaletteId } from '@/lib/palettes';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/brief';
import { sortedTemplateIdsForPicker, templatePresets } from '@/lib/templates';
import { PLAN_LIMITS, planAtLeast, type Plan } from '@/lib/plans';
import type { Block, CursorEffect, ThemeOverrides } from '@/lib/blocks/types';
import { CURSOR_EFFECTS } from '@/lib/blocks/types';
import { BACKGROUND_EFFECT_PICKER_OPTIONS } from '@/lib/blocks/backgroundPicker';
import { saveThemeOverrides, switchBuilderTemplate } from '@/app/actions/builder';
import { saveStorefrontSettings } from '@/app/actions/storefrontSettings';
import { MediaUploader } from './MediaUploader';
import { TemplateBrowserModal } from './TemplateBrowserModal';
import { BackgroundPatternPicker } from './BackgroundPatternPicker';
import { useBuilderCopy } from './BuilderCopyContext';
import type { Locale } from '@/i18n/locales';
import type { StorefrontPolicies } from '@/lib/storefrontSettings';
import {
  defaultInlinePolicyText,
  normalizePolicyDisplayMode,
} from '@/lib/storefrontPolicies';

type Props = {
  slug: string;
  initialTheme: ThemeOverrides;
  initialPalette: PaletteId;
  /** Active template — drives the entry-point card's thumbnail + label
   *  and the "Current" pill in the browser modal so a founder can tell
   *  which preset their storefront is on right now. */
  initialTemplate: TemplateId;
  /** Caller's billing tier. Drives locked state on pro templates and
   *  the upsell card surfaced when a non-eligible template is picked. */
  currentPlan: Plan;
  /** Active page id — when supplied, "Switch template" re-seeds the
   *  active page only (not the storefront's home). When omitted, the
   *  action defaults to the home page on the server. */
  activePageId?: string;
  businessName: string;
  locale: Locale;
  initialPolicies: StorefrontPolicies;
  onSiteSaved?: () => void;
  /** Fired after a template switch lands successfully. The parent
   *  (`BuilderShell`) uses this to swap the canvas to the freshly
   *  seeded blocks, select the first one and snap the right rail back
   *  to the BlockInspector tab. */
  onTemplateConfirmed?: (args: {
    templateId: TemplateId;
    blocks: Block[];
    theme: ThemeOverrides | null;
  }) => void;
};

const SITE_BACKGROUND_EFFECTS: Array<{
  id: (typeof BACKGROUND_EFFECT_PICKER_OPTIONS)[number]['id'];
  label: string;
  preview: string;
  dark?: boolean;
}> = BACKGROUND_EFFECT_PICKER_OPTIONS;

const SITE_CURSOR_EFFECTS: Array<{ id: CursorEffect; label: string }> = CURSOR_EFFECTS.map(
  (id) => ({
    id,
    label: labelFromId(id),
  }),
);

function labelFromId(id: string) {
  return id
    .split('-')
    .map((part) =>
      part === '3d' ? '3D' : part === 'ai' ? 'AI' : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}

/**
 * Site-wide theme controls living in the right rail when the founder
 * toggles the Block / Site switcher to "Site". The compact template
 * card is the focal point at the top — it shows the storefront's
 * current preset and opens the full-screen `TemplateBrowserModal` for
 * live template comparisons against the founder's actual products.
 * Page background and the advanced behaviour group fold beneath it.
 *
 * Self-saving: every change debounces a `saveThemeOverrides` call and
 * surfaces a small "Saving / Saved / Save failed" chip at the top.
 */
export function SiteInspector({
  slug,
  initialTheme,
  initialPalette,
  initialTemplate,
  currentPlan,
  activePageId,
  businessName,
  locale,
  initialPolicies,
  onSiteSaved,
  onTemplateConfirmed,
}: Props) {
  const { builder: copy } = useBuilderCopy();
  const siteText = useSiteInspectorText();
  const [theme, setTheme] = useState<ThemeOverrides>(initialTheme);
  const initialPolicyDraft = useMemo(() => {
    const withDefault = (
      key: 'terms' | 'privacy' | 'refund',
      value: string | null,
    ) =>
      value?.trim()
        ? value
        : defaultInlinePolicyText({ key, locale, businessName });

    return {
      terms: withDefault('terms', initialPolicies.terms),
      privacy: withDefault('privacy', initialPolicies.privacy),
      refund: withDefault('refund', initialPolicies.refund),
    };
  }, [businessName, initialPolicies.privacy, initialPolicies.refund, initialPolicies.terms, locale]);
  const [policies, setPolicies] = useState(initialPolicyDraft);
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(initialTemplate);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const policyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(null);
  const [lockedTemplate, setLockedTemplate] = useState<TemplateId | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isSwitching, startSwitchTransition] = useTransition();
  const [browserOpen, setBrowserOpen] = useState(false);

  const { freeTemplates, proTemplates } = useMemo(() => {
    const free: TemplateId[] = [];
    const pro: TemplateId[] = [];
    for (const id of sortedTemplateIdsForPicker(TEMPLATE_IDS)) {
      if (templatePresets[id].tier === 'free') free.push(id);
      else pro.push(id);
    }
    return { freeTemplates: free, proTemplates: pro };
  }, []);

  useEffect(
    () => () => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current);
    },
    [],
  );

  const confirmSwitchTemplate = useCallback(() => {
    if (!pendingTemplate || pendingTemplate === activeTemplate) {
      setPendingTemplate(null);
      return;
    }
    const next = pendingTemplate;
    setTemplateError(null);
    startSwitchTransition(async () => {
      const res = await switchBuilderTemplate({
        slug,
        templateId: next,
        pageId: activePageId,
      });
      if (res.status === 'success') {
        setActiveTemplate(next);
        if (res.theme) setTheme(res.theme);
        setPendingTemplate(null);
        // Close the full-screen browser too — the founder confirmed
        // the switch, no reason to keep the picker open.
        setBrowserOpen(false);
        // Hand the freshly seeded blocks + theme back to BuilderShell
        // so it can swap the canvas, select the first block and snap
        // the right rail back to the BlockInspector tab without a
        // page navigation.
        onTemplateConfirmed?.({
          templateId: next,
          blocks: (res.blocks ?? []) as Block[],
          theme: res.theme ?? null,
        });
      } else if (res.status === 'error') {
        setTemplateError(res.message);
      } else {
        setTemplateError('Template switch failed');
      }
    });
  }, [activePageId, activeTemplate, onTemplateConfirmed, pendingTemplate, slug]);

  const persist = useCallback(
    (next: ThemeOverrides) => {
      if (timer) clearTimeout(timer);
      const t = setTimeout(async () => {
        setSaveState('saving');
        const res = await saveThemeOverrides({
          slug,
          theme: next as unknown as Parameters<typeof saveThemeOverrides>[0]['theme'],
        });
        if (res.status === 'success') {
          setSaveState('saved');
          onSiteSaved?.();
        } else {
          setSaveState('error');
        }
      }, 350);
      setTimer(t);
    },
    [onSiteSaved, slug, timer],
  );

  const update = useCallback(
    (patch: Partial<ThemeOverrides>) => {
      const next: ThemeOverrides = { ...theme, ...patch };
      // Drop empty SEO objects so the JSONB row stays lean — otherwise
      // every theme save would persist `seo: { title: '', … }` which
      // makes diffs noisy and bloats payloads.
      if (!next.seo || Object.values(next.seo).every((v) => !v)) {
        delete next.seo;
      }
      setTheme(next);
      persist(next);
    },
    [persist, theme],
  );

  const updateSeo = useCallback(
    (patch: Partial<NonNullable<ThemeOverrides['seo']>>) => {
      const seo = { ...(theme.seo ?? {}), ...patch };
      const cleaned: NonNullable<ThemeOverrides['seo']> = {};
      if (seo.title) cleaned.title = seo.title;
      if (seo.description) cleaned.description = seo.description;
      if (seo.ogImage) cleaned.ogImage = seo.ogImage;
      update({ seo: Object.keys(cleaned).length ? cleaned : undefined });
    },
    [theme.seo, update],
  );

  const updatePolicies = useCallback(
    (patch: Partial<typeof policies>) => {
      const next = { ...policies, ...patch };
      setPolicies(next);
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current);
      policyTimerRef.current = setTimeout(async () => {
        setSaveState('saving');
        const res = await saveStorefrontSettings({
          slug,
          section: 'policies',
          patch: {
            policies: {
              terms: next.terms,
              privacy: next.privacy,
              refund: next.refund,
            },
          },
        });
        if (res.status === 'success') {
          setSaveState('saved');
          onSiteSaved?.();
        } else {
          setSaveState('error');
        }
      }, 450);
    },
    [onSiteSaved, policies, slug],
  );

  const activePalette = theme.palette ?? initialPalette;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingBottom: 8,
          borderBottom: '1px solid var(--bld-divider)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--bld-accent)',
            textTransform: 'uppercase',
          }}
        >
          {copy.rail.site}
        </span>
        <SaveChip state={saveState} />
      </header>

      <TemplateShowcase
        activeTemplate={activeTemplate}
        onBrowse={() => {
          setTemplateError(null);
          setLockedTemplate(null);
          setBrowserOpen(true);
        }}
      />
      <AnimatePresence>
        {browserOpen ? (
          <TemplateBrowserModal
            slug={slug}
            freeTemplates={freeTemplates}
            proTemplates={proTemplates}
            activeTemplate={activeTemplate}
            pendingTemplate={pendingTemplate}
            currentPlan={currentPlan}
            onClose={() => {
              if (isSwitching) return;
              setBrowserOpen(false);
            }}
            onPick={(id) => {
              setTemplateError(null);
              setLockedTemplate(null);
              setPendingTemplate(id === activeTemplate ? null : id);
            }}
            onPickLocked={(id) => {
              setTemplateError(null);
              setPendingTemplate(null);
              setLockedTemplate(id);
            }}
          />
        ) : null}
      </AnimatePresence>
      {pendingTemplate && pendingTemplate !== activeTemplate ? (
        <TemplateConfirm
          current={activeTemplate}
          next={pendingTemplate}
          busy={isSwitching}
          error={templateError}
          onConfirm={confirmSwitchTemplate}
          onCancel={() => {
            if (isSwitching) return;
            setPendingTemplate(null);
            setTemplateError(null);
          }}
        />
      ) : null}
      {lockedTemplate ? (
        <TemplateUpsell
          templateId={lockedTemplate}
          currentPlan={currentPlan}
          onClose={() => setLockedTemplate(null)}
        />
      ) : null}

      <Group label="Store policies">
        <FieldLabel>Policy layout</FieldLabel>
        <Segmented
          value={normalizePolicyDisplayMode(theme.policyDisplayMode)}
          onChange={(v) =>
            update({
              policyDisplayMode: v,
            })
          }
          options={[
            { value: 'full', label: 'All at once' },
            { value: 'columns', label: 'Columns' },
          ]}
        />
        <FieldLabel>Terms Of Service</FieldLabel>
        <TextArea
          value={policies.terms}
          onChange={(v) => updatePolicies({ terms: v })}
          rows={5}
          placeholder="Terms for orders, payments, delivery, and custom work."
        />
        <FieldLabel>Privacy</FieldLabel>
        <TextArea
          value={policies.privacy}
          onChange={(v) => updatePolicies({ privacy: v })}
          rows={4}
          placeholder="How customer details are used for orders and support."
        />
        <FieldLabel>Refunds</FieldLabel>
        <TextArea
          value={policies.refund}
          onChange={(v) => updatePolicies({ refund: v })}
          rows={4}
          placeholder="How refunds, exchanges, and cancellations are handled."
        />
      </Group>

      <Group label="Page background">
        <ColorInput
          value={theme.pageBg ?? ''}
          onChange={(v) => update({ pageBg: v || undefined })}
          placeholder={palettes[activePalette].light.ground}
        />
        {theme.pageBg ? (
          <button
            type="button"
            onClick={() => update({ pageBg: undefined })}
            style={resetLinkStyle()}
          >
            {siteText.label('Use palette ground')}
          </button>
        ) : null}
      </Group>

      <Group label="Pattern library">
        <BackgroundPatternPicker
          value={theme.pageBg}
          palette={activePalette}
          onPick={(p) => {
            // The pattern's CSS shorthand is the full `background`
            // value — including position/size on each layer plus the
            // palette ground as the final layer — so we can drop it
            // straight onto `pageBg` without splitting into
            // image/size/colour fields.
            update({ pageBg: p.css });
          }}
          onClear={() => update({ pageBg: undefined })}
        />
      </Group>

      <Group label="Background motion">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          {SITE_BACKGROUND_EFFECTS.map((opt) => {
            const active = (theme.backgroundEffect ?? 'none') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  update({
                    backgroundEffect: opt.id === 'none' ? undefined : opt.id,
                  })
                }
                title={opt.label}
                style={{
                  minHeight: 42,
                  borderRadius: 6,
                  border: active
                    ? '1px solid var(--bld-accent)'
                    : '1px solid var(--bld-divider)',
                  background: opt.preview,
                  color: opt.dark ? '#f8f1df' : 'var(--bld-input-text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 0 2px var(--bld-accent-soft)' : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Group>

      <Group label="Cursor effects">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          {SITE_CURSOR_EFFECTS.map((opt) => {
            const active = (theme.cursorEffect ?? 'none') === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  update({
                    cursorEffect: opt.id === 'none' ? undefined : opt.id,
                  })
                }
                title={opt.label}
                style={{
                  minHeight: 36,
                  borderRadius: 6,
                  border: active
                    ? '1px solid var(--bld-accent)'
                    : '1px solid var(--bld-divider)',
                  background: active ? 'var(--bld-accent-soft)' : 'var(--bld-tile-bg)',
                  color: 'var(--bld-input-text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Group>

      <details style={{ marginTop: 4 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--bld-text-muted)',
            padding: '8px 0',
            borderTop: '1px solid var(--bld-divider)',
            listStyle: 'none',
          }}
        >
          {siteText.label('Advanced')}
        </summary>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            paddingTop: 10,
          }}
        >
          <Group label="Theme behaviour">
            <Segmented
              value={theme.themeBehaviour ?? 'auto'}
              onChange={(v) =>
                update({
                  themeBehaviour: v as ThemeOverrides['themeBehaviour'],
                })
              }
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Group>

          <Group label="Heading weight">
            <Segmented
              value={String(theme.headingWeight ?? 400)}
              onChange={(v) =>
                update({
                  headingWeight: Number(v) as ThemeOverrides['headingWeight'],
                })
              }
              options={[
                { value: '400', label: 'Regular' },
                { value: '500', label: 'Medium' },
                { value: '600', label: 'Semibold' },
              ]}
            />
          </Group>

          <Group label="Section spacing">
            <Segmented
              value={theme.sectionSpacing ?? 'comfortable'}
              onChange={(v) =>
                update({
                  sectionSpacing: v as ThemeOverrides['sectionSpacing'],
                })
              }
              options={[
                { value: 'tight', label: 'Tight' },
                { value: 'comfortable', label: 'Comfort' },
                { value: 'spacious', label: 'Spacious' },
              ]}
            />
          </Group>

          <Group label="SEO">
            <FieldLabel>Title</FieldLabel>
            <TextInput
              value={theme.seo?.title ?? ''}
              onChange={(v) => updateSeo({ title: v || undefined })}
              placeholder="Souqna · Your storefront"
            />
            <FieldLabel>Description</FieldLabel>
            <TextArea
              value={theme.seo?.description ?? ''}
              onChange={(v) => updateSeo({ description: v || undefined })}
              rows={3}
              placeholder="Short, factual. 60–160 characters."
            />
            <FieldLabel>Social share image (1200×630)</FieldLabel>
            <MediaUploader
              value={theme.seo?.ogImage ?? ''}
              onChange={(v) => updateSeo({ ogImage: v || undefined })}
              namespace={`og-images/${slug}`}
              storefrontSlug={slug}
              accept="image/png,image/jpeg,image/jpg,image/webp"
            />
          </Group>
        </div>
      </details>
    </div>
  );
}

// ── Template showcase ────────────────────────────────────────────────────

/**
 * Compact entry-point card surfaced at the top of the Site inspector.
 * Shows the storefront's current template (small 16:10 thumb + name)
 * and a single "Browse all templates" button that opens the
 * `TemplateBrowserModal` — where each template is rendered as a live
 * iframe of the founder's actual storefront so the preview reads as
 * the real thing instead of a gradient swatch.
 */
function TemplateShowcase({
  activeTemplate,
  onBrowse,
}: {
  activeTemplate: TemplateId;
  onBrowse: () => void;
}) {
  const text = useSiteInspectorText();
  const preset = templatePresets[activeTemplate];
  const themeKey: 'light' | 'dark' = preset.theme.themeBehaviour === 'dark' ? 'dark' : 'light';
  const p = palettes[preset.palette][themeKey];
  const [latin, arabic] = preset.label.split('·').map((s) => s.trim());

  return (
    <section
      aria-label={text.label('Template')}
      style={{
        border: '1px solid var(--bld-divider)',
        borderRadius: 8,
        background: 'var(--bld-tile-bg)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: 96,
            aspectRatio: '16 / 10',
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid var(--bld-accent-line)',
            background: p.ground,
            flexShrink: 0,
          }}
        >
          <TemplateGradient preset={preset} />
          <span
            aria-label={`${PLAN_LIMITS[preset.tier].label} template`}
            style={{
              position: 'absolute',
              zIndex: 2,
              top: 6,
              insetInlineEnd: 6,
              padding: '2px 6px',
              borderRadius: 999,
              background:
                preset.tier === 'free'
                  ? 'rgba(0,0,0,0.42)'
                  : 'var(--bld-accent)',
              color: preset.tier === 'free' ? '#fff' : 'var(--bld-accent-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              boxShadow: '0 6px 18px rgba(0,0,0,0.20)',
            }}
          >
            {PLAN_LIMITS[preset.tier].label}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--bld-text-faint)',
              textTransform: 'uppercase',
            }}
          >
            Template · current
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 14,
              color: 'var(--bld-input-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {latin ?? activeTemplate}
            {arabic ? (
              <span
                style={{
                  marginInlineStart: 6,
                  fontSize: 12,
                  color: 'var(--bld-text-muted)',
                }}
              >
                · {arabic}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 6,
          border: '1px solid var(--bld-accent-line)',
          background: 'var(--bld-accent)',
          color: 'var(--bld-accent-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {text.label('Browse all templates')}
      </button>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          color: 'var(--bld-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Showing real previews with your products.
      </span>
    </section>
  );
}

/**
 * CSS-only gradient swatch for a template, mirroring the recipe used by
 * the public BeginIntake template picker so the inspector preview reads
 * the same as the onboarding showcase. Loads `preset.previewImage` on
 * top with a fade when present and falls back to gradient on error.
 */
function TemplateGradient({ preset }: { preset: (typeof templatePresets)[TemplateId] }) {
  const themeKey: 'light' | 'dark' = preset.theme.themeBehaviour === 'dark' ? 'dark' : 'light';
  const p = palettes[preset.palette][themeKey];
  const swatch = `linear-gradient(135deg, ${p.ground} 0%, color-mix(in srgb, ${p.ground} 60%, ${p.ink} 40%) 55%, ${p.accent} 130%)`;

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);
  const showImage = Boolean(preset.previewImage) && !imgErrored;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: swatch,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInlineStart: '8%',
          insetInlineEnd: '8%',
          bottom: 22,
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${p.ink} 0%, ${p.accent} 100%)`,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInlineStart: 16,
          top: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: p.ink,
          opacity: 0.6,
        }}
      >
        {preset.label.split('·')[0]?.trim()}
      </div>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preset.previewImage}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgErrored(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 220ms',
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Inline upsell card surfaced when the founder taps a template above
 * their plan. Uses the same gold-tone treatment as the destructive
 * confirm panel so the rail stays visually coherent — but the action
 * pair is "See plans" / "Talk to us" instead of replace/cancel.
 */
function TemplateUpsell({
  templateId,
  currentPlan,
  onClose,
}: {
  templateId: TemplateId;
  currentPlan: Plan;
  onClose: () => void;
}) {
  const preset = templatePresets[templateId];
  const minPlan = preset.tier;
  const minLabel = PLAN_LIMITS[minPlan].label;
  const currentLabel = PLAN_LIMITS[currentPlan].label;
  const subject = encodeURIComponent(`Souqna · upgrade to ${minLabel} (template: ${preset.label})`);
  const body = encodeURIComponent(
    `Hi Souqna team,\n\nI'd like to upgrade my plan from ${currentLabel} to ${minLabel} so I can use the ${preset.label} template.\n\nThanks.`,
  );
  // Same overlay treatment as `TemplateConfirm` — the upsell needs to
  // sit above the full-screen `TemplateBrowserModal` so the founder
  // sees it immediately after picking a locked template from inside
  // the browser. Falls back gracefully when invoked from the rail card
  // (the modal isn't open then but the overlay still reads fine).
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="alertdialog"
        aria-label={`Upgrade to ${minLabel}`}
        aria-modal="true"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        style={{
          width: 'min(440px, 100%)',
          padding: 16,
          border: '1px solid var(--bld-accent-line)',
          borderRadius: 8,
          background: 'linear-gradient(155deg, var(--bld-accent-soft) 0%, var(--bld-surface) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bld-accent)',
          }}
        >
          Pro template · upgrade required
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--bld-input-text)',
          }}
        >
          <strong>{preset.label}</strong> is part of the {minLabel} tier. You're on{' '}
          <strong>{currentLabel}</strong> right now — upgrading unlocks{' '}
          {PLAN_LIMITS[minPlan].templateCount} templates,{' '}
          {Number.isFinite(PLAN_LIMITS[minPlan].storefronts)
            ? `${PLAN_LIMITS[minPlan].storefronts} storefronts`
            : 'unlimited storefronts'}
          {planAtLeast(minPlan, 'pro')
            ? ', premium block variants and animated text/image blocks.'
            : '.'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--bld-text-muted)',
            fontStyle: 'italic',
          }}
        >
          {preset.description}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--bld-input-border)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--bld-input-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <a
            href="/account/settings/plan"
            style={{
              padding: '6px 12px',
              border: '1px solid var(--bld-accent-line)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--bld-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            See plans
          </a>
          <a
            href={`mailto:support@souqna.qa?subject=${subject}&body=${body}`}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--bld-accent-line)',
              borderRadius: 4,
              background: 'var(--bld-accent)',
              color: 'var(--bld-accent-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Upgrade · talk to us
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function TemplateConfirm({
  current,
  next,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  current: TemplateId;
  next: TemplateId;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const text = useSiteInspectorText();
  const nextPreset = templatePresets[next];
  const currentPreset = templatePresets[current];
  // Render as a centered overlay with a z-index above the
  // `TemplateBrowserModal` (130) so the destructive-edit warning sits
  // on top whether the founder picked from the rail-side card or the
  // full-screen browser. The shaded backdrop captures stray clicks but
  // never auto-cancels — destructive flow always demands an explicit
  // Cancel / Replace decision.
  return (
    <div
      role="alertdialog"
      aria-label={text.label('Switch template')}
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          padding: 16,
          border: '1px solid var(--bld-accent-line)',
          borderRadius: 8,
          background: 'var(--bld-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bld-accent)',
          }}
        >
          Replace template
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--bld-input-text)',
          }}
        >
          Switching from <strong>{currentPreset.label}</strong> to{' '}
          <strong>{nextPreset.label}</strong> will replace your current page — every block on the
          canvas is discarded and a fresh starter set is seeded in its place. Your products, theme
          palette and storefront settings stay put.
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--bld-text-muted)',
            fontStyle: 'italic',
          }}
        >
          {nextPreset.description}
        </div>
        {error ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--bld-accent)',
            }}
          >
            {error}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--bld-input-border)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--bld-input-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--bld-accent-line)',
              borderRadius: 4,
              background: 'var(--bld-accent)',
              color: 'var(--bld-accent-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Switching…' : 'Replace template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useSiteInspectorText() {
  const { builder } = useBuilderCopy();
  const labels = builder.inspector.labels as Record<string, string>;
  const options = builder.inspector.options as Record<string, string>;
  return {
    label: (value: string | undefined) => (value ? labels[value] ?? value : value),
    option: (value: string) => options[value] ?? labels[value] ?? value,
  };
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const text = useSiteInspectorText();
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--bld-text-faint)',
          textTransform: 'uppercase',
        }}
      >
        {text.label(label)}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const text = useSiteInspectorText();
  const rendered = typeof children === 'string' ? text.label(children) : children;
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--bld-text-muted)',
        marginTop: 4,
      }}
    >
      {rendered}
    </span>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const text = useSiteInspectorText();
  return (
    <input
      type="text"
      value={value}
      placeholder={text.label(placeholder)}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle()}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const text = useSiteInspectorText();
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={text.label(placeholder)}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle(), resize: 'vertical' }}
    />
  );
}

function ColorInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const text = useSiteInspectorText();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 32,
          padding: 0,
          background: 'transparent',
          border: '1px solid var(--bld-input-border)',
          borderRadius: 4,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={value}
        placeholder={text.label(placeholder)}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle(), flex: 1 }}
      />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const text = useSiteInspectorText();
  return (
    <div
      role="radiogroup"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 4,
        border: '1px solid var(--bld-divider)',
        padding: 2,
        borderRadius: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 10px',
              border: 'none',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: active ? 'var(--bld-text)' : 'var(--bld-text-muted)',
              background: active ? 'var(--bld-chip-bg-active)' : 'transparent',
              boxShadow: active ? 'inset 0 0 0 1px var(--bld-input-border)' : undefined,
              cursor: 'pointer',
            }}
          >
            {text.option(opt.label)}
          </button>
        );
      })}
    </div>
  );
}

function SaveChip({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const { builder: copy } = useBuilderCopy();
  if (state === 'idle') return null;
  const label =
    state === 'saving'
      ? copy.publish.saving
      : state === 'saved'
        ? copy.publish.saved
        : copy.publish.saveFailed;
  const color =
    state === 'error'
      ? '#E68A8A'
      : state === 'saving'
        ? 'var(--bld-text-muted)'
        : 'var(--bld-accent)';
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {label}
    </span>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 9px',
    background: 'var(--bld-input-bg)',
    border: '1px solid var(--bld-divider)',
    color: 'var(--bld-input-text)',
    borderRadius: 3,
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
  };
}

function resetLinkStyle(): React.CSSProperties {
  return {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 'none',
    padding: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--bld-text-muted)',
    cursor: 'pointer',
    textDecoration: 'underline',
  };
}
