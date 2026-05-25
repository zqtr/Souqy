import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_HOST_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
  '.replicate.delivery',
  '.fal.media',
  '.ideogram.ai',
];

const ALLOWED_HOSTS = new Set([
  'replicate.delivery',
  'v3.fal.media',
  'fal.media',
  'ideogram.ai',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get('url');
  const filename = sanitizeFilename(url.searchParams.get('filename') ?? 'souqy-output.webp');
  if (!source) {
    return NextResponse.json({ status: 'error', message: 'Missing asset URL.' }, { status: 400 });
  }

  let assetUrl: URL;
  try {
    assetUrl = new URL(source);
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid asset URL.' }, { status: 400 });
  }

  if (assetUrl.protocol !== 'https:' || !isAllowedAssetHost(assetUrl.hostname)) {
    return NextResponse.json({ status: 'error', message: 'Unsupported asset host.' }, { status: 400 });
  }

  const response = await fetch(assetUrl, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) {
    return NextResponse.json(
      { status: 'error', message: `Could not download asset (${response.status}).` },
      { status: 502 },
    );
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const body = await response.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      'Cache-Control': 'private, max-age=0, no-store',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': contentType,
    },
  });
}

function isAllowedAssetHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.has(host) || ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
  return cleaned || 'souqy-output.webp';
}
