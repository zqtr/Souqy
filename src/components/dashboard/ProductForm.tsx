'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Plus, X } from 'lucide-react';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import type { Product, ProductStatus } from '@/lib/products';
import { planUnlocksMonthlyPayments, type Plan } from '@/lib/plans';
import {
  DEFAULT_PRODUCT_HEIGHT_OPTIONS,
  MAX_PRODUCT_SIZE_OPTIONS,
  normalizeHeightInputLabel,
  normalizeHeightOptions,
  normalizeSizeOptions,
} from '@/lib/productOptions';
import type { Category } from '@/lib/categories';
import { createProduct, updateProduct, type ProductActionState } from '@/app/actions/products';
import { createCategory } from '@/app/actions/categories';

type Mode = 'create' | 'edit';

const PRODUCT_SAVE_TIMEOUT_MS = 25_000;

type Props = {
  mode: Mode;
  storefrontSlug: string;
  locale: Locale;
  copy: Copy;
  /** edit mode: the product being edited */
  initial?: Product;
  /**
   * Categories defined for this storefront. Drives the picker chips in
   * place of the legacy free-text category field. Empty list is fine —
   * the picker shows a primary "+ New category" affordance.
   */
  categories?: Category[];
  /**
   * Pre-selected category ids when editing an existing product.
   */
  initialCategoryIds?: string[];
  currentPlan?: Plan;
  /**
   * Hide the form's own header + footer cancel link. Used when the form
   * is rendered inside a modal that supplies its own chrome.
   */
  noChrome?: boolean;
  /**
   * Called after a successful save. Skips the default redirect when
   * provided, so a modal host can close itself + refresh the route.
   */
  onSaved?: (product: Product) => void;
  /**
   * Optional cancel handler. When set, the bottom-left "Back" link is
   * rendered as a button that calls this instead of a navigation link.
   */
  onCancel?: () => void;
};

type FormState = {
  title: string;
  description: string;
  priceQar: string;
  pricingMode: 'one_time' | 'monthly_payment';
  monthlyPriceQar: string;
  imageUrl: string;
  eventAt: string;
  status: ProductStatus;
  isCustomizable: boolean;
  customizationLabel: string;
  hasSizes: boolean;
  sizeOptions: string[];
  allowCustomSize: boolean;
  requiresHeightInput: boolean;
  heightInputLabel: string;
  heightOptions: string[];
};

function defaultsFrom(initial: Product | undefined): FormState {
  if (!initial) {
    return {
      title: '',
      description: '',
      priceQar: '',
      pricingMode: 'one_time',
      monthlyPriceQar: '',
      imageUrl: '',
      eventAt: '',
      status: 'active',
      isCustomizable: false,
      customizationLabel: '',
      hasSizes: false,
      sizeOptions: [],
      allowCustomSize: false,
      requiresHeightInput: false,
      heightInputLabel: '',
      heightOptions: [],
    };
  }
  const sizeOptions = normalizeSizeOptions(initial.sizeOptions);
  const heightOptions = normalizeHeightOptions(initial.heightOptions);
  return {
    title: initial.title,
    description: initial.description ?? '',
    priceQar: initial.priceQar !== null ? String(initial.priceQar) : '',
    pricingMode: initial.pricingMode,
    monthlyPriceQar: initial.monthlyPriceQar !== null ? String(initial.monthlyPriceQar) : '',
    imageUrl: initial.imageUrl ?? '',
    eventAt: initial.eventAt ? new Date(initial.eventAt).toISOString().slice(0, 16) : '',
    status: initial.status,
    isCustomizable: initial.isCustomizable,
    customizationLabel: initial.customizationLabel ?? '',
    hasSizes: sizeOptions.length > 0,
    sizeOptions,
    allowCustomSize: initial.allowCustomSize,
    requiresHeightInput: initial.requiresHeightInput,
    heightInputLabel: initial.heightInputLabel ?? '',
    heightOptions,
  };
}

