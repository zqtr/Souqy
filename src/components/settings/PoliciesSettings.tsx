'use client';

import { useState } from 'react';
import { SettingsForm, Field, textareaStyle } from '@/components/admin/SettingsForm';

type Props = {
  slug: string;
  initial: {
    terms: string;
    privacy: string;
    refund: string;
    shipping: string;
  };
};

export function PoliciesSettings({ slug, initial }: Props) {
  const [terms, setTerms] = useState(initial.terms);
  const [privacy, setPrivacy] = useState(initial.privacy);
  const [refund, setRefund] = useState(initial.refund);
  const [shipping, setShipping] = useState(initial.shipping);

  return (
    <SettingsForm
      slug={slug}
      section="policies"
      patch={{ policies: { terms, privacy, refund, shipping } }}
      description="The four standard storefront policies. They appear in the footer of every page. Plain text — markdown lands in a follow-up."
    >
      <Field label="Terms of service">
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          style={{ ...textareaStyle, minHeight: 160 }}
        />
      </Field>
      <Field label="Privacy policy">
        <textarea
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
          style={{ ...textareaStyle, minHeight: 160 }}
        />
      </Field>
      <Field label="Refund policy">
        <textarea
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          style={{ ...textareaStyle, minHeight: 160 }}
        />
      </Field>
      <Field label="Shipping policy">
        <textarea
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          style={{ ...textareaStyle, minHeight: 160 }}
        />
      </Field>
    </SettingsForm>
  );
}
