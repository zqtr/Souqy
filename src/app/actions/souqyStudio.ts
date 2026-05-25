'use server';

import { put } from '@vercel/blob';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createBrief } from '@/app/actions/createBrief';
import { blocksSchema } from '@/lib/blocks/schemas';
import type { Block, ThemeOverrides } from '@/lib/blocks/types';
import { gateAtelierPro } from '@/lib/billing';
import { db, hasDb } from '@/lib/db';
import { env } from '@/lib/env';
import { getStorefront, getStorefrontsForUser, saveDraft } from '@/lib/brief';
import type { BusinessType } from '@/lib/brief';
import { getProductsForUser } from '@/lib/products';
import {
  ensureHomePage,
  saveDraftBlocks as savePageDraftBlocks,
  setPageSeo,
} from '@/lib/storefrontPages';

const StudioTemplateSchema = z.enum([
  'ad-creative',
  'brand-identity',
  'launch-poster',
  'logo',
  'packaging-mockup',
  'product-card',
  'restaurant-menu',
  'short-video',
  'story-promo',
  'wide-banner',
  'brand-kit',
]);

const StudioFormatSchema = z.enum([
  'instagram-post',
  'instagram-story',
  'tiktok',
  'whatsapp-status',
  'snapchat',
  'x-banner',
  'a3-print',
  'menu-print',
  'product-card',
  'logo-square',
  'wide-banner',
]);

const BusinessTypeSchema = z.enum([
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
]);

const ReferenceSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']),
  dataUrl: z.string().startsWith('data:image/').max(7_000_000),
});

const GenerateSchema = z.object({
  prompt: z.string().trim().min(8).max(1600),
  template: StudioTemplateSchema,
  formatKey: StudioFormatSchema.optional(),
  locale: z.enum(['en', 'ar']),
  projectId: z.string().uuid().optional(),
  sourceStorefrontSlug: z.string().trim().min(1).max(80).optional(),
  selectedProductIds: z.array(z.string().uuid()).max(12).default([]),
  printBleed: z.boolean().optional(),
  quality: z.enum(['standard', 'high', 'print']).optional(),
  brandInstructions: z.string().trim().max(500).optional(),
  creativity: z.number().min(0).max(10).optional(),
  references: z.array(ReferenceSchema).max(5).default([]),
});

const AssetSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum([
    'logo',
    'wideLogo',
    'banner',
    'poster',
    'story',
    'og',
    'brand',
    'ad',
    'menu',
    'productCard',
    'packaging',
    'video',
  ]),
  title: z.string().trim().min(1).max(120),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.string().trim().min(1).max(80),
  formatKey: StudioFormatSchema.optional(),
  assetType: StudioTemplateSchema.optional(),
  downloadFilename: z.string().trim().max(180).optional(),
});

const StartProjectSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  locale: z.enum(['en', 'ar']),
});

const ConfirmAssetSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  role: z.enum(['logo', 'banner', 'brand-kit']),
});

const LoadProjectSchema = z.object({
  projectId: z.string().uuid().optional(),
});

const CreateSchema = z.object({
  projectId: z.string().uuid().optional(),
  businessName: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(3).max(40),
  businessType: BusinessTypeSchema,
  prompt: z.string().trim().min(8).max(1600),
  template: StudioTemplateSchema,
  locale: z.enum(['en', 'ar']),
  assets: z.array(AssetSchema).max(12).default([]),
});

export type SouqyStudioTemplate = z.infer<typeof StudioTemplateSchema>;
export type SouqyStudioFormat = z.infer<typeof StudioFormatSchema>;
export type SouqyStudioAsset = z.infer<typeof AssetSchema>;
export type SouqyStudioGenerateInput = z.input<typeof GenerateSchema>;
export type SouqyStudioCreateInput = z.input<typeof CreateSchema>;
export type SouqyStudioStep = 'logo' | 'banner' | 'brand-kit' | 'promos' | 'builder';

export type SouqyStudioGenerateState =
  | { status: 'success'; assets: SouqyStudioAsset[]; brand: StudioBrandKit }
  | { status: 'error'; message: string };

export type SouqyStudioCreateState =
  | { status: 'success'; slug: string; dashboardUrl: string }
  | { status: 'error'; message: string; field?: keyof SouqyStudioCreateInput };

export type SouqyStudioProject = {
  id: string;
  businessName: string;
  locale: 'en' | 'ar';
  currentStep: SouqyStudioStep;
  storefrontSlug: string | null;
  confirmedLogoAssetId: string | null;
  confirmedBannerAssetId: string | null;
  confirmedBrandAssetId: string | null;
  brandKit: StudioBrandKit | null;
  assets: SouqyStudioAsset[];
};

export type SouqyStudioProjectState =
  | { status: 'success'; project: SouqyStudioProject }
  | { status: 'error'; message: string };

export type SouqyStudioConfirmState =
  | { status: 'success'; project: SouqyStudioProject }
  | { status: 'error'; message: string };

export type SouqyStudioCatalogProduct = {
  id: string;
  storefrontSlug: string;
  storefrontName: string;
  title: string;
  description: string | null;
  priceQar: number | null;
  imageUrl: string | null;
  category: string | null;
};

export type SouqyStudioCatalogStorefront = {
  slug: string;
  businessName: string;
  locale: 'en' | 'ar';
};

export type SouqyStudioLibraryState =
  | {
      status: 'success';
      project: SouqyStudioProject | null;
      assets: SouqyStudioAsset[];
      counts: Record<string, number>;
      brand: StudioBrandKit | null;
      storefronts: SouqyStudioCatalogStorefront[];
      products: SouqyStudioCatalogProduct[];
    }
  | { status: 'error'; message: string };

type StudioBrandKit = {
  palette: ThemeOverrides['palette'];
  heading: string;
  story: string;
  tone: string[];
  fonts: {
    heading: string;
    body: string;
  };
};

type AssetContract = {
  kind: SouqyStudioAsset['kind'];
  title: string;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/webp' | 'image/svg+xml';
  blobPrefix: string;
  promptHint: string;
  formatKey?: SouqyStudioFormat;
  assetType?: SouqyStudioTemplate;
};

type SouqyTaskIntent =
  | 'generate-banner'
  | 'create-product-ad'
  | 'create-ramadan-campaign'
  | 'make-luxury-packaging'
  | 'resize-for-short-video'
  | 'generate-store-logo'
  | 'edit-reference-creative'
  | 'create-campaign-poster';

type SouqyModelRole =
  | 'flux-dev'
  | 'qwen-image'
  | 'qwen-image-edit'
  | 'juggernaut-xl'
  | 'sdxl-turbo'
  | 'wan-2.2'
  | 'cogvideox'
  | 'animatediff'
  | 'real-esrgan'
  | 'supir'
  | 'controlnet'
  | 'ip-adapter'
  | 'instantid'
  | 'photomaker';

type SouqyCreativeRoute = {
  intent: SouqyTaskIntent;
  primary: SouqyModelRole;
  consistency: SouqyModelRole[];
  post: SouqyModelRole[];
  video: SouqyModelRole[];
  mode: 'generate' | 'edit' | 'video' | 'preview' | 'compose';
  promptDirective: string;
};

const CONTRACTS: Record<string, AssetContract> = {
  logo: {
    kind: 'logo',
    title: 'Primary logo',
    width: 1024,
    height: 1024,
    mimeType: 'image/png',
    blobPrefix: 'logos',
    promptHint: 'primary logo mark, comfortable outer margin, transparent background, raster icon',
  },
  wideLogo: {
    kind: 'wideLogo',
    title: 'Wide wordmark',
    width: 1600,
    height: 600,
    mimeType: 'image/png',
    blobPrefix: 'logos',
    promptHint: 'wide wordmark lockup, readable bilingual typography, transparent raster image',
  },
  banner: {
    kind: 'banner',
    title: 'Storefront banner',
    width: 2400,
    height: 1200,
    mimeType: 'image/webp',
    blobPrefix: 'banners',
    promptHint: 'wide storefront hero banner, strong product scene, no clipped text, no invented brand logo',
  },
  poster: {
    kind: 'poster',
    title: 'Launch poster',
    width: 1080,
    height: 1080,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'square launch key visual, clear focal composition, no readable text unless exact text is provided',
  },
  story: {
    kind: 'story',
    title: 'Story promo',
    width: 1080,
    height: 1920,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'vertical story promo, centered source subject, calm top and bottom breathing room, no readable text unless exact text is provided',
  },
  og: {
    kind: 'og',
    title: 'Wide promo',
    width: 1200,
    height: 630,
    mimeType: 'image/webp',
    blobPrefix: 'og-images',
    promptHint: 'landscape banner graphic, uncluttered composition, no invented brand name',
  },
  ad: {
    kind: 'ad',
    title: 'Ad creative',
    width: 1080,
    height: 1350,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'performance ad visual, clear source subject hierarchy, clean empty action space, no invented text, no invented brand logo',
  },
  menu: {
    kind: 'menu',
    title: 'Restaurant menu',
    width: 1240,
    height: 1754,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'restaurant menu layout, grouped sections, elegant print spacing, use only provided menu text',
  },
  productCard: {
    kind: 'productCard',
    title: 'Product card',
    width: 1080,
    height: 1080,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'commerce product visual, strong product image area, ad-ready layout, no invented title or price',
  },
  packaging: {
    kind: 'packaging',
    title: 'Packaging mockup',
    width: 1080,
    height: 1080,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'premium packaging mockup, box or bag presentation, realistic retail lighting, no invented brand mark',
  },
  brandIdentity: {
    kind: 'brand',
    title: 'Brand identity board',
    width: 1600,
    height: 1200,
    mimeType: 'image/webp',
    blobPrefix: 'brand',
    promptHint: 'brand identity board with placement zones, palette, materials, patterns, and applied mockup examples, no invented brand text',
  },
};

