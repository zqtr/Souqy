import type { Storefront } from '@/lib/brief';
import type { MarketSignalsResult } from '@/lib/xapi/marketSignals';

/**
 * Souqy prompt construction.
 *
 * The system prompt declares the locked-down API surface (`@souqna/sdk`)
 * and the hard constraints — what Claude can and cannot do, how to
 * structure the output, what the runtime expects. The user prompt
 * carries the founder's brief and the storefront row Claude is writing
 * for.
 *
 * Output contract (single JSON object, no commentary):
 *
 *   {
 *     "files": {
 *       "index.tsx": "...source...",
 *       "theme.ts":  "...source..."
 *     },
 *     "notes": "<= 280 char summary of the design choices made"
 *   }
 *
 * The build pipeline strips any prose, parses the JSON, writes the two
 * files to a temp directory, and runs validate → tsc → bundle.
 */

export type SouqyBrief = {
  businessName: string;
  slug: string;
  businessType: string;
  vibe: string;
  locale: 'en' | 'ar';
};

const SDK_API = `
Components (every prop is optional unless marked required):
  <Hero title* layout="centered|inline|banner" eyebrow tagline backgroundUrl logoMode="hide|default|custom" glyphMode="hide|default|custom" cta={{ label, href }} />
  <Banner imageUrl* alt overlayTitle overlaySubtitle scrim="none|soft|strong" cta={{ label, href }} />
  <Text body* eyebrow heading align="start|center|end" emphasis="plain|serif" />
  <Image imageUrl* alt caption aspect="1/1|4/3|4/5|3/4|16/9|auto" width="narrow|wide|full" />
  <Gallery items=[{ imageUrl*, alt, caption }] columns={2|3|4} aspect="1/1|4/5|3/4|auto" />
  <ProductGrid layout="cards|minimal|lookbook" columns={2|3|4} category limit showInquire />
  <ProductList groupByCategory showImages showPrices category limit />
  <FeaturedProduct productId layout="split|stacked" />
  <ServiceList items=[{ id*, title*, description, priceQar, status }] heading category limit showInquire />
  <Menu items=[{ id*, title*, titleAlt, description, category, priceQar, status }] heading groupByCategory category limit />
  <Calendar slots=[{ id*, date* (YYYY-MM-DD), time, label*, capacity, status }] heading category limit />
  <ContactCard heading body label showPhone showArea showHours showInstagram phone area hours instagram />
  <InquireCta label variant="primary|ghost" eyebrow title body align />
  <Spacer size="sm|md|lg|xl" />
  <Divider glyph={true|false} width="narrow|wide|full" />
  <DepthShowcase imageUrl* title* description imageAlt width="narrow|wide|full" />
  <AuroraRibbon eyebrow title subtitle heightPx={(120-320)} brightness={(0.3-1.4)} />

Primitives:
  <Section size="tight|comfortable|spacious" tone="default|sand|ink|gold" align="start|center|end" maxWidth>
  <Stack gap direction="column|row" align justify wrap>
  <Grid columns={1|2|3|4|6} gap collapseAt>
  <Quote cite>...</Quote>
  <Marquee items={["…","…"]} speed="slow|medium|fast" />

Hooks (server-component-safe):
  useStorefront() : Storefront     // businessName, slug, locale, palette, …
  useProducts()   : Product[]
  useTheme()      : ThemeOverrides
  useLocale()     : 'en' | 'ar'
  useIsRtl()      : boolean
`.trim();

