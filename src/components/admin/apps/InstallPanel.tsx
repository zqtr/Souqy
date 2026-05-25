'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  installFreeApp,
  installWithApiKey,
  type AppActionState,
} from '@/app/actions/apps';
import { Field, inputStyle } from '@/components/admin/SettingsForm';
import { Surface } from '@/components/admin/primitives';

/**
 * Install card on the App detail page.
 *
 * Visible to founders. We deliberately do NOT use words like "OAuth",
 * "API key", "AES-256-GCM", or any provider hostnames. The internal
 * auth kinds (`oauth`/`api_key`/`none`) drive the input affordances
 * but the headline + body + CTA come from the descriptor's
 * `connectCopy` block.
 */
export function InstallPanel({
  storefrontSlug,
  appId,
  authKind,
  headline,
  body,
  ctaLabel,
  apiKeyHelp,
  setupRequired,
  docs,
  postInstallHref,
}: {
  storefrontSlug: string;
  appId: string;
  authKind: 'oauth' | 'api_key' | 'none';
  headline: string;
  body: string;
  ctaLabel: string;
  apiKeyHelp?: { placeholder: string; helpUrl?: string };
  setupRequired?: string | null;
  docs?: { label: string; href: string }[];
  postInstallHref?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AppActionState>({ status: 'idle' });
  const [apiKey, setApiKey] = useState('');

  function done() {
    router.push(postInstallHref ?? `/account/apps?store=${storefrontSlug}`);
    router.refresh();
  }

  function handleFree() {
    setState({ status: 'idle' });
    start(async () => {
      const result = await installFreeApp({ storefrontSlug, appId, settings: {} });
      setState(result);
      if (result.status === 'success') done();
    });
  }

  function handleApiKey(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'idle' });
    start(async () => {
      const result = await installWithApiKey({
        storefrontSlug,
        appId,
        apiKey: apiKey.trim(),
        settings: {},
      });
      setState(result);
      if (result.status === 'success') done();
    });
  }

  if (setupRequired) {
    return (
      <Surface padding={20}>
        <Headline>Not available right now</Headline>
        <p style={bodyStyle}>{setupRequired}</p>
        <DocsLinks docs={docs} />
      </Surface>
    );
  }

  if (authKind === 'none') {
    return (
      <Surface padding={20}>
        <Headline>{headline}</Headline>
        <p style={bodyStyle}>{body}</p>
        {state.status === 'error' ? (
          <div role="alert" style={errorStyle}>
            {state.message}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleFree}
          disabled={pending}
          style={primaryButton(pending)}
        >
          {pending ? 'Installing…' : ctaLabel}
        </button>
        <Footnote>
          Stays private to this store · uninstall anytime
        </Footnote>
        <DocsLinks docs={docs} />
      </Surface>
    );
  }

  if (authKind === 'api_key') {
    return (
      <Surface padding={20}>
        <Headline>{headline}</Headline>
        <p style={bodyStyle}>{body}</p>
        <form
          onSubmit={handleApiKey}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}
        >
          <Field label="Connection token">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              placeholder={apiKeyHelp?.placeholder ?? 'Paste your token'}
              required
              autoComplete="off"
            />
          </Field>
          {apiKeyHelp?.helpUrl ? (
            <a
              href={apiKeyHelp.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: 'var(--admin-accent)',
                textDecoration: 'underline',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Where do I find my token?
            </a>
          ) : null}
          {state.status === 'error' ? (
            <div role="alert" style={errorStyle}>
              {state.message}
            </div>
          ) : null}
          <button type="submit" disabled={pending} style={primaryButton(pending)}>
            {pending ? 'Connecting…' : ctaLabel}
          </button>
        </form>
        <Footnote>
          Tokens stay private to this store · uninstall anytime to remove
        </Footnote>
        <DocsLinks docs={docs} />
      </Surface>
    );
  }

  const oauthHref = `/api/apps/oauth/start?app=${encodeURIComponent(appId)}&store=${encodeURIComponent(storefrontSlug)}`;

  return (
    <Surface padding={20}>
      <Headline>{headline}</Headline>
      <p style={bodyStyle}>{body}</p>
      <a
        href={oauthHref}
        style={{
          ...primaryButton(false),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}
      >
        {ctaLabel}
      </a>
      <Footnote>
        Opens a secure provider sign-in · uninstall anytime to revoke Souqna
      </Footnote>
      <DocsLinks docs={docs} />
    </Surface>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '0 0 8px',
        fontFamily: 'var(--font-serif, var(--font-sans))',
        fontWeight: 500,
        fontSize: 17,
        color: 'var(--ink-strong)',
      }}
    >
      {children}
    </h3>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '12px 0 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink-muted)',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </p>
  );
}

function DocsLinks({ docs }: { docs?: { label: string; href: string }[] }) {
  if (!docs?.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        marginTop: 14,
        paddingTop: 12,
        borderTop: '1px solid var(--surface-rule)',
      }}
    >
      {docs.map((doc) => (
        <a
          key={doc.href}
          href={doc.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--admin-accent)',
            textDecoration: 'underline',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.45,
          }}
        >
          {doc.label}
        </a>
      ))}
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  color: 'var(--ink-strong)',
  lineHeight: 1.6,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12.5,
  padding: '8px 12px',
  borderRadius: 8,
  background: 'color-mix(in srgb, var(--color-maroon, #8b3a3a) 12%, transparent)',
  color: 'var(--color-maroon, #8b3a3a)',
  marginBottom: 6,
};

function primaryButton(pending: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 18px',
    borderRadius: 10,
    background: pending
      ? 'color-mix(in srgb, var(--admin-accent) 35%, transparent)'
      : 'var(--admin-accent)',
    color: 'var(--ink-on-gold)',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: pending ? 'progress' : 'pointer',
  };
}
