'use server';

import { generateText } from 'ai';
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { env } from '@/lib/env';
import { hasDb } from '@/lib/db';
import { gateAtelierPro } from '@/lib/billing';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import {
  assertStorefrontOwner,
  getAllProducts,
  getProduct,
  insertProduct,
  updateProductRow,
  type Product,
} from '@/lib/products';
import {
  getCategories,
  insertCategory,
  setProductCategories,
  uniqueSlug,
  type Category,
} from '@/lib/categories';
import { getHomePage, ensureHomePage, setPageSeo } from '@/lib/storefrontPages';
import { countOrders as countManualOrders } from '@/lib/orders';
import {
  ORDER_STATUSES as CHECKOUT_ORDER_STATUSES,
  listOrdersForStorefront,
} from '@/lib/checkout-orders';
import {
  SouqyPlanSchema,
  addMessage,
  createConversation,
  extractPlan,
  getConversationById,
  getLatestConversation,
  listMessages,
  updateMessageMetadata,
  type SouqyMessage,
  type SouqyPlan,
} from '@/lib/souqy/chat';

const SlugSchema = z.string().trim().min(3).max(64);
const ConversationIdSchema = z.string().uuid();
const MessageSchema = z.string().trim().min(1).max(1600);
const ChatModeSchema = z.enum(['ask', 'agent']).default('agent');

const GetSchema = z.object({
  storefrontSlug: SlugSchema,
});

const SendSchema = z.object({
  storefrontSlug: SlugSchema,
  conversationId: ConversationIdSchema.optional().nullable(),
  message: MessageSchema,
  mode: ChatModeSchema.optional(),
});

const ApplySchema = z.object({
  storefrontSlug: SlugSchema,
  conversationId: ConversationIdSchema,
  planId: z.string().uuid(),
});

export type SouqyChatMessageDto = {
  id: string;
  role: SouqyMessage['role'];
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type OrderSummary = {
  total: number;
  checkoutTotal: number;
  manualTotal: number;
  checkoutByStatus: Record<string, number>;
};

export type SouqyChatState =
  | {
      status: 'success';
      conversationId: string;
      messages: SouqyChatMessageDto[];
    }
  | { status: 'error'; message: string };

export type SouqySendState =
  | {
      status: 'success';
      conversationId: string;
      messages: SouqyChatMessageDto[];
    }
  | { status: 'error'; message: string };

export type SouqyApplyState =
  | {
      status: 'success';
      conversationId: string;
      messages: SouqyChatMessageDto[];
      applied: {
        productsCreated: number;
        productsUpdated: number;
        categoriesCreated: number;
        seoUpdated: boolean;
      };
    }
  | { status: 'error'; message: string };

function toDto(message: SouqyMessage): SouqyChatMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.createdAt.toISOString(),
  };
}

async function gate(slug: string) {
  if (!hasDb()) return { ok: false as const, message: 'Database unavailable.' };
  const { userId } = await auth();
  if (!userId) return { ok: false as const, message: 'Sign in to use the assistant.' };
  const plan = await gateAtelierPro(userId);
  if (!plan.ok) {
    return {
      ok: false as const,
      message:
        plan.reason === 'paywall'
          ? 'The assistant is available on Pro + and above. Upgrade to use it.'
          : 'Sign in to use the assistant.',
    };
  }
  const storefront = await assertStorefrontOwner(slug, userId);
  if (!storefront) return { ok: false as const, message: 'Forbidden.' };
  return { ok: true as const, userId, storefront };
}

async function rateGate(scope: string, limit: number): Promise<boolean> {
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown';
  return rateLimit(`${scope}:${ip}`, limit, 60_000).ok;
}

async function ownConversation(
  conversationId: string,
  storefrontSlug: string,
  clerkUserId: string,
) {
  const conversation = await getConversationById(conversationId);
  if (
    !conversation ||
    conversation.storefrontSlug !== storefrontSlug ||
    conversation.clerkUserId !== clerkUserId
  ) {
    return null;
  }
  return conversation;
}

async function resolveConversation(
  storefrontSlug: string,
  clerkUserId: string,
  conversationId?: string | null,
) {
  if (conversationId) {
    const owned = await ownConversation(conversationId, storefrontSlug, clerkUserId);
    if (owned) return owned;
  }
  const latest = await getLatestConversation(storefrontSlug, clerkUserId);
  return latest ?? createConversation({ storefrontSlug, clerkUserId, title: 'Assistant chat' });
}

