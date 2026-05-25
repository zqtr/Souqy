import { describe, expect, it } from 'vitest';
import {
  normalizePolicyDisplayMode,
  resolveInlinePolicyEntries,
  resolvePolicyBody,
} from '@/lib/storefrontPolicies';
import type { StorefrontPolicies } from '@/lib/storefrontSettings';

const emptyPolicies: StorefrontPolicies = {
  terms: null,
  privacy: null,
  refund: null,
  shipping: null,
};

describe('storefront policy display', () => {
  it('defaults every storefront to terms, privacy, and refunds copy', () => {
    const entries = resolveInlinePolicyEntries({
      policies: emptyPolicies,
      locale: 'en',
      businessName: 'Test Store',
    });

    expect(entries.map((entry) => entry.key)).toEqual(['terms', 'privacy', 'refund']);
    expect(entries.every((entry) => entry.body.includes('Test Store'))).toBe(true);
    expect(entries.every((entry) => entry.isDefault)).toBe(true);
  });

  it('uses explicit policy text when the store has it', () => {
    const policies = { ...emptyPolicies, terms: '  Custom terms  ' };
    expect(
      resolvePolicyBody({
        policies,
        key: 'terms',
        locale: 'en',
        businessName: 'Test Store',
      }),
    ).toBe('Custom terms');
  });

  it('normalizes the storefront policy layout mode', () => {
    expect(normalizePolicyDisplayMode('columns')).toBe('columns');
    expect(normalizePolicyDisplayMode('anything-else')).toBe('full');
    expect(normalizePolicyDisplayMode(undefined)).toBe('full');
  });
});
