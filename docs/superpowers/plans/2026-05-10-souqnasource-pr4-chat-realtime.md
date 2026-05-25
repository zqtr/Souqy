# SouqnaSource PR 4 — Chat + Realtime + Read Receipts + Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire end-to-end realtime chat between founders and claimed suppliers — message persistence, Pusher delivery, read receipts (✓/✓✓), typing indicators, in-app unread counters, WhatsApp out-of-band notifications, and a daily email digest for founders. Listing card swaps to "Message on Souqna" for claimed suppliers. Translation lands in PR 5.

**Architecture:** Conversations are unique per `(storefront_slug, supplier_id)` and lazy-created on first message. Messages are append-only. Read receipts live in a side-keyed table (one row per message, per side). Pusher private channels named `private-conv-<id>` carry message + read + typing events; channel auth happens server-side (founder = Clerk; supplier = `sq_supplier_session` JWT). WhatsApp pings rate-limited to 1 per (conversation, recipient_kind) per 5 min, hard-capped at 50/day per side. Email digest cron runs daily 8am Doha time.

**Tech Stack:** `pusher` (server) + `pusher-js` (client), existing WhatsApp + email helpers, Clerk + supplier JWT for dual-realm auth. Builds on PR 1–3.

**Spec reference:** `docs/superpowers/specs/2026-05-10-souqnasource-design.md` §1.3, §3.9, §4.4–4.7, §5.8, §5.9, §5.12 (read ticks + typing — translation chip is PR 5).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/db/migrations/034_souqnasource_chat.sql` | conversations + messages + message_reads tables |
| `src/lib/apps/souqnasource/conversations.ts` | DAO (upsert by (slug, supplier), unread counters) |
| `src/lib/apps/souqnasource/messages.ts` | DAO + sendMessage core (no translation yet) |
| `src/lib/apps/souqnasource/reads.ts` | markRead bulk insert + Pusher event |
| `src/lib/apps/souqnasource/pusher.ts` | Server publish + channel auth signing |
| `src/lib/apps/souqnasource/notifications.ts` | Notification fan-out (WhatsApp ping + DB notification rows) |
| `src/app/api/apps/souqnasource/pusher/auth/route.ts` | Private-channel auth |
| `src/app/api/apps/souqnasource/unread-count/route.ts` | Header badge polling |
| `src/app/api/apps/souqnasource/cron/email-digest/route.ts` | Daily founder digest |
| `src/app/actions/souqnasource.ts` | Add `sendMessage`, `markRead`, `publishTyping`, `getMessagesSince`, `getUnreadCount` |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/messages-tab.tsx` | Founder inbox |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/conversation-list.tsx` | Shared list pane |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/thread-view.tsx` | Shared thread pane |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/message-bubble.tsx` | Bubble with read ticks |
| `src/app/[locale]/dashboard/[slug]/apps/souqnasource/composer.tsx` | Input box + send + typing publisher |
| `src/app/supplier/inbox/page.tsx` | Replace placeholder with real inbox |
| `src/components/apps/souqnasource/pusher-provider.tsx` | Client-side Pusher singleton + subscription manager |
| `src/components/apps/souqnasource/inbox-header-badge.tsx` | Header chip polling unread count |
| `src/components/apps/souqnasource/read-ticks.tsx` | ✓ / ✓✓ |
| `src/components/apps/souqnasource/typing-indicator.tsx` | 3-dot animation |
| `src/lib/apps/souqnasource/listing-card-cta-helper.ts` | Decide CTA based on supplier.claimed_at |

---

## Task 1: Migration 034 — chat tables

**Files:**
- Create: `src/db/migrations/034_souqnasource_chat.sql`

- [ ] **Step 1: Write migration**

```sql
-- 034_souqnasource_chat.sql
create table souqnasource_conversations (
  id text primary key,
  storefront_slug text not null references storefronts(slug) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  account_id text references souqnasource_supplier_accounts(id) on delete set null,
  founder_unread int not null default 0,
  supplier_unread int not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  context_listing_id text references souqnasource_listings(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storefront_slug, supplier_id)
);
create index on souqnasource_conversations (storefront_slug, last_message_at desc);
create index on souqnasource_conversations (account_id, last_message_at desc);

create table souqnasource_messages (
  id text primary key,
  conversation_id text not null references souqnasource_conversations(id) on delete cascade,
  sender_kind text not null,
  sender_ref text not null,
  body text not null,
  body_lang text not null default 'en',
  body_translated jsonb not null default '{}'::jsonb,
  translation_status text not null default 'none',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on souqnasource_messages (conversation_id, created_at);

create table souqnasource_message_reads (
  message_id text not null references souqnasource_messages(id) on delete cascade,
  reader_kind text not null,
  reader_ref text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, reader_kind)
);
create index on souqnasource_message_reads (message_id);
```

- [ ] **Step 2: Apply**

```bash
npm run migrate
```

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/034_souqnasource_chat.sql
git commit -m "feat(souqnasource): add chat tables migration 034"
```

---

## Task 2: Conversations DAO

