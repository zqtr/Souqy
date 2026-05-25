'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import {
  sendDashboardMessage,
  type SendDashboardMessageState,
} from '@/app/actions/messages';
import { inputStyle, textareaStyle } from '@/components/admin/SettingsForm';
import { Bi, Surface } from '@/components/admin/primitives';
import {
  SOUQNA_SENT_TEMPLATE_CATALOG,
  type SentTemplateKind,
  type SentTemplateVariableField,
} from '@/lib/sentTemplateCatalog';

type MessageType = SentTemplateKind;
type RecipientMode = 'manual_phone' | 'single_customer' | 'marketing_audience';

type CustomerOption = {
  id: number;
  name: string;
  phone: string | null;
  marketingConsent: boolean;
  lastSeenAt: string | null;
};

type TemplateValues = {
  customerName: string;
  storeName: string;
  subject: string;
  message: string;
  actionUrl: string;
};

const MESSAGE_TYPES = Object.values(SOUQNA_SENT_TEMPLATE_CATALOG);
const INITIAL_TEMPLATE = SOUQNA_SENT_TEMPLATE_CATALOG.customer_care;

export function SentMessagesComposer({
  storefrontSlug,
  storeName,
  customers,
  audienceCounts,
}: {
  storefrontSlug: string;
  storeName: string;
  customers: CustomerOption[];
  audienceCounts: { consented: number; recent: number };
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [pending, start] = useTransition();
  const [state, setState] = useState<SendDashboardMessageState>({ status: 'idle' });
  const [type, setType] = useState<MessageType>('customer_care');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('manual_phone');
  const [customerId, setCustomerId] = useState<string>('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [audience, setAudience] = useState<'consented_only' | 'recent_30d'>('consented_only');
  const [subject, setSubject] = useState(INITIAL_TEMPLATE.defaults.subject);
  const [message, setMessage] = useState(INITIAL_TEMPLATE.defaults.message);
  const [actionUrl, setActionUrl] = useState(INITIAL_TEMPLATE.defaults.actionUrl);
  const [channel, setChannel] = useState<'auto' | 'sms' | 'whatsapp' | 'rcs'>('whatsapp');
  const [sandbox, setSandbox] = useState(false);

  const selectedTemplate = SOUQNA_SENT_TEMPLATE_CATALOG[type];
  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId) ?? null;

  useEffect(() => {
    const next = SOUQNA_SENT_TEMPLATE_CATALOG[type];
    setSubject(next.defaults.subject);
    setMessage(next.defaults.message);
    setActionUrl(next.defaults.actionUrl);
  }, [type]);

  const recipientLabel = useMemo(() => {
    if (recipientMode === 'manual_phone') {
      return manualName || manualPhone || (isAr ? 'مستلم يدوي' : 'Manual recipient');
    }
    if (recipientMode === 'single_customer') {
      return selectedCustomer?.name || (isAr ? 'اختر عميلا' : 'Choose a customer');
    }
    return audience === 'recent_30d'
      ? `${audienceCounts.recent} ${isAr ? 'عميل نشط' : 'recent customers'}`
      : `${audienceCounts.consented} ${isAr ? 'عميل موافق' : 'opted-in customers'}`;
  }, [
    audience,
    audienceCounts.consented,
    audienceCounts.recent,
    isAr,
    manualName,
    manualPhone,
    recipientMode,
    selectedCustomer,
  ]);

  const templateValues = useMemo<TemplateValues>(
    () => ({
      customerName: recipientNameForTemplate({
        recipientMode,
        manualName,
        selectedCustomerName: selectedCustomer?.name,
        isAr,
      }),
      storeName,
      subject,
      message,
      actionUrl,
    }),
    [actionUrl, isAr, manualName, message, recipientMode, selectedCustomer?.name, storeName, subject],
  );

  const renderedPreview = renderTemplate(
    isAr ? selectedTemplate.arPreview : selectedTemplate.preview,
    templateValues,
  );
  const requiredFieldsFilled = selectedTemplate.fields.every(
    (field) => !field.required || fieldValue(field.key, templateValues).trim(),
  );
  const canSend = requiredFieldsFilled && !pending;
  const audienceDisabled = type !== 'marketing';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'idle' });
    start(async () => {
      const result = await sendDashboardMessage({
        storefrontSlug,
        type,
        recipientMode,
        customerId: customerId ? Number(customerId) : null,
        manualPhone,
        manualName,
        audience,
        subject,
        message,
        actionUrl,
        channel,
        sandbox,
      });
      setState(result);
    });
  }

  function updateTemplateField(key: SentTemplateVariableField['key'], value: string) {
    if (key === 'subject') setSubject(value);
    if (key === 'message') setMessage(value);
    if (key === 'actionUrl') setActionUrl(value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sq-messages-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Surface padding={20}>
          <PanelTitle
            eyebrow="Template"
            arEyebrow="القالب"
            title="Choose the approved template"
            arTitle="اختر القالب المعتمد"
          />
          <div className="sq-message-types">
            {MESSAGE_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setType(item.id);
                  if (item.id !== 'marketing' && recipientMode === 'marketing_audience') {
                    setRecipientMode('manual_phone');
                  }
                }}
                aria-pressed={type === item.id}
                style={{
                  textAlign: 'start',
                  borderRadius: 10,
                  border:
                    type === item.id
                      ? '1px solid color-mix(in srgb, var(--admin-accent) 46%, transparent)'
                      : '1px solid var(--surface-rule)',
                  background:
                    type === item.id
                      ? 'linear-gradient(135deg, color-mix(in srgb, var(--admin-accent) 16%, transparent), color-mix(in srgb, var(--surface-bg) 78%, transparent))'
                      : 'var(--surface-bg)',
                  color: 'var(--ink-strong)',
                  padding: 14,
                  cursor: 'pointer',
                }}
              >
                <strong style={{ display: 'block', fontSize: 14 }}>
                  <Bi en={item.label} ar={item.arLabel} />
                </strong>
                <span
                  style={{
                    display: 'block',
                    marginTop: 5,
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: 'var(--ink-muted)',
                  }}
                >
                  <Bi en={item.hint} ar={item.arHint} direction="stack" />
                </span>
              </button>
            ))}
          </div>
        </Surface>

        <Surface padding={20}>
          <PanelTitle
            eyebrow="Recipient"
            arEyebrow="المستلم"
            title="Who should receive it"
            arTitle="من يستلم الرسالة"
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <ModeOption
              label="Manual phone"
              arLabel="رقم يدوي"
              checked={recipientMode === 'manual_phone'}
              onChange={() => setRecipientMode('manual_phone')}
            />
            <ModeOption
              label="Single customer"
              arLabel="عميل واحد"
              checked={recipientMode === 'single_customer'}
              onChange={() => setRecipientMode('single_customer')}
            />
            <ModeOption
              label="Marketing audience"
              arLabel="جمهور تسويقي"
              checked={recipientMode === 'marketing_audience'}
              disabled={audienceDisabled}
              onChange={() => setRecipientMode('marketing_audience')}
              hint={
                audienceDisabled
                  ? isAr
                    ? 'متاح لقالب التسويق فقط.'
                    : 'Available for marketing templates only.'
                  : undefined
              }
            />
          </div>

          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            {recipientMode === 'manual_phone' ? (
              <div className="sq-two-cols">
                <FieldLike label="Phone" arLabel="الهاتف">
                  <input
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    style={inputStyle}
                    placeholder="+97455555555"
                  />
                </FieldLike>
                <FieldLike label="Name" arLabel="الاسم">
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={inputStyle}
                    placeholder={isAr ? 'اسم العميل' : 'Customer name'}
                  />
                </FieldLike>
              </div>
            ) : recipientMode === 'single_customer' ? (
              <FieldLike label="Customer" arLabel="العميل">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">{isAr ? 'اختر عميلا' : 'Choose a customer'}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id} disabled={!customer.phone}>
                      {customer.name}{' '}
                      {customer.phone
                        ? `- ${customer.phone}`
                        : isAr
                          ? '- لا يوجد هاتف'
                          : '- no phone'}
                    </option>
                  ))}
                </select>
              </FieldLike>
            ) : (
              <FieldLike label="Audience" arLabel="الجمهور">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as typeof audience)}
                  style={inputStyle}
                >
                  <option value="consented_only">
                    {isAr
                      ? `الموافقون على التسويق (${audienceCounts.consented})`
                      : `Marketing consent (${audienceCounts.consented})`}
                  </option>
                  <option value="recent_30d">
                    {isAr
                      ? `النشطون خلال 30 يوما (${audienceCounts.recent})`
                      : `Recent 30 days (${audienceCounts.recent})`}
                  </option>
                </select>
              </FieldLike>
            )}
          </div>
        </Surface>

        <Surface padding={20}>
          <PanelTitle
            eyebrow="Content"
            arEyebrow="المحتوى"
            title="Approved Sent template"
            arTitle="قالب Sent المعتمد"
          />
          <TemplatePreview
            templateName={selectedTemplate.sentName}
            status={selectedTemplate.status}
            language={selectedTemplate.language}
            variables={selectedTemplate.variables}
            preview={renderedPreview}
            values={templateValues}
            type={type}
          />
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            {selectedTemplate.fields.map((field) => (
              <TemplateVariableInput
                key={field.key}
                field={field}
                value={fieldValue(field.key, templateValues)}
                isAr={isAr}
                onChange={(value) => updateTemplateField(field.key, value)}
              />
            ))}
          </div>
        </Surface>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
        <Surface padding={20}>
          <PanelTitle
            eyebrow="Preview"
            arEyebrow="معاينة"
            title="Sent.dm payload"
            arTitle="بيانات الإرسال"
          />
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--surface-rule)',
              background: 'var(--surface-bg)',
              padding: 14,
              display: 'grid',
              gap: 10,
            }}
          >
            <PreviewRow label="Store" arLabel="المتجر" value={storeName} />
            <PreviewRow label="Template" arLabel="القالب" value={selectedTemplate.sentName} />
            <PreviewRow label="Recipient" arLabel="المستلم" value={recipientLabel} />
            <PreviewRow
              label="Channel"
              arLabel="القناة"
              value={channel === 'auto' ? 'WhatsApp default' : channel}
            />
            <PreviewRow
              label="Mode"
              arLabel="الوضع"
              value={sandbox ? 'Test only - no delivery' : 'Live delivery'}
            />
          </div>
        </Surface>

        <Surface padding={20}>
          <PanelTitle
            eyebrow="Routing"
            arEyebrow="التوجيه"
            title="Channel and test mode"
            arTitle="القناة ووضع الاختبار"
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <FieldLike label="Channel" arLabel="القناة">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                style={inputStyle}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="rcs">RCS</option>
              </select>
            </FieldLike>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 12,
                borderRadius: 10,
                border: '1px solid var(--surface-rule)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={sandbox}
                onChange={(e) => setSandbox(e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                <Bi
                  en="Test mode - no delivery"
                  ar="وضع الاختبار - بدون إرسال"
                  direction="stack"
                />
                <span style={{ display: 'block', color: 'var(--ink-muted)', marginTop: 4 }}>
                  <Bi
                    en="Sent validates the request only. The phone will not receive a message."
                    ar="يتحقق Sent من الطلب فقط. لن تصل رسالة إلى الهاتف."
                    direction="stack"
                  />
                </span>
              </span>
            </label>
          </div>
        </Surface>

        {state.status === 'success' ? (
          <div
            role="status"
            style={{
              borderRadius: 10,
              padding: '11px 14px',
              background: state.sandbox
                ? 'color-mix(in srgb, var(--admin-accent) 16%, transparent)'
                : 'color-mix(in srgb, #2f7d5b 13%, transparent)',
              color: state.sandbox ? 'var(--admin-accent)' : '#2f7d5b',
              fontSize: 13,
            }}
          >
            <Bi
              en={
                state.sandbox
                  ? `Test accepted for ${state.sent} recipient${state.sent === 1 ? '' : 's'}. No real message was sent.`
                  : `Sent to ${state.sent} recipient${state.sent === 1 ? '' : 's'}${
                      state.deliveryStatus ? ` (${state.deliveryStatus})` : ''
                    }${state.deliveryChannel ? ` via ${state.deliveryChannel}` : ''}.`
              }
              ar={
                state.sandbox
                  ? `تم قبول الاختبار لـ ${state.sent} مستلم. لم يتم إرسال رسالة حقيقية.`
                  : `تم إرسال الرسالة إلى ${state.sent} مستلم${
                      state.deliveryStatus ? ` (${state.deliveryStatus})` : ''
                    }${state.deliveryChannel ? ` عبر ${state.deliveryChannel}` : ''}.`
              }
              direction="stack"
            />
          </div>
        ) : state.status === 'error' ? (
          <div
            role="alert"
            style={{
              borderRadius: 10,
              padding: '11px 14px',
              background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 12%, transparent)',
              color: 'var(--color-maroon, #8b3a3a)',
              fontSize: 13,
            }}
          >
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSend}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '13px 16px',
            background: canSend
              ? 'var(--ink-strong)'
              : 'color-mix(in srgb, var(--ink-strong) 45%, transparent)',
            color: 'var(--surface-bg)',
            fontWeight: 650,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {pending ? (
            <Bi en="Sending..." ar="جار الإرسال..." />
          ) : sandbox ? (
            <Bi en="Validate test" ar="تحقق اختباري" />
          ) : (
            <Bi en="Send template" ar="إرسال القالب" />
          )}
        </button>
      </aside>

      <style>{`
        .sq-message-types {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(152px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .sq-two-cols {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1120px) {
          .sq-messages-grid { grid-template-columns: 1fr !important; }
          .sq-messages-grid aside { position: static !important; }
        }
        @media (max-width: 620px) {
          .sq-message-types,
          .sq-two-cols { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}

function TemplatePreview({
  templateName,
  status,
  language,
  variables,
  preview,
  values,
  type,
}: {
  templateName: string;
  status: string;
  language: string;
  variables: string[];
  preview: string;
  values: TemplateValues;
  type: MessageType;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid color-mix(in srgb, var(--admin-accent) 28%, var(--surface-rule))',
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--admin-accent) 10%, transparent), color-mix(in srgb, var(--surface-bg) 92%, transparent))',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ color: 'var(--ink-strong)', overflowWrap: 'anywhere' }}>{templateName}</strong>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <TemplatePill>{status}</TemplatePill>
          <TemplatePill>{language}</TemplatePill>
        </span>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--surface-rule)',
          background: 'color-mix(in srgb, var(--surface-bg) 82%, #000 8%)',
          padding: 14,
          color: 'var(--ink-strong)',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {preview}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          <Bi en="Template variables" ar="متغيرات القالب" />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {variables.map((variable) => (
            <TemplatePill key={variable}>
              {variable}: {variableValueFor(type, variable, values)}
            </TemplatePill>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateVariableInput({
  field,
  value,
  isAr,
  onChange,
}: {
  field: SentTemplateVariableField;
  value: string;
  isAr: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FieldLike label={field.label} arLabel={field.arLabel}>
      {field.input === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...textareaStyle, minHeight: 112 }}
          placeholder={isAr ? field.arPlaceholder : field.placeholder}
          required={field.required}
          maxLength={900}
        />
      ) : (
        <input
          type={field.input === 'url' ? 'url' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          placeholder={isAr ? field.arPlaceholder : field.placeholder}
          required={field.required}
          maxLength={field.input === 'url' ? 400 : 140}
        />
      )}
    </FieldLike>
  );
}

function FieldLike({
  label,
  arLabel,
  children,
}: {
  label: string;
  arLabel: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13.5, color: 'var(--ink-strong)' }}>
      <span style={{ fontWeight: 600 }}>
        <Bi en={label} ar={arLabel} />
      </span>
      {children}
    </label>
  );
}

function ModeOption({
  label,
  arLabel,
  checked,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  arLabel: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        borderRadius: 10,
        border: checked
          ? '1px solid color-mix(in srgb, var(--admin-accent) 42%, transparent)'
          : '1px solid var(--surface-rule)',
        background: checked
          ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
          : 'transparent',
        padding: 12,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="radio"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ marginTop: 3 }}
      />
      <span style={{ display: 'grid', gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          <Bi en={label} ar={arLabel} />
        </span>
        {hint ? <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{hint}</span> : null}
      </span>
    </label>
  );
}

function PanelTitle({
  eyebrow,
  arEyebrow,
  title,
  arTitle,
}: {
  eyebrow: string;
  arEyebrow: string;
  title: string;
  arTitle: string;
}) {
  return (
    <header style={{ marginBottom: 10 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent)',
        }}
      >
        <Bi en={eyebrow} ar={arEyebrow} />
      </div>
      <h2
        style={{
          margin: '5px 0 0',
          fontSize: 18,
          lineHeight: 1.2,
          color: 'var(--ink-strong)',
        }}
      >
        <Bi en={title} ar={arTitle} direction="stack" arSize="0.82em" />
      </h2>
    </header>
  );
}

function PreviewRow({
  label,
  arLabel,
  value,
}: {
  label: string;
  arLabel: string;
  value: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        <Bi en={label} ar={arLabel} />
      </span>
      <strong style={{ fontSize: 13.5, color: 'var(--ink-strong)', overflowWrap: 'anywhere' }}>
        {value}
      </strong>
    </div>
  );
}

function TemplatePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: '1px solid color-mix(in srgb, var(--admin-accent) 30%, var(--surface-rule))',
        background: 'color-mix(in srgb, var(--admin-accent) 9%, transparent)',
        color: 'var(--ink-strong)',
        padding: '5px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.05em',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </span>
  );
}

function fieldValue(key: SentTemplateVariableField['key'], values: TemplateValues): string {
  if (key === 'customerName') return values.customerName;
  if (key === 'storeName') return values.storeName;
  if (key === 'subject') return values.subject;
  if (key === 'message') return values.message;
  return values.actionUrl;
}

function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{(\w+)\}\}/gu, (_, key: keyof TemplateValues) => {
    const value = values[key];
    return value?.trim() || `{{${key}}}`;
  });
}

function variableValueFor(type: MessageType, variable: string, values: TemplateValues): string {
  const fallback = '...';
  if (type === 'marketing') {
    if (variable === 'var_1') return values.customerName || fallback;
    if (variable === 'var_2') return values.message || fallback;
  }
  if (type === 'customer_care') {
    if (variable === 'var_1') return values.customerName || fallback;
    if (variable === 'var_2') return values.storeName || fallback;
    if (variable === 'var_3') return values.subject || fallback;
    if (variable === 'var_4') return values.message || fallback;
    if (variable === 'var_5') return values.actionUrl || fallback;
  }
  if (type === 'fraud_alert') {
    if (variable === 'var_1') return values.customerName || fallback;
    if (variable === 'var_2') return values.storeName || fallback;
    if (variable === 'var_3') return values.subject || fallback;
    if (variable === 'var_4') return values.message || fallback;
  }
  if (type === 'delivery_notification') {
    if (variable === 'var_1') return values.customerName || fallback;
    if (variable === 'var_2') return values.storeName || fallback;
  }
  if (variable === 'var_1') return values.customerName || fallback;
  if (variable === 'var_2') return values.subject || fallback;
  if (variable === 'var_3') return values.storeName || fallback;
  if (variable === 'var_4') return values.message || fallback;
  return fallback;
}

function recipientNameForTemplate({
  recipientMode,
  manualName,
  selectedCustomerName,
  isAr,
}: {
  recipientMode: RecipientMode;
  manualName: string;
  selectedCustomerName?: string;
  isAr: boolean;
}): string {
  if (recipientMode === 'manual_phone') return manualName.trim() || (isAr ? 'العميل' : 'Customer');
  if (recipientMode === 'single_customer') {
    return selectedCustomerName?.trim() || (isAr ? 'العميل' : 'Customer');
  }
  return isAr ? 'العميل' : 'Customer';
}
