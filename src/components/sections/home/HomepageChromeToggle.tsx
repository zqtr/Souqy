'use client';

import { useEffect } from 'react';

export function HomepageChromeToggle() {
  useEffect(() => {
    document.body.classList.add('homepage-blank');

    return () => {
      document.body.classList.remove('homepage-blank');
    };
  }, []);

  return null;
}
