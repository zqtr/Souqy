'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { MetalFrame } from '@/components/primitives/MetalFrame';
import { useTheme } from '@/components/theme/ThemeProvider';
import SplitText from '@/components/react-bits/split-text';
import {
  checkSlugAvailability,
  type SlugAvailability,
} from '@/app/actions/checkSlug';
import {
  createBrief,
  type CreateBriefInput,
  type CreateBriefState,
} from '@/app/actions/createBrief';
import type { Locale } from '@/i18n/locales';
import type { BusinessType, TemplateId } from '@/lib/brief';
import { getTemplateIndustrySeed } from '@/lib/blocks/templateIndustrySeed';
import { palettes } from '@/lib/palettes';
import { sortedTemplateIdsForPicker, templatePresets } from '@/lib/templates';

type StepKey = 'identity' | 'activity' | 'template' | 'confirmation';
type LocalSlugStatus =
  | SlugAvailability
  | { status: 'idle' }
  | { status: 'offline'; slug: string };
type PreviewProduct = {
  title: string;
  priceQar: number | null;
  imageUrl: string;
  category: string;
};

const FALLBACK_PREVIEW_PRODUCT: PreviewProduct = {
  title: 'Signature Offer',
  priceQar: 420,
  imageUrl:
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
  category: 'featured',
};

const StarSwipe = dynamic(() => import('@/components/star-swipe'), { ssr: false });

const STEP_KEYS: StepKey[] = ['identity', 'activity', 'template', 'confirmation'];

const ACTIVITIES: Array<{ id: BusinessType; en: string; ar: string }> = [
  { id: 'graphic_design', en: 'Graphic design', ar: 'تصميم جرافيكي' },
  { id: 'clothing_store', en: 'Clothing store', ar: 'متجر ملابس' },
  { id: 'home_kitchen', en: 'Home kitchen', ar: 'مطبخ منزلي' },
  { id: 'perfume_oud', en: 'Perfume / oud', ar: 'عطور وعود' },
  { id: 'salon', en: 'Salon / beauty', ar: 'صالون وتجميل' },
  { id: 'cafe', en: 'Cafe / F&B', ar: 'مقهى ومأكولات' },
  { id: 'ecommerce', en: 'Online store', ar: 'متجر إلكتروني' },
  { id: 'photography', en: 'Photography', ar: 'تصوير' },
  { id: 'events_weddings', en: 'Events / weddings', ar: 'فعاليات وأعراس' },
  { id: 'art_gallery', en: 'Art gallery', ar: 'معرض فني' },
  { id: 'tailoring_abaya', en: 'Tailoring', ar: 'خياطة' },
  { id: 'something_else', en: 'Something else', ar: 'شيء آخر' },
];

const TEMPLATE_FEATURES: Record<TemplateId, { en: string[]; ar: string[] }> = {
  atrium: {
    en: ['KPI trust strip', 'Featured offer', 'Curated grid'],
    ar: ['شريط ثقة', 'عرض رئيسي', 'شبكة منتقاة'],
  },
  souqline: {
    en: ['Dense catalogue', 'Category lanes', 'Quick-buy rhythm'],
    ar: ['كتالوج كثيف', 'مسارات تصنيف', 'شراء سريع'],
  },
  kiosk: {
    en: ['Drop story', 'Notify CTA', 'Related upsell'],
    ar: ['قصة دروب', 'تنبيه الإطلاق', 'منتجات مكملة'],
  },
  lounge: {
    en: ['Mono checkout', 'Bundle shelf', 'Sharp list'],
    ar: ['دفع مونو', 'رف باقات', 'قائمة واضحة'],
  },
  studio: {
    en: ['Service packages', 'Booking blocks', 'Add-on shop'],
    ar: ['باقات خدمات', 'كتل حجز', 'متجر إضافات'],
  },
  bazaar: {
    en: ['Limited drops', 'Urgency modules', 'Seasonal shelves'],
    ar: ['دروبات محدودة', 'وحدات استعجال', 'رفوف موسمية'],
  },
  vitrine: {
    en: ['Suite hero', 'Premium blocks', 'Strong CTA'],
    ar: ['هيرو حزمة', 'بلوكات مميزة', 'زر قوي'],
  },
  monoline: {
    en: ['Menu commerce', 'Gift sets', 'Reservation CTA'],
    ar: ['تجارة قائمة', 'هدايا جاهزة', 'زر حجز'],
  },
  harvest: {
    en: ['Maker proof', 'Bundle shop', 'Process story'],
    ar: ['إثبات الصانع', 'متجر باقات', 'قصة العملية'],
  },
  launchpad: {
    en: ['Digital packs', 'Feature-led shop', 'Demo CTA'],
    ar: ['باقات رقمية', 'متجر مزايا', 'زر ديمو'],
  },
  frame: {
    en: ['Gallery shop', 'Print editions', 'Commission CTA'],
    ar: ['متجر معرض', 'إصدارات مطبوعة', 'زر تكليف'],
  },
};

const TEMPLATE_PICKER_IDS: TemplateId[] = sortedTemplateIdsForPicker();

