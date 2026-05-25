import type { Storefront } from '@/lib/brief';

/**
 * Lean storefront descriptor surfaced to every admin client component.
 * The full `Storefront` shape is server-only (it carries denormalised
 * blocks, theme overrides, etc) — we only ship what the chrome and
 * client-side switcher actually need.
 *
 * This file is deliberately NOT marked `'use client'` so server
 * components can call the transform helpers below without Next.js
 * rewriting the named exports into client references (which would
 * make them appear as objects at runtime, throwing
 * `TypeError: <fn> is not a function` when invoked from a server
 * component).
 */
export type StorefrontSummary = {
  slug: string;
  businessName: string;
  isPublished: boolean;
  templateId: string;
  palette: string;
  locale: 'en' | 'ar';
};

export function summariseStorefront(s: Storefront): StorefrontSummary {
  return {
    slug: s.slug,
    businessName: s.businessName,
    isPublished: s.isPublished,
    templateId: s.templateId,
    palette: s.palette,
    locale: s.locale,
  };
}

export function fromSummaries(arr: Storefront[]): StorefrontSummary[] {
  return arr.map(summariseStorefront);
}
