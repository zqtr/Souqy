'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, currentUser } from '@clerk/nextjs/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { hasDb } from '@/lib/db';
import { gateAtelierPro } from '@/lib/billing';
import { logEvent } from '@/lib/events';
import { getStorefront, insertStorefront, type Storefront, type TemplateId } from '@/lib/brief';
import { templatePresets } from '@/lib/templates';
import { isReserved, isTaken, nextAvailable, slugify } from '@/lib/slug';
import {
  generateSouqyStorefront,
  repromptSouqyStorefront,
  type GenerateResult,
} from '@/lib/souqy/generate';
import { buildSouqyArtifact, type BuildResult } from '@/lib/souqy/build';
import {
  getSouqyAuditById,
  getSouqyMonthlyCount,
  logSouqyAudit,
  setSouqyRevision,
  updateSouqyAudit,
} from '@/lib/souqy/db';
import type { SouqyOutput } from '@/lib/souqy/prompt';
import { editBlockWithSouqy, isBuilderRequest, souqyRefusalCopy } from '@/lib/souqy/editBlock';
import { getPageById } from '@/lib/storefrontPages';
import { saveDraftBlocks as savePageDraftBlocks } from '@/lib/storefrontPages';
import type { Block } from '@/lib/blocks/types';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';

/**
 * Souqy server actions — the user-facing entry points for the AI
 * code-emit pipeline. Every action is paid-tier gated; every action
 * leaves an audit row.
 *
 * Flow:
 *
 *   /begin/souqy form  →  souqyKickoff   (creates row + first build)
 *   dashboard regen     →  souqyRegenerate (rebuilds from same brief)
 *   dashboard reprompt  →  souqyReprompt   (apply a diff request)
 *   dashboard rollback  →  souqyRollback   (snap to a prior revision)
 *   dashboard switch    →  souqyClear      (back to JSON builder)
 */

const KickoffSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(3).max(40),
  businessType: z.enum([
    'graphic_design',
    'clothing_store',
    'home_kitchen',
    'salon',
    'cafe',
    'ecommerce',
    'real_estate',
    'photography',
    'tutoring',
    'fitness',
    'perfume_oud',
    'auto_detailing',
    'events_weddings',
    'agriculture',
    'courier_delivery',
    'contracting',
    'art_gallery',
    'tailoring_abaya',
    'fnb_brand',
    'something_else',
  ]),
  vibe: z.string().trim().min(12).max(2000),
  /** Honeypot — real users leave it empty. */
  website: z.string().max(0).optional().default(''),
  locale: z.enum(['en', 'ar']),
});

export type SouqyKickoffInput = z.input<typeof KickoffSchema>;
export type SouqyKickoffState =
  | { status: 'idle' }
  | {
      status: 'success';
      slug: string;
      revision: string;
      dashboardUrl: string;
      liveUrl: string;
    }
  | { status: 'error'; message: string; field?: keyof SouqyKickoffInput };

type SouqyBusinessType = z.infer<typeof KickoffSchema>['businessType'];

/** Max prompt length aligned with [`src/lib/souqy/generate.ts`](generate) `MAX_VIBE_CHARS`. */
const HOMEPAGE_PROMPT_MAX = 1200;

const HomepagePromptKickoffSchema = z.object({
  prompt: z.string().trim().min(12).max(HOMEPAGE_PROMPT_MAX),
  locale: z.enum(['en', 'ar']),
});

export type SouqyHomepagePromptKickoffInput = z.infer<typeof HomepagePromptKickoffSchema>;

function ensureKickoffSlugSeed(businessName: string): string {
  let raw = slugify(businessName);
  if (raw.length < 3) raw = slugify(`${businessName} store`);
  if (raw.length < 3) raw = `sf-${randomBytes(3).toString('hex')}`;
  return raw.slice(0, 40);
}

