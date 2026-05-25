import 'server-only';
import { list, del } from '@vercel/blob';
import { env } from './env';

/**
 * Lightweight wrapper around the Vercel Blob list/delete APIs scoped to
 * a single storefront's namespace. We deliberately do NOT keep a
 * separate `files` table — the blob store already has everything we
 * need (url, pathname, content type, size, uploadedAt). A DB table
 * would only add a sync surface to bug-fix.
 *
 * Files are stored under `<namespace>/<storefront-slug>/<filename>`.
 * The Files page lists every blob whose pathname starts with
 * `<namespace>/<storefront-slug>/` for the namespaces we care about
 * (logos, products, og-images, brand, banners, builder).
 */

export const STOREFRONT_STORAGE_LIMIT_BYTES = 1_073_741_824; // 1 GiB
export const MAX_UPLOAD_BYTES = 52_428_800; // 50 MB

export const FILE_NAMESPACES = [
  'logos',
  'favicons',
  'products',
  'categories',
  'og-images',
  'banners',
  'brand',
  'builder',
  'storefronts',
  'apps',
  'uploads',
  'misc',
] as const;
export type FileNamespace = (typeof FILE_NAMESPACES)[number];

export type StoredFile = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
  contentType: string | null;
  /** The detected namespace (top folder), e.g. 'logos'. */
  namespace: string;
  /** Just the file name, no path. */
  name: string;
};

function fromBlob(b: {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date | string;
  contentType?: string;
}): StoredFile {
  const parts = b.pathname.split('/');
  const namespace = parts[0] ?? 'misc';
  const name = parts[parts.length - 1] ?? b.pathname;
  return {
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    uploadedAt: b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt),
    contentType: b.contentType ?? null,
    namespace,
    name,
  };
}

/**
 * List every blob owned by a storefront across all namespaces. Returns
 * results sorted newest-first. We page through the blob store with the
 * built-in cursor; in practice a single store rarely has more than a
 * few hundred files.
 */
export async function listFilesForStorefront(
  storefrontSlug: string,
  opts: { limit?: number } = {},
): Promise<StoredFile[]> {
  if (!env.BLOB_READ_WRITE_TOKEN) return [];
  const limit = opts.limit ?? 500;
  const collected: StoredFile[] = [];
  let cursor: string | undefined;
  for (const ns of FILE_NAMESPACES) {
    cursor = undefined;
    const prefix = `${ns}/${storefrontSlug}/`;
    do {
      const page: Awaited<ReturnType<typeof list>> = await list({
        prefix,
        cursor,
        limit: 100,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      for (const b of page.blobs) collected.push(fromBlob(b));
      cursor = page.cursor ?? undefined;
      if (collected.length >= limit) break;
    } while (cursor);
    if (collected.length >= limit) break;
  }
  collected.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  return collected.slice(0, limit);
}

/**
 * Calculates quota usage without the UI listing cap. This is used by the
 * upload-token route before granting a new client upload.
 */
export async function getStorefrontStorageUsedBytes(storefrontSlug: string): Promise<number> {
  if (!env.BLOB_READ_WRITE_TOKEN) return 0;
  let total = 0;
  let cursor: string | undefined;
  for (const ns of FILE_NAMESPACES) {
    cursor = undefined;
    const prefix = `${ns}/${storefrontSlug}/`;
    do {
      const page: Awaited<ReturnType<typeof list>> = await list({
        prefix,
        cursor,
        limit: 100,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      for (const b of page.blobs) total += b.size;
      cursor = page.cursor ?? undefined;
    } while (cursor);
  }
  return total;
}

export function remainingStorefrontStorageBytes(usedBytes: number): number {
  return Math.max(0, STOREFRONT_STORAGE_LIMIT_BYTES - usedBytes);
}

export function isFileNamespace(value: string): value is FileNamespace {
  return (FILE_NAMESPACES as readonly string[]).includes(value);
}

/**
 * Delete a blob by URL. Caller must have already verified ownership
 * (the URL contains the storefront slug in its pathname, but we still
 * gate the server action behind `assertStorefrontOwner`).
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('blob storage is not configured');
  }
  await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
}

/**
 * Returns true when the blob URL appears to belong to the given store.
 * Used as a cheap cross-check before the actual ownership assertion.
 */
export function urlBelongsToStorefront(url: string, storefrontSlug: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes(`/${storefrontSlug}/`);
  } catch {
    return false;
  }
}