export async function getOrCreateSouqyConversation(
  input: z.input<typeof GetSchema>,
): Promise<SouqyChatState> {
  const parsed = GetSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid storefront.' };
  const owner = await gate(parsed.data.storefrontSlug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  const conversation = await resolveConversation(parsed.data.storefrontSlug, owner.userId);
  const messages = await listMessages(conversation.id);
  return {
    status: 'success',
    conversationId: conversation.id,
    messages: messages.map(toDto),
  };
}

export async function sendSouqyMessage(input: z.input<typeof SendSchema>): Promise<SouqySendState> {
  const parsed = SendSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Ask with a shorter message.' };
  const data = parsed.data;
  const owner = await gate(data.storefrontSlug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  if (!(await rateGate('souqy-chat-send', 20))) {
    return { status: 'error', message: 'Too many assistant messages — try again shortly.' };
  }

  const conversation = await resolveConversation(
    data.storefrontSlug,
    owner.userId,
    data.conversationId,
  );
  await addMessage({
    conversationId: conversation.id,
    role: 'user',
    content: data.message,
    metadata: { mode: data.mode ?? 'agent' },
  });

  const [products, categories, homePage, orderSummary] = await Promise.all([
    getAllProducts(data.storefrontSlug),
    getCategories(data.storefrontSlug),
    getHomePage(data.storefrontSlug),
    getOrderSummary(data.storefrontSlug),
  ]);

  const context = {
    message: data.message,
    storefront: {
      slug: owner.storefront.slug,
      locale: owner.storefront.locale,
      businessName: owner.storefront.businessName,
      businessType: owner.storefront.businessType,
      tagline: owner.storefront.tagline,
    },
    products: products.slice(0, 40),
    categories,
    seo: homePage?.seo ?? { title: null, description: null, image: null },
    orders: orderSummary,
  };

  if ((data.mode ?? 'agent') === 'ask') {
    const content = await askSouqy(context);
    await addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content,
      metadata: { mode: 'ask' },
    });
    const messages = await listMessages(conversation.id);
    return {
      status: 'success',
      conversationId: conversation.id,
      messages: messages.map(toDto),
    };
  }

  const plan = await planWithSouqy(context);

  const content =
    plan.productCreates.length ||
    plan.productUpdates.length ||
    plan.categoryCreates.length ||
    plan.seo
      ? "Here's the plan I'll execute."
      : plan.summary;

  await addMessage({
    conversationId: conversation.id,
    role: 'assistant',
    content,
    metadata: { mode: 'agent', plan },
  });

  const messages = await listMessages(conversation.id);
  return {
    status: 'success',
    conversationId: conversation.id,
    messages: messages.map(toDto),
  };
}

export async function applySouqyPlan(input: z.input<typeof ApplySchema>): Promise<SouqyApplyState> {
  const parsed = ApplySchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid assistant plan.' };
  const data = parsed.data;
  const owner = await gate(data.storefrontSlug);
  if (!owner.ok) return { status: 'error', message: owner.message };
  if (!(await rateGate('souqy-chat-apply', 15))) {
    return { status: 'error', message: 'Too many assistant applies — try again shortly.' };
  }
  const conversation = await ownConversation(
    data.conversationId,
    data.storefrontSlug,
    owner.userId,
  );
  if (!conversation) return { status: 'error', message: 'Conversation not found.' };

  const messages = await listMessages(conversation.id);
  const planMessage = messages.find((message) => {
    const plan = extractPlan(message);
    return plan?.id === data.planId;
  });
  if (!planMessage) return { status: 'error', message: 'Plan not found.' };
  const plan = extractPlan(planMessage);
  if (!plan) return { status: 'error', message: 'Plan is invalid.' };
  if (plan.status === 'applied')
    return { status: 'error', message: 'This plan was already applied.' };

  try {
    const applied = await applyPlan(data.storefrontSlug, owner.userId, plan);
    const appliedPlan: SouqyPlan = { ...plan, status: 'applied' };
    await updateMessageMetadata(planMessage.id, {
      ...planMessage.metadata,
      plan: appliedPlan,
      applied,
    });
    await addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: appliedSummary(applied),
      metadata: { appliedPlanId: plan.id, applied },
    });
    revalidatePath('/account', 'layout');
    revalidatePath('/account/products');
    revalidatePath(`/account/${data.storefrontSlug}/preview`);
    revalidatePath(`/brief/${data.storefrontSlug}`, 'layout');
    const nextMessages = await listMessages(conversation.id);
    return {
      status: 'success',
      conversationId: conversation.id,
      messages: nextMessages.map(toDto),
      applied,
    };
  } catch (err) {
    const failedPlan: SouqyPlan = { ...plan, status: 'error' };
    await updateMessageMetadata(planMessage.id, {
      ...planMessage.metadata,
      plan: failedPlan,
      error: err instanceof Error ? err.message : 'Apply failed.',
    });
    return { status: 'error', message: 'The assistant could not apply that plan.' };
  }
}

