export type SentTemplateKind =
  | 'marketing'
  | 'customer_care'
  | 'fraud_alert'
  | 'delivery_notification'
  | 'account_notification';

export type SentTemplateVariableField = {
  key: 'customerName' | 'storeName' | 'subject' | 'message' | 'actionUrl';
  label: string;
  arLabel: string;
  placeholder: string;
  arPlaceholder: string;
  input: 'text' | 'textarea' | 'url';
  required?: boolean;
};

export type SouqnaSentTemplate = {
  id: SentTemplateKind;
  templateId: string;
  label: string;
  arLabel: string;
  hint: string;
  arHint: string;
  sentName: string;
  language: string;
  status: string;
  variables: string[];
  preview: string;
  arPreview: string;
  defaults: {
    subject: string;
    message: string;
    actionUrl: string;
  };
  fields: SentTemplateVariableField[];
};

export const SENT_TEMPLATE_IDS: Record<SentTemplateKind, string> = {
  marketing: '298977b3-2b1e-417f-b21a-01cb736f7e74',
  customer_care: '8681a1e0-70af-4960-8874-3668917bfdb6',
  fraud_alert: '8f800498-7173-4385-b6ba-dc3947e6ba7d',
  delivery_notification: '0507e170-a5f5-4cdd-8762-5da349c2851b',
  account_notification: '46ce102a-e54d-4ce0-a177-683133b0c551',
};