function inferBusinessTypeFromPrompt(text: string): SouqyBusinessType {
  const t = text.toLowerCase();
  if (/\b(graphic|design studio|ux design|uiux|brand agency|portfolio|illustration)\b/.test(t)) {
    return 'graphic_design';
  }
  if (/\b(café|cafe|coffee roaster|espresso)\b/.test(t)) return 'cafe';
  if (/\b(restaurant|cloud kitchen|meal prep|kitchen brand)\b/.test(t)) return 'fnb_brand';
  if (/\b(clothing|apparel|streetwear|boutique)\b/.test(t)) return 'clothing_store';
  if (/\b(photographer|photography|wedding shoot)\b/.test(t)) return 'photography';
  if (/\b(fitness|gym|personal trainer|pilates)\b/.test(t)) return 'fitness';
  if (/\b(salon|spa|barber|nails)\b/.test(t)) return 'salon';
  if (/\b(e-?commerce|dropship|online shop|shopify)\b/.test(t)) return 'ecommerce';
  if (/\b(perfume|oud|fragrance)\b/.test(t)) return 'perfume_oud';
  if (/\b(real estate|property|broker)\b/.test(t)) return 'real_estate';
  if (/\b(tutor|tutoring|course)\b/.test(t)) return 'tutoring';
  if (/\b(art gallery|exhibition)\b/.test(t)) return 'art_gallery';
  if (/\b(abaya|tailor|tailoring)\b/.test(t)) return 'tailoring_abaya';
  if (/\b(event|wedding planner)\b/.test(t)) return 'events_weddings';
  return 'something_else';
}

function deriveHomepageKickoffFields(prompt: string): {
  vibe: string;
  businessName: string;
  businessType: SouqyBusinessType;
} {
  const vibe = prompt.trim().slice(0, HOMEPAGE_PROMPT_MAX);
  const firstLine = vibe.split(/\r?\n/)[0]?.trim() || vibe;
  let businessName = firstLine.slice(0, 160).trim();
  if (!businessName) businessName = 'My storefront';
  return {
    vibe,
    businessName,
    businessType: inferBusinessTypeFromPrompt(vibe),
  };
}

const RepromptSchema = z.object({
  slug: z.string().trim().min(3).max(40),
  request: z.string().trim().min(4).max(2000),
});

const RollbackSchema = z.object({
  slug: z.string().trim().min(3).max(40),
  auditId: z.number().int().positive(),
});

const EditBlockSchema = z.object({
  slug: z.string().trim().min(3).max(40),
  pageId: z.string().uuid(),
  blockId: z.string().uuid(),
  request: z.string().trim().min(3).max(400),
});

export type SouqyEditBlockInput = z.input<typeof EditBlockSchema>;
export type SouqyEditBlockState =
  | { status: 'ok'; block: Block }
  | { status: 'refused'; message: string }
  | { status: 'error'; message: string };

const SlugOnlySchema = z.object({
  slug: z.string().trim().min(3).max(40),
});

export type SouqyActionState =
  | { status: 'idle' }
  | { status: 'success'; revision: string | null }
  | { status: 'error'; message: string };

/**
 * Per-user monthly cap. Atelier Pro covers full-store generations and
 * re-prompts together. Hit-the-cap users get a friendly message in the
 * dashboard, not a server error. Configurable per-deploy via env if we
 * later need to tune it without a release.
 */
const MONTHLY_GENERATION_CAP = Number.parseInt(process.env.SOUQY_MONTHLY_CAP ?? '50', 10);

async function ipKey(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
}

/**
 * Owner gate shared by every storefront-scoped action. Mirrors the
 * pattern in `src/app/actions/builder.ts` — same guarantees, with the
 * addition of a paid-tier check.
 */
async function souqyGate(
  slug: string,
): Promise<
  | { ok: true; userId: string; storefront: Storefront }
  | { ok: false; message: string; code?: 402 | 401 }