export async function generateSouqyStudioAssets(
  input: SouqyStudioGenerateInput,
): Promise<SouqyStudioGenerateState> {
  const parsed = GenerateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid Souqy Studio request.',
    };
  }
  const data = parsed.data;
  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return {
      status: 'error',
      message: 'Souqy Studio storage is not configured. Add BLOB_READ_WRITE_TOKEN.',
    };
  }

  let project: SouqyStudioProject | null = null;
  if (data.projectId) {
    if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };
    project = await getOwnedStudioProject(data.projectId, userId);
    if (!project) return { status: 'error', message: 'Souqy Studio project not found.' };
  }

  const catalogContext = await catalogContextForGeneration({
    userId,
    sourceStorefrontSlug: data.sourceStorefrontSlug,
    selectedProductIds: data.selectedProductIds,
  });
  const creativeRoute = routeSouqyCreativeTask({
    prompt: data.prompt,
    template: data.template,
    formatKey: data.formatKey,
    locale: data.locale,
    quality: data.quality,
    hasReferences: data.references.length > 0,
    selectedProductIds: data.selectedProductIds,
  });
  const generationPrompt = buildWorkplacePrompt({
    prompt: data.prompt,
    template: data.template,
    formatKey: data.formatKey,
    locale: data.locale,
    brandInstructions: data.brandInstructions,
    quality: data.quality,
    printBleed: data.printBleed,
    creativity: data.creativity,
    catalogContext,
    hasReferences: data.references.length > 0,
    creativeRoute,
  });
  const brand = inferBrandKit(generationPrompt);

  if (project && data.template === 'brand-kit') {
    const logo = project.assets.find((asset) => asset.id === project.confirmedLogoAssetId);
    const banner = project.assets.find((asset) => asset.id === project.confirmedBannerAssetId);
    if (!logo || !banner) {
      return {
        status: 'error',
        message: 'Confirm the logo and banner before generating the brand kit.',
      };
    }
    const [saved] = await insertStudioAssets({
      project,
      userId,
      prompt: data.prompt,
      references: [
        { id: logo.id, kind: logo.kind, title: logo.title, url: logo.url },
        { id: banner.id, kind: banner.kind, title: banner.title, url: banner.url },
      ],
      assets: [
        {
          kind: 'brand',
          title: 'Brand kit',
          url: banner.url,
          width: 1200,
          height: 630,
          mimeType: banner.mimeType,
          metadata: { brand, basedOn: { logo: logo.id, banner: banner.id } },
          provider: 'souqy',
          model: 'brand-kit',
        },
      ],
    });
    return { status: 'success', assets: saved ? [saved] : [], brand };
  }

  const contracts = contractsForTemplate(data.template, data.formatKey);

  try {
    const references = data.references;
    const assets = await Promise.all(
      contracts.map(async (contract) => {
        const provider = pickProvider(contract, references.length > 0, creativeRoute);
        const mimeType = outputMimeTypeForGeneration(
          provider.provider,
          contract,
          references.length > 0,
          creativeRoute,
        );
        const sourceUrl = await maybeUpscaleWithFal(
          await generateContractImage({
            contract,
            prompt: generationPrompt,
            locale: data.locale,
            references,
            provider: provider.provider,
            route: creativeRoute,
          }),
          creativeRoute,
        );
        const stored = await persistRemoteAsset({
          sourceUrl,
          pathname: `souqy-studio/${userId}/${crypto.randomUUID()}-${contract.kind}.${extensionFor(mimeType)}`,
          contentType: mimeType,
        });
        return {
          kind: contract.kind,
          title: contract.title,
          url: stored,
          width: contract.width,
          height: contract.height,
          mimeType,
          metadata: { contract: contract.kind, route: creativeRoute },
          formatKey: contract.formatKey ?? data.formatKey,
          assetType: contract.assetType ?? data.template,
          downloadFilename: downloadFilenameFor(
            project?.businessName ?? 'souqy',
            data.template,
            contract,
            mimeType,
          ),
          provider: provider.provider,
          model: modelNameForRoute(provider.provider, creativeRoute),
        };
      }),
    );
    const savedAssets = project
      ? await insertStudioAssets({
          project,
          userId,
          prompt: data.prompt,
          references: references.map((reference) => ({
            name: reference.name,
            mimeType: reference.mimeType,
          })),
          sourceStorefrontSlug: data.sourceStorefrontSlug,
          sourceProductIds: data.selectedProductIds,
          assets,
        })
      : assets.map((asset) => ({
          kind: asset.kind,
          title: asset.title,
          url: asset.url,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
        }));
    return { status: 'success', assets: savedAssets, brand };
  } catch (err) {
    console.error('[souqyStudio.generate] failed', err);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Souqy Studio generation failed.',
    };
  }
}

async function getSouqyStudioUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch (err) {
    let host = '';
    try {
      host = headers().get('host') ?? '';
    } catch {
      host = '';
    }
    const isLocalHost =
      host.startsWith('127.0.0.1:') || host.startsWith('localhost:') || host.startsWith('[::1]:');
    if (isLocalHost) return 'local-souqy-studio';
    throw err;
  }
}

async function requireSouqyStudioAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const userId = await getSouqyStudioUserId();
  if (!userId) return { ok: false, message: 'Sign in to continue.' };
  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    return {
      ok: false,
      message:
        gate.reason === 'paywall'
          ? 'Souqy is available on Pro + and above.'
          : 'Sign in to continue.',
    };
  }
  return { ok: true, userId };
}

type StudioProjectRow = {
  id: string;
  locale: 'en' | 'ar';
  business_name: string;
  current_step: SouqyStudioStep;
  storefront_slug: string | null;
  confirmed_logo_asset_id: string | null;
  confirmed_banner_asset_id: string | null;
  confirmed_brand_asset_id: string | null;
  brand_kit: unknown;
};

type StudioAssetRow = {
  id: string;
  kind: SouqyStudioAsset['kind'];
  title: string;
  url: string;
  width: number;
  height: number;
  mime_type: string;
  asset_type?: SouqyStudioTemplate | null;
  format_key?: SouqyStudioFormat | null;
  download_filename?: string | null;
};

function parseBrandKit(value: unknown): StudioBrandKit | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Partial<StudioBrandKit>;
  if (!parsed.heading || !parsed.story || !parsed.palette) return null;
  return {
    palette: parsed.palette,
    heading: String(parsed.heading),
    story: String(parsed.story),
    tone: Array.isArray(parsed.tone) ? parsed.tone.map(String) : [],
    fonts: {
      heading: parsed.fonts?.heading ? String(parsed.fonts.heading) : 'Editorial display',
      body: parsed.fonts?.body ? String(parsed.fonts.body) : 'Clean sans',
    },
  };
}

function fromProjectRow(row: StudioProjectRow, assets: SouqyStudioAsset[]): SouqyStudioProject {
  return {
    id: row.id,
    businessName: row.business_name,
    locale: row.locale,
    currentStep: row.current_step,
    storefrontSlug: row.storefront_slug,
    confirmedLogoAssetId: row.confirmed_logo_asset_id,
    confirmedBannerAssetId: row.confirmed_banner_asset_id,
    confirmedBrandAssetId: row.confirmed_brand_asset_id,
    brandKit: parseBrandKit(row.brand_kit),
    assets,
  };
}

function fromStudioAssetRow(row: StudioAssetRow): SouqyStudioAsset {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    url: row.url,
    width: Number(row.width),
    height: Number(row.height),
    mimeType: row.mime_type,
    assetType: row.asset_type ?? undefined,
    formatKey: row.format_key ?? undefined,
    downloadFilename: row.download_filename ?? undefined,
  };
}

async function getOwnedStudioProject(
  projectId: string,
  userId: string,
): Promise<SouqyStudioProject | null> {
  if (!hasDb()) return null;
  const projectRows = (await db()`
    select id, locale, business_name, current_step, storefront_slug,
      confirmed_logo_asset_id, confirmed_banner_asset_id, confirmed_brand_asset_id, brand_kit
    from souqy_studio_projects
    where id = ${projectId} and clerk_user_id = ${userId}
    limit 1
  `) as unknown as StudioProjectRow[];
  const row = projectRows[0];
  if (!row) return null;
  const assetRows = (await db()`
    select id, kind, title, url, width, height, mime_type, asset_type, format_key, download_filename
    from souqy_studio_assets
    where project_id = ${projectId} and clerk_user_id = ${userId}
    order by created_at asc
  `) as unknown as StudioAssetRow[];
  return fromProjectRow(row, assetRows.map(fromStudioAssetRow));
}