export function ProductForm({
  mode,
  storefrontSlug,
  locale,
  copy,
  initial,
  categories = [],
  initialCategoryIds = [],
  currentPlan = 'free',
  noChrome = false,
  onSaved,
  onCancel,
}: Props) {
  const t = copy.products.form;
  const isRtl = locale === 'ar' || /[\u0600-\u06ff]/.test(t.labels.status);
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const idBase = useId();

  const [form, setForm] = useState<FormState>(defaultsFrom(initial));
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() =>
    initialCategoryIds.filter((id) => categories.some((c) => c.id === id)),
  );
  const [state, setState] = useState<ProductActionState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);
  const dashboardHref = `/account/products?store=${encodeURIComponent(storefrontSlug)}`;
  const canUseMonthlyPayments = planUnlocksMonthlyPayments(currentPlan);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (state.status === 'error') setState({ status: 'idle' });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    const priceParsed = form.priceQar.trim() === '' ? null : Number(form.priceQar);
    const priceQar = priceParsed === null || Number.isNaN(priceParsed) ? null : priceParsed;
    const monthlyParsed = form.monthlyPriceQar.trim() === '' ? null : Number(form.monthlyPriceQar);
    const monthlyPriceQar =
      monthlyParsed === null || Number.isNaN(monthlyParsed) ? null : monthlyParsed;
    const pricingMode =
      canUseMonthlyPayments && form.pricingMode === 'monthly_payment'
        ? 'monthly_payment'
        : 'one_time';
    const sizeOptions = form.hasSizes ? normalizeSizeOptions(form.sizeOptions) : [];
    const heightOptions = form.requiresHeightInput
      ? normalizeHeightOptions(form.heightOptions)
      : [];
    if (form.hasSizes && sizeOptions.length === 0) {
      setState({
        status: 'error',
        message: isRtl
          ? 'أضف مقاساً واحداً على الأقل أو أوقف خيار المقاسات.'
          : 'Add at least one size or turn Sizes off.',
        field: 'sizeOptions',
      });
      return;
    }
    if (form.requiresHeightInput && heightOptions.length === 0) {
      setState({
        status: 'error',
        message: isRtl
          ? 'أضف طولاً واحداً على الأقل أو أوقف خيار الطول.'
          : 'Add at least one height option or turn Height off.',
        field: 'heightOptions',
      });
      return;
    }

    const sharedPayload = {
      slug: storefrontSlug,
      locale,
      title: form.title.trim(),
      description: form.description.trim(),
      priceQar,
      pricingMode,
      monthlyPriceQar,
      imageUrl: form.imageUrl.trim(),
      // Legacy column kept blank — server rewrites it from the picker
      // selection so older storefront surfaces keep matching.
      category: '',
      categoryIds: selectedCategoryIds,
      eventAt: form.eventAt.trim(),
      status: form.status,
      isCustomizable: form.isCustomizable,
      customizationLabel:
        form.isCustomizable && form.customizationLabel.trim()
          ? form.customizationLabel.trim()
          : locale === 'ar'
            ? 'قابل للتخصيص'
            : 'Customizable',
      sizeOptions,
      allowCustomSize: form.hasSizes && form.allowCustomSize,
      requiresHeightInput: form.requiresHeightInput,
      heightInputLabel:
        form.requiresHeightInput && form.heightInputLabel.trim()
          ? (normalizeHeightInputLabel(form.heightInputLabel) ?? '')
          : locale === 'ar'
            ? 'الطول'
            : 'Height',
      heightOptions,
    } as const;

    setSaving(true);
    if (form.hasSizes) {
      setForm((prev) => ({ ...prev, sizeOptions }));
    }
    if (form.requiresHeightInput) {
      setForm((prev) => ({ ...prev, heightOptions }));
    }
    void (async () => {
      const result = await withSaveTimeout(
        mode === 'create'
          ? createProduct(sharedPayload)
          : updateProduct({ ...sharedPayload, id: initial!.id }),
      );
      setState(result);
      if (result.status === 'success') {
        setSaving(false);
        if (onSaved && result.product) {
          onSaved(result.product);
        } else {
          window.location.assign(dashboardHref);
        }
        return;
      }
      setSaving(false);
    })().catch((err) => {
      console.error('[ProductForm] save failed', err);
      setState({ status: 'error', message: t.error.generic });
      setSaving(false);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-[4px]"
      style={{
        background: noChrome ? 'transparent' : 'var(--surface-elevated)',
        border: noChrome ? 'none' : '1px solid var(--surface-rule)',
        padding: noChrome ? 0 : 'clamp(20px, 3vw, 36px)',
        color: 'var(--ink-strong)',
        fontFamily,
      }}
    >
      {noChrome ? null : (
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--admin-accent)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {t.eyebrow}
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily,
              fontWeight: isRtl ? 400 : 300,
              fontSize: 'clamp(22px, 2.8vw, 32px)',
              lineHeight: 1.15,
              letterSpacing: isRtl ? 0 : '-0.02em',
              color: 'var(--ink-strong)',
            }}
          >
            {mode === 'create' ? t.newTitle : t.editTitle}
          </h2>
          <p
            style={{
              color: 'var(--ink-muted)',
              fontSize: 14,
              lineHeight: 1.6,
              margin: '8px 0 0',
            }}
          >
            {t.sub}
          </p>
        </header>
      )}

      <div className="flex flex-col gap-5">
        <ImageField
          label={t.labels.image}
          helper={t.helpers.image}
          value={form.imageUrl}
          onChange={(v) => update('imageUrl', v)}
          slug={storefrontSlug}
        />

        <Field
          id={`${idBase}-title`}
          label={t.labels.title}
          value={form.title}
          onChange={(v) => update('title', v)}
          isRtl={isRtl}
          placeholder={t.placeholders.title}
          maxLength={160}
          required
        />

        <TextArea
          id={`${idBase}-desc`}
          label={t.labels.description}
          value={form.description}
          onChange={(v) => update('description', v)}
          isRtl={isRtl}
          placeholder={t.placeholders.description}
          maxLength={800}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            id={`${idBase}-price`}
            label={t.labels.price}
            value={form.priceQar}
            onChange={(v) => update('priceQar', v)}
            isRtl={false}
            type="number"
            placeholder={t.placeholders.price}
            helper={t.helpers.priceOptional}
          />
          {canUseMonthlyPayments ? (
            <PricingModeField
              idBase={`${idBase}-pricing`}
              mode={form.pricingMode}
              onModeChange={(v) => update('pricingMode', v)}
              monthlyPrice={form.monthlyPriceQar}
              onMonthlyPriceChange={(v) => update('monthlyPriceQar', v)}
              isRtl={isRtl}
            />
          ) : null}
          <CategoryPicker
            label={t.labels.category}
            helper={t.helpers.category}
            categories={categoryList}
            value={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
            storefrontSlug={storefrontSlug}
            isRtl={isRtl}
            onCategoryCreated={(cat) => {
              setCategoryList((prev) => [...prev, cat]);
              setSelectedCategoryIds((prev) => (prev.includes(cat.id) ? prev : [...prev, cat.id]));
            }}
          />
        </div>

        <CollapsibleField
          label={t.labels.eventAt}
          summary={
            form.eventAt
              ? new Date(form.eventAt).toLocaleString(isRtl ? 'ar-QA' : undefined)
              : isRtl
                ? 'أضف تاريخاً'
                : 'Add a date'
          }
          defaultOpen={Boolean(form.eventAt)}
          onClear={form.eventAt ? () => update('eventAt', '') : undefined}
          clearLabel={isRtl ? 'مسح' : 'Clear'}
          isRtl={isRtl}
        >
          <input
            id={`${idBase}-when`}
            type="datetime-local"
            value={form.eventAt}
            onChange={(e) => update('eventAt', e.target.value)}
            placeholder={t.placeholders.eventAt}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--surface-rule-strong)',
              color: 'var(--ink-strong)',
              padding: '10px 0',
              marginTop: 6,
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              outline: 'none',
            }}
          />
          <p
            className="m-0 mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.03em',
            }}
          >
            {t.helpers.eventAt}
          </p>
        </CollapsibleField>

        <CustomizableField
          idBase={`${idBase}-customizable`}
          checked={form.isCustomizable}
          label={form.customizationLabel}
          defaultLabel={locale === 'ar' ? 'قابل للتخصيص' : 'Customizable'}
          labels={{
            checkbox: t.labels.customizable,
            customLabel: t.labels.customizationLabel,
          }}
          helpers={{
            checkbox: t.helpers.customizable,
            customLabel: t.helpers.customizationLabel,
          }}
          onCheckedChange={(v) => update('isCustomizable', v)}
          onLabelChange={(v) => update('customizationLabel', v)}
          isRtl={isRtl}
        />

        <SizeOptionsField
          idBase={`${idBase}-sizes`}
          enabled={form.hasSizes}
          values={form.sizeOptions}
          onEnabledChange={(enabled) =>
            setForm((prev) => ({
              ...prev,
              hasSizes: enabled,
              sizeOptions:
                enabled && normalizeSizeOptions(prev.sizeOptions).length === 0
                  ? ['S', 'M', 'L']
                  : prev.sizeOptions,
              allowCustomSize: enabled ? prev.allowCustomSize : false,
            }))
          }
          onValuesChange={(values) => update('sizeOptions', values)}
          allowCustomSize={form.allowCustomSize}
          onAllowCustomSizeChange={(enabled) => update('allowCustomSize', enabled)}
          isRtl={isRtl}
        />

        <HeightOptionsField
          idBase={`${idBase}-height-input`}
          enabled={form.requiresHeightInput}
          label={form.heightInputLabel}
          values={form.heightOptions}
          defaultLabel={locale === 'ar' ? 'الطول' : 'Height'}
          onEnabledChange={(enabled) =>
            setForm((prev) => ({
              ...prev,
              requiresHeightInput: enabled,
              heightInputLabel:
                enabled && !prev.heightInputLabel.trim()
                  ? locale === 'ar'
                    ? 'الطول'
                    : 'Height'
                  : prev.heightInputLabel,
              heightOptions:
                enabled && normalizeHeightOptions(prev.heightOptions).length === 0
                  ? DEFAULT_PRODUCT_HEIGHT_OPTIONS
                  : prev.heightOptions,
            }))
          }
          onLabelChange={(value) => update('heightInputLabel', value)}
          onValuesChange={(values) => update('heightOptions', values)}
          isRtl={isRtl}
        />

        <StatusField
          label={t.labels.status}
          value={form.status}
          onChange={(v) => update('status', v)}
          options={[
            { id: 'active', label: t.status.active },
            { id: 'draft', label: t.status.draft },
            { id: 'sold_out', label: t.status.sold_out },
          ]}
          isRtl={isRtl}
        />
      </div>

      {state.status === 'error' && (
        <p
          role="alert"
          className="mt-5"
          style={{
            color: '#f1b1a1',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.03em',
          }}
        >
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-between mt-9 flex-wrap gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-muted)',
              fontFamily,
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {isRtl ? `→ ${t.cancel}` : `← ${t.cancel}`}
          </button>
        ) : (
          <a
            href={dashboardHref}
            style={{
              color: 'var(--ink-muted)',
              fontFamily,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            {isRtl ? `→ ${t.cancel}` : `← ${t.cancel}`}
          </a>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{
            background: saving ? 'rgba(216,180,106,0.58)' : '#d8b46a',
            color: '#16110a',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '14px 22px',
            borderRadius: 999,
            fontFamily,
            fontSize: 14,
            fontWeight: 500,
            cursor: saving ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {saving
            ? `${mode === 'create' ? t.submit.create : t.submit.save}…`
            : mode === 'create'
              ? t.submit.create
              : t.submit.save}{' '}
          <span aria-hidden>◈</span>
        </button>
      </div>
    </form>
  );
}

function withSaveTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Product save timed out'));
    }, PRODUCT_SAVE_TIMEOUT_MS);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function FormLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink-muted)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  );
}