> {
  if (!hasDb()) return { ok: false, message: 'Database unavailable' };
  const { userId } = await auth();
  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    return {
      ok: false,
      message:
        gate.reason === 'paywall'
          ? 'Souqy is available on Pro + and above.'
          : 'Sign in to continue.',
      code: gate.reason === 'paywall' ? 402 : 401,
    };
  }
  const sf = await getStorefront(slug);
  if (!sf) return { ok: false, message: 'Storefront not found' };
  if (sf.clerkUserId !== userId) return { ok: false, message: 'Forbidden' };
  return { ok: true, userId: userId!, storefront: sf };
}

async function provisionStorefrontRunSouqyAndPersist(args: {
  userId: string;
  finalSlug: string;
  businessName: string;
  businessType: SouqyBusinessType;
  vibe: string;
  locale: 'en' | 'ar';
  auditExtraMeta: Record<string, unknown>;
}): Promise<SouqyKickoffState> {
  const { userId, finalSlug, businessName, businessType, vibe, locale, auditExtraMeta } = args;

  const user = await currentUser();
  const founderName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username?.trim() ||
    'Founder';
  const contactEmail =
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    user?.emailAddresses?.[0]?.emailAddress?.trim() ||
    '';

  const templateId = pickFallbackTemplate(businessType);
  const preset = templatePresets[templateId];

  let storefront: Storefront;
  try {
    storefront = await insertStorefront({
      slug: finalSlug,
      locale,
      founderName,
      businessName,
      contactEmail,
      ownership: 'have_business',
      experience: 'first_time',
      businessType,
      marketVolume: 'qatar',
      payments: 'planning',
      design: 'atrium',
      palette: preset.palette,
      templateId,
      crNumber: null,
      tagline: null,
      phone: null,
      area: null,
      hours: null,
      instagram: null,
      logoUrl: null,
      faviconUrl: null,
      clerkUserId: userId,
    });
  } catch (err) {
    console.error('[souqy kickoff] insert failed', err);
    return { status: 'error', message: 'Could not provision storefront row.' };
  }

  const auditId = await logSouqyAudit({
    clerkUserId: userId,
    storefront: finalSlug,
    kind: 'generate',
    status: 'pending',
    prompt: vibe,
    meta: { businessType, locale, slug: finalSlug, ...auditExtraMeta },
  });

  const result = await runGenerateAndBuild({
    storefront,
    clerkUserId: userId,
    brief: {
      businessName,
      slug: finalSlug,
      businessType,
      vibe,
      locale,
    },
  });

  if (auditId != null) {
    await updateSouqyAudit(auditId, {
      status: result.status === 'ok' ? 'success' : (result.status as never),
      source: result.status === 'ok' ? result.source : null,
      meta: result.meta,
    });
  }

  if (result.status !== 'ok') {
    return {
      status: 'error',
      message: result.message,
    };
  }

  await logEvent({
    kind: 'souqy.published',
    funnel: 'storefront',
    userId,
    storefront: finalSlug,
    props: {
      revision: result.revision,
      bytes: result.meta.bytes,
      buildMs: result.meta.buildMs,
      attempts: result.meta.attempts,
      ...auditExtraMeta,
    },
  });
  revalidatePath('/account');
  revalidatePath(`/brief/${finalSlug}`);

  return {
    status: 'success',
    slug: finalSlug,
    revision: result.revision,
    dashboardUrl: `${env.NEXT_PUBLIC_SITE_URL}/account/${finalSlug}/souqy`,
    liveUrl: storefrontBaseUrl(finalSlug),
  };
}

/**
 * Brand-new founder flow: create the storefront row, run Souqy, build,
 * persist the revision, redirect to the Souqy dashboard. End-to-end in
 * one server action so the founder never has to refresh.
 *
 * Long-running (~20-60s) but Next.js handles the long-poll and the
 * intake UI surfaces a pending state. Could be split into a kickoff +
 * polling pattern later if cold starts slip past 60s consistently.
 */
