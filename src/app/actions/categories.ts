'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { hasDb } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { assertStorefrontOwner } from '@/lib/products';
import {
  deleteCategoryRow,
  insertCategory,
  reorderCategoryRows,
  slugify,
  uniqueSlug,
  updateCategoryRow,
  type Category,
} from '@/lib/categories';

/**
 * Mirrors src/app/actions/products.ts in shape: every action is gated
 * on `assertStorefrontOwner`, validated with zod, and rate-limited per
 * IP so a runaway client can't hammer the table.
 */

const SlugSchema = z.string().trim().min(3).max(40);
const NameSchema = z.string().trim().min(1).max(80);

const CategoryFieldsSchema = z.object({
  name: NameSchema,
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/i, 'slug-format')
    .optional()
    .default(''),
  description: z.string().trim().max(600).optional().default(''),
  imageUrl: z.string().trim().url().optional().or(z.literal('')).default(''),
});

const CreateSchema = CategoryFieldsSchema.extend({
  storefrontSlug: SlugSchema,
});

const UpdateSchema = CreateSchema.extend({
  id: z.string().uuid(),
});

const DeleteSchema = z.object({
  storefrontSlug: SlugSchema,
  id: z.string().uuid(),
});

const ReorderSchema = z.object({
  storefrontSlug: SlugSchema,
  orderedIds: z.array(z.string().uuid()).max(500),
});

export type CreateCategoryInput = z.input<typeof CreateSchema>;
export type UpdateCategoryInput = z.input<typeof UpdateSchema>;
export type DeleteCategoryInput = z.input<typeof DeleteSchema>;
export type ReorderCategoriesInput = z.input<typeof ReorderSchema>;

export type CategoryActionState =
  | { status: 'idle' }
  | { status: 'success'; category?: Category }
  | { status: 'error'; message: string; field?: string };

function rateGate(scope: string, limit = 60) {
  return { ok: rateLimit(scope, limit, 60_000).ok };
}

async function gate(slug: string) {
  if (!hasDb()) return null;
  const { userId } = await auth();
  return assertStorefrontOwner(slug, userId);
}

async function ipScope(prefix: string) {
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryActionState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    const nameErr = parsed.error.flatten().fieldErrors.name;
    if (nameErr?.length) {
      return { status: 'error', message: 'Name is required.', field: 'name' };
    }
    return { status: 'error', message: 'Could not save category.' };
  }
  const data = parsed.data;

  if (!rateGate(await ipScope('category-create')).ok) {
    return { status: 'error', message: 'Too many requests, try again shortly.' };
  }

  const owner = await gate(data.storefrontSlug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const desired = data.slug ? slugify(data.slug) : slugify(data.name);
    const slug = await uniqueSlug(data.storefrontSlug, desired);
    const category = await insertCategory(data.storefrontSlug, {
      name: data.name,
      slug,
      description: data.description ? data.description : null,
      imageUrl: data.imageUrl ? data.imageUrl : null,
    });
    const { userId } = await auth();
    if (userId) {
      await recordAudit({
        storefrontSlug: data.storefrontSlug,
        clerkUserId: userId,
        action: 'category.create',
        targetId: category.id,
        summary: `Created category "${category.name}"`,
      });
    }
    revalidatePath('/account/products');
    revalidatePath(`/brief/${data.storefrontSlug}`);
    return { status: 'success', category };
  } catch (err) {
    console.error('[createCategory] insert failed', err);
    return { status: 'error', message: 'Could not save category.' };
  }
}

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<CategoryActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Could not update category.' };
  }
  const data = parsed.data;

  if (!rateGate(await ipScope('category-update')).ok) {
    return { status: 'error', message: 'Too many requests, try again shortly.' };
  }

  const owner = await gate(data.storefrontSlug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const desired = data.slug ? slugify(data.slug) : slugify(data.name);
    const slug = await uniqueSlug(data.storefrontSlug, desired, data.id);
    const category = await updateCategoryRow(data.storefrontSlug, data.id, {
      name: data.name,
      slug,
      description: data.description ? data.description : null,
      imageUrl: data.imageUrl ? data.imageUrl : null,
    });
    if (!category) {
      return { status: 'error', message: 'Category not found.' };
    }
    const { userId } = await auth();
    if (userId) {
      await recordAudit({
        storefrontSlug: data.storefrontSlug,
        clerkUserId: userId,
        action: 'category.update',
        targetId: category.id,
        summary: `Updated category "${category.name}"`,
      });
    }
    revalidatePath('/account/products');
    revalidatePath(`/brief/${data.storefrontSlug}`);
    return { status: 'success', category };
  } catch (err) {
    console.error('[updateCategory] update failed', err);
    return { status: 'error', message: 'Could not update category.' };
  }
}

export async function deleteCategory(
  input: DeleteCategoryInput,
): Promise<CategoryActionState> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Could not delete category.' };
  }
  const { storefrontSlug, id } = parsed.data;

  if (!rateGate(await ipScope('category-delete'), 30).ok) {
    return { status: 'error', message: 'Too many requests, try again shortly.' };
  }

  const owner = await gate(storefrontSlug);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const ok = await deleteCategoryRow(storefrontSlug, id);
    if (!ok) return { status: 'error', message: 'Category not found.' };
    const { userId } = await auth();
    if (userId) {
      await recordAudit({
        storefrontSlug,
        clerkUserId: userId,
        action: 'category.delete',
        targetId: id,
        summary: 'Deleted category',
      });
    }
    revalidatePath('/account/products');
    revalidatePath(`/brief/${storefrontSlug}`);
    return { status: 'success' };
  } catch (err) {
    console.error('[deleteCategory] delete failed', err);
    return { status: 'error', message: 'Could not delete category.' };
  }
}

export async function reorderCategories(
  input: ReorderCategoriesInput,
): Promise<CategoryActionState> {
  const parsed = ReorderSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request.' };
  }
  const data = parsed.data;
  if (!rateGate(await ipScope('category-reorder'), 60).ok) {
    return { status: 'error', message: 'Too many requests, try again shortly.' };
  }
  const owner = await gate(data.storefrontSlug);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  try {
    await reorderCategoryRows(data.storefrontSlug, data.orderedIds);
    revalidatePath('/account/products');
    revalidatePath(`/brief/${data.storefrontSlug}`);
    return { status: 'success' };
  } catch (err) {
    console.error('[reorderCategories] reorder failed', err);
    return { status: 'error', message: 'Could not reorder categories.' };
  }
}
