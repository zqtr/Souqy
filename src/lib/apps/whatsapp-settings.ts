export type WhatsAppSettings = {
  storefrontInquiryMode: 'whatsapp' | 'souqna_form';
  inboundCreatesInquiries: boolean;
  outboundMode: 'manual' | 'template';
  defaultReplyTemplate: string;
  inquiryTemplateName: string;
  templateLanguage: string;
  lastInboundAt: string | null;
  lastInboundMessageId: string | null;
};

export const SOUQNA_WHATSAPP_TEMPLATES = {
  accountCreated: { name: 'account_created_ar', language: 'ar' },
  founderStoreCreated: { name: 'founder_store_created', language: 'en' },
  founderFirstOrder: { name: 'founder_first_order_en', language: 'en' },
  orderConfirmation: { name: 'order_confirmation_ar', language: 'ar_QA' },
} as const;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  storefrontInquiryMode: 'whatsapp',
  inboundCreatesInquiries: true,
  outboundMode: 'template',
  defaultReplyTemplate:
    'مرحباً {{name}}، شكراً لتواصلك مع {{store}}. وصلتنا رسالتك وسنرد عليك قريباً.',
  inquiryTemplateName: SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.name,
  templateLanguage: SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.language,
  lastInboundAt: null,
  lastInboundMessageId: null,
};

export function normaliseSettings(raw: Record<string, unknown>): WhatsAppSettings {
  return {
    storefrontInquiryMode:
      raw.storefrontInquiryMode === 'souqna_form' ? 'souqna_form' : 'whatsapp',
    inboundCreatesInquiries:
      typeof raw.inboundCreatesInquiries === 'boolean'
        ? raw.inboundCreatesInquiries
        : DEFAULT_WHATSAPP_SETTINGS.inboundCreatesInquiries,
    outboundMode: raw.outboundMode === 'template' ? 'template' : 'manual',
    defaultReplyTemplate:
      typeof raw.defaultReplyTemplate === 'string' && raw.defaultReplyTemplate.trim()
        ? raw.defaultReplyTemplate.slice(0, 1000)
        : DEFAULT_WHATSAPP_SETTINGS.defaultReplyTemplate,
    inquiryTemplateName:
      typeof raw.inquiryTemplateName === 'string' && raw.inquiryTemplateName.trim()
        ? raw.inquiryTemplateName.trim().slice(0, 120)
        : DEFAULT_WHATSAPP_SETTINGS.inquiryTemplateName,
    templateLanguage:
      typeof raw.templateLanguage === 'string' && raw.templateLanguage.trim()
        ? raw.templateLanguage.trim().slice(0, 20)
        : DEFAULT_WHATSAPP_SETTINGS.templateLanguage,
    lastInboundAt: typeof raw.lastInboundAt === 'string' ? raw.lastInboundAt : null,
    lastInboundMessageId:
      typeof raw.lastInboundMessageId === 'string' ? raw.lastInboundMessageId : null,
  };
}

export function whatsappDigits(
  installed: { providerAccount?: Record<string, unknown> } | null | undefined,
) {
  const display =
    typeof installed?.providerAccount?.displayPhoneNumber === 'string'
      ? installed.providerAccount.displayPhoneNumber
      : '';
  const digits = display.replace(/[^0-9]/g, '');
  return digits || null;
}
