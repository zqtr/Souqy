import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStorefrontsForUser } from '@/lib/brief';
import {
  STOREFRONT_STORAGE_LIMIT_BYTES,
  getStorefrontStorageUsedBytes,
  listFilesForStorefront,
} from '@/lib/files';
import {
  EmptyState,
  PageHeader,
  Surface,
} from '@/components/admin/primitives';
import { FilesLibrary } from '@/components/admin/files/FilesLibrary';
import { adminPhrase } from '@/components/admin/adminLocale';

export default async function StoragePage({
  searchParams,
}: {
  searchParams?: Promise<{ store?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/account/storage-library');
  const locale = (await cookies()).get('NEXT_LOCALE')?.value;
  const t = (text: string) => adminPhrase(locale, text);

  const sp = (await searchParams) ?? {};
  const requested = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const storefronts = await getStorefrontsForUser(userId);
  if (storefronts.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow={t('Storage')}
          title={locale === 'ar' ? 'التخزين' : 'Storage'}
          subtitle={
            locale === 'ar'
              ? 'أنشئ متجرا لتبدأ برفع صورك.'
              : 'Create a storefront to start uploading assets.'
          }
        />
        <EmptyState
          eyebrow={t('Get started')}
          title={t('Create your store first')}
          body={
            locale === 'ar'
              ? 'كل مكتبة تخزين مرتبطة بمتجر محدد حتى تبقى الصور والروابط منظمة.'
              : 'Each Storage library is scoped to one storefront so images and links stay organized.'
          }
          action={{ label: t('Create your store'), href: '/begin' }}
        />
      </>
    );
  }

  const known = storefronts.map((s) => s.slug);
  const slug =
    requested && known.includes(requested) ? requested : storefronts[0]!.slug;
  const store = storefronts.find((s) => s.slug === slug);
  const [files, usedBytes] = await Promise.all([
    listFilesForStorefront(slug, { limit: 1000 }).catch((err) => {
      console.error('[storage] list failed', err);
      return [] as Awaited<ReturnType<typeof listFilesForStorefront>>;
    }),
    getStorefrontStorageUsedBytes(slug).catch((err) => {
      console.error('[storage] usage failed', err);
      return 0;
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Storage')}
        title={locale === 'ar' ? 'التخزين' : 'Storage'}
        subtitle={
          locale === 'ar'
            ? `مكتبة الصور الخاصة بـ ${store?.businessName ?? slug}.`
            : `Manage the image library for ${store?.businessName ?? slug}.`
        }
      />

      <Surface padding={20}>
        <FilesLibrary
          storefrontSlug={slug}
          initialUsedBytes={usedBytes}
          storageLimitBytes={STOREFRONT_STORAGE_LIMIT_BYTES}
          initialFiles={files.map((file) => ({
            url: file.url,
            pathname: file.pathname,
            size: file.size,
            uploadedAt: file.uploadedAt.toISOString(),
            contentType: file.contentType,
            namespace: file.namespace,
            name: file.name,
          }))}
        />
      </Surface>
    </>
  );
}
