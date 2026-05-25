'use client';

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { useCart } from './CartContext';
import {
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  normalizeCustomSizeValue,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from '@/lib/productOptions';

/**
 * Buyer-facing "add to cart" affordance shipped inside otherwise-static
 * storefront blocks (grids, lists, featured hero, menu rows). Renders
 * nothing when the storefront has no payment methods configured — the
 * `cart.enabled` flag is the single source of truth so individual blocks
 * never need to know whether checkout is wired.
 *
 * Three visual variants share one client island so we keep the hydration
 * cost flat across blocks:
 *   - primary : large, accent-filled CTA used by the FeaturedProductBlock
 *   - inline  : compact ghost button slotted into grid/list cards
 *   - icon    : 32px round "+" used by the dense MenuBlock rows
 *
 * RTL is respected via logical CSS only (no left/right). The "+1" micro-
 * animation is a CSS-only flourish triggered by re-mounting a keyed span
 * on every successful add.
 */

export type AddToCartButtonVariant = 'primary' | 'inline' | 'icon';
export type AddToCartOptionLayout = 'inline' | 'stacked';
const CUSTOM_SIZE_VALUE = '__souqna_custom_size__';

type Props = {
  productId: string;
  title: string;
  priceQar: number;
  imageUrl?: string | null;
  sizeOptions?: string[];
  allowCustomSize?: boolean;
  requiresHeightInput?: boolean;
  heightInputLabel?: string | null;
  heightOptions?: string[];
  variant?: AddToCartButtonVariant;
  optionLayout?: AddToCartOptionLayout;
  className?: string;
  ariaLabel?: string;
  /**
   * Visible label override. When omitted the button uses the bilingual
   * default driven by `isRtl` to match the inline-copy pattern used by
   * the surrounding blocks.
   */
  label?: string;
  isRtl?: boolean;
  icon?: ReactNode;
  style?: CSSProperties;
};

export function AddToCartButton({
  productId,
  title,
  priceQar,
  imageUrl,
  sizeOptions,
  allowCustomSize = false,
  requiresHeightInput = false,
  heightInputLabel,
  heightOptions,
  variant = 'inline',
  optionLayout = 'inline',
  className,
  ariaLabel,
  label,
  isRtl = false,
  icon,
  style,
}: Props): JSX.Element | null {
  const cart = useCart();
  const [bumpKey, setBumpKey] = useState(0);
  const sizes = normalizeSizeOptions(sizeOptions);
  const normalizedHeightOptions = normalizeHeightOptions(heightOptions);
  const heights =
    requiresHeightInput && normalizedHeightOptions.length === 0
      ? DEFAULT_PRODUCT_HEIGHT_OPTIONS
      : normalizedHeightOptions;
  const [selectedSize, setSelectedSize] = useState(
    sizes[0] ?? (allowCustomSize ? CUSTOM_SIZE_VALUE : ''),
  );
  const [customSizeValue, setCustomSizeValue] = useState('');
  const [customSizeTouched, setCustomSizeTouched] = useState(false);
  const [selectedHeight, setSelectedHeight] = useState(heights[0] ?? '');
  const sizeEnabled = sizes.length > 0 || allowCustomSize;
  const isCustomSizeSelected = allowCustomSize && selectedSize === CUSTOM_SIZE_VALUE;
  const activeSize = isCustomSizeSelected
    ? CUSTOM_SIZE_VALUE
    : sizes.includes(selectedSize)
      ? selectedSize
      : (sizes[0] ?? (allowCustomSize ? CUSTOM_SIZE_VALUE : ''));
  const normalizedCustomSize = normalizeCustomSizeValue(customSizeValue);
  const selectedSizeValue = isCustomSizeSelected ? normalizedCustomSize : activeSize;
  const activeHeight = heights.includes(selectedHeight) ? selectedHeight : (heights[0] ?? '');
  const heightLabel = heightInputLabel?.trim() || (isRtl ? 'الطول' : 'Height');
  const customSizeLabel = isRtl ? 'مقاس مخصص' : 'Custom size';
  const customSizeInvalid = isCustomSizeSelected && customSizeTouched && !normalizedCustomSize;
  const hasOptionControls = sizeEnabled || requiresHeightInput;

  const onClick = useCallback(() => {
    if (!cart.enabled) return;
    if (isCustomSizeSelected && !normalizedCustomSize) {
      setCustomSizeTouched(true);
      return;
    }
    if (sizeEnabled && !selectedSizeValue) return;
    if (requiresHeightInput && !activeHeight) return;
    cart.add(
      {
        productId,
        title,
        priceQar,
        imageUrl: imageUrl ?? null,
        variantLabel: sizeEnabled ? selectedSizeValue : null,
        customInputs:
          requiresHeightInput && activeHeight
            ? { height: activeHeight, heightLabel }
            : undefined,
      },
      1,
    );
    cart.open();
    setBumpKey((k) => k + 1);
  }, [
    cart,
    productId,
    title,
    priceQar,
    imageUrl,
    sizeEnabled,
    selectedSizeValue,
    isCustomSizeSelected,
    normalizedCustomSize,
    requiresHeightInput,
    activeHeight,
    heightLabel,
  ]);

  if (!cart.enabled) return null;

  const fallbackLabel = isRtl ? 'أضف إلى السلة' : 'Add to cart';
  const visibleLabel = label ?? fallbackLabel;
  const computedAriaLabel =
    ariaLabel ??
    (variant === 'icon'
      ? isRtl
        ? `أضف ${title} إلى السلة`
        : `Add ${title} to cart`
      : visibleLabel);

  const sizeSelect =
    sizeEnabled ? (
      <label style={variant === 'icon' ? compactInputWrapStyle : inputWrapStyle}>
        <span style={inputLabelStyle}>{isRtl ? 'المقاس' : 'Size'}</span>
        <select
          aria-label={isRtl ? 'المقاس' : 'Size'}
          value={activeSize}
          onChange={(event) => {
            setSelectedSize(event.target.value);
            setCustomSizeTouched(false);
          }}
          style={variant === 'icon' ? compactSelectStyle : selectStyle}
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          {allowCustomSize ? <option value={CUSTOM_SIZE_VALUE}>{customSizeLabel}</option> : null}
        </select>
        {isCustomSizeSelected ? (
          <>
            <input
              aria-label={customSizeLabel}
              value={customSizeValue}
              onChange={(event) => {
                setCustomSizeValue(event.target.value);
                if (customSizeTouched) setCustomSizeTouched(false);
              }}
              onBlur={() => setCustomSizeTouched(true)}
              placeholder={isRtl ? 'اكتب المقاس' : 'Enter size'}
              style={variant === 'icon' ? compactTextInputStyle : textInputStyle}
            />
            {customSizeInvalid ? (
              <span role="alert" style={inputErrorStyle}>
                {isRtl ? 'مطلوب' : 'Required'}
              </span>
            ) : null}
          </>
        ) : null}
      </label>
    ) : null;

  const heightInput = requiresHeightInput ? (
    <label style={variant === 'icon' ? compactInputWrapStyle : inputWrapStyle}>
      <span style={inputLabelStyle}>{heightLabel}</span>
      <select
        aria-label={heightLabel}
        value={activeHeight}
        onChange={(event) => setSelectedHeight(event.target.value)}
        style={variant === 'icon' ? compactSelectStyle : selectStyle}
      >
        {heights.map((height) => (
          <option key={height} value={height}>
            {height}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  if (variant === 'icon') {
    const optionContent =
      hasOptionControls && optionLayout === 'stacked' ? (
        <span style={stackedOptionPanelStyle}>
          {sizeSelect}
          {heightInput}
        </span>
      ) : (
        <>
          {sizeSelect}
          {heightInput}
        </>
      );

    return (
      <span style={optionLayout === 'stacked' ? stackedIconWrapStyle : iconWrapStyle}>
        {optionContent}
        <button
          type="button"
          onClick={onClick}
          aria-label={computedAriaLabel}
          title={computedAriaLabel}
          className={className}
          style={{ ...iconStyle, ...style }}
        >
          {icon ?? <PlusGlyph />}
          <Bump bumpKey={bumpKey} />
        </button>
      </span>
    );
  }

  return (
    <span style={stackWrapStyle}>
      {sizeSelect}
      {heightInput}
      <button
        type="button"
        onClick={onClick}
        aria-label={computedAriaLabel}
        className={className}
        style={{ ...(variant === 'primary' ? primaryStyle : inlineStyle), ...style }}
      >
        <span aria-hidden style={{ display: 'inline-flex', position: 'relative' }}>
          <PlusGlyph />
          <Bump bumpKey={bumpKey} />
        </span>
        <span>{visibleLabel}</span>
      </button>
    </span>
  );
}

function PlusGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function Bump({ bumpKey }: { bumpKey: number }) {
  if (bumpKey === 0) return null;
  return (
    <span key={bumpKey} aria-hidden style={bumpStyle}>
      +1
    </span>
  );
}

const baseButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 180ms, color 180ms, border-color 180ms',
  appearance: 'none',
  WebkitAppearance: 'none',
};

const primaryStyle: React.CSSProperties = {
  ...baseButtonStyle,
  padding: '12px 20px',
  fontSize: 11,
  border: '1px solid color-mix(in srgb, var(--sf-accent) 60%, transparent)',
  background: 'var(--sf-accent)',
  color: 'var(--sf-ground)',
};

const inlineStyle: React.CSSProperties = {
  ...baseButtonStyle,
  padding: '8px 14px',
  fontSize: 10.5,
  border: '1px solid color-mix(in srgb, var(--sf-accent) 45%, transparent)',
  background: 'transparent',
  color: 'var(--sf-ink)',
};

const iconStyle: React.CSSProperties = {
  ...baseButtonStyle,
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--sf-accent) 45%, transparent)',
  background: 'transparent',
  color: 'var(--sf-ink)',
  position: 'relative',
  flex: '0 0 auto',
};

const iconWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
};

const stackedIconWrapStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'end',
  gap: 10,
  width: '100%',
  minWidth: 0,
};

const stackWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 8,
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  minHeight: 38,
  width: '100%',
  minWidth: 0,
  borderRadius: 10,
  border: '1px solid #d8b56b',
  background: '#fffaf1',
  color: '#471d24',
  padding: '0 28px 0 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  lineHeight: 1,
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
};

const compactSelectStyle: React.CSSProperties = {
  ...selectStyle,
  minHeight: 34,
  fontSize: 10.5,
};

const inputWrapStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
};

const compactInputWrapStyle: React.CSSProperties = {
  ...inputWrapStyle,
  width: '100%',
};

const inputLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#7b6259',
};

const textInputStyle: React.CSSProperties = {
  minHeight: 38,
  width: '100%',
  minWidth: 0,
  borderRadius: 10,
  border: '1px solid #d8b56b',
  background: '#fffdf8',
  color: '#471d24',
  padding: '0 10px',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  outline: 'none',
};

const compactTextInputStyle: React.CSSProperties = {
  ...textInputStyle,
  minHeight: 34,
  fontSize: 12,
};

const inputErrorStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: '#8b1f2f',
};

const stackedOptionPanelStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
  gap: 8,
  minWidth: 0,
  padding: 10,
  borderRadius: 18,
  border: '1px solid rgba(216,181,107,0.72)',
  background:
    'linear-gradient(135deg, rgba(255,250,241,0.96), rgba(244,231,205,0.96))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.78)',
};

const bumpStyle: React.CSSProperties = {
  position: 'absolute',
  top: -10,
  insetInlineEnd: -6,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--sf-accent)',
  pointerEvents: 'none',
  animation: 'souqna-cart-bump 600ms ease-out forwards',
};
