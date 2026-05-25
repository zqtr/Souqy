import { db } from '@/lib/db';
import { getListingById } from './listings';
import { getSupplierById } from './suppliers';
import { rewriteCopy } from './ai/copy';
import { suggestMargin } from './ai/margin';
import { fetchAndStoreImage } from './image';
import { insertLink } from './links';

export type ImportOverrides = {
  title?: { en?: string; ar?: string };
  description?: { en?: string; ar?: string };
  retail?: number;
};

export async function addToCatalog(opts: {
  storefrontSlug: string;
  listingId: string;
  overrides: ImportOverrides;
}): Promise<{ productId: string }> {
  const listing = await getListingById(opts.listingId);
  if (
    !listing ||
    listing.listingType !== 'priced' ||
    listing.price === null ||
    listing.delistedAt !== null
  ) {
    throw new Error('listing_unavailable');
  }
  const supplier = await getSupplierById(listing.supplierId);
  if (!supplier) throw new Error('supplier_not_found');

  const briefs = (await db()`
    select slug from briefs where slug = ${opts.storefrontSlug} limit 1
  `) as unknown as { slug: string }[];
  if (!briefs[0]) throw new Error('storefront_not_found');

  const productId = globalThis.crypto.randomUUID();

  const [copy, margin, imageUrl] = await Promise.all([
    rewriteCopy({
      title: listing.title,
      description: listing.description,
      category: listing.category,
      area: supplier.area,
    }),
    suggestMargin({
      title: listing.title,
      category: listing.category,
      supplierCost: listing.price,
      supplierCurrency: listing.currency ?? 'QAR',
      moq: listing.moq,
      area: supplier.area,
    }),
    listing.imageUrl
      ? fetchAndStoreImage({
          imageUrl: listing.imageUrl,
          storefrontSlug: opts.storefrontSlug,
          productId,
        })
      : Promise.resolve(null),
  ]);

  const titleEn = opts.overrides.title?.en ?? copy?.title.en ?? listing.title;
  const titleAr = opts.overrides.title?.ar ?? copy?.title.ar ?? listing.title;
  const descEn =
    opts.overrides.description?.en ?? copy?.description.en ?? (listing.description ?? '');
  const descAr =
    opts.overrides.description?.ar ?? copy?.description.ar ?? (listing.description ?? '');
  const retail = opts.overrides.retail ?? margin?.suggestedRetail ?? listing.price * 2;

  await db()`begin`;
  try {
    await db()`
      insert into products
        (id, storefront_slug, title, description, price_qar, image_url, status, source, title_ar, description_ar)
      values
        (${productId}, ${opts.storefrontSlug}, ${titleEn}, ${descEn}, ${retail},
         ${imageUrl}, 'draft', 'souqnasource', ${titleAr}, ${descAr})
    `;
    await insertLink({
      productId,
      storefrontSlug: opts.storefrontSlug,
      listingId: listing.id,
      supplierId: listing.supplierId,
      supplierCost: listing.price,
      supplierCurrency: listing.currency ?? 'QAR',
    });
    await db()`commit`;
  } catch (err) {
    await db()`rollback`;
    throw err;
  }

  return { productId };
}
