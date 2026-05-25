'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { souqyKickoffFromHomepagePrompt } from '@/app/actions/souqy';
import type { Locale } from '@/i18n/locales';

const PENDING_HOME_SOUQY = 'souqna_pending_homepage_souqy';

const placeholders = [
  'A modern Qatari abaya boutique with WhatsApp checkout…',
  'A minimalist coffee roastery with subscription pricing…',
  'A luxury perfume house with bilingual storefront…',
  'A streetwear drop shop with Instagram catalog sync…',
];

type PendingPayload = { prompt: string; locale: Locale };

function readPending(): PendingPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_HOME_SOUQY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPayload;
  } catch {
    sessionStorage.removeItem(PENDING_HOME_SOUQY);
    return null;
  }
}

export function HeroPromptBar({ locale }: { locale: Locale }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const pending = readPending();
    if (!pending) return;
    const payload = pending;

    let cancelled = false;
    async function flush() {
      setBusy(true);
      setError(null);
      sessionStorage.removeItem(PENDING_HOME_SOUQY);
      try {
        const result = await souqyKickoffFromHomepagePrompt({
          prompt: payload.prompt,
          locale: payload.locale,
        });
        if (cancelled) return;
        if (result.status === 'success') {
          window.location.href = `/account/builder?store=${encodeURIComponent(result.slug)}&generated=1`;
          return;
        }
        if (result.status === 'error') {
          setError(result.message);
        }
      } catch {
        if (!cancelled) setError('Something went wrong. Try again.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void flush();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  function rotatePlaceholder() {
    setPlaceholderIdx((i) => (i + 1) % placeholders.length);
  }

  async function runKickoff(trimmed: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await souqyKickoffFromHomepagePrompt({ prompt: trimmed, locale });
      if (result.status === 'success') {
        window.location.href = `/account/builder?store=${encodeURIComponent(result.slug)}&generated=1`;
        return;
      }
      if (result.status === 'error') {
        setError(result.message);
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 12) {
      setError('Tell us a bit more — at least 12 characters.');
      return;
    }

    if (!isLoaded) return;

    if (!isSignedIn) {
      const payload: PendingPayload = { prompt: trimmed, locale };
      sessionStorage.setItem(PENDING_HOME_SOUQY, JSON.stringify(payload));
      const returnTo =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
      return;
    }

    await runKickoff(trimmed);
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={handleSubmit}
      className="group relative w-full max-w-xl"
    >
      {error ? (
        <p className="mb-3 text-start text-xs text-red-600 dark:text-red-400 sm:text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[2rem] opacity-70 blur-2xl transition duration-500 group-hover:opacity-100"
        style={
          {
            background:
              'conic-gradient(from var(--hero-prompt-angle), #8b3a3a, #c9a961, #5586bd, #8b3a3a)',
            animation:
              'hero-prompt-spin 7s linear infinite, hero-prompt-pulse 4s ease-in-out infinite',
            '--hero-prompt-angle': '0deg',
          } as CSSProperties
        }
      />

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-full p-[1.5px]"
        style={
          {
            background:
              'conic-gradient(from var(--hero-prompt-angle), rgba(139,58,58,0.95), rgba(201,169,97,0.95), rgba(85,134,189,0.95), rgba(139,58,58,0.95))',
            animation: 'hero-prompt-spin 7s linear infinite',
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            '--hero-prompt-angle': '0deg',
          } as CSSProperties
        }
      />

      <div className="relative flex items-center gap-2 rounded-full bg-white/85 px-2 py-2 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:bg-black/55 dark:shadow-[0_18px_50px_-18px_rgba(0,0,0,0.6)]">
        <Sparkles
          aria-hidden
          className="ml-3 h-4 w-4 shrink-0 text-black/55 transition group-focus-within:text-black dark:text-white/55 dark:group-focus-within:text-white sm:h-5 sm:w-5"
          strokeWidth={1.8}
        />
        <input
          aria-label="Describe your storefront"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={rotatePlaceholder}
          placeholder={placeholders[placeholderIdx]}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm tracking-tight text-black placeholder:text-black/45 outline-none dark:text-white dark:placeholder:text-white/45 sm:text-base"
          type="text"
          name="prompt"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          aria-label="Generate website"
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-black text-white transition hover:scale-105 hover:bg-neutral-800 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200 sm:h-11 sm:w-11"
        >
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
        </button>
      </div>
    </motion.form>
  );
}
