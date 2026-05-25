'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { auth, currentUser } from '@clerk/nextjs/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { isLocale, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import {
  getStorefrontsForUser,
  insertStorefront,
  publishDraft,
  saveDraft,
  TEMPLATE_IDS,
  type Storefront,
  type TemplateId,
} from '@/lib/brief';
import { isReserved, isTaken, nextAvailable, slugify } from '@/lib/slug';
import { hasDb } from '@/lib/db';
import { isTemplateUnlocked, minPlanForTemplate, templatePresets } from '@/lib/templates';
import { getPlan, patchPlanMeta, PLAN_LIMITS, storefrontCapForPlan } from '@/lib/billing';
import { logEvent } from '@/lib/events';
import { bootBlocksFromStorefront } from '@/lib/blocks/boot';
import { seedTemplateDemoProducts } from '@/lib/blocks/demoProducts';
import { pushFirstWebsiteCongratsNotification } from '@/lib/notifications';
import { sendSouqnaStoreCreatedTemplate } from '@/lib/apps/whatsapp';
import {
  ensureHomePage,
  publishPage,
  saveDraftBlocks,
} from '@/lib/storefrontPages';

/**
 * createBrief — provisions a new storefront from the /begin intake.
 *
 * The intake was rewritten in 2026-04 to be welcoming rather than
 * questionnaire-shaped. The form now collects:
 *
 *   - ownership (have_business | want_to_start) — branches the flow
 *   - businessName + slug (auto-derived, live availability check)
 *   - businessType (only when starting from scratch — existing
 *     businesses skip this and pick a generic flavour)
 *   - templateId (atelier | souq | pavilion — bundles palette + layout)
 *   - crNumber (optional Qatari Commercial Registration)
 *
 * Marketing-only fields (marketVolume, payments, experience, tagline,
 * phone, area, hours, instagram, logoUrl) are no longer asked for; the
 * dashboard handles them after launch. We default the legacy enum
 * columns to safe values so old reports keep working.
 */

const Schema = z.object({
  businessName: z.string().trim().min(1).max(160),
  ownership: z.enum(['have_business', 'want_to_start']),
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
  templateId: z.enum(TEMPLATE_IDS),
  crNumber: z.string().trim().max(40).optional().or(z.literal('')).default(''),
  logoUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        z.string().url().safeParse(value).success ||
        value.startsWith('data:image/png;base64,'),
      'Invalid logo image',
    )
    .optional()
    .default(''),
  slug: z.string().trim().min(3).max(40),
  /** Honeypot — real users leave it empty; bots fill it. */
  website: z.string().max(0).optional().default(''),
  locale: z.string().refine(isLocale, 'invalid locale'),
});

export type CreateBriefInput = z.input<typeof Schema>;
export type CreateBriefState =
  | { status: 'idle' }
  | { status: 'success'; slug: string; url: string; dashboardUrl: string }
  | { status: 'error'; message: string; field?: keyof CreateBriefInput };

