'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { hasDb } from '@/lib/db';
import {
  deleteStorefront,
  discardDraft,
  getStorefront,
  publishDraft,
  saveDraft,
  saveTheme,
  setStorefrontTemplate,
  unpublishStorefront,
  updateSubdomainStatus,
  TEMPLATE_IDS,
} from '@/lib/brief';
import { createNotification } from '@/lib/notifications';
import { blocksSchema, themeOverridesSchema } from '@/lib/blocks/schemas';
import { bootBlocksFromStorefront } from '@/lib/blocks/boot';
import { seedTemplateDemoProducts } from '@/lib/blocks/demoProducts';
import {
  isTemplateUnlocked,
  minPlanForTemplate,
  templatePresets,
} from '@/lib/templates';
import {
  getPlan,
  isPremiumBlockType,
  PLAN_LIMITS,
  UPGRADE_GROWTH_TOOLS_COPY,
  planUnlocksPremiumBlocks,
  planUnlocksSeoSettings,
} from '@/lib/billing';
import { logEvent } from '@/lib/events';
import { recordPulseActivity } from '@/lib/pulseActivity';
import { ensureStorefrontDomain } from '@/lib/vercelDomains';
import * as Sentry from '@sentry/nextjs';
import { env as appEnv } from '@/lib/env';
import { disableSouqyRouting } from '@/lib/souqy/db';
import {
  ensureHomePage,
  getPageById,
  publishPage as publishPageRow,
  saveDraftBlocks as savePageDraftBlocks,
  type StorefrontPage,
} from '@/lib/storefrontPages';
import type { Block, ThemeOverrides } from '@/lib/blocks/types';

const SlugSchema = z.string().trim().min(3).max(40);
const PageIdSchema = z.string().uuid();

const SaveDraftSchema = z.object({
  slug: SlugSchema,
  blocks: blocksSchema,
  theme: themeOverridesSchema.nullable().optional(),
  pageId: PageIdSchema.optional(),
});

const SaveThemeSchema = z.object({
  slug: SlugSchema,
  theme: themeOverridesSchema,
});

const PublishSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema.optional(),
});
const DiscardSchema = z.object({ slug: SlugSchema });
const SeedSchema = z.object({
  slug: SlugSchema,
  pageId: PageIdSchema.optional(),
});

const SwitchTemplateSchema = z.object({
  slug: SlugSchema,
  templateId: z.enum(TEMPLATE_IDS),
  pageId: PageIdSchema.optional(),
});

/**
 * Resolve the page a builder action should operate on. When the
 * caller passes an explicit `pageId` we trust it (after ownership
 * gating) — otherwise we fall back to the storefront's home page.
 *
 * If a freshly-provisioned storefront predates migration 018's
 * backfill (no `home` row yet), we synthesise one on the fly so the
 * builder always has somewhere to write. Cross-storefront page ids
 * are rejected as a safety net for the multi-tenant boundary.
 */
async function resolvePageForSlug(
  slug: string,
  pageId: string | undefined,
): Promise<{ ok: true; page: StorefrontPage } | { ok: false; message: string }> {
  if (pageId) {
    const explicit = await getPageById(pageId);
    if (!explicit || explicit.storefrontSlug !== slug) {
      return { ok: false, message: 'Page not found' };
    }
    return { ok: true, page: explicit };
  }
  const home = await ensureHomePage(slug);
  return { ok: true, page: home };
}

/**
 * Deletes require a `confirm` field that exactly matches the slug. This
 * is the same pattern GitHub / Stripe use for irreversible destructive
 * actions — it makes accidental deletion (autofill, click-through,
 * misclicked menu items) statistically impossible without surfacing
 * jarring native dialogs.
 */
const DeleteSchema = z
  .object({ slug: SlugSchema, confirm: z.string().trim() })
  .refine((d) => d.confirm === d.slug, {
    message: 'Confirmation phrase does not match.',
    path: ['confirm'],
  });

