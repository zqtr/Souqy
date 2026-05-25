import 'server-only';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ProductWriteInput } from '@/lib/products';
import {
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  MAX_PRODUCT_SIZE_OPTIONS,
  normalizeHeightInputLabel,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from '@/lib/productOptions';

export const MobileProductFieldsSchema = z.object({
  store: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).optional().nullable(),
  priceQar: z.number().nonnegative().max(99_999_999).optional().nullable(),
  imageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  categoryIds: z.array(z.string().uuid()).max(20).optional().default([]),
  sizeOptions: z
    .array(z.string().trim().max(40))
    .max(MAX_PRODUCT_SIZE_OPTIONS)
    .optional()
    .default([]),
  allowCustomSize: z.boolean().optional().default(false),
  requiresHeightInput: z.boolean().optional().default(false),
  heightInputLabel: z.string().trim().max(40).optional().nullable(),
  heightOptions: z
    .array(z.string().trim().max(40))
    .max(MAX_PRODUCT_SIZE_OPTIONS)
    .optional()
    .default([]),
  eventAt: z.string().trim().optional().nullable(),
  status: z.enum(['active', 'draft', 'sold_out']).default('active'),
});

export function mobileProductPayload(
  data: z.infer<typeof MobileProductFieldsSchema>,
): ProductWriteInput {
  let eventAt: Date | null = null;
  if (data.eventAt) {
    const parsed = new Date(data.eventAt);
    if (!Number.isNaN(parsed.getTime())) eventAt = parsed;
  }
  const heightOptions = data.requiresHeightInput ? normalizeHeightOptions(data.heightOptions) : [];
  return {
    title: data.title,
    description: data.description?.trim() || null,
    priceQar: typeof data.priceQar === 'number' ? data.priceQar : null,
    imageUrl: data.imageUrl ? data.imageUrl : null,
    category: null,
    sizeOptions: normalizeSizeOptions(data.sizeOptions),
    allowCustomSize:
      data.allowCustomSize === true && normalizeSizeOptions(data.sizeOptions).length > 0,
    requiresHeightInput: data.requiresHeightInput === true,
    heightInputLabel:
      data.requiresHeightInput === true ? normalizeHeightInputLabel(data.heightInputLabel) : null,
    heightOptions:
      data.requiresHeightInput === true && heightOptions.length > 0
        ? heightOptions
        : data.requiresHeightInput === true
          ? DEFAULT_PRODUCT_HEIGHT_OPTIONS
          : [],
    eventAt,
    status: data.status,
  };
}

export function revalidateMobileProductPaths(slug: string): void {
  revalidatePath(`/brief/${slug}`);
  revalidatePath('/account');
  revalidatePath('/account/products');
  revalidatePath(`/account/${slug}/preview`);
}
