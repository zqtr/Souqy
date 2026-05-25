import type { BusinessType } from './brief';
import type { Locale } from '@/i18n/locales';

/**
 * Storefront vocabulary per business type.
 *
 * Templates render the same five sections (Hero, Tagline, Offering,
 * Practical, Footer). Only the section *labels* and the verb the hero
 * uses ("we serve" vs "we craft") shift per business type — kept in this
 * single map so we don't author 40 templates.
 *
 * `offerLabel` is the eyebrow above the "what you offer" section
 * ("the menu", "the lookbook", "the catalogue"...). `heroVerb` is a short
 * action phrase under the business name on Atrium ("a kitchen in Doha",
 * "a studio in Doha"...). `practicalLabel` titles the contact strip.
 */

type Vocab = {
  offerLabel: string;
  heroVerb: string;
  practicalLabel: string;
};

type LocaleVocab = Record<BusinessType, Vocab>;

const en: LocaleVocab = {
  graphic_design: { offerLabel: 'the work', heroVerb: 'a studio in Doha', practicalLabel: 'commission' },
  clothing_store: { offerLabel: 'the lookbook', heroVerb: 'a label in Doha', practicalLabel: 'visit & order' },
  home_kitchen: { offerLabel: 'the menu', heroVerb: 'a kitchen in Doha', practicalLabel: 'order & collect' },
  salon: { offerLabel: 'the services', heroVerb: 'a salon in Doha', practicalLabel: 'book a chair' },
  cafe: { offerLabel: 'the menu', heroVerb: 'a room in Doha', practicalLabel: 'find us' },
  ecommerce: { offerLabel: 'the catalogue', heroVerb: 'an online shop from Doha', practicalLabel: 'order & support' },
  real_estate: { offerLabel: 'the listings', heroVerb: 'a brokerage in Doha', practicalLabel: 'arrange a viewing' },
  photography: { offerLabel: 'the portfolio', heroVerb: 'a studio in Doha', practicalLabel: 'book a session' },
  tutoring: { offerLabel: 'the curriculum', heroVerb: 'a tutor in Doha', practicalLabel: 'enrol' },
  fitness: { offerLabel: 'the programme', heroVerb: 'a gym in Doha', practicalLabel: 'visit us' },
  perfume_oud: { offerLabel: 'the collection', heroVerb: 'a perfumer in Doha', practicalLabel: 'order & sample' },
  auto_detailing: { offerLabel: 'the services', heroVerb: 'a detailer in Doha', practicalLabel: 'book a wash' },
  events_weddings: { offerLabel: 'the events', heroVerb: 'an atelier in Doha', practicalLabel: 'enquire & book' },
  agriculture: { offerLabel: 'the harvest', heroVerb: 'a farm in Qatar', practicalLabel: 'order direct' },
  courier_delivery: { offerLabel: 'the runs', heroVerb: 'a courier in Doha', practicalLabel: 'request a pickup' },
  contracting: { offerLabel: 'the trades', heroVerb: 'a contractor in Qatar', practicalLabel: 'request a quote' },
  art_gallery: { offerLabel: 'the programme', heroVerb: 'a gallery in Doha', practicalLabel: 'visit us' },
  tailoring_abaya: { offerLabel: 'the wardrobe', heroVerb: 'a tailor in Doha', practicalLabel: 'book a fitting' },
  fnb_brand: { offerLabel: 'the products', heroVerb: 'a brand from Doha', practicalLabel: 'stockists & order' },
  something_else: { offerLabel: 'what we do', heroVerb: 'in Doha', practicalLabel: 'get in touch' },
};

const ar: LocaleVocab = {
  graphic_design: { offerLabel: 'الأعمال', heroVerb: 'استوديو في الدوحة', practicalLabel: 'لطلب عمل' },
  clothing_store: { offerLabel: 'المجموعة', heroVerb: 'علامة من الدوحة', practicalLabel: 'الزيارة والطلب' },
  home_kitchen: { offerLabel: 'القائمة', heroVerb: 'مطبخ في الدوحة', practicalLabel: 'الطلب والاستلام' },
  salon: { offerLabel: 'الخدمات', heroVerb: 'صالون في الدوحة', practicalLabel: 'احجز موعداً' },
  cafe: { offerLabel: 'القائمة', heroVerb: 'مكان في الدوحة', practicalLabel: 'وجدنا هنا' },
  ecommerce: { offerLabel: 'الكتالوج', heroVerb: 'متجر إلكتروني من الدوحة', practicalLabel: 'الطلب والدعم' },
  real_estate: { offerLabel: 'العقارات', heroVerb: 'مكتب في الدوحة', practicalLabel: 'لمعاينة' },
  photography: { offerLabel: 'الأعمال', heroVerb: 'استوديو في الدوحة', practicalLabel: 'احجز جلسة' },
  tutoring: { offerLabel: 'المنهج', heroVerb: 'مدرّس في الدوحة', practicalLabel: 'للتسجيل' },
  fitness: { offerLabel: 'البرنامج', heroVerb: 'صالة رياضية في الدوحة', practicalLabel: 'لزيارتنا' },
  perfume_oud: { offerLabel: 'المجموعة', heroVerb: 'عطّار في الدوحة', practicalLabel: 'الطلب والتجربة' },
  auto_detailing: { offerLabel: 'الخدمات', heroVerb: 'تلميع سيارات في الدوحة', practicalLabel: 'احجز غسلة' },
  events_weddings: { offerLabel: 'المناسبات', heroVerb: 'تنظيم فعاليات في الدوحة', practicalLabel: 'استفسر واحجز' },
  agriculture: { offerLabel: 'الموسم', heroVerb: 'مزرعة في قطر', practicalLabel: 'طلب مباشر' },
  courier_delivery: { offerLabel: 'الخدمات', heroVerb: 'مندوب توصيل في الدوحة', practicalLabel: 'اطلب توصيلة' },
  contracting: { offerLabel: 'الأعمال', heroVerb: 'مقاول في قطر', practicalLabel: 'لطلب عرض سعر' },
  art_gallery: { offerLabel: 'البرنامج', heroVerb: 'صالة عرض في الدوحة', practicalLabel: 'لزيارتنا' },
  tailoring_abaya: { offerLabel: 'الخزانة', heroVerb: 'خياط في الدوحة', practicalLabel: 'احجز قياساً' },
  fnb_brand: { offerLabel: 'المنتجات', heroVerb: 'علامة من الدوحة', practicalLabel: 'نقاط البيع والطلب' },
  something_else: { offerLabel: 'ما نقدّمه', heroVerb: 'في الدوحة', practicalLabel: 'تواصل معنا' },
};

export function getVocabulary(locale: Locale, type: BusinessType): Vocab {
  return (locale === 'ar' ? ar : en)[type];
}
