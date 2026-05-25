import { z } from 'zod';

export const CATEGORIES = [
  'perfume-oud',
  'perfume-modern',
  'fashion-abaya',
  'fashion-modest',
  'electronics-phones',
  'electronics-accessories',
  'home-decor',
  'home-textiles',
  'beauty-skincare',
  'beauty-cosmetics',
  'food-dates',
  'food-spices',
  'jewelry-gold',
  'jewelry-fashion',
  'kids-toys',
  'kids-clothing',
  'sports-fitness',
  'gifts-corporate',
  'uncategorized',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);
export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && CATEGORY_SET.has(v);
}

export const SourceNetworkSchema = z.enum(['qatarliving', 'marhaba', 'qmart']);
export type SourceNetwork = z.infer<typeof SourceNetworkSchema>;

export const ListingTypeSchema = z.enum(['priced', 'contact']);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const SupplierSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  crNumber: z.string().nullable(),
  whatsapp: z.string().nullable(),
  area: z.string().nullable(),
  sourceNetwork: z.string(),
  sourceProfileUrl: z.string().nullable(),
  trustScore: z.number().min(0).max(10).nullable(),
  trustReason: z.string().nullable(),
  verified: z.boolean(),
  claimedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  lastIndexedAt: z.string(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const ListingSchema = z
  .object({
    id: z.string().min(1),
    supplierId: z.string().min(1),
    network: SourceNetworkSchema,
    sourceListingUrl: z.string().url(),
    title: z.string().min(1),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    category: z.enum(CATEGORIES),
    subcategory: z.string().nullable(),
    listingType: ListingTypeSchema,
    price: z.number().nullable(),
    currency: z.string().nullable(),
    moq: z.number().int().nullable(),
    raw: z.record(z.unknown()),
    firstSeenAt: z.string(),
    lastIndexedAt: z.string(),
    delistedAt: z.string().nullable(),
  })
  .refine(
    (l) =>
      l.listingType === 'contact' ||
      (typeof l.price === 'number' && l.price > 0),
    { message: 'priced listing must have a positive price' },
  );
export type Listing = z.infer<typeof ListingSchema>;
