'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Surface } from '@/components/admin/primitives';
import { Field, inputStyle, textareaStyle } from '@/components/admin/SettingsForm';
import { adminPhrase } from '@/components/admin/adminLocale';
import {
  updateCheckoutSettings,
  type CheckoutActionState,
} from '@/app/actions/storefrontSettings';
import {
  CONFIGURABLE_PAYMENT_METHODS,
  POLICY_KEYS,
  type CheckoutSettings as CheckoutSettingsValue,
  type PaymentMethod,
  type PolicyKey,
} from '@/lib/storefrontSettings';

type OnlineProviderId = 'skipcash' | 'sadad' | 'tap' | 'myfatoorah' | 'paytabs' | 'hyperpay';

const ONLINE_PROVIDERS: Array<{
  id: OnlineProviderId;
  name: string;
  logo: string;
  status: 'live' | 'setup';
  summary: string;
  credentials: string[];
  docsEn: string;
  docsAr: string;
}> = [
  {
    id: 'skipcash',
    name: 'SkipCash',
    logo: '/apps/skipcash/mark.svg',
    status: 'live',
    summary: 'Live integration. Uses merchant API keys to create hosted checkout sessions.',
    credentials: ['Client ID', 'Key ID', 'Key secret', 'Webhook key (optional)'],
    docsEn: 'Add the merchant keys from your SkipCash dashboard. Confirm the CR before enabling checkout.',
    docsAr: 'أضف مفاتيح التاجر من لوحة SkipCash. أكّد السجل التجاري قبل تفعيل الدفع عند إتمام الطلب.',
  },
  {
    id: 'sadad',
    name: 'SADAD',
    logo: '/apps/sadad/mark.svg',
    status: 'live',
    summary: 'Live integration. Souqna verifies credentials with SADAD before activation.',
    credentials: ['SADAD ID / merchant ID', 'Registered website/domain', 'Secret key'],
    docsEn: 'Use the SADAD merchant ID, the exact website/domain registered with SADAD, and the secret key.',
    docsAr: 'استخدم رقم تاجر SADAD، والدومين المسجل لديهم بنفس الصيغة، والمفتاح السري.',
  },
  {
    id: 'tap',
    name: 'Tap Payments',
    logo: '/apps/tap-payments/logo.svg',
    status: 'setup',
    summary: 'Popular GCC gateway. Credential storage can be added before the charge flow is wired.',
    credentials: ['Merchant ID', 'Secret API key', 'Public API key', 'Encryption key (if using card entry)'],
    docsEn: 'In Tap Dashboard, open Accounts, then the merchant/operator account to copy Merchant ID, Secret Key, Public Key, and encryption key if needed.',
    docsAr: 'من لوحة Tap افتح Accounts ثم حساب التاجر لنسخ Merchant ID و Secret Key و Public Key ومفتاح التشفير عند الحاجة.',
  },
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    logo: '/apps/myfatoorah/mark.svg',
    status: 'setup',
    summary: 'GCC gateway with invoice and direct-payment APIs.',
    credentials: ['API token', 'Country / API environment', 'Webhook secret key'],
    docsEn: 'Use your MyFatoorah API token for server calls, choose the correct country/environment, then generate a webhook secret key in Integration Settings.',
    docsAr: 'استخدم API Token من MyFatoorah للطلبات من الخادم، واختر الدولة/البيئة الصحيحة، ثم أنشئ Webhook Secret Key من إعدادات التكامل.',
  },
  {
    id: 'paytabs',
    name: 'PayTabs',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain_url=https://site.paytabs.com',
    status: 'setup',
    summary: 'MENA/GCC payment gateway for hosted payment pages.',
    credentials: ['Profile ID', 'Server key', 'Region code', 'Client key (if using client SDK)'],
    docsEn: 'For PayTabs hosted/backend integration, copy Profile ID, Server Key, and Region from the merchant dashboard API key area.',
    docsAr: 'لتكامل PayTabs المستضاف/الخلفي، انسخ Profile ID و Server Key و Region من منطقة مفاتيح API في لوحة التاجر.',
  },
  {
    id: 'hyperpay',
    name: 'HyperPay',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain_url=https://www.hyperpay.com',
    status: 'setup',
    summary: 'Regional gateway used by larger GCC merchants.',
    credentials: ['Entity ID', 'Access token', 'Webhook secret', 'Mode / endpoint'],
    docsEn: 'Add the HyperPay Entity ID and Access Token for the correct test or production endpoint, plus webhook secret when configured.',
    docsAr: 'أضف Entity ID و Access Token من HyperPay للبيئة الصحيحة، وأضف Webhook Secret عند تفعيله.',
  },
];

