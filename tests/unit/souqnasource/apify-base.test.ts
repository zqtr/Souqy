// tests/unit/souqnasource/apify-base.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeWhatsapp, listingId } from '@/lib/apps/souqnasource/clients/apify-base';

describe('normalizeWhatsapp', () => {
  it('null on empty', () => expect(normalizeWhatsapp(null)).toBeNull());
  it('prepends +974 to 8-digit Qatari', () =>
    expect(normalizeWhatsapp('5555 5555')).toBe('+97455555555'));
  it('keeps 974 prefix', () =>
    expect(normalizeWhatsapp('+97455555555')).toBe('+97455555555'));
  it('handles digits with leading 974', () =>
    expect(normalizeWhatsapp('97455555555')).toBe('+97455555555'));
});

describe('listingId', () => {
  it('joins with colon', () =>
    expect(listingId('qatarliving', 'abc123')).toBe('qatarliving:abc123'));
});
