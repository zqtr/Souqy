'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type React from 'react';
import { Send } from 'lucide-react';
import {
  applySouqyPlan,
  getOrCreateSouqyConversation,
  sendSouqyMessage,
  type SouqyChatMessageDto,
} from '@/app/actions/souqyChat';
import { SouqyLogo } from './SouqyLogo';
import type { StorefrontSummary } from './storefrontSummary';

type Props = {
  open: boolean;
  storefront: StorefrontSummary | null;
  onClose: () => void;
};

type SouqyMode = 'ask' | 'agent';

type Plan = {
  id: string;
  summary: string;
  status: 'pending' | 'applied' | 'error';
  checklist: Array<{ title: string; detail?: string }>;
  questions?: Array<{
    id: string;
    label: string;
    detail?: string;
    options?: Array<{ label: string; prompt: string }>;
  }>;
  categoryCreates?: unknown[];
  productCreates?: unknown[];
  productUpdates?: unknown[];
  seo?: unknown;
};

const palette = {
  sand: '#E8DCC4',
  sandPale: '#F1E9D7',
  maroon: '#7B1E26',
  maroonDeep: '#4B1118',
  gold: '#D4AF37',
  goldSoft: '#F5C977',
  ink: '#11100F',
};

export function SouqyChatDrawer({ open, storefront, onClose }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SouqyChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<SouqyMode>('ask');
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open || !storefront) return;
    startTransition(async () => {
      setError(null);
      const res = await getOrCreateSouqyConversation({ storefrontSlug: storefront.slug });
      if (res.status === 'success') {
        setConversationId(res.conversationId);
        setMessages(res.messages);
      } else {
        setError(res.message);
      }
    });
  }, [open, storefront]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  const activePlan = useMemo(
    () =>
      messages
        .map((message) => parsePlan(message.metadata.plan))
        .filter((plan): plan is Plan => Boolean(plan))
        .reverse()
        .find((plan) => plan.status === 'pending') ?? null,
    [messages],
  );

  function submit() {
    const value = draft.trim();
    if (!value || !storefront || loading) return;
    setDraft('');
    setError(null);
    startTransition(async () => {
      const optimistic: SouqyChatMessageDto = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: value,
        metadata: {},
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const res = await sendSouqyMessage({
        storefrontSlug: storefront.slug,
        conversationId,
        message: value,
        mode,
      });
      if (res.status === 'success') {
        setConversationId(res.conversationId);
        setMessages(res.messages);
      } else {
        setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
        setError(res.message);
        setDraft(value);
      }
    });
  }

  function applyPlan(planId: string) {
    if (!storefront || !conversationId || loading) return;
    setError(null);
    startTransition(async () => {
      const res = await applySouqyPlan({
        storefrontSlug: storefront.slug,
        conversationId,
        planId,
      });
      if (res.status === 'success') {
        setMessages(res.messages);
      } else {
        setError(res.message);
      }
    });
  }

  function setQuickPrompt(prompt: string, nextMode: SouqyMode = mode) {
    setMode(nextMode);
    setDraft(prompt);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <aside
        id="souqy"
        className={`souqy-drawer${open ? ' is-open' : ''}`}
        aria-hidden={!open}
        aria-label="Store assistant"
      >
        <div className="souqy-liquid" aria-hidden />
        <header className="souqy-head">
          <div className="souqy-avatar-wrap">
            <span className="souqy-avatar">
              <SouqyLogo size={46} className="souqy-drawer-logo" />
            </span>
          </div>
          <div className="souqy-title">
            <div className="souqy-title-row">
              <span className="souqy-ar">AI operator</span>
            </div>
            <div className="souqy-status">
              <span aria-hidden />
              {mode === 'ask' ? 'Ready to answer' : 'Staging changes'}
            </div>
            <div className="souqy-signal" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <button
            className="souqy-icon-btn"
            type="button"
            aria-label="Close chat"
            title="Close"
            onClick={() => onClose()}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="souqy-day">
          <span />
          Today
          <span />
        </div>

        <div ref={scrollerRef} className="souqy-messages">
          {!storefront ? (
            <EmptyState
              title="Pick a storefront first"
              body="The assistant works inside the active store selected in the dashboard."
            />
          ) : messages.length === 0 && !loading ? (
            <StarterGuide storefront={storefront} onUsePrompt={setQuickPrompt} />
          ) : null}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApply={applyPlan}
              onUsePrompt={setQuickPrompt}
              busy={loading}
            />
          ))}

          {loading ? <PlanningBlock /> : null}
          {error ? (
            <div className="souqy-error" role="alert">
              {cleanAssistantCopy(error)}
            </div>
          ) : null}
        </div>

        <div className="souqy-tools" aria-label="Assistant tools">
          <ToolChip
            icon={<BagIcon />}
            label="Products"
            onClick={() =>
              setQuickPrompt(
                'Review my products and tell me what I should add, edit, or publish next.',
                'ask',
              )
            }
          />
          <ToolChip
            icon={<ChartIcon />}
            label="SEO"
            onClick={() =>
              setQuickPrompt('Recommend a stronger SEO direction for this store.', 'ask')
            }
          />
          <ToolChip
            icon={<TagIcon />}
            label="Bulk edit"
            onClick={() =>
              setQuickPrompt('Stage a batch edit plan for products that need cleanup.', 'agent')
            }
          />
          <ToolChip
            icon={<GridIcon />}
            label="Apps"
            onClick={() =>
              setQuickPrompt(
                'Which Souqna apps or OAuth plugins should I connect for this store?',
                'ask',
              )
            }
          />
        </div>

        <form
          className="souqy-compose"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="souqy-mode" aria-label="Assistant mode">
            <button
              type="button"
              className={mode === 'ask' ? 'is-active' : ''}
              onClick={() => setMode('ask')}
              disabled={loading}
            >
              Ask
              <span>Info, ideas, recommendations</span>
            </button>
            <button
              type="button"
              className={mode === 'agent' ? 'is-active' : ''}
              onClick={() => setMode('agent')}
              disabled={loading}
            >
              Agent
              <span>Stage commands for Apply</span>
            </button>
          </div>
          <div className="souqy-input-wrap">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              dir="auto"
              maxLength={1600}
              disabled={!storefront || loading}
              placeholder={
                mode === 'ask'
                  ? 'Ask for ideas, recommendations, or store advice...'
                  : 'Tell Agent what to stage or execute...'
              }
              aria-label="Ask assistant"
            />
            <button
              className="souqy-send"
              type="submit"
              disabled={!storefront || loading || draft.trim().length === 0}
              aria-label="Send to assistant"
              title="Send"
            >
              <span className="souqy-send-label">Send</span>
              <Send size={15} strokeWidth={2.25} />
            </button>
          </div>
          {activePlan ? (
            <div className="souqy-compose-hint">Review pending plan above before applying.</div>
          ) : mode === 'ask' ? (
            <div className="souqy-compose-hint">
              Ask mode only answers. Switch to Agent to stage executable changes.
            </div>
          ) : null}
        </form>
      </aside>
    </>
  );
}

