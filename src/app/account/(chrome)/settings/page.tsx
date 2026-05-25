import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  PageHeader,
  Surface,
  StatusBadge,
} from '@/components/admin/primitives';
import { ChevronRight } from '@/components/admin/glyphs';
import { SETTINGS_NAV_SECTIONS } from '@/components/admin/settingsNav';
import { adminLocale, adminNavLabel, adminPhrase, adminText } from '@/components/admin/adminLocale';
import { direction, isLocale } from '@/i18n/locales';

export default async function SettingsHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/settings');

  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  const locale = adminLocale(cookieLocale && isLocale(cookieLocale) ? cookieLocale : undefined);
  const t = adminText(locale);
  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested)
      ? requested
      : storefronts[0]?.slug ?? null;

  const storeQs = slug ? `?store=${slug}` : '';

  return (
    <div dir={direction[locale]}>
      <PageHeader
        eyebrow={t.settings}
        title={t.settings}
        subtitle={adminPhrase(locale, 'Choose a section from the sidebar, or open one below.')}
      />

      <div
        className="souqna-settings-overview"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {SETTINGS_NAV_SECTIONS.map((section) => (
          <Surface key={section.id} padding={18}>
            <header style={{ marginBottom: 10 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif, var(--font-sans))',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--ink-strong)',
                }}
              >
                {adminNavLabel(section.title, locale)}
              </h2>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: 'var(--ink-muted)',
                }}
              >
                {adminPhrase(locale, section.summary)}
              </p>
            </header>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {section.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${item.href}${storeQs}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minHeight: 34,
                      padding: '7px 6px',
                      borderRadius: 7,
                      color: 'var(--ink-strong)',
                      textDecoration: 'none',
                    }}
                    className="souqna-settings-row"
                  >
                    <span
                      style={{
                        minWidth: 0,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 13.5,
                      }}
                    >
                      {adminNavLabel(item.label, locale)}
                    </span>
                    {item.soon ? <StatusBadge tone="neutral">{t.soon}</StatusBadge> : null}
                    <ChevronRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </Surface>
        ))}
      </div>

      <style>{`
        .souqna-settings-row:hover {
          background: color-mix(in srgb, var(--ink-strong) 5%, transparent);
        }

        @media (max-width: 760px) {
          .souqna-settings-overview {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
