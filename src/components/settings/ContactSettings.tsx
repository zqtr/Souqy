'use client';

import { useState } from 'react';
import { SettingsForm, Field, inputStyle, textareaStyle } from '@/components/admin/SettingsForm';

type Props = {
  slug: string;
  initial: {
    phone: string | null;
    area: string | null;
    hours: string | null;
    instagram: string | null;
    crNumber: string | null;
  };
};

export function ContactSettings({ slug, initial }: Props) {
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [area, setArea] = useState(initial.area ?? '');
  const [hours, setHours] = useState(initial.hours ?? '');
  const [instagram, setInstagram] = useState(initial.instagram ?? '');
  const [crNumber, setCrNumber] = useState(initial.crNumber ?? '');

  const empty = (s: string) => (s.trim() === '' ? null : s.trim());

  return (
    <SettingsForm
      slug={slug}
      section="contact"
      patch={{
        phone: empty(phone),
        area: empty(area),
        hours: empty(hours),
        instagram: empty(instagram),
        crNumber: empty(crNumber),
      }}
      description="Contact details surface on the storefront and on order receipts. Empty fields disappear from the live page."
    >
      <Field label="Phone" hint="Used by the Inquire button when WhatsApp is the chosen channel.">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          placeholder="+974 1234 5678"
        />
      </Field>
      <Field label="Area" hint="Where the business is based. Shown in the contact card.">
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={inputStyle}
          placeholder="Lusail Marina, Doha"
        />
      </Field>
      <Field label="Hours" hint="Free-form. Multi-line is fine.">
        <textarea
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          style={textareaStyle}
          placeholder="Sun – Thu · 9am – 9pm"
        />
      </Field>
      <Field label="Instagram handle" hint="Without the @. Renders as a clean link.">
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          style={inputStyle}
          placeholder="souqna.qa"
        />
      </Field>
      <Field
        label="Commercial Registration"
        hint="Optional Qatari CR number. Surfaces a 'Verified' chip on the storefront. The number itself is never displayed."
      >
        <input
          value={crNumber}
          onChange={(e) => setCrNumber(e.target.value)}
          style={inputStyle}
          placeholder="123456"
        />
      </Field>
    </SettingsForm>
  );
}
