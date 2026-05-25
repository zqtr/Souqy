'use client';

import { useEffect, type ComponentProps } from 'react';
import { HomeLanding } from '@/components/sections/home/HomeLanding';

type Props = ComponentProps<typeof HomeLanding>;

export function HomePageClient(props: Props) {
  useEffect(() => {
    if (!window.location.hash) return;

    const target = document.querySelector(window.location.hash);
    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <HomeLanding {...props} />
    </div>
  );
}
