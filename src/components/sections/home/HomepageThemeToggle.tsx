'use client';

import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme, isTheme } from '@/lib/theme';

function getDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const theme = document.documentElement.getAttribute('data-theme');
  return isTheme(theme) ? theme : 'light';
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    window.localStorage.setItem('souqna-theme-bcast', next);
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new CustomEvent('souqna-theme-change', { detail: next }));
}

export function HomepageThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [redirectPath, setRedirectPath] = useState('/');
  const dark = theme === 'dark';
  const nextTheme = dark ? 'light' : 'dark';

  useEffect(() => {
    setTheme(getDocumentTheme());
    setRedirectPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, []);

  const toggle = useCallback(() => {
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, [nextTheme]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      toggle();
    },
    [toggle],
  );

  return (
    <a
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      href={`/api/theme?theme=${nextTheme}&redirect=${encodeURIComponent(redirectPath)}`}
      onClick={handleClick}
      className="fixed right-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-full border border-black/12 bg-white/62 text-black shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-xl transition duration-300 hover:scale-105 hover:border-black/22 hover:bg-white/78 dark:border-white/16 dark:bg-black/48 dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.38)] dark:hover:border-white/28 dark:hover:bg-black/62 sm:right-6 sm:top-6"
    >
      {dark ? (
        <Sun className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      )}
    </a>
  );
}