function PricingModeField({
  idBase,
  mode,
  onModeChange,
  monthlyPrice,
  onMonthlyPriceChange,
  isRtl,
}: {
  idBase: string;
  mode: 'one_time' | 'monthly_payment';
  onModeChange: (v: 'one_time' | 'monthly_payment') => void;
  monthlyPrice: string;
  onMonthlyPriceChange: (v: string) => void;
  isRtl: boolean;
}) {
  return (
    <div>
      <FormLabel htmlFor={`${idBase}-mode`}>{isRtl ? 'طريقة التسعير' : 'Pricing mode'}</FormLabel>
      <select
        id={`${idBase}-mode`}
        value={mode}
        onChange={(e) => onModeChange(e.target.value as 'one_time' | 'monthly_payment')}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--surface-rule-strong)',
          color: 'var(--ink-strong)',
          padding: '10px 0',
          marginTop: 8,
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 18,
          outline: 'none',
        }}
      >
        <option value="one_time">{isRtl ? 'دفعة واحدة' : 'One-time'}</option>
        <option value="monthly_payment">{isRtl ? 'دفعات شهرية' : 'Monthly payments'}</option>
      </select>
      {mode === 'monthly_payment' ? (
        <input
          id={`${idBase}-monthly`}
          type="number"
          min={0}
          step={1}
          value={monthlyPrice}
          onChange={(e) => onMonthlyPriceChange(e.target.value)}
          placeholder={isRtl ? 'السعر الشهري' : 'Monthly price'}
          dir="ltr"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--surface-rule-strong)',
            color: 'var(--ink-strong)',
            padding: '10px 0',
            marginTop: 10,
            fontFamily: 'var(--font-sans)',
            fontSize: 18,
            outline: 'none',
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  isRtl,
  placeholder,
  helper,
  type = 'text',
  maxLength,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  isRtl: boolean;
  placeholder?: string;
  helper?: string;
  type?: 'text' | 'number' | 'datetime-local';
  maxLength?: number;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${
            focused ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
          }`,
          color: 'var(--ink-strong)',
          padding: '10px 0',
          marginTop: 8,
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 18,
          letterSpacing: '-0.005em',
          outline: 'none',
          transition: 'border-color 200ms',
        }}
      />
      {helper ? (
        <p
          className="mt-2 m-0"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.03em',
          }}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  isRtl,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  isRtl: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${focused ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
          color: 'var(--ink-strong)',
          padding: '12px 14px',
          marginTop: 8,
          fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
          fontSize: 15,
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
          outline: 'none',
          transition: 'border-color 200ms',
          borderRadius: 4,
          resize: 'vertical',
        }}
      />
    </div>
  );
}

function CustomizableField({
  idBase,
  checked,
  label,
  defaultLabel,
  labels,
  helpers,
  onCheckedChange,
  onLabelChange,
  isRtl,
}: {
  idBase: string;
  checked: boolean;
  label: string;
  defaultLabel: string;
  labels: { checkbox: string; customLabel: string };
  helpers: { checkbox: string; customLabel: string };
  onCheckedChange: (v: boolean) => void;
  onLabelChange: (v: string) => void;
  isRtl: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 8,
        background: 'var(--surface-bg)',
        padding: 14,
        display: 'grid',
        gap: checked ? 14 : 0,
      }}
    >
      <label
        htmlFor={`${idBase}-check`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          color: 'var(--ink-strong)',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <input
          id={`${idBase}-check`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          style={{
            marginTop: 3,
            accentColor: 'var(--admin-accent)',
            width: 16,
            height: 16,
            flex: '0 0 auto',
          }}
        />
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {labels.checkbox}
          </span>
          <span
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--ink-faint)',
            }}
          >
            {helpers.checkbox}
          </span>
        </span>
      </label>
      {checked ? (
        <Field
          id={`${idBase}-label`}
          label={labels.customLabel}
          value={label}
          onChange={onLabelChange}
          isRtl={isRtl}
          placeholder={defaultLabel}
          helper={helpers.customLabel}
          maxLength={48}
        />
      ) : null}
    </div>
  );
}

function SizeOptionsField({
  idBase,
  enabled,
  values,
  allowCustomSize,
  onEnabledChange,
  onValuesChange,
  onAllowCustomSizeChange,
  isRtl,
}: {
  idBase: string;
  enabled: boolean;
  values: string[];
  allowCustomSize: boolean;
  onEnabledChange: (v: boolean) => void;
  onValuesChange: (v: string[]) => void;
  onAllowCustomSizeChange: (v: boolean) => void;
  isRtl: boolean;
}) {
  const labels = isRtl
    ? {
        checkbox: 'المقاسات',
        helper: 'فعّلها للملابس أو الأحذية أو أي منتج يحتاج اختيار مقاس.',
        customCheckbox: 'مقاس مخصص',
        customHelper: 'اسمح للعميل بكتابة مقاس غير موجود في القائمة.',
        input: 'المقاس',
        add: 'أضف مقاس',
        remove: 'حذف المقاس',
        limit: 'وصلت إلى الحد الأقصى للمقاسات',
      }
    : {
        checkbox: 'Sizes',
        helper: 'Enable for apparel, shoes, or any product that needs a size choice.',
        customCheckbox: 'Custom size',
        customHelper: 'Let shoppers type a missing size before adding to cart.',
        input: 'Size',
        add: 'Add size',
        remove: 'Remove size',
        limit: 'Maximum size options reached',
      };
  const safeValues = values.length > 0 ? values : [''];
  const canAddMore = safeValues.length < MAX_PRODUCT_SIZE_OPTIONS;

  function updateAt(index: number, value: string) {
    onValuesChange(safeValues.map((item, i) => (i === index ? value : item)));
  }

  function removeAt(index: number) {
    const next = safeValues.filter((_, i) => i !== index);
    onValuesChange(next.length > 0 ? next : ['']);
  }

  return (
    <div
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 8,
        background: 'var(--surface-bg)',
        padding: 14,
        display: 'grid',
        gap: enabled ? 14 : 0,
      }}
    >
      <label
        htmlFor={`${idBase}-check`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          color: 'var(--ink-strong)',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <input
          id={`${idBase}-check`}
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          style={{
            marginTop: 3,
            accentColor: 'var(--admin-accent)',
            width: 16,
            height: 16,
            flex: '0 0 auto',
          }}
        />
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {labels.checkbox}
          </span>
          <span
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--ink-faint)',
            }}
          >
            {labels.helper}
          </span>
        </span>
      </label>

      {enabled ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
              gap: 10,
            }}
          >
            {safeValues.map((value, index) => (
              <div
                key={`${idBase}-${index}`}
                style={{ display: 'flex', alignItems: 'end', gap: 8 }}
              >
                <Field
                  id={`${idBase}-${index}`}
                  label={`${labels.input} ${index + 1}`}
                  value={value}
                  onChange={(next) => updateAt(index, next)}
                  isRtl={isRtl}
                  placeholder={index < 3 ? ['S', 'M', 'L'][index] : '35'}
                  maxLength={40}
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={labels.remove}
                  title={labels.remove}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--surface-rule-strong)',
                    background: 'transparent',
                    color: 'var(--ink-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flex: '0 0 auto',
                  }}
                >
                  <X size={15} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (canAddMore) onValuesChange([...safeValues, '']);
            }}
            disabled={!canAddMore}
            title={canAddMore ? labels.add : labels.limit}
            style={{
              justifySelf: isRtl ? 'end' : 'start',
              border: `1px dashed ${canAddMore ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
              borderRadius: 8,
              background: 'transparent',
              color: canAddMore ? 'var(--admin-accent)' : 'var(--ink-faint)',
              minHeight: 38,
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: canAddMore ? 'pointer' : 'default',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <Plus size={14} aria-hidden />
            {labels.add}
          </button>
          <label
            htmlFor={`${idBase}-custom-check`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              color: 'var(--ink-strong)',
              direction: isRtl ? 'rtl' : 'ltr',
              border: '1px dashed var(--surface-rule)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <input
              id={`${idBase}-custom-check`}
              type="checkbox"
              checked={allowCustomSize}
              onChange={(e) => onAllowCustomSizeChange(e.target.checked)}
              style={{
                marginTop: 3,
                accentColor: 'var(--admin-accent)',
                width: 16,
                height: 16,
                flex: '0 0 auto',
              }}
            />
            <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                }}
              >
                {labels.customCheckbox}
              </span>
              <span
                style={{
                  fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--ink-faint)',
                }}
              >
                {labels.customHelper}
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function HeightOptionsField({
  idBase,
  enabled,
  label,
  values,
  defaultLabel,
  onEnabledChange,
  onLabelChange,
  onValuesChange,
  isRtl,
}: {
  idBase: string;
  enabled: boolean;
  label: string;
  values: string[];
  defaultLabel: string;
  onEnabledChange: (v: boolean) => void;
  onLabelChange: (v: string) => void;
  onValuesChange: (v: string[]) => void;
  isRtl: boolean;
}) {
  const labels = isRtl
    ? {
        checkbox: 'الطول',
        helper: 'فعّله للعبايات أو أي منتج يحتاج اختيار طول.',
        customLabel: 'عنوان الحقل',
        customHelper: 'سيظهر هذا الاسم للعميل قبل الإضافة إلى السلة.',
        input: 'الطول',
        add: 'أضف طول',
        remove: 'حذف الطول',
        limit: 'وصلت إلى الحد الأقصى للخيارات',
      }
    : {
        checkbox: 'Height',
        helper: 'Enable for abayas or any product that needs a height choice.',
        customLabel: 'Field label',
        customHelper: 'This label appears to shoppers before adding the product to cart.',
        input: 'Height',
        add: 'Add height',
        remove: 'Remove height',
        limit: 'Maximum height options reached',
      };
  const safeValues = values.length > 0 ? values : [''];
  const canAddMore = safeValues.length < MAX_PRODUCT_SIZE_OPTIONS;

  function updateAt(index: number, value: string) {
    onValuesChange(safeValues.map((item, i) => (i === index ? value : item)));
  }

  function removeAt(index: number) {
    const next = safeValues.filter((_, i) => i !== index);
    onValuesChange(next.length > 0 ? next : ['']);
  }

  return (
    <div
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 8,
        background: 'var(--surface-bg)',
        padding: 14,
        display: 'grid',
        gap: enabled ? 14 : 0,
      }}
    >
      <label
        htmlFor={`${idBase}-check`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          color: 'var(--ink-strong)',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <input
          id={`${idBase}-check`}
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          style={{
            marginTop: 3,
            accentColor: 'var(--admin-accent)',
            width: 16,
            height: 16,
            flex: '0 0 auto',
          }}
        />
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {labels.checkbox}
          </span>
          <span
            style={{
              fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--ink-faint)',
            }}
          >
            {labels.helper}
          </span>
        </span>
      </label>

      {enabled ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <Field
            id={`${idBase}-label`}
            label={labels.customLabel}
            value={label}
            onChange={onLabelChange}
            isRtl={isRtl}
            placeholder={defaultLabel}
            helper={labels.customHelper}
            maxLength={40}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
                gap: 10,
              }}
            >
              {safeValues.map((value, index) => (
                <div
                  key={`${idBase}-${index}`}
                  style={{ display: 'flex', alignItems: 'end', gap: 8 }}
                >
                  <Field
                    id={`${idBase}-option-${index}`}
                    label={`${labels.input} ${index + 1}`}
                    value={value}
                    onChange={(next) => updateAt(index, next)}
                    isRtl={isRtl}
                    placeholder={DEFAULT_PRODUCT_HEIGHT_OPTIONS[index] ?? '180'}
                    maxLength={40}
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label={labels.remove}
                    title={labels.remove}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: '1px solid var(--surface-rule-strong)',
                      background: 'transparent',
                      color: 'var(--ink-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flex: '0 0 auto',
                    }}
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (canAddMore) onValuesChange([...safeValues, '']);
              }}
              disabled={!canAddMore}
              title={canAddMore ? labels.add : labels.limit}
              style={{
                justifySelf: isRtl ? 'end' : 'start',
                border: `1px dashed ${
                  canAddMore ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
                }`,
                borderRadius: 8,
                background: 'transparent',
                color: canAddMore ? 'var(--admin-accent)' : 'var(--ink-faint)',
                minHeight: 38,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: canAddMore ? 'pointer' : 'default',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <Plus size={14} aria-hidden />
              {labels.add}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Disclosure section for an optional field. Stays collapsed until the
 * founder opens it, so the form's primary path stays uncluttered. Used
 * for "Date & time" — the only product field most catalogues never
 * touch (calendar archetype + event listings only).
 */
function CollapsibleField({
  label,
  summary,
  defaultOpen,
  onClear,
  clearLabel = 'Clear',
  isRtl = false,
  children,
}: {
  label: string;
  summary: string;
  defaultOpen?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  isRtl?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(Boolean(defaultOpen));
  return (
    <div
      style={{
        border: '1px solid var(--surface-rule)',
        borderRadius: 8,
        background: 'var(--surface-bg)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-strong)',
          textAlign: isRtl ? 'right' : 'left',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-faint)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {onClear ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }
              }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--surface-rule-strong)',
              }}
            >
              {clearLabel}
            </span>
          ) : null}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 160ms',
              fontSize: 11,
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ▾
          </span>
        </span>
      </button>
      {open ? (
        <div
          style={{
            padding: '4px 14px 14px',
            borderTop: '1px dashed var(--surface-rule)',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Multi-select chip picker for categories. Replaces the legacy free-text
 * `category` input — categories are now first-class records (table
 * `categories` from migration 011), so the founder picks from the
 * existing list and can spawn a brand-new one inline without leaving the
 * product modal.
 *
 * Quick-create flow: typing in the search box surfaces a "+ Create
 * 'name'" affordance when the query doesn't match any existing
 * category. Hitting it calls `createCategory` directly and adopts the
 * returned row into the picker via `onCategoryCreated`.
 */
function CategoryPicker({
  label,
  helper,
  categories,
  value,
  onChange,
  storefrontSlug,
  isRtl,
  onCategoryCreated,
}: {
  label: string;
  helper?: string;
  categories: Category[];
  value: string[];
  onChange: (ids: string[]) => void;
  storefrontSlug: string;
  isRtl: boolean;
  onCategoryCreated: (cat: Category) => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const trimmedQuery = query.trim();
  const exactMatch = sorted.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCreate = trimmedQuery.length > 0 && !exactMatch;
  const labels = isRtl
    ? {
        empty: 'لا توجد تصنيفات بعد — اكتب اسماً لإنشاء واحد',
        search: 'ابحث أو أنشئ تصنيفاً',
        noMatches: 'لا توجد نتائج.',
        creating: 'جارٍ الإنشاء…',
        create: 'إنشاء تصنيف',
        remove: 'حذف',
        error: 'تعذر إنشاء التصنيف.',
      }
    : {
        empty: 'No categories yet — type a name to create one',
        search: 'Search or create a category',
        noMatches: 'No matches.',
        creating: 'Creating…',
        create: 'Create category',
        remove: 'Remove',
        error: 'Could not create category.',
      };

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function handleCreate() {
    if (!trimmedQuery || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createCategory({
        storefrontSlug,
        name: trimmedQuery,
      });
      if (result.status === 'success' && result.category) {
        onCategoryCreated(result.category);
        setQuery('');
      } else if (result.status === 'error') {
        setError(result.message);
      }
    } catch (err) {
      console.error('[category-picker] create failed', err);
      setError(labels.error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          marginTop: 8,
          border: '1px solid var(--surface-rule-strong)',
          borderRadius: 8,
          padding: 10,
          background: 'var(--surface-bg)',
        }}
      >
        {value.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 10,
            }}
          >
            {value.map((id) => {
              const c = categories.find((x) => x.id === id);
              if (!c) return null;
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 4px 4px 12px',
                    borderRadius: 999,
                    background: 'var(--admin-accent)',
                    color: 'var(--ink-on-gold)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {c.name}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`${labels.remove} ${c.name}`}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: 'none',
                      background: 'rgba(0,0,0,0.18)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={sorted.length === 0 ? labels.empty : labels.search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showCreate) handleCreate();
            }
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-strong)',
            padding: '6px 4px',
            fontSize: 14,
            outline: 'none',
            fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
            textAlign: isRtl ? 'right' : 'left',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          {filtered.map((c) => {
            const active = value.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${
                    active ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
                  }`,
                  background: active
                    ? 'color-mix(in srgb, var(--admin-accent) 15%, transparent)'
                    : 'var(--surface-elevated)',
                  color: active ? 'var(--admin-accent)' : 'var(--ink-strong)',
                  borderRadius: 999,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                {c.name}
              </button>
            );
          })}
          {filtered.length === 0 && !showCreate ? (
            <span
              style={{
                fontSize: 12,
                color: 'var(--ink-faint)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
                padding: '6px 0',
              }}
            >
              {labels.noMatches}
            </span>
          ) : null}
        </div>

        {showCreate ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px dashed var(--admin-accent)',
              background: 'transparent',
              color: 'var(--admin-accent)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              cursor: creating ? 'default' : 'pointer',
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {creating ? labels.creating : `+ ${labels.create} "${trimmedQuery}"`}
          </button>
        ) : null}

        {error ? (
          <p
            role="alert"
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#f1b1a1',
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
      {helper ? (
        <p
          className="mt-2 m-0"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.03em',
          }}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function StatusField({
  label,
  value,
  onChange,
  options,
  isRtl,
}: {
  label: string;
  value: ProductStatus;
  onChange: (v: ProductStatus) => void;
  options: { id: ProductStatus; label: string }[];
  isRtl: boolean;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <div className="flex gap-2 mt-2 flex-wrap">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              style={{
                padding: '10px 16px',
                background: active
                  ? 'color-mix(in srgb, var(--admin-accent) 18%, transparent)'
                  : 'transparent',
                border: `1px solid ${
                  active ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
                }`,
                color: active ? 'var(--admin-accent)' : 'var(--ink-strong)',
                fontFamily: isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 999,
                transition: 'all 180ms',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImageField({
  label,
  helper,
  value,
  onChange,
  slug,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  slug: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 52_428_800) {
      setError(helper);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const safe = sanitizeUploadName(file.name);
      const result = await upload(`products/${slug}/${safe}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-blob',
        clientPayload: JSON.stringify({
          storefrontSlug: slug,
          size: file.size,
          contentType: file.type || null,
        }),
      });
      onChange(result.url);
    } catch (err) {
      console.error('[upload-product] client error', err);
      setError(helper);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="mt-2 flex items-center gap-4"
        style={{
          border: '1px dashed var(--surface-rule-strong)',
          borderRadius: 4,
          padding: 16,
          background: 'transparent',
        }}
      >
        {value ? (
          <img
            src={value}
            alt=""
            width={64}
            height={64}
            style={{
              width: 64,
              height: 64,
              borderRadius: 4,
              objectFit: 'cover',
              border: '1px solid color-mix(in srgb, var(--admin-accent) 35%, transparent)',
              background: 'var(--surface-sunken)',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 4,
              border: '1px dashed var(--surface-rule-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-faint)',
              fontFamily: 'var(--font-serif), serif',
              fontStyle: 'italic',
              fontSize: 22,
            }}
          >
            ◯
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--admin-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              cursor: uploading ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            {uploading ? '…' : value ? 'Replace' : 'Drop or click to upload'}
          </button>
          {value ? (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => onChange('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Remove
              </button>
            </>
          ) : null}
          <p
            className="m-0 mt-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.03em',
            }}
          >
            {helper}
          </p>
          {error ? (
            <p
              role="alert"
              className="m-0 mt-1"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: '#f1b1a1',
                letterSpacing: '0.03em',
              }}
            >
              {error}
            </p>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

function sanitizeUploadName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'asset'
  );
}