const RULES = `
Hard constraints — your output WILL be rejected if you break any of them:

  1. Exactly two files: \`index.tsx\` and \`theme.ts\`.
  2. \`index.tsx\` must default-export a React component called \`Storefront\`
     that takes no props.
  3. The ONLY allowed imports in \`index.tsx\`:
        import * as React from 'react';        // optional
        import { … } from '@souqna/sdk';       // required for components
        import { theme } from './theme';       // required if you reference theme
  4. The ONLY allowed import in \`theme.ts\`:
        import type { ThemeOverrides } from '@souqna/sdk';
     Theme must be exported as: \`export const theme: ThemeOverrides = { … }\`.
  5. NO browser APIs (window, document, localStorage, fetch, navigator).
  6. NO Node APIs (fs, path, child_process, crypto, process.*).
  7. NO dynamic imports, eval, new Function, top-level await, or
     dangerouslySetInnerHTML.
  8. NO inline event handlers (onClick, onChange) — Souqy outputs server
     components only. Use the SDK component CTAs for interactivity.
  9. Every \`Calendar\` slot \`date\` must be ISO YYYY-MM-DD. Every \`Menu\`
     and \`ServiceList\` item must have a stable \`id\` (a short slug works).
 10. The \`businessName\` and \`slug\` come from \`useStorefront()\` — do not
     hard-code them. Same for \`useProducts()\`.
 11. Locale-aware copy: when \`useLocale() === 'ar'\` the storefront must
     read Arabic. Use \`useLocale()\` inside the component body and emit
     bilingual strings as ternaries, not as separate components.
 12. Output ONLY a single JSON object on a single line of the assistant
     message. No prose, no markdown fences, no leading commentary.
 13. \`DepthShowcase\` and \`AuroraRibbon\` use parallax / WebGL — use at
     most ONE of EACH per page; never stack multiple full-bleed effects.
`.trim();

const FEW_SHOT_USER = `
Brief:
  businessName: Hadhar
  slug: hadhar
  businessType: art_gallery
  vibe: A small Doha gallery rotating one show at a time. Curatorial, museum-quiet, image-forward. Audience: collectors and design students. Highlight: every plate is for sale on request.
  locale: en
`.trim();

const FEW_SHOT_ASSISTANT = JSON.stringify({
  files: {
    'index.tsx': `import { Banner, Gallery, Quote, ContactCard, InquireCta, Section, Stack, useStorefront, useProducts, useLocale } from '@souqna/sdk';
import { theme } from './theme';
void theme;

export default function Storefront() {
  const sf = useStorefront();
  const products = useProducts();
  const isAr = useLocale() === 'ar';

  return (
    <>
      <Banner
        imageUrl=""
        overlayTitle={isAr ? 'حضر' : 'Hadhar'}
        overlaySubtitle={isAr ? 'معرض واحد في كل مرة' : 'One show at a time'}
        scrim="soft"
        align="start"
      />
      <Section size="spacious" align="center">
        <Quote cite={isAr ? 'بيان المعرض الحالي' : 'Currently showing'}>
          {isAr ? 'لوحات حضرية تستكشف الذاكرة والمكان.' : 'Urban plates exploring memory and place.'}
        </Quote>
      </Section>
      <Section size="comfortable">
        <Gallery
          columns={3}
          aspect="4/5"
          items={products.slice(0, 9).map((p) => ({
            imageUrl: p.imageUrl ?? '',
            alt: p.title,
            caption: p.title,
          }))}
        />
      </Section>
      <Section size="comfortable" tone="sand" align="center">
        <Stack gap={20} align="center">
          <InquireCta
            eyebrow={isAr ? 'طلب' : 'Inquire'}
            title={isAr ? 'لوحات للطلب' : 'Plates available on request'}
            body={isAr ? 'كل لوحة في المعرض متاحة للاقتناء عند التواصل معنا.' : 'Every plate in the current show is available on request.'}
            label={isAr ? 'تواصل معنا' : 'Request a viewing'}
            variant="primary"
            align="center"
          />
        </Stack>
      </Section>
      <Section size="comfortable">
        <ContactCard heading={sf.businessName} showArea showHours showInstagram />
      </Section>
    </>
  );
}
`,
    'theme.ts': `import type { ThemeOverrides } from '@souqna/sdk';

export const theme: ThemeOverrides = {
  palette: 'maroon_bone',
  headingWeight: 400,
  sectionSpacing: 'spacious',
  themeBehaviour: 'auto',
  seo: {
    title: 'Hadhar · Currently showing',
    description: 'A Doha gallery rotating one show at a time.',
  },
};
`,
  },
  notes:
    'Single-show gallery. Banner -> curatorial pull-quote -> 3-col gallery from products -> inquire CTA -> contact. Maroon/bone palette matches the museum-quiet vibe.',
});

const FEW_SHOT_USER_RIBBON = `
Brief:
  businessName: Layl Lines
  slug: layl-lines
  businessType: graphic_design
  vibe: Indie graphic designer in Doha; portfolio-forward, bilingual, confident type. One flagship poster mock and one aurora ribbon for services — no invented client logos or awards.
  locale: en
`.trim();

