import { put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function fetchAndStoreImage(opts: {
  imageUrl: string;
  storefrontSlug: string;
  productId: string;
}): Promise<string | null> {
  try {
    const res = await fetch(opts.imageUrl);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!ALLOWED.has(ct)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    const ext = ct === 'image/jpeg' ? 'jpg' : ct === 'image/webp' ? 'webp' : 'png';
    const path = `storefronts/${opts.storefrontSlug}/products/${opts.productId}/cover.${ext}`;
    const blob = await put(path, buf, { access: 'public', contentType: ct });
    return blob.url;
  } catch {
    return null;
  }
}
