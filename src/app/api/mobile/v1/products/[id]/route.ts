import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { deleteProductRowWithSnapshot, getProduct, updateProductRow } from '@/lib/products';
import { getProductCategoryIds, setProductCategories } from '@/lib/categories';
import {
  mobileError,
  mobileJson,
  mobileOptions,
  requireMobileStoreAccess,
  searchParam,
} from '@/lib/mobile/auth';
import {
  MobileProductFieldsSchema,
  mobileProductPayload,
  revalidateMobileProductPaths,
} from '@/lib/mobile/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return mobileOptions();
}

const PatchSchema = MobileProductFieldsSchema.partial().extend({
  store: z.string().trim().min(1).max(64),
});

export async function GET(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'products.manage');
  if (!gate.ok) return gate.response;

  const [product, categoryIds] = await Promise.all([
    getProduct(gate.access.storefront.slug, params.id),
    getProductCategoryIds(params.id),
  ]);
  if (!product) return mobileError(404, 'not_found', 'Product not found.');
  return mobileJson({ product: { ...product, categoryIds } });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(
      400,
      'invalid_product',
      parsed.error.issues[0]?.message ?? 'Invalid product',
    );
  }
  const gate = await requireMobileStoreAccess(parsed.data.store, 'products.manage');
  if (!gate.ok) return gate.response;

  const current = await getProduct(gate.access.storefront.slug, params.id);
  if (!current) return mobileError(404, 'not_found', 'Product not found.');

  const merged = {
    store: gate.access.storefront.slug,
    title: parsed.data.title ?? current.title,
    description: parsed.data.description ?? current.description,
    priceQar: parsed.data.priceQar ?? current.priceQar,
    imageUrl: parsed.data.imageUrl ?? current.imageUrl,
    categoryIds: parsed.data.categoryIds ?? (await getProductCategoryIds(params.id)),
    sizeOptions: parsed.data.sizeOptions ?? current.sizeOptions,
    allowCustomSize: parsed.data.allowCustomSize ?? current.allowCustomSize,
    requiresHeightInput: parsed.data.requiresHeightInput ?? current.requiresHeightInput,
    heightInputLabel: parsed.data.heightInputLabel ?? current.heightInputLabel,
    heightOptions: parsed.data.heightOptions ?? current.heightOptions,
    eventAt: parsed.data.eventAt ?? (current.eventAt ? current.eventAt.toISOString() : null),
    status: parsed.data.status ?? current.status,
  };

  const product = await updateProductRow(
    gate.access.storefront.slug,
    params.id,
    mobileProductPayload(merged),
  );
  if (!product) return mobileError(404, 'not_found', 'Product not found.');
  await setProductCategories(gate.access.storefront.slug, product.id, merged.categoryIds ?? []);
  await recordAudit({
    storefrontSlug: gate.access.storefront.slug,
    clerkUserId: gate.user.userId,
    action: 'product.update',
    targetId: product.id,
    summary: `Updated product ${product.title}`,
    meta: { source: 'mobile', status: product.status },
  });
  revalidateMobileProductPaths(gate.access.storefront.slug);
  return mobileJson({ product });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'products.manage');
  if (!gate.ok) return gate.response;

  const product = await deleteProductRowWithSnapshot(gate.access.storefront.slug, params.id);
  if (!product) return mobileError(404, 'not_found', 'Product not found.');
  await recordAudit({
    storefrontSlug: gate.access.storefront.slug,
    clerkUserId: gate.user.userId,
    action: 'product.delete',
    targetId: product.id,
    summary: `Deleted product ${product.title}`,
    meta: { source: 'mobile' },
  });
  revalidateMobileProductPaths(gate.access.storefront.slug);
  return mobileJson({ ok: true });
}
