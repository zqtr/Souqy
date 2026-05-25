'use client';

import { useEffect, useState } from 'react';
import { InquireDialog } from './InquireDialog';

/**
 * Floating Inquire CTA pinned to the bottom-end of every storefront.
 * Hides for the first 30vh of scroll so it doesn't compete with the
 * hero, fades in after that. Clicking opens the same `InquireDialog`
 * the per-product Inquire button uses, with no product context (a
 * "general question" inquiry).
 */
export function FloatingInquireButton({
  storefrontSlug,
  locale,
  whatsappPhone,
  businessName,
}: {
  storefrontSlug: string;
  locale: 'en' | 'ar';
  whatsappPhone?: string | null;
  businessName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.3);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        insetInlineEnd: 20,
        zIndex: 60,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {whatsappPhone ? (
        <a
          href={`https://wa.me/${whatsappPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
            locale === 'ar'
              ? `مرحباً، شفت متجر ${businessName ?? storefrontSlug} على سوقنا وأرغب بالتواصل.`
              : `Hi, I came across ${businessName ?? storefrontSlug} on Souqna and would like to get in touch.`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '9px 16px',
            borderRadius: 999,
            background: 'var(--storefront-ink, #1f1b16)',
            color: 'var(--storefront-ground, #f1e9d7)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {locale === 'ar' ? 'واتساب' : 'WhatsApp'}
        </a>
      ) : (
        <InquireDialog
          storefrontSlug={storefrontSlug}
          triggerLabel={locale === 'ar' ? 'تواصل معنا' : 'Contact us'}
        />
      )}
    </div>
  );
}