export type BuilderActionState =
  | { status: 'idle' }
  | { status: 'success'; publishedAt?: string | null; blocks?: Block[]; theme?: ThemeOverrides }
  | { status: 'error'; message: string };

async function gate(slug: string): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  if (!hasDb()) return { ok: false, message: 'Database unavailable' };
  const { userId } = await auth();
  if (!userId) return { ok: false, message: 'Forbidden' };
  const sf = await getStorefront(slug);
  if (!sf) return { ok: false, message: 'Storefront not found' };
  if (sf.clerkUserId !== userId) return { ok: false, message: 'Forbidden' };
  return { ok: true, userId };
}

async function rateGate(scope: string, limit = 120): Promise<boolean> {
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  return rateLimit(`${scope}:${ip}`, limit, 60_000).ok;
}

/**
 * Persist a builder draft. Validates `blocks` and (optional) `theme`
 * against the per-block Zod schemas before writing to JSONB so a
 * compromised client can't smuggle dangerous payloads. Throws are caught
 * and surfaced as a soft error message.
 */
export async function saveDraftBlocks(
  input: z.input<typeof SaveDraftSchema>,
): Promise<BuilderActionState> {
  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) {
    // Surface the first zod issue so the client can show why the save
    // failed — silent "Invalid block payload" makes the inspector feel
    // broken (e.g. a stray field on a strict schema) without any clue.
    const issue = parsed.error.issues[0];
    const where = issue?.path?.join('.') ?? 'payload';
    console.error('[saveDraftBlocks] schema rejected payload', {
      issues: parsed.error.issues,
    });
    return {
      status: 'error',
      message: issue ? `Invalid ${where}: ${issue.message}` : 'Invalid block payload',
    };
  }
  const data = parsed.data;
  if (!(await rateGate('builder-save', 240))) {
    return { status: 'error', message: 'Too many edits — try again in a moment.' };
  }
  const owner = await gate(data.slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  const cleanedBlocks: Block[] = data.blocks as Block[];
  const callerPlan = await getPlan(owner.userId);
  if (!planUnlocksPremiumBlocks(callerPlan)) {
    const lockedBlock = cleanedBlocks.find((block) => isPremiumBlockType(block.type));
    if (lockedBlock) {
      return {
        status: 'error',
        message: 'Premium builder blocks are available on Pro+. Upgrade to save this draft.',
      };
    }
  }
  if (data.theme?.seo && !planUnlocksSeoSettings(callerPlan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }

  try {
    // Resolve the target page (defaults to the storefront's home page so
    // the legacy single-page BuilderShell keeps working without a flag
    // day). The page-level write mirrors `briefs.draft_blocks` for the
    // home page so older readers still see fresh content.
    const resolved = await resolvePageForSlug(data.slug, data.pageId);
    if (!resolved.ok) return { status: 'error', message: resolved.message };

    const savedPage = await savePageDraftBlocks(resolved.page.id, cleanedBlocks);

    // Theme is still per-storefront (one record on `briefs`) — only
    // persist when explicitly passed in this save. Block-only saves
    // never touch theme.
    let themeForReturn: ThemeOverrides | undefined;
    if (data.theme !== undefined) {
      const updated = await saveDraft(
        data.slug,
        savedPage.draftBlocks,
        (data.theme ?? null) as ThemeOverrides | null,
      );
      if (!updated) return { status: 'error', message: 'Save failed' };
      themeForReturn = updated.themeOverrides;
    }

    revalidatePath('/account');
    revalidatePath(`/account/${data.slug}/preview`);
    revalidatePath('/account/builder');
    return {
      status: 'success',
      blocks: savedPage.draftBlocks,
      theme: themeForReturn,
    };
  } catch (err) {
    console.error('[saveDraftBlocks] failed', err);
    return { status: 'error', message: 'Save failed' };
  }
}

/**
 * Push the current draft to the public storefront. Mirrors the legacy
 * "save and live" behaviour but as a separate explicit step so founders
 * can iterate freely in the builder without affecting the live site.
 */
export async function publishStorefront(
  input: z.input<typeof PublishSchema>,
): Promise<BuilderActionState> {
  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug, pageId } = parsed.data;
  if (!(await rateGate('builder-publish', 30))) {
    return { status: 'error', message: 'Too many publishes — try again in a moment.' };
  }
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    // Page-level publish — when this is the home page the data layer
    // mirrors `published_blocks` + `is_published` + `published_at` onto
    // the briefs row so the public renderer's legacy pipeline keeps
    // serving the latest tree.
    const resolved = await resolvePageForSlug(slug, pageId);
    if (!resolved.ok) return { status: 'error', message: resolved.message };
    await publishPageRow(resolved.page.id);

    // Re-read the storefront so the Souqy-routing override and the
    // returned `publishedAt` reflect the post-publish state. For a
    // home-page publish the data layer already mirrored to `briefs`
    // (incl. `published_at`); for a non-home publish we still want
    // a fresh storefront for the Souqy short-circuit and revalidation.
    const updated = await getStorefront(slug);
    if (!updated) return { status: 'error', message: 'Publish failed' };

    // If this storefront was previously rendered by a Souqy AI bundle
    // (`souqy_revision` non-null), the public renderer prefers it over
    // `published_blocks` — so an explicit publish from the JSON builder
    // would silently no-op on the live site. Treat publish as the
    // founder saying "use my hand-edited blocks" and switch the
    // renderer back to the JSON pipeline. We only null the routing
    // pointers; `souqy_source` + audit history are preserved so the
    // founder can flip Souqy back on later from `/account/{slug}/souqy`.
    if (updated.souqyRevision != null || updated.souqyBlobUrl != null) {
      try {
        await disableSouqyRouting(slug);
        revalidatePath(`/account/${slug}/souqy`);
      } catch (err) {
        console.warn('[publishStorefront] souqy disable failed', err);
      }
    }

    revalidatePath(`/brief/${slug}`);
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);

    // Provision the storefront's apex hostname on Vercel so SSL is issued.
    // Cloudflare hosts our DNS, so we can't auto-issue a wildcard cert for
    // *.souqna.qa — but adding each storefront as a discrete project domain
    // unlocks a per-host Let's Encrypt cert via HTTP-01. Non-fatal: the row
    // is already published, and the .co wildcard keeps working regardless.
    const domain = await ensureStorefrontDomain(slug);
    if (domain.ok) {
      // `exists` means the hostname is already attached and Vercel has
      // (almost certainly) issued the cert in a prior run; the popover
      // poller will confirm and surface a `storefront.live` row. A
      // freshly `created` host stays `pending` until the poll flips it.
      await updateSubdomainStatus(slug, domain.status === 'exists' ? 'live' : 'pending');
      if (domain.status === 'exists') {
        await createNotification({
          userId: owner.userId,
          kind: 'storefront.live',
          title: 'Your store is live',
          body: `${slug}.${appEnv.BRIEF_ROOT_DOMAIN} is reachable.`,
          href: `https://${slug}.${appEnv.BRIEF_ROOT_DOMAIN}`,
          meta: { slug, url: `https://${slug}.${appEnv.BRIEF_ROOT_DOMAIN}` },
        });
      }
    } else {
      console.warn('[publishStorefront] domain provisioning failed', {
        slug,
        message: domain.message,
      });
      await updateSubdomainStatus(slug, 'failed', domain.message);
      Sentry.captureMessage('subdomain provision failed', {
        level: 'warning',
        extra: { slug, message: domain.message },
      });
      await createNotification({
        userId: owner.userId,
        kind: 'storefront.provision_failed',
        title: domain.fallbackUrl
          ? 'Your store is published on a backup link'
          : 'Could not bring your store online',
        body: domain.fallbackUrl
          ? `Primary domain needs attention. Your store is available at ${domain.fallbackUrl}.`
          : domain.message,
        href: `/account/settings/domain?store=${slug}`,
        meta: {
          slug,
          error: domain.message,
          code: domain.code,
          primaryUrl: domain.primaryUrl,
          fallbackUrl: domain.fallbackUrl,
        },
      });
    }

    await logEvent({
      kind: 'storefront.published',
      funnel: 'storefront',
      step: 2,
      userId: owner.userId,
      storefront: slug,
      props: {
        publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
      },
    });
    return {
      status: 'success',
      publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
    };
  } catch (err) {
    console.error('[publishStorefront] failed', err);
    return { status: 'error', message: 'Publish failed' };
  }
}