type Props = {
  slug: string;
  initial: CheckoutSettingsValue;
  /**
   * Whether each policy currently has text on the briefs row. The
   * server action also re-checks this, but we surface it inline so the
   * founder can't accidentally require an empty policy at checkout.
   */
  policiesPresent: Record<PolicyKey, boolean>;
  skipCashEligible: boolean;
  skipCashBlockedReason: string;
  crNumber: string | null;
};

const PAYMENT_LABELS: Record<PaymentMethod, { title: string; body: string }> = {
  cod: {
    title: 'Cash on delivery',
    body: 'Buyer pays the courier in cash on hand-off.',
  },
  bank_transfer: {
    title: 'Bank transfer',
    body: 'Buyer wires you the order total before you ship.',
  },
  skipcash: {
    title: 'SkipCash online payments',
    body: 'Redirect buyers to SkipCash checkout using your merchant credentials.',
  },
  sadad: {
    title: 'SADAD online payments',
    body: 'Redirect buyers to SADAD Web Checkout using your merchant credentials.',
  },
  pay_link: {
    title: 'Legacy pay link',
    body: 'Existing orders can still read this method, but new setup uses SkipCash.',
  },
};

const POLICY_LABELS: Record<PolicyKey, string> = {
  terms: 'Terms of service',
  privacy: 'Privacy policy',
  refund: 'Refund policy',
  shipping: 'Shipping policy',
};

const CURRENCIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'QAR', label: 'QAR · Qatari Riyal' },
  { code: 'USD', label: 'USD · US Dollar' },
  { code: 'SAR', label: 'SAR · Saudi Riyal' },
  { code: 'AED', label: 'AED · UAE Dirham' },
  { code: 'KWD', label: 'KWD · Kuwaiti Dinar' },
];

const IBAN_HINT = 'Two-letter country code + up to 32 alphanumerics. Spaces are stripped on save.';