export async function loadSouqyStudioProject(
  input: unknown = {},
): Promise<SouqyStudioProjectState> {
  const parsed = LoadProjectSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid Souqy Studio project request.' };
  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };

  let projectId = parsed.data.projectId;
  if (!projectId) {
    const rows = (await db()`
      select id
      from souqy_studio_projects
      where clerk_user_id = ${userId} and storefront_slug is null
      order by updated_at desc
      limit 1
    `) as unknown as { id: string }[];
    projectId = rows[0]?.id;
  }
  if (!projectId) return { status: 'error', message: 'No Souqy Studio project yet.' };
  const project = await getOwnedStudioProject(projectId, userId);
  if (!project) return { status: 'error', message: 'Souqy Studio project not found.' };
  return { status: 'success', project };
}

export async function loadSouqyStudioLibrary(
  input: unknown = {},
): Promise<SouqyStudioLibraryState> {
  const parsed = LoadProjectSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid Souqy Studio library request.' };
  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };

  let project: SouqyStudioProject | null = null;
  const projectResult = await loadSouqyStudioProject(parsed.data);
  if (projectResult.status === 'success') project = projectResult.project;

  const rows = (await db()`
    select id, kind, title, url, width, height, mime_type, asset_type, format_key, download_filename
    from souqy_studio_assets
    where clerk_user_id = ${userId}
    order by created_at desc
    limit 60
  `) as unknown as StudioAssetRow[];
  const assets = rows.map(fromStudioAssetRow);
  const counts = assets.reduce<Record<string, number>>((acc, asset) => {
    const key = asset.assetType ?? asset.kind;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const storefronts = (await getStorefrontsForUser(userId)).map((storefront) => ({
    slug: storefront.slug,
    businessName: storefront.businessName,
    locale: storefront.locale,
  }));
  const products = (await getProductsForUser(userId)).slice(0, 36).map((product) => ({
    id: product.id,
    storefrontSlug: product.storefrontSlug,
    storefrontName: product.storefrontName,
    title: product.title,
    description: product.description,
    priceQar: product.priceQar,
    imageUrl: product.imageUrl,
    category: product.category,
  }));

  return {
    status: 'success',
    project,
    assets,
    counts,
    brand: project?.brandKit ?? null,
    storefronts,
    products,
  };
}

export async function startSouqyStudioProject(input: unknown): Promise<SouqyStudioProjectState> {
  const parsed = StartProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid Souqy Studio project.',
    };
  }
  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };

  const existing = (await db()`
    select id
    from souqy_studio_projects
    where clerk_user_id = ${userId}
      and storefront_slug is null
      and lower(business_name) = lower(${parsed.data.businessName})
    order by updated_at desc
    limit 1
  `) as unknown as { id: string }[];
  const existingId = existing[0]?.id;
  if (existingId) {
    await db()`
      update souqy_studio_projects
      set locale = ${parsed.data.locale}, updated_at = now()
      where id = ${existingId} and clerk_user_id = ${userId}
    `;
    const project = await getOwnedStudioProject(existingId, userId);
    if (project) return { status: 'success', project };
  }

  const rows = (await db()`
    insert into souqy_studio_projects (clerk_user_id, locale, business_name, current_step)
    values (${userId}, ${parsed.data.locale}, ${parsed.data.businessName}, 'logo')
    returning id
  `) as unknown as { id: string }[];
  const project = await getOwnedStudioProject(rows[0]!.id, userId);
  if (!project) return { status: 'error', message: 'Could not start Souqy Studio project.' };
  return { status: 'success', project };
}

export async function confirmSouqyStudioAsset(input: unknown): Promise<SouqyStudioConfirmState> {
  const parsed = ConfirmAssetSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid confirmation request.' };
  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };

  const project = await getOwnedStudioProject(parsed.data.projectId, userId);
  if (!project) return { status: 'error', message: 'Souqy Studio project not found.' };
  const asset = project.assets.find((item) => item.id === parsed.data.assetId);
  if (!asset) return { status: 'error', message: 'Choose an asset from this project.' };

  if (parsed.data.role === 'logo' && project.currentStep !== 'logo') {
    return { status: 'error', message: 'Logo is already confirmed.' };
  }
  if (parsed.data.role === 'banner' && project.currentStep !== 'banner') {
    return { status: 'error', message: 'Confirm a logo before choosing the banner.' };
  }
  if (parsed.data.role === 'brand-kit' && project.currentStep !== 'brand-kit') {
    return { status: 'error', message: 'Confirm the banner before choosing the brand kit.' };
  }

  const nextStep: SouqyStudioStep =
    parsed.data.role === 'logo' ? 'banner' : parsed.data.role === 'banner' ? 'brand-kit' : 'promos';
  const brandKit =
    parsed.data.role === 'brand-kit'
      ? inferBrandKit(
          `${project.businessName} ${project.assets.map((item) => item.title).join(' ')}`,
        )
      : project.brandKit;

  await db()`
    update souqy_studio_assets
    set confirmation_role = null
    where project_id = ${project.id}
      and clerk_user_id = ${userId}
      and confirmation_role = ${parsed.data.role}
  `;
  await db()`
    update souqy_studio_assets
    set confirmation_role = ${parsed.data.role}
    where id = ${asset.id} and project_id = ${project.id} and clerk_user_id = ${userId}
  `;
  await db()`
    update souqy_studio_projects
    set current_step = ${nextStep},
        confirmed_logo_asset_id = case when ${parsed.data.role} = 'logo' then ${asset.id}::uuid else confirmed_logo_asset_id end,
        confirmed_banner_asset_id = case when ${parsed.data.role} = 'banner' then ${asset.id}::uuid else confirmed_banner_asset_id end,
        confirmed_brand_asset_id = case when ${parsed.data.role} = 'brand-kit' then ${asset.id}::uuid else confirmed_brand_asset_id end,
        brand_kit = case when ${parsed.data.role} = 'brand-kit' then ${JSON.stringify(brandKit)}::jsonb else brand_kit end,
        updated_at = now()
    where id = ${project.id} and clerk_user_id = ${userId}
  `;
  const updated = await getOwnedStudioProject(project.id, userId);
  if (!updated) return { status: 'error', message: 'Could not reload Souqy Studio project.' };
  return { status: 'success', project: updated };
}

