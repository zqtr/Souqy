import type { BusinessType } from './brief';

/**
 * Seven archetype templates cover all 20 business types. The mapping is the
 * single source of truth for "which template renders this storefront" — the
 * founder doesn't pick a design; their type determines it.
 *
 * Adding a new business type? Add a row here too, or rendering will fall back
 * to `generic`.
 */
export type ArchetypeId =
  | 'menu'
  | 'lookbook'
  | 'service_list'
  | 'portfolio'
  | 'calendar'
  | 'catalog_grid'
  | 'generic';

export const ARCHETYPE_BY_TYPE: Record<BusinessType, ArchetypeId> = {
  cafe: 'menu',
  fnb_brand: 'menu',
  home_kitchen: 'menu',

  clothing_store: 'lookbook',
  photography: 'lookbook',
  art_gallery: 'lookbook',

  salon: 'service_list',
  fitness: 'service_list',
  tailoring_abaya: 'service_list',
  auto_detailing: 'service_list',
  courier_delivery: 'service_list',

  graphic_design: 'portfolio',
  contracting: 'portfolio',
  real_estate: 'portfolio',

  events_weddings: 'calendar',
  tutoring: 'calendar',

  ecommerce: 'catalog_grid',
  perfume_oud: 'catalog_grid',
  agriculture: 'catalog_grid',

  something_else: 'generic',
};

export function archetypeFor(type: BusinessType): ArchetypeId {
  return ARCHETYPE_BY_TYPE[type] ?? 'generic';
}
