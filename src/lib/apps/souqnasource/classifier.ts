// src/lib/apps/souqnasource/classifier.ts
import type { Category, ListingType } from './types';

type Hit = { category: Category; subcategory: string | null };

const RULES: Array<[RegExp, Category]> = [
  [/(?:\b(?:oud|musk)\b|عود|دهن العود|مسك)/iu, 'perfume-oud'],
  [/(?:\b(?:perfume|fragrance|cologne|edp|edt)\b|عطر)/iu, 'perfume-modern'],
  [/(?:\b(?:abaya|jalabiya)\b|عباية)/iu, 'fashion-abaya'],
  [/(?:\b(?:modest|hijab|kaftan)\b|حجاب)/iu, 'fashion-modest'],
  [/\b(iphone|samsung|xiaomi|redmi|case|charger|cable|adapter|airpods|earbuds)\b/iu, 'electronics-accessories'],
  [/(?:\b(?:phone|smartphone)\b|هاتف|جوال)/iu, 'electronics-phones'],
  [/(?:\b(?:decor|vase|lamp)\b|فازة|مصباح)/iu, 'home-decor'],
  [/(?:\b(?:bedding|towel|fabric)\b|سرير|منشفة)/iu, 'home-textiles'],
  [/(?:\b(?:skincare|cream|serum)\b|كريم|مرطب)/iu, 'beauty-skincare'],
  [/(?:\b(?:lipstick|mascara|makeup|maquillage)\b|مكياج)/iu, 'beauty-cosmetics'],
  [/(?:\b(?:date|spice|saffron)\b|تمر|بهار|زعفران)/iu, 'food-dates'],
  [/(?:\b(?:gold|jewelry)\b|ذهب)/iu, 'jewelry-gold'],
  [/(?:\b(?:toy|kids)\b|لعبة)/iu, 'kids-toys'],
  [/(?:\b(?:sports|fitness|treadmill|dumbbell)\b|رياضة)/iu, 'sports-fitness'],
  [/(?:\b(?:corporate|gift)\b|هدية|مكتبية)/iu, 'gifts-corporate'],
];

export function ruleBasedCategory(
  title: string,
  rawCategory: string | null,
): Hit | null {
  const haystack = `${title} ${rawCategory ?? ''}`;
  for (const [re, cat] of RULES) {
    if (re.test(haystack)) {
      return { category: cat, subcategory: null };
    }
  }
  return null;
}

export function classifyListingType(price: number | null): ListingType {
  return typeof price === 'number' && price > 0 ? 'priced' : 'contact';
}