const FEW_SHOT_ASSISTANT_RIBBON = JSON.stringify({
  files: {
    'index.tsx': `import {
  Banner,
  DepthShowcase,
  AuroraRibbon,
  ContactCard,
  Section,
  Stack,
  InquireCta,
  useStorefront,
  useLocale,
  useProducts,
} from '@souqna/sdk';
import { theme } from './theme';
void theme;

export default function Storefront() {
  const sf = useStorefront();
  const isAr = useLocale() === 'ar';
  const products = useProducts();
  const hero = products[0];

  return (
    <>
      <Banner
        imageUrl={hero?.imageUrl ?? ''}
        overlayTitle={isAr ? 'ليل لاينز' : 'Layl Lines'}
        overlaySubtitle={isAr ? 'تصميم جرافيكي في الدوحة' : 'Graphic design studio · Doha'}
        scrim="soft"
      />
      <AuroraRibbon
        eyebrow={isAr ? 'الخدمات' : 'Services'}
        title={isAr ? 'هويات بصرية' : 'Brand & print systems'}
        subtitle={isAr ? 'جدولة استشارة لمشروعك القادم.' : 'Book a consultation for your next brief.'}
        heightPx={200}
        brightness={0.9}
      />
      <DepthShowcase
        imageUrl="https://images.unsplash.com/photo-1572044162444-ad60f128bdae?auto=format&fit=crop&w=900&q=70"
        title={isAr ? 'مختارات الاستوديو' : 'Studio highlight'}
        description={isAr ? 'طباعة ولون بأجواء حضرية هادئة.' : 'Poster study with quiet urban palettes.'}
        imageAlt={isAr ? 'ملصق تجريبي' : 'Poster mock'}
        width="wide"
      />
      <Section size="comfortable" align="center">
        <Stack gap={16} align="center">
          <InquireCta
            title={isAr ? 'اطلب علامة جديدة' : 'Commission fresh identity work'}
            body={isAr ? 'نرد خلال يوم عمل.' : 'We reply within one business day.'}
            label={isAr ? 'راسلنا' : 'Email the studio'}
            variant="primary"
            align="center"
          />
        </Stack>
      </Section>
      <Section size="comfortable">
        <ContactCard heading={sf.businessName} showInstagram showHours />
      </Section>
    </>
  );
}
`,
    'theme.ts': `import type { ThemeOverrides } from '@souqna/sdk';

export const theme: ThemeOverrides = {
  palette: 'pearl_ink',
  headingWeight: 500,
  sectionSpacing: 'comfortable',
  themeBehaviour: 'auto',
  seo: {
    title: 'Layl Lines · Graphic design · Doha',
    description: 'Bilingual graphic design studio in Doha.',
  },
};
`,
  },
  notes:
    'Designer portfolio: bilingual banner → one aurora ribbon (services) → one depth showcase focal piece → inquire → contact.',
});

export function buildSystemPrompt(): string {
  return [
    'You are Souqy — the in-house AI atelier for Souqna, a bilingual storefront platform built in Doha for Doha.',
    '',
    "You write small, editorial, server-rendered React storefronts. Your output is COMPILED and SERVED to real Qatari founders' customers — quality, restraint, and bilingual sensitivity matter.",
    '',
    'Editorial principles:',
    '  - Restraint over decoration. Generous whitespace. One idea per section.',
    '  - Bilingual native: Arabic and English read equally well, never machine-translated.',
    '  - Doha first: vocabulary, prices in QAR, sensibilities (Khaleeji, modest, hospitable).',
    '  - No fabricated stats, awards, client names, or scarcity copy.',
    '  - When in doubt, prefer fewer sections with more breathing room.',
    '',
    'API surface — `@souqna/sdk`:',
    '',
    SDK_API,
    '',
    RULES,
  ].join('\n');
}

export function buildUserPrompt(
  brief: SouqyBrief,
  storefront?: Storefront,
  marketSignals?: MarketSignalsResult,
): string {
  const products = storefront?.publishedBlocks
    ? `\nThe storefront row exists. Locale = ${storefront.locale}. Template id = ${storefront.templateId}. Palette = ${storefront.palette}. Use these as defaults but feel free to override via theme.ts.`
    : '';
  const signals = formatMarketSignals(marketSignals);
  return [
    'Brief:',
    `  businessName: ${brief.businessName}`,
    `  slug: ${brief.slug}`,
    `  businessType: ${brief.businessType}`,
    `  locale: ${brief.locale}`,
    `  vibe: ${brief.vibe}`,
    products,
    signals,
    '',
    'Return ONLY the JSON object described in the rules. No commentary.',
  ].join('\n');
}

