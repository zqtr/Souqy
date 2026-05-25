import localFont from 'next/font/local';
import { Inter, Inter_Tight, Instrument_Serif } from 'next/font/google';

/**
 * Inter — used inside the /account dashboard chrome only. Picked over
 * Exo 2 / Thmanyah Serif because the storefront-builder needs a denser,
 * more legible sans-serif for tables, forms, and small UI labels.
 */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const souqyStudioInterTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-studio-inter-tight',
  display: 'swap',
});

export const souqyStudioInstrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-studio-instrument-serif',
  display: 'swap',
});

export const thmanyahSans = localFont({
  src: [
    {
      path: '../assets/fonts/thmanyah/thmanyahsans/thmanyahsans-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahsans/thmanyahsans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahsans/thmanyahsans-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahsans/thmanyahsans-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahsans/thmanyahsans-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-thmanyah-sans',
  display: 'block',
  preload: true,
});

export const thmanyahSerifDisplay = localFont({
  src: [
    {
      path: '../assets/fonts/thmanyah/thmanyahserifdisplay/thmanyahserifdisplay-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahserifdisplay/thmanyahserifdisplay-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahserifdisplay/thmanyahserifdisplay-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahserifdisplay/thmanyahserifdisplay-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahserifdisplay/thmanyahserifdisplay-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-thmanyah-serif-display',
  display: 'block',
  preload: true,
});

export const thmanyahSerifText = localFont({
  src: [
    {
      path: '../assets/fonts/thmanyah/thmanyahseriftext/thmanyahseriftext-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahseriftext/thmanyahseriftext-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahseriftext/thmanyahseriftext-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahseriftext/thmanyahseriftext-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../assets/fonts/thmanyah/thmanyahseriftext/thmanyahseriftext-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-thmanyah-serif-text',
  display: 'block',
  preload: true,
});

export const jetBrainsMono = localFont({
  src: [
    {
      path: '../assets/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/jetbrains-mono/jetbrains-mono-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  display: 'block',
  preload: true,
});

export const exo2 = localFont({
  src: [
    {
      path: '../assets/fonts/exo2/exo-2-latin-100-normal.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-100-italic.woff2',
      weight: '100',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-300-normal.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-300-italic.woff2',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-500-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-700-italic.woff2',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-800-normal.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-800-italic.woff2',
      weight: '800',
      style: 'italic',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-900-normal.woff2',
      weight: '900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/exo2/exo-2-latin-900-italic.woff2',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-exo-2',
  display: 'block',
  preload: true,
});

export const fontVariables = [
  exo2.variable,
  thmanyahSans.variable,
  thmanyahSerifDisplay.variable,
  thmanyahSerifText.variable,
  jetBrainsMono.variable,
].join(' ');

/**
 * Same as `fontVariables` but adds Inter — used by the /account chrome
 * shell so the dashboard surfaces can override `--font-sans` /
 * `--font-serif` to Inter without affecting the marketing site.
 */
export const adminFontVariables = [
  exo2.variable,
  thmanyahSans.variable,
  thmanyahSerifDisplay.variable,
  thmanyahSerifText.variable,
  jetBrainsMono.variable,
  inter.variable,
].join(' ');

export const souqyStudioFontVariables = [
  souqyStudioInterTight.variable,
  souqyStudioInstrumentSerif.variable,
].join(' ');

// Compatibility exports for document shells that still use the earlier names.
export const interTight = thmanyahSans;
export const instrumentSerif = thmanyahSerifDisplay;
export const notoKufiArabic = thmanyahSans;
export const amiri = thmanyahSerifText;