export function CheckoutSettings({
  slug,
  initial,
  policiesPresent,
  skipCashEligible,
  skipCashBlockedReason,
  crNumber,
}: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    (initial.paymentMethods.length > 0 ? initial.paymentMethods : (['cod'] as PaymentMethod[]))
      .filter((method) => method !== 'pay_link')
      .filter((method) => method !== 'skipcash' || skipCashEligible),
  );
  const [bankAccountName, setBankAccountName] = useState(initial.bankDetails?.accountName ?? '');
  const [bankIban, setBankIban] = useState(initial.bankDetails?.iban ?? '');
  const [bankName, setBankName] = useState(initial.bankDetails?.bankName ?? '');
  const [bankSwift, setBankSwift] = useState(initial.bankDetails?.swift ?? '');
  const [bankNotes, setBankNotes] = useState(initial.bankDetails?.notes ?? '');
  const [skipCashClientId, setSkipCashClientId] = useState('');
  const [skipCashKeyId, setSkipCashKeyId] = useState('');
  const [skipCashKeySecret, setSkipCashKeySecret] = useState('');
  const [skipCashWebhookKey, setSkipCashWebhookKey] = useState('');
  const [skipCashCrConfirmed, setSkipCashCrConfirmed] = useState(Boolean(initial.skipCash?.crConfirmedAt));
  const [sadadMerchantId, setSadadMerchantId] = useState('');
  const [sadadWebsite, setSadadWebsite] = useState('');
  const [sadadSecretKey, setSadadSecretKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<OnlineProviderId | null>(
    initial.sadad?.hasCredentials || initial.paymentMethods.includes('sadad')
      ? 'sadad'
      : initial.skipCash?.hasCredentials || initial.paymentMethods.includes('skipcash')
        ? 'skipcash'
        : null,
  );
  const [requiredPolicies, setRequiredPolicies] = useState<PolicyKey[]>(initial.requiredPolicies);
  const [currency, setCurrency] = useState(initial.currency);
  const [minOrderQar, setMinOrderQar] = useState<string>(
    initial.minOrderQar == null ? '' : String(initial.minOrderQar),
  );
  const [shippingFlatQar, setShippingFlatQar] = useState<string>(
    initial.shippingFlatQar == null ? '' : String(initial.shippingFlatQar),
  );

  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CheckoutActionState>({ status: 'idle' });

  const bankSelected = paymentMethods.includes('bank_transfer');
  const skipCashSelected = paymentMethods.includes('skipcash');
  const sadadSelected = paymentMethods.includes('sadad');
  const sadadFieldsTouched = Boolean(
    sadadMerchantId.trim() || sadadWebsite.trim() || sadadSecretKey.trim(),
  );
  const noneSelected = paymentMethods.length === 0;

  const togglePayment = (method: PaymentMethod) => {
    if (method === 'skipcash' && !skipCashEligible) return;
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  };

  const togglePolicy = (key: PolicyKey) => {
    if (!policiesPresent[key] && !requiredPolicies.includes(key)) return;
    setRequiredPolicies((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const normalizeIban = () => {
    setBankIban((v) => v.replace(/\s+/g, '').toUpperCase());
  };

  const parseIntOrNull = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const submit = () => {
    if (noneSelected) return;
    setState({ status: 'idle' });
    startTransition(async () => {
      const result = await updateCheckoutSettings({
        slug,
        paymentMethods,
        bankDetails: bankSelected
          ? {
              accountName: bankAccountName,
              iban: bankIban,
              bankName,
              swift: bankSwift.trim() === '' ? null : bankSwift,
              notes: bankNotes.trim() === '' ? null : bankNotes,
            }
          : null,
        payLink: null,
        skipCash: skipCashSelected
          ? {
              clientId: skipCashClientId,
              keyId: skipCashKeyId,
              keySecret: skipCashKeySecret,
              webhookKey: skipCashWebhookKey,
              confirmCr: skipCashCrConfirmed,
            }
          : null,
        sadad: sadadSelected || sadadFieldsTouched
          ? {
              merchantId: sadadMerchantId,
              website: sadadWebsite,
              secretKey: sadadSecretKey,
            }
          : null,
        requiredPolicies,
        currency,
        minOrderQar: parseIntOrNull(minOrderQar),
        shippingFlatQar: parseIntOrNull(shippingFlatQar),
      });
      setState(result);
    });
  };

  const errorState = state.status === 'error' ? state : null;
  const errorField = errorState?.field;
  const topLevelError = errorState && !errorField ? errorState.message : null;
  const fieldErrorMessage = (field: string): string | null =>
    errorState && errorState.field === field ? errorState.message : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      aria-describedby="checkout-form-help"
      noValidate
    >
      <p
        id="checkout-form-help"
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ink-muted)',
          lineHeight: 1.55,
          maxWidth: 720,
        }}
      >
        Configure how customers pay you and which policies they accept. Online providers only reveal
        their credential setup after you click their logo.
      </p>

      <PaymentMethodsSection
        selected={paymentMethods}
        onToggle={togglePayment}
        invalid={noneSelected}
      />

      <OnlineProvidersSection
        selected={selectedProvider}
        enabledMethods={paymentMethods}
        onSelect={setSelectedProvider}
        onToggle={(method) => togglePayment(method)}
        skipCashEligible={skipCashEligible}
        skipCashBlockedReason={skipCashBlockedReason}
      />

      {bankSelected ? (
        <BankDetailsSection
          accountName={bankAccountName}
          setAccountName={setBankAccountName}
          iban={bankIban}
          setIban={setBankIban}
          onIbanBlur={normalizeIban}
          bankName={bankName}
          setBankName={setBankName}
          swift={bankSwift}
          setSwift={setBankSwift}
          notes={bankNotes}
          setNotes={setBankNotes}
          ibanError={fieldErrorMessage('iban')}
          sectionError={fieldErrorMessage('bankDetails')}
        />
      ) : null}

      {selectedProvider === 'skipcash' ? (
        <SkipCashSection
          clientId={skipCashClientId}
          setClientId={setSkipCashClientId}
          keyId={skipCashKeyId}
          setKeyId={setSkipCashKeyId}
          keySecret={skipCashKeySecret}
          setKeySecret={setSkipCashKeySecret}
          webhookKey={skipCashWebhookKey}
          setWebhookKey={setSkipCashWebhookKey}
          crConfirmed={skipCashCrConfirmed}
          setCrConfirmed={setSkipCashCrConfirmed}
          crNumber={crNumber}
          hasStoredCredentials={Boolean(initial.skipCash?.hasCredentials)}
          clientIdHint={initial.skipCash?.clientIdHint ?? null}
          sectionError={fieldErrorMessage('skipCash')}
        />
      ) : null}

      {selectedProvider === 'sadad' ? (
        <SadadSection
          enabled={sadadSelected}
          onToggleEnabled={() => togglePayment('sadad')}
          merchantId={sadadMerchantId}
          setMerchantId={setSadadMerchantId}
          website={sadadWebsite}
          setWebsite={setSadadWebsite}
          secretKey={sadadSecretKey}
          setSecretKey={setSadadSecretKey}
          hasStoredCredentials={Boolean(initial.sadad?.hasCredentials)}
          merchantIdHint={initial.sadad?.merchantIdHint ?? null}
          websiteHint={initial.sadad?.websiteHint ?? null}
          verifiedMode={initial.sadad?.verifiedMode ?? null}
          verifiedAt={initial.sadad?.verifiedAt ?? null}
          sectionError={fieldErrorMessage('sadad')}
        />
      ) : null}

      {selectedProvider &&
      selectedProvider !== 'skipcash' &&
      selectedProvider !== 'sadad' ? (
        <ProviderPendingSection providerId={selectedProvider} />
      ) : null}

      <RequiredPoliciesSection
        selected={requiredPolicies}
        present={policiesPresent}
        onToggle={togglePolicy}
        sectionError={fieldErrorMessage('requiredPolicies')}
      />

      <OrderRulesSection
        currency={currency}
        setCurrency={setCurrency}
        minOrderQar={minOrderQar}
        setMinOrderQar={setMinOrderQar}
        shippingFlatQar={shippingFlatQar}
        setShippingFlatQar={setShippingFlatQar}
      />

      <SaveBar
        pending={pending}
        state={state}
        topLevelError={topLevelError}
        disabled={noneSelected}
      />
    </form>
  );
}

