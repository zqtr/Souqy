'use client';

type UpdateProgressProps = {
  index: number;
  total: number;
  locale?: 'en' | 'ar';
};

export function UpdateProgress({ index, total, locale = 'en' }: UpdateProgressProps) {
  const safeTotal = Math.max(total, 1);
  const safeIndex = Math.min(Math.max(index, 0), safeTotal - 1);
  const format = new Intl.NumberFormat(locale === 'ar' ? 'ar-QA' : 'en');
  const label =
    locale === 'ar'
      ? `${format.format(safeIndex + 1)} من ${format.format(safeTotal)}`
      : `${format.format(safeIndex + 1)} of ${format.format(safeTotal)}`;

  return (
    <div className="flex flex-col items-center gap-3 text-xs text-[#8f8790]">
      <span className="font-medium">
        {label}
      </span>
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {Array.from({ length: safeTotal }).map((_, itemIndex) => (
          <span
            key={itemIndex}
            className={
              itemIndex === safeIndex
                ? 'h-2 w-2 rounded-full bg-[#5f7cff]'
                : 'h-2 w-2 rounded-full bg-[#3a3540]'
            }
          />
        ))}
      </div>
    </div>
  );
}