export async function createSouqyStudioStore(
  input: SouqyStudioCreateInput,
): Promise<SouqyStudioCreateState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? 'Invalid store request.',
      field: issue?.path?.[0] as keyof SouqyStudioCreateInput | undefined,
    };
  }
  const data = parsed.data;
  if (!hasDb()) return { status: 'error', message: 'Database unavailable.' };
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return {
      status: 'error',
      message: 'Souqy Studio storage is not configured. Add BLOB_READ_WRITE_TOKEN.',
    };
  }

  const access = await requireSouqyStudioAccess();
  if (!access.ok) return { status: 'error', message: access.message };
  const userId = access.userId;
  let businessName = data.businessName;
  let businessType = data.businessType;
  let prompt = data.prompt;
  let locale = data.locale;
  let sourceAssets = data.assets;
  let persistedProject: SouqyStudioProject | null = null;

  if (data.projectId) {
    persistedProject = await getOwnedStudioProject(data.projectId, userId);
    if (!persistedProject) return { status: 'error', message: 'Souqy Studio project not found.' };
    if (persistedProject.currentStep !== 'promos' && persistedProject.currentStep !== 'builder') {
      return { status: 'error', message: 'Confirm the brand kit before opening the builder.' };
    }
    businessName = persistedProject.businessName;
    businessType = 'ecommerce';
    locale = persistedProject.locale;
    prompt = data.prompt || `${businessName} Souqy Studio brand system`;
    const confirmedIds = new Set(
      [
        persistedProject.confirmedLogoAssetId,
        persistedProject.confirmedBannerAssetId,
        persistedProject.confirmedBrandAssetId,
      ].filter(Boolean),
    );
    sourceAssets = persistedProject.assets.filter(
      (asset) =>
        confirmedIds.has(asset.id ?? '') ||
        asset.kind === 'poster' ||
        asset.kind === 'story' ||
        asset.kind === 'og',
    );
    if (
      !persistedProject.confirmedLogoAssetId ||
      !persistedProject.confirmedBannerAssetId ||
      !persistedProject.confirmedBrandAssetId
    ) {
      return {
        status: 'error',
        message: 'Confirm the logo, banner, and brand kit before opening the builder.',
      };
    }
  }

  if (sourceAssets.length === 0) {
    return {
      status: 'error',
      message: 'Generate and confirm Souqy assets before opening the builder.',
    };
  }

  const created = await createBrief({
    businessName,
    ownership: 'want_to_start',
    businessType,
    templateId: 'souqline',
    slug: data.slug,
    crNumber: '',
    locale,
    website: '',
  });
  if (created.status !== 'success') {
    return created.status === 'error'
      ? {
          status: 'error',
          message: created.message,
          field: created.field as keyof SouqyStudioCreateInput,
        }
      : { status: 'error', message: 'Could not create the storefront.' };
  }

  const storefront = await getStorefront(created.slug);
  if (!storefront) return { status: 'error', message: 'Could not load the new storefront.' };

  let sluggedAssets: SouqyStudioAsset[];
  try {
    sluggedAssets = await copyAssetsIntoStorefrontNamespace(created.slug, sourceAssets);
  } catch (err) {
    console.error('[souqyStudio.create] asset copy failed', err);
    return { status: 'error', message: 'Could not save Souqy assets into this storefront.' };
  }
  const brand = persistedProject?.brandKit ?? inferBrandKit(prompt);
  const theme: ThemeOverrides = {
    palette: brand.palette,
    headingWeight: 500,
    sectionSpacing: 'comfortable',
    themeBehaviour: 'auto',
    seo: {
      title: `${businessName} | Souqna`,
      description: brand.story,
      ogImage: pickAsset(sluggedAssets, 'og')?.url ?? pickAsset(sluggedAssets, 'poster')?.url,
    },
  };
  const blocks = buildSouqyStudioBlocks({
    businessName,
    businessType,
    locale,
    prompt,
    assets: sluggedAssets,
    brand,
  });
  const validated = blocksSchema.safeParse(blocks);
  if (!validated.success) {
    return { status: 'error', message: 'Generated blocks did not pass builder validation.' };
  }

  const logo = pickAsset(sluggedAssets, 'logo')?.url ?? null;
  await db()`
    update briefs
    set logo_url = ${logo},
        tagline = ${brand.heading}
    where slug = ${created.slug} and expires_at > now()
  `;

  const saved = await saveDraft(created.slug, validated.data as Block[], theme);
  if (!saved) return { status: 'error', message: 'Could not save the generated builder draft.' };
  const home = await ensureHomePage(created.slug, validated.data as Block[]);
  await savePageDraftBlocks(home.id, validated.data as Block[]);
  await setPageSeo(home.id, {
    title: `${businessName} | Souqna`,
    description: brand.story,
    image: theme.seo?.ogImage ?? null,
  });

  revalidatePath('/account');
  revalidatePath(`/account/builder`);
  revalidatePath(`/brief/${created.slug}`);

  if (persistedProject) {
    await db()`
      update souqy_studio_projects
      set storefront_slug = ${created.slug}, current_step = 'builder', updated_at = now()
      where id = ${persistedProject.id} and clerk_user_id = ${userId}
    `;
  }

  return {
    status: 'success',
    slug: created.slug,
    dashboardUrl: `/account/builder?store=${encodeURIComponent(created.slug)}`,
  };
}

// Used by the Studio flow in active branches; keep available while the
// launcher/builder handoff is being iterated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function templatesForStep(step: SouqyStudioStep): SouqyStudioTemplate[] {
  if (step === 'logo') return ['logo'];
  if (step === 'banner') return ['wide-banner'];
  if (step === 'brand-kit') return ['brand-kit'];
  if (step === 'promos') return ['story-promo', 'launch-poster'];
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function messageForStep(step: SouqyStudioStep): string {
  if (step === 'logo') return 'Generate and confirm a logo first.';
  if (step === 'banner') return 'Generate and confirm a wide banner next.';
  if (step === 'brand-kit') return 'Generate and confirm the brand kit next.';
  if (step === 'promos')
    return 'Generate story promos or launch posters from the confirmed brand kit.';
  return 'This Souqy Studio project is already in the builder.';
}

type StudioImageProvider = 'fal' | 'ideogram' | 'replicate';

const REPLICATE_PRIMARY_IMAGE_MODEL = 'black-forest-labs/flux-2-max';

function modelNameForProvider(provider: StudioImageProvider): string {
  if (provider === 'ideogram') return 'ideogram-v3';
  if (provider === 'replicate') return 'replicate';
  return 'fal-image';
}

function modelNameForRoute(provider: StudioImageProvider, route: SouqyCreativeRoute): string {
  if (provider === 'replicate') return replicateModelNameForRoute();
  if (provider !== 'fal') return modelNameForProvider(provider);
  if (
    route.primary === 'qwen-image' ||
    route.primary === 'qwen-image-edit' ||
    route.primary === 'flux-dev' ||
    route.primary === 'sdxl-turbo'
  ) {
    return route.primary;
  }
  return 'fal-recraft-v3';
}

async function insertStudioAssets(args: {
  project: SouqyStudioProject;
  userId: string;
  prompt: string;
  references: unknown[];
  sourceStorefrontSlug?: string;
  sourceProductIds?: string[];
  assets: Array<
    SouqyStudioAsset & {
      metadata?: Record<string, unknown>;
      provider?: string;
      model?: string;
    }
  >;
}): Promise<SouqyStudioAsset[]> {
  if (!hasDb()) return args.assets;
  const saved: SouqyStudioAsset[] = [];
  for (const asset of args.assets) {
    const rows = (await db()`
      insert into souqy_studio_assets (
        project_id, clerk_user_id, kind, contract, title, url, width, height,
        mime_type, prompt, provider, model, metadata, reference_metadata,
        asset_type, format_key, source_storefront_slug, source_product_ids, download_filename
      ) values (
        ${args.project.id},
        ${args.userId},
        ${asset.kind},
        ${asset.formatKey ?? asset.kind},
        ${asset.title},
        ${asset.url},
        ${asset.width},
        ${asset.height},
        ${asset.mimeType},
        ${args.prompt},
        ${asset.provider ?? null},
        ${asset.model ?? null},
        ${JSON.stringify(asset.metadata ?? {})}::jsonb,
        ${JSON.stringify(args.references)}::jsonb,
        ${asset.assetType ?? null},
        ${asset.formatKey ?? null},
        ${args.sourceStorefrontSlug ?? null},
        ${JSON.stringify(args.sourceProductIds ?? [])}::jsonb,
        ${asset.downloadFilename ?? null}
      )
      returning id, kind, title, url, width, height, mime_type, asset_type, format_key, download_filename
    `) as unknown as StudioAssetRow[];
    if (rows[0]) saved.push(fromStudioAssetRow(rows[0]));
  }
  await db()`
    update souqy_studio_projects
    set updated_at = now()
    where id = ${args.project.id} and clerk_user_id = ${args.userId}
  `;
  return saved;
}

async function catalogContextForGeneration(args: {
  userId: string;
  sourceStorefrontSlug?: string;
  selectedProductIds: string[];
}): Promise<string> {
  if (!args.sourceStorefrontSlug && args.selectedProductIds.length === 0) return '';
  const products = await getProductsForUser(args.userId);
  const selected = products
    .filter((product) => {
      if (args.sourceStorefrontSlug && product.storefrontSlug !== args.sourceStorefrontSlug) return false;
      if (args.selectedProductIds.length > 0 && !args.selectedProductIds.includes(product.id)) return false;
      return true;
    })
    .slice(0, 8);
  if (selected.length === 0) return '';
  return selected
    .map((product) => {
      const price = product.priceQar !== null ? `QAR ${product.priceQar}` : 'price not set';
      return `${product.title} (${price})${product.category ? `, ${product.category}` : ''}${product.description ? `: ${product.description}` : ''}`;
    })
    .join('\n');
}

function promptForbidsVisibleText(value: string): boolean {
  const text = value.toLowerCase();
  return /\b(no|without|exclude|remove|avoid)\s+(visible\s+)?(text|words|letters|copy|typography|brand\s+name|logo|label|labels|caption|headline|cta)\b/u.test(
    text,
  );
}

function promptRequestsVisibleText(value: string): boolean {
  if (!value.trim() || promptForbidsVisibleText(value)) return false;
  const text = value.toLowerCase();
  return (
    /\b(text|headline|title|caption|slogan|tagline|copy|cta|call\s+to\s+action|write|word|words|lettering|typography|wordmark|menu|price|prices|pricing|offer|discount|sale|label|labels|brand\s+name|logo\s+text)\b/u.test(
      text,
    ) || /["'“”‘’][^"'“”‘’]{2,}["'“”‘’]/u.test(value)
  );
}

const NO_FAKE_UI_TEXT_OR_LOGO_POLICY = [
  'Hard output rule: render a clean standalone creative image, not a screenshot or mock social post UI.',
  'Do not render social app chrome: no profile avatar, username, handle, timestamp, like icon, comment icon, share icon, bookmark icon, menu dots, notification badge, status bar, camera icon, microphone icon, caption area, or app navigation.',
  'Do not render random text, pseudo-text, letters, numbers, captions, hashtags, labels, stickers, badges, seals, watermarks, fake logos, invented logos, brand marks, or app/platform logos.',
  'Leave any text/logo/UI zones blank, abstract, or purely photographic unless the user supplied exact text or an exact logo reference.',
].join(' ');

