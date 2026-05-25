import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import {
  saveDraft,
  setStorefrontTemplate,
  TEMPLATE_IDS,
  type TemplateId,
} from '@/lib/brief';
import { getPlan } from '@/lib/billing';
import { PLAN_LIMITS } from '@/lib/plans';
import {
  isTemplateUnlocked,
  minPlanForTemplate,
  sortedTemplateIdsForPicker,
  templatePresets,
} from '@/lib/templates';
import { bootBlocksFromStorefront } from '@/lib/blocks/boot';
import { seedTemplateDemoProducts } from '@/lib/blocks/demoProducts';
import {
  ensureHomePage,
  getPageById,
  publishPage,
  saveDraftBlocks,
} from '@/lib/storefrontPages';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const SwitchSchema = z.object({
  store: z.string().trim().min(1).max(64).optional(),
  templateId: z.enum(TEMPLATE_IDS),
  pageId: z.string().uuid().nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  const plan = await getPlan(gate.access.storefront.clerkUserId);
  const activeTemplateId = gate.access.storefront.templateId;
  return mobileJson({
    activeTemplateId,
    plan,
    planLabel: PLAN_LIMITS[plan].label,
    planLabelAr: PLAN_LIMITS[plan].labelAr,
    templates: sortedTemplateIdsForPicker(TEMPLATE_IDS).map((id) => {
      const preset = templatePresets[id];
      const minPlan = minPlanForTemplate(id);
      return {
        id,
        label: preset.label,
        description: preset.description,
        tier: preset.tier,
        tierLabel: PLAN_LIMITS[minPlan].label,
        tierLabelAr: PLAN_LIMITS[minPlan].labelAr,
        previewImage: preset.previewImage ?? null,
        unlocked: isTemplateUnlocked(id, plan),
        active: id === activeTemplateId,
      };
    }),
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = SwitchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_template', 'Choose a valid template.');
  }

  const slug = parsed.data.store ?? searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;

  const templateId = parsed.data.templateId as TemplateId;
  const plan = await getPlan(gate.access.storefront.clerkUserId);
  if (!isTemplateUnlocked(templateId, plan)) {
    const minPlan = minPlanForTemplate(templateId);
    return mobileError(
      403,
      'template_locked',
      `${templatePresets[templateId]?.label ?? 'This template'} is available on ${PLAN_LIMITS[minPlan].label} and above.`,
    );
  }

  try {
    const updated = await setStorefrontTemplate(gate.access.storefront.slug, templateId);
    if (!updated) {
      return mobileError(500, 'template_failed', 'Could not switch template.');
    }

    const blocks = bootBlocksFromStorefront(updated);
    const theme = templatePresets[templateId].theme;
    await saveDraft(gate.access.storefront.slug, blocks, theme);

    const page = parsed.data.pageId
      ? await getPageById(parsed.data.pageId)
      : await ensureHomePage(gate.access.storefront.slug);
    if (!page || page.storefrontSlug !== gate.access.storefront.slug) {
      return mobileError(404, 'not_found', 'Page not found.');
    }

    await saveDraftBlocks(page.id, blocks);
    const publishedPage = await publishPage(page.id);

    try {
      await seedTemplateDemoProducts(
        gate.access.storefront.slug,
        templateId,
        updated.businessType,
        updated.locale,
      );
    } catch (err) {
      console.warn('[mobile/builder/template] demo product seed failed', err);
    }

    await recordAudit({
      storefrontSlug: gate.access.storefront.slug,
      clerkUserId: gate.user.userId,
      action: 'storefront.template_switched',
      targetId: gate.access.storefront.slug,
      summary: 'Template switched from mobile',
      meta: {
        templateId,
        pageId: page.id,
        source: 'mobile',
      },
    });

    revalidatePath('/account/builder');
    revalidatePath('/account', 'layout');
    revalidatePath(`/account/${gate.access.storefront.slug}/preview`);
    revalidatePath(`/brief/${gate.access.storefront.slug}`, 'layout');

    return mobileJson({ page: publishedPage, templateId });
  } catch (err) {
    console.error('[mobile/builder/template POST] failed', err);
    return mobileError(500, 'template_failed', 'Could not switch template.');
  }
}