export async function souqyKickoff(input: SouqyKickoffInput): Promise<SouqyKickoffState> {
  const parsed = KickoffSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid request',
      field: issue?.path?.[0] as keyof SouqyKickoffInput | undefined,
    };
  }
  const data = parsed.data;
  if (data.website.length > 0) {
    // Bot — fake-success the way `createBrief` does so they don't
    // probe for differences.
    return {
      status: 'success',
      slug: data.slug,
      revision: 'bot',
      dashboardUrl: `${env.NEXT_PUBLIC_SITE_URL}/account?tab=souqy&store=${encodeURIComponent(data.slug)}`,
      liveUrl: storefrontBaseUrl(data.slug),
    };
  }

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to continue.' };
  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    await logSouqyAudit({
      clerkUserId: userId,
      storefront: null,
      kind: 'paywall_hit',
      status: 'error',
      meta: { reason: gate.reason, surface: 'kickoff' },
    });
    return {
      status: 'error',
      message:
        gate.reason === 'paywall'
          ? 'Souqy is available on Pro + and above.'
          : 'Sign in to continue.',
    };
  }

  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };
  if (!rateLimit(`souqy-kickoff:${await ipKey()}`, 4, 60_000).ok) {
    return { status: 'error', message: 'Too many Souqy launches — try again in a moment.' };
  }
  if ((await getSouqyMonthlyCount(userId)) >= MONTHLY_GENERATION_CAP) {
    return {
      status: 'error',
      message: `You've reached this month's Souqy quota (${MONTHLY_GENERATION_CAP}). Resets on the 1st.`,
    };
  }

  const requested = slugify(data.slug);
  if (isReserved(requested)) {
    return { status: 'error', message: 'That address is reserved.', field: 'slug' };
  }
  let finalSlug = requested;
  try {
    if (await isTaken(requested)) {
      finalSlug = await nextAvailable(requested);
    }
  } catch (err) {
    console.error('[souqyKickoff] slug check failed', err);
    return { status: 'error', message: 'Could not check slug availability.' };
  }

  return provisionStorefrontRunSouqyAndPersist({
    userId,
    finalSlug,
    businessName: data.businessName,
    businessType: data.businessType,
    vibe: data.vibe,
    locale: data.locale,
    auditExtraMeta: { surface: 'kickoff' },
  });
}

/** Marketing homepage: free-text prompt → new storefront + first Souqy build. */
export async function souqyKickoffFromHomepagePrompt(
  input: z.input<typeof HomepagePromptKickoffSchema>,
): Promise<SouqyKickoffState> {
  const parsed = HomepagePromptKickoffSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid prompt',
    };
  }

  const { prompt, locale } = parsed.data;

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to continue.' };
  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    await logSouqyAudit({
      clerkUserId: userId,
      storefront: null,
      kind: 'paywall_hit',
      status: 'error',
      meta: { reason: gate.reason, surface: 'homepage_prompt' },
    });
    return {
      status: 'error',
      message:
        gate.reason === 'paywall'
          ? 'Souqy is available on Pro + and above.'
          : 'Sign in to continue.',
    };
  }

  if (!hasDb()) return { status: 'error', message: 'Database unavailable' };
  if (!rateLimit(`souqy-kickoff:${await ipKey()}`, 4, 60_000).ok) {
    return { status: 'error', message: 'Too many Souqy launches — try again in a moment.' };
  }
  if ((await getSouqyMonthlyCount(userId)) >= MONTHLY_GENERATION_CAP) {
    return {
      status: 'error',
      message: `You've reached this month's Souqy quota (${MONTHLY_GENERATION_CAP}). Resets on the 1st.`,
    };
  }

  const { vibe, businessName, businessType } = deriveHomepageKickoffFields(prompt);
  const requested = ensureKickoffSlugSeed(businessName);
  if (isReserved(requested)) {
    return { status: 'error', message: 'Could not derive a valid address from your description.' };
  }
  let finalSlug = requested;
  try {
    if (await isTaken(requested)) {
      finalSlug = await nextAvailable(requested);
    }
  } catch (err) {
    console.error('[souqyKickoffFromHomepagePrompt] slug check failed', err);
    return { status: 'error', message: 'Could not check slug availability.' };
  }

  return provisionStorefrontRunSouqyAndPersist({
    userId,
    finalSlug,
    businessName,
    businessType,
    vibe,
    locale,
    auditExtraMeta: { surface: 'homepage_prompt' },
  });
}