/**
 * Reset the draft back to whatever's currently published. The builder
 * exposes this as a "Discard changes" affordance.
 */
export async function discardBuilderDraft(
  input: z.input<typeof DiscardSchema>,
): Promise<BuilderActionState> {
  const parsed = DiscardSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug } = parsed.data;
  if (!(await rateGate('builder-discard', 30))) {
    return { status: 'error', message: 'Too many requests' };
  }
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const updated = await discardDraft(slug);
    if (!updated) return { status: 'error', message: 'Discard failed' };
    // Mirror onto the home page row so the new page-aware loaders see
    // the discarded state too. Other pages aren't touched — discard
    // is a home-only "revert to live" affordance pre-PageSwitcher.
    try {
      const home = await ensureHomePage(slug, updated.draftBlocks);
      await savePageDraftBlocks(home.id, updated.draftBlocks);
    } catch (mirrorErr) {
      console.warn('[discardBuilderDraft] home-page mirror failed', mirrorErr);
    }
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);
    // The builder treats Discard as the strongest "I'm abandoning this
    // edit session" signal we can capture server-side. Pulse uses it to
    // count abandonment in the publish funnel.
    await logEvent({
      kind: 'storefront.abandoned',
      funnel: 'storefront',
      userId: owner.userId,
      storefront: slug,
      props: { reason: 'discard_draft' },
    });
    return { status: 'success', blocks: updated.draftBlocks, theme: updated.themeOverrides };
  } catch (err) {
    console.error('[discardBuilderDraft] failed', err);
    return { status: 'error', message: 'Discard failed' };
  }
}

