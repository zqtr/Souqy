'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import {
  Archive,
  ArrowUp,
  BadgeCheck,
  Bell,
  Box,
  Brush,
  Camera,
  ChevronDown,
  Download,
  FileArchive,
  FileImage,
  FolderKanban,
  ImagePlus,
  History,
  ImageIcon,
  Lightbulb,
  Layers,
  LayoutTemplate,
  Maximize2,
  Mic2,
  Moon,
  Music2,
  Package,
  Palette,
  PanelLeft,
  Plus,
  Printer,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  TestTube2,
  Type,
  Upload,
  UsersRound,
  Video,
  Wand2,
  Waves,
} from 'lucide-react';
import type { Locale } from '@/i18n/locales';
import { souqyStudioFontVariables } from '@/lib/fonts';
import { palette } from '@/lib/tokens';
import DitherWave from '@/components/dither-wave';
import { SouqyLogo } from '@/components/admin/SouqyLogo';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { Loader } from '@/components/ui/loader';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { MetalFx } from 'metal-fx';

type CreationTemplate =
  | 'ad-creative'
  | 'brand-identity'
  | 'brand-kit'
  | 'launch-poster'
  | 'logo'
  | 'packaging-mockup'
  | 'product-card'
  | 'restaurant-menu'
  | 'short-video'
  | 'story-promo'
  | 'wide-banner';

type StudioFormatKey =
  | 'instagram-post'
  | 'instagram-story'
  | 'tiktok'
  | 'whatsapp-status'
  | 'snapchat'
  | 'x-banner'
  | 'a3-print'
  | 'menu-print'
  | 'product-card'
  | 'logo-square'
  | 'wide-banner';

type SouqyStudioAsset = {
  id?: string;
  kind:
    | 'logo'
    | 'wideLogo'
    | 'banner'
    | 'poster'
    | 'story'
    | 'og'
    | 'brand'
    | 'ad'
    | 'menu'
    | 'productCard'
    | 'packaging'
    | 'video';
  title: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  assetType?: CreationTemplate;
  formatKey?: StudioFormatKey;
  downloadFilename?: string;
};

type SouqyStudioProject = {
  id: string;
  businessName: string;
  locale: Locale;
  currentStep: 'logo' | 'banner' | 'brand-kit' | 'promos' | 'builder';
  storefrontSlug: string | null;
  confirmedLogoAssetId: string | null;
  confirmedBannerAssetId: string | null;
  confirmedBrandAssetId: string | null;
  brandKit: unknown;
  assets: SouqyStudioAsset[];
};

type CatalogStorefront = {
  slug: string;
  businessName: string;
  locale: Locale;
};

type CatalogProduct = {
  id: string;
  storefrontSlug: string;
  storefrontName: string;
  title: string;
  description: string | null;
  priceQar: number | null;
  imageUrl: string | null;
  category: string | null;
};

