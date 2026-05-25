import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  PLANS,
  aiCreditsForPlan,
  monthlyOrderCapForPlan,
  platformFeeBpsForPlan,
  platformFeeForTotal,
  planLabel,
  planUnlocksAnalytics,
  planUnlocksCustomDomain,
  planUnlocksDiscounts,
  planUnlocksIntegrations,
  planUnlocksPremiumBlocks,
  planUnlocksSouqy,
  productCapForPlan,
  sellerNetForTotal,
  storefrontCapForPlan,
} from '@/lib/plans';

describe('Souqna plan catalog', () => {
  it('keeps internal IDs stable while exposing the new labels and prices', () => {
    expect(PLANS).toEqual(['free', 'starter', 'pro', 'atelier']);
    expect(planLabel('free')).toBe('Free');
    expect(planLabel('starter')).toBe('Pro');
    expect(planLabel('pro')).toBe('Pro+');
    expect(planLabel('atelier')).toBe('Max+');
    expect(PLAN_LIMITS.starter.monthlyPriceQar).toBe(49);
    expect(PLAN_LIMITS.pro.monthlyPriceQar).toBe(145);
    expect(PLAN_LIMITS.atelier.monthlyPriceQar).toBe(235);
  });

  it('exposes storefront, product, order, fee, and AI limits', () => {
    expect(storefrontCapForPlan('free')).toBe(1);
    expect(productCapForPlan('free')).toBe(10);
    expect(monthlyOrderCapForPlan('free')).toBe(25);
    expect(platformFeeBpsForPlan('free')).toBe(500);
    expect(aiCreditsForPlan('starter')).toBe(100);
    expect(Number.isFinite(productCapForPlan('starter'))).toBe(false);
    expect(Number.isFinite(monthlyOrderCapForPlan('pro'))).toBe(false);
  });

  it('calculates platform fee snapshots in whole QAR', () => {
    expect(platformFeeForTotal(100, 'free')).toBe(5);
    expect(sellerNetForTotal(100, 'free')).toBe(95);
    expect(platformFeeForTotal(100, 'starter')).toBe(3);
    expect(sellerNetForTotal(100, 'pro')).toBe(99);
    expect(platformFeeForTotal(100, 'atelier')).toBe(0);
    expect(sellerNetForTotal(100, 'atelier')).toBe(100);
  });

  it('gates features at the intended tiers', () => {
    expect(planUnlocksCustomDomain('free')).toBe(false);
    expect(planUnlocksCustomDomain('starter')).toBe(true);
    expect(planUnlocksAnalytics('free')).toBe(false);
    expect(planUnlocksIntegrations('starter')).toBe(true);
    expect(planUnlocksDiscounts('starter')).toBe(true);
    expect(planUnlocksSouqy('starter')).toBe(false);
    expect(planUnlocksSouqy('pro')).toBe(true);
    expect(planUnlocksPremiumBlocks('pro')).toBe(true);
  });
});
