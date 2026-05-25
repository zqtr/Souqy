import 'server-only';
import type { Storefront } from './brief';
import { getAllProducts } from './products';
import { countCustomers } from './customers';
import { listInstalledApps } from './apps/installed';

export type AccountSetupTaskId =
  | 'logo'
  | 'products'
  | 'theme'
  | 'publish'
  | 'currency'
  | 'first-customer';

export type AccountSetupTask = {
  id: AccountSetupTaskId;
  title: string;
  arTitle: string;
  body: string;
  arBody: string;
  href: string;
  done: boolean;
};

type Input = {
  storefront: Pick<Storefront, 'slug' | 'isPublished' | 'logoUrl'>;
  productsCount: number;
  customerCount: number;
  installedAppIds?: readonly string[];
};

/**
 * Single source of truth for the dashboard checklist and for the
 * hosted-pay-link gate. Card-like checkout only unlocks once every
 * visible `/account` setup row is complete, so founders cannot accept
 * online payments on a half-configured storefront.
 */
export function evaluateSetupCompletion(input: Input): {
  tasks: AccountSetupTask[];
  pct: number;
  completeForPayLink: boolean;
} {
  const slug = input.storefront.slug;
  const hasCurrencyConverter =
    input.installedAppIds?.includes('currency-converter') ?? false;
  const tasks: AccountSetupTask[] = [
    {
      id: 'logo',
      title: 'Upload your logo',
      arTitle: 'ارفع الشعار',
      body: 'Adds a professional touch to the storefront and order emails.',
      arBody: 'يعطي المتجر وإيميلات الطلبات لمسة احترافية.',
      href: `/account/settings/brand?store=${slug}`,
      done: Boolean(input.storefront.logoUrl),
    },
    {
      id: 'products',
      title: 'Add at least three products',
      arTitle: 'أضف ثلاث منتجات على الأقل',
      body: 'Stores with three or more items convert visitors at 4x the rate.',
      arBody: 'المتاجر اللي فيها ثلاث منتجات أو أكثر تحوّل الزوار بأربعة أضعاف.',
      href: `/account/products?store=${slug}`,
      done: input.productsCount >= 3,
    },
    {
      id: 'theme',
      title: 'Edit your storefront in the builder',
      arTitle: 'عدّل متجرك من المُنشئ',
      body: 'Pick a palette, swap blocks, and shape the public page.',
      arBody: 'اختر الألوان، بدّل البلوكات، وشكّل صفحتك العامة.',
      href: `/account/builder?store=${slug}`,
      done: input.storefront.isPublished,
    },
    {
      id: 'publish',
      title: 'Publish your storefront',
      arTitle: 'انشر متجرك',
      body: 'Make the page reachable at your slug.souqna.qa subdomain.',
      arBody: 'خلي الصفحة متاحة على النطاق الفرعي slug.souqna.qa.',
      href: `/account/builder?store=${slug}`,
      done: input.storefront.isPublished,
    },
    {
      id: 'currency',
      title: 'Install the Currency Converter app',
      arTitle: 'ثبّت تطبيق Currency Converter',
      body: 'Show prices in QAR, USD, EUR, GBP, AED, or SAR. Free, no setup.',
      arBody:
        'اعرض الأسعار بالريال القطري أو الدولار أو اليورو أو الجنيه أو الدرهم أو الريال السعودي. مجاني وبدون إعداد.',
      href: `/account/apps?store=${slug}`,
      done: hasCurrencyConverter,
    },
    {
      id: 'first-customer',
      title: 'Capture your first customer',
      arTitle: 'سجّل أول عميل لك',
      body: 'Add them manually, or wait for an inquiry to come in from the storefront.',
      arBody: 'ضيفه يدوياً، أو انتظر يجيك استفسار من المتجر.',
      href: `/account/customers?store=${slug}`,
      done: input.customerCount > 0,
    },
  ];
  const done = tasks.filter((t) => t.done).length;
  return {
    tasks,
    pct: Math.round((done / tasks.length) * 100),
    completeForPayLink: done === tasks.length,
  };
}

export async function evaluateSetupCompletionForStorefront(
  storefront: Storefront,
): Promise<ReturnType<typeof evaluateSetupCompletion>> {
  const [products, customerCount, installedApps] = await Promise.all([
    getAllProducts(storefront.slug).catch(() => []),
    countCustomers(storefront.slug).catch(() => 0),
    listInstalledApps(storefront.slug).catch(() => []),
  ]);
  return evaluateSetupCompletion({
    storefront,
    productsCount: products.length,
    customerCount,
    installedAppIds: installedApps.map((app) => app.appId),
  });
}
