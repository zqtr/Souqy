'use client';
import { useTranslations } from 'next-intl';

export function ProductsSourceBadge({
  source,
  drift,
  delisted,
}: {
  source: string;
  drift?: number | null;
  delisted?: boolean;
}) {
  const t = useTranslations('apps.souqnasource.badge');
  if (source !== 'souqnasource') return null;
  const tone = delisted
    ? 'bg-rose-100 text-rose-700'
    : drift && Math.abs(drift) >= 10
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${tone}`}>
      ◈ {t('via')}
      {drift && Math.abs(drift) >= 1 && ` · ${t('drift', { pct: Math.round(drift) })}`}
      {delisted && ` · ${t('delisted')}`}
    </span>
  );
}