function MessageBubble({
  message,
  onApply,
  onUsePrompt,
  busy,
}: {
  message: SouqyChatMessageDto;
  onApply: (planId: string) => void;
  onUsePrompt: (prompt: string) => void;
  busy: boolean;
}) {
  const plan = parsePlan(message.metadata.plan);
  const applied = message.metadata.applied as
    | {
        productsCreated?: number;
        productsUpdated?: number;
        categoriesCreated?: number;
        seoUpdated?: boolean;
      }
    | undefined;
  if (message.role === 'user') {
    return (
      <div className="souqy-row is-user">
        <article className="souqy-bubble user" dir="auto">
          <time>{formatTime(message.createdAt)}</time>
          {message.content}
        </article>
      </div>
    );
  }
  return (
    <div className="souqy-row is-assistant">
      <div className="souqy-mini-avatar">
        <SparkleIcon size={14} />
      </div>
      <div className="souqy-assistant-stack">
        <div className="souqy-meta">
          <time>{formatTime(message.createdAt)}</time>
        </div>
        <article className="souqy-bubble assistant" dir="auto">
          <p>{cleanAssistantCopy(message.content)}</p>
          {plan ? (
            <PlanCard plan={plan} onApply={onApply} onUsePrompt={onUsePrompt} busy={busy} />
          ) : null}
          {applied ? (
            <div className="souqy-applied">
              <CheckIcon />
              {[
                applied.productsCreated ? `${applied.productsCreated} created` : '',
                applied.productsUpdated ? `${applied.productsUpdated} updated` : '',
                applied.categoriesCreated ? `${applied.categoriesCreated} categories` : '',
                applied.seoUpdated ? 'SEO updated' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}

function PlanningBlock() {
  const rows = ['Reading store context', 'Drafting checklist', 'Preparing plan'];
  return (
    <div className="souqy-planning" role="status" aria-live="polite">
      <div className="souqy-planning-head">
        <span className="souqy-planning-dot" aria-hidden />
        <span>Planning</span>
      </div>
      <div className="souqy-planning-list" aria-hidden>
        {rows.map((row, index) => (
          <div
            key={row}
            className="souqy-planning-row"
            style={{ '--step-index': index } as React.CSSProperties & { '--step-index': number }}
          >
            <span className="souqy-planning-check" />
            <span>{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onApply,
  onUsePrompt,
  busy,
}: {
  plan: Plan;
  onApply: (planId: string) => void;
  onUsePrompt: (prompt: string) => void;
  busy: boolean;
}) {
  const changeCount =
    (plan.categoryCreates?.length ?? 0) +
    (plan.productCreates?.length ?? 0) +
    (plan.productUpdates?.length ?? 0) +
    (plan.seo ? 1 : 0);
  const questions = plan.questions ?? [];
  const hasChanges = changeCount > 0;
  const checksComplete = hasChanges && plan.status !== 'error';
  const statusLabel =
    plan.status === 'applied'
      ? 'Applied'
      : plan.status === 'error'
        ? 'Needs retry'
        : hasChanges
          ? 'Ready to apply'
          : questions.length
            ? 'Needs details'
            : 'No changes';
  const planClassName = [
    'souqy-plan',
    checksComplete ? 'is-checked' : 'is-open',
    plan.status === 'applied' ? 'is-applied' : '',
    plan.status === 'error' ? 'is-error' : '',
    !hasChanges ? 'is-no-change' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const questionBlocks = questions.length ? (
    <div className="souqy-questions">
      {questions.map((question) => (
        <section key={question.id}>
          <strong>{cleanAssistantCopy(question.label)}</strong>
          {question.detail ? <small dir="auto">{cleanAssistantCopy(question.detail)}</small> : null}
          {question.options?.length ? (
            <div className="souqy-options">
              {question.options.map((option) => (
                <button
                  key={`${question.id}:${option.label}`}
                  type="button"
                  onClick={() => onUsePrompt(option.prompt)}
                >
                  {cleanAssistantCopy(option.label)}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  ) : null;

  if (!hasChanges) {
    const primaryStep = plan.checklist[0];
    const quietStatus =
      plan.status === 'error' ? 'Needs retry' : questions.length ? 'Needs details' : 'Idle';
    const quietTitle = questions.length
      ? cleanAssistantCopy(primaryStep?.title ?? 'I need one detail first')
      : 'Ready when you are';
    const quietBody = questions.length
      ? cleanAssistantCopy(
          primaryStep?.detail ?? 'Answer the next question and I will turn it into a plan.',
        )
      : "Ask me to add products, rewrite copy, or improve SEO. I'll show anything apply-ready here first.";

    return (
      <div className={`${planClassName} souqy-plan-quiet`}>
        <div className="souqy-plan-quiet-top">
          <span className="souqy-plan-quiet-icon" aria-hidden>
            <SparkleIcon size={15} />
          </span>
          <span>{questions.length ? 'Need a little more detail' : 'No changes queued'}</span>
        </div>
        <div className="souqy-plan-quiet-copy">
          <strong>{quietTitle}</strong>
          <small dir="auto">{quietBody}</small>
        </div>
        {questionBlocks}
        <div className="souqy-plan-quiet-foot">
          <span>{questions.length ? 'Answer to build a plan.' : "Ask for a change and I'll stage it here."}</span>
          <span className={`souqy-pill${plan.status === 'error' ? ' error' : ''}`}>{quietStatus}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={planClassName}>
      <div className="souqy-plan-head">
        <span>Plan</span>
        <span className="souqy-plan-state">{statusLabel}</span>
      </div>
      <ol className="souqy-plan-list">
        {plan.checklist.map((item, index) => (
          <li
            key={`${item.title}:${index}`}
            className={checksComplete ? 'is-checked' : 'is-open'}
            style={{ '--step-index': index } as React.CSSProperties & { '--step-index': number }}
          >
            <span className="souqy-step-dot" aria-hidden>
              {checksComplete ? <CheckIcon /> : null}
            </span>
            <div className="souqy-step-copy">
              <strong>{cleanAssistantCopy(item.title)}</strong>
              {item.detail ? <small dir="auto">{cleanAssistantCopy(item.detail)}</small> : null}
            </div>
          </li>
        ))}
      </ol>
      {questionBlocks}
      <div className="souqy-plan-foot">
        <span className="souqy-plan-count">
          {changeCount} staged change{changeCount === 1 ? '' : 's'}
        </span>
        {plan.status === 'applied' ? (
          <span className="souqy-pill applied">Applied</span>
        ) : plan.status === 'error' ? (
          <span className="souqy-pill error">Needs retry</span>
        ) : changeCount > 0 ? (
          <button type="button" onClick={() => onApply(plan.id)} disabled={busy}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
        ) : (
          <span className="souqy-pill">
            {plan.questions?.length ? 'Needs details' : 'No changes'}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="souqy-empty">
      <SparkleIcon size={20} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function StarterGuide({
  storefront,
  onUsePrompt,
}: {
  storefront: StorefrontSummary;
  onUsePrompt: (prompt: string, mode?: SouqyMode) => void;
}) {
  const storeParam = encodeURIComponent(storefront.slug);
  const recommendations = [
    {
      title: storefront.isPublished
        ? 'Sharpen what buyers see'
        : 'Publish when the basics are ready',
      body: storefront.isPublished
        ? 'Check your hero, product images, and SEO so the first visit feels intentional.'
        : 'Add a few real products, confirm contact details, then open the builder and publish.',
      prompt: 'Give me a short launch checklist for this store in Souqna style.',
      mode: 'ask' as SouqyMode,
    },
    {
      title: 'Add or clean up products',
      body: 'Souqna can handle product creation, product copy, categories, and bulk-style edits from one request.',
      prompt: 'Stage a safe product cleanup plan for this store.',
      mode: 'agent' as SouqyMode,
    },
    {
      title: 'Try Apps when you are ready',
      body: 'Use Apps for OAuth-based email, commerce, messaging, and growth integrations as they come online.',
      prompt:
        'Which OAuth plugins should this store connect first for email, analytics, and customer follow-up?',
      mode: 'ask' as SouqyMode,
    },
  ];

  return (
    <div className="souqy-starter">
      <EmptyState
        title={`Let’s improve ${storefront.businessName}`}
        body="The assistant can look at your Souqna setup and suggest practical next moves: products, store polish, apps, SEO, and bulk product work."
      />
      <div className="souqy-recs" aria-label="Assistant recommendations">
        {recommendations.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onUsePrompt(item.prompt, item.mode)}
          >
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </button>
        ))}
      </div>
      <div className="souqy-shortcuts" aria-label="Store shortcuts">
        <a href={`/account/products?store=${storeParam}`}>Products</a>
        <a href={`/account/apps?store=${storeParam}`}>Apps</a>
        <a href={`/account/analytics?store=${storeParam}`}>Analytics</a>
        <a href={`/account/builder?store=${storeParam}`}>Builder</a>
      </div>
    </div>
  );
}

function ToolChip({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick}>
        {icon}
        {label}
      </button>
    );
  }
  return (
    <span className={disabled ? 'is-disabled' : ''}>
      {icon}
      {label}
    </span>
  );
}

function parsePlan(value: unknown): Plan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as Partial<Plan>;
  if (!plan.id || !Array.isArray(plan.checklist)) return null;
  return {
    id: String(plan.id),
    summary: String(plan.summary ?? ''),
    status: plan.status === 'applied' || plan.status === 'error' ? plan.status : 'pending',
    checklist: plan.checklist,
    questions: Array.isArray(plan.questions) ? plan.questions : [],
    categoryCreates: Array.isArray(plan.categoryCreates) ? plan.categoryCreates : [],
    productCreates: Array.isArray(plan.productCreates) ? plan.productCreates : [],
    productUpdates: Array.isArray(plan.productUpdates) ? plan.productUpdates : [],
    seo: plan.seo ?? null,
  };
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function cleanAssistantCopy(value: string): string {
  return value
    .replace(/\bSouqy\s+v1\b/gi, 'Assistant')
    .replace(/\bSouqy\b/g, 'the assistant')
    .replace(/\bsouqy\b/g, 'the assistant')
    .replace(/سوقي/g, 'المساعد');
}

function SparkleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ pointerEvents: 'none' }}
    >
      <path d="M12 2.8c.58 4.5 2.7 6.62 7.2 7.2-4.5.58-6.62 2.7-7.2 7.2-.58-4.5-2.7-6.62-7.2-7.2 4.5-.58 6.62-2.7 7.2-7.2Z" />
      <path d="M18.3 14.8c.24 1.88 1.1 2.74 2.98 2.98-1.88.24-2.74 1.1-2.98 2.98-.24-1.88-1.1-2.74-2.98-2.98 1.88-.24 2.74-1.1 2.98-2.98Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      aria-hidden
    >
      <path d="M5 12.5l4.2 4.1L19 7" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 19h16" />
      <path d="M7 16v-4" />
      <path d="M12 16V7" />
      <path d="M17 16v-7" />
      <path d="M6 10l5-5 4 4 4-6" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 11V5h6l10 10-6 6L4 11Z" />
      <path d="M8 8h.01" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />
    </svg>
  );
}

const styles = `
.souqy-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  border: 0;
  background: rgba(11, 10, 9, 0.18);
}
.souqy-drawer {
  position: fixed;
  inset-block: auto 18px;
  inset-inline-end: 14px;
  z-index: 90;
  width: min(430px, calc(100vw - 28px));
  height: min(720px, calc(100dvh - 34px));
  display: flex;
  flex-direction: column;
  color: ${palette.sand};
  background:
    linear-gradient(145deg, rgba(35, 31, 27, 0.86), rgba(10, 10, 10, 0.94) 48%, rgba(24, 19, 16, 0.9)),
    radial-gradient(120% 80% at 100% 100%, rgba(212, 175, 55, 0.12), transparent 58%);
  border: 1px solid rgba(232, 220, 196, 0.28);
  border-radius: 18px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(212,175,55,0.12);
  overflow: hidden;
  transform: translateY(22px) scale(0.98);
  opacity: 0;
  pointer-events: none;
  transition: transform 220ms ease, opacity 180ms ease;
}
.souqy-drawer.is-open,
.souqy-drawer:target {
  transform: translateY(0) scale(1);
  opacity: 1;
  pointer-events: auto;
}
.souqy-liquid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(118deg, transparent 0 38%, rgba(232,220,196,0.055) 40%, transparent 48%),
    linear-gradient(300deg, transparent 0 68%, rgba(212,175,55,0.07) 70%, transparent 78%);
  backdrop-filter: blur(18px) saturate(130%);
}
.souqy-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 26px 22px;
}
.souqy-avatar-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
}
.souqy-avatar-wrap::before,
.souqy-mini-avatar::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  padding: 3px;
  background: conic-gradient(from 20deg, ${palette.gold}, ${palette.maroon}, ${palette.sandPale}, ${palette.gold});
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  animation: souqy-spin 8s linear infinite;
}
.souqy-avatar,
.souqy-mini-avatar {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 38% 35%, rgba(60, 54, 48, 0.98), rgba(10, 10, 10, 0.98) 70%);
  color: ${palette.sandPale};
  box-shadow: inset 0 0 18px rgba(255,255,255,0.06), 0 0 18px rgba(212,175,55,0.18);
}
.souqy-title { flex: 1; min-width: 0; }
.souqy-name {
  font-family: var(--font-serif);
  font-size: 34px;
  line-height: 1;
  color: ${palette.sandPale};
}
.souqy-ar {
  margin-inline-start: 14px;
  font-family: var(--font-arabic), var(--font-sans);
  font-size: 21px;
  color: rgba(232,220,196,0.78);
}
.souqy-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: rgba(232,220,196,0.76);
}
.souqy-status span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #5ed36a;
  box-shadow: 0 0 12px rgba(94,211,106,0.45);
}
.souqy-icon-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: rgba(232,220,196,0.78);
  background: transparent;
  cursor: pointer;
}
.souqy-icon-btn:hover { background: rgba(232,220,196,0.08); color: ${palette.sandPale}; }
.souqy-day {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  padding: 0 28px 20px;
  color: rgba(232,220,196,0.55);
  font-size: 12px;
}
.souqy-day span {
  height: 1px;
  background: rgba(232,220,196,0.12);
}
.souqy-messages {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 26px 16px;
  scrollbar-width: thin;
}
.souqy-row {
  display: flex;
  gap: 12px;
  margin: 14px 0 22px;
}
.souqy-row.is-user { justify-content: flex-end; }
.souqy-bubble {
  position: relative;
  max-width: min(360px, 100%);
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.souqy-bubble.user {
  min-width: 230px;
  padding: 20px 22px;
  background: linear-gradient(140deg, rgba(123,30,38,0.96), rgba(70,14,22,0.92));
  border: 1px solid rgba(185, 50, 65, 0.38);
  color: rgba(255,244,222,0.94);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.souqy-bubble.user time {
  position: absolute;
  inset-block-start: 14px;
  inset-inline-end: 16px;
  font-size: 11px;
  color: rgba(255,244,222,0.5);
}
.souqy-mini-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  margin-top: 2px;
}
.souqy-mini-avatar::before { inset: -2px; padding: 2px; }
.souqy-assistant-stack { min-width: 0; flex: 1; }
.souqy-meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(232,220,196,0.7);
}
.souqy-meta strong { color: ${palette.sandPale}; font-weight: 650; }
.souqy-meta time { font-size: 12px; color: rgba(232,220,196,0.45); }
.souqy-bubble.assistant {
  padding: 20px;
  background: rgba(30, 28, 25, 0.58);
  border: 1px solid rgba(232,220,196,0.13);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.souqy-bubble.assistant p {
  margin: 0 0 14px;
  color: rgba(245,239,226,0.9);
}
.souqy-plan {
  border: 1px solid rgba(232,220,196,0.13);
  border-radius: 8px;
  padding: 15px;
  background: rgba(14, 13, 12, 0.34);
}
.souqy-plan ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.souqy-plan li {
  position: relative;
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  padding-bottom: 16px;
}
.souqy-plan li:not(.last)::after {
  content: '';
  position: absolute;
  inset-inline-start: 11px;
  inset-block-start: 24px;
  bottom: -2px;
  width: 1px;
  background: rgba(212,175,55,0.35);
}
.souqy-step-dot {
  width: 23px;
  height: 23px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 2px solid rgba(212,175,55,0.75);
  color: ${palette.ink};
  background: rgba(212,175,55,0.72);
}
.souqy-plan li.last .souqy-step-dot {
  background: transparent;
  border-color: rgba(232,220,196,0.58);
}
.souqy-plan strong {
  display: block;
  color: rgba(245,239,226,0.94);
  font-size: 14px;
}
.souqy-plan small {
  display: block;
  margin-top: 2px;
  color: rgba(232,220,196,0.58);
  font-size: 12px;
  line-height: 1.45;
}
.souqy-questions {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(232,220,196,0.1);
}
.souqy-questions section {
  display: grid;
  gap: 6px;
}
.souqy-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.souqy-options button {
  border: 1px solid rgba(212,175,55,0.28);
  border-radius: 999px;
  padding: 7px 10px;
  color: rgba(245,239,226,0.9);
  background: rgba(123,30,38,0.34);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}
.souqy-options button:hover {
  border-color: rgba(245,201,119,0.5);
  background: rgba(123,30,38,0.48);
}
.souqy-plan-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(232,220,196,0.1);
  color: rgba(232,220,196,0.58);
  font-size: 12px;
}
.souqy-plan-foot button {
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  color: ${palette.ink};
  background: linear-gradient(135deg, ${palette.goldSoft}, ${palette.gold});
  font-weight: 700;
  cursor: pointer;
}
.souqy-plan-foot button:disabled { opacity: 0.55; cursor: progress; }
.souqy-pill {
  border-radius: 999px;
  border: 1px solid rgba(232,220,196,0.16);
  padding: 5px 9px;
  color: rgba(232,220,196,0.66);
}
.souqy-pill.applied { color: #9BE29B; border-color: rgba(155,226,155,0.35); }
.souqy-pill.error { color: #F0A29A; border-color: rgba(240,162,154,0.35); }
.souqy-applied,
.souqy-thinking,
.souqy-error,
.souqy-empty {
  border-radius: 8px;
  border: 1px solid rgba(232,220,196,0.12);
  background: rgba(232,220,196,0.055);
  color: rgba(232,220,196,0.72);
}
.souqy-applied {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 10px;
  color: #A9E8A9;
  font-size: 12px;
}
.souqy-thinking {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  font-size: 12px;
}
.souqy-thinking span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${palette.gold};
  animation: souqy-pulse 900ms ease-in-out infinite;
}
.souqy-error {
  padding: 10px 12px;
  color: #F0A29A;
  font-size: 12px;
}
.souqy-empty {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin: 16px 0;
  padding: 16px;
}
.souqy-empty strong { color: ${palette.sandPale}; }
.souqy-empty p { margin: 0; font-size: 13px; color: rgba(232,220,196,0.62); }
.souqy-starter {
  display: grid;
  gap: 10px;
}
.souqy-recs {
  display: grid;
  gap: 8px;
}
.souqy-recs button {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 12px 13px;
  border-radius: 8px;
  border: 1px solid rgba(232,220,196,0.13);
  background: rgba(232,220,196,0.055);
  color: rgba(245,239,226,0.9);
  text-align: start;
  cursor: pointer;
}
.souqy-recs button:hover {
  border-color: rgba(245,201,119,0.38);
  background: rgba(212,175,55,0.09);
}
.souqy-recs strong {
  color: ${palette.sandPale};
  font-size: 13px;
}
.souqy-recs span {
  color: rgba(232,220,196,0.62);
  font-size: 12px;
  line-height: 1.45;
}
.souqy-shortcuts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}
.souqy-shortcuts a {
  min-width: 0;
  border-radius: 999px;
  border: 1px solid rgba(212,175,55,0.22);
  padding: 8px 9px;
  color: rgba(245,239,226,0.9);
  background: rgba(123,30,38,0.22);
  text-align: center;
  text-decoration: none;
  font-size: 11.5px;
  font-weight: 700;
}
.souqy-shortcuts a:hover {
  border-color: rgba(245,201,119,0.46);
  background: rgba(123,30,38,0.34);
}
.souqy-tools {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 24px 18px;
}
.souqy-tools span,
.souqy-tools button {
  min-width: 0;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 999px;
  border: 1px solid rgba(232,220,196,0.16);
  background: rgba(18,17,16,0.55);
  color: rgba(245,239,226,0.9);
  font-size: 12.5px;
  font-weight: 650;
}
.souqy-tools button {
  font-family: var(--font-sans);
  cursor: pointer;
}
.souqy-tools button:hover {
  border-color: rgba(245,201,119,0.38);
  background: rgba(212,175,55,0.1);
}
.souqy-tools span svg,
.souqy-tools button svg { color: ${palette.goldSoft}; flex: 0 0 auto; }
.souqy-tools span.is-disabled { opacity: 0.45; }
.souqy-compose {
  position: relative;
  margin-top: auto;
  padding: 24px;
  border-top: 1px solid rgba(232,220,196,0.12);
  background: rgba(15,14,13,0.42);
}
.souqy-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.souqy-mode button {
  min-width: 0;
  border: 1px solid rgba(232,220,196,0.16);
  border-radius: 8px;
  padding: 9px 10px;
  background: rgba(18,17,16,0.52);
  color: rgba(245,239,226,0.82);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 750;
  text-align: start;
  cursor: pointer;
}
.souqy-mode button span {
  display: block;
  margin-top: 2px;
  color: rgba(232,220,196,0.52);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
}
.souqy-mode button.is-active {
  border-color: rgba(245,201,119,0.5);
  background: rgba(212,175,55,0.14);
  color: ${palette.sandPale};
}
.souqy-mode button:disabled {
  cursor: progress;
  opacity: 0.62;
}
.souqy-compose textarea {
  width: 100%;
  min-height: 116px;
  max-height: 180px;
  resize: none;
  border-radius: 16px;
  border: 1px solid rgba(232,220,196,0.28);
  background: rgba(33,30,27,0.64);
  color: ${palette.sandPale};
  outline: none;
  padding: 22px 76px 22px 20px;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.souqy-compose textarea::placeholder { color: rgba(232,220,196,0.42); }
.souqy-send {
  position: absolute;
  inset-inline-end: 44px;
  inset-block-end: 46px;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  border: 0;
  display: grid;
  place-items: center;
  color: ${palette.ink};
  background: radial-gradient(circle at 32% 28%, #FFE5A8, #F5C977 58%, #D4AF37);
  box-shadow: 0 12px 28px rgba(0,0,0,0.32), 0 0 18px rgba(212,175,55,0.26);
  cursor: pointer;
}
.souqy-send:disabled { opacity: 0.48; cursor: not-allowed; }
.souqy-compose-hint {
  margin-top: 8px;
  color: rgba(232,220,196,0.52);
  font-size: 11px;
}
[data-theme='light'] .souqy-drawer {
  color: ${palette.ink};
  background:
    linear-gradient(145deg, rgba(241, 233, 215, 0.92), rgba(232, 220, 196, 0.88) 52%, rgba(255, 249, 235, 0.9)),
    radial-gradient(120% 80% at 100% 100%, rgba(139, 58, 58, 0.08), transparent 58%);
  border-color: rgba(31, 27, 22, 0.18);
  box-shadow: 0 24px 70px rgba(31,27,22,0.22), inset 0 0 0 1px rgba(255,255,255,0.38);
}
[data-theme='light'] .souqy-liquid {
  background:
    linear-gradient(118deg, transparent 0 38%, rgba(255,255,255,0.28) 40%, transparent 48%),
    linear-gradient(300deg, transparent 0 68%, rgba(139,58,58,0.07) 70%, transparent 78%);
  backdrop-filter: blur(18px) saturate(118%);
}
[data-theme='light'] .souqy-avatar,
[data-theme='light'] .souqy-mini-avatar {
  background: radial-gradient(circle at 38% 35%, rgba(58, 54, 51, 0.98), rgba(31,27,22,0.98) 70%);
  color: ${palette.sandPale};
}
[data-theme='light'] .souqy-name {
  color: ${palette.ink};
}
[data-theme='light'] .souqy-ar,
[data-theme='light'] .souqy-status,
[data-theme='light'] .souqy-day,
[data-theme='light'] .souqy-meta,
[data-theme='light'] .souqy-plan small,
[data-theme='light'] .souqy-plan-foot,
[data-theme='light'] .souqy-compose-hint {
  color: rgba(31,27,22,0.62);
}
[data-theme='light'] .souqy-day span,
[data-theme='light'] .souqy-compose {
  border-color: rgba(31,27,22,0.12);
}
[data-theme='light'] .souqy-day span {
  background: rgba(31,27,22,0.12);
}
[data-theme='light'] .souqy-icon-btn {
  color: rgba(31,27,22,0.66);
}
[data-theme='light'] .souqy-icon-btn:hover {
  background: rgba(31,27,22,0.07);
  color: ${palette.ink};
}
[data-theme='light'] .souqy-meta strong,
[data-theme='light'] .souqy-plan strong,
[data-theme='light'] .souqy-empty strong {
  color: ${palette.ink};
}
[data-theme='light'] .souqy-meta time {
  color: rgba(31,27,22,0.42);
}
[data-theme='light'] .souqy-bubble.assistant {
  background: rgba(255, 249, 235, 0.5);
  border-color: rgba(31,27,22,0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.54);
}
[data-theme='light'] .souqy-bubble.assistant p {
  color: rgba(31,27,22,0.86);
}
[data-theme='light'] .souqy-plan {
  background: rgba(232, 220, 196, 0.38);
  border-color: rgba(31,27,22,0.12);
}
[data-theme='light'] .souqy-plan-foot {
  border-color: rgba(31,27,22,0.1);
}
[data-theme='light'] .souqy-plan li:not(.last)::after {
  background: rgba(168,137,63,0.45);
}
[data-theme='light'] .souqy-plan li.last .souqy-step-dot {
  border-color: rgba(31,27,22,0.42);
}
[data-theme='light'] .souqy-questions {
  border-color: rgba(31,27,22,0.1);
}
[data-theme='light'] .souqy-options button {
  background: rgba(123,30,38,0.08);
  border-color: rgba(123,30,38,0.18);
  color: rgba(75,17,24,0.88);
}
[data-theme='light'] .souqy-options button:hover {
  background: rgba(123,30,38,0.13);
  border-color: rgba(123,30,38,0.28);
}
[data-theme='light'] .souqy-pill {
  border-color: rgba(31,27,22,0.14);
  color: rgba(31,27,22,0.62);
}
[data-theme='light'] .souqy-applied,
[data-theme='light'] .souqy-thinking,
[data-theme='light'] .souqy-error,
[data-theme='light'] .souqy-empty {
  background: rgba(255,249,235,0.42);
  border-color: rgba(31,27,22,0.12);
  color: rgba(31,27,22,0.68);
}
[data-theme='light'] .souqy-applied {
  color: #3f7a3f;
}
[data-theme='light'] .souqy-error {
  color: #a55044;
}
[data-theme='light'] .souqy-empty p {
  color: rgba(31,27,22,0.6);
}
[data-theme='light'] .souqy-recs button {
  background: rgba(255,249,235,0.42);
  border-color: rgba(31,27,22,0.12);
  color: rgba(31,27,22,0.82);
}
[data-theme='light'] .souqy-recs button:hover {
  background: rgba(212,175,55,0.13);
  border-color: rgba(168,137,63,0.24);
}
[data-theme='light'] .souqy-recs strong {
  color: ${palette.ink};
}
[data-theme='light'] .souqy-recs span {
  color: rgba(31,27,22,0.6);
}
[data-theme='light'] .souqy-shortcuts a {
  background: rgba(123,30,38,0.07);
  border-color: rgba(123,30,38,0.16);
  color: rgba(75,17,24,0.88);
}
[data-theme='light'] .souqy-shortcuts a:hover {
  background: rgba(123,30,38,0.12);
  border-color: rgba(123,30,38,0.26);
}
[data-theme='light'] .souqy-tools span,
[data-theme='light'] .souqy-tools button {
  background: rgba(255,249,235,0.48);
  border-color: rgba(31,27,22,0.14);
  color: rgba(31,27,22,0.82);
}
[data-theme='light'] .souqy-compose {
  background: rgba(241,233,215,0.5);
}
[data-theme='light'] .souqy-mode button {
  background: rgba(255,249,235,0.46);
  border-color: rgba(31,27,22,0.14);
  color: rgba(31,27,22,0.82);
}
[data-theme='light'] .souqy-mode button span {
  color: rgba(31,27,22,0.56);
}
[data-theme='light'] .souqy-mode button.is-active {
  background: rgba(212,175,55,0.18);
  border-color: rgba(168,137,63,0.36);
  color: ${palette.ink};
}
[data-theme='light'] .souqy-compose textarea {
  background: rgba(255,249,235,0.58);
  border-color: rgba(31,27,22,0.2);
  color: ${palette.ink};
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
}
[data-theme='light'] .souqy-compose textarea::placeholder {
  color: rgba(31,27,22,0.42);
}
.souqy-drawer {
  left: 14px;
  right: auto;
  bottom: 16px;
  width: min(410px, calc(100vw - 28px));
  height: min(620px, calc(100dvh - 32px));
  direction: ltr;
  text-align: left;
  color: var(--foreground);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--background) 98%, white 2%), color-mix(in srgb, var(--surface-elevated, var(--background)) 94%, var(--color-gold) 6%));
  border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  border-radius: 22px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.65);
}
.souqy-liquid {
  display: none;
}
.souqy-head {
  gap: 12px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--foreground) 9%, transparent);
  background: color-mix(in srgb, var(--background) 88%, transparent);
}
.souqy-avatar-wrap {
  width: 46px;
  height: 46px;
}
.souqy-avatar-wrap::before,
.souqy-mini-avatar::before {
  display: none;
}
.souqy-avatar,
.souqy-mini-avatar {
  background: radial-gradient(circle at 35% 30%, #34302a, #11100f 68%, #050505);
  color: #f5efe3;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 24px rgba(0,0,0,0.18);
}
.souqy-avatar {
  width: 46px;
  height: 46px;
  border: 1px solid color-mix(in srgb, var(--color-gold) 36%, transparent);
}
.souqy-avatar svg {
  width: 34px;
  height: 34px;
}
.souqy-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.souqy-name {
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 650;
  letter-spacing: 0;
}
.souqy-ar {
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 999px;
  padding: 4px 7px;
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
  background: color-mix(in srgb, var(--background) 74%, transparent);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.souqy-status {
  margin-top: 5px;
  color: color-mix(in srgb, var(--foreground) 58%, transparent);
  font-size: 12px;
}
.souqy-status span {
  width: 7px;
  height: 7px;
  background: #3ac36c;
  box-shadow: none;
}
.souqy-icon-btn {
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  color: color-mix(in srgb, var(--foreground) 62%, transparent);
  background: color-mix(in srgb, var(--background) 72%, transparent);
}
.souqy-icon-btn:hover {
  background: color-mix(in srgb, var(--foreground) 7%, transparent);
  color: var(--foreground);
}
.souqy-day {
  gap: 12px;
  padding: 12px 18px 8px;
  color: color-mix(in srgb, var(--foreground) 42%, transparent);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.souqy-day span {
  background: color-mix(in srgb, var(--foreground) 9%, transparent);
}
.souqy-messages {
  padding: 0 18px 14px;
}
.souqy-empty {
  margin: 10px 0 12px;
  padding: 18px;
  border-radius: 16px;
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--background) 94%, white 6%), color-mix(in srgb, var(--surface-elevated, var(--background)) 94%, var(--color-gold) 6%));
  color: color-mix(in srgb, var(--foreground) 64%, transparent);
  text-align: left;
}
.souqy-empty svg {
  width: 18px;
  height: 18px;
  color: var(--color-gold);
}
.souqy-empty strong,
.souqy-recs strong,
.souqy-meta strong,
.souqy-plan strong {
  color: var(--foreground);
}
.souqy-empty p,
.souqy-recs span,
.souqy-plan small {
  color: color-mix(in srgb, var(--foreground) 58%, transparent);
}
.souqy-row {
  margin: 12px 0 18px;
}
.souqy-bubble {
  border-radius: 16px;
  font-size: 13.5px;
}
.souqy-bubble.user {
  min-width: 0;
  padding: 14px 16px 16px;
  color: #f7efe1;
  background: #11100f;
  border-color: color-mix(in srgb, var(--color-gold) 26%, transparent);
}
.souqy-bubble.user time {
  position: static;
  display: block;
  margin-bottom: 6px;
  color: rgba(247,239,225,0.52);
}
.souqy-mini-avatar {
  width: 30px;
  height: 30px;
  flex-basis: 30px;
}
.souqy-meta {
  color: color-mix(in srgb, var(--foreground) 48%, transparent);
}
.souqy-bubble.assistant {
  padding: 15px;
  background: color-mix(in srgb, var(--background) 86%, var(--foreground) 3%);
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  box-shadow: none;
}
.souqy-bubble.assistant p {
  color: color-mix(in srgb, var(--foreground) 84%, transparent);
}
.souqy-recs {
  gap: 7px;
}
.souqy-recs button {
  border-radius: 14px;
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background: color-mix(in srgb, var(--background) 92%, var(--color-gold) 4%);
  color: var(--foreground);
}
.souqy-recs button:hover {
  border-color: color-mix(in srgb, var(--color-gold) 32%, var(--foreground) 8%);
  background: color-mix(in srgb, var(--color-gold) 10%, var(--background) 90%);
}
.souqy-shortcuts {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.souqy-shortcuts a,
.souqy-tools span,
.souqy-tools button {
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background: color-mix(in srgb, var(--background) 88%, transparent);
  color: color-mix(in srgb, var(--foreground) 78%, transparent);
}
.souqy-shortcuts a:hover,
.souqy-tools button:hover {
  border-color: color-mix(in srgb, var(--color-gold) 34%, transparent);
  background: color-mix(in srgb, var(--color-gold) 10%, var(--background) 90%);
}
.souqy-tools {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  overflow: visible;
  padding: 8px 18px 12px;
  border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
}
.souqy-tools span,
.souqy-tools button {
  min-height: 34px;
  padding: 0 8px;
  font-size: 11.5px;
}
.souqy-tools span svg,
.souqy-tools button svg {
  color: var(--color-gold);
}
.souqy-compose {
  padding: 12px 14px 14px;
  border-top-color: color-mix(in srgb, var(--foreground) 8%, transparent);
  background: color-mix(in srgb, var(--background) 90%, transparent);
}
.souqy-mode {
  gap: 6px;
  margin-bottom: 9px;
}
.souqy-mode button {
  border-radius: 12px;
  padding: 8px 10px;
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background: color-mix(in srgb, var(--background) 88%, transparent);
  color: color-mix(in srgb, var(--foreground) 72%, transparent);
  font-size: 12.5px;
  text-align: left;
}
.souqy-mode button span {
  color: color-mix(in srgb, var(--foreground) 45%, transparent);
  font-size: 10.5px;
}
.souqy-mode button.is-active {
  border-color: color-mix(in srgb, var(--color-gold) 42%, var(--foreground) 8%);
  background: color-mix(in srgb, var(--color-gold) 13%, var(--background) 87%);
  color: var(--foreground);
}
.souqy-compose textarea {
  min-height: 76px;
  max-height: 132px;
  border-radius: 16px;
  border-color: color-mix(in srgb, var(--foreground) 13%, transparent);
  background: color-mix(in srgb, var(--background) 96%, white 4%);
  color: var(--foreground);
  padding: 15px 60px 15px 15px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
}
.souqy-compose textarea::placeholder {
  color: color-mix(in srgb, var(--foreground) 42%, transparent);
}
.souqy-send {
  right: 26px;
  left: auto;
  bottom: 42px;
  width: 42px;
  height: 42px;
  color: #f5efe3;
  background: #11100f;
  box-shadow: 0 10px 24px rgba(0,0,0,0.18);
}
.souqy-compose-hint {
  color: color-mix(in srgb, var(--foreground) 48%, transparent);
  font-size: 11px;
}
.souqy-plan,
.souqy-questions {
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background: color-mix(in srgb, var(--background) 90%, transparent);
}
.souqy-plan-foot {
  border-color: color-mix(in srgb, var(--foreground) 9%, transparent);
  color: color-mix(in srgb, var(--foreground) 52%, transparent);
}
.souqy-applied,
.souqy-thinking,
.souqy-error {
  border-radius: 12px;
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  background: color-mix(in srgb, var(--background) 90%, transparent);
  color: color-mix(in srgb, var(--foreground) 68%, transparent);
}
[data-theme='light'] .souqy-drawer {
  color: var(--foreground);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--background) 98%, white 2%), color-mix(in srgb, var(--surface-elevated, var(--background)) 94%, var(--color-gold) 6%));
  border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
  box-shadow: 0 24px 70px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.65);
}
[data-theme='light'] .souqy-head,
[data-theme='light'] .souqy-compose {
  background: color-mix(in srgb, var(--background) 90%, transparent);
  border-color: color-mix(in srgb, var(--foreground) 8%, transparent);
}
[data-theme='light'] .souqy-avatar,
[data-theme='light'] .souqy-mini-avatar {
  background: radial-gradient(circle at 35% 30%, #34302a, #11100f 68%, #050505);
  color: #f5efe3;
}
[data-theme='light'] .souqy-name,
[data-theme='light'] .souqy-empty strong,
[data-theme='light'] .souqy-recs strong,
[data-theme='light'] .souqy-meta strong,
[data-theme='light'] .souqy-plan strong {
  color: var(--foreground);
}
[data-theme='light'] .souqy-ar,
[data-theme='light'] .souqy-status,
[data-theme='light'] .souqy-day,
[data-theme='light'] .souqy-meta,
[data-theme='light'] .souqy-plan small,
[data-theme='light'] .souqy-compose-hint,
[data-theme='light'] .souqy-empty p,
[data-theme='light'] .souqy-recs span {
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
}
[data-theme='light'] .souqy-empty,
[data-theme='light'] .souqy-bubble.assistant,
[data-theme='light'] .souqy-recs button,
[data-theme='light'] .souqy-shortcuts a,
[data-theme='light'] .souqy-tools span,
[data-theme='light'] .souqy-tools button,
[data-theme='light'] .souqy-mode button,
[data-theme='light'] .souqy-compose textarea,
[data-theme='light'] .souqy-plan,
[data-theme='light'] .souqy-questions,
[data-theme='light'] .souqy-applied,
[data-theme='light'] .souqy-thinking,
[data-theme='light'] .souqy-error {
  background: color-mix(in srgb, var(--background) 92%, var(--color-gold) 4%);
  border-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  color: color-mix(in srgb, var(--foreground) 78%, transparent);
}
[data-theme='light'] .souqy-bubble.assistant p,
[data-theme='light'] .souqy-compose textarea {
  color: color-mix(in srgb, var(--foreground) 84%, transparent);
}
[data-theme='light'] .souqy-mode button.is-active {
  background: color-mix(in srgb, var(--color-gold) 13%, var(--background) 87%);
  border-color: color-mix(in srgb, var(--color-gold) 42%, var(--foreground) 8%);
  color: var(--foreground);
}
[data-theme='light'] .souqy-send {
  color: #f5efe3;
  background: #11100f;
}
[data-theme='dark'] .souqy-drawer {
  color: #f5efe3;
  background: linear-gradient(180deg, rgba(20,19,18,0.98), rgba(31,28,24,0.98));
  border-color: rgba(245,239,227,0.13);
  box-shadow: 0 24px 72px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.07);
}
[data-theme='dark'] .souqy-head,
[data-theme='dark'] .souqy-compose {
  background: rgba(15,14,13,0.72);
  border-color: rgba(245,239,227,0.1);
}
[data-theme='dark'] .souqy-name,
[data-theme='dark'] .souqy-empty strong,
[data-theme='dark'] .souqy-recs strong,
[data-theme='dark'] .souqy-meta strong,
[data-theme='dark'] .souqy-plan strong {
  color: #f5efe3;
}
[data-theme='dark'] .souqy-bubble.assistant,
[data-theme='dark'] .souqy-empty,
[data-theme='dark'] .souqy-recs button,
[data-theme='dark'] .souqy-shortcuts a,
[data-theme='dark'] .souqy-tools span,
[data-theme='dark'] .souqy-tools button,
[data-theme='dark'] .souqy-mode button,
[data-theme='dark'] .souqy-compose textarea,
[data-theme='dark'] .souqy-plan,
[data-theme='dark'] .souqy-questions,
[data-theme='dark'] .souqy-applied,
[data-theme='dark'] .souqy-thinking,
[data-theme='dark'] .souqy-error {
  background: rgba(255,255,255,0.045);
  border-color: rgba(245,239,227,0.11);
  color: rgba(245,239,227,0.82);
}
[data-theme='dark'] .souqy-bubble.assistant p,
[data-theme='dark'] .souqy-compose textarea {
  color: rgba(245,239,227,0.9);
}

/* Glass AI pass */
.souqy-drawer {
  overflow: hidden;
  border-color: rgba(245, 239, 227, 0.18);
  background:
    radial-gradient(circle at 12% 6%, rgba(245, 201, 119, 0.18), transparent 26%),
    radial-gradient(circle at 92% 14%, rgba(107, 142, 118, 0.14), transparent 28%),
    linear-gradient(145deg, rgba(17, 16, 15, 0.82), rgba(29, 25, 21, 0.7) 52%, rgba(8, 8, 8, 0.84));
  box-shadow:
    0 26px 90px rgba(0, 0, 0, 0.54),
    0 0 0 1px rgba(255, 255, 255, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -1px 0 rgba(245, 201, 119, 0.08);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
}

.souqy-drawer::before,
.souqy-drawer::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.souqy-drawer::before {
  z-index: 0;
  background:
    conic-gradient(from 130deg at 18% 2%, transparent 0 18%, rgba(245, 201, 119, 0.28) 26%, transparent 36% 100%),
    linear-gradient(115deg, transparent 0 28%, rgba(255, 255, 255, 0.1) 43%, transparent 58% 100%);
  mix-blend-mode: screen;
  opacity: 0.42;
  transform: translateX(-22%);
  animation: souqy-glass-scan 9s ease-in-out infinite;
}

.souqy-drawer::after {
  z-index: 0;
  background-image:
    linear-gradient(rgba(245, 239, 227, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(245, 239, 227, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.18) 62%, transparent);
  opacity: 0.34;
}

.souqy-drawer > *:not(.souqy-liquid) {
  position: relative;
  z-index: 2;
}

.souqy-liquid {
  display: block;
  position: absolute;
  inset: -24%;
  z-index: 0;
  background:
    radial-gradient(circle at 22% 24%, rgba(245, 201, 119, 0.2), transparent 18%),
    radial-gradient(circle at 76% 12%, rgba(168, 137, 63, 0.18), transparent 20%),
    radial-gradient(circle at 70% 72%, rgba(92, 123, 99, 0.18), transparent 24%);
  filter: blur(8px);
  opacity: 0.48;
  animation: souqy-aurora-drift 18s ease-in-out infinite alternate;
}

.souqy-head {
  margin: 10px 10px 0;
  border: 1px solid rgba(245, 239, 227, 0.1);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 14px 34px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.souqy-avatar-wrap::before,
.souqy-mini-avatar::before {
  display: block;
  background: conic-gradient(from 0deg, rgba(245, 239, 227, 0.08), rgba(245, 201, 119, 0.86), rgba(123, 30, 38, 0.45), rgba(245, 239, 227, 0.08));
  opacity: 0.94;
  animation: souqy-spin 8s linear infinite;
}

.souqy-avatar {
  border-color: rgba(245, 201, 119, 0.42);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 22px rgba(245, 201, 119, 0.26),
    0 14px 32px rgba(0, 0, 0, 0.34);
}

.souqy-ar {
  border-color: rgba(245, 201, 119, 0.18);
  background: rgba(0, 0, 0, 0.2);
  color: rgba(245, 239, 227, 0.68);
}

.souqy-status {
  color: rgba(245, 239, 227, 0.76);
  font-weight: 600;
}

.souqy-status span {
  background: #40e086;
  box-shadow: 0 0 12px rgba(64, 224, 134, 0.72);
  animation: souqy-status-pulse 1.8s ease-in-out infinite;
}

.souqy-signal {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 7px;
  margin-top: 8px;
}

.souqy-signal span {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(245, 201, 119, 0.18), rgba(245, 239, 227, 0.82), rgba(245, 201, 119, 0.16));
  opacity: 0.32;
  transform-origin: left center;
  animation: souqy-signal-flow 1.8s ease-in-out infinite;
}

.souqy-signal span:nth-child(2) { animation-delay: 120ms; }
.souqy-signal span:nth-child(3) { animation-delay: 240ms; }
.souqy-signal span:nth-child(4) { animation-delay: 360ms; }

.souqy-day {
  padding-top: 14px;
  color: rgba(245, 239, 227, 0.48);
}

.souqy-messages {
  padding: 8px 18px 14px;
  scrollbar-color: rgba(245, 201, 119, 0.5) rgba(255, 255, 255, 0.04);
}

.souqy-bubble.assistant,
.souqy-empty,
.souqy-plan,
.souqy-questions,
.souqy-applied,
.souqy-thinking,
.souqy-error {
  border-color: rgba(245, 239, 227, 0.16);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.045)),
    radial-gradient(circle at 12% 0%, rgba(245, 201, 119, 0.12), transparent 38%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    0 16px 34px rgba(0, 0, 0, 0.2);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.souqy-bubble.assistant {
  border-radius: 18px;
}

.souqy-bubble.assistant p {
  color: rgba(245, 239, 227, 0.94);
  font-size: 14px;
  line-height: 1.55;
}

.souqy-plan {
  background:
    linear-gradient(150deg, rgba(12, 11, 10, 0.52), rgba(255, 255, 255, 0.06)),
    radial-gradient(circle at 0% 0%, rgba(245, 201, 119, 0.13), transparent 36%);
}

.souqy-step-dot {
  border-color: rgba(245, 201, 119, 0.52);
  box-shadow: 0 0 16px rgba(245, 201, 119, 0.16);
}

.souqy-plan-foot {
  border-color: rgba(245, 239, 227, 0.1);
}

.souqy-tools {
  border-top: 1px solid rgba(245, 239, 227, 0.1);
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.12));
}

.souqy-tools span,
.souqy-tools button,
.souqy-mode button,
.souqy-shortcuts a,
.souqy-recs button {
  border-color: rgba(245, 239, 227, 0.14);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.souqy-tools button:hover,
.souqy-shortcuts a:hover,
.souqy-recs button:hover,
.souqy-mode button.is-active {
  border-color: rgba(245, 201, 119, 0.42);
  background:
    linear-gradient(145deg, rgba(245, 201, 119, 0.18), rgba(255, 255, 255, 0.05));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 10px 24px rgba(245, 201, 119, 0.08);
}

.souqy-compose {
  margin: 0 10px 10px;
  border: 1px solid rgba(245, 239, 227, 0.1);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.03));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 -14px 34px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.souqy-compose textarea {
  border-color: rgba(245, 201, 119, 0.18);
  background:
    linear-gradient(145deg, rgba(5, 5, 5, 0.34), rgba(255, 255, 255, 0.055));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.12);
}

.souqy-compose textarea:focus {
  outline: none;
  border-color: rgba(245, 201, 119, 0.46);
  box-shadow:
    0 0 0 3px rgba(245, 201, 119, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.souqy-send {
  background:
    radial-gradient(circle at 35% 28%, rgba(245, 239, 227, 0.22), transparent 28%),
    linear-gradient(145deg, #191715, #050505);
  border: 1px solid rgba(245, 201, 119, 0.18);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.3),
    0 0 18px rgba(245, 201, 119, 0.18);
}

[data-theme='light'] .souqy-drawer {
  color: #191613;
  border-color: rgba(31, 27, 22, 0.12);
  background:
    radial-gradient(circle at 12% 6%, rgba(212, 175, 55, 0.18), transparent 28%),
    radial-gradient(circle at 92% 14%, rgba(90, 125, 102, 0.11), transparent 28%),
    linear-gradient(145deg, rgba(255, 252, 244, 0.86), rgba(244, 237, 222, 0.74));
  box-shadow:
    0 26px 90px rgba(31, 27, 22, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

[data-theme='light'] .souqy-drawer::before {
  opacity: 0.28;
}

[data-theme='light'] .souqy-drawer::after {
  background-image:
    linear-gradient(rgba(31, 27, 22, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 27, 22, 0.035) 1px, transparent 1px);
}

[data-theme='light'] .souqy-liquid {
  opacity: 0.5;
}

[data-theme='light'] .souqy-head,
[data-theme='light'] .souqy-compose,
[data-theme='light'] .souqy-bubble.assistant,
[data-theme='light'] .souqy-empty,
[data-theme='light'] .souqy-plan,
[data-theme='light'] .souqy-questions,
[data-theme='light'] .souqy-applied,
[data-theme='light'] .souqy-thinking,
[data-theme='light'] .souqy-error,
[data-theme='light'] .souqy-tools span,
[data-theme='light'] .souqy-tools button,
[data-theme='light'] .souqy-mode button,
[data-theme='light'] .souqy-shortcuts a,
[data-theme='light'] .souqy-recs button {
  border-color: rgba(31, 27, 22, 0.12);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.58), rgba(255, 249, 235, 0.34));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

[data-theme='light'] .souqy-bubble.assistant p,
[data-theme='light'] .souqy-compose textarea {
  color: rgba(31, 27, 22, 0.86);
}

[data-theme='light'] .souqy-ar {
  color: rgba(31, 27, 22, 0.58);
  background: rgba(255, 255, 255, 0.36);
}

[data-theme='light'] .souqy-status {
  color: rgba(31, 27, 22, 0.66);
}

[data-theme='light'] .souqy-signal span {
  background: linear-gradient(90deg, rgba(168, 137, 63, 0.2), rgba(31, 27, 22, 0.68), rgba(168, 137, 63, 0.16));
}

[data-theme='light'] .souqy-compose textarea {
  border-color: rgba(168, 137, 63, 0.22);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.7), rgba(255, 249, 235, 0.38));
}

/* Calm chat pass: ChatGPT/Claude-style, low-noise, message-first. */
.souqy-drawer {
  left: 16px;
  right: auto;
  bottom: 16px;
  width: min(430px, calc(100vw - 32px));
  height: min(680px, calc(100dvh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 22px;
  color: var(--foreground);
  background: color-mix(in srgb, var(--background) 96%, var(--surface-elevated, var(--background)) 4%);
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
  animation: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.souqy-drawer::before,
.souqy-drawer::after,
.souqy-liquid,
.souqy-signal,
.souqy-day,
.souqy-tools,
.souqy-mini-avatar,
.souqy-meta {
  display: none !important;
}

.souqy-drawer > *:not(.souqy-liquid) {
  position: relative;
  z-index: 1;
}

.souqy-head {
  flex: 0 0 auto;
  margin: 0;
  gap: 11px;
  padding: 14px 16px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.souqy-avatar-wrap {
  width: 38px;
  height: 38px;
}

.souqy-avatar-wrap::before,
.souqy-avatar::before,
.souqy-avatar::after {
  display: none !important;
}

.souqy-avatar {
  width: 38px;
  height: 38px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.souqy-avatar .souqy-logo {
  width: 38px;
  height: 38px;
}

.souqy-title {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.souqy-title-row {
  height: auto;
  gap: 0;
}

.souqy-ar {
  border: 0;
  padding: 0;
  background: transparent;
  color: color-mix(in srgb, var(--foreground) 74%, transparent);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: 0;
  text-transform: none;
}

.souqy-ar::before {
  content: 'Assistant';
}

.souqy-ar {
  font-size: 0;
}

.souqy-ar::before {
  font-size: 13px;
}

.souqy-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: color-mix(in srgb, var(--foreground) 48%, transparent);
  font-size: 12px;
  font-weight: 500;
}

.souqy-status span {
  width: 6px;
  height: 6px;
  background: #35c978;
  box-shadow: none;
  animation: none !important;
}

.souqy-icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
  background: transparent;
}

.souqy-icon-btn:hover {
  color: var(--foreground);
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
}

.souqy-messages {
  flex: 1 1 auto;
  min-height: 0;
  padding: 18px 18px 16px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--foreground) 24%, transparent) transparent;
}

.souqy-row {
  margin: 0 0 18px;
}

.souqy-row.is-assistant,
.souqy-row.is-user {
  display: flex;
}

.souqy-row.is-assistant {
  justify-content: flex-start;
}

.souqy-row.is-user {
  justify-content: flex-end;
}

.souqy-assistant-stack {
  max-width: 100%;
}

.souqy-bubble {
  max-width: min(100%, 340px);
  border-radius: 18px;
  border: 0;
  box-shadow: none;
  font-size: 14px;
  line-height: 1.55;
}

.souqy-bubble.assistant {
  padding: 0;
  color: var(--foreground);
  background: transparent;
  border: 0;
  box-shadow: none;
}

.souqy-bubble.assistant p {
  margin: 0 0 12px;
  color: color-mix(in srgb, var(--foreground) 84%, transparent);
  font-size: 14px;
  line-height: 1.58;
}

.souqy-bubble.user {
  padding: 10px 13px;
  color: var(--background);
  background: var(--foreground);
  border: 0;
  border-radius: 17px 17px 4px 17px;
}

.souqy-bubble.user time {
  display: none;
}

.souqy-plan,
.souqy-questions,
.souqy-empty,
.souqy-applied,
.souqy-thinking,
.souqy-error {
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.souqy-plan {
  padding: 13px;
}

.souqy-plan ol {
  gap: 10px;
}

.souqy-plan li {
  gap: 10px;
}

.souqy-plan li:not(.last)::after {
  display: none;
}

.souqy-step-dot {
  width: 18px;
  height: 18px;
  border-color: color-mix(in srgb, var(--foreground) 28%, transparent);
  box-shadow: none;
}

.souqy-plan strong,
.souqy-empty strong,
.souqy-recs strong {
  color: var(--foreground);
  font-size: 13px;
}

.souqy-plan small,
.souqy-empty p,
.souqy-recs span {
  color: color-mix(in srgb, var(--foreground) 54%, transparent);
  font-size: 12px;
  line-height: 1.45;
}

.souqy-plan-foot {
  margin-top: 12px;
  padding-top: 10px;
  border-color: color-mix(in srgb, var(--foreground) 8%, transparent);
  color: color-mix(in srgb, var(--foreground) 50%, transparent);
}

.souqy-pill,
.souqy-plan-foot button {
  min-height: 30px;
  border-radius: 999px;
}

.souqy-starter {
  gap: 12px;
}

.souqy-empty {
  margin: 0;
  padding: 16px;
  text-align: left;
}

.souqy-recs {
  display: grid;
  gap: 8px;
}

.souqy-recs button {
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 14px;
  background: transparent;
  box-shadow: none;
}

.souqy-recs button:hover {
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
}

.souqy-shortcuts {
  display: none;
}

.souqy-compose {
  flex: 0 0 auto;
  margin: 0;
  padding: 12px 14px 14px;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  border-radius: 0;
  background: color-mix(in srgb, var(--background) 96%, transparent);
  box-shadow: none;
}

.souqy-mode {
  display: inline-flex;
  width: auto;
  gap: 4px;
  margin: 0 0 9px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
}

.souqy-mode button {
  width: auto;
  min-height: 28px;
  border: 0;
  border-radius: 999px;
  padding: 0 11px;
  background: transparent;
  color: color-mix(in srgb, var(--foreground) 54%, transparent);
  font-size: 12px;
  font-weight: 600;
}

.souqy-mode button span {
  display: none;
}

.souqy-mode button.is-active {
  color: var(--foreground);
  background: var(--background);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.souqy-input-wrap {
  position: relative;
}

.souqy-compose textarea {
  display: block;
  width: 100%;
  min-height: 92px;
  max-height: 150px;
  border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--foreground) 3%, transparent);
  color: var(--foreground);
  padding: 14px 96px 14px 15px;
  box-shadow: none;
  font-size: 14px;
  line-height: 1.45;
}

.souqy-compose textarea:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--foreground) 22%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--foreground) 5%, transparent);
}

.souqy-compose textarea::placeholder {
  color: color-mix(in srgb, var(--foreground) 42%, transparent);
}

.souqy-send {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  width: auto;
  min-width: 72px;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  color: var(--background);
  background: var(--foreground);
  box-shadow: none;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0;
}

.souqy-send svg {
  flex: 0 0 auto;
}

.souqy-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.2);
}

.souqy-compose-hint {
  margin-top: 8px;
  color: color-mix(in srgb, var(--foreground) 42%, transparent);
  font-size: 11px;
}

[data-theme='dark'] .souqy-drawer {
  color: #f5efe3;
  background: #141312;
  border-color: rgba(245, 239, 227, 0.12);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.52);
}

[data-theme='dark'] .souqy-head,
[data-theme='dark'] .souqy-compose {
  background: #141312;
  border-color: rgba(245, 239, 227, 0.09);
}

[data-theme='dark'] .souqy-plan,
[data-theme='dark'] .souqy-questions,
[data-theme='dark'] .souqy-empty,
[data-theme='dark'] .souqy-applied,
[data-theme='dark'] .souqy-thinking,
[data-theme='dark'] .souqy-error,
[data-theme='dark'] .souqy-compose textarea {
  background: rgba(255, 255, 255, 0.045);
  border-color: rgba(245, 239, 227, 0.11);
  color: rgba(245, 239, 227, 0.86);
}

[data-theme='dark'] .souqy-mode {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(245, 239, 227, 0.1);
}

[data-theme='dark'] .souqy-mode button.is-active {
  color: #141312;
  background: #f5efe3;
}

[data-theme='dark'] .souqy-bubble.user,
[data-theme='dark'] .souqy-send {
  color: #141312;
  background: #f5efe3;
}

[data-theme='light'] .souqy-drawer {
  color: #1f1b16;
  background: #fffdf7;
  border-color: rgba(31, 27, 22, 0.11);
  box-shadow: 0 22px 60px rgba(31, 27, 22, 0.14);
}

[data-theme='light'] .souqy-head,
[data-theme='light'] .souqy-compose {
  background: #fffdf7;
  border-color: rgba(31, 27, 22, 0.08);
}

[data-theme='light'] .souqy-plan,
[data-theme='light'] .souqy-questions,
[data-theme='light'] .souqy-empty,
[data-theme='light'] .souqy-applied,
[data-theme='light'] .souqy-thinking,
[data-theme='light'] .souqy-error,
[data-theme='light'] .souqy-compose textarea {
  background: rgba(31, 27, 22, 0.035);
  border-color: rgba(31, 27, 22, 0.1);
  color: rgba(31, 27, 22, 0.84);
}

[data-theme='light'] .souqy-mode button.is-active {
  background: #ffffff;
}

/* Animated plan/checklist refresh */
.souqy-planning,
.souqy-plan {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--foreground) 3.5%, transparent);
  box-shadow: none;
  animation: souqy-plan-card-in 260ms ease-out both;
}

.souqy-planning {
  display: grid;
  gap: 12px;
  margin: 0 0 18px;
  padding: 13px;
}

.souqy-planning-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--foreground) 72%, transparent);
  font-size: 13px;
  font-weight: 650;
}

.souqy-planning-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--foreground) 68%, transparent);
  animation: souqy-planning-dot 950ms ease-in-out infinite;
}

.souqy-planning-list {
  display: grid;
  gap: 10px;
}

.souqy-planning-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  color: color-mix(in srgb, var(--foreground) 54%, transparent);
  font-size: 12.5px;
  opacity: 0;
  transform: translateY(5px);
  animation: souqy-plan-step-in 280ms ease-out both;
  animation-delay: calc(var(--step-index) * 90ms);
}

.souqy-planning-check {
  position: relative;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--foreground) 16%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
}

.souqy-planning-check::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: inherit;
  background: color-mix(in srgb, var(--foreground) 46%, transparent);
  animation: souqy-planning-pulse 950ms ease-in-out infinite;
  animation-delay: calc(var(--step-index) * 110ms);
}

.souqy-plan {
  display: grid;
  gap: 12px;
  padding: 13px;
}

.souqy-plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: color-mix(in srgb, var(--foreground) 48%, transparent);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.souqy-plan-state {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in srgb, var(--foreground) 58%, transparent);
  letter-spacing: 0;
  text-transform: none;
}

.souqy-plan.is-checked .souqy-plan-state,
.souqy-plan.is-applied .souqy-plan-state {
  color: #3a9b6b;
}

.souqy-plan.is-error .souqy-plan-state {
  color: #b45f59;
}

.souqy-plan-list {
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.souqy-plan-list li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  opacity: 0;
  transform: translateY(7px);
  animation: souqy-plan-step-in 320ms ease-out both;
  animation-delay: calc(110ms + var(--step-index) * 95ms);
}

.souqy-step-dot {
  position: relative;
  display: inline-grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border: 1.5px solid color-mix(in srgb, var(--foreground) 22%, transparent);
  border-radius: 999px;
  color: var(--background);
  background: transparent;
  box-shadow: none;
  transform: translateY(1px);
}

.souqy-plan-list li.is-checked .souqy-step-dot {
  border-color: var(--foreground);
  background: var(--foreground);
  animation: souqy-check-circle 360ms ease-out both;
  animation-delay: calc(260ms + var(--step-index) * 95ms);
}

.souqy-step-dot svg {
  width: 12px;
  height: 12px;
  opacity: 0;
  transform: scale(0.68);
  animation: souqy-checkmark-in 220ms ease-out forwards;
  animation-delay: calc(390ms + var(--step-index) * 95ms);
}

.souqy-step-dot svg path {
  stroke-dasharray: 28;
  stroke-dashoffset: 28;
  animation: souqy-checkmark-draw 300ms ease-out forwards;
  animation-delay: calc(390ms + var(--step-index) * 95ms);
}

.souqy-plan.is-no-change .souqy-step-dot,
.souqy-plan.is-error .souqy-step-dot {
  color: color-mix(in srgb, var(--foreground) 54%, transparent);
  background: transparent;
  border-color: color-mix(in srgb, var(--foreground) 24%, transparent);
  animation: none;
}

.souqy-step-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.souqy-step-copy strong {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.25;
}

.souqy-step-copy small {
  color: color-mix(in srgb, var(--foreground) 54%, transparent);
  font-size: 12px;
  line-height: 1.4;
}

.souqy-plan-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
  padding-top: 11px;
  border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
}

.souqy-plan-count {
  min-width: 0;
  color: color-mix(in srgb, var(--foreground) 50%, transparent);
  font-size: 12px;
}

.souqy-pill,
.souqy-plan-foot button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 999px;
  padding: 0 12px;
  background: transparent;
  color: color-mix(in srgb, var(--foreground) 64%, transparent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.souqy-plan-foot button {
  border-color: var(--foreground);
  color: var(--background);
  background: var(--foreground);
}

.souqy-plan-foot button:disabled {
  opacity: 0.55;
  cursor: progress;
}

.souqy-pill.applied {
  border-color: color-mix(in srgb, #3a9b6b 42%, transparent);
  color: #3a9b6b;
}

.souqy-pill.error {
  border-color: color-mix(in srgb, #b45f59 44%, transparent);
  color: #b45f59;
}

[data-theme='dark'] .souqy-planning,
[data-theme='dark'] .souqy-plan {
  border-color: rgba(245, 239, 227, 0.11);
  background: rgba(255, 255, 255, 0.045);
}

[data-theme='dark'] .souqy-plan-list li.is-checked .souqy-step-dot {
  color: #141312;
  background: #f5efe3;
  border-color: #f5efe3;
}

[data-theme='dark'] .souqy-plan-foot button {
  color: #141312;
  background: #f5efe3;
  border-color: #f5efe3;
}

[data-theme='light'] .souqy-planning,
[data-theme='light'] .souqy-plan {
  border-color: rgba(31, 27, 22, 0.1);
  background: rgba(31, 27, 22, 0.035);
}

.souqy-plan-quiet {
  gap: 13px;
  padding: 15px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 14% 0%, color-mix(in srgb, var(--foreground) 6%, transparent), transparent 34%),
    color-mix(in srgb, var(--foreground) 3%, transparent);
}

.souqy-plan-quiet-top {
  display: flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--foreground) 52%, transparent);
  font-size: 11.5px;
  font-weight: 650;
}

.souqy-plan-quiet-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, var(--foreground) 72%, transparent);
  background: color-mix(in srgb, var(--background) 76%, transparent);
}

.souqy-plan-quiet-copy {
  display: grid;
  gap: 5px;
}

.souqy-plan-quiet-copy strong {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 680;
  line-height: 1.25;
  letter-spacing: 0;
}

.souqy-plan-quiet-copy small {
  max-width: 29ch;
  color: color-mix(in srgb, var(--foreground) 55%, transparent);
  font-size: 12.5px;
  line-height: 1.45;
}

.souqy-plan-quiet-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: color-mix(in srgb, var(--foreground) 44%, transparent);
  font-size: 12px;
}

.souqy-plan-quiet-foot > span:first-child {
  min-width: 0;
}

.souqy-plan-quiet .souqy-pill {
  min-height: 26px;
  padding: 0 10px;
  border-color: color-mix(in srgb, var(--foreground) 9%, transparent);
  background: color-mix(in srgb, var(--background) 62%, transparent);
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
}

[data-theme='dark'] .souqy-plan-quiet {
  border-color: rgba(245, 239, 227, 0.1);
  background:
    radial-gradient(circle at 14% 0%, rgba(245, 239, 227, 0.08), transparent 34%),
    rgba(255, 255, 255, 0.035);
}

[data-theme='dark'] .souqy-plan-quiet-icon,
[data-theme='dark'] .souqy-plan-quiet .souqy-pill {
  background: rgba(245, 239, 227, 0.05);
  border-color: rgba(245, 239, 227, 0.11);
}

[data-theme='light'] .souqy-plan-quiet {
  border-color: rgba(31, 27, 22, 0.09);
  background:
    radial-gradient(circle at 14% 0%, rgba(31, 27, 22, 0.045), transparent 34%),
    rgba(31, 27, 22, 0.022);
}

[data-theme='light'] .souqy-plan-quiet-icon,
[data-theme='light'] .souqy-plan-quiet .souqy-pill {
  background: rgba(255, 255, 255, 0.62);
  border-color: rgba(31, 27, 22, 0.09);
}

@keyframes souqy-plan-card-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes souqy-plan-step-in {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes souqy-check-circle {
  0% { transform: translateY(1px) scale(0.82); }
  70% { transform: translateY(1px) scale(1.08); }
  100% { transform: translateY(1px) scale(1); }
}

@keyframes souqy-checkmark-in {
  to { opacity: 1; transform: scale(1); }
}

@keyframes souqy-checkmark-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes souqy-planning-dot {
  0%, 100% { opacity: 0.45; transform: scale(0.82); }
  50% { opacity: 1; transform: scale(1.12); }
}

@keyframes souqy-planning-pulse {
  0%, 100% { opacity: 0.22; transform: scale(0.7); }
  50% { opacity: 0.72; transform: scale(1); }
}

.souqy-drawer,
.souqy-head,
.souqy-compose {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.souqy-liquid {
  filter: none;
}

.souqy-drawer::after {
  mask-image: none;
}

@keyframes souqy-glass-scan {
  0%, 100% { transform: translateX(-28%) rotate(-3deg); opacity: 0.22; }
  50% { transform: translateX(34%) rotate(2deg); opacity: 0.5; }
}

@keyframes souqy-aurora-drift {
  0% { transform: translate3d(-2%, -1%, 0) rotate(0deg) scale(1); }
  100% { transform: translate3d(3%, 2%, 0) rotate(8deg) scale(1.05); }
}

@keyframes souqy-signal-flow {
  0%, 100% { opacity: 0.26; transform: scaleX(0.56); }
  50% { opacity: 0.86; transform: scaleX(1); }
}

@keyframes souqy-status-pulse {
  0%, 100% { transform: scale(0.86); opacity: 0.78; }
  50% { transform: scale(1.12); opacity: 1; }
}
@keyframes souqy-spin { to { transform: rotate(360deg); } }
@keyframes souqy-pulse { 0%, 100% { transform: scale(0.72); opacity: 0.45; } 50% { transform: scale(1); opacity: 1; } }
@media (max-width: 640px) {
  .souqy-drawer {
    inset: 0;
    height: 100dvh;
    width: 100vw;
    border-radius: 0;
  }
  .souqy-tools,
  .souqy-shortcuts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .souqy-drawer,
  .souqy-avatar-wrap::before,
  .souqy-mini-avatar::before,
  .souqy-thinking span,
  .souqy-planning,
  .souqy-planning-dot,
  .souqy-planning-row,
  .souqy-planning-check::after,
  .souqy-plan,
  .souqy-plan-list li,
  .souqy-step-dot,
  .souqy-step-dot svg,
  .souqy-step-dot svg path {
    animation: none !important;
    transition: none !important;
  }

  .souqy-planning-row,
  .souqy-plan-list li,
  .souqy-step-dot svg {
    opacity: 1 !important;
    transform: none !important;
  }

  .souqy-step-dot svg path {
    stroke-dashoffset: 0 !important;
  }
}
`;