function visibleTextPolicy(args: {
  prompt: string;
  template: SouqyStudioTemplate;
  brandInstructions?: string;
  catalogContext: string;
  hasReferences: boolean;
}): string {
  if (args.hasReferences) {
    return [
      NO_FAKE_UI_TEXT_OR_LOGO_POLICY,
      'Reference image policy: do not add new visible text, labels, captions, handles, badges, UI text, logos, brand names, or placeholder words.',
      'Only preserve readable text that already exists inside the uploaded image.',
    ].join(' ');
  }

  const textAllowed =
    promptRequestsVisibleText(args.prompt) ||
    promptRequestsVisibleText(args.brandInstructions ?? '') ||
    Boolean(args.catalogContext.trim()) ||
    args.template === 'restaurant-menu';

  if (!textAllowed) {
    return [
      NO_FAKE_UI_TEXT_OR_LOGO_POLICY,
      'Strict visual-only output.',
      'Do not include visible text, letters, numbers, symbols, captions, labels, handles, hashtags, UI text, legal copy, watermarks, logos, badges, brand names, fake commerce names, or placeholder words.',
      'Do not invent regional commerce names, app names, brand identities, internal layout labels, or percentage annotations.',
      'Do not include trademarked logos, superhero characters, existing brand marks, copyrighted characters, or social media interface chrome.',
      'Use clean blank space, abstract shapes, or realistic product surfaces where text would normally appear.',
    ].join(' ');
  }

  return [
    NO_FAKE_UI_TEXT_OR_LOGO_POLICY,
    'Visible text is allowed only when it is exact text supplied by the user, catalog, or brand instructions.',
    'Do not invent extra brand names, logos, slogans, legal copy, social handles, placeholder words, internal layout labels, percentage annotations, or gibberish typography.',
    'Do not include trademarked logos, superhero characters, existing brand marks, or app platform names unless explicitly provided by the user.',
  ].join(' ');
}

function formatPromptHint(formatKey: SouqyStudioFormat): string {
  const base = 'Canvas instruction only. Do not draw the user interface of the named app or platform.';
  if (formatKey === 'instagram-post') return `${base} Use a 4:5 vertical ad canvas.`;
  if (formatKey === 'instagram-story') return `${base} Use a 9:16 vertical story canvas with clean breathing room.`;
  if (formatKey === 'tiktok') return `${base} Use a 9:16 vertical short-video cover canvas.`;
  if (formatKey === 'whatsapp-status') return `${base} Use a 9:16 vertical status canvas.`;
  if (formatKey === 'snapchat') return `${base} Use a 9:16 vertical story canvas.`;
  if (formatKey === 'x-banner') return `${base} Use a wide landscape banner canvas.`;
  if (formatKey === 'a3-print') return 'Use an A3 print poster canvas. Do not add print marks, labels, or fake text.';
  if (formatKey === 'menu-print') return 'Use an A4 menu print canvas. Use only exact menu text supplied by the user.';
  if (formatKey === 'product-card') return 'Use a square product-card canvas. Do not invent product names, prices, badges, or logos.';
  if (formatKey === 'logo-square') return 'Use a square logo canvas. Generate only the requested logo, with no extra text unless supplied.';
  if (formatKey === 'wide-banner') return 'Use a wide storefront banner canvas. Do not invent brand names or labels.';
  return base;
}

function buildWorkplacePrompt(args: {
  prompt: string;
  template: SouqyStudioTemplate;
  formatKey?: SouqyStudioFormat;
  locale: 'en' | 'ar';
  brandInstructions?: string;
  quality?: 'standard' | 'high' | 'print';
  printBleed?: boolean;
  creativity?: number;
  catalogContext: string;
  hasReferences: boolean;
  creativeRoute: SouqyCreativeRoute;
}): string {
  const typeHint = args.hasReferences ? '' : templatePromptHint(args.template);
  const formatHint = args.formatKey ? formatPromptHint(args.formatKey) : '';
  const textPolicy = visibleTextPolicy(args);
  const catalogHint = args.catalogContext
    ? `Use this real catalog context only when the user asks for product-specific content:\n${args.catalogContext}`
    : args.hasReferences
      ? ''
      : 'Do not invent product names, prices, legal claims, campaign copy, or brand copy.';
  const referenceHint = args.hasReferences
    ? [
        'Enhance the uploaded design into a polished luxury promotional ad.',
        'Keep the uploaded logo, artwork, product, and existing text unchanged.',
        'Do not add phones, devices, app screens, people, unrelated products, fake brands, labels, captions, paragraphs, or extra visible words.',
        'Improve only lighting, depth, background atmosphere, margins, and premium presentation.',
      ].join(' ')
    : '';
  return [
    NO_FAKE_UI_TEXT_OR_LOGO_POLICY,
    args.prompt,
    referenceHint,
    typeHint,
    formatHint,
    args.locale === 'ar'
      ? 'If exact Arabic typography is explicitly requested, it must be correct, readable, naturally phrased, and not mirrored. Otherwise do not include visible text.'
      : 'If exact English typography is explicitly requested, it must be correct and readable. Otherwise do not include visible text.',
    args.brandInstructions ? `Brand instructions: ${args.brandInstructions}` : '',
    args.quality ? `Quality mode: ${args.quality}.` : '',
    args.printBleed ? 'Include print bleed and keep important visual content away from the outer edge.' : '',
    typeof args.creativity === 'number' ? `Creativity level: ${args.creativity}/10.` : '',
    catalogHint,
    textPolicy,
    'Use refined regional luxury art direction, clean composition, and no clutter.',
  ]
    .filter(Boolean)
    .join(' ');
}

function templatePromptHint(template: SouqyStudioTemplate): string {
  if (template === 'logo') return 'Create a logo or mark suitable for storefront header, app icon, and profile avatar use.';
  if (template === 'wide-banner') return 'Create a banner suitable for a storefront hero and campaign header.';
  if (template === 'launch-poster') return 'Create a campaign key visual with a clear focal area and polished retail composition.';
  if (template === 'story-promo') return 'Create a vertical story creative with calm mobile framing and clean negative space.';
  if (template === 'ad-creative') return 'Create a standalone advertising visual with strong product hierarchy and clean empty action space.';
  if (template === 'restaurant-menu') return 'Create an elegant menu layout. Use only provided menu text; otherwise show abstract menu structure without readable words.';
  if (template === 'product-card') return 'Create a product card visual for commerce listings and marketplace selling. Do not invent titles or prices.';
  if (template === 'packaging-mockup') return 'Create a packaging mockup visual for boxes, bags, stickers, or labels.';
  if (template === 'brand-identity' || template === 'brand-kit') return 'Create a brand identity moodboard with placement areas, palette, material cues, pattern zones, and applied mockup examples. Do not invent brand names.';
  if (template === 'short-video') return 'Create a single vertical key visual/frame suitable as the cover for a future short video.';
  return 'Create a polished AI creative asset.';
}

