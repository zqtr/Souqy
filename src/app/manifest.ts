import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Souqna - bilingual commerce workspace',
    short_name: 'Souqna',
    description:
      'Souqna is a bilingual commerce workspace for launching and operating modern Gulf storefronts.',
    start_url: '/',
    display: 'standalone',
    background_color: '#E8DCC4',
    theme_color: '#E8DCC4',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