const COPY = {
  en: {
    pill: 'Start a store',
    intro: 'Four small questions, then your workspace opens.',
    body: 'Pick a name, point your subdomain, choose what you sell, and select a storefront direction. We open a workplace for you on the other side.',
    stepCount: (n: number) => `Step ${n} of 4 · About a minute`,
    back: 'Back',
    next: 'Continue',
    create: 'Create account',
    createWebstore: 'Create webstore',
    creating: 'Creating…',
    steps: {
      identity: {
        title: 'What are you calling it?',
        side: 'Your name, your address.',
        body: 'A short brand name and a subdomain people can type. You can change both later before launch.',
        brandLabel: 'Brand name',
        brandPlaceholder: 'Noura Skin',
        subdomainLabel: 'Subdomain',
        subdomainPlaceholder: 'noura-skin',
        logoLabel: 'Logo',
        logoHint: 'PNG, JPG, WEBP, or SVG',
        check: 'Check availability',
        checking: 'Checking…',
      },
      activity: {
        title: 'What do you sell?',
        side: 'We tune the workspace.',
        body: 'Templates, suggestions, and AI prompts adjust to what you actually do.',
      },
      template: {
        title: 'Choose your storefront.',
        side: 'Preview the whole shop.',
        body: 'Each template is a complete ecommerce direction with hero sections, product surfaces, editorial blocks, and conversion-ready calls to action. The sample products change to match what you sell.',
      },
      confirmation: {
        title: 'Confirm your setup.',
        side: 'Last look.',
        body: 'We will create your account next. The draft above moves with you.',
        labels: {
          activity: 'Activity',
          template: 'Template',
          subdomain: 'Subdomain',
        },
      },
    },
    slug: {
      idle: 'Lowercase letters, numbers, and dashes.',
      empty: 'Pick a short subdomain for your Souqna address.',
      loading: 'Checking availability…',
      available: (s: string) => `${s}.souqna.qa is available.`,
      taken: (s: string, sug: string) => `${s}.souqna.qa is taken. Try ${sug}.`,
      reserved: (s: string) => `${s}.souqna.qa is reserved.`,
      rate: 'Too many checks. Try again in a moment.',
      offline: 'Could not verify right now. We will recheck before launch.',
      use: (sug: string) => `Use ${sug}`,
    },
    launch: {
      generic: 'We could not create the webstore. Try again in a moment.',
      welcome: (brand: string) => `Welcome ${brand} to E-Commerce`,
      quote: 'Souqna turns a first product into a place people can believe in.',
    },
  },
  ar: {
    pill: 'افتح متجرك',
    intro: 'أربعة أسئلة قصيرة ثم يفتح مكان عملك.',
    body: 'اختر اسماً، حدد دومين متجرك، اختر إيش تبيع، وحدد اتجاه الواجهة. الجهة الثانية يفتح لك مكان عمل كامل.',
    stepCount: (n: number) => `خطوة ${n} من 4 · حوالي دقيقة`,
    back: 'رجوع',
    next: 'تابع',
    create: 'افتح الحساب',
    createWebstore: 'أنشئ المتجر',
    creating: 'جاري الإنشاء…',
    steps: {
      identity: {
        title: 'ما اسم البراند؟',
        side: 'اسمك وعنوانك.',
        body: 'اسم مختصر للبراند ودومين سهل يكتبه الناس. تقدر تغيرهم قبل الإطلاق.',
        brandLabel: 'اسم البراند',
        brandPlaceholder: 'Noura Skin',
        subdomainLabel: 'الدومين',
        subdomainPlaceholder: 'noura-skin',
        logoLabel: 'الشعار',
        logoHint: 'PNG · JPG · WEBP · SVG',
        check: 'تحقق',
        checking: 'جاري التحقق…',
      },
      activity: {
        title: 'وش تبيع؟',
        side: 'نضبط لك مكان العمل.',
        body: 'القوالب والاقتراحات وأفكار الذكاء تتغير حسب نشاطك الفعلي.',
      },
      template: {
        title: 'اختر واجهة المتجر.',
        side: 'عاين المتجر بالكامل.',
        body: 'كل قالب اتجاه تجارة كامل: هيرو، أسطح منتجات، كتل تحريرية، وأزرار تحويل جاهزة. المنتجات التجريبية تتغير حسب نشاطك.',
      },
      confirmation: {
        title: 'راجع إعداد المتجر.',
        side: 'آخر نظرة.',
        body: 'بنفتح لك حسابك بعد قليل. المسودة تنتقل معك.',
        labels: {
          activity: 'النشاط',
          template: 'القالب',
          subdomain: 'الدومين',
        },
      },
    },
    slug: {
      idle: 'حروف صغيرة، أرقام، وشرطات.',
      empty: 'اختر دومين قصير لعنوان سوقنا.',
      loading: 'جاري التحقق…',
      available: (s: string) => `${s}.souqna.qa متوفر.`,
      taken: (s: string, sug: string) => `${s}.souqna.qa محجوز. جرّب ${sug}.`,
      reserved: (s: string) => `${s}.souqna.qa محجوز للنظام.`,
      rate: 'عدد محاولات كبير. جرّب بعد لحظات.',
      offline: 'تعذّر التحقق الآن. بنعيد الفحص قبل الإطلاق.',
      use: (sug: string) => `استخدم ${sug}`,
    },
    launch: {
      generic: 'تعذّر إنشاء المتجر. جرّب بعد لحظات.',
      welcome: (brand: string) => `مرحباً ${brand} في التجارة الإلكترونية`,
      quote: 'سوقنا يحوّل أول منتج إلى متجر يثق به الناس.',
    },
  },
} as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function statusText(t: (typeof COPY)[Locale], status: LocalSlugStatus, slug: string): string {
  if (!slug) return t.slug.empty;
  if (status.status === 'idle') return t.slug.idle;
  if (status.status === 'loading') return t.slug.loading;
  if (status.status === 'available') return t.slug.available(status.slug);
  if (status.status === 'taken') return t.slug.taken(status.slug, status.suggestion);
  if (status.status === 'reserved') return t.slug.reserved(status.slug);
  if (status.status === 'rate_limited') return t.slug.rate;
  if (status.status === 'offline') return t.slug.offline;
  return t.slug.idle;
}

