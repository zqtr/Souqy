'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import SplitText from '@/components/react-bits/split-text';
import type { Locale } from '@/i18n/locales';

type Auth3Props = {
  mode: 'sign-in' | 'sign-up';
  locale: Locale;
  children: ReactNode;
};

const StarSwipe = dynamic(() => import('@/components/star-swipe'), { ssr: false });

const copy = {
  en: {
    'sign-in': {
      title: 'Sign in',
      prompt: 'New user?',
      linkLabel: 'Create an account',
      linkHref: '/sign-up',
      brand: 'Ready to start your business?',
      body: 'Join the founders turning Gulf ambition into thriving storefronts — from Riyadh and Jeddah to Dubai, Doha, Manama, Kuwait City, and Muscat. Your next chapter starts here.',
      help: "Can't sign in?",
      helpLabel: 'Get help',
    },
    'sign-up': {
      title: 'Create account',
      prompt: 'Already have an account?',
      linkLabel: 'Sign in',
      linkHref: '/sign-in',
      brand: 'Ready to start your business?',
      body: 'Build the next great GCC brand. Add your phone number during sign-up so Souqna can welcome you, alert you about orders, and remind you to keep your store fresh.',
      help: 'Need help?',
      helpLabel: 'Contact support',
    },
  },
  ar: {
    'sign-in': {
      title: 'تسجيل الدخول',
      prompt: 'مستخدم جديد؟',
      linkLabel: 'أنشئ حساباً',
      linkHref: '/sign-up',
      brand: 'هل أنت مستعد لبدء مشروعك؟',
      body: 'انضم إلى رواد الأعمال الذين يحولون الطموح الخليجي إلى متاجر مزدهرة — من الرياض وجدة إلى دبي والدوحة والمنامة والكويت ومسقط. فصلك القادم يبدأ من هنا.',
      help: 'لا تستطيع الدخول؟',
      helpLabel: 'احصل على مساعدة',
    },
    'sign-up': {
      title: 'إنشاء حساب',
      prompt: 'لديك حساب؟',
      linkLabel: 'تسجيل الدخول',
      linkHref: '/sign-in',
      brand: 'هل أنت مستعد لبدء مشروعك؟',
      body: 'ابنِ علامتك الخليجية القادمة. أضف رقم هاتفك أثناء التسجيل ليصلك ترحيب سوقنا وتنبيهات الطلبات وتذكيرات تحديث المتجر.',
      help: 'تحتاج مساعدة؟',
      helpLabel: 'تواصل معنا',
    },
  },
} as const;

