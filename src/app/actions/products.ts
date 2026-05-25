'use server';

import { z } from 'zod';
import * as XLSX from 'xlsx';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { isLocale, type Locale } from '@/i18n/locales';
import { getCopy } from '@/content/copy';
import { hasDb } from '@/lib/db';
import {
  assertStorefrontOwner,
  countMerchantProducts,
  deleteDemoProducts,
  deleteProductRowWithSnapshot,
  insertProduct,
  reorderProductRows,
  updateProductRow,
  type Product,
  type ProductWriteInput,
} from '@/lib/products';
import { setProductCategories } from '@/lib/categories';
import { recordPulseActivity } from '@/lib/pulseActivity';
import { getPlan, planUnlocksMonthlyPayments } from '@/lib/billing';
import { productCapFailure } from '@/lib/planEnforcement';
import {
  MAX_PRODUCT_SIZE_OPTIONS,
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  normalizeHeightInputLabel,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from '@/lib/productOptions';

/**
 * All product actions share the same surface: the signed-in Clerk user must
 * own the storefront referenced by `slug`. Ownership is re-checked on every
 * call against `briefs.clerk_user_id` so a stale session can't be impersonated.
 */

const TitleSchema = z.string().trim().min(1).max(160);
const StatusSchema = z.enum(['active', 'draft', 'sold_out']);
const SlugSchema = z.string().trim().min(3).max(40);
const LocaleSchema = z.string().refine(isLocale, 'invalid locale');

const ProductFieldsSchema = z.object({
  title: TitleSchema,
  description: z.string().trim().max(800).optional().default(''),
  priceQar: z
    .union([z.number().nonnegative().max(99_999_999), z.literal(null)])
    .optional()
    .default(null),
  pricingMode: z.enum(['one_time', 'monthly_payment']).optional().default('one_time'),
  monthlyPriceQar: z
    .union([z.number().nonnegative().max(99_999_999), z.literal(null)])
    .optional()
    .default(null),
  imageUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
  // Legacy free-text label. Still accepted from older clients but the
  // canonical category data lives in `categoryIds` (see migration 011).
  category: z.string().trim().max(80).optional().default(''),
  // Picker output: ids of every category linked to this product. The
  // server replaces the join rows in `setProductCategories`, which also
  // rewrites `products.category` to the first selected name so legacy
  // storefront surfaces (Menu, homepage chips) keep matching.
  categoryIds: z.array(z.string().uuid()).max(20).optional().default([]),
  eventAt: z.string().trim().optional().default(''),
  status: StatusSchema.default('active'),
  isCustomizable: z.boolean().optional().default(false),
  customizationLabel: z.string().trim().max(48).optional().default(''),
  requiresHeightInput: z.boolean().optional().default(false),
  heightInputLabel: z.string().trim().max(40).optional().default(''),
  heightOptions: z
    .preprocess(
      (value) => normalizeHeightOptions(value),
      z.array(z.string().trim().max(40)).max(MAX_PRODUCT_SIZE_OPTIONS),
    )
    .optional()
    .default([]),
  allowCustomSize: z.boolean().optional().default(false),
  sizeOptions: z
    .preprocess(
      (value) => normalizeSizeOptions(value),
      z.array(z.string().trim().max(40)).max(MAX_PRODUCT_SIZE_OPTIONS),
    )
    .optional()
    .default([]),
});

const CreateSchema = ProductFieldsSchema.extend({
  slug: SlugSchema,
  locale: LocaleSchema,
});

const UpdateSchema = CreateSchema.extend({
  id: z.string().uuid(),
});

const DeleteSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema,
  id: z.string().uuid(),
});

const ReorderSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema,
  orderedIds: z.array(z.string().uuid()).max(500),
});

export type CreateProductInput = z.input<typeof CreateSchema>;
export type UpdateProductInput = z.input<typeof UpdateSchema>;
export type DeleteProductInput = z.input<typeof DeleteSchema>;
export type ReorderProductsInput = z.input<typeof ReorderSchema>;

export type ProductActionState =
  | { status: 'idle' }
  | { status: 'success'; product?: Product }
  | { status: 'error'; message: string; field?: string };

