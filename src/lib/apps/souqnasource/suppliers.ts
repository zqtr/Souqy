import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import type { Supplier } from './types';

type Row = {
  id: string;
  display_name: string;
  cr_number: string | null;
  whatsapp: string | null;
  area: string | null;
  source_network: string;
  source_profile_url: string | null;
  trust_score: string | null;
  trust_reason: string | null;
  verified: boolean;
  claimed_at: string | null;
  first_seen_at: string;
  last_indexed_at: string;
};

function fromRow(r: Row): Supplier {
  return {
    id: r.id,
    displayName: r.display_name,
    crNumber: r.cr_number,
    whatsapp: r.whatsapp,
    area: r.area,
    sourceNetwork: r.source_network,
    sourceProfileUrl: r.source_profile_url,
    trustScore: r.trust_score === null ? null : Number(r.trust_score),
    trustReason: r.trust_reason,
    verified: r.verified,
    claimedAt: r.claimed_at,
    firstSeenAt: r.first_seen_at,
    lastIndexedAt: r.last_indexed_at,
  };
}

export type UpsertSupplier = Pick<
  Supplier,
  | 'id'
  | 'displayName'
  | 'crNumber'
  | 'whatsapp'
  | 'area'
  | 'sourceNetwork'
  | 'sourceProfileUrl'
>;

export async function upsertSupplier(s: UpsertSupplier): Promise<void> {
  await db()`
    insert into souqnasource_suppliers
      (id, display_name, cr_number, whatsapp, area, source_network, source_profile_url, last_indexed_at)
    values
      (${s.id}, ${s.displayName}, ${s.crNumber}, ${s.whatsapp}, ${s.area}, ${s.sourceNetwork}, ${s.sourceProfileUrl}, now())
    on conflict (id) do update set
      display_name = excluded.display_name,
      cr_number = excluded.cr_number,
      whatsapp = excluded.whatsapp,
      area = excluded.area,
      source_profile_url = excluded.source_profile_url,
      last_indexed_at = now()
  `;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers where id = ${id} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function setSupplierTrust(
  id: string,
  score: number,
  reason: string,
): Promise<void> {
  await db()`
    update souqnasource_suppliers
    set trust_score = ${score}, trust_reason = ${reason}, last_indexed_at = now()
    where id = ${id}
  `;
}

export async function listSuppliersNeedingTrust(
  limit: number,
): Promise<Supplier[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers
    where trust_score is null
    order by first_seen_at desc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listAllSuppliersForRefresh(
  limit: number,
): Promise<Supplier[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_suppliers
    order by last_indexed_at asc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}