async function applyPlan(
  storefrontSlug: string,
  clerkUserId: string,
  plan: SouqyPlan,
): Promise<{
  productsCreated: number;
  productsUpdated: number;
  categoriesCreated: number;
  seoUpdated: boolean;
}> {
  let productsCreated = 0;
  let productsUpdated = 0;
  let categoriesCreated = 0;
  const categoryIndex = await buildCategoryIndex(storefrontSlug);

  for (const item of plan.categoryCreates) {
    const existing = categoryIndex.get(normalizeCategory(item.name));
    if (existing) continue;
    const slug = await uniqueSlug(storefrontSlug, item.name);
    const category = await insertCategory(storefrontSlug, {
      name: item.name,
      slug,
      description: item.description ?? null,
      imageUrl: item.imageUrl ?? null,
    });
    categoryIndex.set(normalizeCategory(category.name), category);
    categoriesCreated += 1;
    await recordAudit({
      storefrontSlug,
      clerkUserId,
      action: 'souqy.category.create',
      targetId: category.id,
      summary: `Assistant created category ${category.name}`,
      meta: { planId: plan.id, slug: category.slug },
    });
  }

  for (const item of plan.productCreates) {
    const categoryIds = await resolveCategoryIds(
      storefrontSlug,
      item.category ?? null,
      categoryIndex,
    );
    const product = await insertProduct(storefrontSlug, {
      title: item.title,
      description: item.description || null,
      priceQar: item.priceQar ?? null,
      imageUrl: item.imageUrl || null,
      category: item.category || null,
      eventAt: null,
      status: item.status ?? 'draft',
    });
    await setProductCategories(storefrontSlug, product.id, categoryIds);
    productsCreated += 1;
    await recordAudit({
      storefrontSlug,
      clerkUserId,
      action: 'souqy.product.create',
      targetId: product.id,
      summary: `Assistant created product ${product.title}`,
      meta: { planId: plan.id, status: product.status, priceQar: product.priceQar },
    });
  }

  for (const patch of plan.productUpdates) {
    const current = await getProduct(storefrontSlug, patch.id);
    if (!current) continue;
    const categoryIds =
      'category' in patch
        ? await resolveCategoryIds(storefrontSlug, patch.category ?? null, categoryIndex)
        : null;
    const product = await updateProductRow(storefrontSlug, patch.id, {
      title: patch.title ?? current.title,
      description: 'description' in patch ? (patch.description ?? null) : current.description,
      priceQar: 'priceQar' in patch ? (patch.priceQar ?? null) : current.priceQar,
      pricingMode: current.pricingMode,
      monthlyPriceQar: current.monthlyPriceQar,
      imageUrl: 'imageUrl' in patch ? patch.imageUrl || null : current.imageUrl,
      category: 'category' in patch ? (patch.category ?? null) : current.category,
      eventAt: current.eventAt,
      status: patch.status ?? current.status,
      isCustomizable: current.isCustomizable,
      customizationLabel: current.customizationLabel,
      sizeOptions: current.sizeOptions,
      allowCustomSize: current.allowCustomSize,
      requiresHeightInput: current.requiresHeightInput,
      heightInputLabel: current.heightInputLabel,
      heightOptions: current.heightOptions,
    });
    if (product) {
      if (categoryIds) await setProductCategories(storefrontSlug, product.id, categoryIds);
      productsUpdated += 1;
      await recordAudit({
        storefrontSlug,
        clerkUserId,
        action: 'souqy.product.update',
        targetId: product.id,
        summary: `Assistant updated product ${product.title}`,
        meta: { planId: plan.id, status: product.status, priceQar: product.priceQar },
      });
    }
  }

  let seoUpdated = false;
  if (plan.seo && (plan.seo.title || plan.seo.description || plan.seo.image)) {
    const home = await ensureHomePage(storefrontSlug);
    const page = await setPageSeo(home.id, {
      title: plan.seo.title ?? home.seo.title,
      description: plan.seo.description ?? home.seo.description,
      image: plan.seo.image ?? home.seo.image,
    });
    seoUpdated = true;
    await recordAudit({
      storefrontSlug,
      clerkUserId,
      action: 'souqy.seo.update',
      targetId: page.id,
      summary: 'Assistant updated home page SEO',
      meta: { planId: plan.id, pageId: page.id },
    });
  }

  return { productsCreated, productsUpdated, categoriesCreated, seoUpdated };
}