/**
 * Re-runs the original brief through Souqy. Used by the dashboard "try
 * again" affordance when a founder doesn't love the current draft.
 * Same brief, fresh draw — temperature stays low so iterations are
 * close in spirit but not identical.
 */
export async function souqyRegenerate(
  input: z.input<typeof SlugOnlySchema>,
): Promise<SouqyActionState> {
  const parsed = SlugOnlySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const owner = await souqyGate(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  if (!rateLimit(`souqy-regenerate:${await ipKey()}`, 6, 60_000).ok) {
    return { status: 'error', message: 'Slow down — try again in a minute.' };
  }
  if ((await getSouqyMonthlyCount(owner.userId)) >= MONTHLY_GENERATION_CAP) {
    return {
      status: 'error',
      message: `You've reached this month's Souqy quota (${MONTHLY_GENERATION_CAP}).`,
    };
  }

  const sf = owner.storefront;
  const briefMeta = (sf as unknown as { souqyBrief?: Record<string, unknown> }).souqyBrief;
  // For now we reconstruct the brief from the row + the original
  // `souqy_brief` jsonb. If the original brief is missing (legacy /
  // hand-promoted row), we synthesize one from the storefront fields.
  const brief = {
    businessName: sf.businessName,
    slug: sf.slug,
    businessType: sf.businessType,
    vibe:
      typeof briefMeta?.vibe === 'string'
        ? (briefMeta.vibe as string)
        : `Storefront for ${sf.businessName}, a ${sf.businessType.replace(/_/g, ' ')} based in Doha.`,
    locale: sf.locale,
  };

  const auditId = await logSouqyAudit({
    clerkUserId: owner.userId,
    storefront: sf.slug,
    kind: 'generate',
    status: 'pending',
    prompt: brief.vibe,
    meta: { source: 'regenerate' },
  });
  const result = await runGenerateAndBuild({
    storefront: sf,
    clerkUserId: owner.userId,
    brief,
  });
  if (auditId != null) {
    await updateSouqyAudit(auditId, {
      status: result.status === 'ok' ? 'success' : (result.status as never),
      source: result.status === 'ok' ? result.source : null,
      meta: result.meta,
    });
  }

  if (result.status !== 'ok') {
    return { status: 'error', message: result.message };
  }
  revalidatePath(`/account/${sf.slug}/souqy`);
  revalidatePath(`/brief/${sf.slug}`);
  return { status: 'success', revision: result.revision };
}

/**
 * Re-prompt loop — apply a diff request to the existing source, build,
 * publish. The previous source is fetched fresh from the row each call
 * so concurrent re-prompts can't trample each other.
 */
export async function souqyReprompt(
  input: z.input<typeof RepromptSchema>,
): Promise<SouqyActionState> {
  const parsed = RepromptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid request' };
  }
  const owner = await souqyGate(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  if (!rateLimit(`souqy-reprompt:${await ipKey()}`, 12, 60_000).ok) {
    return { status: 'error', message: 'Too many edits — give it a moment.' };
  }
  if ((await getSouqyMonthlyCount(owner.userId)) >= MONTHLY_GENERATION_CAP) {
    return {
      status: 'error',
      message: `You've reached this month's Souqy quota (${MONTHLY_GENERATION_CAP}).`,
    };
  }

  const sf = owner.storefront;
  const previousSource = (sf as unknown as { souqySource?: string }).souqySource ?? '';
  if (!previousSource) {
    return {
      status: 'error',
      message: 'Nothing to re-prompt yet — generate a Souqy storefront first.',
    };
  }

  const auditId = await logSouqyAudit({
    clerkUserId: owner.userId,
    storefront: sf.slug,
    kind: 'reprompt',
    status: 'pending',
    prompt: parsed.data.request,
  });

  const gen: GenerateResult = await repromptSouqyStorefront({
    request: parsed.data.request,
    previousSource,
    storefront: sf,
    clerkUserId: owner.userId,
  });
  if (gen.status !== 'ok') {
    if (auditId != null) {
      await updateSouqyAudit(auditId, {
        status: gen.status,
        meta: { message: gen.message, issues: gen.issues ?? [] },
      });
    }
    return { status: 'error', message: gen.message };
  }

  const built = await buildSouqyArtifact({
    slug: sf.slug,
    files: {
      'index.tsx': gen.output.files['index.tsx']!,
      'theme.ts': gen.output.files['theme.ts']!,
    },
  });
  if (built.status !== 'ok') {
    if (auditId != null) {
      await updateSouqyAudit(auditId, {
        status: 'build_failed',
        meta: { buildStatus: built.status, message: built.message, log: built.log },
      });
    }
    return { status: 'error', message: built.message };
  }

  const sourceConcat = serializeSource(gen.output);
  await setSouqyRevision({
    slug: sf.slug,
    revision: built.revision,
    blobUrl: built.blobUrl,
    source: sourceConcat,
    brief: null,
  });
  if (auditId != null) {
    await updateSouqyAudit(auditId, {
      status: 'success',
      source: sourceConcat,
      meta: {
        revision: built.revision,
        bytes: built.bytes,
        buildMs: built.buildMs,
        blobUrl: built.blobUrl,
        attempts: gen.attempts,
        usage: gen.usage,
      },
    });
  }
  revalidatePath(`/account/${sf.slug}/souqy`);
  revalidatePath(`/brief/${sf.slug}`);
  return { status: 'success', revision: built.revision };
}

/**
 * Snap the live storefront back to a previous source. Re-builds from
 * scratch (vs swapping the revision pointer) so the artifact in Blob is
 * always content-addressed and a Vercel cache flush picks it up
 * cleanly.
 */
export async function souqyRollback(
  input: z.input<typeof RollbackSchema>,
): Promise<SouqyActionState> {
  const parsed = RollbackSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid request' };
  }
  const owner = await souqyGate(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const audit = await getSouqyAuditById(parsed.data.auditId);
  if (!audit || audit.storefront !== owner.storefront.slug) {
    return { status: 'error', message: 'Revision not found.' };
  }
  if (!audit.source) {
    return { status: 'error', message: 'Revision has no source to restore from.' };
  }
  const files = parseSerializedSource(audit.source);
  if (!files) {
    return { status: 'error', message: 'Revision source is corrupt; cannot restore.' };
  }

  const built = await buildSouqyArtifact({
    slug: owner.storefront.slug,
    files,
  });
  if (built.status !== 'ok') {
    return { status: 'error', message: built.message };
  }
  await setSouqyRevision({
    slug: owner.storefront.slug,
    revision: built.revision,
    blobUrl: built.blobUrl,
    source: audit.source,
    brief: null,
  });
  await logSouqyAudit({
    clerkUserId: owner.userId,
    storefront: owner.storefront.slug,
    kind: 'rollback',
    status: 'success',
    source: audit.source,
    meta: { fromAuditId: audit.id, newRevision: built.revision },
  });
  revalidatePath(`/account/${owner.storefront.slug}/souqy`);
  revalidatePath(`/brief/${owner.storefront.slug}`);
  return { status: 'success', revision: built.revision };
}

/**
 * Disable Souqy for a storefront — the public renderer falls back to
 * the JSON builder pipeline. Source + audit history are preserved so
 * the founder can re-enable later.
 */
export async function souqyClear(input: z.input<typeof SlugOnlySchema>): Promise<SouqyActionState> {
  const parsed = SlugOnlySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const owner = await souqyGate(parsed.data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  await setSouqyRevision({
    slug: owner.storefront.slug,
    revision: null,
    blobUrl: null,
    source: null,
    brief: null,
  });
  revalidatePath(`/account/${owner.storefront.slug}/souqy`);
  revalidatePath(`/brief/${owner.storefront.slug}`);
  return { status: 'success', revision: null };
}

/**
 * Common path for kickoff + regenerate. Generate, build, persist —
 * fold the union types so callers only see one shape.
 */
async function runGenerateAndBuild(args: {
  storefront: Storefront;
  clerkUserId: string;
  brief: {
    businessName: string;
    slug: string;
    businessType: string;
    vibe: string;
    locale: 'en' | 'ar';
  };
}): Promise<
  | {
      status: 'ok';
      revision: string;
      source: string;
      meta: Record<string, unknown>;
    }
  | {
      status: Exclude<GenerateResult['status'] | BuildResult['status'], 'ok'>;
      message: string;
      meta: Record<string, unknown>;
    }
> {
  const gen = await generateSouqyStorefront({
    brief: args.brief,
    clerkUserId: args.clerkUserId,
    storefront: args.storefront,
  });
  if (gen.status !== 'ok') {
    return {
      status: gen.status,
      message: gen.message,
      meta: { issues: gen.issues ?? [] },
    };
  }
  const built = await buildSouqyArtifact({
    slug: args.storefront.slug,
    files: {
      'index.tsx': gen.output.files['index.tsx']!,
      'theme.ts': gen.output.files['theme.ts']!,
    },
  });
  if (built.status !== 'ok') {
    return {
      status: built.status,
      message: built.message,
      meta: { log: built.log, attempts: gen.attempts, usage: gen.usage },
    };
  }
  const source = serializeSource(gen.output);
  await setSouqyRevision({
    slug: args.storefront.slug,
    revision: built.revision,
    blobUrl: built.blobUrl,
    source,
    brief: args.brief,
  });
  return {
    status: 'ok',
    revision: built.revision,
    source,
    meta: {
      revision: built.revision,
      bytes: built.bytes,
      buildMs: built.buildMs,
      blobUrl: built.blobUrl,
      attempts: gen.attempts,
      usage: gen.usage,
    },
  };
}

/**
 * The two source files are persisted as a single string with a stable
 * delimiter — the revision history just needs to round-trip them. JSON
 * would also work but keeps the stored text harder to read in DB
 * inspection tools.
 */
const SOURCE_DELIM = '\n//=== ';

function serializeSource(out: SouqyOutput): string {
  return Object.entries(out.files)
    .map(([name, body]) => `${SOURCE_DELIM}${name} ===\n${body}`)
    .join('\n');
}

function parseSerializedSource(
  serialized: string,
): { 'index.tsx': string; 'theme.ts': string } | null {
  const files: Record<string, string> = {};
  const re = /\n\/\/=== ([\w./-]+) ===\n([\s\S]*?)(?=\n\/\/=== |\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serialized))) {
    const name = m[1];
    const body = m[2];
    if (name && body !== undefined) {
      files[name] = body;
    }
  }
  if (!files['index.tsx'] || !files['theme.ts']) return null;
  return { 'index.tsx': files['index.tsx'], 'theme.ts': files['theme.ts'] };
}

