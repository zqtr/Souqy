'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  uninstallAppAction,
  type AppActionState,
} from '@/app/actions/apps';

export function UninstallButton({
  storefrontSlug,
  appId,
  appName,
}: {
  storefrontSlug: string;
  appId: string;
  appName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AppActionState>({ status: 'idle' });

  function handleClick() {
    if (
      !confirm(
        `Uninstall ${appName}? Storefront integrations turn off immediately. Settings are deleted; OAuth tokens are revoked.`,
      )
    )
      return;
    setState({ status: 'idle' });
    start(async () => {
      const result = await uninstallAppAction({ storefrontSlug, appId });
      setState(result);
      if (result.status === 'success') {
        router.push(`/account/apps?store=${storefrontSlug}`);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: '9px 14px',
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--color-maroon, #8b3a3a)',
          border:
            '1px solid color-mix(in srgb, var(--color-maroon, #8b3a3a) 30%, transparent)',
          fontSize: 13,
          fontWeight: 500,
          cursor: pending ? 'progress' : 'pointer',
        }}
      >
        {pending ? 'Uninstalling…' : 'Uninstall'}
      </button>
      {state.status === 'error' ? (
        <span
          role="alert"
          style={{ fontSize: 12, color: 'var(--color-maroon, #8b3a3a)', marginLeft: 10 }}
        >
          {state.message}
        </span>
      ) : null}
    </>
  );
}
