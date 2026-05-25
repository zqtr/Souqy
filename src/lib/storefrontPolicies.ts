import type { Locale } from '@/i18n/locales';
import type { PolicyKey, StorefrontPolicies } from './storefrontSettings';

export const INLINE_POLICY_KEYS = ['terms', 'privacy', 'refund'] as const;
export type InlinePolicyKey = (typeof INLINE_POLICY_KEYS)[number];

export const POLICY_DISPLAY_MODES = ['full', 'columns'] as const;
export type PolicyDisplayMode = (typeof POLICY_DISPLAY_MODES)[number];

export type InlinePolicyEntry = {
  key: InlinePolicyKey;
  title: string;
  body: string;
  isDefault: boolean;
};

const INLINE_POLICY_TITLES: Record<InlinePolicyKey, Record<Locale, string>> = {
  terms: {
    en: 'Terms Of Service',
    ar: 'شروط الخدمة',
  },
  privacy: {
    en: 'Privacy',
    ar: 'الخصوصية',
  },
  refund: {
    en: 'Refunds',
    ar: 'الاسترجاع',
  },
};

export function normalizePolicyDisplayMode(value: unknown): PolicyDisplayMode {
  return value === 'columns' ? 'columns' : 'full';
}

export function inlinePolicyTitle(key: InlinePolicyKey, locale: Locale): string {
  return INLINE_POLICY_TITLES[key][locale];
}

export function defaultInlinePolicyText({
  key,
  locale,
  businessName,
}: {
  key: InlinePolicyKey;
  locale: Locale;
  businessName: string;
}): string {
  const name = businessName.trim() || (locale === 'ar' ? 'المتجر' : 'this store');
  if (locale === 'ar') {
    if (key === 'terms') {
      return `تنطبق هذه الشروط على الطلبات التي تتم من ${name}. عند إتمام الطلب، يوافق العميل على تفاصيل المنتج والسعر وطريقة الدفع ومواعيد التسليم الموضحة في المتجر. قد تحتاج الطلبات الخاصة أو المخصصة إلى تأكيد قبل التنفيذ.`;
    }
    if (key === 'privacy') {
      return `يستخدم ${name} بيانات العميل فقط لمعالجة الطلبات، وترتيب التواصل أو التسليم، وتقديم الدعم المتعلق بالشراء. لا يتم بيع بيانات العملاء أو مشاركتها لأغراض غير مرتبطة بتنفيذ الطلب.`;
    }
    return `تتم مراجعة طلبات الاسترجاع أو الاستبدال من قبل ${name} حسب حالة المنتج، وما إذا كان الطلب مخصصا، ومرحلة التجهيز أو التسليم.`;
  }

  if (key === 'terms') {
    return `These terms apply to orders placed with ${name}. By completing an order, the buyer agrees to the product details, price, payment method, and delivery timing shown by the store. Custom or made-to-order items may require confirmation before production.`;
  }
  if (key === 'privacy') {
    return `${name} uses customer details only to process orders, arrange communication or delivery, and support the purchase. Customer information is not sold or shared for unrelated purposes.`;
  }
  return `Refunds, exchanges, and cancellations are reviewed by ${name} based on the product condition, customization status, and preparation or delivery progress.`;
}

export function resolvePolicyBody({
  policies,
  key,
  locale,
  businessName,
}: {
  policies: StorefrontPolicies;
  key: PolicyKey;
  locale: Locale;
  businessName: string;
}): string | null {
  const explicit = policies[key];
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
  if ((INLINE_POLICY_KEYS as readonly string[]).includes(key)) {
    return defaultInlinePolicyText({
      key: key as InlinePolicyKey,
      locale,
      businessName,
    });
  }
  return null;
}

export function resolveInlinePolicyEntries({
  policies,
  locale,
  businessName,
}: {
  policies: StorefrontPolicies;
  locale: Locale;
  businessName: string;
}): InlinePolicyEntry[] {
  return INLINE_POLICY_KEYS.map((key) => {
    const explicit = policies[key];
    const body =
      typeof explicit === 'string' && explicit.trim().length > 0
        ? explicit.trim()
        : defaultInlinePolicyText({ key, locale, businessName });
    return {
      key,
      title: inlinePolicyTitle(key, locale),
      body,
      isDefault: !(typeof explicit === 'string' && explicit.trim().length > 0),
    };
  });
}