function routeSouqyCreativeTask(args: {
  prompt: string;
  template: SouqyStudioTemplate;
  formatKey?: SouqyStudioFormat;
  locale: 'en' | 'ar';
  quality?: 'standard' | 'high' | 'print';
  hasReferences: boolean;
  selectedProductIds: string[];
}): SouqyCreativeRoute {
  const text = args.prompt.toLowerCase();
  const hasArabic = args.locale === 'ar' || /[\u0600-\u06ff]/u.test(args.prompt);
  const isVideo =
    args.template === 'short-video' ||
    args.formatKey === 'tiktok' ||
    /\b(video|reel|motion|animate|tiktok|snap)\b/u.test(text);
  const isLogo = args.template === 'logo' || /\b(logo|mark|wordmark)\b/u.test(text);
  const isPackaging =
    args.template === 'packaging-mockup' || /\b(packaging|package|box|bag|label)\b/u.test(text);
  const isRamadan = /ramadan|eid|رمضان|عيد/u.test(text);
  const isProduct =
    args.template === 'product-card' ||
    args.template === 'ad-creative' ||
    args.selectedProductIds.length > 0 ||
    /\b(product|ad|advert|perfume|coffee|restaurant|menu|campaign)\b/u.test(text);
  const isLuxury = /\b(luxury|cinematic|premium|editorial|perfume|jewelry|fashion)\b/u.test(text);
  const wantsFastPreview = args.quality === 'standard' || /\b(preview|draft|quick|fast)\b/u.test(text);

  if (args.hasReferences) {
    return {
      intent: 'edit-reference-creative',
      primary: 'qwen-image-edit',
      consistency: ['controlnet', 'ip-adapter'],
      post: args.quality === 'print' ? ['real-esrgan', 'supir'] : [],
      video: isVideo ? ['wan-2.2', 'animatediff'] : [],
      mode: 'edit',
      promptDirective:
        'Internal route: AI image editing. Use the uploaded source image as the reference and generate a new promotional image from it.',
    };
  }

  if (isVideo) {
    return {
      intent: 'resize-for-short-video',
      primary: 'wan-2.2',
      consistency: ['controlnet'],
      post: [],
      video: ['wan-2.2', 'cogvideox', 'animatediff'],
      mode: 'video',
      promptDirective:
        'Internal route: short-form video key visual. Compose with calm vertical framing and future motion.',
    };
  }

  if (hasArabic || isRamadan) {
    return {
      intent: isRamadan ? 'create-ramadan-campaign' : 'create-campaign-poster',
      primary: 'qwen-image',
      consistency: ['controlnet'],
      post: args.quality === 'high' || args.quality === 'print' ? ['real-esrgan'] : [],
      video: [],
      mode: wantsFastPreview ? 'preview' : 'generate',
      promptDirective:
        'Internal route: Arabic/text-sensitive poster generation. Use exact supplied typography only when requested.',
    };
  }

  if (isPackaging) {
    return {
      intent: 'make-luxury-packaging',
      primary: isLuxury ? 'flux-dev' : 'juggernaut-xl',
      consistency: ['controlnet', 'ip-adapter'],
      post: args.quality === 'high' || args.quality === 'print' ? ['real-esrgan'] : [],
      video: [],
      mode: wantsFastPreview ? 'preview' : 'generate',
      promptDirective:
        'Internal route: packaging and retail product visualization. Prioritize material realism and clean shelf presence.',
    };
  }

  if (isLogo) {
    return {
      intent: 'generate-store-logo',
      primary: hasArabic ? 'qwen-image' : 'flux-dev',
      consistency: ['controlnet'],
      post: [],
      video: [],
      mode: 'generate',
      promptDirective:
        'Internal route: store identity generation. Keep the mark simple, scalable, and visually clear.',
    };
  }

  if (isProduct) {
    return {
      intent: 'create-product-ad',
      primary: isLuxury ? 'flux-dev' : 'juggernaut-xl',
      consistency: ['controlnet', 'ip-adapter'],
      post: args.quality === 'high' || args.quality === 'print' ? ['real-esrgan'] : [],
      video: [],
      mode: wantsFastPreview ? 'preview' : 'generate',
      promptDirective:
        'Internal route: product advertising. Prioritize realistic product hierarchy and conversion-focused negative space.',
    };
  }

  return {
    intent: 'generate-banner',
    primary: wantsFastPreview ? 'sdxl-turbo' : 'flux-dev',
    consistency: [],
    post: args.quality === 'high' || args.quality === 'print' ? ['real-esrgan'] : [],
    video: [],
    mode: wantsFastPreview ? 'preview' : 'generate',
    promptDirective:
      'Internal route: premium banner generation. Prioritize cinematic composition and simple visual hierarchy.',
  };
}

function downloadFilenameFor(
  businessName: string,
  template: SouqyStudioTemplate,
  contract: AssetContract,
  mimeType = contract.mimeType,
): string {
  const base = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'souqy';
  return `${base}-${contract.formatKey ?? template}-${contract.width}x${contract.height}.${extensionFor(mimeType)}`;
}

function pickProvider(
  contract: AssetContract,
  hasReferences: boolean,
  route?: SouqyCreativeRoute,
): { provider: StudioImageProvider } {
  if (env.REPLICATE_API_TOKEN) return { provider: 'replicate' };
  if (hasReferences) {
    if (env.FAL_KEY) return { provider: 'fal' };
    if (env.IDEOGRAM_API_KEY) return { provider: 'ideogram' };
    throw new Error(
      'Connect REPLICATE_API_TOKEN, FAL_KEY, or IDEOGRAM_API_KEY so Souqy can generate from reference images.',
    );
  }
  if (
    env.FAL_KEY &&
    route &&
    ['flux-dev', 'qwen-image', 'sdxl-turbo'].includes(route.primary)
  ) {
    return { provider: 'fal' };
  }
  if (env.IDEOGRAM_API_KEY) return { provider: 'ideogram' };
  if ((contract.kind === 'logo' || contract.kind === 'wideLogo') && env.REPLICATE_API_TOKEN) {
    return { provider: 'replicate' };
  }
  if (env.FAL_KEY) return { provider: 'fal' };
  throw new Error(
    'Connect REPLICATE_API_TOKEN, IDEOGRAM_API_KEY, or FAL_KEY so Souqy can generate AI images.',
  );
}

function outputMimeTypeFor(
  provider: StudioImageProvider,
  contract: AssetContract,
): AssetContract['mimeType'] {
  void provider;
  return contract.mimeType === 'image/svg+xml' ? 'image/webp' : contract.mimeType;
}

function outputMimeTypeForGeneration(
  provider: StudioImageProvider,
  contract: AssetContract,
  hasReferences: boolean,
  route: SouqyCreativeRoute,
): AssetContract['mimeType'] {
  if (provider === 'replicate') {
    return replicateOutputFormatFor(contract, hasReferences, route) === 'png'
      ? 'image/png'
      : 'image/webp';
  }
  if (
    provider === 'fal' &&
    (route.primary === 'qwen-image' || route.primary === 'qwen-image-edit')
  ) {
    return 'image/png';
  }
  return outputMimeTypeFor(provider, contract);
}

function contractsForTemplate(
  template: SouqyStudioTemplate,
  formatKey?: SouqyStudioFormat,
): AssetContract[] {
  const base =
    template === 'logo'
      ? CONTRACTS.logo!
      : template === 'wide-banner'
        ? CONTRACTS.banner!
        : template === 'story-promo'
          ? CONTRACTS.story!
          : template === 'ad-creative'
            ? CONTRACTS.ad!
            : template === 'restaurant-menu'
              ? CONTRACTS.menu!
              : template === 'product-card'
                ? CONTRACTS.productCard!
                : template === 'packaging-mockup'
                  ? CONTRACTS.packaging!
                  : template === 'brand-identity' || template === 'brand-kit'
                    ? CONTRACTS.brandIdentity!
                    : template === 'short-video'
                      ? CONTRACTS.story!
                      : CONTRACTS.poster!;
  return [{ ...base, ...formatContractOverride(formatKey), assetType: template, formatKey }];
}

function formatContractOverride(formatKey?: SouqyStudioFormat): Partial<AssetContract> {
  if (!formatKey) return {};
  if (formatKey === 'instagram-post') return { width: 1080, height: 1350, title: 'Instagram post' };
  if (formatKey === 'instagram-story') return { width: 1080, height: 1920, title: 'Instagram story' };
  if (formatKey === 'tiktok') return { width: 1080, height: 1920, title: 'TikTok creative' };
  if (formatKey === 'whatsapp-status') return { width: 1080, height: 1920, title: 'WhatsApp status' };
  if (formatKey === 'snapchat') return { width: 1080, height: 1920, title: 'Snapchat story' };
  if (formatKey === 'x-banner') return { width: 1600, height: 900, title: 'X banner' };
  if (formatKey === 'a3-print') {
    return {
      width: 3508,
      height: 4961,
      title: 'A3 print',
      promptHint: 'A3 print poster, 300dpi design intent, generous outer margins, no readable text unless exact text is provided',
    };
  }
  if (formatKey === 'menu-print') {
    return {
      width: 2480,
      height: 3508,
      title: 'Menu print',
      promptHint: 'A4 vertical menu print, generous margins, print-ready spacing, use only provided menu sections and prices',
    };
  }
  if (formatKey === 'product-card') return { width: 1080, height: 1080, title: 'Product card' };
  if (formatKey === 'logo-square') return { width: 1024, height: 1024, title: 'Logo square' };
  if (formatKey === 'wide-banner') return { width: 2400, height: 1200, title: 'Wide banner' };
  return {};
}

async function generateContractImage(args: {
  contract: AssetContract;
  prompt: string;
  locale: 'en' | 'ar';
  references: z.infer<typeof ReferenceSchema>[];
  provider: StudioImageProvider;
  route: SouqyCreativeRoute;
}): Promise<string> {
  const referenceInstruction =
    args.references.length > 0 && args.route.primary !== 'qwen-image-edit'
      ? 'Use the provided reference image as the source image. Keep its actual subject and design; do not invent a different product or fake text.'
      : '';
  const prompt = [
    args.prompt,
    referenceInstruction,
    args.contract.promptHint,
    `Final output canvas: ${args.contract.width}x${args.contract.height}.`,
    args.locale === 'ar'
      ? 'If exact visible Arabic typography is requested, it must be correct, readable, and not mirrored. Otherwise do not include visible text.'
      : 'If exact visible English typography is requested, it must be correct and readable. Otherwise do not include visible text.',
    'Avoid trademarked logos, superhero characters, existing brand marks, social media UI, random labels, nonsense text, fake percent annotations, and internal layout labels.',
  ].join(' ');

  if (args.provider === 'fal') {
    return generateWithFal(prompt, args.contract, args.references, args.route);
  }
  if (args.provider === 'ideogram') {
    return generateWithIdeogram(prompt, args.contract, args.references);
  }
  return generateWithReplicate(prompt, args.contract, args.references, args.route);
}

