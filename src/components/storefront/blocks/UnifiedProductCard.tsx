'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from 'react';
import { ShoppingBag } from 'lucide-react';
import { AddToCartButton } from '../cart/AddToCartButton';
import { PriceText, formatMonthlyPrice, formatPrice } from './helpers';

export type UnifiedProductCardProduct = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  priceQar?: number | null;
  pricingMode?: 'one_time' | 'monthly_payment';
  monthlyPriceQar?: number | null;
  priceText?: string | null;
  status?: 'active' | 'draft' | 'sold_out' | string;
  href?: string | null;
  createdAt?: string | Date | null;
  isCustomizable?: boolean;
  customizationLabel?: string | null;
  sizeOptions?: string[];
  allowCustomSize?: boolean;
  requiresHeightInput?: boolean;
  heightInputLabel?: string | null;
  heightOptions?: string[];
};

type Props = {
  product: UnifiedProductCardProduct;
  isRtl: boolean;
  variant?: 'standard' | 'compact' | 'feature';
  showDescription?: boolean;
  showPrice?: boolean;
  showAddToCart?: boolean;
  className?: string;
  style?: CSSProperties;
};

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function UnifiedProductCard({
  product,
  isRtl,
  variant = 'standard',
  showDescription = true,
  showPrice = true,
  showAddToCart = true,
  className,
  style,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const href = product.href ?? '#';
  const isSoldOut = product.status === 'sold_out';
  const isMonthly =
    product.pricingMode === 'monthly_payment' && typeof product.monthlyPriceQar === 'number';
  const displayPrice = isMonthly ? product.monthlyPriceQar! : product.priceQar;
  const hasPrice = typeof displayPrice === 'number';
  const canCart = showAddToCart && !isSoldOut && hasPrice;
  const hasOptionControls =
    canCart &&
    (Boolean(product.allowCustomSize) ||
      Boolean(product.requiresHeightInput) ||
      (product.sizeOptions?.length ?? 0) > 0);
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serifFamily = isRtl ? 'var(--font-arabic-serif), var(--font-serif), serif' : 'var(--font-serif), serif';
  const customLabel =
    product.customizationLabel?.trim() || (isRtl ? 'قابل للتخصيص' : 'Customizable');
  const priceText =
    product.priceText ??
    (hasPrice
      ? isMonthly
        ? formatMonthlyPrice(displayPrice ?? null, isRtl)
        : formatPrice(displayPrice ?? null, isRtl)
      : isRtl ? 'حسب الطلب' : 'On request');
  const showBody = showDescription && variant !== 'compact' && Boolean(product.description?.trim());

  useEffect(() => {
    setIsNew(isRecent(product.createdAt));
  }, [product.createdAt]);

  return (
    <article
      className={className}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: variant === 'feature' ? 32 : 28,
        background: 'color-mix(in srgb, var(--sf-ground) 94%, var(--sf-accent) 6%)',
        border: '1px solid color-mix(in srgb, var(--sf-ink) 10%, transparent)',
        boxShadow: '0 28px 80px -56px color-mix(in srgb, var(--sf-ink) 70%, transparent)',
        color: 'var(--sf-ink)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <a
        href={href}
        aria-label={product.title}
        style={{
          display: 'block',
          position: 'relative',
          aspectRatio: variant === 'compact' ? '4 / 3' : '4 / 3',
          overflow: 'hidden',
          color: 'inherit',
          textDecoration: 'none',
          background: 'color-mix(in srgb, var(--sf-ink) 7%, transparent)',
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'color-mix(in srgb, var(--sf-ink) 50%, transparent)',
            }}
          >
            {isRtl ? 'بدون صورة' : 'No image'}
          </div>
        )}

        <button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? (isRtl ? 'إزالة من المفضلة' : 'Remove favorite') : isRtl ? 'أضف للمفضلة' : 'Add favorite'}
          onClick={(event) => {
            event.preventDefault();
            setLiked((value) => !value);
          }}
          style={{
            position: 'absolute',
            top: 18,
            ...(isRtl ? { insetInlineEnd: 18 } : { insetInlineStart: 18 }),
            width: 54,
            height: 54,
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--sf-ground) 78%, transparent)',
            background: 'color-mix(in srgb, var(--sf-ground) 84%, transparent)',
            color: liked ? 'var(--sf-accent)' : 'var(--sf-ink)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          <HeartGlyph filled={liked} />
        </button>

        <div
          style={{
            position: 'absolute',
            top: 18,
            ...(isRtl ? { insetInlineStart: 18 } : { insetInlineEnd: 18 }),
            display: 'flex',
            flexDirection: 'column',
            alignItems: isRtl ? 'flex-start' : 'flex-end',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {isNew ? <Badge tone="new">{isRtl ? 'جديد' : 'New'}</Badge> : null}
          {product.isCustomizable ? <Badge tone="custom">{customLabel}</Badge> : null}
          {isSoldOut ? <Badge tone="sold">{isRtl ? 'نفد' : 'Sold out'}</Badge> : null}
        </div>
      </a>

      <div
        style={{
          padding: variant === 'compact' ? '18px 18px 20px' : '24px clamp(20px, 4vw, 32px) 26px',
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          gap: variant === 'compact' ? 8 : 12,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {product.category ? (
          <p
            style={{
              margin: 0,
              fontFamily,
              fontSize: variant === 'compact' ? 13 : 16,
              lineHeight: 1.35,
              color: 'color-mix(in srgb, var(--sf-ink) 68%, transparent)',
            }}
          >
            {product.category}
          </p>
        ) : null}
        <a
          href={href}
          style={{
            color: 'var(--sf-ink)',
            textDecoration: 'none',
            fontFamily: serifFamily,
            fontWeight: 700,
            fontSize:
              variant === 'feature'
                ? 'clamp(28px, 4vw, 44px)'
                : variant === 'compact'
                  ? 'clamp(18px, 2.2vw, 24px)'
                  : 'clamp(24px, 3vw, 34px)',
            lineHeight: 1.12,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.title}
        </a>
        {showBody ? (
          <p
            style={{
              margin: 0,
              color: 'color-mix(in srgb, var(--sf-ink) 70%, transparent)',
              fontFamily,
              fontSize: 'clamp(15px, 2vw, 20px)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: variant === 'feature' ? 3 : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {product.description}
          </p>
        ) : null}
        <div
          style={{
            display: 'flex',
            alignItems: hasOptionControls ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: hasOptionControls ? 12 : 16,
            marginTop: 'auto',
            paddingTop: variant === 'compact' ? 8 : 12,
            flexDirection: hasOptionControls ? 'column-reverse' : 'row',
          }}
        >
          {canCart ? (
            <AddToCartButton
              productId={product.id}
              title={product.title}
              priceQar={displayPrice!}
              imageUrl={product.imageUrl ?? null}
              sizeOptions={product.sizeOptions}
              allowCustomSize={product.allowCustomSize}
              requiresHeightInput={product.requiresHeightInput}
              heightInputLabel={product.heightInputLabel}
              heightOptions={product.heightOptions}
              variant="icon"
              optionLayout={hasOptionControls ? 'stacked' : 'inline'}
              isRtl={isRtl}
              icon={<ShoppingBag size={variant === 'compact' ? 16 : 20} aria-hidden />}
              style={{
                width: variant === 'compact' ? 46 : 58,
                height: variant === 'compact' ? 46 : 58,
                border: '0',
                background: 'linear-gradient(135deg, #471d24, #7d3b2f)',
                color: '#fff8ed',
                boxShadow: '0 18px 34px -24px rgba(71,29,36,0.72)',
              }}
            />
          ) : (
            <span aria-hidden />
          )}
          {showPrice ? (
            hasPrice && !isMonthly ? (
              <PriceText
                price={displayPrice ?? null}
                isRtl={isRtl}
                style={{
                  color: 'var(--sf-ink)',
                  fontFamily: serifFamily,
                  fontWeight: 700,
                  fontSize:
                    variant === 'compact'
                      ? 'clamp(18px, 2.2vw, 24px)'
                      : 'clamp(24px, 3vw, 34px)',
                  whiteSpace: 'nowrap',
                  alignSelf: hasOptionControls ? (isRtl ? 'flex-start' : 'flex-end') : undefined,
                }}
              />
            ) : (
              <span
                style={{
                  color: 'var(--sf-ink)',
                  fontFamily: serifFamily,
                  fontWeight: 700,
                  fontSize:
                    variant === 'compact'
                      ? 'clamp(18px, 2.2vw, 24px)'
                      : 'clamp(24px, 3vw, 34px)',
                  whiteSpace: 'nowrap',
                  alignSelf: hasOptionControls ? (isRtl ? 'flex-start' : 'flex-end') : undefined,
                }}
              >
                {priceText}
              </span>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}

function isRecent(value: UnifiedProductCardProduct['createdAt']) {
  if (!value) return false;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= NEW_WINDOW_MS;
}

function Badge({ tone, children }: { tone: 'new' | 'custom' | 'sold'; children: React.ReactNode }) {
  const styles: Record<typeof tone, CSSProperties> = {
    new: {
      background: 'color-mix(in srgb, var(--sf-accent) 82%, #d8ad52)',
      color: 'var(--sf-ground)',
    },
    custom: {
      background: 'color-mix(in srgb, var(--sf-accent) 26%, #e8b9bd)',
      color: 'var(--sf-ink)',
    },
    sold: {
      background: 'color-mix(in srgb, var(--sf-ink) 82%, transparent)',
      color: 'var(--sf-ground)',
    },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 'min(220px, 58vw)',
        minHeight: 38,
        padding: '8px 18px',
        borderRadius: 999,
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize: 'clamp(14px, 2.8vw, 22px)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxShadow: '0 12px 30px -20px rgba(0,0,0,0.42)',
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}