function appliedSummary(applied: {
  productsCreated: number;
  productsUpdated: number;
  categoriesCreated: number;
  seoUpdated: boolean;
}) {
  const parts = [];
  if (applied.categoriesCreated)
    parts.push(
      `${applied.categoriesCreated} categor${applied.categoriesCreated === 1 ? 'y' : 'ies'} created`,
    );
  if (applied.productsCreated)
    parts.push(
      `${applied.productsCreated} product${applied.productsCreated === 1 ? '' : 's'} created`,
    );
  if (applied.productsUpdated)
    parts.push(
      `${applied.productsUpdated} product${applied.productsUpdated === 1 ? '' : 's'} updated`,
    );
  if (applied.seoUpdated) parts.push('home SEO updated');
  return parts.length ? `Done — ${parts.join(', ')}.` : 'Done — no changes were needed.';
}

async function getOrderSummary(storefrontSlug: string): Promise<OrderSummary> {
  const [checkout, manualTotal, ...checkoutStatusCounts] = await Promise.all([
    listOrdersForStorefront(storefrontSlug, { limit: 1 }),
    countManualOrders(storefrontSlug),
    ...CHECKOUT_ORDER_STATUSES.map(async (status) => {
      const byStatus = await listOrdersForStorefront(storefrontSlug, { status, limit: 1 });
      return [status, byStatus.total] as const;
    }),
  ]);

  return {
    total: checkout.total + manualTotal,
    checkoutTotal: checkout.total,
    manualTotal,
    checkoutByStatus: Object.fromEntries(checkoutStatusCounts),
  };
}

async function askSouqy(input: {
  message: string;
  storefront: {
    slug: string;
    locale: string;
    businessName: string;
    businessType: string;
    tagline: string | null;
  };
  products: Product[];
  categories: Category[];
  seo: { title: string | null; description: string | null; image: string | null };
  orders: OrderSummary;
}): Promise<string> {
  try {
    const result = await generateText({
      model: env.SOUQY_CHAT_MODEL,
      system: buildAskSystem(),
      messages: [{ role: 'user', content: buildPlannerUser(input) }],
      temperature: 0.45,
      maxOutputTokens: 1200,
      providerOptions: {
        gateway: {
          tags: ['feature:souqy-chat', 'surface:admin', 'mode:ask'],
        },
      },
    });
    const text = result.text.trim();
    if (text) return text.length <= 1800 ? text : `${text.slice(0, 1797).trim()}...`;
  } catch {
    // Keep Ask mode useful during local dev or short Gateway outages.
  }
  return localAskFallback(input);
}

function buildAskSystem(): string {
  return [
    'You are in Ask mode: an advisory store strategist for a Souqna founder.',
    'Ask mode is read-only. Give information, recommendations, ideas, checklists, and tradeoffs only.',
    'Do not produce JSON. Do not stage product/category/SEO mutations. Do not say a change has been made.',
    'If the founder asks you to execute, create, update, publish, rewrite in-place, apply a design, or run a command, tell them to switch to Agent mode and briefly explain what Agent will do.',
    'You may discuss storefront design direction, copy ideas, app suggestions, product strategy, SEO ideas, and customer-experience recommendations.',
    'You may answer order-count and order-status summary questions from the supplied order summary. Do not expose customer PII, order notes, addresses, phone numbers, or individual order details.',
    'Use only the supplied storefront, products, categories, SEO, and order-summary context. If context is missing, say what to check next.',
    'Keep answers concise and practical. Match Arabic if the founder writes Arabic.',
  ].join('\n');
}