/**
 * Permanently delete a storefront. Removes the `briefs` row, which
 * cascades to delete every product attached to that slug. The dashboard
 * delete button posts the slug as `confirm` to make accidental deletion
 * impossible — a missing or wrong confirm short-circuits before any DB
 * write.
 *
 * Revalidates `/account` so the deleted card disappears as soon as the
 * caller redirects/navigates back.
 */
/**
 * Hide the storefront from buyers without deleting any data. Sets
 * `is_published = false` on the briefs row; the public renderer
 * short-circuits to a 404 for unpublished storefronts. The founder
 * can flip back to live by publishing again from the builder. Used
 * by the Websites settings page so a founder can pause a store
 * during a rebrand without losing the published tree.
 */
export async function unpublishStorefrontAction(
  input: { slug: string },
): Promise<BuilderActionState> {
  const slug = SlugSchema.safeParse(input.slug);
  if (!slug.success) return { status: 'error', message: 'Invalid request' };
  if (!(await rateGate('builder-unpublish', 30))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(slug.data);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const updated = await unpublishStorefront(slug.data);
    if (!updated) return { status: 'error', message: 'Storefront not found' };
    revalidatePath('/account');
    revalidatePath('/account/settings/websites');
    revalidatePath(`/brief/${slug.data}`);
    await logEvent({
      kind: 'storefront.unpublished',
      funnel: 'storefront',
      userId: owner.userId,
      storefront: slug.data,
      props: {},
    });
    await createNotification({
      userId: owner.userId,
      kind: 'storefront.unpublished',
      title: 'Store unpublished',
      body: `${slug.data}.${appEnv.BRIEF_ROOT_DOMAIN} is no longer reachable.`,
      href: `/account/settings/websites?store=${slug.data}`,
      meta: { slug: slug.data },
    });
    return { status: 'success' };
  } catch (err) {
    console.error('[unpublishStorefrontAction] failed', err);
    return { status: 'error', message: 'Unpublish failed' };
  }
}