export async function createBrief(input: CreateBriefInput): Promise<CreateBriefState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const locale = isLocale(input.locale) ? (input.locale as Locale) : 'en';
    const t = getCopy(locale).begin.validation;
    const order: Array<keyof CreateBriefInput> = [
      'businessName',
      'ownership',
      'businessType',
      'templateId',
      'slug',
    ];
    for (const k of order) {
      if (flat.fieldErrors[k]) {
        const map: Partial<Record<keyof CreateBriefInput, string>> = {
          businessName: t.bizRequired,
          ownership: t.ownershipRequired,
          businessType: t.businessTypeRequired,
          templateId: t.templateRequired,
          slug: t.slugRequired,
        };
        return {
          status: 'error',
          message: map[k] || getCopy(locale).begin.error.generic,
          field: k,
        };
      }
    }
    return { status: 'error', message: getCopy(locale).begin.error.generic };
  }

  const data = parsed.data;
  const locale = data.locale as Locale;
  const tBegin = getCopy(locale).begin;

  if (data.website.length > 0) {
    return {
      status: 'success',
      slug: data.slug,
      url: `https://${data.slug}.${env.BRIEF_ROOT_DOMAIN}`,
      dashboardUrl: `${env.NEXT_PUBLIC_SITE_URL}/account/builder?store=${encodeURIComponent(data.slug)}`,
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: tBegin.error.signInRequired };
  }

  // Plan-tier gates. Both run before any DB write so a founder hitting
  // their cap never gets a half-provisioned storefront.
  const callerPlan = await getPlan(userId);
  let existingStorefrontCount: number | null = null;

  // 1. Template tier — block, with an upsell CTA, if the caller picked
  //    a template that isn't included in their plan. Mirrors the
  //    locked-tile UX in the Site inspector so the surface error feels
  //    consistent regardless of where the founder enters from.
  if (!isTemplateUnlocked(data.templateId as TemplateId, callerPlan)) {
    const min = minPlanForTemplate(data.templateId as TemplateId);
    return {
      status: 'error',
      field: 'templateId',
      message: `${templatePresets[data.templateId as TemplateId]?.label ?? 'This template'} is available on ${PLAN_LIMITS[min].label} and above. Upgrade from /account/settings/plan or pick a Free template.`,
    };
  }

  // 2. Storefront count: Free is 1, Pro is 2, Pro+ is 8, Max+ is
  //    unlimited. Counted live so a founder who's been moved between
  //    plans by a manual grant always sees the current cap.
  try {
    const owned = await getStorefrontsForUser(userId);
    existingStorefrontCount = owned.length;
    const cap = storefrontCapForPlan(callerPlan);
    if (owned.length >= cap) {
      return {
        status: 'error',
        message:
          callerPlan === 'free'
            ? "You've reached the one-storefront limit on Free. Upgrade to unlock growth tools from /account/settings/plan."
            : `You've reached the ${cap}-storefront limit on ${PLAN_LIMITS[callerPlan].label}. Upgrade your plan from /account/settings/plan.`,
      };
    }
  } catch (err) {
    console.error('[createBrief] storefront count check failed', err);
    // Soft-fail to avoid blocking creation when the cap query is the
    // only thing wrong — the rest of the action still defends against
    // bad data via the slug uniqueness check.
  }

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
  const userPhone =
    user?.primaryPhoneNumber?.phoneNumber?.trim() ||
    user?.phoneNumbers?.[0]?.phoneNumber?.trim() ||
    null;
  if (userPhone) {
    await patchPlanMeta(userId, {
      notification_phone: userPhone,
      notification_phone_verified: user?.primaryPhoneNumber?.verification?.status === 'verified',
      notification_channels: ['bell', 'mobile', 'phone'],
      founder_name: founderName,
    });
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  const limit = rateLimit(`brief:${ip}`, 3, 60_000);
  if (!limit.ok) {
    return { status: 'error', message: tBegin.error.rateLimit };
  }

  const requested = slugify(data.slug);
  if (isReserved(requested)) {
    return { status: 'error', message: tBegin.step3.helpers.slugReserved, field: 'slug' };
  }
  if (!hasDb()) {
    console.warn('[createBrief] DATABASE_URL missing — refusing to provision');
    return { status: 'error', message: tBegin.error.generic };
  }

  let finalSlug = requested;
  try {
    if (await isTaken(requested)) {
      finalSlug = await nextAvailable(requested);
    }
  } catch (err) {
    console.error('[createBrief] slug check failed', err);
    return { status: 'error', message: tBegin.error.generic };
  }

  const preset = templatePresets[data.templateId as TemplateId];

  let createdStorefront: Storefront;
  try {
    createdStorefront = await insertStorefront({
      slug: finalSlug,
      locale,
      founderName,
      businessName: data.businessName,
      contactEmail,
      ownership: data.ownership,
      // Legacy enum columns we no longer ask about — sensible defaults so
      // analytics + back-compat queries keep working.
      experience: 'first_time',
      businessType: data.businessType,
      marketVolume: 'qatar',
      payments: 'planning',
      design: 'atrium',
      palette: preset.palette,
      templateId: data.templateId as TemplateId,
      crNumber: data.crNumber ? data.crNumber.trim() : null,
      tagline: null,
      phone: null,
      area: null,
      hours: null,
      instagram: null,
      logoUrl: data.logoUrl ? data.logoUrl.trim() : null,
      faviconUrl: null,
      clerkUserId: userId,
    });
  } catch (err) {
    console.error('[createBrief] insert failed', err);
    return { status: 'error', message: tBegin.error.generic };
  }

  // Seed themed demo products so the new storefront's product blocks
  // render with content out of the box. Idempotent: only inserts when
  // the products table is empty for this slug, so a retry of /begin
  // after a partial failure won't duplicate. Failure is best-effort —
  // a founder always sees the storefront, even if seeds didn't land.
  try {
    await seedTemplateDemoProducts(
      finalSlug,
      data.templateId as TemplateId,
      data.businessType,
      data.locale,
    );
  } catch (err) {
    console.warn('[createBrief] demo product seed failed', err);
  }

  // The template choice must become the actual webstore immediately.
  // Seed + publish the chosen template's block recipe now so the public
  // storefront, builder canvas, and Browse Templates preview all share
  // the same composition from the first redirect.
  try {
    const blocks = bootBlocksFromStorefront(createdStorefront);
    const saved = await saveDraft(finalSlug, blocks, preset.theme);
    if (saved) {
      await publishDraft(finalSlug);
    }
    const home = await ensureHomePage(finalSlug, blocks);
    await saveDraftBlocks(home.id, blocks);
    await publishPage(home.id);
    revalidatePath(`/brief/${finalSlug}`, 'layout');
    revalidatePath('/account');
    revalidatePath('/account/builder');
  } catch (err) {
    // Non-fatal: the storefront renderer now synthesizes the chosen
    // template when saved blocks are missing, and the builder can still
    // seed on first open. Logging keeps this visible without trapping a
    // founder after their row has already been created.
    console.warn('[createBrief] template seed/publish failed', err);
  }

  // Souqna Pulse — funnel telemetry. We `await` rather than `void` because
  // Next.js tears down the request context as soon as the server action
  // returns; a fire-and-forget HTTP insert can be cancelled mid-flight.
  // logEvent has its own try/catch and never throws, so awaiting is safe.
  await logEvent({
    kind: 'storefront.created',
    funnel: 'storefront',
    step: 1,
    userId,
    storefront: finalSlug,
    ip,
    ua: hdrs.get('user-agent'),
    props: {
      template: data.templateId,
      ownership: data.ownership,
      businessType: data.businessType,
      hasCr: Boolean(data.crNumber),
      locale,
    },
  });

  // Best-effort signup detection: Clerk doesn't ping us on sign-up
  // unless a webhook is configured, but `user.createdAt` is reliable
  // and we already have the user object in hand. If the account was
  // born within the last 5 minutes, this createBrief almost certainly
  // sits on the immediate post-signup path.
  // Clerk's `user.createdAt` is a Unix-ms number; older SDK builds expose it
  // as a Date. Handle both shapes defensively without tripping the
  // `instanceof Date` constraint on a non-object union member.
  const rawCreatedAt: unknown = user?.createdAt;
  const createdAtMs =
    typeof rawCreatedAt === 'number'
      ? rawCreatedAt
      : rawCreatedAt instanceof Date
        ? rawCreatedAt.getTime()
        : null;
  if (createdAtMs && Date.now() - createdAtMs < 5 * 60_000) {
    await logEvent({
      kind: 'signup.completed',
      funnel: 'onboarding',
      step: 3,
      userId,
      storefront: finalSlug,
      ip,
      ua: hdrs.get('user-agent'),
      props: { locale, source: 'createBrief' },
    });
  }

  const publicUrl = `https://${finalSlug}.${env.BRIEF_ROOT_DOMAIN}`;
  const dashboardUrl = `${env.NEXT_PUBLIC_SITE_URL}/account/builder?store=${encodeURIComponent(finalSlug)}`;

  try {
    const whatsapp = await sendSouqnaStoreCreatedTemplate({
      phone: userPhone,
      founderName,
      businessName: data.businessName,
      dashboardUrl,
    });
    if (whatsapp.status === 'error') {
      console.warn('[createBrief] store WhatsApp failed', whatsapp.reason);
    }
  } catch (err) {
    console.warn('[createBrief] store WhatsApp failed', err);
  }

  if (existingStorefrontCount === 0) {
    await pushFirstWebsiteCongratsNotification({
      userId,
      businessName: data.businessName,
      slug: finalSlug,
      url: dashboardUrl,
    });
  }

  if (env.RESEND_API_KEY) {
    try {
      const resend = new Resend(env.RESEND_API_KEY);
      const subject = `Souqna · new storefront — ${data.businessName} (${finalSlug})`;
      const text = [
        `Founder:        ${founderName}`,
        `Business:       ${data.businessName}`,
        `Email:          ${contactEmail}`,
        `Clerk user:     ${userId}`,
        `Locale:         ${locale}`,
        `Ownership:      ${data.ownership}`,
        `Business type:  ${data.businessType}`,
        `Template:       ${data.templateId}`,
        `CR:             ${data.crNumber || '—'}`,
        '',
        `Private storefront URL: ${publicUrl}`,
        `Owner builder: ${dashboardUrl}`,
      ].join('\n');
      const atelierResult = await resend.emails.send({
        from: env.CONTACT_FROM,
        to: env.CONTACT_TO,
        subject,
        text,
        replyTo: contactEmail || undefined,
      });
      if (atelierResult.error) {
        console.error('[createBrief] atelier email error', atelierResult.error);
      }
    } catch (err) {
      console.error('[createBrief] email send failed', err);
    }
  }

  return { status: 'success', slug: finalSlug, url: publicUrl, dashboardUrl };
}