/**
 * Coarse mapping from intake businessType → which template's palette
 * Souqy stores fall back to if a founder later toggles off Souqy.
 */
function pickFallbackTemplate(type: string): TemplateId {
  switch (type) {
    case 'cafe':
    case 'home_kitchen':
    case 'fnb_brand':
      return 'lounge';
    case 'salon':
    case 'fitness':
    case 'graphic_design':
    case 'photography':
      return 'studio';
    case 'art_gallery':
    case 'tailoring_abaya':
      return 'atrium';
    case 'clothing_store':
    case 'perfume_oud':
    case 'ecommerce':
      return 'souqline';
    default:
      return 'bazaar';
  }
}

/**
 * In-builder block editor — the cheap, scoped Souqy surface that powers
 * the action-bar prompt on a selected block. Edits the props/style of
 * a single block on a single page; the model has no API to touch any
 * other block. Designed to feel like a one-button-tap from the founder
 * (~1.2s typical), so it skips the kickoff/build pipeline entirely and
 * writes straight back through the same `savePageDraftBlocks` path the
 * visual builder uses for every drag, drop, and inspector keystroke.
 *
 * Off-topic prompts are refused for free at the keyword gate before any
 * model call. The model itself can also call the `refuse` tool — both
 * paths return the same canned founder-facing copy.
 */
