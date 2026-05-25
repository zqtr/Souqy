import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { assertStorefrontOwner } from '@/lib/products';
import {
  MAX_UPLOAD_BYTES,
  getStorefrontStorageUsedBytes,
  isFileNamespace,
  remainingStorefrontStorageBytes,
} from '@/lib/files';

/**
 * Single client-upload endpoint for dashboard assets. Paths must be
 * store-scoped as `<namespace>/<storefront-slug>/<filename>` so quota,
 * ownership, and the Storage library all agree on the same source of
 * truth.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'blob_not_configured' }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseUploadPayload(clientPayload);
        const safePath = sanitizeStorefrontPath(pathname);
        const normalizedPath = pathname.split('/').filter(Boolean).join('/');
        const [namespace, storefrontSlug] = safePath.split('/');

        if (normalizedPath !== safePath || !namespace || !storefrontSlug || !isFileNamespace(namespace)) {
          throw new Error('invalid_upload_path');
        }
        if (payload.storefrontSlug && payload.storefrontSlug !== storefrontSlug) {
          throw new Error('storefront_mismatch');
        }
        if (!Number.isFinite(payload.size) || payload.size <= 0) {
          throw new Error('upload_size_required');
        }
        if (payload.size > MAX_UPLOAD_BYTES) {
          throw new Error('upload_too_large');
        }

        const { userId } = await auth();
        const owner = await assertStorefrontOwner(storefrontSlug, userId);
        if (!owner) throw new Error('forbidden');

        const usedBytes = await getStorefrontStorageUsedBytes(storefrontSlug);
        const remainingBytes = remainingStorefrontStorageBytes(usedBytes);
        if (payload.size > remainingBytes) {
          throw new Error('storage_quota_exceeded');
        }

        return {
          allowedContentTypes: [
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
            'image/svg+xml',
            'image/x-icon',
            'image/vnd.microsoft.icon',
          ],
          maximumSizeInBytes: Math.min(MAX_UPLOAD_BYTES, remainingBytes),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            namespace,
            storefrontSlug,
            path: safePath,
            size: payload.size,
          }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: we persist URLs via the createBrief / updateStorefront /
        // createProduct / updateProduct server actions, never here.
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    console.error('[upload-blob] handleUpload error', err);
    return NextResponse.json({ error: errorCode(err) }, { status: 400 });
  }
}

type UploadPayload = {
  storefrontSlug?: string;
  size: number;
};

function parseUploadPayload(value: string | null | undefined): UploadPayload {
  if (!value) return { size: Number.NaN };
  try {
    const parsed = JSON.parse(value) as Partial<UploadPayload>;
    return {
      storefrontSlug:
        typeof parsed.storefrontSlug === 'string'
          ? sanitizeSegment(parsed.storefrontSlug)
          : undefined,
      size: typeof parsed.size === 'number' ? parsed.size : Number(parsed.size),
    };
  } catch {
    return { size: Number.NaN };
  }
}

function sanitizeStorefrontPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const namespace = sanitizeSegment(parts[0] ?? 'uploads');
  const storefrontSlug = sanitizeSegment(parts[1] ?? '');
  const rest = parts.slice(2).map(sanitizeSegment).filter(Boolean);
  const filename = rest.length > 0 ? rest.join('/') : 'asset';
  return `${namespace}/${storefrontSlug}/${filename}`.slice(0, 220);
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

function errorCode(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'upload_failed';
}