async function generateWithReplicate(
  prompt: string,
  contract: AssetContract,
  references: z.infer<typeof ReferenceSchema>[] = [],
  route?: SouqyCreativeRoute,
): Promise<string> {
  const model = replicateModelForRoute(route, references.length > 0);
  return runReplicatePrediction(
    model,
    replicateInputForRoute({ prompt, contract, references, route }),
  );
}

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      input,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Replicate generation failed (${response.status})${summarizeProviderError(errorText)}.`,
    );
  }
  const json = (await response.json()) as { output?: unknown; urls?: { get?: string } };
  const output = imageUrlFromOutput(json.output);
  if (output) return output;
  if (json.urls?.get) return pollPrediction(json.urls.get, `Bearer ${env.REPLICATE_API_TOKEN}`);
  throw new Error('Replicate did not return an image URL.');
}

function replicateModelForRoute(route?: SouqyCreativeRoute, hasReferences = false): string {
  void route;
  void hasReferences;
  return REPLICATE_PRIMARY_IMAGE_MODEL;
}

function replicateModelNameForRoute(): string {
  return 'flux-2-max';
}

function replicateInputForRoute(args: {
  prompt: string;
  contract: AssetContract;
  references: z.infer<typeof ReferenceSchema>[];
  route?: SouqyCreativeRoute;
}): Record<string, unknown> {
  const outputFormat = replicateOutputFormatFor(args.contract, args.references.length > 0, args.route);
  if (args.references.length > 0) {
    return {
      prompt: referenceEditPrompt(args.prompt),
      input_images: args.references.map((reference) => reference.dataUrl),
      aspect_ratio: 'match_input_image',
      resolution: 'match_input_image',
      safety_tolerance: 2,
      output_format: outputFormat,
      output_quality: outputFormat === 'png' ? 100 : 94,
    };
  }

  const size = boundedReplicateSize(args.contract);
  return {
    prompt: args.prompt,
    aspect_ratio: 'custom',
    width: size.width,
    height: size.height,
    safety_tolerance: 2,
    output_format: outputFormat,
    output_quality: outputFormat === 'png' ? 100 : 94,
  };
}

function replicateOutputFormatFor(
  contract: AssetContract,
  hasReferences: boolean,
  route?: SouqyCreativeRoute,
): 'png' | 'webp' {
  if (
    hasReferences ||
    route?.primary === 'qwen-image' ||
    route?.primary === 'qwen-image-edit' ||
    contract.mimeType === 'image/png' ||
    contract.mimeType === 'image/svg+xml'
  ) {
    return 'png';
  }
  return 'webp';
}

function boundedReplicateSize(contract: AssetContract): { width: number; height: number } {
  const maxEdge = Math.max(contract.width, contract.height);
  const scale = maxEdge > 2048 ? 2048 / maxEdge : 1;
  const width = Math.max(256, Math.min(2048, Math.round((contract.width * scale) / 16) * 16));
  const height = Math.max(256, Math.min(2048, Math.round((contract.height * scale) / 16) * 16));
  return { width, height };
}

function summarizeProviderError(value: string): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value) as { detail?: unknown; error?: unknown };
    const detail = parsed.detail ?? parsed.error;
    if (typeof detail === 'string') return `: ${detail.slice(0, 220)}`;
    if (Array.isArray(detail))
      return `: ${detail
        .map((item) => JSON.stringify(item))
        .join(', ')
        .slice(0, 220)}`;
    if (detail && typeof detail === 'object') return `: ${JSON.stringify(detail).slice(0, 220)}`;
  } catch {
    return `: ${value.slice(0, 220)}`;
  }
  return '';
}

async function generateWithFal(
  prompt: string,
  contract: AssetContract,
  references: z.infer<typeof ReferenceSchema>[],
  route: SouqyCreativeRoute,
): Promise<string> {
  const endpoint = falEndpointForRoute(route, references.length > 0);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(falInputForRoute({ prompt, contract, references, route })),
  });
  if (!response.ok) throw new Error(`Fal generation failed (${response.status}).`);
  const json = (await response.json()) as {
    images?: Array<{ url?: string }>;
    image?: { url?: string };
    response_url?: string;
  };
  const imageUrl = imageUrlFromFalJson(json);
  if (imageUrl) return imageUrl;
  if (json.response_url) return pollFalResponse(json.response_url);
  throw new Error('Fal did not return an image URL.');
}

function falEndpointForRoute(route: SouqyCreativeRoute, hasReferences: boolean): string {
  if (hasReferences && route.primary === 'qwen-image-edit') {
    return 'https://queue.fal.run/fal-ai/qwen-image/image-to-image';
  }
  if (hasReferences) return 'https://queue.fal.run/fal-ai/recraft/v3/image-to-image';
  if (route.primary === 'qwen-image') return 'https://queue.fal.run/fal-ai/qwen-image';
  if (route.primary === 'flux-dev') return 'https://queue.fal.run/fal-ai/flux/dev';
  if (route.primary === 'sdxl-turbo') return 'https://queue.fal.run/fal-ai/fast-sdxl';
  return 'https://queue.fal.run/fal-ai/recraft/v3/text-to-image';
}

function falInputForRoute(args: {
  prompt: string;
  contract: AssetContract;
  references: z.infer<typeof ReferenceSchema>[];
  route: SouqyCreativeRoute;
}): Record<string, unknown> {
  const imageSize = { width: args.contract.width, height: args.contract.height };
  if (args.references.length > 0) {
    if (args.route.primary === 'qwen-image-edit') {
      return {
        prompt: referenceEditPrompt(),
        image_url: args.references[0]?.dataUrl,
        image_size: imageSize,
        num_inference_steps: 30,
        guidance_scale: 1.2,
        strength: 0.22,
        use_turbo: false,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'png',
        negative_prompt:
          'social media UI, instagram UI, tiktok UI, snapchat UI, app screen, mobile UI, profile avatar, username, handle, timestamp, like icon, comment icon, share icon, bookmark icon, menu dots, notification badge, status bar, caption area, phone, smartphone, random device, unrelated product, fake brand, fake logo, new logo, added text, labels, captions, hashtags, lorem ipsum, gibberish text, pseudo text, unreadable typography, distorted logo, watermark, people',
        acceleration: 'regular',
      };
    }
    return {
      prompt: args.prompt,
      image_url: args.references[0]?.dataUrl,
      image_size: imageSize,
      style:
        args.contract.kind === 'logo' || args.contract.kind === 'wideLogo'
          ? 'vector_illustration'
          : 'realistic_image',
    };
  }
  if (args.route.primary === 'qwen-image' || args.route.primary === 'flux-dev') {
    return {
      prompt: args.prompt,
      image_size: imageSize,
      output_format: args.route.primary === 'qwen-image' ? 'png' : undefined,
    };
  }
  if (args.route.primary === 'sdxl-turbo') {
    return {
      prompt: args.prompt,
      image_size: imageSize,
      num_inference_steps: 4,
    };
  }
  return {
    prompt: args.prompt,
    image_size: imageSize,
    style:
      args.contract.kind === 'logo' || args.contract.kind === 'wideLogo'
        ? 'vector_illustration'
        : 'realistic_image',
  };
}

function referenceEditPrompt(userPrompt?: string): string {
  const sourcePrompt = userPrompt ? `User request: ${userPrompt.slice(0, 900)}` : '';
  return [
    'Create an AI-generated premium advertisement from the uploaded image.',
    sourcePrompt,
    'The uploaded image is the only source product or artwork. Preserve its actual subject, logo, design, colors, and readable text.',
    'Do not replace it with a phone, app mockup, electronics device, unrelated product, fake brand, or random interface.',
    'Do not invent new visible words, labels, captions, or gibberish typography.',
    'Do not render social app chrome: no profile avatar, username, handle, timestamp, like icon, comment icon, share icon, bookmark icon, menu dots, notification badge, status bar, caption area, or app navigation.',
    'Do not add trademarked logos, superhero characters, social handles, internal layout labels, percentage annotations, app names, or fake commerce names.',
    'Preserve the exact uploaded design, logo, artwork, colors, composition, and all existing readable text.',
    'Keep the same subject and core layout. Add only refined lighting, depth, background polish, margins, and luxury finish.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function generateWithIdeogram(
  prompt: string,
  contract: AssetContract,
  references: z.infer<typeof ReferenceSchema>[],
): Promise<string> {
  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: {
      'Api-Key': env.IDEOGRAM_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: aspectRatioFor(contract),
      rendering_speed: 'DEFAULT',
      reference_images: references.map((reference) => reference.dataUrl),
    }),
  });
  if (!response.ok) throw new Error(`Ideogram generation failed (${response.status}).`);
  const json = (await response.json()) as { data?: Array<{ url?: string }> };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error('Ideogram did not return an image URL.');
  return url;
}

async function pollPrediction(url: string, authorization: string): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const response = await fetch(url, { headers: { Authorization: authorization } });
    if (!response.ok) throw new Error(`Generation polling failed (${response.status}).`);
    const json = (await response.json()) as { status?: string; output?: unknown; error?: string };
    const output = imageUrlFromOutput(json.output);
    if (output) return output;
    if (json.status === 'failed' || json.status === 'canceled') {
      throw new Error(json.error || 'Image generation failed.');
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error('Image generation timed out.');
}

async function pollFalResponse(url: string): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const response = await fetch(url, { headers: { Authorization: `Key ${env.FAL_KEY}` } });
    if (response.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      continue;
    }
    if (!response.ok) throw new Error(`Fal polling failed (${response.status}).`);
    const json = (await response.json()) as {
      images?: Array<{ url?: string }>;
      image?: { url?: string };
    };
    const imageUrl = imageUrlFromFalJson(json);
    if (imageUrl) return imageUrl;
  }
  throw new Error('Fal generation timed out.');
}

async function maybeUpscaleWithFal(
  sourceUrl: string,
  route: SouqyCreativeRoute,
): Promise<string> {
  if (env.REPLICATE_API_TOKEN && route.post.includes('real-esrgan') && !sourceUrl.startsWith('data:')) {
    return runReplicatePrediction('nightmareai/real-esrgan', {
      image: sourceUrl,
      scale: 2,
      face_enhance: false,
    }).catch(() => sourceUrl);
  }
  if (!env.FAL_KEY || !route.post.includes('real-esrgan') || sourceUrl.startsWith('data:')) {
    return sourceUrl;
  }
  const response = await fetch('https://queue.fal.run/fal-ai/esrgan', {
    method: 'POST',
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_url: sourceUrl }),
  });
  if (!response.ok) return sourceUrl;
  const json = (await response.json()) as {
    image?: { url?: string };
    images?: Array<{ url?: string }>;
    response_url?: string;
  };
  const imageUrl = imageUrlFromFalJson(json);
  if (imageUrl) return imageUrl;
  if (json.response_url) return pollFalResponse(json.response_url).catch(() => sourceUrl);
  return sourceUrl;
}

function imageUrlFromFalJson(json: {
  image?: { url?: string };
  images?: Array<{ url?: string }>;
}): string | null {
  return json.images?.[0]?.url ?? json.image?.url ?? null;
}

function imageUrlFromOutput(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  if (Array.isArray(output) && output[0] && typeof output[0] === 'object' && 'url' in output[0]) {
    const maybeUrl = (output[0] as { url?: unknown }).url;
    return typeof maybeUrl === 'string' ? maybeUrl : null;
  }
  return null;
}

async function persistRemoteAsset(args: {
  sourceUrl: string;
  pathname: string;
  contentType: string;
}): Promise<string> {
  const response = await fetch(args.sourceUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not download generated asset (${response.status}).`);
  const blob = await response.blob();
  const stored = await withTimeout(
    put(args.pathname, blob, {
      access: 'public',
      contentType: args.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
    }),
    8_000,
  ).catch(() => null);
  if (!stored) return args.sourceUrl;
  return stored.url;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    }),
  ]);
}