function TemplateVisual({
  templateId,
  seed,
  products,
  brand,
}: {
  templateId: TemplateId;
  seed: ReturnType<typeof getTemplateIndustrySeed>;
  products: PreviewProduct[];
  brand: string;
}) {
  const first = products[0] ?? FALLBACK_PREVIEW_PRODUCT;
  const second = products[1] ?? first;
  const third = products[2] ?? first;
  const fourth = products[3] ?? second;
  const more = products.length > 0 ? products.slice(0, 6) : [first];

  if (templateId === 'souqline') {
    return (
      <div className="tpl-visual tpl-souqline">
        <header>
          <b>{brand}</b>
          <span>{seed.primaryCategory}</span>
          <span>{seed.secondaryCategory}</span>
          <span>{seed.tertiaryCategory}</span>
        </header>
        <div className="tpl-souq-grid">
          {more.map((product) => (
            <i key={product.title} style={{ backgroundImage: `url("${product.imageUrl}")` }}>
              <strong>{product.title}</strong>
              <em>{product.priceQar} QAR</em>
            </i>
          ))}
        </div>
      </div>
    );
  }

  if (templateId === 'kiosk') {
    return (
      <div className="tpl-visual tpl-kiosk">
        <div className="tpl-kiosk-product" style={{ backgroundImage: `url("${first.imageUrl}")` }} />
        <div className="tpl-kiosk-copy">
          <small>{seed.eyebrow}</small>
          <b>{first.title}</b>
          <span>{seed.ctaLabel}</span>
        </div>
        <ul>
          <li>01</li>
          <li>{first.priceQar} QAR</li>
          <li>Notify</li>
        </ul>
      </div>
    );
  }

  if (templateId === 'lounge') {
    return (
      <div className="tpl-visual tpl-lounge">
        <header>
          <b>{brand}</b>
          <span>Cart</span>
        </header>
        {more.slice(0, 4).map((product) => (
          <p key={product.title}>
            <strong>{product.title}</strong>
            <span>{product.category}</span>
            <em>{product.priceQar}</em>
          </p>
        ))}
        <footer>{seed.ctaLabel}</footer>
      </div>
    );
  }

  if (templateId === 'studio') {
    return (
      <div className="tpl-visual tpl-studio">
        <header>
          <b>{brand}</b>
          <span>Book</span>
        </header>
        {seed.serviceItems.slice(0, 3).map((service) => (
          <p key={service.id}>
            <strong>{service.title}</strong>
            <span>{service.description}</span>
          </p>
        ))}
        <div className="tpl-calendar">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (templateId === 'bazaar') {
    return (
      <div className="tpl-visual tpl-bazaar">
        <div className="tpl-drop">Drop 04</div>
        <b>{seed.title}</b>
        <div className="tpl-bazaar-row">
          {[first, second, third].filter(Boolean).map((product) => (
            <i key={product.title} style={{ backgroundImage: `url("${product.imageUrl}")` }} />
          ))}
        </div>
        <footer>
          <span>18:24:09</span>
          <em>{seed.ctaLabel}</em>
        </footer>
      </div>
    );
  }

  if (templateId === 'vitrine') {
    return (
      <div className="tpl-visual tpl-vitrine">
        <div className="tpl-vitrine-cover" style={{ backgroundImage: `url("${first.imageUrl}")` }} />
        <div className="tpl-vitrine-copy">
          <small>{seed.eyebrow}</small>
          <b>{brand}</b>
          <span>{seed.tagline}</span>
        </div>
        <i style={{ backgroundImage: `url("${second.imageUrl}")` }} />
        <em style={{ backgroundImage: `url("${third.imageUrl}")` }} />
      </div>
    );
  }

  if (templateId === 'monoline') {
    return (
      <div className="tpl-visual tpl-monoline">
        <small>{seed.eyebrow}</small>
        <b>{brand}</b>
        <div />
          {[first, second, third].filter(Boolean).map((product) => (
          <p key={product.title}>
            <span>{product.title}</span>
            <em>{product.priceQar}</em>
          </p>
        ))}
        <footer>{seed.ctaLabel}</footer>
      </div>
    );
  }

  if (templateId === 'harvest') {
    return (
      <div className="tpl-visual tpl-harvest">
        <header>
          <small>{seed.eyebrow}</small>
          <b>{seed.title}</b>
        </header>
        <div className="tpl-process">
          <i style={{ backgroundImage: `url("${first.imageUrl}")` }} />
          <i style={{ backgroundImage: `url("${second.imageUrl}")` }} />
          <i style={{ backgroundImage: `url("${third.imageUrl}")` }} />
        </div>
        <p>{seed.manifesto}</p>
      </div>
    );
  }

  if (templateId === 'launchpad') {
    return (
      <div className="tpl-visual tpl-launchpad">
        <small>{seed.eyebrow}</small>
        <b>{seed.title}</b>
        <div className="tpl-feature-grid">
          {['PACK', 'DEMO', 'SEO', 'PAY'].map((item) => (
            <i key={item}>{item}</i>
          ))}
        </div>
        <footer>{seed.ctaLabel}</footer>
      </div>
    );
  }

  if (templateId === 'frame') {
    return (
      <div className="tpl-visual tpl-frame">
        <i className="is-large" style={{ backgroundImage: `url("${first.imageUrl}")` }} />
        <i style={{ backgroundImage: `url("${second.imageUrl}")` }} />
        <i style={{ backgroundImage: `url("${third.imageUrl}")` }} />
        <span>{brand}</span>
        <b>{seed.ctaLabel}</b>
      </div>
    );
  }

  return (
    <div className="tpl-visual tpl-atrium">
      <div className="tpl-atrium-hero" style={{ backgroundImage: `url("${first.imageUrl}")` }}>
        <small>{seed.eyebrow}</small>
        <b>{brand}</b>
        <span>{seed.ctaLabel}</span>
      </div>
      <div className="tpl-atrium-mosaic">
        {[second, third, fourth].filter(Boolean).map((product) => (
          <i key={product.title} style={{ backgroundImage: `url("${product.imageUrl}")` }} />
        ))}
      </div>
    </div>
  );
}

function TemplateChoice({
  templateId,
  businessType,
  brandName,
  isSelected,
  isRtl,
  onSelect,
}: {
  templateId: TemplateId;
  businessType: BusinessType;
  brandName: string;
  isSelected: boolean;
  isRtl: boolean;
  onSelect: () => void;
}) {
  const preset = templatePresets[templateId];
  const brand = brandName.trim() || (isRtl ? 'متجرك' : 'Your brand');
  const seed = getTemplateIndustrySeed(templateId, businessType, {
    businessName: brand,
    tagline: null,
  });
  const themeKey = preset.theme.themeBehaviour === 'dark' ? 'dark' : 'light';
  const swatch = palettes[preset.palette][themeKey];
  const products: PreviewProduct[] = seed.products.slice(0, 4).map((product) => ({
    title: product.title,
    priceQar: product.priceQar,
    imageUrl: product.imageUrl || FALLBACK_PREVIEW_PRODUCT.imageUrl,
    category: product.category || FALLBACK_PREVIEW_PRODUCT.category,
  }));
  const featureList = TEMPLATE_FEATURES[templateId][isRtl ? 'ar' : 'en'];
  const style = {
    '--tpl-ground': swatch.ground,
    '--tpl-ink': swatch.ink,
    '--tpl-accent': swatch.accent,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`begin-template-card${isSelected ? ' is-selected' : ''}`}
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      style={style}
    >
      <div className="begin-template-preview" aria-hidden>
        <TemplateVisual templateId={templateId} seed={seed} products={products} brand={brand} />
      </div>
      <div className="begin-template-meta">
        <div>
          <strong>{preset.label}</strong>
          <span>{isRtl ? seed.tagline : preset.description.split('.')[0]}</span>
        </div>
        <ul>
          {featureList.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </button>
  );
}

export function SouqnaBeginExperience({
  locale,
  isSignedIn = false,
}: {
  locale: Locale;
  isSignedIn?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRtl = locale === 'ar';
  const t = COPY[locale];

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<LocalSlugStatus>({ status: 'idle' });
  const [logoName, setLogoName] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [activity, setActivity] = useState<BusinessType>('graphic_design');
  const [templateId, setTemplateId] = useState<TemplateId>('atrium');
  const [isChecking, setIsChecking] = useState(false);
  const [createState, setCreateState] = useState<CreateBriefState>({ status: 'idle' });
  const [launchSplash, setLaunchSplash] = useState<{ slug: string; templateId: TemplateId } | null>(
    null,
  );
  const [isCreating, startCreateTransition] = useTransition();
  const launchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeKey: StepKey = STEP_KEYS[stepIndex] ?? 'identity';
  const brandInitial = (brandName.trim() || 'S').slice(0, 1).toUpperCase();

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(brandName));
    setSlugStatus({ status: 'idle' });
  }, [brandName, slugTouched]);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
    };
  }, []);

  const canContinue = useMemo(() => {
    if (activeKey === 'identity') {
      return brandName.trim().length > 0 && slug.length >= 3 && /^[a-z0-9-]+$/.test(slug);
    }
    if (activeKey === 'activity') return activity.length > 0;
    if (activeKey === 'template') return templateId.length > 0;
    return true;
  }, [activeKey, activity, brandName, templateId, slug]);

  async function checkAvailability() {
    const candidate = slugify(slug);
    setSlug(candidate);
    if (candidate.length < 3 || !/^[a-z0-9-]+$/.test(candidate)) {
      setSlugStatus({ status: 'invalid', slug: candidate });
      return;
    }
    setIsChecking(true);
    setSlugStatus({ status: 'loading', slug: candidate });
    try {
      const result = await checkSlugAvailability(candidate);
      if (result.status === 'invalid' && /^[a-z0-9-]+$/.test(candidate)) {
        setSlugStatus({ status: 'offline', slug: candidate });
      } else {
        setSlugStatus(result);
      }
    } catch {
      setSlugStatus({ status: 'offline', slug: candidate });
    } finally {
      setIsChecking(false);
    }
  }

  function handleLogo(file: File | null) {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    if (!file) {
      setLogoName('');
      setLogoPreview('');
      return;
    }
    setLogoName(file.name);
    setLogoPreview(URL.createObjectURL(file));
  }

  function beginDraft() {
    return { brandName, slug, logoName, activity, templateId };
  }

  function goNext() {
    if (!canContinue) return;
    if (createState.status === 'error') setCreateState({ status: 'idle' });
    if (stepIndex < STEP_KEYS.length - 1) {
      setDirection(1);
      setStepIndex((current) => current + 1);
      return;
    }
    window.localStorage.setItem('souqna-begin-draft', JSON.stringify(beginDraft()));

    if (!isSignedIn) {
      window.location.href = '/sign-up?redirect_url=%2Faccount';
      return;
    }

    const payload: CreateBriefInput = {
      businessName: brandName.trim(),
      ownership: 'want_to_start',
      businessType: activity,
      templateId,
      crNumber: '',
      logoUrl: '',
      slug,
      website: '',
      locale,
    };

    startCreateTransition(async () => {
      const result = await createBrief(payload);
      setCreateState(result);
      if (result.status === 'success') {
        window.localStorage.setItem(
          'souqna-begin-draft',
          JSON.stringify({ ...beginDraft(), createdSlug: result.slug }),
        );
        setLaunchSplash({ slug: result.slug, templateId });
        launchTimeoutRef.current = setTimeout(() => {
          window.location.href = `/account/builder?store=${encodeURIComponent(result.slug)}`;
        }, 2300);
      }
    });
  }

  function goBack() {
    setDirection(-1);
    setStepIndex((current) => Math.max(0, current - 1));
  }

  const FALLBACK_ACTIVITY: { id: BusinessType; en: string; ar: string } = {
    id: 'something_else',
    en: 'Something else',
    ar: 'شيء آخر',
  };
  const selectedActivity = ACTIVITIES.find((a) => a.id === activity) ?? FALLBACK_ACTIVITY;
  const selectedTemplate = templatePresets[templateId];
  const splashTemplate = launchSplash ? templatePresets[launchSplash.templateId] : selectedTemplate;
  const splashPalette = palettes[splashTemplate.palette][isDark ? 'dark' : 'light'];

  // Auth3-matched theme tokens
  const shellBg = isDark ? '#050505' : '#E8DCC4';
  const shellText = isDark ? '#FFF8EF' : '#1F1B16';
  const cardBg = isDark ? 'rgba(17, 17, 17, 0.93)' : 'rgba(241, 233, 215, 0.94)';
  const cardBorder = isDark ? 'rgba(255, 190, 138, 0.2)' : 'rgba(31, 27, 22, 0.14)';
  const mutedText = isDark ? 'rgba(255, 248, 239, 0.68)' : 'rgba(31, 27, 22, 0.62)';
  const fieldBg = isDark ? 'rgba(20, 17, 14, 0.7)' : 'rgba(255, 255, 255, 0.56)';
  const fieldBorder = isDark ? 'rgba(255, 190, 138, 0.24)' : 'rgba(31, 27, 22, 0.18)';
  const accent = isDark ? '#ffbe8a' : '#1f1b16';
  const accentInk = isDark ? '#15110d' : '#f1e9d7';
  const overlay = isDark
    ? 'radial-gradient(circle at 18% 16%, rgba(255, 190, 138, 0.28), transparent 34%), radial-gradient(circle at 82% 78%, rgba(255, 190, 138, 0.16), transparent 38%), linear-gradient(120deg, rgba(0, 0, 0, 0.84), rgba(0, 0, 0, 0.34) 52%, rgba(0, 0, 0, 0.78))'
    : 'radial-gradient(circle at 16% 16%, rgba(255, 190, 138, 0.52), transparent 34%), radial-gradient(circle at 80% 78%, rgba(139, 58, 58, 0.14), transparent 38%), linear-gradient(120deg, rgba(232, 220, 196, 0.76), rgba(241, 233, 215, 0.2) 52%, rgba(232, 220, 196, 0.68))';

  const stepCopy = t.steps[activeKey];
  const isFinalStep = stepIndex === STEP_KEYS.length - 1;

  // RTL flip for slide direction
  const slideX = (dir: number) => (isRtl ? -dir : dir) * 28;

  function renderStep() {
    if (activeKey === 'identity') {
      const c = t.steps.identity;
      return (
        <div className="begin-form">
          <label className="begin-field">
            <span>{c.brandLabel}</span>
            <input
              name="brandName"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder={c.brandPlaceholder}
              autoComplete="organization"
              dir={isRtl ? 'rtl' : 'ltr'}
            />
          </label>

          <div className="begin-row">
            <label className="begin-field begin-field-grow">
              <span>{c.subdomainLabel}</span>
              <div className="begin-subdomain">
                <input
                  name="slug"
                  value={slug}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                    setSlugStatus({ status: 'idle' });
                  }}
                  placeholder={c.subdomainPlaceholder}
                  autoComplete="off"
                  dir="ltr"
                />
                <em>.souqna.qa</em>
              </div>
            </label>
            <button
              type="button"
              className="begin-check"
              onClick={() => void checkAvailability()}
              disabled={isChecking || slug.length < 3}
            >
              {isChecking ? c.checking : c.check}
            </button>
          </div>

          <p className={`begin-status is-${slugStatus.status}`} role="status" aria-live="polite">
            {statusText(t, slugStatus, slug)}
            {slugStatus.status === 'taken' ? (
              <button
                type="button"
                onClick={() => {
                  setSlugTouched(true);
                  setSlug(slugStatus.suggestion);
                  setSlugStatus({ status: 'idle' });
                }}
              >
                {t.slug.use(slugStatus.suggestion)}
              </button>
            ) : null}
          </p>

          <label className="begin-logo">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => handleLogo(event.target.files?.[0] ?? null)}
            />
            <span
              className={`begin-logo-mark${logoPreview ? ' has-image' : ''}`}
              style={logoPreview ? { backgroundImage: `url("${logoPreview}")` } : undefined}
              aria-hidden
            >
              {logoPreview ? null : brandInitial}
            </span>
            <span className="begin-logo-text">
              <b>{c.logoLabel}</b>
              <small>{logoName || c.logoHint}</small>
            </span>
          </label>
        </div>
      );
    }

    if (activeKey === 'activity') {
      return (
        <div className="begin-grid" role="radiogroup" aria-label={t.steps.activity.title}>
          {ACTIVITIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`begin-chip${activity === item.id ? ' is-selected' : ''}`}
              onClick={() => setActivity(item.id)}
              role="radio"
              aria-checked={activity === item.id}
            >
              <span>{isRtl ? item.ar : item.en}</span>
              <small dir={isRtl ? 'ltr' : 'rtl'}>{isRtl ? item.en : item.ar}</small>
            </button>
          ))}
        </div>
      );
    }

    if (activeKey === 'template') {
      return (
        <div className="begin-template-picker" role="radiogroup" aria-label={t.steps.template.title}>
          {TEMPLATE_PICKER_IDS.map((id) => (
            <TemplateChoice
              key={id}
              templateId={id}
              businessType={activity}
              brandName={brandName}
              isSelected={templateId === id}
              isRtl={isRtl}
              onSelect={() => setTemplateId(id)}
            />
          ))}
        </div>
      );
    }

    const c = t.steps.confirmation;
    return (
      <div className="begin-confirm">
        <header className="begin-confirm-brand">
          <span
            className={`begin-logo-mark${logoPreview ? ' has-image' : ''}`}
            style={logoPreview ? { backgroundImage: `url("${logoPreview}")` } : undefined}
            aria-hidden
          >
            {logoPreview ? null : brandInitial}
          </span>
          <div>
            <strong>{brandName || (isRtl ? 'البراند' : 'Your brand')}</strong>
            <small dir="ltr">{slug || 'subdomain'}.souqna.qa</small>
          </div>
        </header>
        <dl className="begin-confirm-list">
          <div>
            <dt>{c.labels.subdomain}</dt>
            <dd dir="ltr">{slug || '—'}.souqna.qa</dd>
          </div>
          <div>
            <dt>{c.labels.activity}</dt>
            <dd>{isRtl ? selectedActivity.ar : selectedActivity.en}</dd>
          </div>
          <div>
            <dt>{c.labels.template}</dt>
            <dd>{selectedTemplate.label}</dd>
          </div>
        </dl>
        {createState.status === 'error' ? (
          <p className="begin-launch-error" role="alert">
            {createState.message || t.launch.generic}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={locale}
      className="begin-shell relative min-h-dvh overflow-x-hidden overflow-y-auto"
      style={{
        background: shellBg,
        color: shellText,
        fontFamily: isRtl
          ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
          : 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <StarSwipe
        className="absolute inset-0 h-full w-full"
        color="#ffbe8a"
        backgroundColor={shellBg}
        speed={0.22}
        scale={1.18}
        warpStrength={1.35}
        warpCurvature={5.8}
        warpFalloff={4}
        scrollSpeed={5.2}
        noiseAmount={0.38}
        colorIntensity={isDark ? 0.46 : 0.28}
        colorSeparation={0.045}
        rotation={isRtl ? 42 : -42}
        opacity={isDark ? 1 : 0.82}
      />
      <div className="absolute inset-0" style={{ background: overlay }} aria-hidden />

      <AnimatePresence>
        {launchSplash ? (
          <motion.div
            className="begin-launch-splash"
            data-template={launchSplash.templateId}
            style={
              {
                '--launch-ground': splashPalette.ground,
                '--launch-ink': splashPalette.ink,
                '--launch-accent': splashPalette.accent,
              } as CSSProperties
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
          >
            <div className="begin-launch-orbit" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <motion.div
              className="begin-launch-panel"
              initial={{ scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              <small>{splashTemplate.label}</small>
              <strong>{t.launch.welcome(brandName.trim() || launchSplash.slug)}</strong>
              <p>{t.launch.quote}</p>
              <div className="begin-launch-loader" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-12">
        <div
          className={`begin-workspace grid w-full items-start gap-9 md:grid-cols-[420px_minmax(0,260px)]${activeKey === 'template' ? ' is-template-step' : ''}`}
          style={{ maxWidth: activeKey === 'template' ? 1120 : 800 }}
        >
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="begin-card"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              color: shellText,
              boxShadow: isDark
                ? '0 26px 70px rgba(0, 0, 0, 0.58)'
                : '0 26px 70px rgba(31, 27, 22, 0.16)',
            }}
          >
            <header className="begin-card-head">
              <span className="begin-pill" style={{ background: accent, color: accentInk }}>
                {t.pill}
              </span>
              <ol className="begin-progress" aria-label={t.stepCount(stepIndex + 1)}>
                {STEP_KEYS.map((key, idx) => (
                  <li
                    key={key}
                    className={
                      idx === stepIndex ? 'is-active' : idx < stepIndex ? 'is-done' : ''
                    }
                    aria-current={idx === stepIndex ? 'step' : undefined}
                  />
                ))}
              </ol>
            </header>

            <div className="begin-step-region">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeKey}
                  custom={direction}
                  initial={{ opacity: 0, x: slideX(direction) }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: slideX(-direction) }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="begin-step"
                >
                  <SplitText
                    tag="h1"
                    text={stepCopy.title}
                    delay={isRtl ? 60 : 26}
                    duration={0.55}
                    ease="power3.out"
                    splitType={isRtl ? 'words' : 'chars'}
                    from={{ opacity: 0, y: 18 }}
                    to={{ opacity: 1, y: 0 }}
                    threshold={0.05}
                    rootMargin="0px"
                    textAlign={isRtl ? 'right' : 'left'}
                    className="begin-title"
                    style={{
                      color: shellText,
                      fontFamily: isRtl
                        ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
                        : 'var(--font-english), ui-sans-serif, system-ui, sans-serif',
                    }}
                  />
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="begin-card-foot">
              <button
                type="button"
                className="begin-back"
                disabled={stepIndex === 0 || isCreating}
                onClick={goBack}
              >
                {isRtl ? '→' : '←'} {t.back}
              </button>
              <p>{t.stepCount(stepIndex + 1)}</p>
              {isFinalStep ? (
                <MetalFrame strength={0.65} borderRadius={999}>
                  <button
                    type="button"
                    className="begin-next"
                    disabled={!canContinue || isCreating}
                    onClick={goNext}
                    style={{ background: accent, color: accentInk }}
                  >
                    {isCreating
                      ? t.creating
                      : isSignedIn
                        ? t.createWebstore
                        : t.create}{' '}
                    {isRtl ? '←' : '→'}
                  </button>
                </MetalFrame>
              ) : (
                <button
                  type="button"
                  className="begin-next"
                  disabled={!canContinue || isCreating}
                  onClick={goNext}
                  style={{ background: accent, color: accentInk }}
                >
                  {t.next} {isRtl ? '←' : '→'}
                </button>
              )}
            </footer>
          </motion.section>

          <motion.aside
            key={`side-${activeKey}`}
            initial={{ opacity: 0, x: isRtl ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="begin-side hidden md:block"
          >
            <SplitText
              tag="h2"
              text={stepCopy.side}
              delay={isRtl ? 70 : 32}
              duration={0.62}
              ease="power3.out"
              splitType={isRtl ? 'words' : 'chars'}
              from={{ opacity: 0, y: 22 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.05}
              rootMargin="0px"
              textAlign={isRtl ? 'right' : 'left'}
              className="begin-side-title"
              style={{
                color: shellText,
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
                  : 'var(--font-english), ui-sans-serif, system-ui, sans-serif',
              }}
            />
            <p style={{ color: mutedText }}>{stepCopy.body}</p>
            <p className="begin-side-intro" style={{ color: mutedText }}>
              {t.intro}
            </p>
          </motion.aside>
        </div>
      </div>

      <style jsx global>{`
        .begin-shell {
          --begin-accent: ${accent};
          --begin-accent-ink: ${accentInk};
          --begin-field-bg: ${fieldBg};
          --begin-field-border: ${fieldBorder};
          --begin-muted: ${mutedText};
          --begin-text: ${shellText};
        }

        .begin-launch-splash {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--launch-accent) 26%, transparent), transparent 34%),
            linear-gradient(135deg, var(--launch-ground), color-mix(in srgb, var(--launch-ground) 76%, var(--launch-ink) 24%));
          color: var(--launch-ink);
        }

        .begin-launch-orbit {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          opacity: 0.82;
        }

        .begin-launch-orbit span {
          position: absolute;
          width: min(72vw, 620px);
          aspect-ratio: 1;
          border: 1px solid color-mix(in srgb, var(--launch-accent) 52%, transparent);
          border-radius: 999px;
          transform: rotate(var(--orbit-rotate, 0deg)) scale(var(--orbit-scale, 1));
          animation: begin-launch-orbit 2.3s ease-in-out infinite;
        }

        .begin-launch-orbit span:nth-child(2) {
          --orbit-rotate: 54deg;
          --orbit-scale: 0.72;
          animation-delay: 0.16s;
        }

        .begin-launch-orbit span:nth-child(3) {
          --orbit-rotate: -38deg;
          --orbit-scale: 0.46;
          animation-delay: 0.32s;
          border-style: dashed;
        }

        .begin-launch-panel {
          position: relative;
          z-index: 1;
          width: min(520px, calc(100vw - 40px));
          min-height: 270px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
          padding: 34px;
          border-radius: 18px;
          border: 1px solid color-mix(in srgb, var(--launch-accent) 48%, transparent);
          background: color-mix(in srgb, var(--launch-ground) 82%, transparent);
          box-shadow: 0 30px 90px color-mix(in srgb, var(--launch-ink) 22%, transparent);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          text-align: center;
        }

        .begin-launch-panel small,
        .begin-launch-loader {
          font-family: var(--font-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .begin-launch-panel small {
          font-size: 11px;
          color: color-mix(in srgb, var(--launch-accent) 86%, var(--launch-ink) 14%);
        }

        .begin-launch-panel strong {
          display: block;
          font-family: var(--font-english), var(--font-sans), system-ui, sans-serif;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 0.95;
          font-weight: 800;
        }

        .begin-launch-panel p {
          max-width: 34ch;
          margin: 0 auto;
          color: color-mix(in srgb, var(--launch-ink) 70%, transparent);
          font-size: 14px;
          line-height: 1.55;
        }

        .begin-launch-loader {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          width: min(260px, 78%);
          margin: 10px auto 0;
        }

        .begin-launch-loader i {
          display: block;
          height: 7px;
          border-radius: 999px;
          background: var(--launch-accent);
          transform-origin: center;
          animation: begin-launch-loader 0.86s ease-in-out infinite;
        }

        .begin-launch-loader i:nth-child(2) {
          animation-delay: 0.08s;
        }

        .begin-launch-loader i:nth-child(3) {
          animation-delay: 0.16s;
        }

        .begin-launch-loader i:nth-child(4) {
          animation-delay: 0.24s;
        }

        .begin-launch-splash[data-template='souqline'] .begin-launch-orbit span {
          border-radius: 14px;
        }

        .begin-launch-splash[data-template='kiosk'] .begin-launch-panel {
          border-radius: 999px;
        }

        .begin-launch-splash[data-template='lounge'] .begin-launch-loader {
          grid-template-columns: 1fr;
        }

        .begin-launch-splash[data-template='bazaar'] .begin-launch-orbit span,
        .begin-launch-splash[data-template='frame'] .begin-launch-orbit span {
          border-style: dotted;
        }

        .begin-launch-splash[data-template='launchpad'] .begin-launch-loader i {
          clip-path: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%);
        }

        @keyframes begin-launch-orbit {
          0%,
          100% {
            transform: rotate(var(--orbit-rotate, 0deg)) scale(var(--orbit-scale, 1));
            opacity: 0.32;
          }
          50% {
            transform: rotate(calc(var(--orbit-rotate, 0deg) + 18deg)) scale(calc(var(--orbit-scale, 1) + 0.04));
            opacity: 0.86;
          }
        }

        @keyframes begin-launch-loader {
          0%,
          100% {
            transform: scaleY(0.48);
            opacity: 0.42;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        .begin-card {
          width: 100%;
          padding: 26px 24px 22px;
          border-radius: 14px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .begin-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .begin-pill {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 5px 11px;
          border-radius: 999px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .begin-progress {
          display: inline-flex;
          gap: 6px;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .begin-progress li {
          width: 22px;
          height: 3px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--begin-text) 18%, transparent);
          transition: background 240ms ease, transform 240ms ease;
        }

        .begin-progress li.is-active {
          background: var(--begin-accent);
          transform: scaleX(1.08);
        }

        .begin-progress li.is-done {
          background: color-mix(in srgb, var(--begin-accent) 64%, transparent);
        }

        .begin-step-region {
          position: relative;
          min-height: 320px;
        }

        .begin-step {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .begin-title {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0;
        }

        .begin-shell[dir='rtl'] .begin-title {
          font-family: var(--font-arabic-serif), var(--font-arabic), system-ui, sans-serif !important;
          font-weight: 700;
          line-height: 1.18;
        }

        .begin-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .begin-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .begin-field > span {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--begin-muted);
        }

        .begin-field input {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border-radius: 9px;
          border: 1px solid var(--begin-field-border);
          background: var(--begin-field-bg);
          color: var(--begin-text);
          font-size: 13px;
          font-family: inherit;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .begin-field input:focus {
          outline: none;
          border-color: var(--begin-accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--begin-accent) 24%, transparent);
        }

        .begin-field input::placeholder {
          color: color-mix(in srgb, var(--begin-text) 38%, transparent);
        }

        .begin-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }

        .begin-field-grow {
          flex: 1;
          min-width: 0;
        }

        .begin-subdomain {
          display: flex;
          align-items: center;
          height: 38px;
          padding: 0 12px;
          border-radius: 9px;
          border: 1px solid var(--begin-field-border);
          background: var(--begin-field-bg);
          gap: 6px;
        }

        .begin-subdomain input {
          flex: 1;
          height: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--begin-text);
        }

        .begin-subdomain input:focus {
          outline: none;
          box-shadow: none;
        }

        .begin-subdomain em {
          font-family: var(--font-mono);
          font-size: 12px;
          font-style: normal;
          color: var(--begin-muted);
        }

        .begin-shell[dir='rtl'] .begin-subdomain {
          flex-direction: row-reverse;
        }

        .begin-check {
          height: 38px;
          padding: 0 14px;
          border-radius: 9px;
          border: 1px solid var(--begin-field-border);
          background: transparent;
          color: var(--begin-text);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease;
        }

        .begin-check:hover:not(:disabled) {
          border-color: var(--begin-accent);
          background: color-mix(in srgb, var(--begin-accent) 14%, transparent);
        }

        .begin-check:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .begin-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          min-height: 18px;
          font-size: 12px;
          color: var(--begin-muted);
        }

        .begin-status.is-available {
          color: color-mix(in srgb, var(--begin-accent) 88%, var(--begin-text));
        }

        .begin-status.is-taken,
        .begin-status.is-reserved,
        .begin-status.is-rate_limited {
          color: #d27a4a;
        }

        .begin-status button {
          padding: 4px 9px;
          border-radius: 999px;
          border: 1px solid var(--begin-field-border);
          background: transparent;
          color: inherit;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .begin-logo {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          border: 1px dashed var(--begin-field-border);
          background: color-mix(in srgb, var(--begin-field-bg) 70%, transparent);
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease;
        }

        .begin-logo:hover {
          border-color: var(--begin-accent);
        }

        .begin-logo input[type='file'] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .begin-logo-mark {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: var(--begin-accent);
          color: var(--begin-accent-ink);
          font-family: var(--font-english);
          font-weight: 700;
          font-size: 18px;
          background-size: cover;
          background-position: center;
        }

        .begin-logo-mark.has-image {
          color: transparent;
        }

        .begin-logo-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .begin-logo-text b {
          font-size: 12px;
          font-weight: 700;
        }

        .begin-logo-text small {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--begin-muted);
        }

        .begin-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .begin-chip {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 11px 13px;
          border-radius: 11px;
          border: 1px solid var(--begin-field-border);
          background: var(--begin-field-bg);
          color: var(--begin-text);
          text-align: start;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .begin-chip:hover {
          transform: translateY(-1px);
          border-color: var(--begin-accent);
        }

        .begin-chip.is-selected {
          border-color: var(--begin-accent);
          background: color-mix(in srgb, var(--begin-accent) 16%, var(--begin-field-bg));
        }

        .begin-chip span {
          font-size: 13px;
          font-weight: 600;
        }

        .begin-chip small {
          font-size: 10px;
          color: var(--begin-muted);
        }

        .begin-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .begin-tile {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--begin-field-border);
          background: var(--begin-field-bg);
          color: var(--begin-text);
          text-align: start;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .begin-tile:hover {
          transform: translateY(-1px);
          border-color: var(--begin-accent);
        }

        .begin-tile.is-selected {
          border-color: var(--begin-accent);
          background: color-mix(in srgb, var(--begin-accent) 16%, var(--begin-field-bg));
        }

        .begin-tile strong {
          font-size: 13px;
          font-weight: 700;
        }

        .begin-tile span {
          font-size: 12px;
          color: var(--begin-muted);
          line-height: 1.45;
        }

        .begin-workspace.is-template-step {
          grid-template-columns: minmax(0, 690px) minmax(240px, 320px);
        }

        .begin-workspace.is-template-step .begin-card {
          padding: 24px;
        }

        .begin-workspace.is-template-step .begin-step-region {
          min-height: 470px;
        }

        .begin-template-picker {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          max-height: min(47vh, 500px);
          overflow: auto;
          padding: 2px 4px 2px 0;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--begin-accent) 55%, transparent) transparent;
        }

        .begin-shell[dir='rtl'] .begin-template-picker {
          padding: 2px 0 2px 4px;
        }

        .begin-template-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 282px;
          border-radius: 14px;
          border: 1px solid var(--begin-field-border);
          background: color-mix(in srgb, var(--tpl-ground) 76%, transparent);
          color: var(--tpl-ink);
          text-align: start;
          cursor: pointer;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .begin-template-card:hover {
          transform: translateY(-2px);
          border-color: var(--begin-accent);
        }

        .begin-template-card.is-selected {
          border-color: var(--begin-accent);
          box-shadow:
            0 0 0 2px color-mix(in srgb, var(--begin-accent) 42%, transparent),
            0 18px 42px color-mix(in srgb, var(--tpl-ink) 18%, transparent);
        }

        .begin-template-preview {
          position: relative;
          min-height: 172px;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 12%, color-mix(in srgb, var(--tpl-accent) 42%, transparent), transparent 28%),
            linear-gradient(135deg, var(--tpl-ground), color-mix(in srgb, var(--tpl-ground) 58%, var(--tpl-ink) 42%));
        }

        .begin-template-preview::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(110deg, transparent 0 54%, color-mix(in srgb, var(--tpl-accent) 18%, transparent) 54% 58%, transparent 58%),
            radial-gradient(circle at 82% 84%, color-mix(in srgb, var(--tpl-ink) 24%, transparent), transparent 32%);
          pointer-events: none;
        }

        .tpl-visual {
          position: absolute;
          inset: 12px;
          z-index: 1;
          color: var(--tpl-ink);
        }

        .tpl-visual b,
        .tpl-visual strong,
        .tpl-visual span,
        .tpl-visual small,
        .tpl-visual em,
        .tpl-visual p,
        .tpl-visual footer {
          position: relative;
          z-index: 1;
        }

        .tpl-visual small,
        .tpl-visual em,
        .tpl-visual footer,
        .tpl-visual li,
        .tpl-souqline header span,
        .tpl-feature-grid i {
          font-family: var(--font-mono);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .tpl-visual small {
          font-size: 8px;
          color: color-mix(in srgb, var(--tpl-ink) 62%, transparent);
        }

        .tpl-atrium {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 8px;
        }

        .tpl-atrium-hero,
        .tpl-atrium-mosaic i,
        .tpl-kiosk-product,
        .tpl-souq-grid i,
        .tpl-vitrine-cover,
        .tpl-vitrine i,
        .tpl-vitrine em,
        .tpl-process i,
        .tpl-frame i,
        .tpl-bazaar-row i {
          background-position: center;
          background-size: cover;
        }

        .tpl-atrium-hero {
          border-radius: 16px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          box-shadow: inset 0 -90px 56px rgba(0, 0, 0, 0.54);
          color: #fff;
        }

        .tpl-atrium-hero b {
          font-size: 18px;
          line-height: 1;
        }

        .tpl-atrium-hero span {
          margin-top: 8px;
          width: fit-content;
          padding: 6px 8px;
          border-radius: 999px;
          background: var(--tpl-accent);
          color: var(--tpl-ground);
          font-size: 9px;
          font-weight: 800;
        }

        .tpl-atrium-mosaic {
          display: grid;
          gap: 7px;
        }

        .tpl-atrium-mosaic i {
          border-radius: 14px;
          min-height: 0;
        }

        .tpl-souqline {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .tpl-souqline header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tpl-souqline header b {
          margin-inline-end: auto;
          font-size: 15px;
        }

        .tpl-souqline header span {
          padding: 4px 6px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--tpl-accent) 18%, transparent);
          font-size: 7px;
        }

        .tpl-souq-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }

        .tpl-souq-grid i {
          min-height: 55px;
          border-radius: 10px;
          padding: 7px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          color: #fff;
          box-shadow: inset 0 -62px 38px rgba(0, 0, 0, 0.58);
          font-style: normal;
        }

        .tpl-souq-grid strong,
        .tpl-souq-grid em {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tpl-souq-grid strong {
          font-size: 8px;
        }

        .tpl-souq-grid em {
          font-size: 7px;
          font-style: normal;
          opacity: 0.75;
        }

        .tpl-kiosk {
          display: grid;
          grid-template-columns: 1fr 0.82fr;
          gap: 10px;
          align-items: stretch;
        }

        .tpl-kiosk-product {
          border-radius: 999px 999px 20px 20px;
          box-shadow: 0 16px 34px color-mix(in srgb, var(--tpl-ink) 20%, transparent);
        }

        .tpl-kiosk-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .tpl-kiosk-copy b {
          margin-top: 6px;
          font-size: 18px;
          line-height: 1.05;
        }

        .tpl-kiosk-copy span,
        .tpl-kiosk ul {
          margin-top: 10px;
          padding: 8px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--tpl-accent) 20%, transparent);
          font-size: 9px;
          font-weight: 800;
        }

        .tpl-kiosk ul {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          list-style: none;
          margin: 0;
        }

        .tpl-lounge {
          padding: 12px;
          border-radius: 18px;
          background: color-mix(in srgb, var(--tpl-ink) 88%, transparent);
          color: var(--tpl-ground);
        }

        .tpl-lounge header,
        .tpl-lounge p {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: baseline;
        }

        .tpl-lounge header {
          padding-bottom: 8px;
          border-bottom: 1px solid color-mix(in srgb, var(--tpl-ground) 26%, transparent);
        }

        .tpl-lounge p {
          margin: 8px 0 0;
          font-size: 9px;
        }

        .tpl-lounge p span {
          grid-column: 1 / -1;
          opacity: 0.55;
          font-size: 8px;
        }

        .tpl-lounge footer {
          margin-top: 10px;
          color: var(--tpl-accent);
          font-size: 8px;
        }

        .tpl-studio {
          display: grid;
          grid-template-columns: 1fr 76px;
          gap: 8px;
        }

        .tpl-studio header {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tpl-studio header b {
          font-size: 16px;
        }

        .tpl-studio header span,
        .tpl-calendar {
          border-radius: 14px;
          background: var(--tpl-accent);
          color: var(--tpl-ground);
        }

        .tpl-studio header span {
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 800;
        }

        .tpl-studio p {
          margin: 0;
          padding: 8px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--tpl-ground) 66%, var(--tpl-ink) 14%);
        }

        .tpl-studio p strong {
          display: block;
          font-size: 9px;
        }

        .tpl-studio p span {
          display: block;
          margin-top: 4px;
          font-size: 8px;
          line-height: 1.25;
          color: color-mix(in srgb, var(--tpl-ink) 66%, transparent);
        }

        .tpl-calendar {
          grid-column: 2;
          grid-row: 2 / span 3;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px;
          padding: 10px;
        }

        .tpl-calendar i {
          border-radius: 8px;
          background: color-mix(in srgb, var(--tpl-ground) 74%, transparent);
        }

        .tpl-bazaar {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .tpl-drop {
          width: fit-content;
          padding: 6px 8px;
          border-radius: 999px;
          background: var(--tpl-accent);
          color: var(--tpl-ground);
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .tpl-bazaar > b {
          max-width: 16ch;
          font-size: 18px;
          line-height: 1;
        }

        .tpl-bazaar-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 0.8fr;
          gap: 7px;
          flex: 1;
        }

        .tpl-bazaar-row i {
          border-radius: 14px;
        }

        .tpl-bazaar footer {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: color-mix(in srgb, var(--tpl-ink) 70%, transparent);
        }

        .tpl-vitrine {
          display: grid;
          grid-template-columns: 1fr 0.72fr;
          grid-template-rows: 1fr 0.8fr;
          gap: 8px;
        }

        .tpl-vitrine-cover {
          grid-row: 1 / -1;
          border-radius: 18px 18px 18px 60px;
        }

        .tpl-vitrine-copy {
          padding: 10px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--tpl-ground) 70%, transparent);
        }

        .tpl-vitrine-copy b {
          display: block;
          margin-top: 4px;
          font-family: var(--font-serif);
          font-size: 20px;
          line-height: 0.95;
        }

        .tpl-vitrine-copy span {
          display: block;
          margin-top: 6px;
          font-size: 8px;
          line-height: 1.3;
        }

        .tpl-vitrine i,
        .tpl-vitrine em {
          border-radius: 14px;
          font-style: normal;
        }

        .tpl-monoline {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 12px;
        }

        .tpl-monoline b {
          font-family: var(--font-serif);
          font-size: 24px;
          line-height: 1;
        }

        .tpl-monoline > div {
          width: 70%;
          height: 1px;
          margin: 10px 0;
          background: var(--tpl-accent);
        }

        .tpl-monoline p {
          width: 100%;
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 9px;
        }

        .tpl-monoline footer {
          margin-top: auto;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--tpl-accent);
          font-size: 8px;
        }

        .tpl-harvest {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .tpl-harvest header b {
          display: block;
          max-width: 19ch;
          font-size: 17px;
          line-height: 1.05;
        }

        .tpl-process {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 7px;
          min-height: 70px;
        }

        .tpl-process i {
          border-radius: 999px 999px 14px 14px;
        }

        .tpl-harvest p {
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-size: 9px;
          line-height: 1.35;
          color: color-mix(in srgb, var(--tpl-ink) 70%, transparent);
        }

        .tpl-launchpad {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
        }

        .tpl-launchpad b {
          max-width: 18ch;
          font-size: 20px;
          line-height: 1;
        }

        .tpl-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .tpl-feature-grid i {
          padding: 12px 8px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--tpl-accent) 18%, transparent);
          font-size: 9px;
          font-style: normal;
        }

        .tpl-launchpad footer {
          margin-top: auto;
          padding: 8px 10px;
          border-radius: 999px;
          background: var(--tpl-accent);
          color: var(--tpl-ground);
          width: fit-content;
          font-size: 8px;
        }

        .tpl-frame {
          display: grid;
          grid-template-columns: 1.35fr 0.8fr;
          grid-template-rows: 1fr 1fr;
          gap: 8px;
          color: #fff;
        }

        .tpl-frame i {
          border-radius: 14px;
          box-shadow: inset 0 -44px 30px rgba(0, 0, 0, 0.38);
        }

        .tpl-frame i.is-large {
          grid-row: 1 / -1;
        }

        .tpl-frame span,
        .tpl-frame b {
          position: absolute;
          inset-inline-start: 12px;
          text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
        }

        .tpl-frame span {
          bottom: 32px;
          font-size: 18px;
          font-weight: 800;
        }

        .tpl-frame b {
          bottom: 13px;
          font-size: 9px;
        }

        .begin-template-browser {
          position: absolute;
          inset-inline: 14px;
          top: 12px;
          z-index: 1;
          display: flex;
          gap: 5px;
        }

        .begin-template-browser span {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--tpl-ink) 40%, transparent);
        }

        .begin-template-hero {
          position: absolute;
          z-index: 1;
          inset-inline: 14px;
          top: 30px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: end;
        }

        .begin-template-hero div {
          min-width: 0;
        }

        .begin-template-hero small,
        .begin-template-products i,
        .begin-template-meta li {
          font-family: var(--font-mono);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .begin-template-hero small {
          display: block;
          max-width: 26ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 8px;
          color: color-mix(in srgb, var(--tpl-ink) 62%, transparent);
        }

        .begin-template-hero strong {
          display: block;
          margin-top: 5px;
          font-size: 20px;
          line-height: 1;
          color: var(--tpl-ink);
        }

        .begin-template-hero span {
          display: block;
          margin-top: 6px;
          max-width: 30ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          color: color-mix(in srgb, var(--tpl-ink) 70%, transparent);
        }

        .begin-template-hero em {
          align-self: start;
          padding: 7px 9px;
          border-radius: 999px;
          background: var(--tpl-accent);
          color: var(--tpl-ground);
          font-style: normal;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .begin-template-products {
          position: absolute;
          z-index: 1;
          inset-inline: 14px;
          bottom: 14px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 8px;
        }

        .begin-template-products span {
          min-height: 48px;
          padding: 9px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          position: relative;
          background-position: center;
          background-size: cover;
          color: #fff;
          box-shadow: inset 0 -70px 46px rgba(0, 0, 0, 0.52);
        }

        .begin-template-products span.is-featured {
          grid-row: span 2;
        }

        .begin-template-products b,
        .begin-template-products i {
          position: relative;
          z-index: 1;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .begin-template-products b {
          font-size: 10px;
          line-height: 1.2;
        }

        .begin-template-products i {
          margin-top: 3px;
          font-size: 8px;
          font-style: normal;
          opacity: 0.78;
        }

        .begin-template-meta {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 13px;
          background: color-mix(in srgb, var(--tpl-ground) 84%, var(--tpl-ink) 16%);
          color: var(--tpl-ink);
          flex: 1;
        }

        .begin-template-meta strong {
          display: block;
          font-size: 14px;
          line-height: 1.2;
        }

        .begin-template-meta span {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-top: 5px;
          font-size: 11px;
          line-height: 1.35;
          color: color-mix(in srgb, var(--tpl-ink) 70%, transparent);
        }

        .begin-template-meta ul {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: auto 0 0;
          padding: 0;
          list-style: none;
        }

        .begin-template-meta li {
          padding: 5px 7px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--tpl-accent) 18%, transparent);
          color: color-mix(in srgb, var(--tpl-ink) 78%, transparent);
          font-size: 8px;
          font-weight: 700;
        }

        .begin-confirm {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .begin-confirm-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .begin-confirm-brand strong {
          display: block;
          font-size: 15px;
          font-weight: 700;
        }

        .begin-confirm-brand small {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--begin-muted);
        }

        .begin-confirm-list {
          margin: 0;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--begin-field-border);
          background: var(--begin-field-bg);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .begin-confirm-list > div {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .begin-confirm-list dt {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--begin-muted);
        }

        .begin-confirm-list dd {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
        }

        .begin-launch-error {
          margin: 0;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(210, 122, 74, 0.42);
          background: rgba(210, 122, 74, 0.12);
          color: #d27a4a;
          font-size: 12px;
          line-height: 1.45;
        }

        .begin-card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .begin-card-foot p {
          margin: 0;
          flex: 1;
          text-align: center;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--begin-muted);
        }

        .begin-back,
        .begin-next {
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 160ms ease, transform 160ms ease, background 160ms ease;
        }

        .begin-back {
          background: transparent;
          border-color: var(--begin-field-border);
          color: var(--begin-text);
        }

        .begin-back:hover:not(:disabled) {
          border-color: var(--begin-accent);
        }

        .begin-back:disabled {
          opacity: 0.32;
          cursor: not-allowed;
        }

        .begin-next:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .begin-next:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .begin-side {
          padding-top: 18px;
        }

        .begin-side-title {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          line-height: 1.2;
        }

        .begin-shell[dir='rtl'] .begin-side-title {
          font-family: var(--font-arabic-serif), var(--font-arabic), system-ui, sans-serif !important;
        }

        .begin-side p {
          margin-top: 14px;
          font-size: 13px;
          line-height: 1.6;
          max-width: 28ch;
        }

        .begin-side-intro {
          margin-top: 22px !important;
          padding-top: 14px;
          border-top: 1px solid var(--begin-field-border);
          font-size: 12px !important;
          font-style: italic;
        }

        @media (max-width: 760px) {
          .begin-workspace.is-template-step {
            grid-template-columns: 1fr;
          }
          .begin-step-region {
            min-height: 280px;
          }
          .begin-workspace.is-template-step .begin-step-region {
            min-height: 450px;
          }
          .begin-grid {
            grid-template-columns: 1fr;
          }
          .begin-template-picker {
            grid-template-columns: 1fr;
            max-height: 58vh;
          }
          .begin-template-card {
            min-height: 292px;
          }
          .begin-template-hero {
            grid-template-columns: 1fr;
          }
          .begin-template-hero em {
            justify-self: start;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .begin-progress li,
          .begin-back,
          .begin-next,
          .begin-chip,
          .begin-tile,
          .begin-template-card {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
