import { describe, expect, it } from 'vitest';
import {
  MAX_PRODUCT_SIZE_OPTIONS,
  isAllowedHeightOption,
  isAllowedProductSizeOption,
  isAllowedSizeOption,
  normalizeCustomSizeValue,
  normalizeCustomInputValue,
  normalizeHeightOptions,
  normalizeHeightInputLabel,
  normalizeSizeOptions,
} from '@/lib/productOptions';

describe('product size options', () => {
  it('normalizes custom sizes from strings or label objects', () => {
    expect(normalizeSizeOptions([' S ', 'M', { label: ' L ' }, 'm', '', 35, { label: 42 }])).toEqual([
      'S',
      'M',
      'L',
      '35',
      '42',
    ]);
  });

  it('caps the saved option count and label length', () => {
    const values = Array.from(
      { length: MAX_PRODUCT_SIZE_OPTIONS + 5 },
      (_, index) => `size-${index + 1}`,
    );

    expect(normalizeSizeOptions(values)).toHaveLength(MAX_PRODUCT_SIZE_OPTIONS);
    expect(normalizeSizeOptions(['x'.repeat(80)])).toEqual(['x'.repeat(40)]);
  });

  it('requires a valid selected size when a product has size options', () => {
    expect(isAllowedSizeOption(['S', 'M', 'L'], 'm')).toBe(true);
    expect(isAllowedSizeOption(['S', 'M', 'L'], null)).toBe(false);
    expect(isAllowedSizeOption(['S', 'M', 'L'], 'XL')).toBe(false);
    expect(isAllowedSizeOption([], null)).toBe(true);
    expect(isAllowedSizeOption([], 'S')).toBe(false);
  });

  it('allows buyer-entered custom sizes only when enabled', () => {
    expect(normalizeCustomSizeValue('  custom 48  ')).toBe('custom 48');
    expect(isAllowedProductSizeOption(['S', 'M'], 'M', false)).toBe(true);
    expect(isAllowedProductSizeOption(['S', 'M'], 'custom 48', false)).toBe(false);
    expect(isAllowedProductSizeOption(['S', 'M'], 'custom 48', true)).toBe(true);
    expect(isAllowedProductSizeOption(['S', 'M'], '   ', true)).toBe(false);
  });

  it('normalizes height custom input values and labels', () => {
    expect(normalizeCustomInputValue('  170   cm  ')).toBe('170 cm');
    expect(normalizeCustomInputValue(180)).toBe('180');
    expect(normalizeCustomInputValue('   ')).toBeNull();
    expect(normalizeHeightInputLabel('  Dress height  ')).toBe('Dress height');
    expect(normalizeHeightInputLabel('x'.repeat(80))).toBe('x'.repeat(40));
  });

  it('normalizes and validates height choices like size options', () => {
    expect(normalizeHeightOptions([' 156 ', '165', '156', 178])).toEqual(['156', '165', '178']);
    expect(isAllowedHeightOption(['156', '165', '178'], '165')).toBe(true);
    expect(isAllowedHeightOption(['156', '165', '178'], '170')).toBe(false);
  });
});