**Files:**
- Create: `src/lib/apps/souqnasource/conversations.ts`
- Create: `tests/integration/souqnasource/conversations.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/conversations.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';
import {
  upsertConversation,
  getConversationByPair,
  bumpUnread,
  zeroUnread,
  listConversationsForStore,
} from '@/lib/apps/souqnasource/conversations';

const sid = `conv-test-supplier-${Date.now()}`;
const slug = process.env.TEST_STOREFRONT_SLUG ?? 'test-store';

beforeAll(async () => {
  await upsertSupplier({
    id: sid, displayName: 'C', crNumber: null,
    whatsapp: '+97455555555', area: 'najma',
    sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
});
afterAll(async () => {
  await db()`delete from souqnasource_conversations where supplier_id = ${sid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('conversations DAO', () => {
  it('upserts unique per (slug, supplier)', async () => {
    const a = await upsertConversation({ storefrontSlug: slug, supplierId: sid, contextListingId: null });
    const b = await upsertConversation({ storefrontSlug: slug, supplierId: sid, contextListingId: null });
    expect(a.id).toBe(b.id);
  });

  it('reads back by pair', async () => {
    const got = await getConversationByPair(slug, sid);
    expect(got?.supplierId).toBe(sid);
  });

  it('bumps and zeros unread', async () => {
    const c = await getConversationByPair(slug, sid);
    await bumpUnread(c!.id, 'supplier', 1);
    const after = await getConversationByPair(slug, sid);
    expect(after?.supplierUnread).toBe(1);
    await zeroUnread(c!.id, 'supplier');
    const z = await getConversationByPair(slug, sid);
    expect(z?.supplierUnread).toBe(0);
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/conversations.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type Conversation = {
  id: string;
  storefrontSlug: string;
  supplierId: string;
  accountId: string | null;
  founderUnread: number;
  supplierUnread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  contextListingId: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  storefront_slug: string;
  supplier_id: string;
  account_id: string | null;
  founder_unread: number;
  supplier_unread: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  context_listing_id: string | null;
  created_at: string;
};

function fromRow(r: Row): Conversation {
  return {
    id: r.id, storefrontSlug: r.storefront_slug, supplierId: r.supplier_id,
    accountId: r.account_id, founderUnread: r.founder_unread, supplierUnread: r.supplier_unread,
    lastMessageAt: r.last_message_at, lastMessagePreview: r.last_message_preview,
    contextListingId: r.context_listing_id, createdAt: r.created_at,
  };
}

function genId(): string {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return `conv_${Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export async function upsertConversation(input: {
  storefrontSlug: string;
  supplierId: string;
  contextListingId: string | null;
}): Promise<Conversation> {
  // Resolve account_id at upsert time if the supplier has been claimed.
  const link = (await db()`
    select account_id
    from souqnasource_supplier_account_links
    where supplier_id = ${input.supplierId}
    limit 1
  `) as unknown as { account_id: string }[];
  const accountId = link[0]?.account_id ?? null;

  const id = genId();
  const rows = (await db()`
    insert into souqnasource_conversations
      (id, storefront_slug, supplier_id, account_id, context_listing_id)
    values
      (${id}, ${input.storefrontSlug}, ${input.supplierId}, ${accountId}, ${input.contextListingId})
    on conflict (storefront_slug, supplier_id) do update set
      account_id = coalesce(souqnasource_conversations.account_id, excluded.account_id),
      context_listing_id = coalesce(excluded.context_listing_id, souqnasource_conversations.context_listing_id)
    returning *
  `) as unknown as Row[];
  return fromRow(rows[0]!);
}

export async function getConversationByPair(slug: string, supplierId: string): Promise<Conversation | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_conversations
    where storefront_slug = ${slug} and supplier_id = ${supplierId}
    limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_conversations where id = ${id} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listConversationsForStore(slug: string): Promise<Conversation[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_conversations
    where storefront_slug = ${slug}
    order by last_message_at desc nulls last
    limit 100
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listConversationsForAccount(accountId: string): Promise<Conversation[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_conversations
    where account_id = ${accountId}
    order by last_message_at desc nulls last
    limit 100
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function bumpUnread(convId: string, side: 'founder' | 'supplier', by: number): Promise<void> {
  if (side === 'founder') {
    await db()`update souqnasource_conversations set founder_unread = founder_unread + ${by} where id = ${convId}`;
  } else {
    await db()`update souqnasource_conversations set supplier_unread = supplier_unread + ${by} where id = ${convId}`;
  }
}

export async function zeroUnread(convId: string, side: 'founder' | 'supplier'): Promise<void> {
  if (side === 'founder') {
    await db()`update souqnasource_conversations set founder_unread = 0 where id = ${convId}`;
  } else {
    await db()`update souqnasource_conversations set supplier_unread = 0 where id = ${convId}`;
  }
}

export async function setLastMessage(convId: string, preview: string): Promise<void> {
  await db()`
    update souqnasource_conversations
    set last_message_at = now(), last_message_preview = ${preview.slice(0, 200)}
    where id = ${convId}
  `;
}

export async function backfillAccountId(supplierId: string, accountId: string): Promise<void> {
  await db()`
    update souqnasource_conversations
    set account_id = ${accountId}
    where supplier_id = ${supplierId} and account_id is null
  `;
}

export async function totalUnreadForSlug(slug: string): Promise<number> {
  noStore();
  const rows = (await db()`
    select coalesce(sum(founder_unread), 0)::int as n
    from souqnasource_conversations
    where storefront_slug = ${slug}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function totalUnreadForAccount(accountId: string): Promise<number> {
  noStore();
  const rows = (await db()`
    select coalesce(sum(supplier_unread), 0)::int as n
    from souqnasource_conversations
    where account_id = ${accountId}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
```

- [ ] **Step 4: Hook claim flow to backfill**

In `src/lib/apps/souqnasource/claim.ts` `verifyClaimOtp`, after `linkAccountToSupplier(...)` add:

```ts
import { backfillAccountId } from './conversations';
await backfillAccountId(otp.supplier_id, account.id);
```

- [ ] **Step 5: Run, PASS.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/apps/souqnasource/conversations.ts src/lib/apps/souqnasource/claim.ts tests/integration/souqnasource/conversations.test.ts
git commit -m "feat(souqnasource): add conversations DAO + claim backfill"
```

---

## Task 3: Messages DAO

**Files:**
- Create: `src/lib/apps/souqnasource/messages.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/messages.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type Message = {
  id: string;
  conversationId: string;
  senderKind: 'founder' | 'supplier' | 'system';
  senderRef: string;
  body: string;
  bodyLang: 'en' | 'ar';
  bodyTranslated: Record<string, string>;
  translationStatus: 'none' | 'ok' | 'failed' | 'skipped_same_lang' | 'skipped_trivial';
  attachments: Array<{ kind: 'image' | 'pdf'; url: string; name: string; size: number }>;
  createdAt: string;
};

type Row = {
  id: string;
  conversation_id: string;
  sender_kind: 'founder' | 'supplier' | 'system';
  sender_ref: string;
  body: string;
  body_lang: 'en' | 'ar';
  body_translated: Record<string, string>;
  translation_status: Message['translationStatus'];
  attachments: Message['attachments'];
  created_at: string;
};

function fromRow(r: Row): Message {
  return {
    id: r.id, conversationId: r.conversation_id, senderKind: r.sender_kind,
    senderRef: r.sender_ref, body: r.body, bodyLang: r.body_lang,
    bodyTranslated: r.body_translated, translationStatus: r.translation_status,
    attachments: r.attachments, createdAt: r.created_at,
  };
}

function genId(): string {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return `msg_${Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export async function insertMessage(input: {
  conversationId: string;
  senderKind: Message['senderKind'];
  senderRef: string;
  body: string;
  bodyLang: 'en' | 'ar';
  bodyTranslated: Record<string, string>;
  translationStatus: Message['translationStatus'];
  attachments: Message['attachments'];
}): Promise<Message> {
  const id = genId();
  const rows = (await db()`
    insert into souqnasource_messages
      (id, conversation_id, sender_kind, sender_ref, body, body_lang, body_translated, translation_status, attachments)
    values
      (${id}, ${input.conversationId}, ${input.senderKind}, ${input.senderRef}, ${input.body},
       ${input.bodyLang}, ${JSON.stringify(input.bodyTranslated)}::jsonb, ${input.translationStatus},
       ${JSON.stringify(input.attachments)}::jsonb)
    returning *
  `) as unknown as Row[];
  return fromRow(rows[0]!);
}

export async function listMessages(convId: string, limit = 100): Promise<Message[]> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_messages
    where conversation_id = ${convId}
    order by created_at asc
    limit ${limit}
  `) as unknown as Row[];
  return rows.map(fromRow);
}

export async function listMessagesSince(convId: string, sinceMessageId: string | null): Promise<Message[]> {
  noStore();
  if (!sinceMessageId) return listMessages(convId, 100);
  const rows = (await db()`
    select * from souqnasource_messages
    where conversation_id = ${convId}
      and created_at > (
        select created_at from souqnasource_messages where id = ${sinceMessageId}
      )
    order by created_at asc
    limit 100
  `) as unknown as Row[];
  return rows.map(fromRow);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/messages.ts
git commit -m "feat(souqnasource): add messages DAO"
```

---

## Task 4: Pusher server helper

**Files:**
- Create: `src/lib/apps/souqnasource/pusher.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/pusher.ts
import Pusher from 'pusher';

let _pusher: Pusher | null = null;
export function pusher(): Pusher {
  if (_pusher) return _pusher;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? 'eu';
  if (!appId || !key || !secret) throw new Error('pusher_not_configured');
  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusher;
}

export function convChannel(convId: string): string {
  return `private-conv-${convId}`;
}

export type ConvEvent =
  | { type: 'message'; messageId: string }
  | { type: 'read'; side: 'founder' | 'supplier'; upToMessageId: string }
  | { type: 'typing'; side: 'founder' | 'supplier'; isTyping: boolean; expiresAt: number };

export async function publishConvEvent(convId: string, event: ConvEvent): Promise<void> {
  try {
    await pusher().trigger(convChannel(convId), event.type, event);
  } catch {
    // Fire-and-forget. DB is the source of truth; clients will catch up via polling.
  }
}

export function authorizeChannel(socketId: string, channel: string): string {
  // Returns the JSON string Pusher expects in the auth response body.
  const payload = pusher().authorizeChannel(socketId, channel);
  return JSON.stringify(payload);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/pusher.ts
git commit -m "feat(souqnasource): add Pusher server helper"
```

---

## Task 5: Pusher channel auth route

**Files:**
- Create: `src/app/api/apps/souqnasource/pusher/auth/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/apps/souqnasource/pusher/auth/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { readSupplierSessionFromRequest } from '@/lib/apps/souqnasource/auth/session';
import { getConversationById } from '@/lib/apps/souqnasource/conversations';
import { authorizeChannel } from '@/lib/apps/souqnasource/pusher';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  if (!socketId || !channel.startsWith('private-conv-')) {
    return new NextResponse('forbidden', { status: 403 });
  }
  const convId = channel.slice('private-conv-'.length);
  const conv = await getConversationById(convId);
  if (!conv) return new NextResponse('forbidden', { status: 403 });

  // Try founder first
  const { userId } = await auth();
  if (userId) {
    const owns = (await db()`
      select 1 from storefronts where slug = ${conv.storefrontSlug} and owner_user_id = ${userId} limit 1
    `) as unknown as { '?column?': number }[];
    if (owns.length > 0) {
      return new NextResponse(authorizeChannel(socketId, channel), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // Else try supplier session
  const supplier = await readSupplierSessionFromRequest(req);
  if (supplier && conv.accountId === supplier.accountId) {
    return new NextResponse(authorizeChannel(socketId, channel), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new NextResponse('forbidden', { status: 403 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/apps/souqnasource/pusher/auth/route.ts
git commit -m "feat(souqnasource): add Pusher channel auth route"
```

---

## Task 6: Notifications fan-out (WhatsApp ping + DB row)

**Files:**
- Create: `src/lib/apps/souqnasource/notifications.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/notifications.ts
import { db } from '@/lib/db';
import { sendWhatsAppTemplate } from './auth/whatsapp-send';

const WA_RATE_LIMIT_MS = 5 * 60 * 1000;
const WA_DAY_CAP = 50;

export async function notifyMessage(input: {
  convId: string;
  recipientKind: 'founder' | 'supplier';
  recipientWhatsapp: string | null;
  recipientStorefrontSlug: string | null; // for founder, the slug; for supplier, null
  founderStoreName: string;
  messageBody: string;
}): Promise<void> {
  // 1. In-app notification row (so the founder dashboard pulls it on next render).
  if (input.recipientKind === 'founder' && input.recipientStorefrontSlug) {
    await db()`
      insert into notifications (storefront_slug, kind, ref, body_en, body_ar, created_at)
      values (${input.recipientStorefrontSlug}, 'souqnasource:new_message', ${input.convId},
              ${`${input.founderStoreName}: ${input.messageBody.slice(0, 80)}`},
              ${`${input.founderStoreName}: ${input.messageBody.slice(0, 80)}`},
              now())
      on conflict do nothing
    `;
  }

  // 2. WhatsApp template ping (if recipient has whatsapp + we're inside rate limits)
  if (!input.recipientWhatsapp) return;
  const within = (await db()`
    select count(*)::int as n
    from notifications
    where ref = ${input.convId}
      and kind = 'souqnasource:wa_pinged'
      and created_at > now() - (${WA_RATE_LIMIT_MS} * interval '1 millisecond')
  `) as unknown as { n: number }[];
  if ((within[0]?.n ?? 0) > 0) return;

  const dayCount = (await db()`
    select count(*)::int as n
    from notifications
    where kind = 'souqnasource:wa_pinged'
      and body_en like ${'%' + input.recipientWhatsapp + '%'}
      and created_at > now() - interval '1 day'
  `) as unknown as { n: number }[];
  if ((dayCount[0]?.n ?? 0) >= WA_DAY_CAP) return;

  try {
    await sendWhatsAppTemplate({
      to: input.recipientWhatsapp.replace(/^\+/, ''),
      templateName: process.env.WHATSAPP_NEW_MESSAGE_TEMPLATE_NAME ?? 'souqna_new_message',
      languageCode: input.recipientKind === 'supplier' ? 'ar' : 'en',
      bodyParams: [
        input.founderStoreName,
        input.messageBody.slice(0, 80),
        `https://souqna.qa/${input.recipientKind === 'supplier' ? 'supplier/inbox' : 'dashboard'}?conv=${input.convId}`,
      ],
    });
    await db()`
      insert into notifications (storefront_slug, kind, ref, body_en, body_ar, created_at)
      values (${input.recipientStorefrontSlug ?? 'system'}, 'souqnasource:wa_pinged', ${input.convId},
              ${input.recipientWhatsapp}, ${input.recipientWhatsapp}, now())
    `;
  } catch {
    // Swallow — WA failures must not block message persistence.
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/notifications.ts
git commit -m "feat(souqnasource): add chat notification fan-out"
```

---

## Task 7: `sendMessage` orchestrator

**Files:**
- Create: `src/lib/apps/souqnasource/send.ts`
- Create: `tests/integration/souqnasource/send.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/send.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';

vi.mock('@/lib/apps/souqnasource/pusher', () => ({
  publishConvEvent: vi.fn(),
  convChannel: (id: string) => `private-conv-${id}`,
  authorizeChannel: (s: string, c: string) => JSON.stringify({ socket: s, channel: c }),
  pusher: vi.fn(),
}));
vi.mock('@/lib/apps/souqnasource/notifications', () => ({
  notifyMessage: vi.fn(),
}));

import { sendMessage } from '@/lib/apps/souqnasource/send';
import { listMessages } from '@/lib/apps/souqnasource/messages';

const sid = `send-test-supplier-${Date.now()}`;
const slug = process.env.TEST_STOREFRONT_SLUG ?? 'test-store';

beforeAll(async () => {
  await upsertSupplier({
    id: sid, displayName: 'S', crNumber: null,
    whatsapp: '+97455555555', area: 'najma',
    sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
  // Pretend supplier is claimed
  await db()`update souqnasource_suppliers set claimed_at = now() where id = ${sid}`;
  await db()`
    insert into souqnasource_supplier_accounts (id, whatsapp) values ('acc-send-test', '+97455555555')
    on conflict (whatsapp) do nothing
  `;
  await db()`
    insert into souqnasource_supplier_account_links (account_id, supplier_id) values ('acc-send-test', ${sid})
    on conflict do nothing
  `;
});
afterAll(async () => {
  await db()`delete from souqnasource_messages where conversation_id in (select id from souqnasource_conversations where supplier_id = ${sid})`;
  await db()`delete from souqnasource_conversations where supplier_id = ${sid}`;
  await db()`delete from souqnasource_supplier_account_links where account_id = 'acc-send-test'`;
  await db()`delete from souqnasource_supplier_accounts where id = 'acc-send-test'`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
});

describe('sendMessage', () => {
  it('founder seeds conversation + persists message', async () => {
    const out = await sendMessage({
      sender: { kind: 'founder', clerkUserId: 'test_user', storefrontSlug: slug },
      seedOrConv: { kind: 'seed', supplierId: sid, contextListingId: null },
      body: 'Hello, do you have 50 units?',
      attachments: [],
    });
    expect(out.convId).toBeTruthy();
    const msgs = await listMessages(out.convId);
    expect(msgs.length).toBe(1);
    expect(msgs[0]?.senderKind).toBe('founder');
  });

  it('rejects when sender is not a participant', async () => {
    await expect(
      sendMessage({
        sender: { kind: 'supplier', accountId: 'wrong-account' },
        seedOrConv: { kind: 'conv', convId: 'doesnt-matter' },
        body: 'x', attachments: [],
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/send.ts
import { db } from '@/lib/db';
import { getSupplierById } from './suppliers';
import { upsertConversation, getConversationById, bumpUnread, setLastMessage } from './conversations';
import { insertMessage } from './messages';
import { publishConvEvent } from './pusher';
import { notifyMessage } from './notifications';
import { buildQuoteRequestUrl } from './whatsapp';

export type Sender =
  | { kind: 'founder'; clerkUserId: string; storefrontSlug: string }
  | { kind: 'supplier'; accountId: string };

export type SeedOrConv =
  | { kind: 'seed'; supplierId: string; contextListingId: string | null }
  | { kind: 'conv'; convId: string };

export async function sendMessage(input: {
  sender: Sender;
  seedOrConv: SeedOrConv;
  body: string;
  attachments: Array<{ kind: 'image' | 'pdf'; url: string; name: string; size: number }>;
}): Promise<{ convId: string; messageId: string; claimPendingNote: boolean }> {
  // Validation
  if (input.body.length === 0 || input.body.length > 4000) throw new Error('invalid_body');
  if (input.attachments.length > 5) throw new Error('too_many_attachments');

  // Resolve conversation
  let convId: string;
  let claimPendingNote = false;
  if (input.seedOrConv.kind === 'conv') {
    const conv = await getConversationById(input.seedOrConv.convId);
    if (!conv) throw new Error('conversation_not_found');
    if (input.sender.kind === 'founder') {
      const owns = (await db()`
        select 1 from storefronts where slug = ${conv.storefrontSlug} and owner_user_id = ${input.sender.clerkUserId} limit 1
      `) as unknown as { '?column?': number }[];
      if (owns.length === 0) throw new Error('forbidden');
    } else {
      if (conv.accountId !== input.sender.accountId) throw new Error('forbidden');
    }
    convId = conv.id;
  } else {
    if (input.sender.kind !== 'founder') throw new Error('seed_only_founder');
    const supplier = await getSupplierById(input.seedOrConv.supplierId);
    if (!supplier) throw new Error('supplier_not_found');
    const conv = await upsertConversation({
      storefrontSlug: input.sender.storefrontSlug,
      supplierId: supplier.id,
      contextListingId: input.seedOrConv.contextListingId,
    });
    convId = conv.id;
    if (!supplier.claimedAt) {
      claimPendingNote = true;
      // Trigger wa.me deep-link so the supplier sees the founder's reach-out
      // outside Souqna. Fire and forget.
      try {
        const sf = (await db()`
          select name, locale from storefronts where slug = ${input.sender.storefrontSlug} limit 1
        `) as unknown as { name: string; locale: 'en' | 'ar' }[];
        if (sf[0] && supplier.whatsapp) {
          buildQuoteRequestUrl({
            listing: { id: 'seed', title: input.body.slice(0, 60) },
            supplier: { id: supplier.id, whatsapp: supplier.whatsapp },
            storefront: { name: sf[0].name, locale: sf[0].locale ?? 'en' },
          });
          // We don't auto-open wa.me from server side; the UI surface will
          // show the founder a button to do so. But we still log a notification.
        }
      } catch {
        // ignore
      }
    }
  }

  const senderKind: 'founder' | 'supplier' = input.sender.kind === 'founder' ? 'founder' : 'supplier';
  const senderRef = input.sender.kind === 'founder' ? input.sender.clerkUserId : input.sender.accountId;

  // Persist message (DB tx — fast writes only; translation in PR 5)
  const msg = await insertMessage({
    conversationId: convId,
    senderKind,
    senderRef,
    body: input.body,
    bodyLang: detectMessageLang(input.body),
    bodyTranslated: {},
    translationStatus: 'none',
    attachments: input.attachments,
  });

  await setLastMessage(convId, input.body);
  await bumpUnread(convId, senderKind === 'founder' ? 'supplier' : 'founder', 1);

  // Publish + notify (best-effort, outside tx)
  await publishConvEvent(convId, { type: 'message', messageId: msg.id });

  const conv = await getConversationById(convId);
  if (conv) {
    if (senderKind === 'founder') {
      // Notify supplier
      const supplier = await getSupplierById(conv.supplierId);
      const sf = (await db()`
        select name from storefronts where slug = ${conv.storefrontSlug} limit 1
      `) as unknown as { name: string }[];
      await notifyMessage({
        convId,
        recipientKind: 'supplier',
        recipientWhatsapp: supplier?.whatsapp ?? null,
        recipientStorefrontSlug: null,
        founderStoreName: sf[0]?.name ?? 'A Souqna founder',
        messageBody: input.body,
      });
    } else {
      // Notify founder
      const sf = (await db()`
        select name from storefronts where slug = ${conv.storefrontSlug} limit 1
      `) as unknown as { name: string }[];
      const supplier = await getSupplierById(conv.supplierId);
      await notifyMessage({
        convId,
        recipientKind: 'founder',
        recipientWhatsapp: null, // founder-side WA notification optional; v1 = email digest only
        recipientStorefrontSlug: conv.storefrontSlug,
        founderStoreName: supplier?.displayName ?? 'A supplier',
        messageBody: input.body,
      });
    }
  }

  return { convId, messageId: msg.id, claimPendingNote };
}

function detectMessageLang(body: string): 'en' | 'ar' {
  const arabic = (body.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (body.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin * 1.5) return 'ar';
  return 'en';
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/send.ts tests/integration/souqnasource/send.test.ts
git commit -m "feat(souqnasource): add sendMessage orchestrator"
```

---

## Task 8: Reads + typing actions

**Files:**
- Create: `src/lib/apps/souqnasource/reads.ts`
- Create: `src/lib/apps/souqnasource/typing.ts`

- [ ] **Step 1: Implement reads**

```ts
// src/lib/apps/souqnasource/reads.ts
import { db } from '@/lib/db';
import { getConversationById, zeroUnread } from './conversations';
import { publishConvEvent } from './pusher';

export async function markRead(input: {
  convId: string;
  side: 'founder' | 'supplier';
  readerRef: string;
}): Promise<{ messagesMarked: number; upToMessageId: string | null }> {
  const conv = await getConversationById(input.convId);
  if (!conv) throw new Error('conversation_not_found');

  const otherKind = input.side === 'founder' ? 'supplier' : 'founder';
  const rows = (await db()`
    insert into souqnasource_message_reads (message_id, reader_kind, reader_ref)
    select m.id, ${input.side}, ${input.readerRef}
    from souqnasource_messages m
    where m.conversation_id = ${input.convId}
      and m.sender_kind = ${otherKind}
      and not exists (
        select 1 from souqnasource_message_reads r
        where r.message_id = m.id and r.reader_kind = ${input.side}
      )
    returning message_id
  `) as unknown as { message_id: string }[];

  await zeroUnread(input.convId, input.side);

  const upTo = rows[rows.length - 1]?.message_id ?? null;
  if (upTo) {
    await publishConvEvent(input.convId, {
      type: 'read',
      side: input.side,
      upToMessageId: upTo,
    });
  }
  return { messagesMarked: rows.length, upToMessageId: upTo };
}
```

- [ ] **Step 2: Implement typing**

```ts
// src/lib/apps/souqnasource/typing.ts
import { getConversationById } from './conversations';
import { publishConvEvent } from './pusher';

export async function publishTyping(input: {
  convId: string;
  side: 'founder' | 'supplier';
  isTyping: boolean;
}): Promise<void> {
  const conv = await getConversationById(input.convId);
  if (!conv) throw new Error('conversation_not_found');
  await publishConvEvent(input.convId, {
    type: 'typing',
    side: input.side,
    isTyping: input.isTyping,
    expiresAt: Date.now() + 3000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apps/souqnasource/reads.ts src/lib/apps/souqnasource/typing.ts
git commit -m "feat(souqnasource): add reads + typing publishers"
```

---

## Task 9: Server actions for chat

**Files:**
- Modify: `src/app/actions/souqnasource.ts`

- [ ] **Step 1: Append the new actions**

```ts
// (continued in src/app/actions/souqnasource.ts)
import { auth } from '@clerk/nextjs/server';
import { readSupplierSession } from '@/lib/apps/souqnasource/auth/session';
import { sendMessage as runSendMessage, type SeedOrConv } from '@/lib/apps/souqnasource/send';
import { markRead as runMarkRead } from '@/lib/apps/souqnasource/reads';
import { publishTyping as runPublishTyping } from '@/lib/apps/souqnasource/typing';
import { listMessagesSince } from '@/lib/apps/souqnasource/messages';
import { totalUnreadForSlug, totalUnreadForAccount, getConversationById } from '@/lib/apps/souqnasource/conversations';

async function resolveSender(slugForFounder?: string): Promise<
  | { kind: 'founder'; clerkUserId: string; storefrontSlug: string }
  | { kind: 'supplier'; accountId: string }
> {
  const { userId } = await auth();
  if (userId && slugForFounder) {
    await assertStorefrontOwner(slugForFounder); // reuse the helper from earlier in the file
    return { kind: 'founder', clerkUserId: userId, storefrontSlug: slugForFounder };
  }
  const supplier = await readSupplierSession();
  if (supplier) return { kind: 'supplier', accountId: supplier.accountId };
  throw new Error('unauthorized');
}

export async function sendMessage(input: {
  slug?: string;                                // founder side; undefined for supplier
  seedOrConv: SeedOrConv;
  body: string;
  attachments?: Array<{ kind: 'image' | 'pdf'; url: string; name: string; size: number }>;
}) {
  const sender = await resolveSender(input.slug);
  return runSendMessage({
    sender,
    seedOrConv: input.seedOrConv,
    body: input.body,
    attachments: input.attachments ?? [],
  });
}

export async function markRead(input: { slug?: string; convId: string }) {
  const sender = await resolveSender(input.slug);
  const side: 'founder' | 'supplier' = sender.kind === 'founder' ? 'founder' : 'supplier';
  const ref = sender.kind === 'founder' ? sender.clerkUserId : sender.accountId;
  return runMarkRead({ convId: input.convId, side, readerRef: ref });
}

export async function publishTyping(input: { slug?: string; convId: string; isTyping: boolean }) {
  const sender = await resolveSender(input.slug);
  const side: 'founder' | 'supplier' = sender.kind === 'founder' ? 'founder' : 'supplier';
  return runPublishTyping({ convId: input.convId, side, isTyping: input.isTyping });
}

export async function getMessagesSince(input: {
  slug?: string;
  convId: string;
  sinceMessageId: string | null;
}) {
  const sender = await resolveSender(input.slug);
  const conv = await getConversationById(input.convId);
  if (!conv) throw new Error('conversation_not_found');
  if (sender.kind === 'founder' && conv.storefrontSlug !== sender.storefrontSlug) throw new Error('forbidden');
  if (sender.kind === 'supplier' && conv.accountId !== sender.accountId) throw new Error('forbidden');
  return listMessagesSince(input.convId, input.sinceMessageId);
}

export async function getUnreadCount(input: { slug?: string }) {
  const sender = await resolveSender(input.slug);
  if (sender.kind === 'founder') return totalUnreadForSlug(sender.storefrontSlug);
  return totalUnreadForAccount(sender.accountId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/souqnasource.ts
git commit -m "feat(souqnasource): add chat server actions"
```

---

## Task 10: Unread-count + email-digest cron

**Files:**
- Create: `src/app/api/apps/souqnasource/unread-count/route.ts`
- Create: `src/app/api/apps/souqnasource/cron/email-digest/route.ts`

- [ ] **Step 1: Unread-count route (header badge polling)**

```ts
// src/app/api/apps/souqnasource/unread-count/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { totalUnreadForSlug, totalUnreadForAccount } from '@/lib/apps/souqnasource/conversations';
import { readSupplierSession } from '@/lib/apps/souqnasource/auth/session';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (slug) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ count: 0 }, { status: 401 });
    const ok = (await db()`
      select 1 from storefronts where slug = ${slug} and owner_user_id = ${userId} limit 1
    `) as unknown as { '?column?': number }[];
    if (ok.length === 0) return NextResponse.json({ count: 0 }, { status: 403 });
    return NextResponse.json({ count: await totalUnreadForSlug(slug) });
  }
  const supplier = await readSupplierSession();
  if (!supplier) return NextResponse.json({ count: 0 }, { status: 401 });
  return NextResponse.json({ count: await totalUnreadForAccount(supplier.accountId) });
}
```

- [ ] **Step 2: Email digest cron**

```ts
// src/app/api/apps/souqnasource/cron/email-digest/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/apps/souqnasource/settings';

export const runtime = 'nodejs';

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.SOUQNASOURCE_SYNC_CRON_SECRET;
  const got =
    req.headers.get('x-cron-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!expected || !timingSafeEq(got, expected)) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  // Find storefronts with unread conversations
  const stores = (await db()`
    select c.storefront_slug as slug, sum(c.founder_unread)::int as unread,
           min(s.email) as email, min(s.name) as name
    from souqnasource_conversations c
    join storefronts s on s.slug = c.storefront_slug
    where c.founder_unread > 0
    group by c.storefront_slug
    having sum(c.founder_unread) > 0
  `) as unknown as { slug: string; unread: number; email: string | null; name: string | null }[];

  let sent = 0;
  for (const row of stores) {
    if (!row.email) continue;
    const settings = await getSettings(row.slug);
    if (settings.emailDigestOptOut) continue;
    // Use existing Souqna mailer (Postmark or Resend). The exact helper name
    // varies — adapt to whatever `src/lib/mailer.ts` exposes.
    try {
      const { sendEmail } = await import('@/lib/mailer');
      await sendEmail({
        to: row.email,
        subject: `${row.unread} new SouqnaSource ${row.unread === 1 ? 'message' : 'messages'}`,
        html: `<p>You have ${row.unread} unread supplier ${row.unread === 1 ? 'message' : 'messages'} on Souqna.</p>
               <p><a href="https://souqna.qa/dashboard/${row.slug}/apps/souqnasource?tab=messages">Open inbox</a></p>`,
        text: `You have ${row.unread} unread supplier messages. Open inbox: https://souqna.qa/dashboard/${row.slug}/apps/souqnasource?tab=messages`,
      });
      sent++;
    } catch {
      // ignore single-email failures
    }
  }
  return NextResponse.json({ ok: true, sent });
}

export const GET = POST;
```

- [ ] **Step 3: Add cron entry to `vercel.json`**

```json
{ "path": "/api/apps/souqnasource/cron/email-digest", "schedule": "0 5 * * *" }
```

(0500 UTC ≈ 0800 Doha.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/apps/souqnasource/unread-count/ src/app/api/apps/souqnasource/cron/email-digest/ vercel.json
git commit -m "feat(souqnasource): add unread-count + email-digest"
```

---

## Task 11: Pusher client provider

**Files:**
- Create: `src/components/apps/souqnasource/pusher-provider.tsx`

- [ ] **Step 1: Add `pusher-js` dep**

```bash
npm install --save pusher-js
git add package.json package-lock.json
git commit -m "chore: add pusher-js"
```

- [ ] **Step 2: Implement provider**

```tsx
// src/components/apps/souqnasource/pusher-provider.tsx
'use client';
import Pusher from 'pusher-js';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

const PusherCtx = createContext<Pusher | null>(null);

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<Pusher | null>(null);
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu';
  if (!ref.current && key) {
    ref.current = new Pusher(key, {
      cluster,
      channelAuthorization: { endpoint: '/api/apps/souqnasource/pusher/auth', transport: 'ajax' },
    });
  }
  useEffect(() => () => { ref.current?.disconnect(); }, []);
  const value = useMemo(() => ref.current, []);
  return <PusherCtx.Provider value={value}>{children}</PusherCtx.Provider>;
}

export function usePusherChannel<T>(channel: string, event: string, onEvent: (data: T) => void) {
  const p = useContext(PusherCtx);
  useEffect(() => {
    if (!p) return;
    const ch = p.subscribe(channel);
    ch.bind(event, onEvent);
    return () => { ch.unbind(event, onEvent); p.unsubscribe(channel); };
  }, [p, channel, event, onEvent]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/apps/souqnasource/pusher-provider.tsx
git commit -m "feat(souqnasource): add Pusher client provider"
```

---

## Task 12: Founder Messages tab + thread + composer + bubble + ticks

**Files:** all the messages UI components.

- [ ] **Step 1: Read-ticks + typing components**

```tsx
// src/components/apps/souqnasource/read-ticks.tsx
export function ReadTicks({ read }: { read: boolean }) {
  return (
    <span className={`text-xs ${read ? 'text-sky-500' : 'text-zinc-400'}`}>
      {read ? '✓✓' : '✓'}
    </span>
  );
}
```

```tsx
// src/components/apps/souqnasource/typing-indicator.tsx
export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="text-xs text-zinc-500 flex items-center gap-2">
      <span className="inline-flex gap-0.5">
        <span className="animate-pulse">●</span>
        <span className="animate-pulse delay-150">●</span>
        <span className="animate-pulse delay-300">●</span>
      </span>
      <span>{name} is typing…</span>
    </div>
  );
}
```

- [ ] **Step 2: Message bubble**

```tsx
// src/app/[locale]/dashboard/[slug]/apps/souqnasource/message-bubble.tsx
import { ReadTicks } from '@/components/apps/souqnasource/read-ticks';
import type { Message } from '@/lib/apps/souqnasource/messages';

export function MessageBubble({ message, mine, read }: { message: Message; mine: boolean; read: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`rounded-lg px-3 py-2 max-w-[80%] ${mine ? 'bg-zinc-900 text-white' : 'bg-zinc-100'}`}>
        <p className="whitespace-pre-line">{message.body}</p>
        <div className="flex items-center justify-end gap-2 mt-1 text-xs text-zinc-400">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {mine && <ReadTicks read={read} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thread view + composer**

```tsx
// src/app/[locale]/dashboard/[slug]/apps/souqnasource/thread-view.tsx
'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { getMessagesSince, markRead, sendMessage, publishTyping } from '@/app/actions/souqnasource';
import { usePusherChannel } from '@/components/apps/souqnasource/pusher-provider';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from '@/components/apps/souqnasource/typing-indicator';
import type { Message } from '@/lib/apps/souqnasource/messages';

export function ThreadView({ convId, slug, side, otherName }: {
  convId: string; slug?: string; side: 'founder' | 'supplier'; otherName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [readUpTo, setReadUpTo] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const lastIdRef = useRef<string | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    getMessagesSince({ slug, convId, sinceMessageId: null }).then((m) => {
      setMessages(m);
      lastIdRef.current = m[m.length - 1]?.id ?? null;
    });
    markRead({ slug, convId });
  }, [convId, slug]);

  usePusherChannel<{ type: 'message'; messageId: string }>(
    `private-conv-${convId}`,
    'message',
    () => {
      getMessagesSince({ slug, convId, sinceMessageId: lastIdRef.current }).then((fresh) => {
        if (fresh.length === 0) return;
        setMessages((prev) => [...prev, ...fresh]);
        lastIdRef.current = fresh[fresh.length - 1]!.id;
        markRead({ slug, convId });
      });
    },
  );

  usePusherChannel<{ type: 'read'; side: 'founder' | 'supplier'; upToMessageId: string }>(
    `private-conv-${convId}`,
    'read',
    (e) => {
      if (e.side !== side) setReadUpTo(e.upToMessageId);
    },
  );

  usePusherChannel<{ type: 'typing'; side: 'founder' | 'supplier'; isTyping: boolean }>(
    `private-conv-${convId}`,
    'typing',
    (e) => { if (e.side !== side) setTyping(e.isTyping); },
  );

  function onChangeBody(v: string) {
    setBody(v);
    publishTyping({ slug, convId, isTyping: true });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      publishTyping({ slug, convId, isTyping: false });
    }, 4000);
  }

  function send() {
    if (body.trim().length === 0) return;
    startTransition(async () => {
      const out = await sendMessage({ slug, seedOrConv: { kind: 'conv', convId }, body });
      setBody('');
      // Optimistic refresh — wait for Pusher to deliver, but pull immediately as fallback
      const fresh = await getMessagesSince({ slug, convId, sinceMessageId: lastIdRef.current });
      if (fresh.length > 0) {
        setMessages((prev) => [...prev, ...fresh]);
        lastIdRef.current = fresh[fresh.length - 1]!.id;
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((m) => {
          const mine = m.senderKind === side;
          const read = mine && readUpTo !== null && m.id <= readUpTo;
          return <MessageBubble key={m.id} message={m} mine={mine} read={read} />;
        })}
        {typing && <TypingIndicator name={otherName} />}
      </div>
      <div className="border-t p-2 flex gap-2">
        <input
          value={body}
          onChange={(e) => onChangeBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…"
          className="flex-1 border rounded p-2"
        />
        <button onClick={send} disabled={pending} className="bg-zinc-900 text-white rounded px-3">Send</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Conversation list + Messages tab**

```tsx
// src/app/[locale]/dashboard/[slug]/apps/souqnasource/conversation-list.tsx
import type { Conversation } from '@/lib/apps/souqnasource/conversations';

export function ConversationList({
  conversations, currentConvId, side, onSelect,
}: {
  conversations: Conversation[];
  currentConvId: string | null;
  side: 'founder' | 'supplier';
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y">
      {conversations.map((c) => {
        const unread = side === 'founder' ? c.founderUnread : c.supplierUnread;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`w-full text-left p-2 ${currentConvId === c.id ? 'bg-zinc-100' : ''}`}
            >
              <div className={`flex justify-between ${unread > 0 ? 'font-semibold' : ''}`}>
                <span>{c.supplierId}</span>
                {unread > 0 && <span className="text-xs bg-rose-500 text-white rounded-full px-1.5">{unread}</span>}
              </div>
              <p className="text-xs text-zinc-500 truncate">{c.lastMessagePreview}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

```tsx
// src/app/[locale]/dashboard/[slug]/apps/souqnasource/messages-tab.tsx
'use client';
import { useEffect, useState } from 'react';
import { ConversationList } from './conversation-list';
import { ThreadView } from './thread-view';
import { PusherProvider } from '@/components/apps/souqnasource/pusher-provider';
import type { Conversation } from '@/lib/apps/souqnasource/conversations';

export function MessagesTab({ slug, conversations }: { slug: string; conversations: Conversation[] }) {
  const [current, setCurrent] = useState<Conversation | null>(conversations[0] ?? null);
  return (
    <PusherProvider>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        <aside className="col-span-4 border rounded overflow-y-auto">
          <ConversationList
            conversations={conversations}
            currentConvId={current?.id ?? null}
            side="founder"
            onSelect={(id) => setCurrent(conversations.find((c) => c.id === id) ?? null)}
          />
        </aside>
        <main className="col-span-8 border rounded">
          {current ? (
            <ThreadView convId={current.id} slug={slug} side="founder" otherName={current.supplierId} />
          ) : (
            <p className="p-4 text-zinc-500">No conversations yet.</p>
          )}
        </main>
      </div>
    </PusherProvider>
  );
}
```

Then wire it into `page.tsx`:

```tsx
// At the top of page.tsx imports:
import { listConversationsForStore } from '@/lib/apps/souqnasource/conversations';
import { MessagesTab } from './messages-tab';
// In Page():
const conversations = await listConversationsForStore(params.slug);
// In tab nav, add 'messages'; in body:
{tab === 'messages' && <MessagesTab slug={params.slug} conversations={conversations} />}
```

Add `'messages'` to the tab list.

- [ ] **Step 5: Commit**

```bash
git add src/components/apps/souqnasource/{read-ticks,typing-indicator}.tsx src/app/[locale]/dashboard/[slug]/apps/souqnasource/{message-bubble,thread-view,conversation-list,messages-tab,page}.tsx
git commit -m "feat(souqnasource): add founder Messages tab with realtime"
```

---

## Task 13: Supplier inbox real implementation

**Files:**
- Modify: `src/app/supplier/inbox/page.tsx`
- Create: `src/app/supplier/inbox/inbox-client.tsx`

- [ ] **Step 1: Server component lists conversations**

```tsx
// src/app/supplier/inbox/page.tsx
import { readSupplierSession } from '@/lib/apps/souqnasource/auth/session';
import { redirect } from 'next/navigation';
import { listConversationsForAccount } from '@/lib/apps/souqnasource/conversations';
import { InboxClient } from './inbox-client';

export default async function Page() {
  const session = await readSupplierSession();
  if (!session) redirect('/supplier/claim/missing');
  const conversations = await listConversationsForAccount(session.accountId);
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <InboxClient conversations={conversations} />
    </div>
  );
}
```

- [ ] **Step 2: Client component reuses ConversationList + ThreadView**

```tsx
// src/app/supplier/inbox/inbox-client.tsx
'use client';
import { useState } from 'react';
import { ConversationList } from '@/app/[locale]/dashboard/[slug]/apps/souqnasource/conversation-list';
import { ThreadView } from '@/app/[locale]/dashboard/[slug]/apps/souqnasource/thread-view';
import { PusherProvider } from '@/components/apps/souqnasource/pusher-provider';
import type { Conversation } from '@/lib/apps/souqnasource/conversations';

export function InboxClient({ conversations }: { conversations: Conversation[] }) {
  const [current, setCurrent] = useState<Conversation | null>(conversations[0] ?? null);
  return (
    <PusherProvider>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        <aside className="col-span-4 border rounded overflow-y-auto">
          <ConversationList
            conversations={conversations}
            currentConvId={current?.id ?? null}
            side="supplier"
            onSelect={(id) => setCurrent(conversations.find((c) => c.id === id) ?? null)}
          />
        </aside>
        <main className="col-span-8 border rounded">
          {current ? (
            <ThreadView convId={current.id} side="supplier" otherName={current.storefrontSlug} />
          ) : (
            <p className="p-4 text-zinc-500">No conversations yet.</p>
          )}
        </main>
      </div>
    </PusherProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/supplier/inbox/
git commit -m "feat(souqnasource): wire supplier inbox to live chat"
```

---

## Task 14: Smart-routing CTA on listing card

**Files:**
- Modify: `src/app/[locale]/dashboard/[slug]/apps/souqnasource/listing-card.tsx`

- [ ] **Step 1: Add a "Message on Souqna" CTA branch**

For contact-type listings whose supplier is claimed, swap the "Get a quote on WhatsApp" button for "Message on Souqna" that opens a small drawer with a starter ThreadView.

```tsx
// listing-card.tsx — patch
import { useEffect, useState } from 'react';
import { getSupplierForBrowse, sendMessage } from '@/app/actions/souqnasource';
// ...
const [claimed, setClaimed] = useState<boolean | null>(null);
useEffect(() => {
  getSupplierForBrowse({ slug, supplierId: listing.supplierId }).then((s) => {
    setClaimed(Boolean(s?.claimedAt));
  });
}, [slug, listing.supplierId]);

// In the contact-type branch:
{listing.listingType === 'contact' && (claimed
  ? <button onClick={() => setOpenChat(true)} className="rounded bg-zinc-900 text-white px-3 py-1.5">{t('messageOnSouqna')}</button>
  : <button onClick={() => setOpenQuote(true)} className="rounded border px-3 py-1.5">{t('getQuote')}</button>
)}
```

Add a small `<ChatDrawer>` component that, on open, calls `sendMessage` with a seed (only if there is text); otherwise renders a `<ThreadView>` after pre-creating the conversation via a no-op action.

For the simplest v1: render the drawer only after the founder types and clicks Send, which both creates the conversation and posts the first message. Subsequent opens find an existing conversation in the Messages tab.

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/dashboard/[slug]/apps/souqnasource/listing-card.tsx
git commit -m "feat(souqnasource): smart-routing CTA on listing card"
```

---

## Task 15: Header badge for unread count

**Files:**
- Create: `src/components/apps/souqnasource/inbox-header-badge.tsx`
- Modify: existing dashboard header to render this for the current `slug`

- [ ] **Step 1: Implement**

```tsx
// src/components/apps/souqnasource/inbox-header-badge.tsx
'use client';
import { useEffect, useState } from 'react';

export function InboxHeaderBadge({ slug }: { slug?: string }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    const url = slug ? `/api/apps/souqnasource/unread-count?slug=${encodeURIComponent(slug)}`
                     : '/api/apps/souqnasource/unread-count';
    let alive = true;
    async function tick() {
      try {
        const r = await fetch(url);
        const j = await r.json();
        if (alive) setCount(Number(j.count ?? 0));
      } catch {}
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [slug]);
  if (count === 0) return null;
  return (
    <span className="ml-1 text-xs bg-rose-500 text-white rounded-full px-1.5 py-0.5">{count}</span>
  );
}
```

- [ ] **Step 2: Mount in dashboard nav**

Find the existing dashboard top nav (Grep for the SouqnaSource link or for `Apps`). Add `<InboxHeaderBadge slug={slug} />` next to the SouqnaSource entry.

- [ ] **Step 3: Commit**

```bash
git add src/components/apps/souqnasource/inbox-header-badge.tsx
git commit -m "feat(souqnasource): add inbox header badge"
```

---

## Task 16: End-to-end smoke

- [ ] **Step 1: Run all tests**

```bash
npm test
```

- [ ] **Step 2: Manual two-window flow**

1. Sign in as a founder in one browser. Open SouqnaSource → Browse → claimed-supplier contact-listing → "Message on Souqna" → send "Hello".
2. In a second browser (incognito), claim the supplier (Task 7 in PR 3) → land on `/supplier/inbox` → see "Hello".
3. Reply "Hi, what quantity?" → founder side sees the new message in <2s via Pusher.
4. Founder side checkmarks turn double once supplier views the thread.
5. Type to trigger typing indicator on the other side.
6. Close founder browser; supplier sends another message → WhatsApp template ping arrives within rate-limit.
7. Wait 24h: email digest summary arrives at founder's email.

- [ ] **Step 3: No commit (verify only)**

---

## Self-Review

1. **Spec coverage:** §1.3, §3.9, §4.4–4.7, §5.8, §5.9 (read ticks + typing). Translation chip is PR 5. ✓
2. **No placeholders.** Tasks 12, 14, 15 have "find via Grep" notes for existing-codebase wiring (dashboard nav, products row); engineer must locate. Acceptable per skill.
3. **Type consistency:** `Conversation`, `Message`, `Sender`, `SeedOrConv` shapes match across DAOs, send.ts, and actions. Read state shape `{messagesMarked, upToMessageId}` consistent. ✓
4. **Each task commits.** ✓

---

## Acceptance criteria for PR 4

- All 16 tasks committed.
- `npm test` passes (5+ new chat tests on top of PR 3).
- Two-window manual flow above works end-to-end.
- Pusher private channels reject non-participants (HTTP 403).
- Read receipts ✓✓ flip on the sender side within 2s of recipient opening the thread.
- Typing indicator appears within 1s of remote keystroke; disappears 4s after silence.
- WhatsApp ping rate-limited to 1 per (conversation, side) per 5 min.
- Daily email digest cron sends one email per founder with ≥1 unread.
- Listing card swaps CTA based on `supplier.claimed_at`.
- No `console.log`.
