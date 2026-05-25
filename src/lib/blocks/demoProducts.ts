import type { BusinessType, TemplateId } from '@/lib/brief';
import type { Locale } from '@/i18n/locales';
import { db } from '@/lib/db';
import { insertProduct, type ProductWriteInput } from '@/lib/products';
import { getSeedImage } from '@/lib/products/seedImages';
import { getTemplateIndustrySeed, type SeedProduct } from './templateIndustrySeed';

/**
 * Per-template demo product seeding.
 *
 * Block schemas don't allow inline product data — every product-bearing
 * block reads from the storefront's `products` table at render time.
 * Without rows, a brand-new template-applied storefront looks "blank"
 * even though the layout is fully composed. This module seeds 4–6
 * themed rows so the first-run preview reads as fully populated, and
 * teaches the founder what each block surfaces.
 *
 * **Idempotency contract:** `seedTemplateDemoProducts` is a no-op when
 * the storefront's `products` table already has any rows for that slug.
 * That keeps the seed safe to run from both the /begin first-create
 * path AND a later template switch — neither will overwrite a founder
 * who has added their own products in the meantime.
 *
 * **Demo tagging (migration 036):** every row seeded by this module
 * carries `is_demo = true`, so the dashboard can show a "remove sample
 * content" banner and bulk-clear them with one click. Merchant-added
 * products never carry the flag.
 *
 * **Images:** sourced from `public/seed-products/<templateId>/<n>.svg`
 * via `getSeedImage()` — no external CDN. The SVGs are palette-coordinated
 * per template so a fresh storefront reads as designed.
 *
 * **Locale:** when the storefront's locale is `ar`, the seeder prefers
 * the row's Arabic title/description if provided; otherwise it falls
 * back to the English text so a missing translation never blocks
 * storefront creation.
 */
type DemoProduct = SeedProduct;