function localAskFallback(input: Parameters<typeof askSouqy>[0]): string {
  if (/\border(s)?\b|طلبات|طلب/u.test(input.message.toLowerCase())) {
    const lines = [
      `${input.storefront.businessName} has ${input.orders.total} total order${input.orders.total === 1 ? '' : 's'}.`,
      `${input.orders.checkoutTotal} came through storefront checkout and ${input.orders.manualTotal} are manual/dashboard orders.`,
    ];
    const statusParts = Object.entries(input.orders.checkoutByStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => `${status}: ${count}`);
    if (statusParts.length) lines.push(`Checkout status: ${statusParts.join(', ')}.`);
    return lines.join('\n');
  }

  const productCount = input.products.length;
  const categoryCount = input.categories.length;
  const hasSeo = Boolean(input.seo.title || input.seo.description);
  return [
    `${input.storefront.businessName} has ${productCount} product${productCount === 1 ? '' : 's'} across ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}.`,
    hasSeo
      ? 'Home SEO exists; review whether it still matches your best-selling products and current campaign.'
      : 'Add a focused home SEO title and description so shared links and search previews read clearly.',
    'For execution, switch to Agent mode so it can stage an approval plan instead of only advising.',
  ].join('\n');
}

async function planWithSouqy(input: {
  message: string;
  storefront: {
    slug: string;
    locale: string;
    businessName: string;
    businessType: string;
    tagline: string | null;
  };
  products: Product[];
  categories: Category[];
  seo: { title: string | null; description: string | null; image: string | null };
  orders: OrderSummary;
}): Promise<SouqyPlan> {
  try {
    const result = await generateText({
      model: env.SOUQY_CHAT_MODEL,
      system: buildPlannerSystem(),
      messages: [{ role: 'user', content: buildPlannerUser(input) }],
      temperature: 0.2,
      maxOutputTokens: 1600,
      providerOptions: {
        gateway: {
          tags: ['feature:souqy-chat', 'surface:admin'],
        },
      },
    });
    const parsed = parsePlannerJson(result.text);
    if (parsed) return parsed;
  } catch {
    // Local fallback keeps the review flow usable in dev when Gateway
    // credentials are not present; the founder still has to approve.
  }
  return localPlanFallback(
    input.message,
    input.storefront.locale,
    input.products,
    input.categories,
  );
}

function buildPlannerSystem(): string {
  return [
    'You are in Agent mode: the AI store manager for Souqna.',
    'Return only JSON matching this TypeScript shape:',
    '{"summary":string,"checklist":[{"title":string,"detail":string}],"questions":[{"id":string,"label":string,"detail":string,"options":[{"label":string,"prompt":string}]}],"categoryCreates":[{"name":string,"description":string|null,"imageUrl":string|null}],"productCreates":[],"productUpdates":[],"seo":null}',
    'Agent mode executes founder prompts by staging a concrete approval plan. The founder must still click Apply before database changes happen.',
    'Allowed executable work in this drawer: create/update products, create categories, and draft home page SEO only.',
    'For design, page layout, theme, or builder commands, return a checklist and questions with no mutations, and tell the founder to use the Builder page editor for the final design execution.',
    'Never delete products. Never install apps. Never change orders, checkout, billing, drops, or page layout.',
    'Default new products to status "draft" unless the founder explicitly asks to publish or activate.',
    'For new products, ask for product image URL and category if missing. Offer existing categories and a create-new category option in questions.',
    'Batch add is allowed: return multiple productCreates when the founder names multiple products.',
    'Batch edit is allowed only when products are safely identified by supplied IDs or exact titles from context.',
    'If categoryCreates includes a category, use that exact name in productCreates/category patches that should attach to it.',
    'For product updates, use only product IDs from context. If a match is ambiguous, return no mutations and ask a short follow-up in summary.',
    'Bilingual stores: include natural Arabic/English description text when asked.',
  ].join('\n');
}