function SectionCard({
  title,
  description,
  legend,
  children,
}: {
  title: string;
  description?: string;
  /** Render the section's heading inside a `<legend>` for fieldsets. */
  legend?: boolean;
  children: React.ReactNode;
}) {
  if (legend) {
    return (
      <Surface padding={20}>
        <fieldset
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <legend style={{ padding: 0 }}>
            <SectionHeading title={title} description={description} />
          </legend>
          {children}
        </fieldset>
      </Surface>
    );
  }
  return (
    <Surface padding={20}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SectionHeading title={title} description={description} />
        {children}
      </div>
    </Surface>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 500,
          fontSize: 16,
          letterSpacing: '-0.005em',
          color: 'var(--ink-strong)',
        }}
      >
        {t(title)}
      </h2>
      {description ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-muted)',
            lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          {t(description)}
        </p>
      ) : null}
    </div>
  );
}

function PaymentMethodsSection({
  selected,
  onToggle,
  invalid,
}: {
  selected: PaymentMethod[];
  onToggle: (m: PaymentMethod) => void;
  invalid: boolean;
}) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <SectionCard
      title="Payment methods"
      description="Pick at least one offline method, or enable an online provider below."
      legend
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {CONFIGURABLE_PAYMENT_METHODS.filter((m) => m !== 'skipcash' && m !== 'sadad').map((m) => {
          const checked = selected.includes(m);
          const meta = PAYMENT_LABELS[m];
          return (
            <li key={m}>
              <CheckboxRow
                id={`payment-${m}`}
                checked={checked}
                onChange={() => onToggle(m)}
                title={meta.title}
                description={meta.body}
              />
            </li>
          );
        })}
      </ul>
      {invalid ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {t('Pick at least one payment method.')}
        </span>
      ) : null}
    </SectionCard>
  );
}

