/**
 * Breakpoint tokens. Mirrored in `src/app/globals.css` as `--bp-sm` etc.
 * These are the SOURCE OF TRUTH — change them here AND in the CSS in
 * tandem so JS-side measurement and CSS-side `@media` queries always
 * agree on which device class a given width belongs to.
 *
 *   sm — phones (≤  639px)        → name: 'sm'
 *   md — small tablets (≥  640px) → name: 'md'
 *   lg — large tablets / small laptops (≥ 1024px) → name: 'lg'
 *   xl — desktops (≥ 1280px)      → name: 'xl'
 */
export const BREAKPOINTS = {
  sm: 0,
  md: 640,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const BREAKPOINT_NAMES: readonly Breakpoint[] = [
  'sm',
  'md',
  'lg',
  'xl',
] as const;

/**
 * Resolve a width in pixels to its named breakpoint. The function is
 * pure so the same logic can be invoked from server (e.g. for a
 * dev-only viewport panel) or client.
 */
export function widthToBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

/**
 * Convenience helper — true if the named breakpoint is active for the
 * given width. Inclusive of the named breakpoint and above (so
 * `isAtLeast(width, 'lg')` is true on lg AND xl).
 */
export function isAtLeast(width: number, bp: Breakpoint): boolean {
  return width >= BREAKPOINTS[bp];
}