export function Auth3({ mode, locale, children }: Auth3Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRtl = locale === 'ar';
  const t = copy[locale][mode];

  const shellBg = isDark ? '#050505' : '#E8DCC4';
  const shellText = isDark ? '#FFF8EF' : '#1F1B16';
  const cardBg = isDark ? 'rgba(17, 17, 17, 0.93)' : 'rgba(241, 233, 215, 0.94)';
  const cardBorder = isDark ? 'rgba(255, 190, 138, 0.2)' : 'rgba(31, 27, 22, 0.14)';
  const mutedText = isDark ? 'rgba(255, 248, 239, 0.68)' : 'rgba(31, 27, 22, 0.62)';
  const overlay = isDark
    ? 'radial-gradient(circle at 18% 16%, rgba(255, 190, 138, 0.28), transparent 34%), radial-gradient(circle at 82% 78%, rgba(255, 190, 138, 0.16), transparent 38%), linear-gradient(120deg, rgba(0, 0, 0, 0.84), rgba(0, 0, 0, 0.34) 52%, rgba(0, 0, 0, 0.78))'
    : 'radial-gradient(circle at 16% 16%, rgba(255, 190, 138, 0.52), transparent 34%), radial-gradient(circle at 80% 78%, rgba(139, 58, 58, 0.14), transparent 38%), linear-gradient(120deg, rgba(232, 220, 196, 0.76), rgba(241, 233, 215, 0.2) 52%, rgba(232, 220, 196, 0.68))';

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={locale}
      className="auth3-shell relative min-h-dvh overflow-hidden"
      style={{
        background: shellBg,
        color: shellText,
        fontFamily: isRtl
          ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
          : 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <StarSwipe
        className="absolute inset-0 h-full w-full"
        color="#ffbe8a"
        backgroundColor={shellBg}
        speed={0.22}
        scale={1.18}
        warpStrength={1.35}
        warpCurvature={5.8}
        warpFalloff={4}
        scrollSpeed={5.2}
        noiseAmount={0.38}
        colorIntensity={isDark ? 0.46 : 0.28}
        colorSeparation={0.045}
        rotation={isRtl ? 42 : -42}
        opacity={isDark ? 1 : 0.82}
      />
      <div className="absolute inset-0" style={{ background: overlay }} aria-hidden />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-[780px] items-center gap-9 md:grid-cols-[336px_minmax(0,250px)]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="auth3-card w-full rounded-[10px] p-6 shadow-2xl"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              color: shellText,
              boxShadow: isDark
                ? '0 26px 70px rgba(0, 0, 0, 0.58)'
                : '0 26px 70px rgba(31, 27, 22, 0.16)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <SplitText
              tag="h1"
              text={t.title}
              delay={isRtl ? 70 : 28}
              duration={0.58}
              ease="power3.out"
              splitType={isRtl ? 'words' : 'chars'}
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.05}
              rootMargin="0px"
              textAlign={isRtl ? 'right' : 'left'}
              className="m-0 text-[24px] font-bold leading-none tracking-normal"
              style={{
                color: shellText,
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
                  : 'var(--font-english), ui-sans-serif, system-ui, sans-serif',
              }}
            />
            <p className="mt-2 text-[12px] leading-5" style={{ color: mutedText }}>
              {t.prompt}{' '}
              <Link href={t.linkHref} className="auth3-link font-semibold no-underline">
                {t.linkLabel}
              </Link>
            </p>

            <div className="auth3-clerk-frame mt-6">{children}</div>

            <p className="mt-5 text-center text-[12px] leading-5" style={{ color: mutedText }}>
              {t.help}{' '}
              <a href="mailto:support@souqna.qa" className="auth3-link font-semibold no-underline">
                {t.helpLabel}
              </a>
            </p>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: isRtl ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="auth3-sidecopy hidden md:block"
          >
            <SplitText
              tag="h2"
              text={t.brand}
              delay={isRtl ? 72 : 34}
              duration={0.68}
              ease="power3.out"
              splitType={isRtl ? 'words' : 'chars'}
              from={{ opacity: 0, y: 26 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.05}
              rootMargin="0px"
              textAlign={isRtl ? 'right' : 'left'}
              className="m-0 text-[26px] font-semibold leading-tight tracking-normal"
              style={{
                color: shellText,
                fontFamily: isRtl
                  ? 'var(--font-arabic), var(--font-sans), system-ui, sans-serif'
                  : 'var(--font-english), ui-sans-serif, system-ui, sans-serif',
              }}
            />
            <p className="mt-3 max-w-[25ch] text-[14px] leading-6" style={{ color: mutedText }}>
              {t.body}
            </p>
          </motion.aside>
        </div>
      </div>

      <style jsx global>{`
        .auth3-shell .auth3-link {
          color: var(--auth3-link, #ffbe8a);
          transition: color 160ms ease, opacity 160ms ease;
        }

        html[data-theme='light'] .auth3-shell .auth3-link {
          --auth3-link: #6a2a2a;
        }

        .auth3-shell .auth3-link:hover {
          opacity: 0.78;
        }

        .auth3-clerk-frame,
        .auth3-clerk-frame * {
          font-family: inherit !important;
          letter-spacing: 0 !important;
        }

        .auth3-clerk-frame .cl-rootBox,
        .auth3-clerk-frame .cl-cardBox,
        .auth3-clerk-frame .cl-card,
        .auth3-clerk-frame .cl-main {
          width: 100% !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .auth3-clerk-frame .cl-header,
        .auth3-clerk-frame .cl-logoBox,
        .auth3-clerk-frame .cl-footer,
        .auth3-clerk-frame .cl-footerAction,
        .auth3-clerk-frame .cl-footerPages,
        .auth3-clerk-frame .cl-internal-b3fm6y,
        .auth3-clerk-frame .cl-formHeader,
        .auth3-clerk-frame .cl-badge {
          display: none !important;
        }

        .auth3-clerk-frame .cl-form,
        .auth3-clerk-frame .cl-formFields {
          gap: 0.75rem !important;
        }

        .auth3-clerk-frame .cl-socialButtons,
        .auth3-clerk-frame .cl-socialButtonsBlockButtonGroup {
          gap: 0.625rem !important;
        }

        .auth3-clerk-frame .cl-socialButtonsBlockButton {
          min-height: 36px !important;
          border-radius: 8px !important;
          border: 1px solid rgba(255, 190, 138, 0.22) !important;
          background: #24201d !important;
          color: #fff8ef !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        .auth3-clerk-frame .cl-socialButtonsBlockButton:hover {
          background: #2d2824 !important;
          border-color: rgba(255, 190, 138, 0.36) !important;
        }

        .auth3-clerk-frame .cl-formFieldLabel {
          display: none !important;
        }

        .auth3-clerk-frame .cl-formFieldInput {
          height: 38px !important;
          border-radius: 9px !important;
          border: 1px solid rgba(255, 190, 138, 0.24) !important;
          background: #111111 !important;
          color: #fff8ef !important;
          font-size: 12px !important;
          box-shadow: none !important;
        }

        .auth3-clerk-frame .cl-formFieldInput:focus {
          border-color: #ffbe8a !important;
          box-shadow: 0 0 0 3px rgba(255, 190, 138, 0.16) !important;
        }

        .auth3-clerk-frame .cl-formFieldInput::placeholder {
          color: rgba(255, 248, 239, 0.58) !important;
        }

        .auth3-clerk-frame .cl-formButtonPrimary {
          min-height: 36px !important;
          border-radius: 8px !important;
          background: #ffbe8a !important;
          color: #15110d !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          box-shadow: none !important;
        }

        .auth3-clerk-frame .cl-formButtonPrimary:hover {
          background: #ffd0aa !important;
        }

        .auth3-clerk-frame .cl-dividerLine {
          background: rgba(255, 190, 138, 0.2) !important;
        }

        .auth3-clerk-frame .cl-dividerText {
          color: rgba(255, 248, 239, 0.48) !important;
          font-size: 12px !important;
          text-transform: none !important;
        }

        .auth3-clerk-frame .cl-formFieldErrorText,
        .auth3-clerk-frame .cl-alertText {
          color: #ffbe8a !important;
          font-size: 12px !important;
        }

        .auth3-clerk-frame .cl-formFieldInputShowPasswordButton {
          color: rgba(255, 248, 239, 0.7) !important;
        }

        .auth3-clerk-frame .cl-identityPreview,
        .auth3-clerk-frame .cl-otpCodeFieldInput {
          background: #1c1815 !important;
          border-color: rgba(255, 190, 138, 0.22) !important;
          color: #fff8ef !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-socialButtonsBlockButton {
          border-color: rgba(31, 27, 22, 0.14) !important;
          background: rgba(255, 255, 255, 0.5) !important;
          color: #1f1b16 !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-socialButtonsBlockButton:hover {
          background: rgba(255, 255, 255, 0.68) !important;
          border-color: rgba(31, 27, 22, 0.22) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formFieldInput {
          border-color: rgba(31, 27, 22, 0.18) !important;
          background: rgba(255, 255, 255, 0.56) !important;
          color: #1f1b16 !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formFieldInput:focus {
          border-color: #8b3a3a !important;
          box-shadow: 0 0 0 3px rgba(255, 190, 138, 0.38) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formFieldInput::placeholder {
          color: rgba(31, 27, 22, 0.54) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formButtonPrimary {
          background: #1f1b16 !important;
          color: #f1e9d7 !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formButtonPrimary:hover {
          background: #2a2a2a !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-dividerLine {
          background: rgba(31, 27, 22, 0.16) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-dividerText {
          color: rgba(31, 27, 22, 0.48) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formFieldErrorText,
        html[data-theme='light'] .auth3-clerk-frame .cl-alertText {
          color: #8b3a3a !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-formFieldInputShowPasswordButton {
          color: rgba(31, 27, 22, 0.62) !important;
        }

        html[data-theme='light'] .auth3-clerk-frame .cl-identityPreview,
        html[data-theme='light'] .auth3-clerk-frame .cl-otpCodeFieldInput {
          background: rgba(255, 255, 255, 0.5) !important;
          border-color: rgba(31, 27, 22, 0.16) !important;
          color: #1f1b16 !important;
        }

        html[dir='rtl'] .auth3-clerk-frame .cl-formFieldInput,
        html[dir='rtl'] .auth3-clerk-frame .cl-socialButtonsBlockButton,
        html[dir='rtl'] .auth3-clerk-frame .cl-formButtonPrimary {
          font-family: var(--font-arabic), var(--font-sans), system-ui, sans-serif !important;
        }

        html[dir='rtl'] .auth3-clerk-frame .cl-formFieldInput {
          direction: rtl !important;
          text-align: right !important;
        }

        html[dir='rtl'] .auth3-clerk-frame .cl-formFieldInput[name='password'] {
          padding-right: 12px !important;
          padding-left: 42px !important;
        }

        html[dir='rtl'] .auth3-clerk-frame .cl-formFieldInputShowPasswordButton {
          right: auto !important;
          left: 10px !important;
        }
      `}</style>
    </main>
  );
}

export default Auth3;
