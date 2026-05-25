import {
  PageHeader,
  Surface,
  StatusBadge,
  EmptyState,
} from '@/components/admin/primitives';
import { listLocationsOrSeed } from '@/lib/locations';
import { resolveSettingsContext } from '../_helpers';

/**
 * Locations — read-only list for v1. Founders typically run a single
 * pickup location, so the migration's `listLocationsOrSeed` helper
 * lazy-creates a "Primary" row the first time the page is opened.
 * Add / edit lands in a follow-up alongside fulfilment + shipping.
 */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(sp, '/account/settings/locations');
  const locations = await listLocationsOrSeed(
    storefront.slug,
    `${storefront.businessName} HQ`,
  );

  return (
    <>
      <PageHeader
        eyebrow="Commerce · Locations"
        title="Locations"
        subtitle="Pickup and fulfilment points for your storefront."
      />

      {locations.length === 0 ? (
        <EmptyState
          eyebrow="Empty"
          title="No locations yet"
          body="Add a primary location so customers know where their order ships from."
          action={{ label: 'Add location', href: '#' }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {locations.map((l) => (
            <Surface key={l.id} padding={18}>
              <header style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif, var(--font-sans))',
                    fontWeight: 400,
                    fontSize: 17,
                    color: 'var(--ink-strong)',
                  }}
                >
                  {l.name}
                </h3>
                {l.isPrimary ? <StatusBadge tone="success">primary</StatusBadge> : null}
                {l.fulfilsOrders ? (
                  <StatusBadge tone="info">fulfils orders</StatusBadge>
                ) : null}
              </header>
              <dl
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--ink-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {l.address.line1 ? <span>{l.address.line1}</span> : null}
                {l.address.city ? <span>{l.address.city}</span> : null}
                {l.phone ? <span>{l.phone}</span> : null}
                {l.email ? <span>{l.email}</span> : null}
                {l.hours ? <span>{l.hours}</span> : null}
                {!l.address.line1 && !l.phone && !l.email && !l.hours ? (
                  <span style={{ fontStyle: 'italic' }}>
                    No address yet — add one to surface it on order receipts.
                  </span>
                ) : null}
              </dl>
            </Surface>
          ))}
        </div>
      )}

      <p
        style={{
          marginTop: 16,
          fontSize: 12,
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
        }}
      >
        Add / edit lands in the next release alongside Shipping & delivery.
      </p>
    </>
  );
}
