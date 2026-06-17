import type { Theme } from '@/lib/theme';

type RgbColor = {
  r: number;
  g: number;
  b: number;
  alpha: number;
};

const NAMED_SOLID_COLORS: Record<string, RgbColor> = {
  black: { r: 0, g: 0, b: 0, alpha: 1 },
  white: { r: 255, g: 255, b: 255, alpha: 1 },
};

/**
 * If a storefront locks a dark palette but overrides the page or section
 * background to a solid light color, iOS webviews can render almost-white
 * text on a white page. Solid custom backgrounds therefore choose their own
 * light/dark palette triplet.
 */
export function storefrontThemeForBackground(
  background: string | null | undefined,
  fallback: Theme,
): Theme {
  const color = parseSolidCssColor(background);
  if (!color || color.alpha < 0.5) return fallback;

  return relativeLuminance(color) > 0.48 ? 'light' : 'dark';
}

export function checkoutThemeForBackground(
  background: string | null | undefined,
  fallback: Theme,
): Theme {
  return storefrontThemeForBackground(background, fallback);
}

function parseSolidCssColor(value: string | null | undefined): RgbColor | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized in NAMED_SOLID_COLORS) return NAMED_SOLID_COLORS[normalized]!;
  if (normalized === 'transparent') return { r: 0, g: 0, b: 0, alpha: 0 };

  if (normalized.startsWith('#')) return parseHexColor(normalized);
  if (normalized.startsWith('rgb(') || normalized.startsWith('rgba(')) {
    return parseRgbColor(normalized);
  }
  return null;
}

function parseHexColor(value: string): RgbColor | null {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[\da-f]+$/i.test(hex)) return null;

  if (hex.length === 3 || hex.length === 4) {
    const r = hexNibble(hex[0]);
    const g = hexNibble(hex[1]);
    const b = hexNibble(hex[2]);
    const alpha = hex.length === 4 ? hexNibble(hex[3]) : 255;
    if (r == null || g == null || b == null || alpha == null) return null;
    return { r, g, b, alpha: alpha / 255 };
  }

  const r = hexPair(hex, 0);
  const g = hexPair(hex, 2);
  const b = hexPair(hex, 4);
  const alpha = hex.length === 8 ? (hexPair(hex, 6) ?? 255) / 255 : 1;
  if (r == null || g == null || b == null) return null;
  return { r, g, b, alpha };
}

function parseRgbColor(value: string): RgbColor | null {
  const match = /^rgba?\((.*)\)$/.exec(value);
  const rawBody = match?.[1]?.trim();
  if (!rawBody) return null;

  const slashParts = rawBody.split('/');
  if (slashParts.length > 2) return null;

  const channelsBody = slashParts[0]?.trim();
  if (!channelsBody) return null;

  const commaSyntax = channelsBody.includes(',');
  const parts = commaSyntax
    ? channelsBody.split(',').map((part) => part.trim())
    : channelsBody.split(/\s+/).map((part) => part.trim());

  let alpha = 1;
  if (slashParts[1] != null) {
    const parsedAlpha = parseAlpha(slashParts[1]);
    if (parsedAlpha == null) return null;
    alpha = parsedAlpha;
  } else if (commaSyntax && parts.length === 4) {
    const parsedAlpha = parseAlpha(parts[3]!);
    if (parsedAlpha == null) return null;
    alpha = parsedAlpha;
  }

  if (parts.length !== 3 && parts.length !== 4) return null;

  const r = parseRgbChannel(parts[0]!);
  const g = parseRgbChannel(parts[1]!);
  const b = parseRgbChannel(parts[2]!);
  if (r == null || g == null || b == null) return null;
  return { r, g, b, alpha };
}

function hexNibble(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(`${value}${value}`, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

function hexPair(value: string, start: number): number | null {
  const pair = value.slice(start, start + 2);
  if (pair.length !== 2) return null;
  const parsed = Number.parseInt(pair, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRgbChannel(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (trimmed.endsWith('%')) return clamp(Math.round((parsed / 100) * 255), 0, 255);
  return clamp(Math.round(parsed), 0, 255);
}

function parseAlpha(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (trimmed.endsWith('%')) return clamp(parsed / 100, 0, 1);
  return clamp(parsed, 0, 1);
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
