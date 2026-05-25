import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { ArchMark } from '@/components/primitives/ArchMark';
import { SouqnaLockup } from '@/components/primitives/SouqnaLockup';

type Auth2Props = {
  mode: 'sign-in' | 'sign-up';
  children: ReactNode;
};

const content = {
  'sign-in': {
    eyebrow: 'Welcome back',
    eyebrowAr: 'حياك الله مرة ثانية',
    title: 'Return to your storefront studio.',
    titleAr: 'ارجع لاستوديو متجرك.',
    intro:
      'Pick up orders, products, Souqy drafts, and storefront edits from one calm founder workspace.',
    ctaLabel: 'New to Souqna?',
    ctaHref: '/sign-up',
    ctaText: 'Create account',
    formTitle: 'Sign in',
    formKicker: 'Secure founder access',
  },
  'sign-up': {
    eyebrow: 'Open your atelier account',
    eyebrowAr: 'افتح حسابك في سوقنا',
    title: 'Build a store that feels made for your market.',
    titleAr: 'ابن متجرك بروح سوقك.',
    intro:
      'Start with Souqna, shape the storefront in the builder, then let Souqy help you launch faster.',
    ctaLabel: 'Already have an account?',
    ctaHref: '/sign-in',
    ctaText: 'Sign in',
    formTitle: 'Create account',
    formKicker: 'Start your Souqna workspace',
  },
} as const;

const proof = ['Bilingual storefronts', 'Souqy AI builder', 'Orders and apps ready'];

export function Auth2({ mode, children }: Auth2Props) {
  const copy = content[mode];

  return (
    <main className="min-h-dvh w-full bg-[color:var(--surface-bg)] text-[color:var(--ink-strong)]">
      <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1.06fr)_minmax(420px,0.94fr)]">
        <section className="hidden min-h-dvh p-4 lg:block">
          <div className="relative flex h-full min-h-[calc(100dvh-32px)] overflow-hidden rounded-md bg-[color:var(--surface-contrast)] p-10 text-[color:var(--ink-on-contrast)]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--color-gold) 24%, transparent), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--color-maroon) 70%, var(--surface-contrast)) 0%, var(--surface-contrast) 54%, color-mix(in srgb, var(--color-gold) 18%, var(--surface-contrast)) 100%)',
              }}
            />
            <div
              className="absolute inset-y-8 end-[-12%] w-[62%] rounded-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 36%, transparent)' }}
              aria-hidden
            />
            <div
              className="absolute bottom-[-18%] end-[10%] h-[58%] w-[38%] rounded-t-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 44%, transparent)' }}
              aria-hidden
            />
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'linear-gradient(var(--surface-rule) 1px, transparent 1px), linear-gradient(90deg, var(--surface-rule) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
              aria-hidden
            />

            <div className="relative z-10 flex w-full flex-col justify-between">
              <div className="flex items-center justify-between gap-6">
                <Link href="/" className="text-[color:var(--ink-on-contrast)] no-underline">
                  <SouqnaLockup height={42} ariaLabel="Souqna" />
                </Link>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-md border"
                  style={{
                    background: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-gold) 42%, transparent)',
                  }}
                >
                  <ArchMark size={28} stroke="var(--color-gold)" />
                </div>
              </div>

              <div className="max-w-[680px] space-y-8 pb-6">
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase text-[color:var(--color-gold)]">
                  <span>{copy.eyebrow}</span>
                  <span aria-hidden className="opacity-50">
                    /
                  </span>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="normal-case"
                    style={{ fontFamily: 'var(--font-arabic)' }}
                  >
                    {copy.eyebrowAr}
                  </span>
                </div>

                <div className="space-y-5">
                  <h1 className="max-w-[12ch] font-sans text-[clamp(48px,7vw,92px)] font-semibold leading-[0.9] tracking-normal">
                    {copy.title}
                  </h1>
                  <p
                    lang="ar"
                    dir="rtl"
                    className="max-w-[16ch] text-[clamp(30px,4vw,54px)] leading-tight"
                    style={{
                      color: 'color-mix(in srgb, var(--color-gold) 76%, var(--ink-on-contrast))',
                      fontFamily: 'var(--font-arabic-serif)',
                    }}
                  >
                    {copy.titleAr}
                  </p>
                </div>

                <div
                  className="grid max-w-[680px] gap-6 border-t pt-6 md:grid-cols-[1fr_auto]"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--ink-on-contrast) 18%, transparent)',
                  }}
                >
                  <p className="max-w-[42rem] text-base leading-7 text-[color:var(--ink-on-contrast-muted)]">
                    {copy.intro}
                  </p>
                  <div className="space-y-2">
                    {proof.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-gold)] text-[color:var(--ink-on-gold)]">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-dvh items-center justify-center px-5 py-20 sm:px-8 lg:px-12">
          <div className="absolute start-5 top-5 z-10 lg:hidden">
            <Link href="/" className="text-[color:var(--ink-strong)] no-underline">
              <SouqnaLockup height={34} ariaLabel="Souqna" />
            </Link>
          </div>

          <div className="w-full max-w-[440px]">
            <div className="mb-7 space-y-3">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-[color:var(--color-gold-deep)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span>{copy.formKicker}</span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-4xl font-semibold tracking-normal text-[color:var(--ink-strong)]">
                  {copy.formTitle}
                </h2>
                <Link
                  href={copy.ctaHref}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--accent)] no-underline transition-colors hover:text-[color:var(--accent-strong)]"
                >
                  {copy.ctaText}
                  <ArrowUpRight className="h-4 w-4 rtl-flip-arrow" aria-hidden />
                </Link>
              </div>
              <p className="text-sm text-[color:var(--ink-muted)]">
                {copy.ctaLabel} Use secure email or social sign-on to continue.
              </p>
            </div>

            <div className="souqna-clerk-auth">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Auth2;
