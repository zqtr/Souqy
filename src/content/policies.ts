import type { Locale } from '@/i18n/locales';

export type PolicySlug = 'terms' | 'privacy' | 'refund' | 'shipping';

export type PolicySection = {
  title: string;
  body: readonly string[];
  bullets?: readonly string[];
};

export type PolicyContent = {
  slug: PolicySlug;
  path: `/${PolicySlug}`;
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  intro: readonly string[];
  sections: readonly PolicySection[];
  contact: {
    label: string;
    email: string;
  };
};

export const policies = {
  en: {
    terms: {
      slug: 'terms',
      path: '/terms',
      eyebrow: 'Legal',
      title: 'Terms of Service',
      description: 'The terms that govern access to and use of the Souqna platform.',
      lastUpdated: 'Last updated: May 3, 2026',
      intro: [
        'These Terms of Service govern your access to and use of Souqna, including the website, dashboard, storefront builder, hosted storefronts, apps, and related support services.',
        'By creating an account, publishing a storefront, or using Souqna, you agree to these terms. If you use Souqna on behalf of a business, you confirm that you are authorised to accept these terms for that business.',
      ],
      sections: [
        {
          title: '1. The service',
          body: [
            'Souqna provides tools for founders and merchants to build, host, manage, and improve bilingual digital storefronts. We may update, add, or remove features as the platform develops.',
            'Some features are included only in certain plans or may require third-party services such as payment, analytics, shipping, domain, or marketing providers.',
          ],
        },
        {
          title: '2. Accounts and responsibility',
          body: [
            'You are responsible for the accuracy of your account information, the security of your login, and the activity that happens under your account.',
            'You must not use Souqna to publish unlawful, misleading, infringing, harmful, or abusive content, or to sell products or services that violate applicable law or third-party platform rules.',
          ],
        },
        {
          title: '3. Storefront content and products',
          body: [
            'You remain responsible for your storefront content, product information, pricing, policies, fulfilment, customer communications, taxes, and compliance obligations.',
            'Souqna may remove content, suspend a storefront, or restrict access if we reasonably believe the use of the platform creates legal, security, operational, or reputational risk.',
          ],
        },
        {
          title: '4. Plans, billing, and changes',
          body: [
            'Paid plans are billed in Qatari Riyal unless stated otherwise. Plan limits, features, prices, and billing intervals are shown at checkout or inside the account area.',
            'You can upgrade or request a downgrade according to the controls available in your account. Downgrades and refunds are handled under our Refund Policy.',
          ],
        },
        {
          title: '5. Third-party services',
          body: [
            'Souqna may connect with third-party services. Those services are governed by their own terms and policies, and you are responsible for reviewing and complying with them.',
            'We are not responsible for outages, decisions, charges, disputes, or data handling by third-party providers outside our control.',
          ],
        },
        {
          title: '6. Intellectual property',
          body: [
            'Souqna, its software, design system, brand, templates, and platform materials belong to Souqna or its licensors. You may not copy, resell, reverse engineer, or misuse them except as allowed by these terms.',
            'Your business content remains yours. You grant Souqna the limited rights needed to host, process, display, transmit, and support that content as part of the service.',
          ],
        },
        {
          title: '7. Availability and support',
          body: [
            'We work to keep Souqna reliable, but we do not guarantee uninterrupted or error-free access. Maintenance, incidents, third-party issues, or misuse may affect availability.',
            'Support channels and response times depend on your plan and the nature of the request.',
          ],
        },
        {
          title: '8. Limitation of liability',
          body: [
            'To the maximum extent permitted by law, Souqna is not liable for indirect, incidental, special, consequential, or lost-profit damages, or for losses caused by third-party services, merchant activity, or customer disputes.',
            'Nothing in these terms limits liability that cannot be limited under applicable law.',
          ],
        },
        {
          title: '9. Updates to these terms',
          body: [
            'We may update these terms from time to time. When changes are material, we will take reasonable steps to notify users through the site, dashboard, email, or another appropriate channel.',
          ],
        },
      ],
      contact: {
        label: 'Questions about these terms?',
        email: 'support@souqna.qa',
      },
    },
    privacy: {
      slug: 'privacy',
      path: '/privacy',
      eyebrow: 'Legal',
      title: 'Privacy Policy',
      description: 'How Souqna collects, uses, protects, and shares personal information.',
      lastUpdated: 'Last updated: May 3, 2026',
      intro: [
        'This Privacy Policy explains how Souqna handles personal information when you visit our website, create an account, use the dashboard, publish a storefront, contact support, or interact with our services.',
        'We design Souqna for bilingual businesses in Qatar and treat privacy as a core part of the product, not an afterthought.',
      ],
      sections: [
        {
          title: '1. Information we collect',
          body: ['We collect information needed to operate, secure, improve, and support Souqna. This may include:'],
          bullets: [
            'Account details such as name, email address, authentication identifiers, and business information.',
            'Storefront content such as products, pages, policies, images, settings, domains, and app configurations.',
            'Billing and plan information, including subscription status and payment provider references.',
            'Usage, device, log, analytics, and diagnostic data that helps us keep the service secure and reliable.',
            'Messages you send to Souqna through support, onboarding, forms, or email.',
          ],
        },
        {
          title: '2. How we use information',
          body: ['We use personal information to:'],
          bullets: [
            'Provide, host, personalise, and maintain the Souqna platform.',
            'Create accounts, authenticate users, manage plans, and process billing-related activity.',
            'Operate storefronts, apps, domains, analytics, notifications, and support workflows.',
            'Protect Souqna, merchants, and buyers from fraud, abuse, security incidents, and policy violations.',
            'Improve product quality, performance, onboarding, and customer support.',
            'Comply with legal, tax, accounting, security, and regulatory obligations.',
          ],
        },
        {
          title: '3. Sharing information',
          body: [
            'We share information only when needed to operate Souqna, comply with law, protect the service, or support your use of connected providers.',
            'This may include infrastructure providers, authentication providers, payment processors, email services, analytics tools, error monitoring, support systems, and apps you choose to connect.',
          ],
        },
        {
          title: '4. Merchant and buyer data',
          body: [
            'Merchants are responsible for the personal information they collect from their own buyers through a Souqna storefront, including order, shipping, payment, and customer service information.',
            'Souqna processes that information to provide the storefront and related services, but merchants must publish and honour their own customer-facing policies where required.',
          ],
        },
        {
          title: '5. Cookies and analytics',
          body: [
            'We may use cookies and similar technologies for authentication, security, preferences, analytics, product improvement, and performance measurement.',
            'Some third-party services connected to Souqna may set their own cookies or collect analytics under their own policies.',
          ],
        },
        {
          title: '6. Security and retention',
          body: [
            'We use reasonable technical and organisational measures to protect personal information. No online service can guarantee complete security.',
            'We keep information for as long as needed to provide Souqna, meet legal or accounting requirements, resolve disputes, enforce agreements, and maintain backups and security records.',
          ],
        },
        {
          title: '7. Your choices',
          body: [
            'You may request access, correction, export, or deletion of certain personal information by contacting us. Some requests may be limited by legal, security, fraud-prevention, or operational requirements.',
            'You can also manage many account, storefront, and communication settings directly inside Souqna.',
          ],
        },
        {
          title: '8. Policy updates',
          body: [
            'We may update this Privacy Policy as Souqna evolves. Material changes will be communicated through an appropriate channel, such as the site, dashboard, or email.',
          ],
        },
      ],
      contact: {
        label: 'Privacy questions or requests?',
        email: 'support@souqna.qa',
      },
    },
    refund: {
      slug: 'refund',
      path: '/refund',
      eyebrow: 'Legal',
      title: 'Refund Policy',
      description: 'How Souqna handles refunds, cancellations, and plan downgrades.',
      lastUpdated: 'Last updated: May 3, 2026',
      intro: [
        'This Refund Policy explains how Souqna handles paid plan cancellations, downgrade requests, billing corrections, and refund reviews.',
        'It applies to Souqna platform subscriptions and services. It does not apply to refunds between merchants and their buyers on merchant storefronts.',
      ],
      sections: [
        {
          title: '1. Plan downgrades',
          body: [
            'You may request to downgrade a paid plan from your account or by contacting support. Unless we confirm otherwise, a downgrade takes effect at the end of the current paid billing period.',
            'After a downgrade, features, limits, templates, apps, domains, support levels, AI usage, or storefront capacity may change according to the lower plan.',
          ],
        },
        {
          title: '2. Refunds for downgrades',
          body: [
            'Downgrading a plan does not automatically create a cash refund or prorated credit for the unused part of the billing period.',
            'Where appropriate, Souqna may apply a credit, adjust a future invoice, or issue a refund at our discretion, subject to applicable law, payment provider rules, and the facts of the request.',
          ],
        },
        {
          title: '3. Cancellations',
          body: [
            'If you cancel a paid plan, you can usually continue using the paid features until the end of the billing period already paid for, unless the account is suspended for misuse or another policy reason.',
            'Cancellation stops future renewal charges for the cancelled plan but does not automatically refund past charges.',
          ],
        },
        {
          title: '4. Billing mistakes',
          body: [
            'If you believe you were charged incorrectly, contact us as soon as possible with the account email, invoice reference, charge date, and a short explanation.',
            'If we confirm a billing error, duplicate charge, or unauthorised charge caused by Souqna, we will correct it through a refund, credit, or invoice adjustment.',
          ],
        },
        {
          title: '5. Non-refundable items',
          body: ['Unless required by law or expressly agreed in writing, the following are generally non-refundable:'],
          bullets: [
            'Completed setup, migration, design, consulting, or custom implementation work.',
            'Third-party fees, domain charges, app charges, payment processing fees, or provider costs outside Souqna control.',
            'Charges for billing periods that have already ended.',
            'Accounts suspended or terminated for abuse, unlawful activity, or material policy violations.',
          ],
        },
        {
          title: '6. Merchant-buyer refunds',
          body: [
            'Each merchant is responsible for refunds, returns, exchanges, delivery issues, and customer service for products or services sold through their storefront.',
            'Souqna may provide platform tools that help merchants manage orders, but Souqna is not the seller of merchant products unless expressly stated.',
          ],
        },
      ],
      contact: {
        label: 'Need help with a downgrade or billing question?',
        email: 'support@souqna.qa',
      },
    },
    shipping: {
      slug: 'shipping',
      path: '/shipping',
      eyebrow: 'Legal',
      title: 'Shipping Policy',
      description: 'How shipping responsibilities work on Souqna storefronts and Souqna services.',
      lastUpdated: 'Last updated: May 3, 2026',
      intro: [
        'Souqna is a platform that helps merchants build and operate digital storefronts. Most products purchased through a merchant storefront are sold, packed, shipped, delivered, returned, and supported by that merchant.',
        'This Shipping Policy explains Souqna platform responsibilities and the responsibilities of merchants using Souqna.',
      ],
      sections: [
        {
          title: '1. Merchant storefront orders',
          body: [
            'For orders placed with a merchant on a Souqna-powered storefront, the merchant is responsible for shipping methods, delivery areas, fees, timelines, couriers, packaging, failed delivery handling, returns, and customer updates.',
            'Buyers should review the merchant policy shown on the storefront or contact the merchant directly before placing an order.',
          ],
        },
        {
          title: '2. Souqna role',
          body: [
            'Souqna provides software, hosting, checkout settings, order management tools, and optional integrations that merchants can use to run their storefronts.',
            'Unless Souqna expressly states that it is the seller or fulfilment provider for a specific service, Souqna does not pack, ship, deliver, insure, return, or exchange merchant products.',
          ],
        },
        {
          title: '3. Shipping fees and timelines',
          body: [
            'Shipping fees and estimated delivery timelines are set by the merchant or by the third-party delivery service selected by the merchant.',
            'Delivery estimates are not guarantees. Weather, address issues, courier capacity, customs, payment checks, stock availability, and customer availability can affect delivery.',
          ],
        },
        {
          title: '4. Damaged, delayed, or missing orders',
          body: [
            'Buyers should contact the merchant first for damaged, delayed, incomplete, or missing orders. The merchant is responsible for investigating and resolving order fulfilment issues.',
            'If a technical issue in Souqna appears to have affected the order record or checkout flow, the merchant may contact Souqna support for platform assistance.',
          ],
        },
        {
          title: '5. Souqna services',
          body: [
            'Souqna platform subscriptions, digital services, setup work, and support services are delivered electronically and do not require physical shipping unless expressly agreed in writing.',
            'If Souqna ever provides a physical item or fulfilment service directly, the specific order, proposal, or service terms will describe the delivery arrangement.',
          ],
        },
      ],
      contact: {
        label: 'Questions about platform shipping responsibilities?',
        email: 'support@souqna.qa',
      },
    },
  },
  ar: {
    terms: {
      slug: 'terms',
      path: '/terms',
      eyebrow: 'قانوني',
      title: 'شروط الخدمة',
      description: 'الشروط التي تنظّم الوصول إلى منصة سوقنا واستخدامها.',
      lastUpdated: 'آخر تحديث: ٣ مايو ٢٠٢٦',
      intro: [
        'تنظّم شروط الخدمة هذه وصولك إلى سوقنا واستخدامك لها، بما في ذلك الموقع، لوحة التحكم، منشئ المتاجر، المتاجر المستضافة، التطبيقات، وخدمات الدعم المرتبطة بها.',
        'بإنشاء حساب أو نشر متجر أو استخدام سوقنا، فأنت توافق على هذه الشروط. وإذا كنت تستخدم سوقنا نيابة عن جهة تجارية، فأنت تؤكد أن لديك الصلاحية لقبول هذه الشروط عنها.',
      ],
      sections: [
        {
          title: '١. الخدمة',
          body: [
            'توفر سوقنا أدوات تساعد المؤسسين والتجار على بناء المتاجر الرقمية الثنائية اللغة واستضافتها وإدارتها وتحسينها. وقد نحدّث الميزات أو نضيفها أو نزيلها مع تطور المنصة.',
            'بعض الميزات متاحة ضمن باقات محددة فقط، أو قد تتطلب خدمات خارجية مثل الدفع، التحليلات، الشحن، النطاقات، أو مزودي التسويق.',
          ],
        },
        {
          title: '٢. الحسابات والمسؤولية',
          body: [
            'أنت مسؤول عن دقة معلومات حسابك، وحماية بيانات الدخول، وكل نشاط يتم من خلال حسابك.',
            'لا يجوز استخدام سوقنا لنشر محتوى غير قانوني أو مضلل أو منتهك أو ضار أو مسيء، ولا لبيع منتجات أو خدمات تخالف القانون أو قواعد المنصات الخارجية.',
          ],
        },
        {
          title: '٣. محتوى المتجر والمنتجات',
          body: [
            'تبقى مسؤولاً عن محتوى متجرك، معلومات المنتجات، الأسعار، السياسات، التنفيذ، التواصل مع العملاء، الضرائب، والالتزامات النظامية.',
            'يجوز لسوقنا إزالة محتوى أو تعليق متجر أو تقييد الوصول إذا رأينا بشكل معقول أن استخدام المنصة يسبب خطراً قانونياً أو أمنياً أو تشغيلياً أو يضر بسمعة الخدمة.',
          ],
        },
        {
          title: '٤. الباقات والفوترة والتغييرات',
          body: [
            'تُفوتر الباقات المدفوعة بالريال القطري ما لم يُذكر خلاف ذلك. وتظهر حدود الباقة وميزاتها وأسعارها ودورات الفوترة عند الدفع أو داخل منطقة الحساب.',
            'يمكنك الترقية أو طلب الرجوع إلى باقة أقل حسب الخيارات المتاحة في حسابك. وتُدار طلبات الرجوع والاسترداد وفق سياسة الاسترداد الخاصة بنا.',
          ],
        },
        {
          title: '٥. الخدمات الخارجية',
          body: [
            'قد ترتبط سوقنا بخدمات خارجية. تخضع هذه الخدمات لشروطها وسياساتها الخاصة، وأنت مسؤول عن مراجعتها والالتزام بها.',
            'لسنا مسؤولين عن الانقطاعات أو القرارات أو الرسوم أو النزاعات أو معالجة البيانات لدى مزودي خدمات خارج نطاق سيطرتنا.',
          ],
        },
        {
          title: '٦. الملكية الفكرية',
          body: [
            'تعود سوقنا وبرمجياتها ونظام التصميم والعلامة والقوالب ومواد المنصة إلى سوقنا أو مرخّصيها. ولا يجوز نسخها أو إعادة بيعها أو تفكيكها أو إساءة استخدامها إلا بالقدر الذي تسمح به هذه الشروط.',
            'يبقى محتوى مشروعك ملكاً لك. وتمنح سوقنا الحقوق المحدودة اللازمة لاستضافة هذا المحتوى ومعالجته وعرضه ونقله ودعمه ضمن الخدمة.',
          ],
        },
        {
          title: '٧. التوفر والدعم',
          body: [
            'نعمل على إبقاء سوقنا موثوقة، لكننا لا نضمن وصولاً مستمراً أو خالياً من الأخطاء. قد تؤثر الصيانة أو الحوادث أو مشاكل الأطراف الخارجية أو سوء الاستخدام على التوفر.',
            'تعتمد قنوات الدعم وأزمنة الاستجابة على باقتك وطبيعة الطلب.',
          ],
        },
        {
          title: '٨. حدود المسؤولية',
          body: [
            'إلى أقصى حد يسمح به القانون، لا تتحمل سوقنا مسؤولية الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو خسارة الأرباح، ولا الخسائر الناتجة عن خدمات خارجية أو نشاط التاجر أو نزاعات العملاء.',
            'لا يوجد في هذه الشروط ما يحد من مسؤولية لا يجوز الحد منها بموجب القانون المعمول به.',
          ],
        },
        {
          title: '٩. تحديث هذه الشروط',
          body: [
            'قد نحدّث هذه الشروط من وقت لآخر. وعند وجود تغييرات جوهرية، سنتخذ خطوات معقولة لإبلاغ المستخدمين عبر الموقع أو لوحة التحكم أو البريد الإلكتروني أو قناة مناسبة أخرى.',
          ],
        },
      ],
      contact: {
        label: 'هل لديك سؤال عن هذه الشروط؟',
        email: 'support@souqna.qa',
      },
    },
    privacy: {
      slug: 'privacy',
      path: '/privacy',
      eyebrow: 'قانوني',
      title: 'سياسة الخصوصية',
      description: 'كيف تجمع سوقنا المعلومات الشخصية وتستخدمها وتحميها وتشاركها.',
      lastUpdated: 'آخر تحديث: ٣ مايو ٢٠٢٦',
      intro: [
        'توضح سياسة الخصوصية هذه كيف تتعامل سوقنا مع المعلومات الشخصية عند زيارة موقعنا، إنشاء حساب، استخدام لوحة التحكم، نشر متجر، التواصل مع الدعم، أو التفاعل مع خدماتنا.',
        'صممنا سوقنا للمشاريع الثنائية اللغة في قطر، ونتعامل مع الخصوصية كجزء أساسي من المنتج لا كإضافة لاحقة.',
      ],
      sections: [
        {
          title: '١. المعلومات التي نجمعها',
          body: ['نجمع المعلومات اللازمة لتشغيل سوقنا وتأمينها وتحسينها ودعمها. وقد يشمل ذلك:'],
          bullets: [
            'بيانات الحساب مثل الاسم، البريد الإلكتروني، معرّفات المصادقة، ومعلومات النشاط التجاري.',
            'محتوى المتجر مثل المنتجات، الصفحات، السياسات، الصور، الإعدادات، النطاقات، وإعدادات التطبيقات.',
            'معلومات الفوترة والباقات، بما في ذلك حالة الاشتراك ومراجع مزود الدفع.',
            'بيانات الاستخدام والجهاز والسجلات والتحليلات والتشخيص التي تساعدنا على إبقاء الخدمة آمنة وموثوقة.',
            'الرسائل التي ترسلها إلى سوقنا عبر الدعم أو التهيئة أو النماذج أو البريد الإلكتروني.',
          ],
        },
        {
          title: '٢. كيف نستخدم المعلومات',
          body: ['نستخدم المعلومات الشخصية من أجل:'],
          bullets: [
            'تقديم منصة سوقنا واستضافتها وتخصيصها وصيانتها.',
            'إنشاء الحسابات، مصادقة المستخدمين، إدارة الباقات، ومعالجة أنشطة الفوترة.',
            'تشغيل المتاجر والتطبيقات والنطاقات والتحليلات والإشعارات ومسارات الدعم.',
            'حماية سوقنا والتجار والمشترين من الاحتيال والإساءة والحوادث الأمنية ومخالفات السياسات.',
            'تحسين جودة المنتج والأداء والتهيئة ودعم العملاء.',
            'الامتثال للالتزامات القانونية والضريبية والمحاسبية والأمنية والتنظيمية.',
          ],
        },
        {
          title: '٣. مشاركة المعلومات',
          body: [
            'نشارك المعلومات فقط عند الحاجة لتشغيل سوقنا أو الامتثال للقانون أو حماية الخدمة أو دعم استخدامك للمزودين المتصلين.',
            'قد يشمل ذلك مزودي البنية التحتية، المصادقة، معالجة المدفوعات، البريد الإلكتروني، التحليلات، مراقبة الأخطاء، أنظمة الدعم، والتطبيقات التي تختار ربطها.',
          ],
        },
        {
          title: '٤. بيانات التجار والمشترين',
          body: [
            'يتحمل التجار مسؤولية المعلومات الشخصية التي يجمعونها من مشترينهم عبر متجر يعمل على سوقنا، بما في ذلك معلومات الطلب والشحن والدفع وخدمة العملاء.',
            'تعالج سوقنا هذه المعلومات لتقديم المتجر والخدمات المرتبطة به، لكن على التجار نشر سياسات مواجهة للعملاء والالتزام بها متى لزم ذلك.',
          ],
        },
        {
          title: '٥. ملفات الارتباط والتحليلات',
          body: [
            'قد نستخدم ملفات الارتباط وتقنيات مشابهة للمصادقة والأمان والتفضيلات والتحليلات وتحسين المنتج وقياس الأداء.',
            'قد تضبط بعض الخدمات الخارجية المتصلة بسوقنا ملفات ارتباط خاصة بها أو تجمع تحليلات وفق سياساتها الخاصة.',
          ],
        },
        {
          title: '٦. الأمان والاحتفاظ',
          body: [
            'نستخدم تدابير تقنية وتنظيمية معقولة لحماية المعلومات الشخصية. ولا يمكن لأي خدمة عبر الإنترنت أن تضمن أماناً كاملاً.',
            'نحتفظ بالمعلومات ما دامت لازمة لتقديم سوقنا، وتلبية المتطلبات القانونية أو المحاسبية، وحل النزاعات، وإنفاذ الاتفاقيات، والحفاظ على النسخ الاحتياطية وسجلات الأمان.',
          ],
        },
        {
          title: '٧. اختياراتك',
          body: [
            'يمكنك طلب الوصول إلى بعض معلوماتك الشخصية أو تصحيحها أو تصديرها أو حذفها عبر التواصل معنا. وقد تكون بعض الطلبات مقيدة بمتطلبات قانونية أو أمنية أو تشغيلية أو منع احتيال.',
            'يمكنك أيضاً إدارة كثير من إعدادات الحساب والمتجر والتواصل مباشرة داخل سوقنا.',
          ],
        },
        {
          title: '٨. تحديث السياسة',
          body: [
            'قد نحدّث سياسة الخصوصية هذه مع تطور سوقنا. وسيتم إبلاغك بالتغييرات الجوهرية عبر قناة مناسبة مثل الموقع أو لوحة التحكم أو البريد الإلكتروني.',
          ],
        },
      ],
      contact: {
        label: 'أسئلة أو طلبات خصوصية؟',
        email: 'support@souqna.qa',
      },
    },
    refund: {
      slug: 'refund',
      path: '/refund',
      eyebrow: 'قانوني',
      title: 'سياسة الاسترداد',
      description: 'كيف تتعامل سوقنا مع الاسترداد والإلغاء والرجوع إلى باقة أقل.',
      lastUpdated: 'آخر تحديث: ٣ مايو ٢٠٢٦',
      intro: [
        'توضح سياسة الاسترداد هذه كيف تتعامل سوقنا مع إلغاء الباقات المدفوعة، وطلبات الرجوع إلى باقة أقل، وتصحيح الفوترة، ومراجعة طلبات الاسترداد.',
        'تنطبق هذه السياسة على اشتراكات وخدمات منصة سوقنا. ولا تنطبق على الاسترداد بين التجار ومشتريهم في متاجر التجار.',
      ],
      sections: [
        {
          title: '١. الرجوع إلى باقة أقل',
          body: [
            'يمكنك طلب الرجوع إلى باقة مدفوعة أقل من حسابك أو عبر التواصل مع الدعم. ما لم نؤكد خلاف ذلك، يسري الرجوع في نهاية فترة الفوترة المدفوعة الحالية.',
            'بعد الرجوع، قد تتغير الميزات والحدود والقوالب والتطبيقات والنطاقات ومستويات الدعم واستخدام الذكاء الاصطناعي أو سعة المتاجر وفق الباقة الأقل.',
          ],
        },
        {
          title: '٢. الاسترداد عند الرجوع',
          body: [
            'الرجوع إلى باقة أقل لا ينشئ تلقائياً استرداداً نقدياً أو رصيداً نسبياً للجزء غير المستخدم من فترة الفوترة.',
            'عند المناسبة، قد تطبق سوقنا رصيداً أو تعدّل فاتورة قادمة أو تصدر استرداداً وفق تقديرها، وبما يخضع للقانون المعمول به وقواعد مزود الدفع ووقائع الطلب.',
          ],
        },
        {
          title: '٣. الإلغاء',
          body: [
            'إذا ألغيت باقة مدفوعة، يمكنك غالباً الاستمرار في استخدام الميزات المدفوعة حتى نهاية فترة الفوترة التي دفعتها، ما لم يتم تعليق الحساب بسبب إساءة الاستخدام أو سبب متعلق بالسياسات.',
            'يوقف الإلغاء رسوم التجديد المستقبلية للباقة الملغاة، لكنه لا يسترد تلقائياً الرسوم السابقة.',
          ],
        },
        {
          title: '٤. أخطاء الفوترة',
          body: [
            'إذا كنت تعتقد أن هناك رسماً غير صحيح، تواصل معنا في أقرب وقت مع بريد الحساب ومرجع الفاتورة وتاريخ العملية وشرح مختصر.',
            'إذا تأكدنا من وجود خطأ فوترة أو رسم مكرر أو رسم غير مصرح به تسببت به سوقنا، فسنصححه عبر استرداد أو رصيد أو تعديل فاتورة.',
          ],
        },
        {
          title: '٥. البنود غير القابلة للاسترداد',
          body: ['ما لم يوجب القانون أو نتفق كتابة على خلاف ذلك، تكون البنود التالية غالباً غير قابلة للاسترداد:'],
          bullets: [
            'أعمال الإعداد أو النقل أو التصميم أو الاستشارة أو التنفيذ المخصص بعد إنجازها.',
            'رسوم الأطراف الخارجية، رسوم النطاقات، رسوم التطبيقات، رسوم معالجة الدفع، أو تكاليف المزودين خارج سيطرة سوقنا.',
            'رسوم فترات فوترة انتهت بالفعل.',
            'الحسابات المعلقة أو المنهية بسبب إساءة الاستخدام أو نشاط غير قانوني أو مخالفات جوهرية للسياسات.',
          ],
        },
        {
          title: '٦. استرداد مشتريات المتاجر',
          body: [
            'كل تاجر مسؤول عن الاسترداد والإرجاع والاستبدال ومشاكل التوصيل وخدمة العملاء للمنتجات أو الخدمات المباعة عبر متجره.',
            'قد توفر سوقنا أدوات تساعد التجار على إدارة الطلبات، لكن سوقنا ليست بائع منتجات التجار ما لم يُذكر ذلك صراحة.',
          ],
        },
      ],
      contact: {
        label: 'تحتاج مساعدة بخصوص الرجوع أو الفوترة؟',
        email: 'support@souqna.qa',
      },
    },
    shipping: {
      slug: 'shipping',
      path: '/shipping',
      eyebrow: 'قانوني',
      title: 'سياسة الشحن',
      description: 'كيف تعمل مسؤوليات الشحن في متاجر سوقنا وخدمات سوقنا.',
      lastUpdated: 'آخر تحديث: ٣ مايو ٢٠٢٦',
      intro: [
        'سوقنا منصة تساعد التجار على بناء متاجر رقمية وتشغيلها. معظم المنتجات التي تُشترى عبر متجر تاجر يتم بيعها وتغليفها وشحنها وتسليمها وإرجاعها ودعمها من ذلك التاجر.',
        'توضح سياسة الشحن هذه مسؤوليات منصة سوقنا ومسؤوليات التجار الذين يستخدمون سوقنا.',
      ],
      sections: [
        {
          title: '١. طلبات متاجر التجار',
          body: [
            'في الطلبات التي تُقدّم لدى تاجر عبر متجر يعمل على سوقنا، يكون التاجر مسؤولاً عن طرق الشحن ومناطق التوصيل والرسوم والمواعيد وشركات التوصيل والتغليف والتعامل مع فشل التسليم والإرجاع وتحديثات العملاء.',
            'على المشترين مراجعة سياسة التاجر المعروضة على المتجر أو التواصل معه مباشرة قبل تقديم الطلب.',
          ],
        },
        {
          title: '٢. دور سوقنا',
          body: [
            'توفر سوقنا برمجيات واستضافة وإعدادات دفع وأدوات إدارة طلبات وتكاملات اختيارية يمكن للتجار استخدامها لتشغيل متاجرهم.',
            'ما لم تصرّح سوقنا بأنها البائع أو مزود التنفيذ لخدمة محددة، فإن سوقنا لا تغلف أو تشحن أو تسلم أو تؤمّن أو تسترجع أو تستبدل منتجات التجار.',
          ],
        },
        {
          title: '٣. رسوم الشحن والمواعيد',
          body: [
            'يحدد التاجر أو خدمة التوصيل الخارجية التي يختارها التاجر رسوم الشحن ومواعيد التسليم التقديرية.',
            'مواعيد التسليم تقديرية وليست ضماناً. وقد تؤثر الأحوال الجوية، مشاكل العنوان، سعة شركة التوصيل، الجمارك، فحوصات الدفع، توفر المخزون، أو توفر العميل على التسليم.',
          ],
        },
        {
          title: '٤. الطلبات المتضررة أو المتأخرة أو المفقودة',
          body: [
            'على المشترين التواصل مع التاجر أولاً بخصوص الطلبات المتضررة أو المتأخرة أو الناقصة أو المفقودة. ويتحمل التاجر مسؤولية التحقيق في مشاكل تنفيذ الطلب وحلها.',
            'إذا بدا أن مشكلة تقنية في سوقنا أثرت على سجل الطلب أو مسار الدفع، فيمكن للتاجر التواصل مع دعم سوقنا للمساعدة التقنية على المنصة.',
          ],
        },
        {
          title: '٥. خدمات سوقنا',
          body: [
            'اشتراكات منصة سوقنا والخدمات الرقمية وأعمال الإعداد وخدمات الدعم تُسلّم إلكترونياً ولا تحتاج إلى شحن مادي ما لم يُتفق كتابة على خلاف ذلك.',
            'إذا قدمت سوقنا مستقبلاً سلعة مادية أو خدمة تنفيذ مباشرة، فسيصف الطلب أو العرض أو شروط الخدمة الخاصة بذلك ترتيب التوصيل.',
          ],
        },
      ],
      contact: {
        label: 'أسئلة عن مسؤوليات الشحن في المنصة؟',
        email: 'support@souqna.qa',
      },
    },
  },
} satisfies Record<Locale, Record<PolicySlug, PolicyContent>>;

export function getPolicy(locale: Locale, slug: PolicySlug): PolicyContent {
  return policies[locale][slug];
}
