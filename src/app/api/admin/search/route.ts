import { NextResponse } from 'next/server';
import { getAdminUserId } from '@/lib/adminAuth';
import { getStorefrontsForUser } from '@/lib/brief';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductRow = {
  id: string;
  storefront_slug: string;
  title: string;
  category: string | null;
  status: string;
  business_name: string;
};

type OrderRow = {
  id: string;
  storefront_slug: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  order_status: string;
  payment_status: string;
  total_qar: number | string;
  currency: string;
  business_name: string;
};

type CustomerRow = {
  id: number;
  storefront_slug: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  order_count: number;
  business_name: string;
};

function regexFromQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

export async function GET(req: Request): Promise<Response> {
  const userId = await getAdminUserId('api/admin/search');
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 2) {
    return NextResponse.json({ products: [], orders: [], customers: [] });
  }

  const storefronts = await getStorefrontsForUser(userId);
  const knownSlugs = new Set(storefronts.map((s) => s.slug));
  const requestedStore = url.searchParams.get('store')?.trim();
  const storeFilter =
    requestedStore && knownSlugs.has(requestedStore) ? requestedStore : null;
  const pattern = regexFromQuery(query);

  if (!pattern) {
    return NextResponse.json({ products: [], orders: [], customers: [] });
  }

  const [products, orders, customers] = await Promise.all([
    (db()`
      select
        p.id,
        p.storefront_slug,
        p.title,
        p.category,
        p.status,
        b.business_name
      from products p
      join briefs b on b.slug = p.storefront_slug
      where b.clerk_user_id = ${userId}
        and b.expires_at > now()
        and (${storeFilter}::text is null or p.storefront_slug = ${storeFilter})
        and (
          p.title ~* ${pattern}
          or coalesce(p.description, '') ~* ${pattern}
          or coalesce(p.category, '') ~* ${pattern}
          or p.status ~* ${pattern}
        )
      order by p.updated_at desc
      limit 6
    ` as unknown) as Promise<ProductRow[]>,
    (db()`
      select
        o.id,
        o.storefront_slug,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.order_status,
        o.payment_status,
        o.total_qar,
        o.currency,
        b.business_name
      from checkout_orders o
      join briefs b on b.slug = o.storefront_slug
      where b.clerk_user_id = ${userId}
        and b.expires_at > now()
        and (${storeFilter}::text is null or o.storefront_slug = ${storeFilter})
        and (
          o.id::text ~* ${pattern}
          or o.customer_name ~* ${pattern}
          or coalesce(o.customer_email, '') ~* ${pattern}
          or o.customer_phone ~* ${pattern}
          or o.order_status ~* ${pattern}
          or o.payment_status ~* ${pattern}
          or exists (
            select 1
            from checkout_order_items i
            where i.order_id = o.id
              and i.title_snapshot ~* ${pattern}
          )
        )
      order by o.created_at desc
      limit 6
    ` as unknown) as Promise<OrderRow[]>,
    (db()`
      select
        c.id,
        c.storefront_slug,
        c.email,
        c.phone,
        c.first_name,
        c.last_name,
        c.order_count,
        b.business_name
      from customers c
      join briefs b on b.slug = c.storefront_slug
      where b.clerk_user_id = ${userId}
        and b.expires_at > now()
        and (${storeFilter}::text is null or c.storefront_slug = ${storeFilter})
        and (
          coalesce(c.email, '') ~* ${pattern}
          or coalesce(c.phone, '') ~* ${pattern}
          or (coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) ~* ${pattern}
          or array_to_string(c.tags, ' ') ~* ${pattern}
        )
      order by c.updated_at desc
      limit 6
    ` as unknown) as Promise<CustomerRow[]>,
  ]);

  return NextResponse.json({
    products: products.map((product) => ({
      type: 'product',
      id: product.id,
      title: product.title,
      subtitle: [product.category, product.status, product.business_name]
        .filter(Boolean)
        .join(' · '),
      href: `/account/products?store=${encodeURIComponent(product.storefront_slug)}&edit=${encodeURIComponent(product.id)}`,
    })),
    orders: orders.map((order) => ({
      type: 'order',
      id: order.id,
      title: `${order.customer_name} · ${order.currency} ${Number(order.total_qar).toFixed(0)}`,
      subtitle: `${order.order_status.replace(/_/g, ' ')} · ${order.payment_status.replace(/_/g, ' ')} · ${order.business_name}`,
      href: `/account/orders?store=${encodeURIComponent(order.storefront_slug)}`,
    })),
    customers: customers.map((customer) => {
      const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
      return {
        type: 'customer',
        id: customer.id,
        title: name || customer.email || customer.phone || 'Customer',
        subtitle: [customer.email ?? customer.phone, `${customer.order_count} orders`, customer.business_name]
          .filter(Boolean)
          .join(' · '),
        href: `/account/customers/${customer.id}?store=${encodeURIComponent(customer.storefront_slug)}`,
      };
    }),
  });
}
