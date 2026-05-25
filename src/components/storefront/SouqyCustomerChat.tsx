'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function SouqyCustomerChat({
  storefrontSlug,
  locale,
  businessName,
}: {
  storefrontSlug: string;
  locale: 'en' | 'ar';
  businessName: string;
}) {
  const isAr = locale === 'ar';
  const copy = useMemo(
    () => ({
      open: isAr ? 'اسأل سوقي' : 'Ask Souqy',
      title: isAr ? 'سوقي' : 'Souqy',
      subtitle: isAr ? `مساعد ${businessName}` : `${businessName} assistant`,
      placeholder: isAr ? 'اسأل عن المنتجات أو التوصيل...' : 'Ask about products or delivery...',
      send: isAr ? 'إرسال' : 'Send',
      close: isAr ? 'إغلاق' : 'Close',
      starter: isAr
        ? 'مرحباً، أنا سوقي. اسألني عن المنتجات، الأسعار، التوفر، التوصيل، أو ساعات العمل.'
        : "Hi, I'm Souqy. Ask me about products, prices, availability, delivery, or store hours.",
      error: isAr ? 'تعذر إرسال الرسالة الآن.' : 'Could not send the message right now.',
    }),
    [businessName, isAr],
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: copy.starter },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/souqy/customer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontSlug,
          messages: nextMessages.slice(-12),
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok || !data.message) {
        throw new Error(data.error ?? 'failed');
      }
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.message ?? copy.error },
      ]);
    } catch {
      setError(copy.error);
      setMessages((current) => [...current, { role: 'assistant', content: copy.error }]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <div className="souqy-customer-chat" dir={isAr ? 'rtl' : 'ltr'}>
      {open ? (
        <section className="souqy-customer-panel" aria-label={copy.title}>
          <header className="souqy-customer-head">
            <div>
              <strong>{copy.title}</strong>
              <span>{copy.subtitle}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>
              x
            </button>
          </header>
          <div className="souqy-customer-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`souqy-customer-msg ${message.role}`}
              >
                {message.content}
              </article>
            ))}
            {pending ? <article className="souqy-customer-msg assistant">...</article> : null}
          </div>
          {error ? <p className="souqy-customer-error">{error}</p> : null}
          <form onSubmit={submit} className="souqy-customer-form">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder={copy.placeholder}
              maxLength={1200}
            />
            <button type="submit" disabled={pending || !draft.trim()}>
              {copy.send}
            </button>
          </form>
        </section>
      ) : null}
      <button type="button" className="souqy-customer-trigger" onClick={() => setOpen(true)}>
        {copy.open}
      </button>
      <style jsx>{`
        .souqy-customer-chat {
          position: fixed;
          inset-block-end: max(20px, env(safe-area-inset-bottom));
          inset-inline-start: 20px;
          z-index: 61;
          font-family: var(--font-sans), system-ui, sans-serif;
        }
        .souqy-customer-trigger,
        .souqy-customer-form button,
        .souqy-customer-head button {
          border: 0;
          cursor: pointer;
          font: inherit;
        }
        .souqy-customer-trigger {
          min-block-size: 42px;
          padding: 9px 16px;
          border-radius: 999px;
          background: var(--sf-accent, #c9a961);
          color: var(--sf-ground, #f1e9d7);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
          font-size: 14px;
          font-weight: 650;
        }
        .souqy-customer-panel {
          position: absolute;
          inset-block-end: 56px;
          inset-inline-start: 0;
          inline-size: min(360px, calc(100vw - 40px));
          max-block-size: min(580px, calc(100dvh - 96px));
          display: grid;
          grid-template-rows: auto minmax(160px, 1fr) auto auto;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--sf-accent, #c9a961) 36%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--sf-ground, #f1e9d7) 96%, white);
          color: var(--sf-ink, #1f1b16);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }
        .souqy-customer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 14px 12px;
          border-block-end: 1px solid color-mix(in srgb, var(--sf-accent, #c9a961) 20%, transparent);
        }
        .souqy-customer-head div {
          display: grid;
          gap: 2px;
          min-inline-size: 0;
        }
        .souqy-customer-head strong {
          font-size: 15px;
          letter-spacing: 0;
        }
        .souqy-customer-head span {
          overflow: hidden;
          color: color-mix(in srgb, var(--sf-ink, #1f1b16) 62%, transparent);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .souqy-customer-head button {
          inline-size: 30px;
          block-size: 30px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--sf-ink, #1f1b16) 8%, transparent);
          color: inherit;
          font-size: 16px;
          line-height: 1;
        }
        .souqy-customer-messages {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          padding: 14px;
        }
        .souqy-customer-msg {
          max-inline-size: 88%;
          padding: 9px 11px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.45;
          white-space: pre-wrap;
        }
        .souqy-customer-msg.user {
          align-self: flex-end;
          background: var(--sf-ink, #1f1b16);
          color: var(--sf-ground, #f1e9d7);
        }
        .souqy-customer-msg.assistant {
          align-self: flex-start;
          background: color-mix(in srgb, var(--sf-accent, #c9a961) 16%, transparent);
        }
        .souqy-customer-error {
          margin: 0;
          padding-inline: 14px;
          color: #8f2f2f;
          font-size: 12px;
        }
        .souqy-customer-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          padding: 12px;
          border-block-start: 1px solid
            color-mix(in srgb, var(--sf-accent, #c9a961) 20%, transparent);
        }
        .souqy-customer-form input {
          min-inline-size: 0;
          border: 1px solid color-mix(in srgb, var(--sf-ink, #1f1b16) 18%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--sf-ground, #f1e9d7) 86%, white);
          color: inherit;
          font: inherit;
          font-size: 13px;
          outline: 0;
          padding: 10px 11px;
        }
        .souqy-customer-form input:focus {
          border-color: var(--sf-accent, #c9a961);
        }
        .souqy-customer-form button {
          border-radius: 8px;
          background: var(--sf-accent, #c9a961);
          color: var(--sf-ground, #f1e9d7);
          font-size: 13px;
          font-weight: 650;
          padding-inline: 13px;
        }
        .souqy-customer-form button:disabled {
          cursor: progress;
          opacity: 0.55;
        }
        @media (max-width: 520px) {
          .souqy-customer-chat {
            inset-inline-start: 12px;
          }
          .souqy-customer-panel {
            inline-size: calc(100vw - 24px);
          }
        }
      `}</style>
    </div>
  );
}