function OnlineProvidersSection({
  selected,
  enabledMethods,
  onSelect,
  onToggle,
  skipCashEligible,
  skipCashBlockedReason,
}: {
  selected: OnlineProviderId | null;
  enabledMethods: PaymentMethod[];
  onSelect: (id: OnlineProviderId) => void;
  onToggle: (method: PaymentMethod) => void;
  skipCashEligible: boolean;
  skipCashBlockedReason: string;
}) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <SectionCard
      title="Online payment providers"
      description="Click a provider logo to reveal its credential setup. Only live integrations can be enabled at checkout."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
        }}
      >
        {ONLINE_PROVIDERS.map((provider) => {
          const isSelected = selected === provider.id;
          const method = provider.id === 'skipcash' || provider.id === 'sadad' ? provider.id : null;
          const enabled = method ? enabledMethods.includes(method) : false;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelect(provider.id)}
              style={{
                minHeight: 122,
                borderRadius: 10,
                border: `1px solid ${
                  isSelected
                    ? 'var(--admin-accent, #b58a3a)'
                    : 'color-mix(in srgb, var(--ink-muted) 18%, transparent)'
                }`,
                background: isSelected
                  ? 'color-mix(in srgb, var(--admin-accent, #b58a3a) 10%, transparent)'
                  : 'var(--surface-overlay)',
                color: 'var(--ink-strong)',
                display: 'grid',
                gridTemplateRows: '62px auto auto',
                alignItems: 'center',
                justifyItems: 'start',
                gap: 8,
                padding: 14,
                textAlign: 'start',
                cursor: 'pointer',
              }}
              aria-pressed={isSelected}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: 62,
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid var(--surface-rule)',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  width={160}
                  height={54}
                  style={{ maxWidth: '88%', maxHeight: 54, objectFit: 'contain' }}
                />
              </span>
              <strong style={{ fontSize: 13 }}>{provider.name}</strong>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color:
                    provider.status === 'live'
                      ? 'var(--admin-accent, #8a6a2a)'
                      : 'var(--ink-muted)',
                }}
              >
                {enabled ? t('enabled') : provider.status === 'live' ? t('available') : t('credentials guide')}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <ProviderSummary
          provider={ONLINE_PROVIDERS.find((p) => p.id === selected)!}
          enabledMethods={enabledMethods}
          onToggle={onToggle}
          skipCashEligible={skipCashEligible}
          skipCashBlockedReason={skipCashBlockedReason}
        />
      ) : null}
    </SectionCard>
  );
}

