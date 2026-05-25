import type { ReactNode } from 'react';
import '@/app/globals.css';
import { AuthDocumentShell } from '@/components/blocks/AuthDocumentShell';

export default function SignInLayout({ children }: { children: ReactNode }) {
  return <AuthDocumentShell>{children}</AuthDocumentShell>;
}