export const SOUQNA_SENT_TEMPLATE_CATALOG: Record<SentTemplateKind, SouqnaSentTemplate> = {
  marketing: {
    id: 'marketing',
    templateId: SENT_TEMPLATE_IDS.marketing,
    label: 'Marketing',
    arLabel: 'تسويق',
    hint: 'Campaigns for opted-in customers.',
    arHint: 'حملات للعملاء الموافقين.',
    sentName: 'Storefront update notification',
    language: 'en_US',
    status: 'PENDING',
    variables: ['var_1', 'var_2', 'var_3'],
    preview: 'Hi {{customerName}}, {{storeName}} has an update: {{message}} Reply STOP to opt out.',
    arPreview: 'مرحباً {{customerName}}، {{message}}',
    defaults: {
      subject: 'Souqna campaign',
      message: 'A new update is available from the store.',
      actionUrl: 'https://souqna.qa/account',
    },
    fields: [
      variableField(
        'message',
        'Campaign line',
        'نص الحملة',
        'A new collection is ready.',
        'مجموعة جديدة أصبحت متاحة.',
        'textarea',
        true,
      ),
      variableField('actionUrl', 'Action link', 'رابط الإجراء', 'https://souqna.qa/account', 'https://souqna.qa/account', 'url'),
    ],
  },
  customer_care: {
    id: 'customer_care',
    templateId: SENT_TEMPLATE_IDS.customer_care,
    label: 'Customer Care',
    arLabel: 'خدمة العملاء',
    hint: 'Helpful replies and follow-ups.',
    arHint: 'ردود ومتابعات مفيدة.',
    sentName: 'Souqna Support Update',
    language: 'en_US',
    status: 'PENDING',
    variables: ['var_1', 'var_2', 'var_3', 'var_4', 'var_5'],
    preview: 'Hi {{customerName}}, {{storeName}} sent you an update: {{subject}}. {{message}}',
    arPreview: 'مرحباً {{customerName}}، أرسل لك {{storeName}} تحديثاً: {{subject}}. {{message}}',
    defaults: {
      subject: 'Support update',
      message: 'We are following up on your request.',
      actionUrl: 'https://souqna.qa/account',
    },
    fields: [
      variableField('subject', 'Support topic', 'موضوع الدعم', 'Order question', 'استفسار عن الطلب', 'text'),
      variableField(
        'message',
        'Care note',
        'رسالة الخدمة',
        'We are following up on your request.',
        'نتابع طلبك وسنساعدك قريباً.',
        'textarea',
        true,
      ),
      variableField('actionUrl', 'Action link', 'رابط الإجراء', 'https://souqna.qa/account', 'https://souqna.qa/account', 'url'),
    ],
  },
  fraud_alert: {
    id: 'fraud_alert',
    templateId: SENT_TEMPLATE_IDS.fraud_alert,
    label: 'Fraud Alert',
    arLabel: 'تنبيه أمان',
    hint: 'Important security and payment alerts.',
    arHint: 'تنبيهات أمان ودفع مهمة.',
    sentName: 'Account activity notice',
    language: 'en_US',
    status: 'PENDING',
    variables: ['var_1', 'var_2', 'var_3', 'var_4'],
    preview: 'Hi {{customerName}}, {{storeName}} alert: {{subject}}. {{message}}',
    arPreview: 'مرحباً {{customerName}}، تنبيه من {{storeName}}: {{subject}}. {{message}}',
    defaults: {
      subject: 'Payment alert',
      message: 'A payment attempt needs your attention.',
      actionUrl: 'https://souqna.qa/account',
    },
    fields: [
      variableField('subject', 'Alert title', 'عنوان التنبيه', 'Payment alert', 'تنبيه دفع', 'text'),
      variableField(
        'message',
        'Security message',
        'رسالة الأمان',
        'A payment attempt needs your attention.',
        'محاولة دفع تحتاج إلى انتباهك.',
        'textarea',
        true,
      ),
      variableField('actionUrl', 'Action link', 'رابط الإجراء', 'https://souqna.qa/account', 'https://souqna.qa/account', 'url'),
    ],
  },
  delivery_notification: {
    id: 'delivery_notification',
    templateId: SENT_TEMPLATE_IDS.delivery_notification,
    label: 'Delivery',
    arLabel: 'التوصيل',
    hint: 'Order and delivery updates.',
    arHint: 'تحديثات الطلب والتوصيل.',
    sentName: 'Order update notification',
    language: 'en_US',
    status: 'PENDING',
    variables: ['var_1', 'var_2', 'var_3', 'var_4', 'var_5', 'var_6'],
    preview: '{{customerName}}, order {{subject}} from {{storeName}} has a delivery update. {{message}}',
    arPreview: '{{customerName}}، لديك تحديث من {{storeName}}. {{message}}',
    defaults: {
      subject: 'Delivery update',
      message: 'Your order status has been updated.',
      actionUrl: 'https://souqna.qa/account',
    },
    fields: [
      variableField('subject', 'Update title', 'عنوان التحديث', 'Delivery update', 'تحديث التوصيل', 'text'),
      variableField(
        'message',
        'Delivery note',
        'رسالة التوصيل',
        'Your order status has been updated.',
        'تم تحديث حالة طلبك.',
        'textarea',
        true,
      ),
      variableField('actionUrl', 'Action link', 'رابط الإجراء', 'https://souqna.qa/account', 'https://souqna.qa/account', 'url'),
    ],
  },
  account_notification: {
    id: 'account_notification',
    templateId: SENT_TEMPLATE_IDS.account_notification,
    label: 'Account',
    arLabel: 'الحساب',
    hint: 'Account and store notices.',
    arHint: 'تنبيهات الحساب والمتجر.',
    sentName: 'Souqna Account Notice',
    language: 'en_US',
    status: 'PENDING',
    variables: ['var_1', 'var_2', 'var_3', 'var_4', 'var_5'],
    preview: 'Hi {{customerName}}, {{storeName}} notice: {{subject}}. {{message}}',
    arPreview: 'مرحباً {{customerName}}، إشعار من {{storeName}}: {{subject}}. {{message}}',
    defaults: {
      subject: 'Account update',
      message: 'There is a new account update from Souqna.',
      actionUrl: 'https://souqna.qa/account',
    },
    fields: [
      variableField('subject', 'Notice title', 'عنوان الإشعار', 'Account update', 'تحديث الحساب', 'text'),
      variableField(
        'message',
        'Notice message',
        'رسالة الإشعار',
        'There is a new account update from Souqna.',
        'يوجد تحديث جديد للحساب من سوقنا.',
        'textarea',
        true,
      ),
      variableField('actionUrl', 'Action link', 'رابط الإجراء', 'https://souqna.qa/account', 'https://souqna.qa/account', 'url'),
    ],
  },
};

function variableField(
  key: SentTemplateVariableField['key'],
  label: string,
  arLabel: string,
  placeholder: string,
  arPlaceholder: string,
  input: SentTemplateVariableField['input'],
  required = false,
): SentTemplateVariableField {
  return { key, label, arLabel, placeholder, arPlaceholder, input, required };
}
