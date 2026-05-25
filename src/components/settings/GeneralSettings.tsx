'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { SettingsForm, Field, inputStyle } from '@/components/admin/SettingsForm';
import { adminPhrase } from '@/components/admin/adminLocale';

type Props = {
  slug: string;
  initial: {
    businessName: string;
    founderName: string;
    tagline: string | null;
  };
};

export function GeneralSettings({ slug, initial }: Props) {
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [founderName, setFounderName] = useState(initial.founderName);
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const locale = useLocale();
  const t = (text: string) => adminPhrase(locale, text);

  return (
    <SettingsForm
      slug={slug}
      section="general"
      patch={{
        businessName,
        founderName,
        tagline: tagline.trim() === '' ? null : tagline.trim(),
      }}
      description="The store name customers see, your founder name on receipts, and a one-line tagline rendered in the storefront header."
    >
      <Field label="Store name" hint="Shown on every page of your storefront and in order emails.">
        <input
          required
          maxLength={120}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Founder name" hint="Used in customer-facing copy ('a note from {name}…') and audit history.">
        <input
          required
          maxLength={120}
          value={founderName}
          onChange={(e) => setFounderName(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field
        label="Tagline"
        hint="Optional. One sentence to introduce the store. Empty hides the line."
      >
        <input
          maxLength={280}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          style={inputStyle}
          placeholder={t('Editorial perfumes, layered like memory.')}
        />
      </Field>
    </SettingsForm>
  );
}
