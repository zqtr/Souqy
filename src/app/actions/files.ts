'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { assertStorefrontOwner } from '@/lib/products';
import {
  STOREFRONT_STORAGE_LIMIT_BYTES,
  deleteFileByUrl,
  getStorefrontStorageUsedBytes,
  listFilesForStorefront,
  urlBelongsToStorefront,
} from '@/lib/files';
import { recordAudit } from '@/lib/audit';

/**
 * Server action for the Files page. Upload itself goes through the
 * existing client-token route at `/api/upload-blob` (no action call
 * needed); delete + audit live here so the dashboard can guard on
 * ownership and log the action.
 */

export type FileActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const DeleteSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  url: z.string().trim().url().max(2048),
});

const ListSchema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
});

export type SerializedStorefrontFile = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  contentType: string | null;
  namespace: string;
  name: string;
};

export type StorefrontStorageLibraryState =
  | {
      status: 'success';
      files: SerializedStorefrontFile[];
      usedBytes: number;
      limitBytes: number;
    }
  | { status: 'error'; message: string };

export async function getStorefrontStorageLibrary(
  input: z.input<typeof ListSchema>,
): Promise<StorefrontStorageLibraryState> {
  const parsed = ListSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };

  try {
    const files = await listFilesForStorefront(parsed.data.storefrontSlug, { limit: 1000 });
    return {
      status: 'success',
      files: files.map(serializeFile),
      usedBytes: await getStorefrontStorageUsedBytes(parsed.data.storefrontSlug),
      limitBytes: STOREFRONT_STORAGE_LIMIT_BYTES,
    };
  } catch (err) {
    console.error('[files/list] blob list failed', err);
    return { status: 'error', message: 'Could not load storage files.' };
  }
}

export async function deleteStorefrontFile(
  input: z.input<typeof DeleteSchema>,
): Promise<FileActionState> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Invalid request' };

  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  if (!urlBelongsToStorefront(parsed.data.url, parsed.data.storefrontSlug)) {
    return { status: 'error', message: 'This file is not owned by this store.' };
  }

  try {
    await deleteFileByUrl(parsed.data.url);
  } catch (err) {
    console.error('[files/delete] blob delete failed', err);
    return { status: 'error', message: 'Delete failed. Try again.' };
  }

  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'file.delete',
    summary: `Deleted file ${parsed.data.url.split('/').pop() ?? ''}`,
  });
  revalidatePath('/account/settings/files');
  revalidatePath('/account/storage-library');
  return { status: 'success' };
}

function serializeFile(file: Awaited<ReturnType<typeof listFilesForStorefront>>[number]) {
  return {
    url: file.url,
    pathname: file.pathname,
    size: file.size,
    uploadedAt: file.uploadedAt.toISOString(),
    contentType: file.contentType,
    namespace: file.namespace,
    name: file.name,
  };
}
