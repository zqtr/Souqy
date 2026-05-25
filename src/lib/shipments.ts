import { unstable_noStore as noStore } from 'next/cache';
import { db } from './db';

/**
 * Cross-carrier ledger of outbound shipments. Created by marketplace
 * plugins (currently only Aramex) when a founder clicks "Create
 * shipment" on an order. Status updates flow back via per-plugin
 * tracking polls.
 */

export type ShipmentStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'failed';

export type Shipment = {
  id: number;
  storefrontSlug: string;
  orderId: number;
  carrier: string;
  service: string;
  awb: string;
  trackingUrl: string;
  labelUrl: string | null;
  costQar: number | null;
  status: ShipmentStatus | string;
  raw: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type ShipmentRow = {
  id: number;
  storefront_slug: string;
  order_id: number;
  carrier: string;
  service: string;
  awb: string;
  tracking_url: string;
  label_url: string | null;
  cost_qar: string | null;
  status: string;
  raw: unknown;
  created_at: string;
  updated_at: string;
};

function fromRow(r: ShipmentRow): Shipment {
  return {
    id: r.id,
    storefrontSlug: r.storefront_slug,
    orderId: r.order_id,
    carrier: r.carrier,
    service: r.service,
    awb: r.awb,
    trackingUrl: r.tracking_url,
    labelUrl: r.label_url,
    costQar: r.cost_qar !== null ? Number(r.cost_qar) : null,
    status: r.status,
    raw:
      r.raw && typeof r.raw === 'object' && !Array.isArray(r.raw)
        ? (r.raw as Record<string, unknown>)
        : {},
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export type ShipmentCreateInput = {
  orderId: number;
  carrier: string;
  service?: string;
  awb: string;
  trackingUrl?: string;
  labelUrl?: string | null;
  costQar?: number | null;
  raw?: Record<string, unknown>;
};

export async function createShipment(
  storefrontSlug: string,
  input: ShipmentCreateInput,
): Promise<Shipment> {
  const rows = (await db()`
    insert into shipments (
      storefront_slug, order_id, carrier, service, awb,
      tracking_url, label_url, cost_qar, raw
    ) values (
      ${storefrontSlug}, ${input.orderId}, ${input.carrier},
      ${input.service ?? ''}, ${input.awb},
      ${input.trackingUrl ?? ''}, ${input.labelUrl ?? null},
      ${input.costQar ?? null},
      ${JSON.stringify(input.raw ?? {})}::jsonb
    )
    on conflict (carrier, awb) do update set
      tracking_url = excluded.tracking_url,
      label_url    = coalesce(excluded.label_url, shipments.label_url),
      cost_qar     = coalesce(excluded.cost_qar, shipments.cost_qar),
      raw          = excluded.raw,
      updated_at   = now()
    returning *
  `) as unknown as ShipmentRow[];
  if (!rows[0]) throw new Error('insert shipment failed');
  return fromRow(rows[0]);
}

export async function listShipmentsForOrder(
  storefrontSlug: string,
  orderId: number,
): Promise<Shipment[]> {
  noStore();
  const rows = (await db()`
    select * from shipments
    where storefront_slug = ${storefrontSlug} and order_id = ${orderId}
    order by created_at desc
  `) as unknown as ShipmentRow[];
  return rows.map(fromRow);
}

export async function getShipmentByAwb(
  carrier: string,
  awb: string,
): Promise<Shipment | null> {
  noStore();
  const rows = (await db()`
    select * from shipments
    where carrier = ${carrier} and awb = ${awb}
    limit 1
  `) as unknown as ShipmentRow[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function updateShipmentStatus(
  id: number,
  status: string,
  raw?: Record<string, unknown>,
): Promise<Shipment | null> {
  const rows = raw
    ? ((await db()`
        update shipments set
          status = ${status},
          raw    = ${JSON.stringify(raw)}::jsonb,
          updated_at = now()
        where id = ${id}
        returning *
      `) as unknown as ShipmentRow[])
    : ((await db()`
        update shipments set
          status = ${status},
          updated_at = now()
        where id = ${id}
        returning *
      `) as unknown as ShipmentRow[]);
  return rows[0] ? fromRow(rows[0]) : null;
}