// `active` only — keeps the contract simple so the founder sees them
// all on first load and can decide what to keep.
const DEMOS: Record<TemplateId, DemoProduct[]> = {
  atrium: [
    {
      title: 'Linen Blazer · Walnut',
      titleAr: 'بليزر الكتان · جوزي',
      description: 'Mid-weight Belgian linen, half-lined, cut for a relaxed shoulder.',
      descriptionAr: 'كتان بلجيكي متوسط الوزن، بطانة جزئية، قصّة كتف مريحة.',
      priceQar: 880,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Silk Camisole · Pearl',
      titleAr: 'كاميسول حرير · لؤلؤي',
      description: 'Sand-washed silk with a hand-rolled hem.',
      descriptionAr: 'حرير مغسول بالرمل مع حافة ملفوفة يدوياً.',
      priceQar: 360,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Suede Loafer · Cumin',
      titleAr: 'حذاء سويد · كموني',
      description: 'Italian suede, leather-lined, hand-finished welt.',
      descriptionAr: 'سويد إيطالي بطانة جلدية وحاشية مُنهاة يدوياً.',
      priceQar: 540,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Cashmere Knit · Sand',
      titleAr: 'تريكو كشمير · رملي',
      description: 'Six-ply Mongolian cashmere in a dropped-shoulder cut.',
      descriptionAr: 'كشمير منغولي بست طبقات بقصّة كتف منسدلة.',
      priceQar: 720,
      category: 'new',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Wool Trouser · Charcoal',
      titleAr: 'بنطال صوف · فحمي',
      description: 'Tropical wool, single-pleat, finished in our Doha atelier.',
      descriptionAr: 'صوف خفيف بطية واحدة، يُخاط في ورشتنا بالدوحة.',
      priceQar: 620,
      category: 'new',
      eventAt: null,
      status: 'active',
    },
  ],

  souqline: [
    {
      title: 'Saffron · Persian 5g',
      titleAr: 'زعفران · فارسي ٥ جم',
      description: 'Hand-graded coupe threads, sealed at source.',
      descriptionAr: 'خيوط مختارة يدوياً، مختومة من المصدر.',
      priceQar: 45,
      category: 'pantry',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Cardamom · Whole 50g',
      titleAr: 'هيل · حبّ ٥٠ جم',
      description: 'Green pods, freshly milled to order.',
      descriptionAr: 'حبّات خضراء تُطحن طازجة عند الطلب.',
      priceQar: 28,
      category: 'pantry',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Date Spread · Khalas',
      titleAr: 'دبس تمر · خلاص',
      description: 'Pure Khalas date paste — no added sugar, jar of 250 g.',
      descriptionAr: 'معجون تمر خلاص نقي، بدون سكر مضاف، علبة ٢٥٠ جم.',
      priceQar: 35,
      category: 'pantry',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Glass Tea Set · Six cups',
      titleAr: 'طقم شاي زجاجي · ست كاسات',
      description: 'Hand-blown istikan tumblers with brass-rimmed saucers.',
      descriptionAr: 'كاسات استكان منفوخة يدوياً مع صحون بحواف نحاسية.',
      priceQar: 120,
      category: 'home',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Brass Mortar · Hand-cast',
      titleAr: 'هاون نحاسي · مصبوب يدوياً',
      description: 'Solid brass mortar and pestle, polished by hand.',
      descriptionAr: 'هاون ومدقّ من النحاس الخالص، ملمّع يدوياً.',
      priceQar: 95,
      category: 'home',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Turkish Delight · 500 g',
      titleAr: 'راحة الحلقوم · ٥٠٠ جم',
      description: 'Rose, pistachio and lemon, dusted in icing sugar.',
      descriptionAr: 'ورد وفستق وليمون، مغطّاة بالسكر الناعم.',
      priceQar: 60,
      category: 'pantry',
      eventAt: null,
      status: 'active',
    },
  ],

  kiosk: [
    {
      title: 'Stoneware Tumbler · Set of two',
      titleAr: 'كوب فخّاري · طقم من اثنين',
      description: 'Hand-thrown in Doha, glazed in tannour terracotta.',
      descriptionAr: 'مصنوع يدوياً في الدوحة بطلاء التنّور.',
      priceQar: 180,
      category: 'edition-01',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Hand-thrown Bowl · Tannour',
      titleAr: 'صحن يدوي · تنّور',
      description: 'Single-firing stoneware with a satin-matte finish.',
      descriptionAr: 'فخّار من حرق واحد بلمسة نهائية ساتان مطفية.',
      priceQar: 240,
      category: 'edition-01',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Leather Carryall · Cinnamon',
      titleAr: 'حقيبة جلدية · قرفية',
      description: 'Vegetable-tanned bridle leather, sewn by one pair of hands.',
      descriptionAr: 'جلد مدبوغ نباتياً، خياطة بأيدٍ واحدة.',
      priceQar: 760,
      category: 'edition-01',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Brass Candlestick · Pair',
      titleAr: 'حامل شموع نحاسي · زوج',
      description: 'Lost-wax cast brass, weighted bases, hand-polished.',
      descriptionAr: 'نحاس مصبوب بطريقة الشمع المفقود، قواعد ثقيلة، ملمّع يدوياً.',
      priceQar: 320,
      category: 'edition-01',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Linen Apron · Indigo',
      titleAr: 'مريول كتاني · نيلي',
      description: 'Cross-back apron in heavyweight Belgian linen.',
      descriptionAr: 'مريول بحمّالات متقاطعة من الكتان البلجيكي الثقيل.',
      priceQar: 240,
      category: 'edition-01',
      eventAt: null,
      status: 'active',
    },
  ],

  // The lounge template renders three menu blocks pinned by category.
  // Match the categorySlugs in `boot.ts` (`starters`, `mains`, `drinks`)
  // so the menu surfaces these rows in the right group.
  lounge: [
    {
      title: 'Mezze plate · for two',
      titleAr: 'طبق مازة · لشخصين',
      description: 'Hummus, mutabal, labneh, olives, warm flatbread.',
      descriptionAr: 'حمّص، متبّل، لبنة، زيتون، خبز ساخن.',
      priceQar: 65,
      category: 'starters',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Citrus salad',
      titleAr: 'سلطة حمضيات',
      description: 'Blood orange, fennel, mint, cold-pressed Qatari oil.',
      descriptionAr: 'برتقال أحمر، شمر، نعناع، زيت قطري معصور على البارد.',
      priceQar: 38,
      category: 'starters',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Lamb mansaf',
      titleAr: 'منسف بلحم الخروف',
      description: 'Slow-cooked lamb, jameed yoghurt, smoked rice.',
      descriptionAr: 'لحم خروف بطيء الطهي، جميد، أرز مدخّن.',
      priceQar: 95,
      category: 'mains',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Sea bass on coal',
      titleAr: 'هامور على الفحم',
      description: 'Whole sea bass, grilled over coals, lemon and za’atar.',
      descriptionAr: 'سمكة هامور كاملة مشوية على الفحم مع ليمون وزعتر.',
      priceQar: 110,
      category: 'mains',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Cardamom espresso',
      titleAr: 'إسبريسو بالهيل',
      description: 'Single-origin espresso lifted with cracked cardamom.',
      descriptionAr: 'إسبريسو من منشأ واحد بنكهة الهيل المطحون.',
      priceQar: 22,
      category: 'drinks',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Rose lemonade',
      titleAr: 'ليموناضة بالورد',
      description: 'Sicilian lemon, Persian rose, sparkling.',
      descriptionAr: 'ليمون صقلي، ماء ورد فارسي، فوّار.',
      priceQar: 28,
      category: 'drinks',
      eventAt: null,
      status: 'active',
    },
  ],

  // Studio's productGrid is filtered by `categorySlug='services'` so the
  // demo rows match. The serviceList rows above are inline — these are
  // the "extras" surfaced underneath.
  studio: [
    {
      title: 'Intro session · 60 min',
      titleAr: 'جلسة تعارف · ٦٠ دقيقة',
      description: 'A first conversation to map what you are after.',
      descriptionAr: 'محادثة أولى لرسم ما تبحث عنه.',
      priceQar: 220,
      category: 'services',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Pack of four · weekly',
      titleAr: 'حزمة أربع جلسات · أسبوعية',
      description: 'Four sessions across four weeks, billed up front.',
      descriptionAr: 'أربع جلسات على مدى أربعة أسابيع، الدفع مقدّماً.',
      priceQar: 760,
      category: 'services',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Group class · Sunday',
      titleAr: 'فصل جماعي · يوم الأحد',
      description: 'Up to six people, capped so everyone gets attention.',
      descriptionAr: 'حتى ستة أشخاص، عدد محدود ليحظى الجميع بالاهتمام.',
      priceQar: 120,
      category: 'services',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Day-of recovery',
      titleAr: 'جلسة استرداد',
      description: 'A 90-minute reset for the day after a hard one.',
      descriptionAr: 'إعادة ضبط لمدة ٩٠ دقيقة لليوم الذي يلي يوماً متعباً.',
      priceQar: 320,
      category: 'services',
      eventAt: null,
      status: 'active',
    },
  ],

  // Bazaar's "featured-collections" grid is filtered by
  // `categorySlug='featured'` so the demos use that handle.
  bazaar: [
    {
      title: 'Drop 01 · Cardigan',
      titleAr: 'إصدار ٠١ · كارديغان',
      description: 'Boucle wool, dropped shoulder, oyster button.',
      descriptionAr: 'صوف بوكليه، كتف منسدل، أزرار صدفية.',
      priceQar: 880,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Drop 01 · Dress',
      titleAr: 'إصدار ٠١ · فستان',
      description: 'Pleated crepe in olive, mid-calf, side slits.',
      descriptionAr: 'كريب مطوي بلون زيتوني، طول منتصف الساق، فتحات جانبية.',
      priceQar: 920,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Drop 01 · Wide trouser',
      titleAr: 'إصدار ٠١ · بنطال واسع',
      description: 'Heavyweight wool, high waist, single pleat.',
      descriptionAr: 'صوف ثقيل، خصر عالٍ، طية واحدة.',
      priceQar: 640,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Drop 01 · Knit',
      titleAr: 'إصدار ٠١ · تريكو',
      description: 'Geelong lambswool in a brushed-cable knit.',
      descriptionAr: 'صوف خروف جيلونغ بنسج كابل مفروش.',
      priceQar: 540,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Drop 01 · Loafer',
      titleAr: 'إصدار ٠١ · لوفر',
      description: 'Hand-stitched leather loafer in burnished olive.',
      descriptionAr: 'حذاء لوفر مخيط يدوياً بلون زيتوني ملمّع.',
      priceQar: 720,
      category: 'featured',
      eventAt: null,
      status: 'active',
    },
  ],

  vitrine: [
    {
      title: 'Cotton shirt · Pearl',
      titleAr: 'قميص قطني · لؤلؤي',
      description: 'Sea-cotton poplin, French cuff, mother-of-pearl button.',
      descriptionAr: 'قطن بحري بوبلين، أزرار فرنسية، أزرار من عرق اللؤلؤ.',
      priceQar: 480,
      category: 'spring',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Linen dress · Lagoon',
      titleAr: 'فستان كتاني · لاغون',
      description: 'Belgian linen with a cut-on shoulder and bias hem.',
      descriptionAr: 'كتان بلجيكي بكتف مدمج وحاشية مائلة.',
      priceQar: 760,
      category: 'spring',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Wide-leg trouser',
      titleAr: 'بنطال واسع الساق',
      description: 'Heavy poplin, high waist, hand-finished hem.',
      descriptionAr: 'بوبلين ثقيل، خصر عالٍ، حاشية منهاة يدوياً.',
      priceQar: 540,
      category: 'spring',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Pearl earrings · drop',
      titleAr: 'أقراط لؤلؤ · متدلية',
      description: 'Single freshwater pearl, brushed gold post.',
      descriptionAr: 'لؤلؤة عذبة واحدة، عمود ذهبي مفروش.',
      priceQar: 320,
      category: 'jewellery',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Linen blazer · Lagoon',
      titleAr: 'بليزر كتاني · لاغون',
      description: 'Single-breasted, half-canvas, two-button stance.',
      descriptionAr: 'صدر واحد، نصف قماشي، بزرّين.',
      priceQar: 920,
      category: 'spring',
      eventAt: null,
      status: 'active',
    },
  ],

  monoline: [
    {
      title: 'Family table · for six',
      titleAr: 'طاولة عائلية · لستة أشخاص',
      description: 'A four-course menu for the table, served family-style.',
      descriptionAr: 'قائمة من أربعة أطباق للطاولة، تقديم عائلي.',
      priceQar: 720,
      category: 'tables',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Tasting menu · seven courses',
      titleAr: 'قائمة التذوّق · سبعة أطباق',
      description: 'Chef’s tasting menu with optional pairing.',
      descriptionAr: 'قائمة تذوّق الشيف مع خيار الاقتران بالمشروبات.',
      priceQar: 480,
      category: 'tables',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Private dining · for ten',
      titleAr: 'عشاء خاص · لعشرة أشخاص',
      description: 'Private room, dedicated service, set or bespoke menu.',
      descriptionAr: 'صالة خاصة، خدمة مخصّصة، قائمة ثابتة أو حسب الطلب.',
      priceQar: 4800,
      category: 'private',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Sunday lunch',
      titleAr: 'غداء الأحد',
      description: 'A long, slow lunch — three courses, one setting only.',
      descriptionAr: 'غداء طويل ومتأنٍ — ثلاثة أطباق، حجز واحد فقط.',
      priceQar: 280,
      category: 'tables',
      eventAt: null,
      status: 'active',
    },
  ],

  harvest: [
    {
      title: 'Jute basket · Khor weave',
      titleAr: 'سلة جوت · حياكة الخور',
      description: 'Hand-woven jute basket from the Khor workshop.',
      descriptionAr: 'سلة جوت محبوكة يدوياً من ورشة الخور.',
      priceQar: 220,
      category: 'home',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Acacia chopping block',
      titleAr: 'لوح تقطيع أكاسيا',
      description: 'End-grain acacia block, sealed with food-safe oil.',
      descriptionAr: 'لوح أكاسيا بألياف نهائية، مغلّف بزيت آمن للطعام.',
      priceQar: 180,
      category: 'kitchen',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Ceramic vase · Inlet',
      titleAr: 'مزهرية خزفية · خَور',
      description: 'Hand-thrown stoneware in a sage celadon glaze.',
      descriptionAr: 'فخّار مرمي يدوياً بطلاء سيلادون مريمي.',
      priceQar: 360,
      category: 'home',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Linen runner · 2.4 m',
      titleAr: 'مفرش كتاني · ٢٫٤ م',
      description: 'Hand-loomed linen runner, sage and oat stripe.',
      descriptionAr: 'مفرش كتان منسوج يدوياً بخطوط مريمية وشوفان.',
      priceQar: 280,
      category: 'home',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Olive-wood serving board',
      titleAr: 'لوح تقديم من خشب الزيتون',
      description: 'Single-piece olive wood, oiled to a soft sheen.',
      descriptionAr: 'قطعة واحدة من خشب الزيتون، مزيّتة بلمعة ناعمة.',
      priceQar: 240,
      category: 'kitchen',
      eventAt: null,
      status: 'active',
    },
  ],

  launchpad: [
    {
      title: 'Starter · per seat',
      titleAr: 'الباقة الأساسية · لكل مقعد',
      description: 'Everything to get a small team shipping this week.',
      descriptionAr: 'كل ما يحتاجه فريق صغير ليُطلق هذا الأسبوع.',
      priceQar: 80,
      category: 'starter',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Pro · per seat',
      titleAr: 'الباقة المتقدمة · لكل مقعد',
      description: 'Higher limits, advanced workflows, priority support.',
      descriptionAr: 'حدود أعلى، تدفقات عمل متقدمة، دعم بأولوية.',
      priceQar: 220,
      category: 'pro',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Business · per seat',
      titleAr: 'باقة الأعمال · لكل مقعد',
      description: 'SSO, audit log, dedicated success manager.',
      descriptionAr: 'تسجيل دخول موحّد، سجلّ تدقيق، مدير نجاح مخصّص.',
      priceQar: 540,
      category: 'pro',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Enterprise · custom',
      titleAr: 'باقة المؤسسات · حسب الطلب',
      description: 'Custom limits, on-prem option, contractual SLA.',
      descriptionAr: 'حدود مخصّصة، خيار التشغيل الداخلي، اتفاقية مستوى خدمة.',
      priceQar: null,
      category: 'enterprise',
      eventAt: null,
      status: 'active',
    },
  ],

  frame: [
    {
      title: 'Print · Oryx at dawn',
      titleAr: 'لوحة · المها عند الفجر',
      description: 'Edition of fifteen, archival giclée on Hahnemühle Photo Rag.',
      descriptionAr: 'إصدار من خمس عشرة نسخة، طباعة جيكليه على ورق هانمولِه فوتو راج.',
      priceQar: 540,
      category: 'prints',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Print · Doha night',
      titleAr: 'لوحة · ليل الدوحة',
      description: 'Edition of ten, archival pigment, signed and numbered.',
      descriptionAr: 'إصدار من عشر نسخ، حبر أرشيفي، موقّعة ومرقّمة.',
      priceQar: 620,
      category: 'prints',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Print · Dunes, study 03',
      titleAr: 'لوحة · الكثبان، دراسة ٠٣',
      description: 'Edition of fifteen, fine-art baryta, hand-titled verso.',
      descriptionAr: 'إصدار من خمس عشرة نسخة، ورق باريتا فني، عنوان يدوي خلفي.',
      priceQar: 480,
      category: 'prints',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Commission · half-day',
      titleAr: 'تكليف · نصف يوم',
      description: 'A four-hour shoot anywhere in Doha. Includes 30 edits.',
      descriptionAr: 'تصوير لأربع ساعات في أي مكان في الدوحة. يشمل ٣٠ صورة معالجة.',
      priceQar: 2200,
      category: 'commissions',
      eventAt: null,
      status: 'active',
    },
    {
      title: 'Commission · full-day',
      titleAr: 'تكليف · يوم كامل',
      description: 'A full-day editorial assignment, eight hours, 60 edits.',
      descriptionAr: 'مهمة تحريرية ليوم كامل، ثماني ساعات، ٦٠ صورة معالجة.',
      priceQar: 3800,
      category: 'commissions',
      eventAt: null,
      status: 'active',
    },
  ],
};

