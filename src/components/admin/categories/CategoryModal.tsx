'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/admin/Modal';
import { AdminUploadField } from '@/components/admin/AdminUploadField';
import {
  createCategory,
  updateCategory,
  type CategoryActionState,
} from '@/app/actions/categories';
import type { Category } from '@/lib/categories';
import { slugify } from '@/lib/categories';

/**
 * Centered-modal editor for categories. Reused for both create and edit
 * — the host page passes `mode` and (for edit) the `initial` row.
 *
 * Slug is auto-suggested from the name but stays editable. The cover
 * image piggy-backs on the existing `<AdminUploadField>` so categories
 * inherit the same drag-and-drop UX as Brand → Logo.
 */
type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  storefrontSlug: string;
  storefrontName: string;
  initial?: Category;
  closeHref: string;
};

type FormState = {
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  imageUrl: string;
};

function defaultsFrom(initial?: Category): FormState {
  if (!initial) {
    return {
      name: '',
      slug: '',
      slugTouched: false,
      description: '',
      imageUrl: '',
    };
  }
  return {
    name: initial.name,
    slug: initial.slug,
    slugTouched: true,
    description: initial.description ?? '',
    imageUrl: initial.imageUrl ?? '',
  };
}

export function CategoryModal({
  open,
  mode,
  storefrontSlug,
  storefrontName,
  initial,
  closeHref,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultsFrom(initial));
  const [state, setState] = useState<CategoryActionState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  // Reset whenever the modal toggles or `initial` changes.
  useEffect(() => {
    if (open) setForm(defaultsFrom(initial));
  }, [open, initial]);

  function close() {
    router.replace(closeHref, { scroll: false });
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (state.status === 'error') setState({ status: 'idle' });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const payload = {
      storefrontSlug,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
    };
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCategory(payload)
          : await updateCategory({ ...payload, id: initial!.id });
      setState(result);
      if (result.status === 'success') {
        router.replace(closeHref, { scroll: false });
        router.refresh();
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      eyebrow={`${storefrontName} · ${mode === 'edit' ? 'Edit category' : 'New category'}`}
      title={mode === 'edit' && initial ? initial.name : 'Add a category'}
      subtitle={
        mode === 'edit'
          ? 'Renaming a category updates every product linked to it.'
          : 'Group related products so shoppers can browse them together.'
      }
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            style={ghostButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="category-form"
            disabled={pending || form.name.trim() === ''}
            style={{
              ...primaryButton,
              opacity: pending || form.name.trim() === '' ? 0.55 : 1,
              cursor:
                pending || form.name.trim() === '' ? 'default' : 'pointer',
            }}
          >
            {pending
              ? 'Saving…'
              : mode === 'create'
                ? 'Create category'
                : 'Save changes'}
          </button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={onSubmit}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <Field
          label="Category name"
          value={form.name}
          onChange={(v) => {
            update('name', v);
            // Auto-derive slug while the founder hasn't manually edited it.
            if (!form.slugTouched) update('slug', slugify(v));
          }}
          required
          placeholder="e.g. Saffron rice"
        />
        <Field
          label="URL slug"
          value={form.slug}
          onChange={(v) => {
            update('slug', v);
            update('slugTouched', true);
          }}
          placeholder="auto-generated from the name"
          helper="Used in storefront URLs. Lowercase letters, numbers, and hyphens only."
        />
        <TextArea
          label="Description (optional)"
          value={form.description}
          onChange={(v) => update('description', v)}
          placeholder="A short note shown on the storefront category page."
        />
        <div>
          <FormLabel>Cover image (optional)</FormLabel>
          <div style={{ marginTop: 8 }}>
            <AdminUploadField
              value={form.imageUrl}
              onChange={(v) => update('imageUrl', v)}
              namespace={`categories/${storefrontSlug}`}
              helper="PNG, JPG, WEBP or SVG up to 50 MB. Used as the category card hero."
            />
          </div>
        </div>
        {state.status === 'error' ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#f1b1a1',
              letterSpacing: '0.03em',
            }}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--surface-rule-strong)',
          color: 'var(--ink-strong)',
          padding: '10px 0',
          marginTop: 8,
          fontFamily: 'var(--font-sans)',
          fontSize: 16,
          outline: 'none',
        }}
      />
      {helper ? (
        <p
          style={{
            margin: '6px 0 0',
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
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid var(--surface-rule-strong)',
          color: 'var(--ink-strong)',
          padding: '12px 14px',
          marginTop: 8,
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          lineHeight: 1.55,
          outline: 'none',
          borderRadius: 6,
          resize: 'vertical',
        }}
      />
    </div>
  );
}

const ghostButton: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid var(--surface-rule-strong)',
  background: 'transparent',
  color: 'var(--ink-strong)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};

const primaryButton: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--admin-accent)',
  color: 'var(--ink-on-gold)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};
