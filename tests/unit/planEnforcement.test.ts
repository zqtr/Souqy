import { describe, expect, it } from 'vitest';
import {
  checkoutOrderFeeSnapshot,
  monthlyOrderCapFailure,
  orderFeeSnapshot,
  productCapFailure,
} from '@/lib/planEnforcement';

describe('plan enforcement helpers', () => {
  it('blocks Free product creation once the 10 product cap would be exceeded', () => {
    expect(productCapFailure('free', 9, 1)).toBeNull();
    expect(productCapFailure('free', 9, 2)).toEqual({
      status: 'error',
      message: 'Free allows 10 products. Upgrade to unlock growth tools.',
      field: 'title',
    });
    expect(productCapFailure('starter', 10_000, 500)).toBeNull();
  });

  it('blocks Free checkout order creation after 25 monthly orders', () => {
    expect(monthlyOrderCapFailure('free', 24)).toBeNull();
    expect(monthlyOrderCapFailure('free', 25)).toEqual({
      status: 'error',
      message: 'Free allows 25 checkout orders per month. Upgrade to unlock growth tools.',
      field: 'items',
    });
    expect(monthlyOrderCapFailure('pro', 500)).toBeNull();
  });

  it('snapshots fees and collection mode for public and manual checkout paths', () => {
    expect(orderFeeSnapshot('free', 200, 'skipcash')).toMatchObject({
      planSnapshot: 'free',
      platformFeeBps: 500,
      platformFeeQar: 10,
      sellerNetQar: 190,
      collectionMode: 'platform_skipcash',
      platformProvider: 'skipcash',
    });
    expect(orderFeeSnapshot('starter', 200, 'cod')).toMatchObject({
      planSnapshot: 'starter',
      platformFeeBps: 0,
      platformFeeQar: 0,
      sellerNetQar: 200,
      collectionMode: 'offline',
      platformProvider: null,
    });
    expect(orderFeeSnapshot('pro', 200, 'skipcash', { platformSkipCash: false })).toMatchObject({
      platformFeeBps: 100,
      platformFeeQar: 2,
      sellerNetQar: 198,
      collectionMode: 'seller_direct',
      platformProvider: 'skipcash',
    });
    expect(orderFeeSnapshot('atelier', 200, 'sadad')).toMatchObject({
      platformFeeBps: 0,
      platformFeeQar: 0,
      sellerNetQar: 200,
      collectionMode: 'seller_direct',
      platformProvider: 'sadad',
    });
  });

  it('adds non-COD checkout fees to the buyer total while keeping seller net at order base', () => {
    expect(checkoutOrderFeeSnapshot('free', 200, 'skipcash')).toMatchObject({
      planSnapshot: 'free',
      platformFeeBps: 500,
      platformFeeQar: 10,
      sellerNetQar: 200,
      buyerTotalQar: 210,
      feeBaseQar: 200,
      collectionMode: 'platform_skipcash',
      platformProvider: 'skipcash',
    });
    expect(checkoutOrderFeeSnapshot('starter', 200, 'cod')).toMatchObject({
      platformFeeBps: 0,
      platformFeeQar: 0,
      sellerNetQar: 200,
      buyerTotalQar: 200,
      collectionMode: 'offline',
      platformProvider: null,
    });
  });
});
