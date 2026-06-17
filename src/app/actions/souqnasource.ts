'use server';

import type { ImportOverrides } from '@/lib/apps/souqnasource/import';
import type { SouqnasourceSettings } from '@/lib/apps/souqnasource/settings';
import type { Category, Listing, ListingType, Supplier } from '@/lib/apps/souqnasource/types';

function removed(): never {
  throw new Error('souqnasource_removed');
}

export async function browseListings(input: {
  slug: string;
  category: Category;
  type: ListingType | null;
  limit: number;
}): Promise<Listing[]> {
  void input;
  removed();
}

export async function getSupplierForBrowse(input: {
  slug: string;
  supplierId: string;
}): Promise<Supplier | null> {
  void input;
  removed();
}

export async function addToCatalog(input: {
  slug: string;
  listingId: string;
  overrides: ImportOverrides;
}): Promise<{ productId: string }> {
  void input;
  removed();
}

export async function requestQuote(input: {
  slug: string;
  listingId: string;
}): Promise<{ url: string }> {
  void input;
  removed();
}

export async function importFromQuote(input: {
  slug: string;
  quoteRequestId: number;
  manualPrice: number;
  manualCurrency: string;
  overrides: ImportOverrides;
}): Promise<{ productId: string }> {
  void input;
  removed();
}

export async function getSouqnasourceSettings(slug: string): Promise<SouqnasourceSettings> {
  void slug;
  removed();
}

export async function saveSouqnasourceSettings(
  slug: string,
  patch: Partial<SouqnasourceSettings>,
): Promise<SouqnasourceSettings> {
  void slug;
  void patch;
  removed();
}
