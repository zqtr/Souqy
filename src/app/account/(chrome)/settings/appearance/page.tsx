import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { PageHeader, Surface } from '@/components/admin/primitives';
import {
  ADMIN_ACCENTS,
  ADMIN_ACCENT_COOKIE,
  ADMIN_ACCENT_PRESETS,
  type AdminAccent,
} from '@/lib/adminAccent';

async function setAccent(formData: FormData) {
  'use server';
  const raw = formData.get('accent');
  const accent = typeof raw === 'string' ? raw : '';
  if (!ADMIN_ACCENTS.includes(accent as AdminAccent)) return;
  const store = await cookies();
  store.set(ADMIN_ACCENT_COOKIE, accent, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/account', 'layout');
}

export default async function AppearanceSettingsPage() {
  const store = await cookies();
  const cookieAccent = store.get(ADMIN_ACCENT_COOKIE)?.value;
  const current: AdminAccent =
    cookieAccent && ADMIN_ACCENTS.includes(cookieAccent as AdminAccent)
      ? (cookieAccent as AdminAccent)
      : 'mono';

  return (
    <>
      <PageHeader
        eyebrow="Settings · Appearance"
        arEyebrow="الإعدادات · المظهر"
        title="Dashboard appearance"
        arTitle="مظهر لوحة التحكم"
        subtitle="Pick the accent color used across the admin sidebar, eyebrows, and badges. The marketing storefront keeps its own brand palette."
        arSubtitle="اختر لون التمييز المستخدم في الشريط الجانبي والعناوين والشارات. لون متجرك العام لا يتغير."
      />

      <Surface padding={20}>
        <form action={setAccent}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {ADMIN_ACCENT_PRESETS.map((preset) => {
              const active = preset.id === current;
              return (
                <label
                  key={preset.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: 14,
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: active
                      ? 'color-mix(in srgb, var(--admin-accent) 10%, var(--surface-bg))'
                      : 'color-mix(in srgb, var(--ink-strong) 3%, var(--surface-bg))',
                    border: active
                      ? '1.5px solid var(--admin-accent)'
                      : '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
                    transition: 'border-color 120ms ease, background 120ms ease',
                  }}
                >
                  <input
                    type="radio"
                    name="accent"
                    value={preset.id}
                    defaultChecked={active}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: `linear-gradient(135deg, ${preset.swatchLight} 0 50%, ${preset.swatchDark} 50% 100%)`,
                        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink-strong) 12%, transparent)',
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-serif, var(--font-sans))',
                          fontSize: 15,
                          fontWeight: 500,
                          color: 'var(--ink-strong)',
                          lineHeight: 1.2,
                        }}
                      >
                        {preset.label}
                      </span>
                      <span
                        lang="ar"
                        dir="rtl"
                        style={{
                          fontFamily: 'var(--font-arabic, var(--font-sans))',
                          fontSize: 12,
                          color: 'var(--ink-muted)',
                          lineHeight: 1.4,
                        }}
                      >
                        {preset.arLabel}
                      </span>
                    </div>
                    {active ? (
                      <span
                        style={{
                          marginInlineStart: 'auto',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-muted)',
                        }}
                      >
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      color: 'var(--ink-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    {preset.blurb}
                  </p>
                </label>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--ink-muted)',
                maxWidth: 480,
              }}
            >
              Saved per-browser. Switching does not affect your published storefront.
            </p>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 18px',
                borderRadius: 8,
                background: 'var(--ink-strong)',
                color: 'var(--surface-bg)',
                fontSize: 13.5,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save accent
            </button>
          </div>
        </form>
      </Surface>
    </>
  );
}
