'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { souqyKickoff, type SouqyKickoffState } from '@/app/actions/souqy';
import type { Locale } from '@/i18n/locales';
import { palette } from '@/lib/tokens';
import { Reveal } from '@/components/motion/Reveal';
import { Eyebrow } from '@/components/primitives/Eyebrow';

/**
 * Souqy intake — the AI atelier brief capture form for `atelier_pro`
 * subscribers. Renders only when the upstream page has confirmed the
 * caller's plan, so we don't repeat the gating here.
 *
 * A compact founder brief that calls the existing Souqy kickoff server
 * action. The long-running AI/build pipeline stays server-side; this
 * client component only owns form state, random bilingual prompt starters,
 * and the success redirect into the per-storefront Souqy dashboard.
 */
type Props = {
  locale: Locale;
};

export function SouqyIntake({ locale }: Props) {
  const isRtl = locale === 'ar';
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('ecommerce');
  const [vibe, setVibe] = useState('');
  const [state, setState] = useState<SouqyKickoffState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();
  const [suggestionSeed, setSuggestionSeed] = useState(() => Math.floor(Math.random() * 1000));
  const fontFamily = isRtl
    ? 'var(--font-arabic), var(--font-sans)'
    : 'var(--font-sans)';
  const suggestions = useMemo(
    () => pickPromptSuggestions(suggestionSeed),
    [suggestionSeed],
  );
  const t = isRtl
    ? {
        eyebrow: 'سوقي · الإعداد',
        title: 'خل سوقي يبني أول نسخة من متجرك.',
        sub: 'اكتب اسم النشاط، الرابط، ووصف الجو اللي تبيه. سوقي بيولّد واجهة كاملة تقدر بعدها تعدّلها من لوحة سوقي أو ترجع للبيلدر.',
        businessName: 'اسم النشاط',
        slug: 'رابط المتجر',
        type: 'نوع النشاط',
        vibe: 'وش تبي سوقي يبني؟',
        vibePlaceholder:
          'مثال: متجر عطور قطرية فاخر، ألوان داكنة ولمسات ذهبية، صفحة افتتاحية فيها بطل قوي ومنتجات مميزة وتواصل واضح.',
        primary: 'ابنِ المتجر بسوقي',
        busy: 'سوقي يبني...',
        secondary: 'العودة إلى الحساب',
        random: 'اقتراحات عشوائية',
        success: 'تم إنشاء المتجر. بننقلك للوحة سوقي...',
        slugHint: 'حروف وأرقام وشرطات فقط. إذا كان الرابط مستخدم، بنختار أقرب رابط متاح.',
      }
    : {
        eyebrow: 'Souqy · onboarding',
        title: 'Let Souqy build the first version of your storefront.',
        sub: 'Give Souqy the business name, address, and creative direction. It will generate a full storefront you can keep editing from the Souqy dashboard or switch back into the builder.',
        businessName: 'Business name',
        slug: 'Store address',
        type: 'Business type',
        vibe: 'What should Souqy build?',
        vibePlaceholder:
          'Example: A premium Qatari perfume store with dark editorial visuals, gold accents, a strong hero, featured products, and a clear contact section.',
        primary: 'Build with Souqy',
        busy: 'Souqy is building...',
        secondary: 'Back to account',
        random: 'Random prompt ideas',
        success: 'Storefront created. Taking you to the Souqy dashboard...',
        slugHint: 'Letters, numbers, and dashes only. If it is taken, Souqy will pick the next available address.',
      };

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await souqyKickoff({
        businessName,
        slug,
        businessType,
        vibe,
        website: '',
        locale,
      });
      setState(result);
      if (result.status === 'success') {
        window.location.assign(`/account/${result.slug}/souqy`);
      }
    });
  }

  return (
    <section
      style={{
        padding:
          'clamp(72px, 12vw, 120px) clamp(20px, 4vw, 48px) clamp(80px, 14vw, 140px)',
        background: 'var(--surface-contrast)',
        color: 'var(--ink-on-contrast)',
        minHeight: '70vh',
        fontFamily,
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 720, textAlign: isRtl ? 'right' : 'left' }}
      >
        <Reveal>
          <div
            className="flex"
            style={{ justifyContent: isRtl ? 'flex-end' : 'flex-start' }}
          >
            <Eyebrow tone="gold">{t.eyebrow}</Eyebrow>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h1
            className="text-balance"
            style={{
              fontFamily,
              fontWeight: isRtl ? 400 : 300,
              fontSize: 'clamp(36px, 5vw, 64px)',
              lineHeight: isRtl ? 1.18 : 1.04,
              letterSpacing: isRtl ? '-0.005em' : '-0.03em',
              color: 'var(--ink-on-contrast)',
              margin: '24px 0 18px',
            }}
          >
            {t.title}
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p
            style={{
              fontSize: 18,
              color: 'var(--ink-on-contrast-muted)',
              lineHeight: 1.6,
              maxWidth: 560,
              marginInlineEnd: isRtl ? 0 : 'auto',
            }}
          >
            {t.sub}
          </p>
        </Reveal>
        <Reveal delay={360}>
          <form onSubmit={submit} style={{ display: 'grid', gap: 18, marginTop: 36 }}>
            <label style={fieldLabel}>
              {t.businessName}
              <input
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (!slug.trim()) setSlug(toSlug(e.target.value));
                }}
                required
                maxLength={160}
                style={fieldInput(fontFamily)}
              />
            </label>

            <label style={fieldLabel}>
              {t.slug}
              <input
                value={slug}
                onChange={(e) => setSlug(toSlug(e.target.value))}
                required
                minLength={3}
                maxLength={40}
                dir="ltr"
                style={fieldInput('var(--font-mono)')}
              />
              <span style={hintStyle}>{t.slugHint}</span>
            </label>

            <label style={fieldLabel}>
              {t.type}
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                style={fieldInput(fontFamily)}
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {isRtl ? type.ar : type.en}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldLabel}>
              {t.vibe}
              <textarea
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                required
                minLength={12}
                maxLength={2000}
                rows={6}
                placeholder={t.vibePlaceholder}
                dir="auto"
                style={{
                  ...fieldInput(fontFamily),
                  resize: 'vertical',
                  lineHeight: 1.65,
                  borderRadius: 20,
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setVibe(suggestion)}
                  style={suggestionButton(fontFamily)}
                >
                  {suggestion}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSuggestionSeed((seed) => seed + 5)}
                style={suggestionButton(fontFamily)}
              >
                {t.random}
              </button>
            </div>

            {state.status === 'error' ? (
              <p style={{ margin: 0, color: '#F2A5A5', lineHeight: 1.5 }}>{state.message}</p>
            ) : null}
            {state.status === 'success' ? (
              <p style={{ margin: 0, color: palette.gold, lineHeight: 1.5 }}>{t.success}</p>
            ) : null}

            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                flexDirection: isRtl ? 'row-reverse' : 'row',
              }}
            >
              <button
                type="submit"
                disabled={pending}
                style={{
                  background: pending ? `${palette.gold}99` : palette.gold,
                  color: palette.ink,
                  border: 'none',
                  padding: '14px 22px',
                  borderRadius: 999,
                  fontFamily,
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: pending ? 'wait' : 'pointer',
                }}
              >
                {pending ? t.busy : t.primary}
                <span aria-hidden style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
                  →
                </span>
              </button>
            <Link
              href={locale === 'en' ? '/account' : `/${locale}/account`}
              style={{
                background: 'transparent',
                border: `1px solid ${palette.gold}66`,
                color: palette.gold,
                padding: '14px 22px',
                borderRadius: 999,
                fontFamily,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              {t.secondary}
            </Link>
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

type BusinessType =
  | 'graphic_design'
  | 'clothing_store'
  | 'home_kitchen'
  | 'salon'
  | 'cafe'
  | 'ecommerce'
  | 'real_estate'
  | 'photography'
  | 'tutoring'
  | 'fitness'
  | 'perfume_oud'
  | 'auto_detailing'
  | 'events_weddings'
  | 'agriculture'
  | 'courier_delivery'
  | 'contracting'
  | 'art_gallery'
  | 'tailoring_abaya'
  | 'fnb_brand'
  | 'something_else';

const BUSINESS_TYPES: Array<{ value: BusinessType; en: string; ar: string }> = [
  { value: 'ecommerce', en: 'Online store', ar: 'متجر إلكتروني' },
  { value: 'perfume_oud', en: 'Perfume and oud', ar: 'عطور وعود' },
  { value: 'clothing_store', en: 'Clothing store', ar: 'ملابس' },
  { value: 'cafe', en: 'Cafe', ar: 'مقهى' },
  { value: 'fnb_brand', en: 'Food brand', ar: 'مطعم أو أكل منزلي' },
  { value: 'salon', en: 'Salon', ar: 'صالون' },
  { value: 'tailoring_abaya', en: 'Tailoring and abaya', ar: 'خياطة وعبايات' },
  { value: 'events_weddings', en: 'Events and weddings', ar: 'فعاليات وأعراس' },
  { value: 'photography', en: 'Photography', ar: 'تصوير' },
  { value: 'graphic_design', en: 'Design studio', ar: 'استوديو تصميم' },
  { value: 'home_kitchen', en: 'Home and kitchen', ar: 'منزل ومطبخ' },
  { value: 'real_estate', en: 'Real estate', ar: 'عقار' },
  { value: 'tutoring', en: 'Tutoring', ar: 'تعليم ودروس' },
  { value: 'fitness', en: 'Fitness', ar: 'لياقة' },
  { value: 'auto_detailing', en: 'Auto detailing', ar: 'عناية سيارات' },
  { value: 'agriculture', en: 'Agriculture', ar: 'زراعة' },
  { value: 'courier_delivery', en: 'Courier and delivery', ar: 'توصيل' },
  { value: 'contracting', en: 'Contracting', ar: 'مقاولات' },
  { value: 'art_gallery', en: 'Art gallery', ar: 'معرض فني' },
  { value: 'something_else', en: 'Something else', ar: 'شيء آخر' },
];

const PROMPT_SUGGESTIONS = [
  'Build a refined bilingual storefront for a Doha brand: cinematic hero, warm gold accents, featured products, trust copy, and a clean contact section.',
  'Create a premium launch page with a dark editorial feel, confident headline, product highlights, social proof, and a clear WhatsApp call to action.',
  'ابنِ متجر عربي/إنجليزي بطابع فاخر: هيرو قوي، ألوان داكنة ولمسات ذهبية، منتجات مميزة، ونهاية فيها تواصل واضح.',
  'سوِّ واجهة ناعمة وعصرية لمشروع قطري، فيها قصة قصيرة عن البراند، أقسام مرتبة، وصور كبيرة تحس العميل بالثقة.',
  'Make it feel like a boutique atelier: spacious layout, poetic copy, elegant product cards, and a practical inquiry section.',
  'خل المتجر بسيط وسريع للبيع: عنوان مباشر، عروض واضحة، منتجات مختارة، وزر تواصل يبرز في كل قسم.',
];

function pickPromptSuggestions(seed: number): string[] {
  return [0, 2, 4].map((offset) => PROMPT_SUGGESTIONS[(seed + offset) % PROMPT_SUGGESTIONS.length]!);
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const fieldLabel: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  color: 'var(--ink-on-contrast)',
  fontSize: 14,
};

const hintStyle: React.CSSProperties = {
  color: 'var(--ink-on-contrast-muted)',
  fontSize: 12,
  lineHeight: 1.45,
};

function fieldInput(fontFamily: string): React.CSSProperties {
  return {
    width: '100%',
    border: `1px solid ${palette.gold}44`,
    borderRadius: 999,
    background: 'rgba(232,220,196,0.06)',
    color: 'var(--ink-on-contrast)',
    padding: '13px 16px',
    fontFamily,
    fontSize: 15,
    outline: 'none',
  };
}

function suggestionButton(fontFamily: string): React.CSSProperties {
  return {
    border: `1px solid ${palette.gold}55`,
    borderRadius: 999,
    background: 'rgba(212,175,55,0.08)',
    color: palette.gold,
    padding: '9px 12px',
    fontFamily,
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'start',
  };
}
