'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  THEMES,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Theme,
  isTheme,
} from '@/lib/theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  return isTheme(attr) ? attr : 'light';
}

/**
 * Provides the active theme to client components and exposes a setter
 * that writes the cookie + flips the `<html data-theme>` attribute.
 *
 * The initial value is read from the document, which the inline
 * `THEME_INIT_SCRIPT` has already populated by the time React hydrates,
 * so this provider never causes a flash.
 */
export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? 'light');

  useEffect(() => {
    setThemeState(readDocumentTheme());
  }, []);

  // Other tabs may have flipped the theme. Sync via the storage event
  // (broadcast key written by `setTheme` below).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'souqna-theme-bcast' && isTheme(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    if (!THEMES.includes(next)) return;
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
    try {
      window.localStorage.setItem('souqna-theme-bcast', next);
    } catch {
      /* storage may be denied in private mode */
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}

/**
 * Hook variant that doesn't throw — useful for components that may be
 * mounted outside a provider (e.g. legacy code, tests).
 */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
