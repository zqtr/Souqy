import { describe, expect, it } from 'vitest';
import {
  evaluateCheckoutDiscount,
  type CheckoutDiscountLine,
  type Discount,
} from '@/lib/discounts';

const baseDiscount: Discount = {
  id: 1,
  storefrontSlug: 'evare',
  kind: 'code',
  code: 'WELCOME10',
  title: null,
  valueType: 'percentage',
  value: 10,
  appliesTo: 'all',
  appliesToIds: [],
  minimumSubtotal: null,
  usageLimit: null,
  perCustomerLimit: null,
  usedCount: 0,
  status: 'active',
  startsAt: null,
  endsAt: null,
  meta: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const lines: CheckoutDiscountLine[] = [
  { productId: 'p1', lineTotalQar: 120, categoryIds: ['c1'] },
  { productId: 'p2', lineTotalQar: 80, categoryIds: ['c2'] },
];

describe('evaluateCheckoutDiscount', () => {
  it('applies percentage discounts to the eligible subtotal', () => {
    const result = evaluateCheckoutDiscount({
      discount: baseDiscount,
      subtotalQar: 200,
      shippingQar: 20,
      lines,
    });

    expect(result).toMatchObject({
      status: 'success',
      subtotalDiscountQar: 20,
      shippingDiscountQar: 0,
      totalDiscountQar: 20,
    });
  });

  it('caps fixed amount discounts at the eligible subtotal', () => {
    const result = evaluateCheckoutDiscount({
      discount: { ...baseDiscount, valueType: 'fixed_amount', value: 500 },
      subtotalQar: 200,
      shippingQar: 20,
      lines,
    });

    expect(result).toMatchObject({
      status: 'success',
      subtotalDiscountQar: 200,
      totalDiscountQar: 200,
    });
  });

  it('applies free shipping without discounting the item subtotal', () => {
    const result = evaluateCheckoutDiscount({
      discount: { ...baseDiscount, valueType: 'free_shipping', value: 0 },
      subtotalQar: 200,
      shippingQar: 25,
      lines,
    });

    expect(result).toMatchObject({
      status: 'success',
      subtotalDiscountQar: 0,
      shippingDiscountQar: 25,
      totalDiscountQar: 25,
    });
  });

  it('respects product-scoped discounts', () => {
    const result = evaluateCheckoutDiscount({
      discount: { ...baseDiscount, appliesTo: 'products', appliesToIds: ['p2'] },
      subtotalQar: 200,
      shippingQar: 20,
      lines,
    });

    expect(result).toMatchObject({
      status: 'success',
      subtotalDiscountQar: 8,
    });
  });

  it('rejects inactive, expired, and exhausted codes', () => {
    expect(
      evaluateCheckoutDiscount({
        discount: { ...baseDiscount, status: 'disabled' },
        subtotalQar: 200,
        shippingQar: 20,
        lines,
      }).status,
    ).toBe('error');
    expect(
      evaluateCheckoutDiscount({
        discount: {
          ...baseDiscount,
          endsAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        subtotalQar: 200,
        shippingQar: 20,
        lines,
        now: new Date('2026-01-02T00:00:00.000Z'),
      }).status,
    ).toBe('error');
    expect(
      evaluateCheckoutDiscount({
        discount: { ...baseDiscount, usageLimit: 1, usedCount: 1 },
        subtotalQar: 200,
        shippingQar: 20,
        lines,
      }).status,
    ).toBe('error');
  });
});
