import Link from 'next/link';
import type { BlockRenderProps } from './BlockContext';
import type { TaqimBlockProps } from '@/lib/blocks/types';
import { getInstalledApp } from '@/lib/apps/installed';
import {
  getTaqimSettings,
  getBundleById,
  pickBundleForProduct,
  computeBundleTotals,
  type TaqimBundle,
  type TaqimSettings,
} from '@/lib/apps/taqim';
import type { Product } from '@/lib/products';

/**
 * Server-rendered Taqim (bundles & complete-the-look) block.
 *
 * The block resolves which bundle to show by, in order:
 *   1. `props.bundleId` — the founder picked one in the inspector.
 *   2. `props.anchorProductId` — anchor on a chosen product.
 *   3. The first enabled bundle in the founder's Taqim settings.
 *
 * Pricing, layout, accent colour, and bilingual copy all come from
 * `app_state` so the founder edits the bundle in Settings without
 * republishing the page. The CTA is wired to the existing inquire
 * flow (anchor link to the floating inquire button) for v1 — full
 * cart wiring is intentionally out of scope.
 */
export async function TaqimBlock({ block, ctx }: BlockRenderProps<TaqimBlockProps>) {
  const slug = ctx.storefront.slug;
  const installed = await getInstalledApp(slug, 'taqim').catch(() => null);
  if (!installed || !installed.enabled) {
    return ctx.isPreview ? (
      <TaqimSetupCard
        title="Install Taqim to publish this bundle"
        body="This builder block is ready. Install Taqim from Apps, then choose a product or bundle here."
      />
    ) : null;
  }

  const settings = await getTaqimSettings(slug);
  if (!settings.enabled) {
    return ctx.isPreview ? (
      <TaqimSetupCard title="Taqim is disabled" body="Enable Taqim in Apps to show bundles publicly." />
    ) : null;
  }

  const bundle = resolveBundle(settings, block.props);
  if (!bundle || !bundle.enabled || bundle.items.length === 0) {
    return ctx.isPreview ? (
      <TaqimSetupCard
        title="Choose a bundle"
        body="Create a bundle in Apps → Taqim, or anchor this block to a product that already has a bundle."
      />
    ) : null;
  }

  const productMap = new Map(ctx.products.map((p) => [p.id, p]));
  const items = bundle.items
    .map((it) => productMap.get(it.productId))
    .filter((p): p is Product => Boolean(p));
  if (items.length === 0) return null;

  // Stock policy: if any item is missing or sold out, the founder may
  // want the whole bundle hidden. We treat `priceQar === null` as
  // "not for sale right now" — the closest signal we have without a
  // proper stock column.
  const missingAny = items.length < bundle.items.length;
  if (missingAny && bundle.stockPolicy === 'hideIfAnyOOS') return null;

  const prices = new Map<string, number>();
  for (const p of items) if (p.priceQar !== null) prices.set(p.id, p.priceQar);
  const { subtotal, total, savings } = computeBundleTotals(bundle, prices);

  const isAr = ctx.isRtl;
  const heading = block.props.heading?.trim() || (isAr ? bundle.titleAr : bundle.titleEn) || bundle.name;
  const subtitle = isAr ? bundle.subtitleAr : bundle.subtitleEn;
  const cta = isAr ? bundle.ctaAr : bundle.ctaEn;
  const accentCss = settings.appearance.accent.startsWith('--')
    ? `var(${settings.appearance.accent})`
    : settings.appearance.accent;
  const layout = block.props.variant ?? settings.appearance.layout;
  const radiusPx = settings.appearance.radius === 'sm' ? 8 : settings.appearance.radius === 'lg' ? 18 : 12;
  const savingsTpl = isAr
    ? settings.appearance.savingsTemplateAr
    : settings.appearance.savingsTemplateEn;
  const savingsLabel = savings > 0 ? savingsTpl.replace('{amount}', savings.toFixed(0)) : null;

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: accentCss,
          }}
        >
          ◫ {isAr ? 'اشترِ معاً' : 'Buy together'}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 'var(--sf-heading-weight, 400)' as unknown as number,
            fontSize: 'clamp(22px, 3vw, 32px)',
            color: 'var(--sf-ink)',
          }}
        >
          {heading}
        </h2>
        {subtitle ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'color-mix(in srgb, var(--sf-ink) 65%, transparent)',
              maxWidth: 640,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </header>

      <BundleItems
        items={items}
        layout={layout}
        radiusPx={radiusPx}
        plusGlyph="+"
        accentCss={accentCss}
      />

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          paddingTop: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span
            style={{
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontSize: 22,
              color: 'var(--sf-ink)',
            }}
          >
            {total.toFixed(2)} QAR
          </span>
          {subtotal > total ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'color-mix(in srgb, var(--sf-ink) 55%, transparent)',
                textDecoration: 'line-through',
              }}
            >
              {subtotal.toFixed(2)}
            </span>
          ) : null}
          {savingsLabel ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                color: 'var(--sf-ground)',
                background: accentCss,
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {savingsLabel}
            </span>
          ) : null}
        </div>
        <Link
          href="#souqna-inquire"
          style={{
            marginInlineStart: 'auto',
            padding: '10px 20px',
            borderRadius: radiusPx,
            background: 'var(--sf-ink)',
            color: 'var(--sf-ground)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          {cta}
        </Link>
      </footer>
    </section>
  );
}