function ProviderSummary({
  provider,
  enabledMethods,
  onToggle,
  skipCashEligible,
  skipCashBlockedReason,
}: {
  provider: (typeof ONLINE_PROVIDERS)[number];
  enabledMethods: PaymentMethod[];
  onToggle: (method: PaymentMethod) => void;
  skipCashEligible: boolean;
  skipCashBlockedReason: string;
}) {
  const method = provider.id === 'skipcash' || provider.id === 'sadad' ? provider.id : null;
  const enabled = method ? enabledMethods.includes(method) : false;
  const blockedSkipCash = provider.id === 'skipcash' && !skipCashEligible;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--ink-muted) 16%, transparent)',
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
        {provider.summary}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 10,
        }}
      >
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
          {provider.docsEn}
        </p>
        <p
          dir="rtl"
          lang="ar"
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            lineHeight: 1.65,
            textAlign: 'right',
          }}
        >
          {provider.docsAr}
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {provider.credentials.map((credential) => (
          <span
            key={credential}
            style={{
              padding: '6px 9px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'color-mix(in srgb, currentColor 7%, transparent)',
            }}
          >
            {credential}
          </span>
        ))}
      </div>
      {method ? (
        <CheckboxRow
          id={`${provider.id}-enabled-from-tile`}
          checked={enabled}
          onChange={() => onToggle(method)}
          title={`Enable ${provider.name} at checkout`}
          description="Requires valid saved credentials."
          disabled={blockedSkipCash}
          badge={blockedSkipCash ? 'Setup required' : null}
          titleSuffixHint={
            blockedSkipCash
              ? `Finish "${skipCashBlockedReason}" before accepting SkipCash payments.`
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function ProviderPendingSection({ providerId }: { providerId: Exclude<OnlineProviderId, 'skipcash' | 'sadad'> }) {
  const provider = ONLINE_PROVIDERS.find((p) => p.id === providerId)!;
  return (
    <SectionCard
      title={`${provider.name} credentials`}
      description="These are the official merchant credentials this provider uses. Checkout activation stays off until Souqna’s charge/refund/webhook flow for this provider is implemented."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {provider.credentials.map((credential) => (
          <Field key={credential} label={credential} hint="Not saved yet. Provider integration pending.">
            <input value="" disabled style={{ ...inputStyle, opacity: 0.62 }} aria-label={credential} />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

function BankDetailsSection({
  accountName,
  setAccountName,
  iban,
  setIban,
  onIbanBlur,
  bankName,
  setBankName,
  swift,
  setSwift,
  notes,
  setNotes,
  ibanError,
  sectionError,
}: {
  accountName: string;
  setAccountName: (v: string) => void;
  iban: string;
  setIban: (v: string) => void;
  onIbanBlur: () => void;
  bankName: string;
  setBankName: (v: string) => void;
  swift: string;
  setSwift: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  ibanError: string | null;
  sectionError: string | null;
}) {
  return (
    <SectionCard
      title="Bank details"
      description="Shown to buyers who pick bank transfer. Stored on your storefront row only — never logged."
    >
      {sectionError ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sectionError}
        </span>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Account name">
          <input
            required
            maxLength={120}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            style={inputStyle}
            aria-label="Bank account holder name"
            autoComplete="off"
          />
        </Field>
        <Field label="Bank name">
          <input
            required
            maxLength={120}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            style={inputStyle}
            aria-label="Bank name"
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="IBAN" hint={ibanError ?? IBAN_HINT}>
        <input
          required
          maxLength={42}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          onBlur={onIbanBlur}
          style={{
            ...inputStyle,
            ...(ibanError ? { borderColor: 'var(--color-maroon, #8b3a3a)' } : {}),
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)',
          }}
          aria-label="IBAN"
          aria-invalid={ibanError ? true : undefined}
          autoComplete="off"
          inputMode="text"
        />
      </Field>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="SWIFT / BIC" hint="Optional. Required only for cross-border transfers.">
          <input
            maxLength={11}
            value={swift}
            onChange={(e) => setSwift(e.target.value.toUpperCase())}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            aria-label="SWIFT or BIC code"
            autoComplete="off"
          />
        </Field>
      </div>
      <Field
        label="Notes for the buyer"
        hint="Optional. Anything else they need to know — payment reference format, branch, etc."
      >
        <textarea
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...textareaStyle, minHeight: 96 }}
          aria-label="Bank transfer notes"
        />
      </Field>
    </SectionCard>
  );
}

function SkipCashSection({
  clientId,
  setClientId,
  keyId,
  setKeyId,
  keySecret,
  setKeySecret,
  webhookKey,
  setWebhookKey,
  crConfirmed,
  setCrConfirmed,
  crNumber,
  hasStoredCredentials,
  clientIdHint,
  sectionError,
}: {
  clientId: string;
  setClientId: (v: string) => void;
  keyId: string;
  setKeyId: (v: string) => void;
  keySecret: string;
  setKeySecret: (v: string) => void;
  webhookKey: string;
  setWebhookKey: (v: string) => void;
  crConfirmed: boolean;
  setCrConfirmed: (v: boolean) => void;
  crNumber: string | null;
  hasStoredCredentials: boolean;
  clientIdHint: string | null;
  sectionError: string | null;
}) {
  return (
    <SectionCard
      title="SkipCash merchant setup"
      description="Store your merchant credentials once. Souqna encrypts them and uses them only to create buyer checkout sessions."
    >
      {sectionError ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sectionError}
        </span>
      ) : null}
      {hasStoredCredentials ? (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Stored credentials active{clientIdHint ? ` · client ${clientIdHint}` : ''}. Fill the
          fields again only to replace them.
        </p>
      ) : null}
      <CheckboxRow
        id="skipcash-cr-confirmed"
        checked={crConfirmed}
        onChange={() => setCrConfirmed(!crConfirmed)}
        title="Confirm CR ownership"
        description={
          crNumber
            ? `I confirm CR ${crNumber} belongs to this business.`
            : 'Add your CR number in Brand settings before enabling online payments.'
        }
        disabled={!crNumber}
        badge={!crNumber ? 'CR required' : null}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Client ID" hint={hasStoredCredentials ? 'Leave blank to keep current.' : ''}>
          <input
            maxLength={240}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={inputStyle}
            aria-label="SkipCash client id"
            autoComplete="off"
          />
        </Field>
        <Field label="Key ID">
          <input
            maxLength={240}
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            style={inputStyle}
            aria-label="SkipCash key id"
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Key secret" hint={hasStoredCredentials ? 'Leave blank to keep current.' : ''}>
        <input
          type="password"
          maxLength={2000}
          value={keySecret}
          onChange={(e) => setKeySecret(e.target.value)}
          style={inputStyle}
          aria-label="SkipCash key secret"
          autoComplete="off"
        />
      </Field>
      <Field label="Webhook key" hint="Optional, if SkipCash provides one for webhook signing.">
        <input
          type="password"
          maxLength={2000}
          value={webhookKey}
          onChange={(e) => setWebhookKey(e.target.value)}
          style={inputStyle}
          aria-label="SkipCash webhook key"
          autoComplete="off"
        />
      </Field>
    </SectionCard>
  );
}

function SadadSection({
  enabled,
  onToggleEnabled,
  merchantId,
  setMerchantId,
  website,
  setWebsite,
  secretKey,
  setSecretKey,
  hasStoredCredentials,
  merchantIdHint,
  websiteHint,
  verifiedMode,
  verifiedAt,
  sectionError,
}: {
  enabled: boolean;
  onToggleEnabled: () => void;
  merchantId: string;
  setMerchantId: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  secretKey: string;
  setSecretKey: (v: string) => void;
  hasStoredCredentials: boolean;
  merchantIdHint: string | null;
  websiteHint: string | null;
  verifiedMode: 'live' | 'sandbox' | null;
  verifiedAt: string | null;
  sectionError: string | null;
}) {
  return (
    <SectionCard
      title="SADAD merchant setup / إعداد تاجر سداد"
      description="SADAD is enabled only after Souqna verifies the credentials with SADAD. يتم تفعيل سداد فقط بعد التحقق من البيانات مع سداد."
    >
      <CheckboxRow
        id="sadad-enabled"
        checked={enabled}
        onChange={onToggleEnabled}
        title="Enable SADAD at checkout"
        description="Turn this on after adding valid credentials. أضف بيانات صحيحة ثم فعّل سداد في صفحة الدفع."
        badge={enabled ? 'Enabled' : 'Disabled'}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          padding: 14,
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, var(--ink-muted) 18%, transparent)',
          background: 'color-mix(in srgb, var(--surface-overlay) 78%, transparent)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 13 }}>What to enter</strong>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-muted)' }}>
            From the SADAD merchant dashboard, copy the SADAD ID, the registered website/domain,
            and the API secret key for live or test mode.
          </p>
        </div>
        <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 13 }}>ما البيانات المطلوبة؟</strong>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-muted)' }}>
            من لوحة تاجر سداد، انسخ رقم سداد، الموقع أو النطاق المسجل، ومفتاح API السري
            لبيئة الاختبار أو البيئة الحية.
          </p>
        </div>
      </div>
      {sectionError ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sectionError}
        </span>
      ) : null}
      {hasStoredCredentials ? (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Stored credentials active{merchantIdHint ? ` · merchant ${merchantIdHint}` : ''}
          {websiteHint ? ` · ${websiteHint}` : ''}
          {verifiedMode ? ` · verified ${verifiedMode}` : ''}
          {verifiedAt ? ` · ${new Date(verifiedAt).toLocaleDateString('en-GB')}` : ''}. Fill the
          fields again only to replace them.
        </p>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <Field
          label="Merchant ID / SADAD ID"
          hint={hasStoredCredentials ? 'Leave blank to keep current.' : 'رقم سداد الخاص بالتاجر.'}
        >
          <input
            maxLength={120}
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            style={inputStyle}
            aria-label="SADAD merchant id"
            autoComplete="off"
          />
        </Field>
        <Field label="Website / Domain" hint="The domain registered with SADAD. النطاق المسجل في سداد.">
          <input
            maxLength={240}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={inputStyle}
            aria-label="SADAD website"
            autoComplete="off"
          />
        </Field>
      </div>
      <Field
        label="Secret key"
        hint={
          hasStoredCredentials
            ? 'Leave blank to keep current.'
            : 'Generated in SADAD for test or live mode. المفتاح السري من لوحة سداد.'
        }
      >
        <input
          type="password"
          maxLength={2000}
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          style={inputStyle}
          aria-label="SADAD secret key"
          autoComplete="off"
        />
      </Field>
    </SectionCard>
  );
}