function formatMarketSignals(result?: MarketSignalsResult): string {
  if (!result || result.status !== 'ok' || result.signals.length === 0) return '';

  return [
    '',
    'Recent market signals:',
    ...result.signals.map((signal, index) => {
      const byline = signal.author ? ` @${signal.author}` : '';
      const link = signal.url ? ` (${signal.url})` : '';
      return `  ${index + 1}. [${signal.source}${byline}] ${signal.text}${link}`;
    }),
    '',
    'Use these only as directional context. Do not quote handles, fabricate claims, or mention social data directly unless the founder asked for it.',
  ].join('\n');
}

/**
 * Used by the auto-repair loop. Carries the previous source + the
 * specific tsc / linter error so Claude can fix it without re-running
 * the whole brief from scratch. Keeping this prompt narrow saves
 * tokens and makes repair attempts converge in one round.
 */
export function buildRepairPrompt(args: {
  previousFiles: Record<string, string>;
  errorSummary: string;
}): string {
  const filesBlock = Object.entries(args.previousFiles)
    .map(([name, body]) => `--- ${name} ---\n${body}`)
    .join('\n\n');
  return [
    'Your previous output failed validation. Fix the error and return the corrected JSON object only.',
    '',
    'Error:',
    args.errorSummary,
    '',
    'Previous files:',
    filesBlock,
  ].join('\n');
}

export function buildRepromptUserPrompt(args: {
  previousSource: string;
  request: string;
  storefront: Storefront;
}): string {
  return [
    `Storefront: ${args.storefront.businessName} (${args.storefront.slug}). Locale = ${args.storefront.locale}.`,
    '',
    'The founder asked you to revise the storefront. Apply the change minimally — keep everything else identical unless the request implies otherwise. Return the full revised JSON object.',
    '',
    'Request:',
    args.request,
    '',
    'Current source:',
    args.previousSource,
  ].join('\n');
}

/**
 * Pulls the JSON object out of Claude's response. We trim, strip
 * possible code fences (Claude sometimes ignores rule 12 — costs
 * nothing to be defensive), and parse. Throws a typed error on
 * unparseable output so the caller can surface it as a validation
 * failure and retry.
 */
export type SouqyOutput = {
  files: Record<string, string>;
  notes?: string;
};

export class SouqyOutputParseError extends Error {
  override name = 'SouqyOutputParseError';
}

export function parseSouqyOutput(raw: string): SouqyOutput {
  let text = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence?.[1]) text = fence[1].trim();
  // Some models wrap in ```tsx for the inner files; that's fine here as
  // long as the outer envelope is JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SouqyOutputParseError(`Souqy output was not valid JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SouqyOutputParseError('Souqy output must be a JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  const files = obj.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new SouqyOutputParseError('Souqy output is missing a `files` object.');
  }
  const fileMap: Record<string, string> = {};
  for (const [name, body] of Object.entries(files as Record<string, unknown>)) {
    if (typeof body !== 'string') {
      throw new SouqyOutputParseError(`Souqy file \`${name}\` is not a string.`);
    }
    fileMap[name] = body;
  }
  if (!fileMap['index.tsx']) {
    throw new SouqyOutputParseError('Souqy output is missing `index.tsx`.');
  }
  if (!fileMap['theme.ts']) {
    throw new SouqyOutputParseError('Souqy output is missing `theme.ts`.');
  }
  return {
    files: fileMap,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  };
}

/**
 * Few-shot for in-context guidance. Embedded as an `assistant` message
 * pair in the chat history so Claude has a concrete example of the
 * exact JSON envelope it must return. Cheap to ship — 1.5KB-ish.
 */
export const SOUQY_FEW_SHOTS = [
  { role: 'user' as const, content: FEW_SHOT_USER },
  { role: 'assistant' as const, content: FEW_SHOT_ASSISTANT },
  { role: 'user' as const, content: FEW_SHOT_USER_RIBBON },
  { role: 'assistant' as const, content: FEW_SHOT_ASSISTANT_RIBBON },
];
