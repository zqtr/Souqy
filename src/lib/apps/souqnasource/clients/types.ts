// src/lib/apps/souqnasource/clients/types.ts
import type { SourceNetwork } from '../types';

export type RawSupplier = {
  network: SourceNetwork;
  sourceSupplierId: string;
  displayName: string;
  whatsapp: string | null;
  area: string | null;
  sourceProfileUrl: string;
};

export type RawListing = {
  network: SourceNetwork;
  sourceListingId: string;
  sourceListingUrl: string;
  sourceSupplierId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rawCategory: string | null;
  price: number | null;
  currency: string | null;
  moq: number | null;
  raw: Record<string, unknown>;
};

export type CrawlResult = {
  suppliers: RawSupplier[];
  listings: RawListing[];
  nextCursor: string | null;
};

export interface SupplierClient {
  network: SourceNetwork;
  crawl(opts: { sinceCursor: string | null }): Promise<CrawlResult>;
  refreshListing(sourceListingId: string): Promise<RawListing | null>;
}
