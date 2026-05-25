import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCopy } from '@/content/copy';
import { gateAtelierPro } from '@/lib/billing';
import { SouqyStudioIntro } from '@/components/sections/begin/SouqyStudioIntro';
import { SouqyPaywall } from '@/components/sections/begin/SouqyPaywall';

export const metadata: Metadata = {
  title: 'Souqy · Souqna',
  description: 'An AI design studio for logos, posters, and brand kits.',
};

export default async function SouqyBeginShortcutPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/begin/souqy');
  }

  const gate = await gateAtelierPro(userId);
  if (!gate.ok) {
    return <SouqyPaywall locale="en" copy={getCopy('en')} />;
  }

  return <SouqyStudioIntro locale="en" />;
}