/**
 * Resolve a single seed row into the final `ProductWriteInput` shape:
 * pick locale-appropriate title/description, attach the templated SVG
 * image URL, and tag with `isDemo: true`. Falls back to English for any
 * row whose Arabic translation is missing — preferable to a hard error
 * on the storefront-create hot path.
 */
function materializeSeed(
  seed: DemoProduct,
  templateId: TemplateId,
  index: number,
  locale: Locale,
): ProductWriteInput {
  const useAr = locale === 'ar';
  const title = useAr && seed.titleAr ? seed.titleAr : seed.title;
  const description = useAr && seed.descriptionAr ? seed.descriptionAr : seed.description;
  return {
    title,
    description,
    priceQar: seed.priceQar,
    pricingMode: seed.pricingMode,
    monthlyPriceQar: seed.monthlyPriceQar,
    imageUrl: getSeedImage(templateId, index),
    category: seed.category,
    eventAt: seed.eventAt,
    status: seed.status,
    isCustomizable: seed.isCustomizable,
    customizationLabel: seed.customizationLabel,
    isDemo: true,
  };
}

/**
 * Idempotent demo seeding. The empty-table guard is the safety belt:
 * the action calls into this from both the `/begin` create path AND
 * `switchBuilderTemplate`, neither of which should clobber a founder
 * who already wrote real products. We use a `count(*)` directly rather
 * than `getAllProducts(slug).length` so we don't pay for the full row
 * load — this runs on the hot create path.
 */
export async function seedTemplateDemoProducts(
  slug: string,
  templateId: TemplateId,
  businessType?: BusinessType,
  locale: Locale = 'en',
): Promise<void> {
  const rows = (await db()`
    select count(*)::int as n from products where storefront_slug = ${slug}
  `) as unknown as { n: number }[];
  const existing = Number(rows[0]?.n ?? 0);
  if (existing > 0) return;

  const seeded = getTemplateIndustrySeed(templateId, businessType ?? 'ecommerce').products;
  const items = seeded.length > 0 ? seeded : (DEMOS[templateId] ?? DEMOS.atrium);
  for (let i = 0; i < items.length; i++) {
    const seed = items[i];
    if (!seed) continue;
    const ready = materializeSeed(seed, templateId, i, locale);
    try {
      await insertProduct(slug, ready);
    } catch (err) {
      // Best-effort — a single failed insert should not abort the rest
      // of the seed (and definitely not the caller's create flow). The
      // founder can always re-fire by clearing demo content and
      // switching templates.
      console.warn('[seedTemplateDemoProducts] insert failed', {
        slug,
        templateId,
        title: ready.title,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
