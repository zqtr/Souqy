import { redirect } from 'next/navigation';
import { getAdminUserId } from '@/lib/adminAuth';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getAdminUserId('account/settings/layout');
  if (!userId) redirect('/sign-in?redirect_url=/account/settings');

  return (
    <div
      style={{
        minWidth: 0,
        maxWidth: 980,
      }}
    >
      {children}
    </div>
  );
}
