import { PageHeader, Surface, EmptyState } from '@/components/admin/primitives';
import { recentActivity } from '@/lib/audit';
import { resolveSettingsContext } from '../_helpers';

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const { storefront } = await resolveSettingsContext(
    sp,
    '/account/settings/activity-log',
  );
  const entries = await recentActivity(storefront.slug, 100);

  return (
    <>
      <PageHeader
        eyebrow="Platform · Activity"
        title="Activity log"
        subtitle={`Every admin action on ${storefront.businessName}, newest first. Last 100 events.`}
      />

      {entries.length === 0 ? (
        <EmptyState
          eyebrow="Empty"
          title="No activity yet"
          body="Edits, publishes, orders, inquiries, and app installs all surface here as they happen. Try editing your storefront or installing an app to populate the log."
          action={{
            label: 'Open the builder',
            href: `/account/builder?store=${storefront.slug}`,
          }}
        />
      ) : (
        <Surface padding={0}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((e, i) => (
              <li
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '14px 18px',
                  borderTop:
                    i === 0
                      ? 'none'
                      : '1px solid color-mix(in srgb, var(--ink-strong) 7%, transparent)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    minWidth: 140,
                    paddingTop: 2,
                  }}
                >
                  {e.occurredAt.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--ink-strong)',
                    }}
                  >
                    {e.summary ?? e.action}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.04em',
                      marginTop: 2,
                    }}
                  >
                    {e.action}
                    {e.targetId ? ` · ${e.targetId}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Surface>
      )}
    </>
  );
}
