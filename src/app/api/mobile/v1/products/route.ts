import { recordAudit } from '@/lib/audit';
import {
  getAllProducts,
  insertProduct,
} from '@/lib/products';
import {
  getCategories,
  getProductCategoryIdsBatch,
  setProductCategories,
} from '@/lib/categories';
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

export async function GET(req: Request): Promise<Response> {
  const slug = searchParam(req, 'store');
  const gate = await requireMobileStoreAccess(slug, 'products.manage');
  if (!gate.ok) return gate.response;

  const [products, categories] = await Promise.all([
    getAllProducts(gate.access.storefront.slug),
    getCategories(gate.access.storefront.slug),
  ]);
  const categoryIds = await getProductCategoryIdsBatch(products.map((p) => p.id));

  return mobileJson({
    products: products.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      eventAt: product.eventAt ? product.eventAt.toISOString() : null,
      categoryIds: categoryIds.get(product.id) ?? [],
    })),
    categories: categories.map((category) => ({
      ...category,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = MobileProductFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, 'invalid_product', parsed.error.issues[0]?.message ?? 'Invalid product');
  }
  const gate = await requireMobileStoreAccess(parsed.data.store, 'products.manage');
  if (!gate.ok) return gate.response;

  const product = await insertProduct(
    gate.access.storefront.slug,
    mobileProductPayload(parsed.data),
  );
  await setProductCategories(
    gate.access.storefront.slug,
    product.id,
    parsed.data.categoryIds ?? [],
  );
  await recordAudit({
    storefrontSlug: gate.access.storefront.slug,
    clerkUserId: gate.user.userId,
    action: 'product.create',
    targetId: product.id,
    summary: `Created product ${product.title}`,
    meta: { source: 'mobile', status: product.status },
  });
  revalidateMobileProductPaths(gate.access.storefront.slug);
  return mobileJson({ product }, { status: 201 });
}