type StudioCard = SouqyStudioAsset & {
  localId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ReferenceImage = {
  id: string;
  name: string;
  url: string;
  file: File;
};

type LibraryState =
  | {
      status: 'success';
      project: SouqyStudioProject | null;
      assets: SouqyStudioAsset[];
      counts: Record<string, number>;
      storefronts: CatalogStorefront[];
      products: CatalogProduct[];
    }
  | { status: 'error'; message: string };

type ProjectState =
  | { status: 'success'; project: SouqyStudioProject }
  | { status: 'error'; message: string };

type GenerateState =
  | { status: 'success'; assets: SouqyStudioAsset[] }
  | { status: 'error'; message: string };

type Props = {
  locale: Locale;
};

type StudioModuleId =
  | 'command'
  | 'canvas'
  | 'brand'
  | 'motion'
  | 'campaign'
  | 'intelligence'
  | 'automation'
  | 'founder';

type StudioModule = {
  id: StudioModuleId;
  icon: ComponentType<{ size?: string | number }>;
  en: string;
  ar: string;
  descriptorEn: string;
  descriptorAr: string;
  state: 'live' | 'preview' | 'focus';
};

type RailTool = {
  id: string;
  moduleId: StudioModuleId;
  icon: ComponentType<{ size?: string | number }>;
  en: string;
  ar: string;
  state?: 'live' | 'preview' | 'locked' | 'focus';
};

type StudioSelectorId = 'template' | 'format';

const CREATION_TYPES: Array<{
  id: CreationTemplate;
  icon: ComponentType<{ size?: string | number }>;
  en: string;
  ar: string;
  hintEn: string;
  hintAr: string;
  defaultFormat: StudioFormatKey;
}> = [
  {
    id: 'logo',
    icon: BadgeCheck,
    en: 'Logo',
    ar: 'شعار',
    hintEn: 'Marks, icons, wordmarks',
    hintAr: 'علامات وشعارات وخطوط',
    defaultFormat: 'logo-square',
  },
  {
    id: 'launch-poster',
    icon: FileImage,
    en: 'Poster',
    ar: 'بوستر',
    hintEn: 'Launches and offers',
    hintAr: 'إطلاقات وعروض',
    defaultFormat: 'instagram-post',
  },
  {
    id: 'wide-banner',
    icon: LayoutTemplate,
    en: 'Banner',
    ar: 'بانر',
    hintEn: 'Storefront and web',
    hintAr: 'للمتجر والويب',
    defaultFormat: 'wide-banner',
  },
  {
    id: 'ad-creative',
    icon: MegaphoneIcon,
    en: 'Ad creative',
    ar: 'إعلان',
    hintEn: 'Paid social layouts',
    hintAr: 'إعلانات السوشال',
    defaultFormat: 'instagram-post',
  },
  {
    id: 'restaurant-menu',
    icon: Archive,
    en: 'Menu',
    ar: 'منيو',
    hintEn: 'Restaurants, cafes, salons',
    hintAr: 'مطاعم ومقاهي وصالونات',
    defaultFormat: 'menu-print',
  },
  {
    id: 'product-card',
    icon: ShoppingBag,
    en: 'Product card',
    ar: 'بطاقة منتج',
    hintEn: 'Catalog-led creative',
    hintAr: 'تصميم مرتبط بالكتالوج',
    defaultFormat: 'product-card',
  },
  {
    id: 'packaging-mockup',
    icon: Package,
    en: 'Packaging',
    ar: 'تغليف',
    hintEn: 'Labels, boxes, sleeves',
    hintAr: 'ملصقات وصناديق وتغليف',
    defaultFormat: 'instagram-post',
  },
  {
    id: 'brand-identity',
    icon: Palette,
    en: 'Brand identity',
    ar: 'هوية بصرية',
    hintEn: 'Full visual systems',
    hintAr: 'أنظمة بصرية كاملة',
    defaultFormat: 'wide-banner',
  },
  {
    id: 'brand-kit',
    icon: Sparkles,
    en: 'Brand kit',
    ar: 'عدة البراند',
    hintEn: 'Palette, type, mockups',
    hintAr: 'ألوان وخطوط وتطبيقات',
    defaultFormat: 'wide-banner',
  },
  {
    id: 'story-promo',
    icon: PanelLeft,
    en: 'Story promo',
    ar: 'ستوري',
    hintEn: 'Vertical social stories',
    hintAr: 'قصص عمودية للسوشال',
    defaultFormat: 'instagram-story',
  },
  {
    id: 'short-video',
    icon: Video,
    en: 'Short video',
    ar: 'فيديو قصير',
    hintEn: 'Motion-ready storyboards',
    hintAr: 'لوحات جاهزة للحركة',
    defaultFormat: 'tiktok',
  },
];

const FORMAT_PRESETS: Array<{
  id: StudioFormatKey;
  icon: ComponentType<{ size?: string | number }>;
  en: string;
  ar: string;
  size: string;
}> = [
  {
    id: 'instagram-post',
    icon: ImageIcon,
    en: 'Instagram Post',
    ar: 'بوست إنستغرام',
    size: '1080x1350',
  },
  {
    id: 'instagram-story',
    icon: PanelLeft,
    en: 'Instagram Story',
    ar: 'ستوري إنستغرام',
    size: '1080x1920',
  },
  { id: 'tiktok', icon: TikTokIcon, en: 'TikTok', ar: 'تيك توك', size: '1080x1920' },
  { id: 'snapchat', icon: GhostIcon, en: 'Snapchat', ar: 'سناب شات', size: '1080x1920' },
  {
    id: 'whatsapp-status',
    icon: WhatsAppIcon,
    en: 'WhatsApp Status',
    ar: 'حالة واتساب',
    size: '1080x1920',
  },
  { id: 'x-banner', icon: XIcon, en: 'X Banner', ar: 'بانر X', size: '1600x900' },
  { id: 'a3-print', icon: Printer, en: 'A3 Print', ar: 'طباعة A3', size: '297x420mm' },
  { id: 'menu-print', icon: Archive, en: 'Menu Print', ar: 'منيو للطباعة', size: 'A4' },
  {
    id: 'product-card',
    icon: ShoppingBag,
    en: 'Product Card',
    ar: 'بطاقة منتج',
    size: '1080x1080',
  },
  { id: 'logo-square', icon: BadgeCheck, en: 'Logo Square', ar: 'شعار مربع', size: '1024x1024' },
  {
    id: 'wide-banner',
    icon: LayoutTemplate,
    en: 'Wide Banner',
    ar: 'بانر عريض',
    size: '2400x1200',
  },
];

const STUDIO_MODULES: StudioModule[] = [
  {
    id: 'command',
    icon: ImagePlus,
    en: 'Create New',
    ar: 'مركز الأوامر',
    descriptorEn: 'AI workspace',
    descriptorAr: 'مساحة ذكاء',
    state: 'live',
  },
  {
    id: 'canvas',
    icon: ImageIcon,
    en: 'Image Studio',
    ar: 'اللوحة اللامحدودة',
    descriptorEn: 'Generation wall',
    descriptorAr: 'جدار التوليد',
    state: 'live',
  },
  {
    id: 'brand',
    icon: Palette,
    en: 'Brand Assets',
    ar: 'معمار الهوية',
    descriptorEn: 'Identity systems',
    descriptorAr: 'أنظمة الهوية',
    state: 'live',
  },
  {
    id: 'motion',
    icon: Video,
    en: 'Video Studio',
    ar: 'استوديو الحركة',
    descriptorEn: 'Reels and promo',
    descriptorAr: 'ريلز وإعلانات',
    state: 'preview',
  },
  {
    id: 'campaign',
    icon: Bell,
    en: 'Campaign Studio',
    ar: 'محرك الحملات',
    descriptorEn: 'Launch kits',
    descriptorAr: 'حزم إطلاق',
    state: 'preview',
  },
  {
    id: 'intelligence',
    icon: Store,
    en: 'Store Signals',
    ar: 'ذكاء المتجر',
    descriptorEn: 'Growth signals',
    descriptorAr: 'إشارات نمو',
    state: 'preview',
  },
  {
    id: 'automation',
    icon: FolderKanban,
    en: 'Flow Lab',
    ar: 'مختبر الأتمتة',
    descriptorEn: 'Workflow builder',
    descriptorAr: 'بناء التدفقات',
    state: 'preview',
  },
  {
    id: 'founder',
    icon: Moon,
    en: 'Founder Mode',
    ar: 'وضع المؤسس',
    descriptorEn: 'Deep focus',
    descriptorAr: 'تركيز كامل',
    state: 'focus',
  },
];

const RAIL_TOOLS: RailTool[] = [
  {
    id: 'image-new',
    moduleId: 'command',
    icon: ImagePlus,
    en: 'Image New',
    ar: 'Image New',
    state: 'live',
  },
  {
    id: 'draw-image',
    moduleId: 'canvas',
    icon: Wand2,
    en: 'Souqy Draw',
    ar: 'Souqy Draw',
    state: 'locked',
  },
  {
    id: 'video',
    moduleId: 'motion',
    icon: Video,
    en: 'Video Studio',
    ar: 'Video Studio',
    state: 'preview',
  },
  {
    id: 'avatar',
    moduleId: 'brand',
    icon: UsersRound,
    en: 'Founder Avatar',
    ar: 'Founder Avatar',
    state: 'preview',
  },
  {
    id: 'animate',
    moduleId: 'motion',
    icon: ClapperIcon,
    en: 'Souqy Animate',
    ar: 'Souqy Animate',
    state: 'preview',
  },
  {
    id: 'motion-studio',
    moduleId: 'motion',
    icon: Sparkles,
    en: 'Motion Studio',
    ar: 'Motion Studio',
    state: 'preview',
  },
  {
    id: 'brand-assets',
    moduleId: 'brand',
    icon: Archive,
    en: 'Brand Assets',
    ar: 'Brand Assets',
    state: 'live',
  },
  {
    id: 'creator-house',
    moduleId: 'campaign',
    icon: UsersRound,
    en: 'Creator House',
    ar: 'Creator House',
    state: 'preview',
  },
  {
    id: 'audio',
    moduleId: 'motion',
    icon: Waves,
    en: 'Audio Studio',
    ar: 'Audio Studio',
    state: 'preview',
  },
  {
    id: 'voiceover',
    moduleId: 'motion',
    icon: Mic2,
    en: 'Souqy Voiceover',
    ar: 'Souqy Voiceover',
    state: 'preview',
  },
  {
    id: 'upscale',
    moduleId: 'canvas',
    icon: Maximize2,
    en: 'Luxury Upscale',
    ar: 'Luxury Upscale',
    state: 'preview',
  },
  {
    id: 'three-d',
    moduleId: 'canvas',
    icon: Box,
    en: '3D Studio',
    ar: '3D Studio',
    state: 'preview',
  },
  {
    id: 'polish',
    moduleId: 'brand',
    icon: Brush,
    en: 'Product Polish',
    ar: 'Product Polish',
    state: 'preview',
  },
  {
    id: 'relight',
    moduleId: 'canvas',
    icon: Lightbulb,
    en: 'Studio Relight',
    ar: 'Studio Relight',
    state: 'preview',
  },
  {
    id: 'svg-studio',
    moduleId: 'brand',
    icon: ShapesIcon,
    en: 'SVG Studio',
    ar: 'SVG Studio',
    state: 'preview',
  },
  {
    id: 'prompt-studio',
    moduleId: 'command',
    icon: FileArchive,
    en: 'Prompt Studio',
    ar: 'Prompt Studio',
    state: 'live',
  },
  {
    id: 'khalat',
    moduleId: 'automation',
    icon: TestTube2,
    en: 'Khalat Lab',
    ar: 'Khalat Lab',
    state: 'preview',
  },
  {
    id: 'moodboards',
    moduleId: 'brand',
    icon: Layers,
    en: 'Smart Moodboards',
    ar: 'Smart Moodboards',
    state: 'preview',
  },
  {
    id: 'camera-angles',
    moduleId: 'canvas',
    icon: Camera,
    en: 'Camera Angles',
    ar: 'Camera Angles',
    state: 'preview',
  },
];

const QUICK_PROMPTS = [
  {
    en: 'Create a premium burger launch poster with warm lights and a bold Arabic headline.',
    ar: 'صمم بوستر إطلاق فاخر لمطعم برجر بإضاءة دافئة وعنوان عربي واضح.',
  },
  {
    en: 'Turn this brand into a full Instagram ad for the weekend offer.',
    ar: 'حوّل البراند إلى إعلان إنستغرام كامل لعرض نهاية الأسبوع.',
  },
  {
    en: 'Design a clean product card using my catalog item and Souqy colors.',
    ar: 'صمم بطاقة منتج نظيفة باستخدام منتج من الكتالوج وألوان سوقي.',
  },
  {
    en: 'Build an elegant cafe menu that is ready for print.',
    ar: 'جهز منيو مقهى أنيق وجاهز للطباعة.',
  },
];

const CAMPAIGN_KITS = [
  { en: 'Ramadan private drop', ar: 'إطلاق رمضاني خاص', channels: ['Meta', 'WhatsApp', 'Email'] },
  { en: 'Eid gift campaign', ar: 'حملة هدايا العيد', channels: ['Snap', 'TikTok', 'SMS'] },
  {
    en: 'Weekend launch sequence',
    ar: 'تسلسل إطلاق نهاية الأسبوع',
    channels: ['Meta', 'Email', 'Store'],
  },
];

const AUTOMATION_NODES = [
  { en: 'New order', ar: 'طلب جديد' },
  { en: 'AI reply', ar: 'رد ذكي' },
  { en: 'WhatsApp update', ar: 'تحديث واتساب' },
  { en: 'Founder alert', ar: 'تنبيه المؤسس' },
];

export function SouqyStudioIntro({ locale }: Props) {
  const isRtl = locale === 'ar';
  const [project, setProject] = useState<SouqyStudioProject | null>(null);
  const [assets, setAssets] = useState<SouqyStudioAsset[]>([]);
  const [cards, setCards] = useState<StudioCard[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [storefronts, setStorefronts] = useState<CatalogStorefront[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CreationTemplate>('launch-poster');
  const [selectedFormat, setSelectedFormat] = useState<StudioFormatKey>('instagram-post');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedStorefrontSlug, setSelectedStorefrontSlug] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [brandInstructions, setBrandInstructions] = useState('');
  const [quality, setQuality] = useState<'standard' | 'high' | 'print'>('high');
  const [printBleed, setPrintBleed] = useState(true);
  const [creativity, setCreativity] = useState(7);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [activeModule, setActiveModule] = useState<StudioModuleId>('command');
  const [activeRailToolId, setActiveRailToolId] = useState('image-new');
  const [founderMode, setFounderMode] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [openSelector, setOpenSelector] = useState<StudioSelectorId | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const dragRef = useRef<{
    mode: 'pan' | 'asset';
    id?: string;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    assetX?: number;
    assetY?: number;
  } | null>(null);

  const copy = studioCopy(isRtl);
  const selectedAsset = selectedCardId
    ? cards.find((card) => card.localId === selectedCardId) ?? null
    : null;
  const selectedAssetFrameStyle = useMemo<CSSProperties | undefined>(() => {
    if (!selectedAsset) return undefined;
    const ratio = Math.max(0.25, Math.min(4, selectedAsset.width / selectedAsset.height));
    return {
      '--souqy-output-aspect': `${selectedAsset.width} / ${selectedAsset.height}`,
      '--souqy-output-ratio': ratio.toFixed(4),
    } as CSSProperties;
  }, [selectedAsset]);
  const activeStudioModule =
    STUDIO_MODULES.find((item) => item.id === activeModule) ?? STUDIO_MODULES[0]!;
  const visibleProducts = selectedStorefrontSlug
    ? products.filter((product) => product.storefrontSlug === selectedStorefrontSlug)
    : products;
  const currentType =
    CREATION_TYPES.find((item) => item.id === selectedTemplate) ?? CREATION_TYPES[0]!;
  const currentFormat =
    FORMAT_PRESETS.find((item) => item.id === selectedFormat) ?? FORMAT_PRESETS[0]!;
  const canvasStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: '50% 50%',
    }),
    [pan.x, pan.y, zoom],
  );
  const intelligence = useMemo(
    () => [
      { label: copy.outputs, value: assets.length.toString().padStart(2, '0') },
      { label: copy.storefronts, value: storefronts.length.toString().padStart(2, '0') },
      { label: copy.catalogItems, value: products.length.toString().padStart(2, '0') },
      {
        label: copy.campaignSignals,
        value: String((counts['ad-creative'] ?? 0) + (counts['story-promo'] ?? 0)),
      },
    ],
    [
      assets.length,
      copy.campaignSignals,
      copy.catalogItems,
      copy.outputs,
      copy.storefronts,
      counts,
      products.length,
      storefronts.length,
    ],
  );
  const latestAssets = assets.slice(0, 5);

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => {
      setGenerationProgress((current) => {
        const base = current <= 0 ? 6 : current;
        if (base >= 94) return base;
        if (base < 34) return Math.min(94, base + 7);
        if (base < 68) return Math.min(94, base + 4);
        if (base < 86) return Math.min(94, base + 2);
        return Math.min(94, base + 1);
      });
    }, 850);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  useEffect(() => {
    if (!openSelector) return;

    function closeSelector() {
      setOpenSelector(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeSelector();
    }

    window.addEventListener('click', closeSelector);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeSelector);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [openSelector]);

  useEffect(() => {
    return () => {
      for (const reference of referencesRef.current) URL.revokeObjectURL(reference.url);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void postSouqyStudio<LibraryState>('/api/souqy-studio/library', {})
      .then((result) => {
        if (cancelled || result.status !== 'success') return;
        setProject(null);
        setAssets(result.assets);
        setCounts(result.counts);
        setStorefronts(result.storefronts);
        setProducts(result.products);
        setSelectedStorefrontSlug(result.storefronts[0]?.slug ?? '');
      })
      .catch((error) => {
        if (!cancelled)
          setStatusMessage(error instanceof Error ? error.message : copy.libraryError);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.libraryError]);

  function selectTemplate(template: CreationTemplate) {
    const next = CREATION_TYPES.find((item) => item.id === template);
    setSelectedTemplate(template);
    if (next) setSelectedFormat(next.defaultFormat);
    setActiveModule(template === 'brand-identity' || template === 'brand-kit' ? 'brand' : 'canvas');
    setStatusMessage('');
  }

  async function ensureProject(): Promise<SouqyStudioProject | null> {
    if (project) return project;
    const cleanName = isRtl ? 'جلسة سوقي ستوديو' : 'Souqy Studio Session';
    setStatusMessage(copy.preparing);
    const result = await postSouqyStudio<ProjectState>('/api/souqy-studio/start', {
      businessName: cleanName,
      locale,
    });
    if (result.status === 'error') {
      setStatusMessage(result.message);
      return null;
    }
    setProject(result.project);
    return result.project;
  }

  async function generateAsset() {
    if (isBusy) return;
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 8) {
      setGenerationProgress(0);
      setStatusMessage(copy.clearerPrompt);
      return;
    }
    setCards([]);
    setSelectedCardId('');
    setGenerationProgress(3);
    setIsBusy(true);
    try {
      const activeProject = await ensureProject();
      if (!activeProject) return;
      setStatusMessage(copy.creating);
      const referencePayload = await Promise.all(
        references.map(async (reference) => ({
          name: reference.name,
          mimeType: reference.file.type as
            | 'image/png'
            | 'image/jpeg'
            | 'image/jpg'
            | 'image/webp'
            | 'image/svg+xml',
          dataUrl: await fileToDataUrl(reference.file),
        })),
      );
      const result = await postSouqyStudio<GenerateState>('/api/souqy-studio/generate', {
        projectId: activeProject.id,
        prompt: cleanPrompt,
        template: selectedTemplate,
        formatKey: selectedFormat,
        locale,
        sourceStorefrontSlug: selectedStorefrontSlug || undefined,
        selectedProductIds,
        references: referencePayload,
        brandInstructions,
        quality,
        printBleed,
        creativity,
      });
      if (result.status === 'error') {
        setGenerationProgress(0);
        setStatusMessage(result.message);
        return;
      }
      setGenerationProgress(100);
      const newCards = cardsFromAssets(result.assets, cards.length);
      setAssets((current) => [...result.assets, ...current]);
      setCards((current) => [...newCards, ...current]);
      setSelectedCardId(newCards[0]?.localId ?? '');
      setCounts((current) => ({
        ...current,
        [selectedTemplate]: (current[selectedTemplate] ?? 0) + result.assets.length,
      }));
      setActiveModule('canvas');
      setStatusMessage(
        isRtl
          ? `تم إنشاء ${result.assets.length} أصل.`
          : `Generated ${result.assets.length} asset${result.assets.length === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      setGenerationProgress(0);
      setStatusMessage(err instanceof Error ? err.message : 'Souqy Studio generation failed.');
    } finally {
      setIsBusy(false);
    }
  }

  function addReferenceImages(files: FileList | null) {
    if (!files) return;
    const remainingSlots = Math.max(0, 5 - references.length);
    const next = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remainingSlots)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        url: URL.createObjectURL(file),
        file,
      }));
    if (next.length) setReferences((current) => [...current, ...next].slice(0, 5));
  }

  function removeReference(id: string) {
    setReferences((current) => {
      const removed = current.find((reference) => reference.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((reference) => reference.id !== id);
    });
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-6),
    );
  }

  function handleModuleSelect(moduleId: StudioModuleId) {
    setActiveModule(moduleId);
    setMobileRailOpen(false);
    if (moduleId === 'founder') setFounderMode((value) => !value);
  }

  function handleRailToolSelect(tool: RailTool) {
    setActiveRailToolId(tool.id);
    handleModuleSelect(tool.moduleId);
  }

  function beginPan(e: PointerEvent<HTMLDivElement>) {
    if (
      e.target instanceof Element &&
      e.target.closest(
        '.souqy-work-card, .souqy-output-view, .souqy-left-rail, .souqy-command-deck, .souqy-context-panel, .souqy-topbar, button, input, select, textarea, a',
      )
    ) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function beginAssetDrag(e: PointerEvent<HTMLElement>, card: StudioCard) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedCardId(card.localId);
    dragRef.current = {
      mode: 'asset',
      id: card.localId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      assetX: card.x,
      assetY: card.y,
    };
  }

  function movePointer(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (drag.mode === 'pan') {
      setPan({ x: drag.panX + dx, y: drag.panY + dy });
      return;
    }
    setCards((current) =>
      current.map((card) =>
        card.localId === drag.id
          ? {
              ...card,
              x: (drag.assetX ?? card.x) + dx / zoom,
              y: (drag.assetY ?? card.y) + dy / zoom,
            }
          : card,
      ),
    );
  }

  function endPointer() {
    dragRef.current = null;
  }

  function handleCanvasWheel(e: WheelEvent<HTMLDivElement>) {
    if (
      e.target instanceof Element &&
      e.target.closest(
        '.souqy-output-view, .souqy-command-deck, .souqy-left-rail, .souqy-context-panel, .souqy-topbar',
      )
    ) {
      return;
    }
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom((current) => Math.min(1.35, Math.max(0.52, current - e.deltaY * 0.0014)));
      return;
    }
    setPan((current) => ({ x: current.x - e.deltaX, y: current.y - e.deltaY }));
  }

  return (
    <section
      className={`souqy-workplace souqy-os ${souqyStudioFontVariables}${founderMode ? ' is-founder-mode' : ''}${
        mobileRailOpen ? ' is-rail-open' : ''
      }${railExpanded ? ' is-rail-expanded' : ''}${selectedAsset ? ' has-output' : ''}${
        selectedAsset && references.length > 0 ? ' has-output-references' : ''
      }`}
      data-theme="dark"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={
        {
          '--souqy-font': isRtl
            ? 'var(--font-arabic-text), var(--font-arabic), ui-serif, serif'
            : 'var(--font-studio-inter-tight), Inter, ui-sans-serif, system-ui, sans-serif',
          '--souqy-display': isRtl
            ? 'var(--font-arabic-serif), ui-serif, serif'
            : 'var(--font-studio-instrument-serif), Georgia, serif',
        } as CSSProperties
      }
    >
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: studioCss }} />
      <div className="souqy-atmosphere" aria-hidden>
        <DitherWave
          className="souqy-dither-wave"
          width="100%"
          height="100%"
          primaryColor="#FFFFFF"
          secondaryColor="#F2DCB5"
          tertiaryColor="#050505"
          speed={1.6}
          intensity={2}
          scale={4}
          downScale={0.6}
          opacity={0.1}
          quality="medium"
          maxFPS={45}
          pauseWhenOffscreen
        />
        <div className="souqy-grid" />
        <div className="souqy-geo" />
      </div>

      <aside className="souqy-left-rail" aria-label={copy.modules}>
        <div className="souqy-rail-brand">
          <span className="souqy-rail-mark">
            <img src="/favicon.svg" alt="Souqna" />
          </span>
          <div>
            <strong>Souqy Studio</strong>
            <small>{copy.headquarters}</small>
          </div>
        </div>

        <nav className="souqy-module-nav">
          {RAIL_TOOLS.map((item) => {
            const Icon = item.icon;
            const active = activeRailToolId === item.id;
            const label = isRtl ? item.ar : item.en;
            const stateLabel =
              item.state === 'live'
                ? copy.live
                : item.state === 'locked'
                  ? copy.locked
                  : item.state === 'focus'
                    ? copy.focus
                    : copy.preview;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${label} ${stateLabel}`}
                className={active ? 'is-active' : ''}
                onClick={() => handleRailToolSelect(item)}
              >
                <Icon size={17} />
                <span>
                  <strong>{label}</strong>
                  {item.state === 'locked' ? <small>{stateLabel}</small> : null}
                </span>
                <small>{stateLabel}</small>
              </button>
            );
          })}
        </nav>

        <div className="souqy-rail-mini">
          {intelligence.slice(0, 3).map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <button
          className="souqy-rail-expand"
          type="button"
          aria-expanded={railExpanded || mobileRailOpen}
          onClick={() => {
            if (mobileRailOpen) {
              setMobileRailOpen(false);
              return;
            }
            setRailExpanded((value) => !value);
          }}
        >
          <PanelLeft size={16} />
          <span>{railExpanded || mobileRailOpen ? copy.collapse : copy.expand}</span>
        </button>
      </aside>

      {mobileRailOpen ? (
        <button
          className="souqy-rail-scrim"
          type="button"
          onClick={() => setMobileRailOpen(false)}
        />
      ) : null}

      <main
        className="souqy-main"
        onPointerDown={beginPan}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleCanvasWheel}
      >
        <div className="souqy-topbar">
          <button
            className="souqy-mobile-menu"
            type="button"
            onClick={() => setMobileRailOpen(true)}
            aria-label={copy.openModules}
          >
            <PanelLeft size={18} />
          </button>
          <div className="souqy-topbar-title">
            <span>{isRtl ? activeStudioModule.ar : activeStudioModule.en}</span>
            <strong>{copy.operatingStudio}</strong>
          </div>
          <button
            className={founderMode ? 'souqy-founder-toggle is-active' : 'souqy-founder-toggle'}
            type="button"
            aria-label={copy.founderMode}
            onClick={() => {
              setFounderMode((value) => !value);
              setActiveModule('founder');
            }}
          >
            <Moon size={15} />
            <span>{copy.founderMode}</span>
          </button>
        </div>

        {selectedAsset ? (
          <section
            className="souqy-output-view"
            aria-label={copy.generatedOutput}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            style={selectedAssetFrameStyle}
          >
            <div className="souqy-output-frame">
              <img src={selectedAsset.url} alt={selectedAsset.title} />
            </div>
            <div className="souqy-output-meta">
              <div>
                <span>{copy.generatedOutput}</span>
                <strong>{selectedAsset.title}</strong>
                <small>
                  {selectedAsset.width}x{selectedAsset.height} - {selectedAsset.mimeType}
                </small>
              </div>
              <div className="souqy-output-actions">
                <a
                  className="souqy-output-download"
                  href={downloadHrefForAsset(selectedAsset)}
                  download={selectedAsset.downloadFilename ?? fallbackDownloadName(selectedAsset)}
                >
                  <Download size={15} />
                  <span>{copy.download}</span>
                </a>
                <a href={selectedAsset.url} target="_blank" rel="noreferrer">
                  <Maximize2 size={15} />
                  <span>{copy.openImage}</span>
                </a>
              </div>
            </div>
            {cards.length > 1 ? (
              <div className="souqy-output-list" aria-label={copy.recentOutputs}>
                {cards.slice(0, 6).map((card) => (
                  <button
                    key={card.localId}
                    type="button"
                    className={card.localId === selectedAsset.localId ? 'is-selected' : ''}
                    onClick={() => setSelectedCardId(card.localId)}
                    aria-label={card.title}
                  >
                    <img src={card.url} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="souqy-hero">
            <SouqyLogo size={112} className="souqy-hero-logo" />
            <p>{copy.eyebrow}</p>
            <h1>{copy.heroTitle}</h1>
            <span>{copy.heroBody}</span>
          </section>
        )}

        <div className="souqy-canvas-stage" style={canvasStyle}>
          {cards.map((card) => (
            <article
              key={card.localId}
              className={`souqy-work-card${selectedCardId === card.localId ? ' is-selected' : ''}`}
              style={{
                inlineSize: card.w,
                blockSize: card.h,
                transform: `translate(${card.x}px, ${card.y}px)`,
              }}
              onPointerDown={(event) => beginAssetDrag(event, card)}
              tabIndex={0}
              role="button"
              aria-label={card.title}
            >
              <img src={card.url} alt={card.title} />
              <span>{labelForAsset(card, isRtl)}</span>
            </article>
          ))}
        </div>

        {cards.length === 0 ? (
          <section className="souqy-empty-wall" aria-label={copy.comparisonWall}>
            <div>
              <span>{copy.variant}</span>
              <strong>01</strong>
            </div>
            <div>
              <span>{copy.variant}</span>
              <strong>02</strong>
            </div>
            <div>
              <span>{copy.variant}</span>
              <strong>03</strong>
            </div>
          </section>
        ) : null}

        <form
          className="souqy-command-deck"
          onSubmit={(event) => {
            event.preventDefault();
            void generateAsset();
          }}
        >
          <div className="souqy-command-head">
            <div>
              <span>{copy.studioCommand}</span>
              <strong>{copy.commandTitle}</strong>
            </div>
            <small>{currentFormat.size}</small>
          </div>

          <div className="souqy-quick-prompts">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.en}
                type="button"
                onClick={() => setPrompt(isRtl ? item.ar : item.en)}
              >
                {isRtl ? item.ar : item.en}
              </button>
            ))}
          </div>

          {references.length > 0 ? (
            <div className="souqy-reference-gallery" aria-label={copy.attachedReferences}>
              {references.map((reference) => (
                <article key={reference.id}>
                  <img src={reference.url} alt={reference.name || copy.attachedReference} />
                  <div>
                    <span>{reference.name || copy.attachedReference}</span>
                    <button
                      type="button"
                      onClick={() => removeReference(reference.id)}
                      aria-label={copy.removeReference}
                    >
                      x
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <MetalFx
            variant="button"
            preset="silver"
            theme="dark"
            strength={0.5}
            borderRadius={30}
            ringCssPx={1.2}
            normalizeHostStyles={false}
            className="souqy-composer-metal"
          >
            <div className="souqy-composer-metal-host">
              <PromptInput
                className="souqy-composer"
                value={prompt}
                onValueChange={setPrompt}
                maxHeight={116}
                isLoading={isBusy}
                onSubmit={() => void generateAsset()}
                disabled={isBusy}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  multiple
                  hidden
                  onChange={(event) => {
                    addReferenceImages(event.target.files);
                    event.target.value = '';
                  }}
                />
                <PromptInputTextarea placeholder={copy.promptPlaceholder} dir="auto" />
                <div className="souqy-composer-toolbar">
                  <PromptInputActions className="souqy-composer-actions">
                    <PromptInputAction tooltip={copy.attach}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label={copy.attach}
                        disabled={isBusy}
                      >
                        <Plus size={18} />
                      </button>
                    </PromptInputAction>
                    <div
                      className="souqy-command-controls"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <div className="souqy-selector">
                        <button
                          type="button"
                          className="souqy-selector-trigger"
                          aria-label={copy.wireframe}
                          aria-haspopup="menu"
                          aria-expanded={openSelector === 'template'}
                          onClick={() =>
                            setOpenSelector((value) => (value === 'template' ? null : 'template'))
                          }
                        >
                          <currentType.icon size={14} />
                          <strong>{isRtl ? currentType.ar : currentType.en}</strong>
                          <ChevronDown size={13} />
                        </button>
                        {openSelector === 'template' ? (
                          <div className="souqy-selector-menu" role="menu">
                            <span className="souqy-selector-title">{copy.wireframe}</span>
                            {CREATION_TYPES.map((item) => {
                              const Icon = item.icon;
                              const active = item.id === selectedTemplate;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={active}
                                  className={active ? 'is-selected' : ''}
                                  onClick={() => {
                                    selectTemplate(item.id);
                                    setOpenSelector(null);
                                  }}
                                >
                                  <Icon size={14} />
                                  <span>{isRtl ? item.ar : item.en}</span>
                                  {active ? <i aria-hidden /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="souqy-selector souqy-selector-compact">
                        <button
                          type="button"
                          className="souqy-selector-trigger souqy-selector-trigger-icon"
                          aria-label={`${copy.size}: ${formatAspectLabel(currentFormat, isRtl)}`}
                          aria-haspopup="menu"
                          aria-expanded={openSelector === 'format'}
                          onClick={() =>
                            setOpenSelector((value) => (value === 'format' ? null : 'format'))
                          }
                        >
                          <currentFormat.icon size={14} />
                        </button>
                        {openSelector === 'format' ? (
                          <div
                            className="souqy-selector-menu souqy-selector-menu-format"
                            role="menu"
                          >
                            <span className="souqy-selector-title">Aspect Ratio</span>
                            {FORMAT_PRESETS.map((item) => {
                              const Icon = item.icon;
                              const active = item.id === selectedFormat;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={active}
                                  className={active ? 'is-selected' : ''}
                                  onClick={() => {
                                    setSelectedFormat(item.id);
                                    setOpenSelector(null);
                                  }}
                                >
                                  <Icon size={14} />
                                  <span>{formatAspectLabel(item, isRtl)}</span>
                                  <small>{item.size}</small>
                                  {active ? <i aria-hidden /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </PromptInputActions>
                  <PromptInputActions>
                    <PromptInputAction tooltip={copy.generateShort}>
                      <MetalFx
                        variant="circle"
                        preset="chromatic"
                        theme="dark"
                        strength={isBusy ? 0.55 : 0.88}
                        borderRadius={999}
                        ringCssPx={1.4}
                        normalizeHostStyles={false}
                        className="souqy-submit-metal"
                      >
                        <button type="submit" disabled={isBusy} aria-label={copy.generateShort}>
                          {isBusy ? <Sparkles size={15} /> : <ArrowUp size={17} />}
                        </button>
                      </MetalFx>
                    </PromptInputAction>
                  </PromptInputActions>
                </div>
                <div
                  className={isBusy ? 'souqy-composer-status is-generating' : 'souqy-composer-status'}
                  role="status"
                  aria-live="polite"
                >
                  {isBusy ? (
                    <>
                      <Loader variant="wave" size="sm" className="souqy-status-loader" />
                      <TextShimmer
                        as="span"
                        duration={2.6}
                        spread={18}
                        className="souqy-status-shimmer"
                      >
                        {copy.creating}
                      </TextShimmer>
                      <span className="souqy-status-percent">{generationProgress}%</span>
                      <i
                        className="souqy-status-progress"
                        style={{ inlineSize: `${generationProgress}%` }}
                        aria-hidden
                      />
                    </>
                  ) : (
                    <>
                      <span className="souqy-status-dot" aria-hidden />
                      <span>{statusMessage || copy.statusIdle}</span>
                    </>
                  )}
                </div>
              </PromptInput>
            </div>
          </MetalFx>
        </form>
      </main>

      {!founderMode && activeModule !== 'command' ? (
        <aside className="souqy-context-panel">
          <ModulePanel
            moduleId={activeModule}
            isRtl={isRtl}
            copy={copy}
            assets={assets}
            latestAssets={latestAssets}
            selectedAsset={selectedAsset}
            currentType={currentType}
            currentFormat={currentFormat}
            quality={quality}
            setQuality={setQuality}
            printBleed={printBleed}
            setPrintBleed={setPrintBleed}
            creativity={creativity}
            setCreativity={setCreativity}
            brandInstructions={brandInstructions}
            setBrandInstructions={setBrandInstructions}
            storefronts={storefronts}
            products={visibleProducts}
            selectedStorefrontSlug={selectedStorefrontSlug}
            setSelectedStorefrontSlug={setSelectedStorefrontSlug}
            selectedProductIds={selectedProductIds}
            toggleProduct={toggleProduct}
            intelligence={intelligence}
          />
        </aside>
      ) : null}
    </section>
  );
}

function ModulePanel({
  moduleId,
  isRtl,
  copy,
  assets,
  latestAssets,
  selectedAsset,
  currentType,
  currentFormat,
  quality,
  setQuality,
  printBleed,
  setPrintBleed,
  creativity,
  setCreativity,
  brandInstructions,
  setBrandInstructions,
  storefronts,
  products,
  selectedStorefrontSlug,
  setSelectedStorefrontSlug,
  selectedProductIds,
  toggleProduct,
  intelligence,
}: {
  moduleId: StudioModuleId;
  isRtl: boolean;
  copy: ReturnType<typeof studioCopy>;
  assets: SouqyStudioAsset[];
  latestAssets: SouqyStudioAsset[];
  selectedAsset: StudioCard | null;
  currentType: (typeof CREATION_TYPES)[number];
  currentFormat: (typeof FORMAT_PRESETS)[number];
  quality: 'standard' | 'high' | 'print';
  setQuality: (quality: 'standard' | 'high' | 'print') => void;
  printBleed: boolean;
  setPrintBleed: (value: boolean) => void;
  creativity: number;
  setCreativity: (value: number) => void;
  brandInstructions: string;
  setBrandInstructions: (value: string) => void;
  storefronts: CatalogStorefront[];
  products: CatalogProduct[];
  selectedStorefrontSlug: string;
  setSelectedStorefrontSlug: (slug: string) => void;
  selectedProductIds: string[];
  toggleProduct: (id: string) => void;
  intelligence: Array<{ label: string; value: string }>;
}) {
  if (moduleId === 'motion') {
    return (
      <PanelShell eyebrow={copy.previewModule} title={copy.motionStudio}>
        <div className="souqy-format-stack">
          {['9:16 Reel', '1:1 Ad Loop', '16:9 Launch Film'].map((item) => (
            <button key={item} type="button" disabled>
              <Video size={16} />
              <span>{item}</span>
              <small>{copy.preview}</small>
            </button>
          ))}
        </div>
        <div className="souqy-cinema-frame">
          <span />
          <strong>{copy.motionStoryboard}</strong>
          <p>{copy.motionBody}</p>
        </div>
      </PanelShell>
    );
  }

  if (moduleId === 'campaign') {
    return (
      <PanelShell eyebrow={copy.previewModule} title={copy.campaignEngine}>
        <div className="souqy-campaign-list">
          {CAMPAIGN_KITS.map((kit) => (
            <article key={kit.en}>
              <strong>{isRtl ? kit.ar : kit.en}</strong>
              <div>
                {kit.channels.map((channel) => (
                  <span key={channel}>{channel}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="souqy-slogan-card">
          <small>{copy.aiSlogan}</small>
          <p>{copy.slogan}</p>
        </div>
      </PanelShell>
    );
  }

  if (moduleId === 'intelligence') {
    return (
      <PanelShell eyebrow={copy.previewModule} title={copy.storeIntelligence}>
        <div className="souqy-intel-grid">
          {intelligence.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="souqy-recommendation-list">
          <article>
            <small>{copy.growthOpportunity}</small>
            <strong>{copy.recommendationOne}</strong>
          </article>
          <article>
            <small>{copy.pricingSignal}</small>
            <strong>{copy.recommendationTwo}</strong>
          </article>
        </div>
      </PanelShell>
    );
  }

  if (moduleId === 'automation') {
    return (
      <PanelShell eyebrow={copy.previewModule} title={copy.automationLab}>
        <div className="souqy-flow">
          {AUTOMATION_NODES.map((node, index) => (
            <div key={node.en}>
              <span>{index + 1}</span>
              <strong>{isRtl ? node.ar : node.en}</strong>
            </div>
          ))}
        </div>
        <button type="button" className="souqy-staged-action" disabled>
          <Sparkles size={15} />
          <span>{copy.generateAutomation}</span>
        </button>
      </PanelShell>
    );
  }

  if (moduleId === 'founder') {
    return (
      <PanelShell eyebrow={copy.focus} title={copy.founderMode}>
        <div className="souqy-founder-card">
          <Moon size={18} />
          <strong>{copy.founderFocusTitle}</strong>
          <p>{copy.founderFocusBody}</p>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      eyebrow={
        moduleId === 'brand'
          ? copy.liveModule
          : moduleId === 'canvas'
            ? copy.liveModule
            : copy.studioCommand
      }
      title={
        moduleId === 'brand'
          ? copy.brandArchitect
          : moduleId === 'canvas'
            ? copy.infinityCanvas
            : copy.contextTitle
      }
    >
      <div className="souqy-panel-card">
        <div className="souqy-panel-title">
          <span>{isRtl ? currentType.ar : currentType.en}</span>
          <strong>{isRtl ? currentFormat.ar : currentFormat.en}</strong>
        </div>
        <small>{currentFormat.size}</small>
      </div>

      <label className="souqy-field">
        <span>{copy.storefront}</span>
        <select
          value={selectedStorefrontSlug}
          onChange={(event) => setSelectedStorefrontSlug(event.target.value)}
        >
          <option value="">{copy.noStorefront}</option>
          {storefronts.map((storefront) => (
            <option key={storefront.slug} value={storefront.slug}>
              {storefront.businessName}
            </option>
          ))}
        </select>
      </label>

      <label className="souqy-field">
        <span>{copy.quality}</span>
        <select
          value={quality}
          onChange={(event) => setQuality(event.target.value as 'standard' | 'high' | 'print')}
        >
          <option value="standard">{copy.standard}</option>
          <option value="high">{copy.high}</option>
          <option value="print">{copy.print}</option>
        </select>
      </label>

      <label className="souqy-toggle-row">
        <span>{copy.bleed}</span>
        <input
          type="checkbox"
          checked={printBleed}
          onChange={(event) => setPrintBleed(event.target.checked)}
        />
      </label>

      <label className="souqy-field">
        <span>{copy.instructions}</span>
        <textarea
          value={brandInstructions}
          onChange={(event) => setBrandInstructions(event.target.value)}
          maxLength={500}
          placeholder={copy.instructionsPlaceholder}
        />
      </label>

      <label className="souqy-slider">
        <span>{copy.creativity}</span>
        <input
          type="range"
          min={0}
          max={10}
          value={creativity}
          onChange={(event) => setCreativity(Number(event.target.value))}
        />
        <small>{creativity}/10</small>
      </label>

      <div className="souqy-product-picker">
        <span>{copy.catalog}</span>
        {products.slice(0, 6).map((product) => (
          <button
            key={product.id}
            type="button"
            className={selectedProductIds.includes(product.id) ? 'is-active' : ''}
            onClick={() => toggleProduct(product.id)}
          >
            {product.imageUrl ? (
              <i style={{ backgroundImage: `url("${product.imageUrl}")` }} />
            ) : (
              <ShoppingBag size={14} />
            )}
            <span>{product.title}</span>
            <small>
              {product.priceQar !== null ? `${product.priceQar} QAR` : product.storefrontName}
            </small>
          </button>
        ))}
        {products.length === 0 ? <p>{copy.noProducts}</p> : null}
      </div>

      <div className="souqy-selected-asset">
        <span>{copy.selected}</span>
        {selectedAsset ? (
          <>
            <img src={selectedAsset.url} alt={selectedAsset.title} />
            <strong>{selectedAsset.title}</strong>
            <small>
              {selectedAsset.width}x{selectedAsset.height} - {selectedAsset.mimeType}
            </small>
            <a
              href={downloadHrefForAsset(selectedAsset)}
              download={selectedAsset.downloadFilename ?? fallbackDownloadName(selectedAsset)}
            >
              <Download size={15} />
              {copy.download}
            </a>
          </>
        ) : (
          <p>{copy.noSelection}</p>
        )}
      </div>

      <div className="souqy-memory-list">
        <span>{copy.aiMemory}</span>
        {latestAssets.length > 0 ? (
          latestAssets.map((asset) => (
            <a
              key={asset.id ?? asset.url}
              href={asset.url}
              download={asset.downloadFilename ?? true}
            >
              <i style={{ backgroundImage: `url("${asset.url}")` }} />
              <strong>{asset.title}</strong>
            </a>
          ))
        ) : (
          <p>{copy.noAssets}</p>
        )}
      </div>

      <div className="souqy-export-row">
        {['PNG', 'PDF', 'SVG', 'MP4'].map((item, index) => (
          <button key={item} type="button" disabled={index > 0}>
            {index > 0 ? <FileArchive size={14} /> : <Download size={14} />}
            <span>{item}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

function PanelShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="souqy-context-head">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </>
  );
}

function cardsFromAssets(assets: SouqyStudioAsset[], offset = 0): StudioCard[] {
  return assets.map((asset, index) => {
    const ratio = asset.height / asset.width;
    const w = asset.width > asset.height ? 300 : asset.height > asset.width ? 172 : 220;
    const h = Math.max(142, Math.min(320, w * ratio));
    return {
      ...asset,
      localId: asset.id ?? `${asset.url}-${index}`,
      x: -220 + ((index + offset) % 3) * 230,
      y: 156 + Math.floor((index + offset) / 3) * 210,
      w,
      h,
    };
  });
}

function labelForAsset(asset: SouqyStudioAsset, isRtl: boolean): string {
  if (asset.formatKey) return asset.formatKey.replace(/-/g, ' ');
  if (asset.assetType) return asset.assetType.replace(/-/g, ' ');
  return isRtl ? 'أصل سوقي' : 'Souqy asset';
}

function fallbackDownloadName(asset: SouqyStudioAsset): string {
  const extension =
    asset.mimeType === 'image/png'
      ? 'png'
      : asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/jpg'
        ? 'jpg'
        : asset.mimeType === 'image/svg+xml'
          ? 'svg'
          : 'webp';
  const base = (asset.assetType ?? asset.kind ?? 'souqy-output')
    .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `${base || 'souqy-output'}-${asset.width}x${asset.height}.${extension}`;
}

function downloadHrefForAsset(asset: SouqyStudioAsset): string {
  const filename = asset.downloadFilename ?? fallbackDownloadName(asset);
  return `/api/souqy-studio/download?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(
    filename,
  )}`;
}

function formatAspectLabel(format: (typeof FORMAT_PRESETS)[number], isRtl: boolean): string {
  const labels: Record<StudioFormatKey, { en: string; ar: string }> = {
    'instagram-post': { en: 'Portrait (4:5)', ar: 'Portrait (4:5)' },
    'instagram-story': { en: 'Vertical (9:16)', ar: 'Vertical (9:16)' },
    tiktok: { en: 'Vertical (9:16)', ar: 'Vertical (9:16)' },
    snapchat: { en: 'Vertical (9:16)', ar: 'Vertical (9:16)' },
    'whatsapp-status': { en: 'Vertical (9:16)', ar: 'Vertical (9:16)' },
    'x-banner': { en: 'Wide (16:9)', ar: 'Wide (16:9)' },
    'a3-print': { en: 'Print (A3)', ar: 'Print (A3)' },
    'menu-print': { en: 'Classic (A4)', ar: 'Classic (A4)' },
    'product-card': { en: 'Square (1:1)', ar: 'Square (1:1)' },
    'logo-square': { en: 'Square (1:1)', ar: 'Square (1:1)' },
    'wide-banner': { en: 'Landscape (2:1)', ar: 'Landscape (2:1)' },
  };
  const label = labels[format.id];
  return isRtl ? label.ar : label.en;
}

function studioCopy(isRtl: boolean) {
  return isRtl
    ? {
        aiMemory: 'ذاكرة الذكاء',
        aiSlogan: 'شعار ذكي',
        attach: 'إرفاق ملف',
        attachedReference: 'صورة مرفقة',
        attachedReferences: 'الصور المرفقة',
        automationLab: 'مختبر الأتمتة',
        bleed: 'هوامش طباعة',
        brandArchitect: 'معمار الهوية',
        campaignEngine: 'محرك الحملات',
        campaignSignals: 'إشارات حملة',
        catalog: 'منتجات الكتالوج',
        catalogItems: 'منتجات',
        clearerPrompt: 'اكتب وصفا أوضح للتصميم.',
        commandTitle: 'صمّم، حلّل، ونظّم من أمر واحد.',
        comparisonWall: 'جدار المقارنة',
        contextTitle: 'لوحة السياق',
        creating: 'سوقي يصمم الأصل...',
        collapse: 'طي',
        creativity: 'قوة الإبداع',
        download: 'تحميل',
        eyebrow: '',
        expand: 'توسيع',
        focus: 'تركيز',
        founderFocusBody: 'تخف الإضاءة وتختفي اللوحات الثانوية حتى يبقى الأمر الإبداعي في المنتصف.',
        founderFocusTitle: 'مساحة هادئة للعمل العميق.',
        founderMode: 'وضع المؤسس',
        generateAutomation: 'توليد تدفق ذكي',
        generateShort: 'إنشاء',
        generatedOutput: 'المخرج الناتج',
        growthOpportunity: 'فرصة نمو',
        headquarters: 'المقر الإبداعي',
        heroBody: 'اكتب طلبك بالأسفل لبدء الإنشاء',
        heroTitle: 'جاهز للإنشاء',
        high: 'عالية',
        infinityCanvas: 'اللوحة اللامحدودة',
        instructions: 'تعليمات الهوية',
        instructionsPlaceholder: 'فاخر، هادئ، مناسب للعربية، إضاءة دافئة...',
        libraryError: 'تعذر تحميل مكتبة سوقي.',
        live: 'حي',
        liveModule: 'وحدة حية',
        locked: 'مقفل',
        modules: 'وحدات سوقي',
        motionBody: 'تحويل الإخراج الحالي إلى ريل أو إعلان متحرك سيتم وصله بمحرك الفيديو لاحقا.',
        motionStoryboard: 'لوحة حركة سينمائية',
        motionStudio: 'استوديو الحركة',
        noAssets: 'ستظهر أعمالك الأخيرة هنا.',
        noProducts: 'لا توجد منتجات مرتبطة بعد.',
        noSelection: 'اختر أصلا من اللوحة.',
        noStorefront: 'بدون متجر محدد',
        openModules: 'فتح الوحدات',
        openImage: 'فتح الصورة',
        operatingStudio: 'Luxury AI operating studio',
        outputs: 'مخرجات',
        preview: 'معاينة',
        previewModule: 'وحدة معاينة',
        preparing: 'نجهز مكتبة الأصول...',
        pricingSignal: 'إشارة سعر',
        promptPlaceholder: 'اكتب ما تريد من سوقي أن يصممه لهذا البراند...',
        quality: 'الدقة',
        recommendationOne: 'حوّل آخر تصميم إلى حملة واتساب وإنستغرام.',
        recommendationTwo: 'جرّب بطاقة منتج مربعة للعروض السريعة.',
        recentOutputs: 'المخرجات الأخيرة',
        removeReference: 'إزالة المرجع',
        selected: 'الأصل المحدد',
        size: 'المقاس',
        slogan: 'إطلاقك القادم يبدأ بهوية لا تشبه السوق.',
        standard: 'قياسية',
        statusIdle: 'جاهز لاستقبال الأمر التالي.',
        storefront: 'المتجر',
        storefronts: 'متاجر',
        storeIntelligence: 'ذكاء المتجر',
        studioCommand: 'Studio Command',
        variant: 'بديل',
        wireframe: 'النوع',
        print: 'للطباعة',
      }
    : {
        aiMemory: 'AI memory',
        aiSlogan: 'AI slogan',
        attach: 'Attach file',
        attachedReference: 'Attached image',
        attachedReferences: 'Attached images',
        automationLab: 'Automation Lab',
        bleed: 'Print bleed',
        brandArchitect: 'AI Brand Architect',
        campaignEngine: 'Campaign Engine',
        campaignSignals: 'Campaign signals',
        catalog: 'Catalog products',
        catalogItems: 'Catalog',
        clearerPrompt: 'Write a clearer design prompt first.',
        commandTitle: 'Prompt',
        comparisonWall: 'Comparison wall',
        contextTitle: 'Context panel',
        creating: 'Souqy is creating the asset...',
        collapse: 'Collapse',
        creativity: 'Creative strength',
        download: 'Download',
        eyebrow: '',
        expand: 'Expand',
        focus: 'Focus',
        founderFocusBody:
          'Secondary panels recede, lighting softens, and the command dock becomes the center of gravity.',
        founderFocusTitle: 'A quiet room for high-leverage founder work.',
        founderMode: 'Founder Mode',
        generateAutomation: 'Generate automation',
        generateShort: 'Generate',
        generatedOutput: 'Generated output',
        growthOpportunity: 'Growth opportunity',
        headquarters: 'Creative HQ',
        heroBody: 'Enter a prompt below to start generating',
        heroTitle: 'Ready to Create',
        high: 'High',
        infinityCanvas: 'Infinity Canvas',
        instructions: 'Brand instructions',
        instructionsPlaceholder: 'Premium, quiet, Arabic-friendly, warm keylight...',
        libraryError: 'Could not load Souqy library.',
        live: 'Live',
        liveModule: 'Live module',
        locked: 'Locked',
        modules: 'Souqy modules',
        motionBody:
          'The current output can become a reel, story ad, or cinematic launch film when video rendering is connected.',
        motionStoryboard: 'Cinematic storyboard',
        motionStudio: 'Motion Studio',
        noAssets: 'Recent work will appear here.',
        noProducts: 'No catalog products connected yet.',
        noSelection: 'Select an output from the canvas.',
        noStorefront: 'No storefront selected',
        openModules: 'Open modules',
        openImage: 'Open image',
        operatingStudio: 'Luxury AI operating studio',
        outputs: 'Outputs',
        preview: 'Preview',
        previewModule: 'Preview module',
        preparing: 'Preparing the asset library...',
        pricingSignal: 'Pricing signal',
        promptPlaceholder: 'Enter a prompt below to start generating',
        quality: 'Quality',
        recommendationOne: 'Turn the latest asset into a WhatsApp and Instagram launch kit.',
        recommendationTwo: 'Try a square product card for faster offer conversion.',
        recentOutputs: 'Recent outputs',
        removeReference: 'Remove reference',
        selected: 'Selected asset',
        size: 'Size',
        slogan: 'Your next launch starts with an identity the market remembers.',
        standard: 'Standard',
        statusIdle: 'Ready for the next command.',
        storefront: 'Storefront',
        storefronts: 'Stores',
        storeIntelligence: 'Store Intelligence',
        studioCommand: 'Studio Command',
        variant: 'Variant',
        wireframe: 'Wireframe',
        print: 'Print',
      };
}

async function postSouqyStudio<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!text)
    throw new Error(
      response.ok ? 'Souqy Studio returned an empty response.' : 'Souqy Studio request failed.',
    );
  return JSON.parse(text) as T;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read reference image.'));
    reader.readAsDataURL(file);
  });
}

function TikTokIcon(props: { size?: string | number }) {
  return <span style={{ fontSize: props.size ?? 16, fontWeight: 800 }}>T</span>;
}

function GhostIcon(props: { size?: string | number }) {
  return <span style={{ fontSize: props.size ?? 16, fontWeight: 800 }}>S</span>;
}

function WhatsAppIcon(props: { size?: string | number }) {
  return <span style={{ fontSize: props.size ?? 16, fontWeight: 800 }}>W</span>;
}

function XIcon(props: { size?: string | number }) {
  return <span style={{ fontSize: props.size ?? 16, fontWeight: 800 }}>X</span>;
}

function MegaphoneIcon(props: { size?: string | number }) {
  return <Sparkles size={props.size ?? 16} />;
}

function ClapperIcon(props: { size?: string | number }) {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 8h14M7 4h10l2 4H5l2-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M5 8h14v11H5V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ShapesIcon(props: { size?: string | number }) {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 5.5 11 12l-4 6.5L3 12l4-6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 6h6v6h-6V6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M17 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const studioCss = `
.souqy-workplace * { box-sizing: border-box; }
body:has(.souqy-workplace) nav:not(.souqy-workplace nav),
body:has(.souqy-workplace) footer,
body:has(.souqy-workplace) [data-public-chrome],
body:has(.souqy-workplace) > .fixed,
body:has(.souqy-workplace) [data-homepage-blank] { display: none !important; }
.souqy-workplace {
  --souqy-bg: #050505;
  --souqy-ink: #f4ead6;
  --souqy-muted: rgba(244, 234, 214, .62);
  --souqy-faint: rgba(244, 234, 214, .36);
  --souqy-line: rgba(244, 234, 214, .11);
  --souqy-line-strong: rgba(244, 234, 214, .2);
  --souqy-panel: rgba(18, 17, 15, .78);
  --souqy-panel-strong: rgba(27, 25, 22, .92);
  --souqy-panel-soft: rgba(244, 234, 214, .055);
  --souqy-gold: ${palette.gold};
  --souqy-gold-deep: ${palette.goldDeep};
  --souqy-maroon: ${palette.maroon};
  --souqy-maroon-deep: ${palette.maroonDeep};
  min-block-size: 100dvh;
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  background: var(--souqy-bg);
  color: var(--souqy-ink);
  font-family: var(--souqy-font);
  overflow: hidden;
  isolation: isolate;
  transition: grid-template-columns .24s ease;
}
.souqy-workplace.is-rail-expanded {
  grid-template-columns: 282px minmax(0, 1fr);
}
.souqy-workplace button,
.souqy-workplace input,
.souqy-workplace select,
.souqy-workplace textarea {
  font: inherit;
}
.souqy-workplace button {
  color: inherit;
}
.souqy-atmosphere {
  position: fixed;
  inset: 0;
  z-index: -2;
  overflow: hidden;
  background: linear-gradient(180deg, #000 0%, #050505 55%, #020202 100%);
}
.souqy-atmosphere::before,
.souqy-atmosphere::after {
  content: '';
  position: absolute;
  inset: -12%;
  pointer-events: none;
}
.souqy-atmosphere::before {
  background:
    radial-gradient(circle at 50% 34%, rgba(255,255,255,.045), transparent 31%),
    radial-gradient(circle at 72% 72%, rgba(242,220,181,.025), transparent 28%);
  mix-blend-mode: screen;
}
.souqy-atmosphere::after {
  background: linear-gradient(180deg, rgba(0,0,0,.24), rgba(0,0,0,.72));
}
.souqy-dither-wave {
  position: absolute !important;
  inset: 0;
  opacity: 1;
  mix-blend-mode: screen;
  pointer-events: none;
  filter: saturate(.82) contrast(1.06);
}
.souqy-dither-wave canvas {
  inline-size: 100% !important;
  block-size: 100% !important;
}
.souqy-grid {
  display: none;
}
.souqy-geo {
  display: none;
}
.souqy-left-rail,
.souqy-context-panel {
  position: relative;
  z-index: 5;
  block-size: 100dvh;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(201,169,97,.36) transparent;
  background: rgba(0, 0, 0, .74);
  border-color: var(--souqy-line);
  backdrop-filter: blur(28px) saturate(1.12);
  -webkit-backdrop-filter: blur(28px) saturate(1.12);
}
.souqy-left-rail {
  margin: 12px 0 12px 14px;
  block-size: calc(100dvh - 24px);
  padding: 14px 10px;
  border-inline-end: 1px solid var(--souqy-line);
  border: 1px solid rgba(244,234,214,.1);
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  inline-size: 66px;
  overflow: hidden;
  transition: inline-size .24s ease, align-items .24s ease;
}
.is-rail-expanded .souqy-left-rail {
  inline-size: 254px;
  align-items: stretch;
}
.souqy-context-panel {
  padding: 20px;
  border-inline-start: 1px solid var(--souqy-line);
  display: none;
}
.souqy-rail-brand {
  display: grid;
  place-items: center;
  min-block-size: auto;
  margin-block-end: 18px;
}
.souqy-rail-brand > span {
  display: grid;
  place-items: center;
  inline-size: 42px;
  block-size: 42px;
  border: 1px solid rgba(201,169,97,.32);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(201,169,97,.18), rgba(244,234,214,.04));
  color: var(--souqy-gold);
  font-family: var(--souqy-display);
  font-size: 24px;
  box-shadow: inset 0 1px rgba(255,255,255,.08), 0 20px 60px rgba(0,0,0,.34);
}
.souqy-rail-mark img {
  display: block;
  inline-size: 30px;
  block-size: 30px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(201,169,97,.18));
}
.souqy-rail-brand div {
  display: none;
}
.souqy-rail-brand strong,
.souqy-context-head strong,
.souqy-command-head strong,
.souqy-hero h1 {
  font-family: var(--souqy-display);
  letter-spacing: 0;
}
.souqy-rail-brand strong {
  display: block;
  font-size: 21px;
  font-weight: 400;
  line-height: 1;
}
.souqy-rail-brand small,
.souqy-context-head span,
.souqy-command-head span,
.souqy-topbar-title span,
.souqy-hero p {
  color: var(--souqy-gold);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .12em;
}
.souqy-module-nav {
  display: grid;
  gap: 6px;
  inline-size: 100%;
  justify-items: center;
  padding-block-end: 12px;
  flex: 1 1 auto;
  min-block-size: 0;
  overflow-y: auto;
  scrollbar-width: none;
}
.souqy-module-nav::-webkit-scrollbar {
  display: none;
}
.souqy-module-nav button {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  justify-items: center;
  gap: 0;
  inline-size: 46px;
  min-block-size: 42px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  padding: 0;
  color: var(--souqy-muted);
  cursor: pointer;
  text-align: start;
  overflow: hidden;
  transition:
    inline-size .22s ease,
    background .18s ease,
    border-color .18s ease,
    color .18s ease,
    padding .22s ease;
}
.souqy-module-nav button:hover,
.souqy-module-nav button.is-active {
  color: #050505;
  border-color: rgba(244,234,214,.88);
  background: rgba(244,234,214,.92);
}
.souqy-module-nav button svg {
  color: currentColor;
  grid-column: 1;
}
.souqy-module-nav span {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.souqy-module-nav small {
  display: none;
}
.is-rail-expanded .souqy-module-nav {
  justify-items: stretch;
}
.is-rail-expanded .souqy-module-nav button {
  inline-size: 100%;
  grid-template-columns: 22px minmax(0, 1fr);
  justify-items: start;
  gap: 10px;
  padding: 0 12px;
  color: rgba(244,234,214,.84);
}
.is-rail-expanded .souqy-module-nav button:hover,
.is-rail-expanded .souqy-module-nav button.is-active {
  color: #050505;
}
.is-rail-expanded .souqy-module-nav span {
  position: static;
  inline-size: auto;
  block-size: auto;
  overflow: hidden;
  clip: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-inline-size: 0;
  white-space: nowrap;
}
.is-rail-expanded .souqy-module-nav span strong {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
}
.is-rail-expanded .souqy-module-nav span small {
  display: inline-flex;
  border: 1px solid rgba(244,234,214,.12);
  border-radius: 999px;
  padding: 2px 6px;
  color: rgba(244,234,214,.45);
  font-size: 9px;
  text-transform: uppercase;
}
.is-rail-expanded .souqy-module-nav button.is-active span small,
.is-rail-expanded .souqy-module-nav button:hover span small {
  border-color: rgba(0,0,0,.18);
  color: rgba(0,0,0,.56);
}
.souqy-panel-card small,
.souqy-selected-asset small {
  color: var(--souqy-muted);
}
.souqy-rail-mini {
  display: none;
}
.souqy-rail-mini div {
  min-inline-size: 0;
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  padding: 9px;
  background: rgba(0,0,0,.16);
}
.souqy-rail-mini strong {
  display: block;
  color: var(--souqy-gold);
  font-variant-numeric: tabular-nums;
}
.souqy-rail-mini span {
  display: block;
  margin-block-start: 3px;
  color: var(--souqy-faint);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-rail-expand {
  margin-block-start: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  inline-size: 46px;
  min-block-size: 42px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--souqy-muted);
  cursor: pointer;
}
.souqy-rail-expand:hover {
  color: var(--souqy-ink);
  background: rgba(255,255,255,.08);
}
.souqy-rail-expand span {
  display: none;
  font-size: 12px;
  font-weight: 700;
}
.is-rail-expanded .souqy-rail-expand {
  inline-size: 100%;
  justify-content: flex-start;
  padding-inline: 12px;
}
.is-rail-expanded .souqy-rail-expand span {
  display: inline;
}
.souqy-main {
  position: relative;
  min-inline-size: 0;
  block-size: 100dvh;
  overflow: hidden;
  touch-action: none;
}
.souqy-topbar {
  position: absolute;
  z-index: 20;
  inset-block-start: 18px;
  inset-inline: 22px;
  display: none;
  align-items: center;
  gap: 10px;
}
.souqy-mobile-menu {
  display: none;
}
.souqy-topbar-title {
  display: grid;
  gap: 2px;
  min-inline-size: 158px;
}
.souqy-topbar-title strong {
  color: var(--souqy-muted);
  font-size: 12px;
  font-weight: 500;
}
.souqy-founder-toggle,
.souqy-mobile-menu {
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(18,17,15,.72);
  color: var(--souqy-ink);
  backdrop-filter: blur(20px);
  box-shadow: 0 18px 45px rgba(0,0,0,.24);
}
.souqy-founder-toggle,
.souqy-mobile-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 48px;
  padding: 0 13px;
  cursor: pointer;
}
.souqy-founder-toggle.is-active {
  border-color: rgba(201,169,97,.42);
  color: var(--souqy-gold);
}
.souqy-hero {
  position: absolute;
  z-index: 4;
  inset-block-start: 17vh;
  inset-inline: 50% auto;
  transform: translateX(-50%);
  inline-size: min(520px, calc(100% - 48px));
  pointer-events: none;
  text-align: center;
}
.souqy-hero-logo {
  margin: 0 auto 18px;
  pointer-events: none;
}
.souqy-hero-logo.souqy-logo::before {
  inset: -4px;
}
.souqy-hero-logo.souqy-logo::after {
  inset: -22px;
  opacity: .36;
}
.souqy-hero-logo .souqy-logo-core {
  border-color: rgba(255,241,184,.32);
  box-shadow:
    inset 0 0 0 1px rgba(255,245,198,.13),
    inset 0 0 24px rgba(0,0,0,.72),
    0 22px 70px rgba(0,0,0,.38);
}
.souqy-hero h1 {
  margin: 0;
  max-inline-size: none;
  font-family: var(--souqy-font);
  font-size: clamp(28px, 3.4vw, 40px);
  line-height: 1.05;
  font-weight: 700;
  color: rgba(255,255,255,.94);
}
.souqy-hero span {
  display: block;
  max-inline-size: none;
  margin-block-start: 8px;
  color: rgba(255,255,255,.56);
  font-size: 15px;
  line-height: 1.35;
}
.souqy-hero p {
  display: none;
}
.souqy-output-view {
  position: absolute;
  z-index: 14;
  --souqy-output-aspect: 1 / 1;
  --souqy-output-ratio: 1;
  --souqy-output-max-block: min(64dvh, calc(100dvh - 320px));
  inset-block-start: clamp(54px, 8vh, 82px);
  inset-inline-start: 50%;
  transform: translateX(-50%);
  inline-size: min(1080px, calc(100% - 118px));
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 10px;
  pointer-events: auto;
}
.souqy-output-frame {
  min-block-size: 260px;
  inline-size: min(100%, calc(var(--souqy-output-max-block) * var(--souqy-output-ratio)));
  aspect-ratio: var(--souqy-output-aspect);
  max-block-size: var(--souqy-output-max-block);
  margin-inline: auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 0%, rgba(244,234,214,.08), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.04), rgba(255,255,255,.01)),
    rgba(8,8,7,.82);
  box-shadow: 0 30px 110px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.05);
  backdrop-filter: blur(26px) saturate(1.08);
  -webkit-backdrop-filter: blur(26px) saturate(1.08);
}
.souqy-output-frame img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
.souqy-output-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 16px;
  background: rgba(11,11,10,.82);
  box-shadow: 0 18px 60px rgba(0,0,0,.4), inset 0 1px rgba(255,255,255,.04);
  padding: 12px;
}
.souqy-output-meta > div:first-child {
  min-inline-size: 0;
  display: grid;
  gap: 3px;
}
.souqy-output-meta span,
.souqy-output-meta small {
  color: var(--souqy-muted);
  font-size: 11px;
}
.souqy-output-meta > div:first-child > span {
  color: rgba(235,241,248,.76);
  text-transform: uppercase;
  letter-spacing: .08em;
}
.souqy-output-meta strong {
  min-inline-size: 0;
  overflow: hidden;
  color: var(--souqy-ink);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-output-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}
.souqy-output-actions button,
.souqy-output-actions a {
  min-block-size: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  color: var(--souqy-ink);
  padding: 0 13px;
  text-decoration: none;
  cursor: pointer;
}
.souqy-output-actions .souqy-output-download {
  background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(174,185,198,.9));
  color: #050607;
  font-weight: 750;
}
.souqy-output-actions a:hover {
  background: rgba(255,255,255,.11);
}
.souqy-output-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.souqy-output-list::-webkit-scrollbar {
  display: none;
}
.souqy-output-list button {
  flex: 0 0 56px;
  inline-size: 56px;
  block-size: 56px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px;
  background: rgba(255,255,255,.045);
  padding: 0;
  cursor: pointer;
}
.souqy-output-list button.is-selected {
  border-color: rgba(201,169,97,.86);
  box-shadow: 0 0 0 2px rgba(201,169,97,.16);
}
.souqy-output-list img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.has-output-references .souqy-reference-gallery {
  grid-auto-columns: minmax(92px, 112px);
  gap: 8px;
  justify-content: center;
  max-inline-size: min(520px, 100%);
  margin-inline: auto;
}
.has-output-references .souqy-reference-gallery article {
  border-radius: 14px;
}
.has-output-references .souqy-reference-gallery img {
  aspect-ratio: 1 / 1;
}
.has-output-references .souqy-reference-gallery div {
  grid-template-columns: minmax(0, 1fr) 24px;
  padding: 6px;
}
.has-output-references .souqy-reference-gallery span {
  font-size: 10px;
}
.has-output-references .souqy-reference-gallery button {
  inline-size: 24px;
  block-size: 24px;
}
.souqy-canvas-stage {
  position: absolute;
  inset: 0;
  z-index: 6;
}
.has-output .souqy-canvas-stage {
  display: none;
}
.souqy-work-card {
  position: absolute;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(244,234,214,.18);
  background: var(--souqy-panel-strong);
  box-shadow: 0 30px 80px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.025);
  cursor: grab;
}
.souqy-work-card.is-selected {
  outline: 1px solid var(--souqy-gold);
  box-shadow: 0 34px 90px rgba(0,0,0,.55), 0 0 38px rgba(201,169,97,.16);
}
.souqy-work-card img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  pointer-events: none;
}
.souqy-work-card span {
  position: absolute;
  inset-inline: 8px;
  inset-block-end: 8px;
  border: 1px solid rgba(244,234,214,.12);
  border-radius: 999px;
  padding: 5px 8px;
  background: rgba(0,0,0,.58);
  color: rgba(244,234,214,.9);
  font-size: 10px;
  text-align: center;
  text-transform: capitalize;
  backdrop-filter: blur(10px);
}
.souqy-empty-wall {
  display: none;
}
.souqy-empty-wall div {
  aspect-ratio: 3 / 4;
  border: 1px solid rgba(244,234,214,.12);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(244,234,214,.08), transparent),
    rgba(0,0,0,.2);
  padding: 12px;
  color: var(--souqy-faint);
}
.souqy-empty-wall span {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .1em;
}
.souqy-empty-wall strong {
  display: block;
  margin-block-start: 58px;
  color: rgba(201,169,97,.72);
  font-family: var(--souqy-display);
  font-size: 34px;
  font-weight: 400;
}
.souqy-command-deck {
  position: absolute;
  z-index: 30;
  inset-inline-start: 50%;
  inset-block-end: 22px;
  transform: translateX(-50%);
  inline-size: min(820px, calc(100% - 112px));
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}
[dir='rtl'] .souqy-command-deck {
  inset-inline-start: auto;
  inset-inline-end: 50%;
  transform: translateX(50%);
}
.souqy-command-head,
.souqy-command-foot,
.souqy-context-head,
.souqy-panel-title,
.souqy-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.souqy-command-head {
  display: none;
}
.souqy-command-head strong {
  display: none;
}
.souqy-command-head small {
  color: var(--souqy-muted);
  font-size: 11px;
  font-weight: 700;
}
.souqy-quick-prompts {
  display: none;
}
.souqy-quick-prompts::-webkit-scrollbar {
  display: none;
}
.souqy-quick-prompts button {
  flex: 0 0 auto;
  max-inline-size: 240px;
  border: 1px solid var(--souqy-line);
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: var(--souqy-muted);
  padding: 7px 10px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.souqy-quick-prompts button:hover {
  color: var(--souqy-ink);
  border-color: rgba(216,226,238,.22);
}
.souqy-command-controls {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 7px;
  min-inline-size: 0;
}
.souqy-selector {
  position: relative;
  min-inline-size: 0;
}
.souqy-selector-compact {
  flex: 0 0 auto;
}
.souqy-composer .souqy-selector-trigger {
  position: relative;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-block-size: 36px;
  min-inline-size: 118px;
  max-inline-size: 156px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.035));
  padding: 0 12px;
  overflow: hidden;
  color: var(--souqy-ink);
  box-shadow: inset 0 1px rgba(255,255,255,.06);
  transition:
    transform .18s cubic-bezier(.2,.8,.2,1),
    border-color .18s ease,
    background .18s ease,
    color .18s ease;
}
.souqy-composer .souqy-selector-trigger-icon {
  inline-size: 38px;
  min-inline-size: 38px;
  max-inline-size: 38px;
  padding: 0;
}
.souqy-composer .souqy-selector-trigger[aria-expanded='true'],
.souqy-composer .souqy-selector-trigger:hover {
  background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.055));
  border-color: rgba(225,235,247,.26);
  transform: translateY(-1px);
}
.souqy-composer .souqy-selector-trigger strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
}
.souqy-composer .souqy-selector-trigger svg {
  flex: 0 0 auto;
}
.souqy-composer .souqy-selector-trigger svg:last-child {
  color: rgba(235,241,248,.7);
  opacity: .88;
}
.souqy-selector-menu {
  position: absolute;
  z-index: 60;
  inset-inline-start: 0;
  inset-block-end: calc(100% + 10px);
  inline-size: 222px;
  max-block-size: min(380px, 56vh);
  overflow: auto;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16,17,19,.98), rgba(7,8,10,.96));
  box-shadow: 0 28px 70px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.06);
  padding: 7px;
  backdrop-filter: blur(24px) saturate(1.08);
  -webkit-backdrop-filter: blur(24px) saturate(1.08);
  animation: souqyDropdownIn .18s cubic-bezier(.2,.8,.2,1);
  transform-origin: bottom left;
  scrollbar-width: thin;
  scrollbar-color: rgba(218,228,240,.22) transparent;
}
[dir='rtl'] .souqy-selector-menu {
  inset-inline-start: auto;
  inset-inline-end: 0;
  transform-origin: bottom right;
}
.souqy-selector-menu-format {
  inline-size: 236px;
}
.souqy-selector-title {
  display: block;
  padding: 7px 8px 8px;
  color: rgba(228,236,246,.68);
  font-size: 11px;
  font-weight: 750;
}
.souqy-composer .souqy-selector-menu button {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  inline-size: 100%;
  block-size: auto;
  min-block-size: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(228,236,246,.8);
  padding: 7px 8px;
  text-align: start;
  cursor: pointer;
}
.souqy-composer .souqy-selector-menu button:hover,
.souqy-composer .souqy-selector-menu button.is-selected {
  background: rgba(255,255,255,.085);
  color: var(--souqy-ink);
}
.souqy-composer .souqy-selector-menu button svg {
  color: rgba(228,236,246,.68);
}
.souqy-composer .souqy-selector-menu button span {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
}
.souqy-composer .souqy-selector-menu button small {
  color: rgba(228,236,246,.42);
  font-size: 10px;
  white-space: nowrap;
}
.souqy-composer .souqy-selector-menu button i {
  position: absolute;
  inset-inline-end: 8px;
  inline-size: 4px;
  block-size: 4px;
  border-radius: 999px;
  background: rgba(238,244,252,.86);
  box-shadow: 0 0 10px rgba(210,224,240,.48);
}
.souqy-composer-metal {
  display: block !important;
  inline-size: 100%;
  border-radius: 30px;
}
.souqy-composer-metal-host {
  inline-size: 100%;
  border-radius: 30px;
}
.souqy-composer {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 10px;
  border: 1px solid rgba(255,255,255,.105);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(30,32,35,.92), rgba(16,17,19,.94)),
    rgba(18,19,21,.94);
  box-shadow:
    0 26px 84px rgba(0,0,0,.5),
    inset 0 1px rgba(255,255,255,.065),
    inset 0 -1px rgba(255,255,255,.025);
  padding: 12px;
  backdrop-filter: blur(28px) saturate(1.1);
  -webkit-backdrop-filter: blur(28px) saturate(1.1);
  transition:
    border-color .24s ease,
    box-shadow .24s ease,
    background .24s ease,
    transform .24s cubic-bezier(.2,.8,.2,1);
  animation: souqyComposerBreath 7s ease-in-out infinite;
}
.souqy-composer:focus-within {
  border-color: rgba(230,238,248,.22);
  background:
    linear-gradient(180deg, rgba(35,38,42,.95), rgba(18,20,23,.96)),
    rgba(18,19,21,.96);
  box-shadow:
    0 30px 92px rgba(0,0,0,.55),
    0 0 28px rgba(158,177,201,.08),
    inset 0 1px rgba(255,255,255,.075),
    inset 0 -1px rgba(255,255,255,.03);
  transform: translateY(-1px);
}
.souqy-composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-inline-size: 0;
}
.souqy-composer-status {
  position: relative;
  min-block-size: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  border-radius: 999px;
  color: rgba(232,238,247,.54);
  padding: 0 8px 1px;
  font-size: 11px;
  line-height: 1.2;
}
.souqy-composer-status > span:not(.souqy-status-dot):not(.souqy-status-percent) {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-composer-status.is-generating {
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.035);
  color: rgba(242,247,255,.8);
  padding-block: 4px;
}
.souqy-status-loader {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
}
.souqy-composer-status [class*='bg-primary'] {
  background-color: rgba(238,244,252,.84) !important;
}
.souqy-composer-status [class*='border-primary'] {
  border-color: rgba(238,244,252,.84) !important;
}
.souqy-status-shimmer {
  --foreground: rgba(255,255,255,.94);
  --muted-foreground: rgba(176,188,205,.48);
  position: relative;
  z-index: 1;
  min-inline-size: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.souqy-status-percent {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  color: rgba(245,248,252,.88);
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}
.souqy-status-progress {
  position: absolute;
  inset-block: auto 0;
  inset-inline-start: 0;
  block-size: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,.2), rgba(255,255,255,.92));
  box-shadow: 0 0 14px rgba(218,230,246,.3);
  transition: inline-size .5s cubic-bezier(.2,.8,.2,1);
}
.souqy-status-dot {
  flex: 0 0 5px;
  inline-size: 5px;
  block-size: 5px;
  border-radius: 999px;
  background: rgba(230,238,248,.54);
  box-shadow: 0 0 10px rgba(230,238,248,.24);
}
.souqy-composer-actions {
  flex: 1 1 auto;
  min-inline-size: 0;
}
.souqy-composer button {
  inline-size: 38px;
  block-size: 38px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
  color: rgba(242,246,251,.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: inset 0 1px rgba(255,255,255,.07);
  transition:
    transform .18s cubic-bezier(.2,.8,.2,1),
    background .18s ease,
    border-color .18s ease,
    color .18s ease,
    opacity .18s ease;
}
.souqy-composer button:hover {
  border-color: rgba(225,235,247,.22);
  background: linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,.055));
  transform: translateY(-1px);
}
.souqy-submit-metal {
  display: inline-flex !important;
  border-radius: 999px;
}
.souqy-composer button[type='submit'] {
  border-color: rgba(255,255,255,.2);
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(184,197,214,.88));
  color: #050607;
  box-shadow:
    0 12px 32px rgba(0,0,0,.34),
    inset 0 1px rgba(255,255,255,.78);
}
.souqy-composer button[type='submit']:hover {
  background: linear-gradient(135deg, #fff, rgba(207,218,231,.94));
}
.souqy-composer button:disabled {
  cursor: wait;
  opacity: .7;
}
.souqy-composer textarea {
  min-block-size: 44px;
  max-block-size: 108px;
  resize: none;
  border: 0;
  background: transparent;
  color: inherit;
  outline: none;
  padding: 6px 8px 0;
  line-height: 1.45;
  overflow-y: auto;
  scrollbar-width: none;
}
.souqy-composer textarea::placeholder {
  color: rgba(232,238,247,.36);
}
.souqy-composer textarea::-webkit-scrollbar {
  display: none;
}
.souqy-reference-gallery {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(154px, 188px);
  gap: 10px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding-block-end: 2px;
  scrollbar-width: none;
}
.souqy-reference-gallery::-webkit-scrollbar {
  display: none;
}
.souqy-reference-gallery article {
  min-inline-size: 0;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 18px;
  background: rgba(20,20,19,.9);
  box-shadow: 0 18px 50px rgba(0,0,0,.32), inset 0 1px rgba(255,255,255,.045);
}
.souqy-reference-gallery img {
  display: block;
  inline-size: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background:
    linear-gradient(135deg, rgba(255,255,255,.035), transparent),
    rgba(0,0,0,.38);
}
.souqy-reference-gallery div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-block-start: 1px solid rgba(255,255,255,.08);
}
.souqy-reference-gallery span {
  min-inline-size: 0;
  overflow: hidden;
  color: rgba(228,236,246,.68);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-reference-gallery button {
  inline-size: 28px;
  block-size: 28px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: rgba(228,236,246,.68);
  cursor: pointer;
}
.souqy-reference-gallery button:hover {
  background: rgba(255,255,255,.1);
  color: var(--souqy-ink);
}
.souqy-command-foot {
  display: block;
  margin-block-start: 7px;
  padding: 0 16px;
  pointer-events: none;
}
.souqy-command-foot p {
  margin: 0;
  color: var(--souqy-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-command-foot > div {
  display: none;
}
.souqy-command-foot button,
.souqy-staged-action,
.souqy-export-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(244,234,214,.055);
  color: var(--souqy-muted);
  min-block-size: 34px;
  padding: 0 10px;
  cursor: pointer;
  font-size: 12px;
}
.souqy-context-head {
  align-items: start;
  margin-block-end: 16px;
}
.souqy-context-head strong {
  display: block;
  font-size: 30px;
  font-weight: 400;
  line-height: 1;
  text-align: end;
}
.souqy-panel-card,
.souqy-cinema-frame,
.souqy-slogan-card,
.souqy-founder-card {
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(244,234,214,.055);
  padding: 14px;
  margin-block-end: 14px;
}
.souqy-panel-title span,
.souqy-field > span,
.souqy-slider > span,
.souqy-toggle-row > span,
.souqy-product-picker > span,
.souqy-selected-asset > span,
.souqy-memory-list > span {
  color: var(--souqy-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.souqy-panel-title strong {
  font-family: var(--souqy-display);
  font-size: 20px;
  font-weight: 400;
}
.souqy-field,
.souqy-slider,
.souqy-product-picker,
.souqy-selected-asset,
.souqy-memory-list {
  display: grid;
  gap: 8px;
  margin-block-end: 14px;
}
.souqy-field select,
.souqy-field textarea {
  inline-size: 100%;
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(0,0,0,.18);
  color: inherit;
  padding: 10px;
  outline: none;
}
.souqy-field textarea {
  min-block-size: 82px;
  resize: none;
  line-height: 1.45;
}
.souqy-toggle-row input {
  inline-size: 42px;
  block-size: 22px;
  accent-color: var(--souqy-gold);
}
.souqy-slider input {
  accent-color: var(--souqy-gold);
}
.souqy-slider small {
  color: var(--souqy-gold);
}
.souqy-product-picker button,
.souqy-memory-list a,
.souqy-format-stack button,
.souqy-campaign-list article,
.souqy-flow div {
  display: grid;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(0,0,0,.16);
  color: inherit;
  text-align: start;
}
.souqy-product-picker button {
  grid-template-columns: 30px minmax(0, 1fr) auto;
  padding: 8px;
  cursor: pointer;
}
.souqy-product-picker button.is-active {
  border-color: rgba(201,169,97,.42);
  background: rgba(201,169,97,.09);
}
.souqy-product-picker i,
.souqy-memory-list i {
  inline-size: 30px;
  block-size: 30px;
  border-radius: 6px;
  background: center/cover;
}
.souqy-product-picker span,
.souqy-memory-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.souqy-product-picker small,
.souqy-product-picker p,
.souqy-selected-asset p,
.souqy-memory-list p,
.souqy-cinema-frame p,
.souqy-founder-card p {
  color: var(--souqy-muted);
  font-size: 12px;
  line-height: 1.45;
}
.souqy-selected-asset {
  border-block-start: 1px solid var(--souqy-line);
  padding-block-start: 14px;
}
.souqy-selected-asset img {
  inline-size: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--souqy-line);
}
.souqy-selected-asset a {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--souqy-gold), #d7bd7e);
  color: #080705;
  text-decoration: none;
  padding: 10px;
  font-weight: 700;
}
.souqy-memory-list a {
  grid-template-columns: 30px minmax(0, 1fr);
  padding: 8px;
  text-decoration: none;
}
.souqy-export-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.souqy-export-row button:disabled,
.souqy-format-stack button:disabled,
.souqy-staged-action:disabled {
  opacity: .58;
  cursor: default;
}
.souqy-format-stack {
  display: grid;
  gap: 9px;
  margin-block-end: 14px;
}
.souqy-format-stack button {
  grid-template-columns: 20px 1fr auto;
  min-block-size: 48px;
  padding: 0 12px;
}
.souqy-cinema-frame {
  min-block-size: 220px;
  display: flex;
  flex-direction: column;
  justify-content: end;
  background:
    linear-gradient(180deg, transparent, rgba(0,0,0,.42)),
    repeating-linear-gradient(90deg, rgba(244,234,214,.08) 0 1px, transparent 1px 28px),
    rgba(139,58,58,.08);
}
.souqy-cinema-frame > span {
  align-self: start;
  inline-size: 56px;
  block-size: 3px;
  background: var(--souqy-gold);
  margin-block-end: auto;
}
.souqy-cinema-frame strong,
.souqy-slogan-card p,
.souqy-founder-card strong {
  font-family: var(--souqy-display);
  font-size: 25px;
  font-weight: 400;
}
.souqy-campaign-list,
.souqy-recommendation-list,
.souqy-flow {
  display: grid;
  gap: 10px;
  margin-block-end: 14px;
}
.souqy-campaign-list article {
  padding: 12px;
}
.souqy-campaign-list div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-block-start: 9px;
}
.souqy-campaign-list span {
  border: 1px solid var(--souqy-line);
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--souqy-muted);
  font-size: 11px;
}
.souqy-slogan-card small {
  color: var(--souqy-gold);
}
.souqy-slogan-card p {
  margin: 8px 0 0;
  line-height: 1.15;
}
.souqy-intel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-block-end: 14px;
}
.souqy-intel-grid div,
.souqy-recommendation-list article {
  border: 1px solid var(--souqy-line);
  border-radius: 8px;
  background: rgba(244,234,214,.055);
  padding: 12px;
}
.souqy-intel-grid strong {
  display: block;
  color: var(--souqy-gold);
  font-family: var(--souqy-display);
  font-size: 34px;
  font-weight: 400;
}
.souqy-intel-grid span,
.souqy-recommendation-list small {
  color: var(--souqy-muted);
  font-size: 11px;
}
.souqy-recommendation-list strong {
  display: block;
  margin-block-start: 6px;
  line-height: 1.3;
}
.souqy-flow {
  position: relative;
}
.souqy-flow::before {
  content: '';
  position: absolute;
  inset-block: 24px;
  inset-inline-start: 18px;
  inline-size: 1px;
  background: rgba(201,169,97,.35);
}
[dir='rtl'] .souqy-flow::before {
  inset-inline-start: auto;
  inset-inline-end: 18px;
}
.souqy-flow div {
  position: relative;
  z-index: 1;
  grid-template-columns: 28px 1fr;
  min-block-size: 52px;
  padding: 0 12px;
}
.souqy-flow span {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: 999px;
  background: var(--souqy-gold);
  color: #080705;
  font-size: 12px;
  font-weight: 800;
}
.souqy-founder-card {
  display: grid;
  gap: 10px;
}
.souqy-founder-card svg {
  color: var(--souqy-gold);
}
.is-founder-mode {
  grid-template-columns: 96px minmax(0, 1fr);
}
.is-founder-mode .souqy-left-rail {
  padding-inline: 10px;
}
.is-founder-mode .souqy-rail-brand div,
.is-founder-mode .souqy-module-nav span,
.is-founder-mode .souqy-module-nav small,
.is-founder-mode .souqy-rail-mini,
.is-founder-mode .souqy-hero span,
.is-founder-mode .souqy-topbar-title,
.is-founder-mode .souqy-founder-toggle span {
  display: none;
}
.is-founder-mode .souqy-module-nav button {
  grid-template-columns: 1fr;
  justify-items: center;
}
.is-founder-mode .souqy-hero {
  opacity: .46;
}
.is-founder-mode .souqy-command-deck {
  inline-size: min(820px, calc(100vw - 160px));
}
@keyframes souqyPulse {
  0%, 100% { transform: translateX(-28%); opacity: .48; }
  50% { transform: translateX(22%); opacity: 1; }
}
@keyframes souqyDropdownIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes souqyComposerBreath {
  0%, 100% {
    box-shadow:
      0 26px 84px rgba(0,0,0,.5),
      0 0 0 rgba(158,177,201,0),
      inset 0 1px rgba(255,255,255,.065),
      inset 0 -1px rgba(255,255,255,.025);
  }
  50% {
    box-shadow:
      0 28px 88px rgba(0,0,0,.52),
      0 0 30px rgba(158,177,201,.075),
      inset 0 1px rgba(255,255,255,.075),
      inset 0 -1px rgba(255,255,255,.03);
  }
}
@keyframes wave {
  0%, 100% { transform: scaleY(.42); opacity: .48; }
  50% { transform: scaleY(1); opacity: 1; }
}
@keyframes shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@media (max-width: 1180px) {
  .souqy-workplace {
    grid-template-columns: 1fr;
    overflow: auto;
  }
  .souqy-left-rail {
    position: fixed;
    z-index: 80;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: min(286px, 86vw);
    align-items: center;
    transform: translateX(-105%);
    transition: transform .24s ease;
  }
  [dir='rtl'] .souqy-left-rail {
    inset-inline-start: auto;
    inset-inline-end: 0;
    transform: translateX(105%);
  }
  .souqy-workplace.is-rail-open .souqy-left-rail {
    transform: translateX(0);
    align-items: stretch;
  }
  .souqy-workplace.is-rail-open .souqy-module-nav {
    justify-items: stretch;
  }
  .souqy-workplace.is-rail-open .souqy-module-nav button {
    inline-size: 100%;
    grid-template-columns: 22px minmax(0, 1fr);
    justify-items: start;
    gap: 10px;
    padding: 0 12px;
    color: rgba(244,234,214,.84);
  }
  .souqy-workplace.is-rail-open .souqy-module-nav button:hover,
  .souqy-workplace.is-rail-open .souqy-module-nav button.is-active {
    color: #050505;
  }
  .souqy-workplace.is-rail-open .souqy-module-nav span {
    position: static;
    inline-size: auto;
    block-size: auto;
    overflow: hidden;
    clip: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-inline-size: 0;
    white-space: nowrap;
  }
  .souqy-workplace.is-rail-open .souqy-module-nav span strong {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 700;
  }
  .souqy-workplace.is-rail-open .souqy-module-nav span small {
    display: inline-flex;
    border: 1px solid rgba(244,234,214,.12);
    border-radius: 999px;
    padding: 2px 6px;
    color: rgba(244,234,214,.45);
    font-size: 9px;
    text-transform: uppercase;
  }
  .souqy-workplace.is-rail-open .souqy-rail-expand {
    inline-size: 100%;
    justify-content: flex-start;
    padding-inline: 12px;
  }
  .souqy-workplace.is-rail-open .souqy-rail-expand span {
    display: inline;
  }
  .souqy-rail-scrim {
    position: fixed;
    inset: 0;
    z-index: 70;
    border: 0;
    background: rgba(0,0,0,.54);
  }
  .souqy-main {
    min-block-size: 100dvh;
  }
  .souqy-mobile-menu {
    display: inline-flex;
  }
  .souqy-command-deck {
    inline-size: min(760px, calc(100vw - 44px));
  }
  .souqy-context-panel {
    display: none;
  }
  .souqy-hero {
    inset-inline: 50% auto;
    max-inline-size: min(520px, calc(100% - 48px));
    transform: translateX(-50%);
  }
  .is-founder-mode {
    grid-template-columns: 1fr;
  }
  .is-founder-mode .souqy-left-rail {
    transform: translateX(-105%);
  }
}
@media (max-width: 760px) {
  .souqy-topbar {
    display: flex;
    inset-inline: 12px;
    inset-block-start: 12px;
    align-items: stretch;
    justify-content: space-between;
    gap: 8px;
  }
  .souqy-topbar-title {
    display: none;
  }
  .souqy-founder-toggle,
  .souqy-mobile-menu {
    min-inline-size: 48px;
    justify-content: center;
  }
  .souqy-founder-toggle span {
    display: none;
  }
  .souqy-hero {
    inset-block-start: 136px;
    inset-inline: 50% auto;
    inline-size: calc(100% - 36px);
    max-inline-size: 420px;
    transform: translateX(-50%);
  }
  .souqy-hero h1 {
    font-size: clamp(28px, 9vw, 40px);
  }
  .souqy-output-view {
    --souqy-output-max-block: min(48dvh, calc(100dvh - 380px));
    inset-block-start: 72px;
    inline-size: calc(100% - 20px);
    gap: 8px;
  }
  .souqy-output-frame {
    min-block-size: 160px;
    border-radius: 18px;
  }
  .souqy-output-meta {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
    border-radius: 14px;
    padding: 10px;
  }
  .souqy-output-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .souqy-output-actions button,
  .souqy-output-actions a {
    padding-inline: 10px;
  }
  .souqy-output-list button {
    flex-basis: 50px;
    inline-size: 50px;
    block-size: 50px;
  }
  .has-output-references .souqy-reference-gallery {
    grid-auto-columns: minmax(76px, 88px);
    justify-content: start;
  }
  .souqy-empty-wall {
    display: none;
  }
  .souqy-command-deck {
    inset-inline: 10px;
    inset-block-end: 10px;
    transform: none;
    inline-size: auto;
  }
  [dir='rtl'] .souqy-command-deck {
    inset-inline: 10px;
    transform: none;
  }
  .souqy-command-head strong {
    font-size: 18px;
  }
  .souqy-command-controls {
    flex: 1 1 auto;
    gap: 6px;
    overflow: visible;
  }
  .souqy-selector {
    min-inline-size: 0;
    flex: 1 1 96px;
  }
  .souqy-selector-compact {
    flex: 0 0 auto;
  }
  .souqy-composer .souqy-selector-trigger {
    inline-size: 100%;
    min-inline-size: 0;
    padding-inline: 10px;
  }
  .souqy-composer .souqy-selector-trigger-icon {
    inline-size: 36px;
    min-inline-size: 36px;
    max-inline-size: 36px;
    padding: 0;
  }
  .souqy-selector-menu,
  .souqy-selector-menu-format {
    inline-size: min(242px, calc(100vw - 40px));
  }
  .souqy-selector-compact .souqy-selector-menu {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  .souqy-composer textarea {
    min-block-size: 54px;
  }
  .souqy-composer {
    border-radius: 24px;
    padding: 10px;
  }
  .souqy-composer-toolbar {
    gap: 7px;
  }
  .souqy-composer button {
    inline-size: 36px;
    block-size: 36px;
  }
  .souqy-composer-actions {
    gap: 6px;
  }
  .souqy-command-foot {
    align-items: start;
    flex-direction: column;
  }
  .souqy-command-foot p {
    white-space: normal;
  }
  .souqy-command-foot button span {
    display: none;
  }
  .souqy-context-panel {
    padding: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .souqy-left-rail {
    transition: none !important;
  }
  .souqy-composer {
    animation: none !important;
    transition: none !important;
  }
}
`;
