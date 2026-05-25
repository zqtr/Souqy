'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

/**
 * App Router top-level error boundary. Catches render errors that
 * escape every nested `error.tsx`. We forward to Sentry for
 * observability and fall back to Next's built-in error UI so the
 * page still degrades gracefully without a custom design.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