async function copyAssetsIntoStorefrontNamespace(
  slug: string,
  assets: SouqyStudioAsset[],
): Promise<SouqyStudioAsset[]> {
  const copied: SouqyStudioAsset[] = [];
  for (const asset of assets) {
    const contract = Object.values(CONTRACTS).find((item) => item.kind === asset.kind);
    if (!contract) {
      copied.push(asset);
      continue;
    }
    const url = await persistRemoteAsset({
      sourceUrl: asset.url,
      pathname: `${contract.blobPrefix}/${slug}/${crypto.randomUUID()}-${asset.kind}.${extensionFor(asset.mimeType)}`,
      contentType: asset.mimeType,
    });
    copied.push({ ...asset, url });
  }
  return copied;
}

function buildSouqyStudioBlocks(args: {
  businessName: string;
  businessType: BusinessType;
  locale: 'en' | 'ar';
  prompt: string;
  assets: SouqyStudioAsset[];
  brand: StudioBrandKit;
}): Block[] {
  const logo = pickAsset(args.assets, 'logo');
  const banner =
    pickAsset(args.assets, 'banner') ??
    pickAsset(args.assets, 'og') ??
    pickAsset(args.assets, 'poster');
  const poster = pickAsset(args.assets, 'poster') ?? pickAsset(args.assets, 'story') ?? banner;
  const story = pickAsset(args.assets, 'story') ?? poster;
  const inquiryId = crypto.randomUUID();
  const isAr = args.locale === 'ar';
  return [
    {
      id: crypto.randomUUID(),
      type: 'hero',
      props: {
        eyebrow: isAr ? 'صُمم بسوقي' : 'Created with Souqy',
        title: args.businessName,
        tagline: args.brand.heading,
        layout: 'banner',
        backgroundUrl: banner?.url,
        logoMode: logo ? 'custom' : 'default',
        logoUrl: logo?.url,
        cta: {
          label: isAr ? 'ابدأ الطلب' : 'Start an inquiry',
          href: '#',
          scrollTo: inquiryId,
        },
      },
      style: { paddingY: 'xl', paddingX: 'lg', colorScheme: 'dark' },
    },
    {
      id: crypto.randomUUID(),
      type: 'banner',
      props: {
        imageUrl: poster?.url ?? '',
        alt: `${args.businessName} launch poster`,
        overlayTitle: isAr ? 'إطلاق البراند' : 'Brand launch',
        overlaySubtitle: args.brand.heading,
        align: 'start',
        scrim: 'soft',
      },
      style: { paddingY: 'lg', paddingX: 'lg' },
    },
    {
      id: crypto.randomUUID(),
      type: 'text',
      props: {
        eyebrow: isAr ? 'هوية البراند' : 'Brand system',
        heading: isAr
          ? 'نفس الهوية من الإعلان إلى المتجر.'
          : 'One identity from promo to storefront.',
        body: args.brand.story,
        align: 'center',
        emphasis: 'plain',
      },
      style: { paddingY: 'lg', paddingX: 'lg' },
    },
    {
      id: crypto.randomUUID(),
      type: 'gallery',
      props: {
        items: [banner, poster, story].filter(Boolean).map((asset) => ({
          imageUrl: asset!.url,
          alt: `${args.businessName} ${asset!.title}`,
          caption: asset!.title,
        })),
        columns: 3,
        aspect: '1/1',
      },
      style: { paddingY: 'lg', paddingX: 'lg' },
    },
    {
      id: crypto.randomUUID(),
      type: 'productGrid',
      props: {
        layout: 'lookbook',
        columns: 3,
        limit: 6,
        showInquire: true,
      },
      style: { paddingY: 'lg', paddingX: 'lg' },
    },
    {
      id: crypto.randomUUID(),
      type: 'contactCard',
      props: {
        heading: isAr ? 'تواصل معنا' : 'Get in touch',
        showPhone: true,
        showInstagram: true,
      },
      style: { paddingY: 'md', paddingX: 'lg' },
    },
    {
      id: inquiryId,
      type: 'inquireCta',
      props: {
        title: isAr ? 'جاهز تطلق البراند؟' : 'Ready to launch the brand?',
        body: isAr
          ? 'ارسل لنا طلبك وسنرجع لك بأسرع وقت.'
          : 'Send an inquiry and we will get back to you quickly.',
        label: isAr ? 'أرسل طلب' : 'Send inquiry',
        align: 'center',
      },
      style: { paddingY: 'lg', paddingX: 'lg', colorScheme: 'dark' },
    },
  ];
}

function inferBrandKit(prompt: string): StudioBrandKit {
  const lower = prompt.toLowerCase();
  const palette =
    lower.includes('oud') || lower.includes('perfume') || lower.includes('عطر')
      ? 'maroon_bone'
      : lower.includes('food') || lower.includes('cafe') || lower.includes('مطعم')
        ? 'sand_gold'
        : lower.includes('fashion') || lower.includes('clothing') || lower.includes('عباية')
          ? 'pearl_lagoon'
          : 'sand_gold';
  return {
    palette,
    heading:
      'A polished Souqna-ready brand system with a logo, launch visuals, and storefront direction.',
    story:
      'This draft carries one visual language across the storefront: a clear hero, launch-ready promotional imagery, product space, and a practical inquiry path for customers.',
    tone: ['polished', 'commercial', 'bilingual', 'launch-ready'],
    fonts: {
      heading:
        lower.includes('oud') ||
        lower.includes('perfume') ||
        lower.includes('luxury') ||
        lower.includes('عطر')
          ? 'Editorial serif'
          : 'Geometric display',
      body: lower.includes('arabic') || lower.includes('عربي') ? 'Bilingual sans' : 'Clean sans',
    },
  };
}

function pickAsset(
  assets: SouqyStudioAsset[],
  kind: SouqyStudioAsset['kind'],
): SouqyStudioAsset | undefined {
  return assets.find((asset) => asset.kind === kind);
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

function aspectRatioFor(contract: AssetContract): string {
  if (contract.width === contract.height) return '1x1';
  if (contract.width === 1080 && contract.height === 1920) return '9x16';
  if (contract.width === 1200 && contract.height === 630) return '16x9';
  if (contract.width === 2400 && contract.height === 1200) return '2x1';
  return '16x9';
}
