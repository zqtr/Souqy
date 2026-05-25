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
  updateStorefront,
  type Storefront,
  type UpdateStorefrontInput,
} from '@/lib/brief';
import { storefrontBaseUrl } from '@/lib/storefrontUrl';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const nullableUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

const PatchSchema = z.object({
  store: z.string().trim().min(1).max(64).optional(),
  patch: z
    .object({
      businessName: z.string().trim().min(1).max(120).optional(),
      tagline: z.string().trim().max(280).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      area: z.string().trim().max(120).nullable().optional(),
      hours: z.string().trim().max(280).nullable().optional(),
      instagram: z.string().trim().max(120).nullable().optional(),
      logoUrl: nullableUrl,
    })
    .strict(),
});

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'builder.edit');
  if (!gate.ok) return gate.response;
  return mobileJson(toSettings(gate.access.storefront));
}

export async function PATCH(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_settings', 'Invalid site settings.');
  }

  const slug = parsed.data.store ?? searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'settings.manage');
  if (!gate.ok) return gate.response;

  const current = gate.access.storefront;
  const patch = parsed.data.patch;
  const next: UpdateStorefrontInput = {
    founderName: current.founderName,
    businessName: patch.businessName ?? current.businessName,
    ownership: current.ownership,
    experience: current.experience,
    businessType: current.businessType,
    marketVolume: current.marketVolume,
    payments: current.payments,
    tagline: 'tagline' in patch ? patch.tagline ?? null : current.tagline,
    phone: 'phone' in patch ? patch.phone ?? null : current.phone,
    area: 'area' in patch ? patch.area ?? null : current.area,
    hours: 'hours' in patch ? patch.hours ?? null : current.hours,
    instagram: 'instagram' in patch ? patch.instagram ?? null : current.instagram,
    logoUrl: 'logoUrl' in patch ? patch.logoUrl ?? null : current.logoUrl,
    faviconUrl: current.faviconUrl,
    design: current.design,
    palette: current.palette,
    templateId: current.templateId,
    crNumber: current.crNumber,
  };

  try {
    const updated = await updateStorefront(current.slug, next);
    if (!updated) {
      return mobileError(500, 'settings_failed', 'Could not save site settings.');
    }
    await recordAudit({
      storefrontSlug: current.slug,
      clerkUserId: gate.user.userId,
      action: 'settings.mobile.site',
      targetId: current.slug,
      summary: 'Site settings saved from mobile',
      meta: {
        fields: Object.keys(patch),
        source: 'mobile',
      },
    });
    revalidatePath('/account', 'layout');
    revalidatePath('/account/builder');
    revalidatePath(`/account/${current.slug}/preview`);
    revalidatePath(`/brief/${current.slug}`, 'layout');
    return mobileJson({ settings: toSettings(updated) });
  } catch (err) {
    console.error('[mobile/storefront/settings PATCH] failed', err);
    return mobileError(500, 'settings_failed', 'Could not save site settings.');
  }
}

function toSettings(storefront: Storefront) {
  return {
    slug: storefront.slug,
    businessName: storefront.businessName,
    contactEmail: storefront.contactEmail,
    tagline: storefront.tagline,
    phone: storefront.phone,
    area: storefront.area,
    hours: storefront.hours,
    instagram: storefront.instagram,
    logoUrl: storefront.logoUrl,
    customDomain: storefront.customDomain,
    subdomainStatus: storefront.subdomainStatus,
    publicUrl: storefront.customDomain ? `https://${storefront.customDomain}` : storefrontBaseUrl(storefront.slug),
    templateId: storefront.templateId,
    isPublished: storefront.isPublished,
  };
}
