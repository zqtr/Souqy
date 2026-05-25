import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

export type LocationAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type Location = {
  id: number;
  storefrontSlug: string;
  name: string;
  isPrimary: boolean;
  fulfilsOrders: boolean;
  address: LocationAddress;
  phone: string | null;
  email: string | null;
  hours: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LocationRow = {
  id: number;
  storefront_slug: string;
  name: string;
  is_primary: boolean;
  fulfils_orders: boolean;
  address: unknown;
  phone: string | null;
  email: string | null;
  hours: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: LocationRow): Location {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    name: r.name,
    isPrimary: r.is_primary,
    fulfilsOrders: r.fulfils_orders,
    address:
      r.address && typeof r.address === 'object' && !Array.isArray(r.address)
        ? (r.address as LocationAddress)
        : {},
    phone: r.phone,
    email: r.email,
    hours: r.hours,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function listLocations(storefrontSlug: string): Promise<Location[]> {
  noStore();
  const rows = (await db()`
    select * from locations
    where storefront_slug = ${storefrontSlug}
    order by is_primary desc, created_at asc
  `) as unknown as LocationRow[];
  return rows.map(fromRow);
}

/**
 * Return the locations list, lazily inserting a default "Primary"
 * row the first time the list is queried for a store. Callers can
 * trust that the result is non-empty.
 */
export async function listLocationsOrSeed(
  storefrontSlug: string,
  seedName: string,
): Promise<Location[]> {
  const existing = await listLocations(storefrontSlug);
  if (existing.length > 0) return existing;
  await db()`
    insert into locations (
      storefront_slug, name, is_primary, fulfils_orders, address
    ) values (
      ${storefrontSlug}, ${seedName}, true, true, '{}'::jsonb
    )
    on conflict do nothing
  `;
  return listLocations(storefrontSlug);
}