const ImportRowSchema = z.object({
  title: TitleSchema,
  description: z.string().trim().max(800).optional().default(''),
  priceQar: z
    .union([z.number().nonnegative().max(99_999_999), z.literal(null)])
    .optional()
    .default(null),
  imageUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
  sourceUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
  category: z.string().trim().max(80).optional().default(''),
  status: StatusSchema.optional().default('active'),
});

const ImportProductsSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema,
  rows: z.array(ImportRowSchema).min(1).max(200),
});

const ImportWebsiteSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema,
  url: z.string().trim().url(),
});

export type ImportProductsInput = z.input<typeof ImportProductsSchema>;
export type ImportWebsiteProductsInput = z.input<typeof ImportWebsiteSchema>;

export type ProductImportState =
  | { status: 'success'; count: number }
  | { status: 'error'; message: string; field?: string };

function rateGate(scope: string, limit = 60): { ok: true } | { ok: false } {
  return { ok: rateLimit(scope, limit, 60_000).ok };
}

function buildPayload(parsed: z.infer<typeof ProductFieldsSchema>): ProductWriteInput {
  let eventAt: Date | null = null;
  if (parsed.eventAt) {
    const d = new Date(parsed.eventAt);
    if (!Number.isNaN(d.getTime())) eventAt = d;
  }
  const heightOptions = parsed.requiresHeightInput
    ? normalizeHeightOptions(parsed.heightOptions)
    : [];
  return {
    title: parsed.title,
    description: parsed.description ? parsed.description : null,
    priceQar: typeof parsed.priceQar === 'number' ? parsed.priceQar : null,
    pricingMode: parsed.pricingMode,
    monthlyPriceQar:
      parsed.pricingMode === 'monthly_payment' && typeof parsed.monthlyPriceQar === 'number'
        ? parsed.monthlyPriceQar
        : null,
    imageUrl: parsed.imageUrl ? parsed.imageUrl : null,
    category: parsed.category ? parsed.category : null,
    eventAt,
    status: parsed.status,
    isCustomizable: parsed.isCustomizable === true,
    customizationLabel:
      parsed.isCustomizable && parsed.customizationLabel ? parsed.customizationLabel : null,
    sizeOptions: normalizeSizeOptions(parsed.sizeOptions),
    allowCustomSize:
      parsed.allowCustomSize === true && normalizeSizeOptions(parsed.sizeOptions).length > 0,
    requiresHeightInput: parsed.requiresHeightInput === true,
    heightInputLabel:
      parsed.requiresHeightInput && parsed.heightInputLabel
        ? normalizeHeightInputLabel(parsed.heightInputLabel)
        : null,
    heightOptions:
      parsed.requiresHeightInput && heightOptions.length > 0
        ? heightOptions
        : parsed.requiresHeightInput
          ? DEFAULT_PRODUCT_HEIGHT_OPTIONS
          : [],
  };
}

function importPayload(row: z.infer<typeof ImportRowSchema>, source: string): ProductWriteInput {
  return {
    title: row.title,
    description: row.description ? row.description : null,
    priceQar: typeof row.priceQar === 'number' ? row.priceQar : null,
    pricingMode: 'one_time',
    monthlyPriceQar: null,
    imageUrl: row.imageUrl ? row.imageUrl : null,
    category: row.category ? row.category : null,
    eventAt: null,
    status: row.status,
    isCustomizable: false,
    customizationLabel: null,
    sizeOptions: [],
    allowCustomSize: false,
    requiresHeightInput: false,
    heightInputLabel: null,
    heightOptions: [],
    source,
    sourceUrl: row.sourceUrl ? row.sourceUrl : null,
  };
}

function normalizeImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseCsvRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function importRowsFromRecords(records: string[][]): z.infer<typeof ImportRowSchema>[] {
  const meaningful = records.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (meaningful.length < 2) return [];
  const headers = meaningful[0]!.map((cell) => normalizeImportHeader(String(cell ?? '')));
  const get = (record: string[], ...names: string[]) => {
    for (const name of names.map(normalizeImportHeader)) {
      const idx = headers.indexOf(name);
      if (idx >= 0) return String(record[idx] ?? '').trim();
    }
    return '';
  };
  const rows: z.infer<typeof ImportRowSchema>[] = [];
  for (const record of meaningful.slice(1)) {
    const title =
      get(record, 'title', 'name', 'product', 'product_name_en_update', 'product_name_en') ||
      get(record, 'product_name_ar_update', 'product_name_ar');
    if (!title) continue;
    const description =
      get(
        record,
        'description',
        'body',
        'product_description_en_update',
        'product_description_en',
      ) || get(record, 'product_description_ar_update', 'product_description_ar');
    const imageUrl = get(record, 'image_url', 'image', 'picture', 'photo');
    const sourceUrl = get(record, 'product_url', 'source_url', 'url', 'link');
    const category = get(record, 'category', 'collection', 'type');
    const priceRaw = get(record, 'price_qar', 'price', 'qar', 'amount', 'price_global_update');
    const statusRaw = get(record, 'status').toLowerCase();
    const status =
      statusRaw === 'draft' || statusRaw === 'sold_out' || statusRaw === 'active'
        ? statusRaw
        : 'active';
    const parsed = ImportRowSchema.safeParse({
      title,
      description,
      priceQar: numericPrice(priceRaw),
      imageUrl,
      sourceUrl,
      category,
      status,
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.slice(0, 200);
}

function importRowsFromCsv(input: string): z.infer<typeof ImportRowSchema>[] {
  return importRowsFromRecords(parseCsvRecords(input));
}

function importRowsFromWorkbook(buffer: ArrayBuffer): z.infer<typeof ImportRowSchema>[] {
  const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  const records = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  });
  return importRowsFromRecords(records);
}

function textBetween(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  return decodeHtml(match[1].trim());
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function numericPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function absoluteUrl(value: unknown, base: string): string {
  if (typeof value !== 'string' || value.trim() === '') return '';
  try {
    return new URL(value.trim(), base).toString();
  } catch {
    return '';
  }
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const obj = value as Record<string, unknown>;
  const graph = Array.isArray(obj['@graph']) ? flattenJsonLd(obj['@graph']) : [];
  return [obj, ...graph];
}

function isProductNode(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type.toLowerCase().includes('product');
  if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase().includes('product'));
  return false;
}

function rowFromJsonLd(node: Record<string, unknown>, baseUrl: string) {
  const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const offer = offers && typeof offers === 'object' ? (offers as Record<string, unknown>) : {};
  const imageRaw = Array.isArray(node.image) ? node.image[0] : node.image;
  return ImportRowSchema.safeParse({
    title: typeof node.name === 'string' ? node.name : '',
    description: typeof node.description === 'string' ? node.description : '',
    priceQar: numericPrice(offer.price ?? offer.lowPrice ?? node.price),
    imageUrl: absoluteUrl(imageRaw, baseUrl),
    sourceUrl: baseUrl,
    category: typeof node.category === 'string' ? node.category : '',
    status: 'active',
  });
}

async function scrapeProductPage(url: string): Promise<z.infer<typeof ImportRowSchema>[]> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Souqna product importer (+https://souqna.qa)',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`website returned ${response.status}`);
  const html = (await response.text()).slice(0, 2_000_000);
  const rows: z.infer<typeof ImportRowSchema>[] = [];

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const nodes = flattenJsonLd(JSON.parse(match[1] ?? 'null')).filter(isProductNode);
      for (const node of nodes) {
        const parsed = rowFromJsonLd(node, url);
        if (parsed.success) rows.push(parsed.data);
      }
    } catch {
      /* ignore invalid JSON-LD blocks */
    }
  }

  if (rows.length > 0) return rows;

  const title =
    textBetween(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    '';
  const description =
    textBetween(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    textBetween(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    '';
  const image = textBetween(
    html,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  const price =
    textBetween(
      html,
      /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
    ) ?? textBetween(html, /<meta[^>]+name=["']price["'][^>]+content=["']([^"']+)["']/i);

  const parsed = ImportRowSchema.safeParse({
    title,
    description,
    priceQar: numericPrice(price),
    imageUrl: absoluteUrl(image, url),
    sourceUrl: url,
    category: '',
    status: 'active',
  });
  return parsed.success ? [parsed.data] : [];
}

function productMetadata(product: Product): Record<string, unknown> {
  return {
    priceQar: product.priceQar,
    pricingMode: product.pricingMode,
    monthlyPriceQar: product.monthlyPriceQar,
    status: product.status,
    category: product.category,
    imageUrl: product.imageUrl,
    isCustomizable: product.isCustomizable,
    customizationLabel: product.customizationLabel,
    sizeOptions: product.sizeOptions,
    allowCustomSize: product.allowCustomSize,
    requiresHeightInput: product.requiresHeightInput,
    heightInputLabel: product.heightInputLabel,
    heightOptions: product.heightOptions,
    position: product.position,
  };
}

async function recordProductActivity(input: {
  kind: string;
  actorClerkUserId: string;
  ownerClerkUserId: string;
  storefrontSlug: string;
  product?: Product;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordPulseActivity({
    source: 'products',
    kind: input.kind,
    actorClerkUserId: input.actorClerkUserId,
    ownerClerkUserId: input.ownerClerkUserId,
    storefrontSlug: input.storefrontSlug,
    resourceType: 'product',
    resourceId: input.product?.id ?? null,
    title: input.product?.title ?? null,
    summary: input.summary,
    metadata: {
      ...(input.product ? productMetadata(input.product) : {}),
      ...(input.metadata ?? {}),
    },
  });
}

async function gate(slug: string) {
  if (!hasDb()) return null;
  const { userId } = await auth();
  return assertStorefrontOwner(slug, userId);
}

async function gateProductCap(
  slug: string,
  ownerClerkUserId: string,
  incomingCount: number,
): Promise<{ status: 'error'; message: string; field?: string } | null> {
  const plan = await getPlan(ownerClerkUserId);
  const existing = await countMerchantProducts(slug);
  return productCapFailure(plan, existing, incomingCount);
}

export async function createProduct(input: CreateProductInput): Promise<ProductActionState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    const locale = isLocale(input.locale) ? (input.locale as Locale) : 'en';
    const t = getCopy(locale).products.form;
    const titleErr = parsed.error.flatten().fieldErrors.title;
    if (titleErr?.length) {
      return { status: 'error', message: t.error.titleRequired, field: 'title' };
    }
    return { status: 'error', message: t.error.generic };
  }
  const data = parsed.data;
  const t = getCopy(data.locale as Locale).products.form;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-create:${ip}`).ok) {
    return { status: 'error', message: t.error.generic };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  const capError = await gateProductCap(data.slug, owner.clerkUserId, 1);
  if (capError) return capError;
  if (data.pricingMode === 'monthly_payment' && !planUnlocksMonthlyPayments(plan)) {
    return {
      status: 'error',
      message: 'Monthly-payment pricing is available on Max+.',
      field: 'pricingMode',
    };
  }

  try {
    const product = await insertProduct(data.slug, buildPayload(data));
    // Always rewrite the join rows; this also keeps the legacy
    // `products.category` text column in sync (= first selected name
    // or null when the picker is empty).
    await setProductCategories(data.slug, product.id, data.categoryIds ?? []);
    void recordProductActivity({
      kind: 'product.created',
      actorClerkUserId: owner.clerkUserId,
      ownerClerkUserId: owner.clerkUserId,
      storefrontSlug: data.slug,
      product,
      summary: `Created product ${product.title}`,
      metadata: { categoryIds: data.categoryIds ?? [] },
    });
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success', product };
  } catch (err) {
    console.error('[createProduct] insert failed', err);
    return { status: 'error', message: t.error.generic };
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<ProductActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    const locale = isLocale(input.locale) ? (input.locale as Locale) : 'en';
    const t = getCopy(locale).products.form;
    const titleErr = parsed.error.flatten().fieldErrors.title;
    if (titleErr?.length) {
      return { status: 'error', message: t.error.titleRequired, field: 'title' };
    }
    return { status: 'error', message: t.error.generic };
  }
  const data = parsed.data;
  const t = getCopy(data.locale as Locale).products.form;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-update:${ip}`).ok) {
    return { status: 'error', message: t.error.generic };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const plan = await getPlan(owner.clerkUserId);
  if (data.pricingMode === 'monthly_payment' && !planUnlocksMonthlyPayments(plan)) {
    return {
      status: 'error',
      message: 'Monthly-payment pricing is available on Max+.',
      field: 'pricingMode',
    };
  }

  try {
    const product = await updateProductRow(data.slug, data.id, buildPayload(data));
    if (!product) return { status: 'error', message: t.error.generic };
    // Always rewrite the join rows: an empty array clears categories.
    await setProductCategories(data.slug, product.id, data.categoryIds ?? []);
    void recordProductActivity({
      kind: 'product.updated',
      actorClerkUserId: owner.clerkUserId,
      ownerClerkUserId: owner.clerkUserId,
      storefrontSlug: data.slug,
      product,
      summary: `Updated product ${product.title}`,
      metadata: { categoryIds: data.categoryIds ?? [] },
    });
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success', product };
  } catch (err) {
    console.error('[updateProduct] update failed', err);
    return { status: 'error', message: t.error.generic };
  }
}

export async function deleteProduct(input: DeleteProductInput): Promise<ProductActionState> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) {
    const locale = isLocale(input.locale) ? (input.locale as Locale) : 'en';
    return { status: 'error', message: getCopy(locale).products.form.error.generic };
  }
  const data = parsed.data;
  const t = getCopy(data.locale as Locale).products.form;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-delete:${ip}`, 30).ok) {
    return { status: 'error', message: t.error.generic };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const product = await deleteProductRowWithSnapshot(data.slug, data.id);
    if (!product) return { status: 'error', message: t.error.generic };
    await recordProductActivity({
      kind: 'product.deleted',
      actorClerkUserId: owner.clerkUserId,
      ownerClerkUserId: owner.clerkUserId,
      storefrontSlug: data.slug,
      product,
      summary: `Deleted product ${product.title}`,
    });
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success' };
  } catch (err) {
    console.error('[deleteProduct] delete failed', err);
    return { status: 'error', message: t.error.generic };
  }
}

const DuplicateSchema = z.object({
  slug: SlugSchema,
  id: z.string().uuid(),
});

export type DuplicateProductInput = z.input<typeof DuplicateSchema>;

/**
 * Clone an existing product into the same storefront. The duplicate is
 * appended to the end of the catalogue with a `(copy)` title suffix and
 * `status = 'draft'` so it never accidentally surfaces on the live
 * storefront before the founder has reviewed it.
 *
 * Re-uses `getProduct` + `insertProduct` so the new row picks up a fresh
 * id, position, and timestamps without us having to write a CTE.
 */
export async function duplicateProduct(input: DuplicateProductInput): Promise<ProductActionState> {
  const parsed = DuplicateSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request.' };
  const { slug, id } = parsed.data;
  const owner = await gate(slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  const { getProduct } = await import('@/lib/products');
  const source = await getProduct(slug, id);
  if (!source) return { status: 'error', message: 'Product not found.' };
  const capError = await gateProductCap(slug, owner.clerkUserId, 1);
  if (capError) return capError;

  try {
    const dup = await insertProduct(slug, {
      title: `${source.title} (copy)`,
      description: source.description,
      priceQar: source.priceQar,
      pricingMode: source.pricingMode,
      monthlyPriceQar: source.monthlyPriceQar,
      imageUrl: source.imageUrl,
      category: source.category,
      eventAt: source.eventAt,
      status: 'draft',
      isCustomizable: source.isCustomizable,
      customizationLabel: source.customizationLabel,
      sizeOptions: source.sizeOptions,
      allowCustomSize: source.allowCustomSize,
      requiresHeightInput: source.requiresHeightInput,
      heightInputLabel: source.heightInputLabel,
      heightOptions: source.heightOptions,
    });
    await recordProductActivity({
      kind: 'product.duplicated',
      actorClerkUserId: owner.clerkUserId,
      ownerClerkUserId: owner.clerkUserId,
      storefrontSlug: slug,
      product: dup,
      summary: `Duplicated product ${source.title}`,
      metadata: { sourceProductId: source.id },
    });
    revalidatePath('/account/products');
    revalidatePath(`/brief/${slug}`);
    return { status: 'success', product: dup };
  } catch (err) {
    console.error('[duplicateProduct] failed', err);
    return { status: 'error', message: 'Duplicate failed.' };
  }
}

const BulkDeleteSchema = z.object({
  slug: SlugSchema,
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export type BulkDeleteInput = z.input<typeof BulkDeleteSchema>;

export async function bulkDeleteProducts(
  input: BulkDeleteInput,
): Promise<{ status: 'success'; deleted: number } | { status: 'error'; message: string }> {
  const parsed = BulkDeleteSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request.' };
  const { slug, ids } = parsed.data;
  const owner = await gate(slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  let deleted = 0;
  for (const id of ids) {
    const product = await deleteProductRowWithSnapshot(slug, id);
    if (product) {
      deleted++;
      await recordProductActivity({
        kind: 'product.deleted',
        actorClerkUserId: owner.clerkUserId,
        ownerClerkUserId: owner.clerkUserId,
        storefrontSlug: slug,
        product,
        summary: `Deleted product ${product.title}`,
        metadata: { bulk: true },
      });
    }
  }
  revalidatePath('/account/products');
  revalidatePath(`/brief/${slug}`);
  return { status: 'success', deleted };
}

export async function importProducts(input: ImportProductsInput): Promise<ProductImportState> {
  const parsed = ImportProductsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Check the CSV columns and try again.', field: 'csv' };
  }
  const data = parsed.data;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-import:${ip}`, 12).ok) {
    return { status: 'error', message: 'Too many imports. Try again in a moment.' };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  const capError = await gateProductCap(data.slug, owner.clerkUserId, data.rows.length);
  if (capError) return { status: 'error', message: capError.message, field: 'csv' };

  try {
    let count = 0;
    for (const row of data.rows) {
      const product = await insertProduct(data.slug, importPayload(row, 'csv_import'));
      count++;
      await recordProductActivity({
        kind: 'product.imported',
        actorClerkUserId: owner.clerkUserId,
        ownerClerkUserId: owner.clerkUserId,
        storefrontSlug: data.slug,
        product,
        summary: `Imported product ${product.title}`,
        metadata: { source: 'csv_import' },
      });
    }
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success', count };
  } catch (err) {
    console.error('[importProducts] failed', err);
    return { status: 'error', message: 'Could not import products. Check URLs and prices.' };
  }
}

export async function importProductsFile(formData: FormData): Promise<ProductImportState> {
  const slug = String(formData.get('slug') ?? '');
  const locale = String(formData.get('locale') ?? '');
  const file = formData.get('file');
  const parsed = z.object({ slug: SlugSchema, locale: LocaleSchema }).safeParse({ slug, locale });
  if (!parsed.success || !(file instanceof File)) {
    return { status: 'error', message: 'Choose a CSV or XLSX product file.', field: 'file' };
  }
  if (file.size > 5_000_000) {
    return {
      status: 'error',
      message: 'File is too large. Keep imports under 5 MB.',
      field: 'file',
    };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-file-import:${ip}`, 12).ok) {
    return { status: 'error', message: 'Too many imports. Try again in a moment.' };
  }

  const owner = await gate(parsed.data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const name = file.name.toLowerCase();
    const rows =
      name.endsWith('.xlsx') || name.endsWith('.xls')
        ? importRowsFromWorkbook(await file.arrayBuffer())
        : importRowsFromCsv(await file.text());
    if (rows.length === 0) {
      return {
        status: 'error',
        message:
          'No products found. Use title/name or Product Name (En)(Update), plus price/image columns.',
        field: 'file',
      };
    }
    const capError = await gateProductCap(parsed.data.slug, owner.clerkUserId, rows.length);
    if (capError) return { status: 'error', message: capError.message, field: 'file' };

    let count = 0;
    for (const row of rows) {
      const product = await insertProduct(parsed.data.slug, importPayload(row, 'file_import'));
      count++;
      await recordProductActivity({
        kind: 'product.imported',
        actorClerkUserId: owner.clerkUserId,
        ownerClerkUserId: owner.clerkUserId,
        storefrontSlug: parsed.data.slug,
        product,
        summary: `Imported product ${product.title}`,
        metadata: { source: 'file_import', fileName: file.name },
      });
    }
    revalidatePath(`/brief/${parsed.data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${parsed.data.slug}/preview`);
    return { status: 'success', count };
  } catch (err) {
    console.error('[importProductsFile] failed', err);
    return { status: 'error', message: 'Could not import that file. Check the workbook format.' };
  }
}

export async function importProductsFromWebsite(
  input: ImportWebsiteProductsInput,
): Promise<ProductImportState> {
  const parsed = ImportWebsiteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Enter a valid public product URL.', field: 'url' };
  }
  const data = parsed.data;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-website-import:${ip}`, 10).ok) {
    return { status: 'error', message: 'Too many website scans. Try again in a moment.' };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const scraped = await scrapeProductPage(data.url);
    if (!scraped.length) {
      return {
        status: 'error',
        message:
          'No product data found. Try a direct product page, or use CSV with title, price, image_url.',
        field: 'url',
      };
    }
    const rowsToImport = scraped.slice(0, 30);
    const capError = await gateProductCap(data.slug, owner.clerkUserId, rowsToImport.length);
    if (capError) return { status: 'error', message: capError.message, field: 'url' };
    let count = 0;
    for (const row of rowsToImport) {
      const product = await insertProduct(data.slug, importPayload(row, 'website_import'));
      count++;
      await recordProductActivity({
        kind: 'product.imported',
        actorClerkUserId: owner.clerkUserId,
        ownerClerkUserId: owner.clerkUserId,
        storefrontSlug: data.slug,
        product,
        summary: `Imported product ${product.title}`,
        metadata: { source: 'website_import', url: data.url },
      });
    }
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success', count };
  } catch (err) {
    console.error('[importProductsFromWebsite] failed', err);
    return { status: 'error', message: 'Could not read that website. Try CSV instead.' };
  }
}

export async function reorderProducts(input: ReorderProductsInput): Promise<ProductActionState> {
  const parsed = ReorderSchema.safeParse(input);
  if (!parsed.success) {
    const locale = isLocale(input.locale) ? (input.locale as Locale) : 'en';
    return { status: 'error', message: getCopy(locale).products.form.error.generic };
  }
  const data = parsed.data;
  const t = getCopy(data.locale as Locale).products.form;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-reorder:${ip}`, 60).ok) {
    return { status: 'error', message: t.error.generic };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    await reorderProductRows(data.slug, data.orderedIds);
    await recordProductActivity({
      kind: 'product.reordered',
      actorClerkUserId: owner.clerkUserId,
      ownerClerkUserId: owner.clerkUserId,
      storefrontSlug: data.slug,
      summary: `Reordered ${data.orderedIds.length} products`,
      metadata: { count: data.orderedIds.length },
    });
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success' };
  } catch (err) {
    console.error('[reorderProducts] reorder failed', err);
    return { status: 'error', message: t.error.generic };
  }
}

const RemoveDemoSchema = z.object({
  slug: SlugSchema,
});

export type RemoveDemoProductsInput = z.input<typeof RemoveDemoSchema>;

/**
 * Bulk-clear demo product rows seeded by `seedTemplateDemoProducts`.
 * Surfaces as a single "Remove all demo products" button on the
 * /account/products page. Records one summary activity row, not one
 * per deletion, so the audit feed stays readable.
 *
 * Idempotent: when no demo rows exist, returns success with `count: 0`.
 * Real (merchant-authored) products are never touched — the SQL only
 * matches `is_demo = true`.
 */
export async function removeDemoProducts(
  input: RemoveDemoProductsInput,
): Promise<ProductActionState & { count?: number }> {
  const parsed = RemoveDemoSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request.' };
  }
  const data = parsed.data;

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  if (!rateGate(`product-demo-clear:${ip}`, 10).ok) {
    return { status: 'error', message: 'Try again in a moment.' };
  }

  const owner = await gate(data.slug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const removedIds = await deleteDemoProducts(data.slug);
    if (removedIds.length > 0) {
      await recordProductActivity({
        kind: 'products.demo.removed',
        actorClerkUserId: owner.clerkUserId,
        ownerClerkUserId: owner.clerkUserId,
        storefrontSlug: data.slug,
        summary: `Removed ${removedIds.length} sample products`,
        metadata: { count: removedIds.length, ids: removedIds },
      });
    }
    revalidatePath(`/brief/${data.slug}`);
    revalidatePath('/account');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.slug}/preview`);
    return { status: 'success', count: removedIds.length };
  } catch (err) {
    console.error('[removeDemoProducts] delete failed', err);
    return { status: 'error', message: 'Could not remove sample products. Try again.' };
  }
}
