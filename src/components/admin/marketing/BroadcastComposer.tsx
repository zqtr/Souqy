'use client';

import { useState, useTransition } from 'react';
import {
  sendBroadcast,
  type BroadcastState,
} from '@/app/actions/marketing';
import { Field, inputStyle, textareaStyle } from '@/components/admin/SettingsForm';
import { Surface } from '@/components/admin/primitives';

type AudienceCounts = {
  all: number;
  consented: number;
  recent: number;
};

export function BroadcastComposer({
  storefrontSlug,
  audience,
}: {
  storefrontSlug: string;
  audience: AudienceCounts;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<BroadcastState>({ status: 'idle' });

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [aud, setAud] = useState<'all_customers' | 'consented_only' | 'recent_30d'>(
    'consented_only',
  );

  const counts: Record<typeof aud, number> = {
    all_customers: audience.all,
    consented_only: audience.consented,
    recent_30d: audience.recent,
  };

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (
      !confirm(
        `Send "${subject}" to ${counts[aud]} customer${counts[aud] === 1 ? '' : 's'}?`,
      )
    ) {
      return;
    }
    setState({ status: 'idle' });
    start(async () => {
      const result = await sendBroadcast({
        storefrontSlug,
        subject: subject.trim(),
        body: body.trim(),
        audience: aud,
        preview: false,
      });
      setState(result);
      if (result.status === 'success') {
        setSubject('');
        setBody('');
      }
    });
  }

  return (
    <form
      onSubmit={handleSend}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 20,
        alignItems: 'flex-start',
      }}
      className="souqna-broadcast-form"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Surface padding={20}>
          <Header eyebrow="Compose" title="Your message" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <Field label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={inputStyle}
                placeholder="A new collection just dropped at Atelier Mira"
                required
                maxLength={140}
              />
            </Field>
            <Field
              label="Body"
              hint="Plain text. Paragraph breaks are preserved. We wrap it in a Souqna-branded HTML email and append the unsubscribe footer."
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ ...textareaStyle, minHeight: 200 }}
                placeholder={`Hi,\n\nWe're so glad you stopped by Atelier Mira. We just unveiled the Sahara collection — six new pieces inspired by the dunes outside Doha.\n\nReply to this email if you'd like a private viewing.\n\nWith love,\nMira`}
                required
                maxLength={20000}
              />
            </Field>
          </div>
        </Surface>

        <Surface padding={20}>
          <Header eyebrow="Preview" title="What recipients will see" />
          <div
            style={{
              marginTop: 8,
              padding: 18,
              borderRadius: 12,
              background: '#ffffff',
              border:
                '1px solid color-mix(in srgb, var(--ink-strong) 12%, transparent)',
              color: '#1f1b16',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 14,
              lineHeight: 1.6,
              maxHeight: 360,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#a8893f',
                marginBottom: 14,
              }}
            >
              ◈ {storefrontSlug}
            </div>
            <h3
              style={{
                margin: '0 0 12px',
                fontWeight: 400,
                fontSize: 18,
              }}
            >
              {subject || 'Your subject preview'}
            </h3>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {body || 'Write your message above to see the preview here.'}
            </div>
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: '1px solid rgba(31,27,22,0.08)',
                fontFamily: '-apple-system, Segoe UI, Helvetica, Arial, sans-serif',
                fontSize: 12,
                color: 'rgba(31,27,22,0.6)',
              }}
            >
              Sent via Souqna. Reply with &ldquo;unsubscribe&rdquo; if you&rsquo;d
              rather not hear from us.
            </div>
          </div>
        </Surface>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>
        <Surface padding={20}>
          <Header eyebrow="Audience" title="Who's receiving this" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <AudienceOption
              label="Consented (recommended)"
              hint="Only customers who opted in to marketing."
              value="consented_only"
              count={audience.consented}
              checked={aud === 'consented_only'}
              onChange={() => setAud('consented_only')}
            />
            <AudienceOption
              label="Active in last 30 days"
              hint="Inquiry, order, or page view in the last 30 days. Consented only."
              value="recent_30d"
              count={audience.recent}
              checked={aud === 'recent_30d'}
              onChange={() => setAud('recent_30d')}
            />
            <AudienceOption
              label="All customers (transactional)"
              hint="Every customer with an email. Use only for important account messages."
              value="all_customers"
              count={audience.all}
              checked={aud === 'all_customers'}
              onChange={() => setAud('all_customers')}
            />
          </div>
        </Surface>

        {state.status === 'success' ? (
          <div
            role="status"
            style={{
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 8,
              background:
                'color-mix(in srgb, var(--admin-accent) 14%, transparent)',
              color: 'var(--admin-accent)',
            }}
          >
            Sent {state.sent} email{state.sent === 1 ? '' : 's'}
            {state.skipped ? ` · skipped ${state.skipped}` : ''}.
          </div>
        ) : state.status === 'error' ? (
          <div
            role="alert"
            style={{
              fontSize: 12.5,
              padding: '10px 14px',
              borderRadius: 8,
              background:
                'color-mix(in srgb, var(--color-maroon, #8b3a3a) 12%, transparent)',
              color: 'var(--color-maroon, #8b3a3a)',
            }}
          >
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || counts[aud] === 0}
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            background:
              pending || counts[aud] === 0
                ? 'color-mix(in srgb, var(--ink-strong) 50%, transparent)'
                : 'var(--ink-strong)',
            color: 'var(--surface-bg)',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: pending || counts[aud] === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {pending
            ? 'Sending…'
            : counts[aud] === 0
              ? 'No recipients in this audience'
              : `Send to ${counts[aud]} customer${counts[aud] === 1 ? '' : 's'}`}
        </button>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .souqna-broadcast-form { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
}

function AudienceOption({
  label,
  hint,
  value,
  count,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: 10,
        borderRadius: 10,
        background: checked
          ? 'color-mix(in srgb, var(--admin-accent) 12%, transparent)'
          : 'transparent',
        border: `1px solid ${checked ? 'color-mix(in srgb, var(--admin-accent) 35%, transparent)' : 'color-mix(in srgb, var(--ink-strong) 10%, transparent)'}`,
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
    >
      <input
        type="radio"
        name="audience"
        value={value}
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 4 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'baseline',
          }}
        >
          <strong style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-strong)' }}>
            {label}
          </strong>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          {hint}
        </p>
      </div>
    </label>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header style={{ marginBottom: 4 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent)',
        }}
      >
        ◈ {eyebrow}
      </div>
      <h2
        style={{
          margin: '4px 0 0',
          fontFamily: 'var(--font-serif, var(--font-sans))',
          fontWeight: 400,
          fontSize: 17,
          color: 'var(--ink-strong)',
        }}
      >
        {title}
      </h2>
    </header>
  );
}
