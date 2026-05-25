'use client';

import { useState } from 'react';
import {
  SettingsForm,
  Field,
  inputStyle,
} from '@/components/admin/SettingsForm';
import { AdminUploadField } from '@/components/admin/AdminUploadField';
import { UploadedFileMeta } from '@/components/admin/UploadedFileMeta';

type Props = {
  slug: string;
  initial: {
    /** Kept for back-compat: callers may still pass the storefront's
     *  current palette, but the form no longer surfaces a picker — the
     *  template owns the palette. */
    palette?: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    tagline: string | null;
    templateId: string;
  };
};

export function BrandSettings({ slug, initial }: Props) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl ?? '');
  const [tagline, setTagline] = useState(initial.tagline ?? '');

  return (
    <SettingsForm
      slug={slug}
      section="brand"
      patch={{
        logoUrl: logoUrl.trim() === '' ? null : logoUrl.trim(),
        faviconUrl: faviconUrl.trim() === '' ? null : faviconUrl.trim(),
        tagline: tagline.trim() === '' ? null : tagline.trim(),
      }}
      description="Brand identity for your storefront header, email receipts, and browser tab. The template you pick in the builder owns the palette and section rhythm."
    >
      <Field
        label="Logo"
        hint="PNG, JPG, WEBP, or SVG. Drop it on the box, or click to browse. Shows on your storefront header and email receipts."
      >
        <AdminUploadField
          value={logoUrl}
          onChange={setLogoUrl}
          namespace={`logos/${slug}`}
          ariaLabel="Upload your logo"
          helper={
            logoUrl
              ? 'Replace to change. PNG · JPG · WEBP · SVG · up to 50 MB'
              : 'Drop a logo here — PNG, JPG, WEBP or SVG, up to 50 MB.'
          }
        />
        <UploadedFileMeta url={logoUrl || null} />
      </Field>

      <Field
        label="Favicon"
        hint="The small icon shown in browser tabs and PWA install banners. ICO, PNG or SVG, up to 1 MB."
      >
        <AdminUploadField
          value={faviconUrl}
          onChange={setFaviconUrl}
          namespace={`favicons/${slug}`}
          accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
          ariaLabel="Upload your favicon"
          helper={faviconUrl ? 'Replace to change. ICO · PNG · SVG · up to 1 MB' : 'Drop a 32×32 ICO, PNG, or SVG.'}
          maxSize={1_048_576}
        />
        <UploadedFileMeta url={faviconUrl || null} />
      </Field>

      <Field
        label="Tagline"
        hint="One short line shown under the business name on the storefront header and brand preview. Keep it under 140 characters."
      >
        <input
          type="text"
          maxLength={140}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Slow-cooked, served family-style."
          style={inputStyle}
        />
      </Field>

      <Field label="Active template" hint="Swap templates from the storefront builder.">
        <input
          readOnly
          value={initial.templateId}
          style={{
            ...inputStyle,
            color: 'var(--ink-muted)',
            background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
          }}
        />
      </Field>
    </SettingsForm>
  );
}
