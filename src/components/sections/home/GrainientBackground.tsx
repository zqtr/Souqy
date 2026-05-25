'use client';

import { useEffect, useState } from 'react';
import Watercolor from '@/components/blocks/watercolor';
import { type Theme, isTheme } from '@/lib/theme';

function getDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const theme = document.documentElement.getAttribute('data-theme');
  return isTheme(theme) ? theme : 'light';
}

export function GrainientBackground() {
  const [theme, setTheme] = useState<Theme>('light');
  const dark = theme === 'dark';

  useEffect(() => {
    setTheme(getDocumentTheme());

    const syncTheme = () => setTheme(getDocumentTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'souqna-theme-bcast' && isTheme(event.newValue)) {
        setTheme(event.newValue);
      }
    };
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (isTheme(next)) setTheme(next);
    };
    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributeFilter: ['data-theme'],
      attributes: true,
    });
    window.addEventListener('storage', onStorage);
    window.addEventListener('souqna-theme-change', onThemeChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('souqna-theme-change', onThemeChange);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-white dark:bg-black"
    >
      <Watercolor
        brightness={0.15}
        className="absolute inset-0"
        color1={dark ? '#AA7942' : '#5586BD'}
        color2={dark ? '#000000' : '#FFFFFF'}
        colorGain={1}
        dpr={1}
        driftSpeed={0.04}
        height="100%"
        lacunarity={2.5}
        octaves={3}
        opacity={0.55}
        persistence={0.85}
        saturation={0.75}
        scale={0.6}
        speed={0.6}
        warpSpeed={0.08}
        width="100%"
      />
    </div>
  );
}