export async function deleteStorefrontAction(
  input: z.input<typeof DeleteSchema>,
): Promise<BuilderActionState> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid request',
    };
  }
  const { slug } = parsed.data;
  if (!(await rateGate('builder-delete', 10))) {
    return { status: 'error', message: 'Too many requests — try again in a moment.' };
  }
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const storefront = await getStorefront(slug);
    await recordPulseActivity({
      source: 'builder',
      kind: 'storefront.deleted',
      actorClerkUserId: owner.userId,
      ownerClerkUserId: owner.userId,
      storefrontSlug: slug,
      resourceType: 'storefront',
      resourceId: slug,
      title: storefront?.businessName ?? slug,
      summary: `Deleted storefront ${storefront?.businessName ?? slug}`,
      metadata: {
        slug,
        businessName: storefront?.businessName ?? null,
        locale: storefront?.locale ?? null,
        isPublished: storefront?.isPublished ?? null,
        customDomain: storefront?.customDomain ?? null,
      },
    });
    const removed = await deleteStorefront(slug);
    if (!removed) return { status: 'error', message: 'Project not found' };
    revalidatePath('/account');
    revalidatePath(`/brief/${slug}`);
    return { status: 'success' };
  } catch (err) {
    console.error('[deleteStorefrontAction] failed', err);
    return { status: 'error', message: 'Delete failed' };
  }
}

/**
 * Persist theme overrides (palette, typography, page background, SEO).
 * Separate from `saveDraftBlocks` because the dedicated Theme page edits
 * site-wide settings, not the block tree. Theme writes also publish
 * immediately — there's no "draft theme" surface to dogfood.
 */
export async function saveThemeOverrides(
  input: z.input<typeof SaveThemeSchema>,
): Promise<BuilderActionState> {
  const parsed = SaveThemeSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid theme payload' };
  const { slug, theme } = parsed.data;
  if (!(await rateGate('builder-theme', 60))) {
    return { status: 'error', message: 'Too many edits — try again in a moment.' };
  }
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  const plan = await getPlan(owner.userId);
  if ((theme as ThemeOverrides).seo && !planUnlocksSeoSettings(plan)) {
    return { status: 'error', message: `${UPGRADE_GROWTH_TOOLS_COPY}.` };
  }

  try {
    const updated = await saveTheme(slug, theme as ThemeOverrides);
    if (!updated) return { status: 'error', message: 'Save failed' };
    revalidatePath(`/brief/${slug}`);
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);
    return { status: 'success', theme: updated.themeOverrides };
  } catch (err) {
    console.error('[saveThemeOverrides] failed', err);
    return { status: 'error', message: 'Save failed' };
  }
}

/**
 * Switch the storefront to a different template *and* re-seed the
 * draft from that template's `bootBlocksFromStorefront` recipe. This is
 * surfaced from the builder's Site inspector and is destructive: any
 * hand-edited block tree is discarded and replaced with the new
 * template's seed (the caller is expected to have already confirmed
 * with the founder). The template's preset theme — palette, heading
 * weight, section rhythm — is also written so picking "Bazaar" vs
 * "Gazette" looks immediately different, not just structurally.
 *
 * Publishes immediately so the live site matches the dashboard preview.
 */