function RequiredPoliciesSection({
  selected,
  present,
  onToggle,
  sectionError,
}: {
  selected: PolicyKey[];
  present: Record<PolicyKey, boolean>;
  onToggle: (k: PolicyKey) => void;
  sectionError: string | null;
}) {
  return (
    <SectionCard
      title="Required policies at checkout"
      description="Buyers must tick a box accepting each of these before placing an order."
      legend
    >
      {sectionError ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sectionError}
        </span>
      ) : null}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {POLICY_KEYS.map((k) => {
          const checked = selected.includes(k);
          const empty = !present[k];
          const disabled = empty && !checked;
          return (
            <li key={k}>
              <CheckboxRow
                id={`policy-${k}`}
                checked={checked}
                onChange={() => onToggle(k)}
                title={POLICY_LABELS[k]}
                disabled={disabled}
                badge={empty ? 'Empty' : null}
                titleSuffixHint={
                  disabled ? 'Add this policy first in Settings → Policies' : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function OrderRulesSection({
  currency,
  setCurrency,
  minOrderQar,
  setMinOrderQar,
  shippingFlatQar,
  setShippingFlatQar,
}: {
  currency: string;
  setCurrency: (v: string) => void;
  minOrderQar: string;
  setMinOrderQar: (v: string) => void;
  shippingFlatQar: string;
  setShippingFlatQar: (v: string) => void;
}) {
  const knownCurrency = useMemo(
    () => CURRENCIES.some((c) => c.code === currency.toUpperCase()),
    [currency],
  );
  return (
    <SectionCard
      title="Order rules"
      description="Currency the storefront prices in, plus optional thresholds applied at checkout."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="Currency" hint="Display currency. Stored as a 3-letter ISO 4217 code.">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={inputStyle}
            aria-label="Storefront currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
            {!knownCurrency ? (
              <option value={currency}>{currency} (legacy)</option>
            ) : null}
          </select>
        </Field>
        <Field label="Minimum order (QAR)" hint="Optional. Block orders below this amount.">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={minOrderQar}
            onChange={(e) => setMinOrderQar(e.target.value)}
            style={inputStyle}
            placeholder="100"
            aria-label="Minimum order amount in QAR"
          />
        </Field>
        <Field label="Flat shipping (QAR)" hint="Optional. Add to every order at checkout.">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={shippingFlatQar}
            onChange={(e) => setShippingFlatQar(e.target.value)}
            style={inputStyle}
            placeholder="25"
            aria-label="Flat shipping fee in QAR"
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function CheckboxRow({
  id,
  checked,
  onChange,
  title,
  description,
  disabled,
  badge,
  titleSuffixHint,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
  disabled?: boolean;
  badge?: string | null;
  titleSuffixHint?: string;
}) {
  const tipId = useId();
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked
          ? 'color-mix(in srgb, var(--admin-accent) 8%, transparent)'
          : 'var(--surface-bg)',
        border: checked
          ? '1px solid var(--admin-accent)'
          : '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={titleSuffixHint ? tipId : undefined}
        style={{
          marginTop: 3,
          width: 16,
          height: 16,
          accentColor: 'var(--admin-accent)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <strong
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--ink-strong)',
            }}
          >
            {t(title)}
          </strong>
          {badge ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                padding: '1px 6px',
                borderRadius: 999,
                border:
                  '1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent)',
              }}
            >
              {t(badge)}
            </span>
          ) : null}
        </div>
        {description ? (
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            {t(description)}
          </span>
        ) : null}
        {titleSuffixHint ? (
          <span
            id={tipId}
            role="note"
            style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic' }}
          >
            {t(titleSuffixHint)}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function SaveBar({
  pending,
  state,
  topLevelError,
  disabled,
}: {
  pending: boolean;
  state: CheckoutActionState;
  topLevelError: string | null;
  disabled: boolean;
}) {
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);
  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
      }}
    >
      {topLevelError ? (
        <span
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--color-maroon, #8b3a3a)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {topLevelError}
        </span>
      ) : state.status === 'success' ? (
        <span
          role="status"
          style={{
            fontSize: 12.5,
            color: 'var(--admin-accent)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {t('Saved')} {new Date(state.updatedAt).toLocaleTimeString(locale === 'ar' ? 'ar-QA' : 'en-GB')}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        style={{
          padding: '9px 18px',
          borderRadius: 8,
          background:
            pending || disabled
              ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)'
              : 'var(--ink-strong)',
          color: 'var(--surface-bg)',
          border: 'none',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: pending ? 'progress' : disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? t('Saving…') : t('Save changes')}
      </button>
    </footer>
  );
}
