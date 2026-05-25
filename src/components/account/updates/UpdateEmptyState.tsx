'use client';

export function UpdateEmptyState({ locale = 'en' }: { locale?: 'en' | 'ar' }) {
  return (
    <div className="rounded-lg border border-[#29252a] bg-[#141316] px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
      <div className="mx-auto mb-4 h-2 w-16 rounded-full bg-[#5f7cff]" />
      <h2 className="text-xl font-semibold text-[#f8efdf]">
        {locale === 'ar' ? 'أنت مطّلع على كل التحديثات.' : 'You’re all caught up.'}
      </h2>
    </div>
  );
}
