/**
 * Brand palette — mirror of CSS variables in src/app/globals.css.
 * Used where inline values are unavoidable: SVG strokes, framer-motion
 * keyframes, OG image rendering. The CSS file is the source of truth.
 */
export const palette = {
  sand: '#E8DCC4',
  sandDeep: '#DCCEB1',
  sandPale: '#F1E9D7',
  maroon: '#8B3A3A',
  maroonDeep: '#6A2A2A',
  gold: '#C9A961',
  goldDeep: '#A8893F',
  silver: '#C5C5C5',
  silverPale: '#D8D8D8',
  charcoal: '#2A2A2A',
  charcoalSoft: '#3A3633',
  ink: '#1F1B16',
} as const;

export type PaletteToken = keyof typeof palette;