function buildPlannerUser(input: Parameters<typeof planWithSouqy>[0]): string {
  const products = input.products.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    priceQar: p.priceQar,
    category: p.category,
    status: p.status,
  }));
  const categories = input.categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c.productCount,
  }));
  return JSON.stringify({
    founderRequest: input.message,
    storefront: input.storefront,
    homeSeo: input.seo,
    orderSummary: input.orders,
    categories,
    products,
  });
}

function parsePlannerJson(text: string): SouqyPlan | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const raw = JSON.parse(cleaned) as unknown;
    const withId = raw && typeof raw === 'object' ? { id: crypto.randomUUID(), ...raw } : raw;
    const parsed = SouqyPlanSchema.safeParse(withId);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function localPlanFallback(
  message: string,
  locale: string,
  products: Product[] = [],
  categories: Category[] = [],
): SouqyPlan {
  const lower = message.toLowerCase();
  const wantsSeo = /\bseo\b|meta|title|description|وصف|عنوان/.test(lower);
  const wantsAbaya = /abaya|abayas|عباي/.test(lower);
  const wantsProductCreate =
    /\b(add|create|new|list)\b/.test(lower) && /\bproduct\b|منتج/.test(lower);
  const wantsProductUpdate =
    /\b(batch edit|edit|update|make|set|change)\b/.test(lower) &&
    /\bproduct|products\b|منتج/.test(lower);
  const imageUrl = extractFirstUrl(message);
  const requestedCategory = extractRequestedCategory(message);
  const requestedStatus = extractRequestedStatus(message);
  if (wantsProductUpdate) {
    const matchedProducts = products.filter((product) =>
      lower.includes(product.title.toLowerCase()),
    );
    if (matchedProducts.length > 0 && (requestedStatus || requestedCategory || imageUrl)) {
      return SouqyPlanSchema.parse({
        id: crypto.randomUUID(),
        summary: `I can batch edit ${matchedProducts.length} product${matchedProducts.length === 1 ? '' : 's'}.`,
        checklist: [
          {
            title: `Update ${matchedProducts.length} product${matchedProducts.length === 1 ? '' : 's'}`,
            detail: matchedProducts.map((p) => p.title).join(', '),
          },
          {
            title: 'Apply selected fields only',
            detail: ['status', requestedCategory ? 'category' : '', imageUrl ? 'image' : '']
              .filter(Boolean)
              .join(' · '),
          },
          { title: 'Ready to review', detail: 'Review the batch edit before applying' },
        ],
        categoryCreates: requestedCategory
          ? [{ name: requestedCategory, description: null, imageUrl: null }]
          : [],
        productCreates: [],
        productUpdates: matchedProducts.map((product) => ({
          id: product.id,
          ...(requestedStatus ? { status: requestedStatus } : {}),
          ...(requestedCategory ? { category: requestedCategory } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        })),
        seo: null,
      });
    }
  }
  const namedProduct = extractRequestedProductTitle(message);
  const batchTitles = wantsProductCreate ? extractBatchProductTitles(message) : [];
  if (wantsProductCreate && (namedProduct || batchTitles.length > 0)) {
    const titles = batchTitles.length > 0 ? batchTitles : namedProduct ? [namedProduct] : [];
    if (!imageUrl || !requestedCategory) {
      return askForProductBasics({
        locale,
        categories,
        productTitles: titles,
        needsImage: !imageUrl,
        needsCategory: !requestedCategory,
      });
    }
    const wantsActive = /\b(publish|active|activate|live)\b|انشر|فعّل/.test(lower);
    return SouqyPlanSchema.parse({
      id: crypto.randomUUID(),
      summary: `I can stage ${titles.length} ${wantsActive ? 'active' : 'draft'} product${titles.length === 1 ? '' : 's'}.`,
      checklist: [
        {
          title: titles.length === 1 ? 'Create product' : `Create ${titles.length} products`,
          detail: titles.join(', '),
        },
        {
          title: 'Draft AR/EN copy',
          detail:
            locale === 'ar'
              ? 'كتابة وصف عربي وإنجليزي مختصر'
              : 'Write short English and Arabic description text',
        },
        { title: 'Attach image and category', detail: `${requestedCategory} · ${imageUrl}` },
        { title: 'Ready to review', detail: 'Apply only after you approve this plan' },
      ],
      categoryCreates: requestedCategory
        ? [{ name: requestedCategory, description: null, imageUrl: null }]
        : [],
      productCreates: titles.map((title) => ({
        title,
        description: `A new product prepared by the assistant for founder review.\nمنتج جديد جهزه المساعد لمراجعة المؤسس.`,
        priceQar: null,
        imageUrl,
        category: requestedCategory,
        status: wantsActive ? 'active' : 'draft',
      })),
      productUpdates: [],
      seo: null,
    });
  }
  if (wantsAbaya) {
    return SouqyPlanSchema.parse({
      id: crypto.randomUUID(),
      summary: 'I can stage three abaya products with Arabic and English copy.',
      checklist: [
        {
          title: 'Create 3 products',
          detail: 'Add abaya names, draft descriptions, and pricing placeholders',
        },
        { title: 'Draft AR/EN copy', detail: 'كتابة وصف بالعربية والإنجليزية' },
        { title: 'Create category', detail: 'Attach products to Abayas' },
        { title: 'Ready to review', detail: 'Review and publish when you are ready' },
      ],
      categoryCreates: [{ name: 'Abayas', description: null, imageUrl: null }],
      productCreates: [
        {
          title: 'Noor Classic Abaya',
          description:
            'A refined everyday abaya with clean lines.\nعباية يومية راقية بقصة هادئة وخطوط أنيقة.',
          priceQar: null,
          category: 'Abayas',
          status: 'draft',
        },
        {
          title: 'Layali Embroidered Abaya',
          description:
            'A soft evening abaya with delicate embroidered accents.\nعباية مسائية ناعمة بتطريز خفيف ولمسة فخمة.',
          priceQar: null,
          category: 'Abayas',
          status: 'draft',
        },
        {
          title: 'Dune Linen Abaya',
          description:
            'A breathable abaya for warm days, designed for effortless movement.\nعباية خفيفة مناسبة للأجواء الدافئة بحركة مريحة.',
          priceQar: null,
          category: 'Abayas',
          status: 'draft',
        },
      ],
      productUpdates: [],
      seo: null,
    });
  }
  if (wantsSeo) {
    return SouqyPlanSchema.parse({
      id: crypto.randomUUID(),
      summary: 'I can stage improved SEO for your home page.',
      checklist: [
        { title: 'Draft SEO title', detail: 'Keep it concise and storefront-specific' },
        {
          title: 'Draft SEO description',
          detail:
            locale === 'ar' ? 'وصف مناسب للبحث والمشاركة' : 'Better search and share preview copy',
        },
        { title: 'Ready to review', detail: 'Apply after you approve' },
      ],
      productCreates: [],
      productUpdates: [],
      seo: {
        title: 'Boutique storefront in Qatar',
        description:
          'Discover a curated Qatar-based storefront with refined products, simple ordering, and bilingual service.',
      },
    });
  }
  return SouqyPlanSchema.parse({
    id: crypto.randomUUID(),
    summary:
      'I can help with products and home page SEO first. Try asking me to add products, rewrite product copy, or improve SEO.',
    checklist: [
      { title: 'No store changes staged', detail: 'Assistant currently supports Products and SEO only' },
    ],
    productCreates: [],
    productUpdates: [],
    seo: null,
  });
}

async function buildCategoryIndex(storefrontSlug: string): Promise<Map<string, Category>> {
  const categories = await getCategories(storefrontSlug);
  return new Map(categories.map((category) => [normalizeCategory(category.name), category]));
}

async function resolveCategoryIds(
  storefrontSlug: string,
  categoryName: string | null,
  categoryIndex: Map<string, Category>,
): Promise<string[]> {
  if (!categoryName) return [];
  const key = normalizeCategory(categoryName);
  const existing = categoryIndex.get(key);
  if (existing) return [existing.id];
  const category = await insertCategory(storefrontSlug, {
    name: categoryName,
    slug: await uniqueSlug(storefrontSlug, categoryName),
    description: null,
    imageUrl: null,
  });
  categoryIndex.set(key, category);
  return [category.id];
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

function askForProductBasics(input: {
  locale: string;
  categories: Category[];
  productTitles: string[];
  needsImage: boolean;
  needsCategory: boolean;
}): SouqyPlan {
  const titleText = input.productTitles.join(', ');
  return SouqyPlanSchema.parse({
    id: crypto.randomUUID(),
    summary: `I can add ${titleText}, but I need ${[
      input.needsImage ? 'a product image URL' : '',
      input.needsCategory ? 'a category' : '',
    ]
      .filter(Boolean)
      .join(' and ')} before staging it.`,
    checklist: [
      {
        title: 'Collect product image',
        detail: 'Paste an image URL so the product is not created blank',
      },
      { title: 'Choose category', detail: 'Pick an existing category or create a new one' },
      {
        title: 'Then stage review plan',
        detail: 'The assistant will still wait for Apply before changing the store',
      },
    ],
    questions: [
      ...(input.needsImage
        ? [
            {
              id: 'product-image',
              label: 'What image should I use?',
              detail: 'Paste a product image URL, or upload one in Files and paste its URL here.',
              options: [],
            },
          ]
        : []),
      ...(input.needsCategory
        ? [
            {
              id: 'product-category',
              label: 'Which category should this go in?',
              detail: 'Choose one, or tell the assistant to create a new category.',
              options: [
                ...input.categories.slice(0, 5).map((category) => ({
                  label: category.name,
                  prompt: `Add ${titleText} with category ${category.name} and image URL `,
                })),
                {
                  label: 'Use Uncategorized',
                  prompt: `Add ${titleText} with category Uncategorized and image URL `,
                },
                {
                  label: 'Create new category',
                  prompt: `Add ${titleText} and create a new category named `,
                },
              ],
            },
          ]
        : []),
    ],
    categoryCreates: [],
    productCreates: [],
    productUpdates: [],
    seo: null,
  });
}

function extractRequestedProductTitle(message: string): string | null {
  const quoted = message.match(/["“”']\s*([^"“”']{1,160}?)\s*["“”']/);
  const named = message.match(/\bnamed\s+([^.,\n]{1,160})/i);
  const raw = quoted?.[1] ?? named?.[1];
  if (!raw) return null;
  const title = raw
    .replace(/\bwith\b.*$/i, '')
    .replace(/\bas\b.*$/i, '')
    .trim();
  return title || null;
}

function extractBatchProductTitles(message: string): string[] {
  const quoted = Array.from(message.matchAll(/["“”']\s*([^"“”']{1,160}?)\s*["“”']/g))
    .map((match) => cleanProductTitle(match[1]))
    .filter(Boolean);
  if (quoted.length > 1) return uniqueStrings(quoted);
  const list = message.match(/products?\s*[:\-]\s*([^.\n]{3,500})/i)?.[1];
  if (!list) return quoted.length === 1 ? quoted : [];
  const beforeDetails = list
    .replace(/\bwith\b.*$/i, '')
    .replace(/\bcategory\b.*$/i, '')
    .replace(/\bimage\b.*$/i, '');
  const titles = beforeDetails
    .split(/,|;|\band\b|\n/i)
    .map(cleanProductTitle)
    .filter((title) => title.length > 0);
  return uniqueStrings(titles);
}

function cleanProductTitle(value: string | undefined): string {
  return (value ?? '')
    .replace(/\bwith\b.*$/i, '')
    .replace(/\bas\b.*$/i, '')
    .trim();
}

function extractFirstUrl(message: string): string | null {
  return message.match(/https?:\/\/[^\s,)]+/i)?.[0] ?? null;
}

function extractRequestedCategory(message: string): string | null {
  const quotedCategory = message.match(/\bcategory\s+["“”']([^"“”']{1,80})["“”']/i)?.[1];
  const namedCategory = message.match(/\bcategory\s+([^.,\n]{1,80})/i)?.[1];
  const createNamed = message.match(/\bnew category named\s+["“”']?([^"“”'.,\n]{1,80})/i)?.[1];
  const raw = quotedCategory ?? createNamed ?? namedCategory;
  if (!raw) return null;
  const cleaned = raw
    .replace(/\band image\b.*$/i, '')
    .replace(/\bwith image\b.*$/i, '')
    .replace(/\bimage\b.*$/i, '')
    .trim();
  return cleaned || null;
}

function extractRequestedStatus(message: string): 'active' | 'draft' | 'sold_out' | null {
  const lower = message.toLowerCase();
  if (/\b(sold out|sold_out|unavailable)\b/.test(lower)) return 'sold_out';
  if (/\b(draft|hide|hidden)\b/.test(lower)) return 'draft';
  if (/\b(active|publish|published|live)\b/.test(lower)) return 'active';
  return null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