function TaqimSetupCard({ title, body }: { title: string; body: string }) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 8,
        padding: 18,
        borderRadius: 16,
        border: '1px dashed color-mix(in srgb, var(--sf-accent) 48%, transparent)',
        background: 'color-mix(in srgb, var(--sf-accent) 10%, transparent)',
        color: 'var(--sf-ink)',
      }}
    >
      <strong style={{ fontFamily: 'var(--font-serif, var(--font-sans))', fontSize: 22 }}>
        ◫ {title}
      </strong>
      <p style={{ margin: 0, fontSize: 14, color: 'color-mix(in srgb, var(--sf-ink) 68%, transparent)' }}>
        {body}
      </p>
    </section>
  );
}

function resolveBundle(
  settings: TaqimSettings,
  props: TaqimBlockProps,
): TaqimBundle | null {
  if (props.bundleId) {
    const explicit = getBundleById(settings, props.bundleId);
    if (explicit) return explicit;
  }
  if (props.anchorProductId) {
    const anchored = pickBundleForProduct(settings, props.anchorProductId);
    if (anchored) return anchored;
  }
  return settings.bundles.find((b) => b.enabled) ?? null;
}

function BundleItems({
  items,
  layout,
  radiusPx,
  plusGlyph,
  accentCss,
}: {
  items: Product[];
  layout: 'stack' | 'cards' | 'carousel';
  radiusPx: number;
  plusGlyph: string;
  accentCss: string;
}) {
  if (layout === 'stack') {
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((p) => (
          <li
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '10px 14px',
              borderRadius: radiusPx,
              background: 'color-mix(in srgb, var(--sf-ink) 4%, transparent)',
              border: '1px solid color-mix(in srgb, var(--sf-ink) 8%, transparent)',
            }}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.title}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: radiusPx / 2 }}
              />
            ) : (
              <div style={{ width: 56, height: 56, background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)', borderRadius: radiusPx / 2 }} />
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--sf-ink)' }}>{p.title}</div>
            {p.priceQar !== null ? (
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)' }}
                data-souqna-price={p.priceQar}
              >
                {p.priceQar.toFixed(2)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  if (layout === 'carousel') {
    return (
      <div
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          paddingBottom: 6,
          scrollSnapType: 'x mandatory',
        }}
      >
        {items.map((p, i) => (
          <article
            key={p.id}
            style={{
              flex: '0 0 min(240px, 74vw)',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'color-mix(in srgb, var(--sf-ink) 4%, transparent)',
              borderRadius: radiusPx,
              overflow: 'hidden',
              border: '1px solid color-mix(in srgb, var(--sf-ink) 8%, transparent)',
              position: 'relative',
            }}
          >
            {i < items.length - 1 ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 12,
                  insetInlineEnd: 12,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: accentCss,
                  color: 'var(--sf-ground)',
                  fontSize: 16,
                  zIndex: 2,
                }}
              >
                {plusGlyph}
              </span>
            ) : null}
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.title} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '4 / 5', background: 'color-mix(in srgb, var(--sf-ink) 6%, transparent)' }} />
            )}
            <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13.5, color: 'var(--sf-ink)' }}>{p.title}</div>
              {p.priceQar !== null ? (
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)' }}
                  data-souqna-price={p.priceQar}
                >
                  {p.priceQar.toFixed(2)} QAR
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      {items.map((p, i) => (
        <div key={p.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <article
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'color-mix(in srgb, var(--sf-ink) 4%, transparent)',
              borderRadius: radiusPx,
              overflow: 'hidden',
              border: '1px solid color-mix(in srgb, var(--sf-ink) 8%, transparent)',
            }}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.title}
                style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '4 / 5' }} />
            )}
            <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13.5, color: 'var(--sf-ink)' }}>{p.title}</div>
              {p.priceQar !== null ? (
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'color-mix(in srgb, var(--sf-ink) 60%, transparent)' }}
                  data-souqna-price={p.priceQar}
                >
                  {p.priceQar.toFixed(2)} QAR
                </div>
              ) : null}
            </div>
          </article>
          {i < items.length - 1 ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '38%',
                insetInlineEnd: -14,
                width: 24,
                height: 24,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--sf-ground)',
                color: accentCss,
                border: `1px solid ${accentCss}`,
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontSize: 16,
                lineHeight: 1,
                zIndex: 2,
              }}
            >
              {plusGlyph}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