export async function switchBuilderTemplate(
  input: z.input<typeof SwitchTemplateSchema>,
): Promise<BuilderActionState> {
  const parsed = SwitchTemplateSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug, templateId, pageId } = parsed.data;
  if (!(await rateGate('builder-template-switch', 20))) {
    return { status: 'error', message: 'Too many switches — try again in a moment.' };
  }
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  // Re-check the template tier server-side. The picker UI gates the
  // click, but a compromised client could call the action directly with
  // any templateId — re-running the gate here is the actual defence.
  const callerPlan = await getPlan(owner.userId);
  if (!isTemplateUnlocked(templateId, callerPlan)) {
    const min = minPlanForTemplate(templateId);
    return {
      status: 'error',
      message: `${templatePresets[templateId]?.label ?? 'This template'} is available on ${PLAN_LIMITS[min].label} and above. Upgrade from /account/settings/plan to switch.`,
    };
  }

  try {
    // Template switch is storefront-wide (it changes `briefs.template_id`
    // and the storefront-level theme preset). The block tree it seeds,
    // however, is per-page — only the resolved page (defaults to home)
    // gets reset to the new template's composition. Other pages keep
    // whatever the founder built on them.
    const updated = await setStorefrontTemplate(slug, templateId);
    if (!updated) return { status: 'error', message: 'Template switch failed' };

    const blocks = bootBlocksFromStorefront(updated);
    const seedTheme = templatePresets[templateId].theme;
    const saved = await saveDraft(slug, blocks, seedTheme);
    if (!saved) return { status: 'error', message: 'Template switch failed' };

    const resolved = await resolvePageForSlug(slug, pageId);
    if (!resolved.ok) return { status: 'error', message: resolved.message };
    await savePageDraftBlocks(resolved.page.id, blocks);
    await publishPageRow(resolved.page.id);

    // Seed themed demo products so the template-themed product blocks
    // render with content out of the box. No-ops when the founder has
    // already added their own products — `seedTemplateDemoProducts`
    // bails out on a non-empty `products` table for this slug.
    try {
      await seedTemplateDemoProducts(slug, templateId, updated.businessType, updated.locale);
    } catch (err) {
      console.warn('[switchBuilderTemplate] demo product seed failed', err);
    }

    revalidatePath(`/brief/${slug}`, 'layout');
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);
    revalidatePath('/account/builder');

    await logEvent({
      kind: 'storefront.template_switched',
      funnel: 'storefront',
      userId: owner.userId,
      storefront: slug,
      props: { templateId, fromPlan: callerPlan },
    });

    return {
      status: 'success',
      blocks: saved.draftBlocks,
      theme: saved.themeOverrides,
    };
  } catch (err) {
    console.error('[switchBuilderTemplate] failed', err);
    return { status: 'error', message: 'Template switch failed' };
  }
}

/**
 * Force-reset the storefront's draft to its template defaults — i.e.
 * what `bootBlocksFromStorefront` would produce for a brand-new row.
 * Wipes any custom block edits and re-applies the template's theme
 * preset (palette + heading weight + section rhythm). Surfaced in the
 * builder's overflow menu so a founder who picked a template after
 * already touching the canvas can snap back to it.
 *
 * Always destructive; the caller is expected to confirm.
 */
export async function resetBuilderToTemplate(
  input: z.input<typeof SeedSchema>,
): Promise<BuilderActionState> {
  const parsed = SeedSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug } = parsed.data;
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const sf = await getStorefront(slug);
    if (!sf) return { status: 'error', message: 'Storefront not found' };

    const blocks = bootBlocksFromStorefront(sf);
    const seedTheme = templatePresets[sf.templateId]?.theme ?? null;
    const saved = await saveDraft(slug, blocks, seedTheme);
    if (!saved) return { status: 'error', message: 'Reset failed' };
    await publishDraft(slug);

    // Mirror onto the home page row so the new page-aware loaders see
    // the freshly-seeded composition. Reset is home-only for now.
    try {
      const home = await ensureHomePage(slug, blocks);
      await savePageDraftBlocks(home.id, blocks);
      await publishPageRow(home.id);
    } catch (mirrorErr) {
      console.warn('[resetBuilderToTemplate] home-page mirror failed', mirrorErr);
    }

    revalidatePath(`/brief/${slug}`, 'layout');
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);
    return { status: 'success', blocks: saved.draftBlocks, theme: saved.themeOverrides };
  } catch (err) {
    console.error('[resetBuilderToTemplate] failed', err);
    return { status: 'error', message: 'Reset failed' };
  }
}

