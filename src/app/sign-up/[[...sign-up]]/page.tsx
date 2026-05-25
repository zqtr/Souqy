import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SignUp } from '@clerk/nextjs';
import { Auth3 } from '@/components/auth-3';
import { souqnaClerkAppearance } from '@/components/blocks/auth-clerk-appearance';
import { defaultLocale, isLocale } from '@/i18n/locales';

export const metadata: Metadata = {
  title: 'Create account · Souqna',
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return (
    <Auth3 mode="sign-up" locale={locale}>
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/account"
        appearance={souqnaClerkAppearance}
        unsafeMetadata={{
          notificationConsent: true,
          notificationChannels: ['bell', 'mobile', 'phone'],
          phoneRequiredReason: 'whatsapp_notifications',
        }}
      />
    </Auth3>
  );
}
