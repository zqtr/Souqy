'use client';

import { useState } from 'react';
import { saveWhatsAppBusinessAction } from '@/app/actions/apps';
import {
  SOUQNA_WHATSAPP_TEMPLATES,
  type WhatsAppSettings,
} from '@/lib/apps/whatsapp-settings';
import {
  AppField,
  AppSettingsCard,
  AppToggle,
  appInputStyle,
} from './AppSettingsCard';

export function WhatsAppBusinessSettingsForm({
  storefrontSlug,
  initial,
  connectedPhone,
}: {
  storefrontSlug: string;
  initial: WhatsAppSettings;
  connectedPhone: string | null;
}) {
  const [storefrontInquiryMode, setStorefrontInquiryMode] =
    useState<WhatsAppSettings['storefrontInquiryMode']>(
      initial.storefrontInquiryMode,
    );
  const [inboundCreatesInquiries, setInboundCreatesInquiries] = useState(
    initial.inboundCreatesInquiries,
  );
  const [outboundMode, setOutboundMode] =
    useState<WhatsAppSettings['outboundMode']>(initial.outboundMode);
  const [defaultReplyTemplate, setDefaultReplyTemplate] = useState(
    initial.defaultReplyTemplate,
  );
  const [inquiryTemplateName, setInquiryTemplateName] = useState(
    initial.inquiryTemplateName,
  );
  const [templateLanguage, setTemplateLanguage] = useState(
    initial.templateLanguage,
  );

  return (
    <AppSettingsCard
      eyebrow="WhatsApp"
      title="Messages and storefront routing"
      description="Control what happens after Meta connects: storefront inquiry buttons can open the connected WhatsApp number, inbound WhatsApp messages can become Souqna inquiries, and approved templates can send automatic order confirmations."
      onSave={() =>
        saveWhatsAppBusinessAction({
          storefrontSlug,
          storefrontInquiryMode,
          inboundCreatesInquiries,
          outboundMode,
          defaultReplyTemplate,
          inquiryTemplateName,
          templateLanguage,
        })
      }
      footer={
        connectedPhone ? (
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Connected phone: {connectedPhone}
          </span>
        ) : null
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setStorefrontInquiryMode('whatsapp')}
          aria-pressed={storefrontInquiryMode === 'whatsapp'}
          style={choiceStyle(storefrontInquiryMode === 'whatsapp')}
        >
          <strong>Open WhatsApp</strong>
          <span>Storefront inquiry CTAs open the connected business number.</span>
        </button>
        <button
          type="button"
          onClick={() => setStorefrontInquiryMode('souqna_form')}
          aria-pressed={storefrontInquiryMode === 'souqna_form'}
          style={choiceStyle(storefrontInquiryMode === 'souqna_form')}
        >
          <strong>Use Souqna form</strong>
          <span>Keep the existing inquiry form and dashboard-only flow.</span>
        </button>
      </div>

      <AppToggle
        label="Create inquiries from inbound WhatsApp messages"
        hint="When Meta sends a message webhook for the connected phone number, Souqna logs it as a new inquiry for this storefront."
        value={inboundCreatesInquiries}
        onChange={setInboundCreatesInquiries}
      />

      <AppField
        label="Outbound mode"
        hint="Template mode sends automatic order tracking messages through Meta. The template must already be approved in WhatsApp Manager."
      >
        <select
          value={outboundMode}
          onChange={(e) =>
            setOutboundMode(e.target.value === 'template' ? 'template' : 'manual')
          }
          style={appInputStyle}
        >
          <option value="manual">Manual replies</option>
          <option value="template">Automatic approved template</option>
        </select>
      </AppField>

      <AppField
        label="Default reply preview"
        hint="Preview copy for operators and inbound replies. Order tracking messages use the approved Meta template below."
      >
        <textarea
          value={defaultReplyTemplate}
          onChange={(e) => setDefaultReplyTemplate(e.target.value)}
          rows={4}
          style={{ ...appInputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </AppField>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <AppField
          label="Order confirmation template"
          hint="Body variables: {{1}} customer name, {{2}} store name, {{3}} order reference, {{4}} total, {{5}} tracking link."
        >
          <select
            value={inquiryTemplateName}
            onChange={(e) => {
              const value = e.target.value;
              setInquiryTemplateName(value);
              if (value === SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.name) {
                setTemplateLanguage(SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.language);
              }
            }}
            style={appInputStyle}
          >
            <option value={SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.name}>
              {SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.name}
            </option>
          </select>
        </AppField>
        <AppField label="Template language">
          <input
            value={templateLanguage}
            onChange={(e) => setTemplateLanguage(e.target.value)}
            style={appInputStyle}
            placeholder={SOUQNA_WHATSAPP_TEMPLATES.orderConfirmation.language}
          />
        </AppField>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--surface-rule)',
          background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
          padding: 14,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            marginBottom: 8,
          }}
        >
          Preview
        </div>
        <div
          style={{
            maxWidth: 320,
            borderRadius: 14,
            background: '#dcf8c6',
            color: '#143321',
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.45,
            boxShadow: '0 8px 24px -18px rgba(0,0,0,0.45)',
          }}
        >
          {defaultReplyTemplate || 'Your message preview appears here.'}
        </div>
        <div
          style={{
            marginTop: 12,
            color: 'var(--ink-muted)',
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          Active approved template:
          <br />
          مرحباً {'{{1}}'}، تم استلام طلبك من {'{{2}}'} رقم {'{{3}}'} بقيمة{' '}
          {'{{4}}'}. يمكنك متابعة الطلب هنا: {'{{5}}'}
        </div>
      </div>
    </AppSettingsCard>
  );
}

function choiceStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: 14,
    borderRadius: 12,
    textAlign: 'start',
    border: active
      ? '1px solid var(--admin-accent)'
      : '1px solid var(--surface-rule)',
    background: active
      ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
      : 'transparent',
    color: 'var(--ink-strong)',
    cursor: 'pointer',
    font: 'inherit',
  };
}
