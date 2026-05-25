import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { assertStorefrontOwner, getAllProducts } from '@/lib/products';

/**
 * CSV export of the catalogue for a single storefront. Auth-gated by
 * Clerk + the existing per-storefront ownership check; non-owners get
 * a 403 with no row leakage.
 *
 * Columns mirror `ProductWriteInput` so a CSV produced here can be
 * round-tripped through a future CSV importer without remapping. Each
 * cell is RFC-4180 quoted; embedded quotes are doubled.
 */
function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? v.toString() : v;
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const url = new URL(request.url);
  const slug = url.searchParams.get('store')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'store param required' }, { status: 400 });
  }
  const owner = await assertStorefrontOwner(slug, userId);
  if (!owner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const products = await getAllProducts(slug);

  const header = [
    'id',
    'title',
    'description',
    'price_qar',
    'image_url',
    'category',
    'event_at',
    'status',
    'position',
  ];
  const lines = [header.join(',')];
  for (const p of products) {
    lines.push(
      [
        csvEscape(p.id),
        csvEscape(p.title),
        csvEscape(p.description),
        csvEscape(p.priceQar),
        csvEscape(p.imageUrl),
        csvEscape(p.category),
        csvEscape(p.eventAt ? p.eventAt.toISOString() : null),
        csvEscape(p.status),
        csvEscape(p.position),
      ].join(','),
    );
  }
  const body = lines.join('\n') + '\n';
  const filename = `souqna-${slug}-products-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
