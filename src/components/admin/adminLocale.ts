import type { Locale } from '@/i18n/locales';

export const ADMIN_TEXT = {
  en: {
    searchPlaceholder: 'Search products, orders, customers',
    searchInputPlaceholder: 'Search products, orders, customers...',
    searchTitle: 'Search Souqna',
    searchDescription: 'Search products, orders, and customers in the active storefront.',
    searching: 'Searching',
    typeTwo: 'Type at least two characters.',
    noMatches: 'No matches found.',
    products: 'Products',
    orders: 'Orders',
    customers: 'Customers',
    viewStore: 'Souqy Portal',
    docs: 'Docs',
    home: 'Home',
    inquiries: 'Inquiries',
    marketing: 'Marketing',
    discounts: 'Discounts',
    analytics: 'Analytics',
    salesChannels: 'Sales channels',
    onlineStore: 'Online store',
    pos: 'Point of sale',
    apps: 'Souqna Marketplace',
    settings: 'Settings',
    settingsOverview: 'Settings overview',
    backToDashboard: 'Back to dashboard',
    operations: 'Operations',
    souqnaHome: 'Souqna home',
    languageTitle: 'Dashboard language',
    switchToArabic: 'Switch dashboard to Arabic',
    switchToEnglish: 'Switch dashboard to English',
    soon: 'soon',
  },
  ar: {
    searchPlaceholder: 'ابحث في المنتجات والطلبات والعملاء',
    searchInputPlaceholder: 'ابحث في المنتجات والطلبات والعملاء...',
    searchTitle: 'بحث سوقنا',
    searchDescription: 'ابحث في المنتجات والطلبات والعملاء داخل المتجر النشط.',
    searching: 'جاري البحث',
    typeTwo: 'اكتب حرفين على الأقل.',
    noMatches: 'لا توجد نتائج.',
    products: 'المنتجات',
    orders: 'الطلبات',
    customers: 'العملاء',
    viewStore: 'Souqy Portal',
    docs: 'المساعدة',
    home: 'الرئيسية',
    inquiries: 'الاستفسارات',
    marketing: 'التسويق',
    discounts: 'الخصومات',
    analytics: 'التحليلات',
    salesChannels: 'قنوات البيع',
    onlineStore: 'المتجر الإلكتروني',
    pos: 'نقطة البيع',
    apps: 'التطبيقات',
    settings: 'الإعدادات',
    settingsOverview: 'نظرة عامة على الإعدادات',
    backToDashboard: 'العودة للوحة التحكم',
    operations: 'العمليات',
    souqnaHome: 'الرئيسية في سوقنا',
    languageTitle: 'لغة لوحة التحكم',
    switchToArabic: 'تحويل لوحة التحكم إلى العربية',
    switchToEnglish: 'تحويل لوحة التحكم إلى الإنجليزية',
    soon: 'قريباً',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function adminText(locale: string | undefined) {
  return ADMIN_TEXT[locale === 'ar' ? 'ar' : 'en'];
}

export function adminNavLabel(label: string, locale: string | undefined): string {
  if (locale === 'ar' && label === 'Souqna Marketplace') return 'سوق سوقنا';
  if (locale !== 'ar') return label;
  return ADMIN_NAV_LABELS_AR[label] ?? label;
}

export function adminLocale(locale: string | undefined): Locale {
  return locale === 'ar' ? 'ar' : 'en';
}

export function isAdminAr(locale: string | undefined): boolean {
  return adminLocale(locale) === 'ar';
}

export function adminPhrase(locale: string | undefined, text: string): string {
  if (!text || locale !== 'ar') return text;
  if (text === 'Souqna Marketplace') return 'سوق سوقنا';
  if (text === 'Set up a storefront to install marketplace tools.') {
    return 'أنشئ متجراً لتثبيت أدوات سوق سوقنا.';
  }
  if (text === 'Marketplace tools are scoped per-storefront. Set up a store to unlock Souqna Marketplace.') {
    return 'أدوات السوق مرتبطة بكل متجر. أنشئ متجراً لفتح سوق سوقنا.';
  }
  if (text === 'Plug Souqna into the tools you already use. Install per-storefront - what you turn on here only affects this store.') {
    return 'اربط سوقنا بالأدوات التي تستخدمها بالفعل. التثبيت لكل متجر، وما تفعله هنا يؤثر على هذا المتجر فقط.';
  }
  if (text === 'Available in Souqna Marketplace') return 'متاح في سوق سوقنا';
  return ADMIN_PHRASES_AR[text] ?? ADMIN_STATIC_AR[text] ?? text;
}

export function adminCount(
  locale: string | undefined,
  count: number,
  singular: string,
  plural: string,
): string {
  if (locale === 'ar') return `${count.toLocaleString('ar-QA')} ${plural}`;
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}

export const ADMIN_NAV_LABELS_AR: Record<string, string> = {
  Account: 'الحساب',
  Analytics: 'التحليلات',
  Apps: 'التطبيقات',
  Appearance: 'المظهر',
  Brand: 'العلامة',
  'Brand & logo': 'العلامة والشعار',
  Checkout: 'الدفع',
  Commerce: 'التجارة',
  Contact: 'التواصل',
  'Contact details': 'بيانات التواصل',
  Customers: 'العملاء',
  'Customer accounts': 'حسابات العملاء',
  'Custom data': 'البيانات المخصصة',
  Discounts: 'الخصومات',
  Domain: 'النطاق',
  Files: 'الملفات',
  General: 'عام',
  Home: 'الرئيسية',
  Inquiries: 'الاستفسارات',
  Languages: 'اللغات',
  Locations: 'المواقع',
  Marketing: 'التسويق',
  Markets: 'الأسواق',
  Messages: 'الرسائل',
  Notifications: 'الإشعارات',
  'Email notifications': 'تنبيهات البريد الإلكتروني',
  Operations: 'العمليات',
  Orders: 'الطلبات',
  Overview: 'نظرة عامة',
  Payments: 'المدفوعات',
  Plan: 'الخطة',
  Policies: 'السياسات',
  'Store policies': 'سياسات المتجر',
  Products: 'المنتجات',
  Settings: 'الإعدادات',
  Storage: 'التخزين',
  Shipping: 'الشحن',
  'Shipping & delivery': 'الشحن والتوصيل',
  Taxes: 'الضرائب',
  'Taxes & duties': 'الضرائب والرسوم',
  Team: 'الفريق',
  'Your account': 'حسابك',
  'Activity log': 'سجل النشاط',
  Websites: 'المواقع',
  'Online store': 'المتجر الإلكتروني',
  'Point of sale': 'نقطة البيع',
  Platform: 'المنصة',
  Souqna: 'سوقنا',
  Website: 'الموقع',
};

export const ADMIN_STATIC_AR: Record<string, string> = {
  ...ADMIN_NAV_LABELS_AR,
  'Add product': 'إضافة منتج',
  'Add a product': 'إضافة منتج',
  'Add customer': 'إضافة عميل',
  'Add order': 'إضافة طلب',
  'All stores': 'كل المتاجر',
  Active: 'نشط',
  Back: 'السابق',
  Cancel: 'إلغاء',
  Categories: 'التصنيفات',
  Category: 'التصنيف',
  Confirm: 'تأكيد',
  Copy: 'نسخ',
  Create: 'إنشاء',
  Delete: 'حذف',
  Draft: 'مسودة',
  'Sold out': 'نفد',
  Edit: 'تعديل',
  Email: 'البريد الإلكتروني',
  Export: 'تصدير',
  Import: 'استيراد',
  Live: 'مباشر',
  Name: 'الاسم',
  New: 'جديد',
  Next: 'التالي',
  Open: 'فتح',
  'Open products': 'فتح المنتجات',
  Paused: 'متوقف',
  Pending: 'قيد الانتظار',
  Phone: 'الهاتف',
  Price: 'السعر',
  Published: 'منشور',
  Save: 'حفظ',
  Search: 'بحث',
  soon: 'قريباً',
  SOON: 'قريباً',
  Status: 'الحالة',
  Store: 'المتجر',
  Total: 'الإجمالي',
  Unpaid: 'غير مدفوع',
  Visitors: 'الزوّار',
  Revenue: 'الإيرادات',
  'View all': 'عرض الكل',
  'View store': 'Souqy Portal',
  'Quick actions': 'إجراءات سريعة',
  'Edit storefront': 'تعديل المتجر',
  'Browse apps': 'تصفح التطبيقات',
  'Orders trend': 'منحنى الطلبات',
  'Top products': 'أكثر المنتجات مبيعاً',
  'Manage catalogue': 'إدارة الكتالوج',
};

export const ADMIN_PHRASES_AR: Record<string, string> = {
  ...ADMIN_STATIC_AR,
  'Workspace': 'مساحة العمل',
  'Create your first storefront': 'أنشئ متجرك الأول',
  'Your account is ready. Start with the onboarding flow and this dashboard will fill with live orders, products, customers, and activity.':
    'حسابك جاهز. ابدأ بخطوات الإعداد وستمتلئ لوحة التحكم بالطلبات والمنتجات والعملاء والنشاط.',
  'No store yet': 'لا يوجد متجر بعد',
  'Start with a real storefront': 'ابدأ بمتجر حقيقي',
  'Souqna needs one storefront before the admin workspace can show live commerce data.':
    'تحتاج سوقنا إلى متجر واحد قبل أن تعرض مساحة الإدارة بيانات التجارة الحية.',
  'Start a store': 'ابدأ متجراً',
  'A quieter control room for orders, products, customers, and the storefront you are building.':
    'غرفة تحكم أهدأ للطلبات والمنتجات والعملاء والمتجر الذي تبنيه.',
  'Open builder': 'افتح المصمم',
  'draft': 'مسودة',
  'live': 'مباشر',
  'setup': 'الإعداد',
  'Overview': 'نظرة عامة',
  'Activity': 'النشاط',
  'Revenue': 'الإيرادات',
  'Last 30 days': 'آخر ٣٠ يوماً',
  'Published and draft items': 'منتجات منشورة ومسودات',
  'Saved customer records': 'سجلات العملاء المحفوظة',
  'Daily order count over the last 30 days': 'عدد الطلبات اليومي خلال آخر ٣٠ يوماً',
  'No paid orders yet. Once buyers check out, your best sellers surface here.':
    'لا توجد طلبات مدفوعة بعد. بعد إتمام الشراء ستظهر المنتجات الأكثر بيعاً هنا.',
  'orders': 'طلبات',
  '30 days ago': 'قبل ٣٠ يوماً',
  'Today': 'اليوم',
  'Recent orders': 'أحدث الطلبات',
  'Recent activity': 'النشاط الأخير',
  'Log': 'السجل',
  'Customer': 'العميل',
  'Action': 'الإجراء',
  'Summary': 'الملخص',
  'When': 'الوقت',
  'Recorded activity': 'نشاط مسجل',
  'No activity yet': 'لا يوجد نشاط بعد',
  'Saved changes, app installs, and order actions will build this log.':
    'ستظهر التغييرات المحفوظة وتثبيت التطبيقات وإجراءات الطلبات في هذا السجل.',
  'No orders yet': 'لا توجد طلبات بعد',
  'Orders placed from checkout will appear here automatically.':
    'ستظهر الطلبات القادمة من الدفع هنا تلقائياً.',
  'Setup': 'الإعداد',
  'ready': 'جاهز',
  'progress': 'قيد التقدم',
  'done': 'مكتمل',
  'open': 'مفتوح',
  'Configure checkout': 'إعداد الدفع',
  'Publish storefront': 'نشر المتجر',
  'Install apps': 'تثبيت التطبيقات',
  'Cart adds': 'إضافات السلة',
  'AOV': 'متوسط الطلب',
  'total orders': 'إجمالي الطلبات',
  'Orders trend': 'اتجاه الطلبات',
  'orders · last 30 days': 'طلبات · آخر ٣٠ يوماً',
  'Quick actions': 'إجراءات سريعة',
  'Edit storefront': 'تعديل المتجر',
  'Browse apps': 'تصفح التطبيقات',

  'Set up a storefront to start receiving orders.': 'أنشئ متجراً لبدء استقبال الطلبات.',
  'Get started': 'ابدأ',
  'Create your store first': 'أنشئ متجرك أولاً',
  "Souqna's order log is per-storefront. Once you create a store, your buyer-side checkout flows directly into here.":
    'سجل الطلبات في سوقنا مرتبط بكل متجر. بعد إنشاء المتجر ستصل طلبات المشترين مباشرة إلى هنا.',
  'Create your store': 'أنشئ متجرك',
  'Manual sale': 'بيع يدوي',
  'Recent · live': 'الأحدث · مباشر',
  'Waiting for first order': 'بانتظار أول طلب',
  'Mark Paid · Print Invoice · Refund will appear here per-order the moment a buyer checks out on your storefront.':
    'ستظهر إجراءات الدفع والطباعة والاسترداد لكل طلب فور إتمام الشراء من المتجر.',
  'Mark paid': 'تعليم كمدفوع',
  'Print': 'طباعة',
  'Refund': 'استرداد',
  'Could not mark paid': 'تعذر تعليم الطلب كمدفوع',
  'Could not refund': 'تعذر تنفيذ الاسترداد',
  'Mark this order as paid': 'تعليم هذا الطلب كمدفوع',
  'Already settled or refunded': 'تمت تسويته أو استرداده',
  'Open printable invoice': 'فتح الفاتورة للطباعة',
  'Refund this order': 'استرداد هذا الطلب',
  'Only paid orders can be refunded': 'يمكن استرداد الطلبات المدفوعة فقط',
  'item': 'منتج',
  'items': 'منتجات',
  'Date': 'التاريخ',
  'Items': 'العناصر',
  'Method': 'الطريقة',
  'Payment': 'الدفع',
  'Order': 'الطلب',
  'View': 'عرض',
  'On this page': 'في هذه الصفحة',
  'of': 'من',
  'total': 'الإجمالي',
  'needs action': 'يحتاج إجراء',
  'awaiting payment': 'بانتظار الدفع',
  'Status': 'الحالة',
  'All': 'الكل',
  'Confirmed': 'مؤكد',
  'Preparing': 'قيد التجهيز',
  'Shipped': 'تم الشحن',
  'Delivered': 'تم التسليم',
  'Cancelled': 'ملغي',
  'Paid': 'مدفوع',
  'Failed': 'فشل',
  'Refunded': 'مسترد',
  'No matches': 'لا توجد نتائج',
  'No orders to show': 'لا توجد طلبات للعرض',
  'Once a buyer places an order through your storefront checkout it will appear here. Try clearing the filters above if you have narrowed the view.':
    'عندما يضع المشتري طلباً عبر دفع المتجر سيظهر هنا. جرّب مسح الفلاتر أعلاه إذا كانت النتائج محدودة.',
  'Page': 'صفحة',
  'Pagination': 'ترقيم الصفحات',
  'Previous': 'السابق',
  'pending': 'قيد الانتظار',
  'confirmed': 'مؤكد',
  'preparing': 'قيد التجهيز',
  'shipped': 'تم الشحن',
  'delivered': 'تم التسليم',
  'cancelled': 'ملغي',
  'paid': 'مدفوع',
  'failed': 'فشل',
  'refunded': 'مسترد',
  'cod': 'الدفع عند الاستلام',
  'bank': 'تحويل بنكي',
  'skipcash': 'SkipCash',
  'sadad': 'SADAD',
  'pay link': 'رابط دفع',

  'Set up a storefront to start collecting customers.': 'أنشئ متجراً لبدء جمع العملاء.',
  'Customers, inquiries, and orders are all per-storefront. Once you have a store, every inquiry from your live page becomes a customer record automatically.':
    'العملاء والاستفسارات والطلبات مرتبطة بكل متجر. بعد إنشاء المتجر، يتحول كل استفسار من الصفحة الحية إلى سجل عميل تلقائياً.',
  'No customers yet': 'لا يوجد عملاء بعد',
  'Your customer list is empty': 'قائمة العملاء فارغة',
  'Customers are created automatically when someone sends an inquiry from your storefront, when you log an order, or when you add one manually. Marketing broadcasts and per-customer order histories all read from this list.':
    'يتم إنشاء العملاء تلقائياً عندما يرسل شخص استفساراً من المتجر، أو عند تسجيل طلب، أو عند إضافته يدوياً. تعتمد الرسائل التسويقية وسجل كل عميل على هذه القائمة.',
  'Add a customer': 'إضافة عميل',
  'Contact': 'التواصل',
  'Orders': 'الطلبات',
  'Inquiries': 'الاستفسارات',
  'Total spent': 'إجمالي الإنفاق',
  'Tags': 'الوسوم',

  'Set up a storefront to start receiving inquiries.': 'أنشئ متجراً لبدء استقبال الاستفسارات.',
  "The Inquire button on your live storefront writes into this log. You'll see who asked, what they asked about, and how to reach them.":
    'زر الاستفسار في المتجر الحي يرسل إلى هذا السجل. سترى من سأل، وعن ماذا سأل، وكيف تتواصل معه.',
  'No inquiries yet': 'لا توجد استفسارات بعد',
  "Your storefront hasn't been asked anything yet": 'لم يصل أي استفسار إلى متجرك بعد',
  'When a visitor taps the Inquire button on a product or contact block, it lands here with their preferred channel pre-selected. The visitor also becomes a customer record automatically.':
    'عندما يضغط الزائر زر الاستفسار في منتج أو قسم تواصل، يصل الاستفسار هنا مع قناة التواصل المفضلة. ويتم إنشاء سجل عميل تلقائياً.',
  'Open your storefront': 'افتح متجرك',
  'Anonymous': 'زائر غير معروف',
  'about': 'عن',
  'new': 'جديد',
  'responded': 'تم الرد',
  'spam': 'رسالة مزعجة',

  'Set up a storefront to start running campaigns.': 'أنشئ متجراً لبدء الحملات.',
  'Marketing campaigns send to customers tied to a specific storefront. Set yours up to unlock email broadcasts and audience filters.':
    'تُرسل الحملات التسويقية إلى العملاء المرتبطين بمتجر محدد. أنشئ متجرك لتفعيل الرسائل البريدية وفلاتر الجمهور.',
  'Campaigns': 'الحملات',
  'Compose broadcast': 'إنشاء رسالة جماعية',
  'Email': 'البريد الإلكتروني',
  'via Resend': 'عبر Resend',
  'One-off broadcasts': 'رسائل لمرة واحدة',
  'Pick an audience, write the message, send it. Souqna handles the unsubscribe link and the deliverability.':
    'اختر الجمهور، اكتب الرسالة، ثم أرسلها. تتولى سوقنا رابط إلغاء الاشتراك وجودة الوصول.',
  'Coming soon': 'قريباً',
  'WhatsApp blasts': 'رسائل واتساب جماعية',
  'Wire your WhatsApp Business number from the Apps page to send template messages to opted-in customers.':
    'اربط رقم WhatsApp Business من صفحة التطبيقات لإرسال قوالب إلى العملاء الموافقين.',
  'Automations': 'الأتمتة',
  'Trigger emails on inquiry, abandoned cart, post-purchase, and birthday — once Klaviyo or Mailchimp is connected.':
    'شغّل رسائل تلقائية للاستفسارات والسلات المتروكة وما بعد الشراء وأعياد الميلاد بعد ربط Klaviyo أو Mailchimp.',
  'No campaigns yet': 'لا توجد حملات بعد',
  'Start your first broadcast': 'ابدأ أول رسالة جماعية',
  'Compose a thank-you to your last 50 customers, announce a new collection, or share a holiday hours update. Every send is logged so you can revisit performance later.':
    'اكتب رسالة شكر لآخر ٥٠ عميلاً، أعلن عن مجموعة جديدة، أو شارك أوقات العمل في الإجازات. يتم تسجيل كل إرسال لمراجعة الأداء لاحقاً.',

  'Set up a storefront to create discount codes.': 'أنشئ متجراً لإنشاء أكواد الخصم.',
  "Discount codes apply to your storefront's order flow. Once your store is live, you can create percentage, fixed-amount, or free-shipping codes here.":
    'تُطبق أكواد الخصم على مسار الطلب في متجرك. بعد نشر المتجر يمكنك إنشاء خصومات بالنسبة أو بمبلغ ثابت أو شحن مجاني من هنا.',
  'Create discount': 'إنشاء خصم',
  'No codes yet': 'لا توجد أكواد بعد',
  'Reward your best customers': 'كافئ أفضل عملائك',
  'Promo codes show up as a discount field on your order entry screen. Soft-launch a code with your VIP customers, run a flash sale, or thank loyal repeat buyers.':
    'تظهر أكواد الخصم كحقل خصم في شاشة الطلب. جرّب كوداً مع عملاء VIP أو أطلق عرضاً سريعاً أو اشكر العملاء الدائمين.',
  'Code': 'الكود',
  'Type': 'النوع',
  'Value': 'القيمة',
  'Used': 'الاستخدام',
  'Free shipping': 'شحن مجاني',

  'Set up a storefront to start tracking traffic.': 'أنشئ متجراً لبدء تتبع الزيارات.',
  'Souqna writes a privacy-respecting page-view event for every visit to your live storefront. The numbers show up here as soon as your store is published.':
    'تسجل سوقنا زيارة صفحة تحترم الخصوصية لكل زيارة إلى متجرك الحي. تظهر الأرقام هنا بمجرد نشر المتجر.',
  'Analytics': 'التحليلات',
  'How': 'أداء',
  'is performing.': 'خلال هذه الفترة.',
  'Page views · 30d': 'مشاهدات الصفحات · ٣٠ يوم',
  'Unique visitors · 30d': 'زوار فريدون · ٣٠ يوم',
  'Product views · 30d': 'مشاهدات المنتجات · ٣٠ يوم',
  'Inquiries · 30d': 'الاستفسارات · ٣٠ يوم',
  'Page views': 'مشاهدات الصفحات',
  'Product views': 'مشاهدات المنتجات',
  'Inquiry submissions': 'إرسال الاستفسارات',
  'Top products': 'أكثر المنتجات مشاهدة',
  'No product views yet.': 'لا توجد مشاهدات منتجات بعد.',
  'Top referrers': 'أعلى مصادر الزيارات',
  'No traffic sources yet.': 'لا توجد مصادر زيارات بعد.',
  'sparkline': 'رسم بياني مصغر',

  'Set up a storefront to install plugins.': 'أنشئ متجراً لتثبيت التطبيقات.',
  'Apps are scoped per-storefront — you can install Currency Converter on one store and not on another. Set up a store to unlock the marketplace.':
    'التطبيقات مرتبطة بكل متجر. يمكنك تثبيت تطبيق على متجر دون الآخر. أنشئ متجراً لفتح السوق.',
  'Marketplace': 'سوق التطبيقات',
  'Plug Souqna into the tools you already use. Install per-storefront — what you turn on here only affects this store.':
    'اربط سوقنا بالأدوات التي تستخدمها بالفعل. التثبيت لكل متجر، وما تفعله هنا يؤثر على هذا المتجر فقط.',
  'Available apps': 'التطبيقات المتاحة',
  'installed': 'مثبت',
  'Configure': 'إعداد',
  'Setup required': 'يتطلب إعداداً',
  'View details': 'عرض التفاصيل',
  'Sync your customer list and run campaigns': 'زامن قائمة العملاء وشغّل الحملات',
  'High-deliverability flows for serious brands': 'تدفقات عالية الوصول للعلامات الجادة',
  'Convert inquiries into chats with one tap': 'حوّل الاستفسارات إلى محادثات بضغطة',
  'Tag products in your IG posts and reels': 'وسّم المنتجات في منشورات وريلز إنستغرام',
  'Cards + wallets for the GCC': 'بطاقات ومحافظ لدول الخليج',
  'Discover Qatar suppliers, source with confidence': 'اكتشف موردي قطر واشتر بثقة',

  'Catalogue': 'الكتالوج',
  'Products': 'المنتجات',
  'Import products': 'استيراد المنتجات',
  'Export CSV': 'تصدير CSV',
  'Add category': 'إضافة تصنيف',
  'Categories': 'التصنيفات',
  'No storefronts yet — products live inside storefronts. Open one first and your catalogue will start filling in here.':
    'لا توجد متاجر بعد. المنتجات تعيش داخل المتاجر. افتح متجراً أولاً وسيبدأ الكتالوج بالظهور هنا.',
  'Drag to reorder. Drafts stay hidden from the live storefront.':
    'اسحب لإعادة الترتيب. تبقى المسودات مخفية عن المتجر الحي.',
  'Open products': 'فتح المنتجات',
  "No products yet. Open a storefront and add your first one — it'll show up here alongside everything else.":
    'لا توجد منتجات بعد. افتح متجراً وأضف أول منتج وسيظهر هنا مع بقية المنتجات.',
  'Add the first product': 'أضف أول منتج',
  'Manage': 'إدارة',
  'No price': 'لا يوجد سعر',
  'Source': 'المصدر',
  'Edit': 'تعديل',
  'All stores': 'كل المتاجر',
  'Uncategorized': 'غير مصنف',

  'Store · General': 'المتجر · عام',
  'General': 'عام',
  'The store name customers see, your founder name on receipts, and a one-line tagline rendered in the storefront header.':
    'اسم المتجر الذي يراه العملاء، واسم المؤسس في الإيصالات، ووصف قصير يظهر في رأس المتجر.',
  'Store name': 'اسم المتجر',
  'Shown on every page of your storefront and in order emails.':
    'يظهر في كل صفحة من المتجر وفي رسائل الطلبات.',
  'Founder name': 'اسم المؤسس',
  "Used in customer-facing copy ('a note from {name}…') and audit history.":
    'يستخدم في النصوص الموجهة للعميل وسجل التدقيق.',
  'Tagline': 'الوصف القصير',
  'Optional. One sentence to introduce the store. Empty hides the line.':
    'اختياري. جملة واحدة لتعريف المتجر. اتركه فارغاً لإخفائه.',
  'Editorial perfumes, layered like memory.': 'عطور تحريرية، بطبقات تشبه الذكرى.',
  'Save changes': 'حفظ التغييرات',
  'Saving…': 'جارٍ الحفظ…',
  'Saved': 'تم الحفظ',

  'Commerce · Payments': 'التجارة · المدفوعات',
  'Payments': 'المدفوعات',
  'Manage cash on delivery, bank transfer, and GCC online gateways. Provider credentials only appear after selecting a logo, and live providers verify before activation.':
    'أدر الدفع عند الاستلام والتحويل البنكي وبوابات الدفع الخليجية. تظهر بيانات المزود بعد اختيار الشعار فقط، ويتم التحقق من المزود قبل التفعيل.',
  'Payment methods': 'طرق الدفع',
  'Pick at least one offline method, or enable an online provider below.':
    'اختر طريقة دفع واحدة على الأقل، أو فعّل مزود دفع إلكتروني أدناه.',
  'Pick at least one payment method.': 'اختر طريقة دفع واحدة على الأقل.',
  'Online payment providers': 'مزودو الدفع الإلكتروني',
  'Click a provider logo to reveal its credential setup. Only live integrations can be enabled at checkout.':
    'اضغط شعار المزود لعرض إعداد بيانات الاعتماد. لا يمكن تفعيل الدفع إلا للمزودات الحية.',
  'enabled': 'مفعل',
  'available': 'متاح',
  'credentials guide': 'دليل البيانات',
  'Requires valid saved credentials.': 'يتطلب بيانات اعتماد محفوظة وصحيحة.',
  'Bank details': 'بيانات البنك',
  'Shown to buyers who pick bank transfer. Stored on your storefront row only — never logged.':
    'تظهر للمشترين الذين يختارون التحويل البنكي. تحفظ في سجل المتجر فقط ولا تُسجل في السجلات.',
  'Account name': 'اسم الحساب',
  'Bank name': 'اسم البنك',
  'Optional. Required only for cross-border transfers.': 'اختياري. مطلوب فقط للتحويلات الدولية.',
  'Notes for the buyer': 'ملاحظات للمشتري',
  'SkipCash merchant setup': 'إعداد تاجر SkipCash',
  'Store your merchant credentials once. Souqna encrypts them and uses them only to create buyer checkout sessions.':
    'احفظ بيانات التاجر مرة واحدة. تقوم سوقنا بتشفيرها واستخدامها فقط لإنشاء جلسات دفع للمشتري.',
  'Confirm CR ownership': 'تأكيد ملكية السجل التجاري',
  'Client ID': 'Client ID',
  'Key ID': 'Key ID',
  'Key secret': 'Key secret',
  'Webhook key': 'Webhook key',
  'Leave blank to keep current.': 'اتركه فارغاً للإبقاء على الحالي.',
  'Optional, if SkipCash provides one for webhook signing.':
    'اختياري إذا وفرت SkipCash مفتاحاً لتوقيع Webhook.',
  'SADAD merchant setup / إعداد تاجر سداد': 'إعداد تاجر SADAD',
  'SADAD is enabled only after Souqna verifies the credentials with SADAD. يتم تفعيل سداد فقط بعد التحقق من البيانات مع سداد.':
    'يتم تفعيل SADAD فقط بعد تحقق سوقنا من بيانات الاعتماد مع SADAD.',
  'Enable SADAD at checkout': 'تفعيل SADAD في الدفع',
  'Turn this on after adding valid credentials. أضف بيانات صحيحة ثم فعّل سداد في صفحة الدفع.':
    'فعّل هذا الخيار بعد إضافة بيانات اعتماد صحيحة.',
  'What to enter': 'ما البيانات المطلوبة؟',
  'Merchant ID / SADAD ID': 'رقم التاجر / SADAD ID',
  'Website / Domain': 'الموقع / النطاق',
  'The domain registered with SADAD. النطاق المسجل في سداد.':
    'النطاق المسجل لدى SADAD.',
  'Secret key': 'المفتاح السري',
  'Required policies at checkout': 'السياسات المطلوبة عند الدفع',
  'Buyers must tick a box accepting each of these before placing an order.':
    'يجب على المشترين الموافقة على كل سياسة قبل إرسال الطلب.',
  'Order rules': 'قواعد الطلب',
  'Currency the storefront prices in, plus optional thresholds applied at checkout.':
    'عملة أسعار المتجر، مع حدود اختيارية تطبق عند الدفع.',
  'Currency': 'العملة',
  'Display currency. Stored as a 3-letter ISO 4217 code.':
    'عملة العرض. تحفظ كرمز ISO 4217 من ثلاثة أحرف.',
  'Minimum order (QAR)': 'الحد الأدنى للطلب (QAR)',
  'Optional. Block orders below this amount.': 'اختياري. امنع الطلبات الأقل من هذا المبلغ.',
  'Flat shipping (QAR)': 'شحن ثابت (QAR)',
  'Optional. Add to every order at checkout.': 'اختياري. يضاف إلى كل طلب عند الدفع.',
  'Not saved yet. Provider integration pending.': 'لم تحفظ بعد. تكامل المزود قيد الانتظار.',
  'These are the official merchant credentials this provider uses. Checkout activation stays off until Souqna’s charge/refund/webhook flow for this provider is implemented.':
    'هذه هي بيانات التاجر الرسمية التي يستخدمها هذا المزود. يبقى التفعيل متوقفاً حتى تنتهي سوقنا من مسار الدفع والاسترداد والتنبيهات لهذا المزود.',
  'Settings': 'الإعدادات',
  'Choose a section from the sidebar, or open one below.': 'اختر قسماً من الشريط الجانبي أو افتح واحداً أدناه.',
  'Identity, branding, contact details, domain, and plan.':
    'الهوية والعلامة وبيانات التواصل والنطاق والخطة.',
  'Locations, checkout, payment methods, shipping, taxes, and duties.':
    'المواقع والدفع وطرق السداد والشحن والضرائب والرسوم.',
  'Customer accounts, email notifications, and store policies.':
    'حسابات العملاء وتنبيهات البريد وسياسات المتجر.',
  'Your account, team access, audit log, files, data, and markets.':
    'حسابك وصلاحيات الفريق وسجل النشاط والملفات والبيانات والأسواق.',
  'Email notifications': 'تنبيهات البريد الإلكتروني',
  'Store · Contact': 'المتجر · التواصل',
  'Contact details': 'بيانات التواصل',
  'What customers see on your storefront and on order receipts.': 'ما يراه العملاء في متجرك وعلى إيصالات الطلب.',
  'Store · Brand': 'المتجر · العلامة',
  'Brand & logo': 'العلامة والشعار',
  'Choose your logo, favicon, and tagline. The preview on the right updates after each save.':
    'اختر الشعار وأيقونة الموقع والوصف القصير. يتم تحديث المعاينة بعد كل حفظ.',
  'Store · Domain': 'المتجر · النطاق',
  'Domain': 'النطاق',
  "Your storefront's web address.": 'عنوان متجرك على الويب.',
  'Commerce · Checkout': 'التجارة · الدفع',
  'Checkout': 'الدفع',
  'Pick which payment methods buyers can use, what policies they must accept, and the basic order rules. The storefront cart respects these settings on every order.':
    'اختر طرق الدفع المتاحة للمشترين والسياسات المطلوبة وقواعد الطلب الأساسية. تلتزم سلة المتجر بهذه الإعدادات في كل طلب.',
  'Store · Languages': 'المتجر · اللغات',
  'Languages': 'اللغات',
  'Souqna storefronts are bilingual by design — every block ships in Arabic and English. Pick which one is primary.':
    'متاجر سوقنا ثنائية اللغة افتراضياً. كل قسم يدعم العربية والإنجليزية. اختر اللغة الأساسية.',
  'Customers · Policies': 'العملاء · السياسات',
  'Store policies': 'سياسات المتجر',
  'The four standard policies that appear in your storefront footer.':
    'السياسات الأربع القياسية التي تظهر في تذييل المتجر.',
  'Commerce · Shipping': 'التجارة · الشحن',
  'Shipping & delivery': 'الشحن والتوصيل',
  'Manage real flat-rate shipping profiles and checkout delivery totals for this storefront.':
    'أدر ملفات الشحن الثابت ومجاميع التوصيل عند الدفع لهذا المتجر.',
  'Commerce · Taxes': 'التجارة · الضرائب',
  'Taxes & duties': 'الضرائب والرسوم',
  'Set a durable tax profile for checkout and manual orders. Qatar stores can keep this disabled; cross-border stores can turn it on.':
    'أنشئ ملف ضرائب ثابت للدفع والطلبات اليدوية. يمكن لمتاجر قطر إبقاؤه معطلاً، ويمكن للمتاجر الدولية تفعيله.',
  'Settings · Appearance': 'الإعدادات · المظهر',
  'Dashboard appearance': 'مظهر لوحة التحكم',
  'Pick the accent color used across the admin sidebar, eyebrows, and badges. The marketing storefront keeps its own brand palette.':
    'اختر لون التمييز المستخدم في الشريط الجانبي والعناوين الصغيرة والشارات. يحتفظ المتجر بألوان علامته الخاصة.',
  'Store · Plan': 'المتجر · الخطة',
  'Plan': 'الخطة',
  'Pick the tier that matches the way you build.': 'اختر الخطة التي تناسب طريقة عملك.',
  'Platform · Account': 'المنصة · الحساب',
  'Your account': 'حسابك',
  'Sign-in details, security, and connected accounts.': 'بيانات تسجيل الدخول والأمان والحسابات المتصلة.',
  'Platform · Team': 'المنصة · الفريق',
  'Team': 'الفريق',
  'Invite teammates, set their role, and choose what they can access.':
    'ادع أعضاء الفريق، وحدد أدوارهم، واختر ما يمكنهم الوصول إليه.',
  'Settings · Platform': 'الإعدادات · المنصة',
  'Files': 'الملفات',
  'Your asset library — logos, product photography, share images.':
    'مكتبة الأصول الخاصة بك: الشعارات وصور المنتجات وصور المشاركة.',
};
