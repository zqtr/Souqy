import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getProduct, getProductsForUser } from '@/lib/products';
import { getStorefront, getStorefrontsForUser } from '@/lib/brief';
import { getCopy } from '@/content/copy';
import { ProductForm } from '@/components/dashboard/ProductForm';
import { PageHeader, Surface } from '@/components/admin/primitives';
import { getPlan } from '@/lib/billing';

/**
 * Shopify-style product detail page. Lives at
 * `/account/products/[id]?store=<slug>` so the URL itself is shareable
 * — the founder can paste it in Slack and the recipient lands on the
 * exact same product (subject to ownership).
 *
 * The actual editor is the existing `<ProductForm>`; this page wraps
 * it in a Souqna-branded shell with a back link and a metadata sidebar
 * so the founder always knows which storefront the product belongs to.
 */
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/products');

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;

  // We need the product's owning storefront slug. The founder can
  // arrive here with `?store=` already set OR via a deep link without
  // it; in the latter case we reverse-look-up via the cross-storefront
  // catalogue.
  const allProducts = await getProductsForUser(userId);
  const own = allProducts.find((p) => p.id === id);
  if (!own) notFound();

  const slug = requested ?? own.storefrontSlug;
  if (slug !== own.storefrontSlug) {
    // The `?store=` param doesn't match the product's actual storefront
    // — likely an old URL. Redirect to the right one.
    redirect(`/account/products/${id}?store=${own.storefrontSlug}`);
  }

  const [product, storefront, storefronts, currentPlan] = await Promise.all([
    getProduct(slug, id),
    getStorefront(slug),
    getStorefrontsForUser(userId),
    getPlan(userId),
  ]);
  if (!product || !storefront) notFound();
  if (storefront.clerkUserId !== userId) notFound();

  const copy = getCopy(storefront.locale);

  return (
    <>
      <PageHeader
        eyebrow={`Products · ${storefront.businessName}`}
        title={product.title}
        subtitle={`Edit ${product.title} on ${storefront.businessName}.`}
        secondaryActions={[
          { label: '← All products', href: `/account/products?store=${slug}` },
        ]}
      />

      <div
        className="souqna-product-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <Surface padding={24}>
          <ProductForm
            mode="edit"
            storefrontSlug={slug}
            locale={storefront.locale}
            copy={copy}
            initial={product}
            currentPlan={currentPlan}
          />
        </Surface>

        <Surface padding={20}>
          <h3
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 16,
              color: 'var(--ink-strong)',
            }}
          >
            Quick info
          </h3>
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 10,
              fontSize: 13,
            }}
          >
            <KV label="Storefront">
              <Link
                href={`/account?store=${slug}`}
                style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}
              >
                {storefront.businessName}
              </Link>
            </KV>
            <KV label="Status">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                }}
              >
                {product.status}
              </span>
            </KV>
            <KV label="Position">{String(product.position + 1)}</KV>
            <KV label="Created">{product.createdAt.toLocaleDateString('en-GB')}</KV>
            <KV label="Updated">{product.updatedAt.toLocaleDateString('en-GB')}</KV>
            {product.eventAt ? (
              <KV label="Event">
                {product.eventAt.toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </KV>
            ) : null}
          </dl>

          {storefronts.length > 1 ? (
            <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-muted)' }}>
              You own {storefronts.length} storefronts. This product belongs to{' '}
              <strong style={{ color: 'var(--ink-strong)' }}>
                {storefront.businessName}
              </strong>{' '}
              only.
            </p>
          ) : null}
        </Surface>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-product-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          color: 'var(--ink-strong)',
          textAlign: 'right',
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        {children}
      </dd>
    </div>
  );
}
