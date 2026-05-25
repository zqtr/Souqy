'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CATEGORIES, type Category } from '@/lib/apps/souqnasource/types';

export function CategoryTree({
  current,
}: {
  current: Category;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations('apps.souqnasource.categories');
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {CATEGORIES.map((c) => {
        const active = c === current;
        return (
          <li key={c}>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(sp.toString());
                next.set('tab', 'browse');
                next.set('category', c);
                router.push(`?${next.toString()}`);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'start',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: 13,
                background: active
                  ? 'color-mix(in srgb, var(--ink-strong) 8%, transparent)'
                  : 'transparent',
                color: active ? 'var(--ink-strong)' : 'var(--ink-muted)',
                fontWeight: active ? 500 : 400,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 120ms ease, color 120ms ease',
              }}
            >
              {t(c)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