export async function souqyEditBlock(input: SouqyEditBlockInput): Promise<SouqyEditBlockState> {
  const parsed = EditBlockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid request',
    };
  }
  const data = parsed.data;

  const owner = await souqyGate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  // Tighter rate limit than reprompt (20/min) since the founder will
  // legitimately tap this many times in a row while iterating on a
  // single block. Keyed by IP rather than user so a shared workspace
  // can't trip a single founder's bucket.
  if (!rateLimit(`souqy-edit-block:${await ipKey()}`, 20, 60_000).ok) {
    return {
      status: 'error',
      message: 'Slow down — try again in a moment.',
    };
  }
  if ((await getSouqyMonthlyCount(owner.userId)) >= MONTHLY_GENERATION_CAP) {
    return {
      status: 'error',
      message: `You've reached this month's Souqy quota (${MONTHLY_GENERATION_CAP}). Resets on the 1st.`,
    };
  }

  // Cheap pre-LLM topic gate. Off-topic prompts ("write me an email",
  // "what is my plan?") never reach the model, so they cost nothing.
  if (!isBuilderRequest(data.request)) {
    await logSouqyAudit({
      clerkUserId: owner.userId,
      storefront: owner.storefront.slug,
      kind: 'edit_block',
      status: 'error',
      prompt: data.request,
      meta: { reason: 'topic_gate', pageId: data.pageId, blockId: data.blockId },
    });
    return { status: 'refused', message: souqyRefusalCopy() };
  }

  const page = await getPageById(data.pageId);
  if (!page || page.storefrontSlug !== owner.storefront.slug) {
    return { status: 'error', message: 'Page not found.' };
  }
  const idx = page.draftBlocks.findIndex((b) => b.id === data.blockId);
  if (idx === -1) {
    return { status: 'error', message: 'Block no longer exists on this page.' };
  }
  const target = page.draftBlocks[idx];
  if (!target) {
    return { status: 'error', message: 'Block no longer exists on this page.' };
  }

  const auditId = await logSouqyAudit({
    clerkUserId: owner.userId,
    storefront: owner.storefront.slug,
    kind: 'edit_block',
    status: 'pending',
    prompt: data.request,
    meta: {
      pageId: data.pageId,
      blockId: data.blockId,
      blockType: target.type,
    },
  });

  const result = await editBlockWithSouqy({
    block: target,
    request: data.request,
    clerkUserId: owner.userId,
  });

  if (result.status !== 'ok') {
    if (auditId != null) {
      await updateSouqyAudit(auditId, {
        status: result.status === 'refused' ? 'error' : result.status,
        meta: { message: result.message },
      });
    }
    return result.status === 'refused'
      ? { status: 'refused', message: result.message }
      : { status: 'error', message: result.message };
  }

  const nextBlocks: Block[] = page.draftBlocks.slice();
  nextBlocks[idx] = result.block;

  try {
    await savePageDraftBlocks(page.id, nextBlocks);
  } catch (err) {
    console.error('[souqyEditBlock] savePageDraftBlocks failed', err);
    if (auditId != null) {
      await updateSouqyAudit(auditId, {
        status: 'error',
        meta: { message: 'persist_failed' },
      });
    }
    return { status: 'error', message: 'Could not save the edit. Try again.' };
  }

  if (auditId != null) {
    await updateSouqyAudit(auditId, {
      status: 'success',
      meta: {
        patches: result.patches,
        steps: result.steps,
        usage: result.usage,
      },
    });
  }

  // The builder iframe re-renders from local state via `PreviewBridge`,
  // so we don't need to wait on a router revalidation for the founder
  // to see the change. We still revalidate so a fresh server render
  // (e.g. open in a new tab) reflects the new draft.
  revalidatePath(`/account/builder`);
  revalidatePath(`/brief/${owner.storefront.slug}`);

  return { status: 'ok', block: result.block };
}