/**
 * First-time-open helper. If the storefront has empty `draft_blocks`,
 * generate the template-flavoured seed and write it as a private draft.
 * Publishing remains an explicit founder action.
 *
 * Also performs a one-time auto-migration: if the draft is still on a
 * known previous-version auto-seed *and* the hero title hasn't been
 * edited, re-seed with the current template composition. Founders who
 * already customized their blocks are never touched.
 */
export async function seedBuilderIfEmpty(
  input: z.input<typeof SeedSchema>,
): Promise<BuilderActionState> {
  const parsed = SeedSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };
  const { slug, pageId } = parsed.data;
  const owner = await gate(slug);
  if (!owner.ok) return { status: 'error', message: owner.message };

  try {
    const sf = await getStorefront(slug);
    if (!sf) return { status: 'error', message: 'Storefront not found' };

    // Resolve the page first. With no pageId we land on (and create if
    // missing) the home page — the only page guaranteed to exist for
    // every storefront.
    const resolved = await resolvePageForSlug(slug, pageId);
    if (!resolved.ok) return { status: 'error', message: resolved.message };
    const page = resolved.page;

    const seedTheme = templatePresets[sf.templateId]?.theme ?? null;
    const themeIsEmpty = Object.keys(sf.themeOverrides ?? {}).length === 0;
    const draftIsEmpty = page.draftBlocks.length === 0;
    // Stale-seed detection only applies to the home page — secondary
    // pages start blank and aren't migrated from a legacy auto-seed.
    // Existing stores must not be silently converted into the refreshed
    // futuristic template system. Only empty canvases and explicit
    // switch/reset actions receive the new seed recipes.
    const draftIsStale = false;

    // Existing, customized draft → leave the block tree alone, but
    // back-fill the template's theme preset (storefront-level) when
    // it's never been written.
    if (!draftIsEmpty && !draftIsStale) {
      if (themeIsEmpty && seedTheme) {
        const patched = await saveTheme(slug, seedTheme);
        if (patched) {
          revalidatePath(`/brief/${slug}`, 'layout');
          revalidatePath('/account');
          return {
            status: 'success',
            blocks: page.draftBlocks,
            theme: patched.themeOverrides,
          };
        }
      }
      return { status: 'success', blocks: page.draftBlocks, theme: sf.themeOverrides };
    }

    // First-open seed (or stale-default migration) installs the
    // template's theme preset (storefront-level) and the template's
    // composition (per-page) so the canvas isn't empty on first open.
    const blocks = bootBlocksFromStorefront(sf);
    if (page.isHome) {
      const themeForWrite = seedTheme ?? (themeIsEmpty ? null : sf.themeOverrides);
      const saved = await saveDraft(slug, blocks, themeForWrite);
      if (!saved) return { status: 'error', message: 'Seed failed' };
    } else if (themeIsEmpty && seedTheme) {
      await saveTheme(slug, seedTheme);
    }
    const seededPage = await savePageDraftBlocks(page.id, blocks);
    revalidatePath('/account');
    revalidatePath(`/account/${slug}/preview`);
    return {
      status: 'success',
      blocks: seededPage.draftBlocks,
      theme: seedTheme ?? sf.themeOverrides,
    };
  } catch (err) {
    console.error('[seedBuilderIfEmpty] failed', err);
    return { status: 'error', message: 'Seed failed' };
  }
}
