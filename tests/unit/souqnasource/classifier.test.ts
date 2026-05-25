// tests/unit/souqnasource/classifier.test.ts
import { describe, it, expect } from 'vitest';
import { ruleBasedCategory, classifyListingType } from '@/lib/apps/souqnasource/classifier';

describe('ruleBasedCategory', () => {
  const cases: Array<[string, string | null]> = [
    ['Oud Cambodi 12ml premium', 'perfume-oud'],
    ['دهن العود مميز', 'perfume-oud'],
    ['EDP fragrance for men', 'perfume-modern'],
    ['Black abaya for sale wholesale', 'fashion-abaya'],
    ['عباية سوداء', 'fashion-abaya'],
    ['iPhone 15 silicone case bulk', 'electronics-accessories'],
    ['Saffron 50g زعفران', 'food-dates'],
    ['Random unrelated text', null],
  ];
  for (const [title, expected] of cases) {
    it(`maps ${JSON.stringify(title)} → ${expected}`, () => {
      const got = ruleBasedCategory(title, null);
      expect(got?.category ?? null).toBe(expected);
    });
  }
});

describe('classifyListingType', () => {
  it('priced when positive number', () => {
    expect(classifyListingType(85)).toBe('priced');
  });
  it('contact when null', () => {
    expect(classifyListingType(null)).toBe('contact');
  });
  it('contact when zero or negative', () => {
    expect(classifyListingType(0)).toBe('contact');
    expect(classifyListingType(-1)).toBe('contact');
  });
});
