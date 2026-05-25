import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';

export const SouqyProductStatusSchema = z.enum(['active', 'draft', 'sold_out']);

export const SouqyPlanSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().trim().min(1).max(500),
  status: z.enum(['pending', 'applied', 'error']).default('pending'),
  checklist: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(240).optional().default(''),
  })).min(1).max(8),
  questions: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    detail: z.string().trim().max(260).optional().default(''),
    options: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      prompt: z.string().trim().min(1).max(500),
    })).max(8).default([]),
  })).max(6).default([]),
  categoryCreates: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).nullable().optional().default(null),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('').transform(() => null)).default(null),
  })).max(12).default([]),
  productCreates: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(800).optional().default(''),
    priceQar: z.number().nonnegative().max(99_999_999).nullable().optional().default(null),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('').transform(() => null)).default(null),
    category: z.string().trim().max(80).nullable().optional().default(null),
    status: SouqyProductStatusSchema.default('draft'),
  })).max(20).default([]),
  productUpdates: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(800).nullable().optional(),
    priceQar: z.number().nonnegative().max(99_999_999).nullable().optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('').transform(() => null)),
    category: z.string().trim().max(80).nullable().optional(),
    status: SouqyProductStatusSchema.optional(),
  })).max(20).default([]),
  seo: z.object({
    title: z.string().trim().max(140).nullable().optional(),
    description: z.string().trim().max(260).nullable().optional(),
    image: z.string().trim().max(2048).nullable().optional(),
  }).nullable().optional().default(null),
});

export type SouqyPlan = z.infer<typeof SouqyPlanSchema>;

export type SouqyConversation = {
  id: string;
  storefrontSlug: string;
  clerkUserId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SouqyMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

type ConversationRow = {
  id: string;
  storefront_slug: string;
  clerk_user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: unknown;
  created_at: string;
};

function conversationFromRow(row: ConversationRow): SouqyConversation {
  return {
    id: row.id,
    storefrontSlug: row.storefront_slug,
    clerkUserId: row.clerk_user_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function messageFromRow(row: MessageRow): SouqyMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {},
    createdAt: new Date(row.created_at),
  };
}

export async function getLatestConversation(
  storefrontSlug: string,
  clerkUserId: string,
): Promise<SouqyConversation | null> {
  noStore();
  const rows = await db()`
    select * from souqy_conversations
    where storefront_slug = ${storefrontSlug}
      and clerk_user_id = ${clerkUserId}
    order by updated_at desc
    limit 1
  ` as unknown as ConversationRow[];
  return rows[0] ? conversationFromRow(rows[0]) : null;
}

export async function getConversationById(
  id: string,
): Promise<SouqyConversation | null> {
  noStore();
  const rows = await db()`
    select * from souqy_conversations
    where id = ${id}
    limit 1
  ` as unknown as ConversationRow[];
  return rows[0] ? conversationFromRow(rows[0]) : null;
}

export async function createConversation(input: {
  storefrontSlug: string;
  clerkUserId: string;
  title?: string | null;
}): Promise<SouqyConversation> {
  const rows = await db()`
    insert into souqy_conversations (storefront_slug, clerk_user_id, title)
    values (${input.storefrontSlug}, ${input.clerkUserId}, ${input.title ?? null})
    returning *
  ` as unknown as ConversationRow[];
  const row = rows[0];
  if (!row) throw new Error('souqy_conversations insert failed');
  return conversationFromRow(row);
}

export async function touchConversation(id: string, title?: string | null): Promise<void> {
  if (title) {
    await db()`
      update souqy_conversations
      set updated_at = now(), title = coalesce(title, ${title})
      where id = ${id}
    `;
    return;
  }
  await db()`
    update souqy_conversations
    set updated_at = now()
    where id = ${id}
  `;
}

export async function listMessages(conversationId: string): Promise<SouqyMessage[]> {
  noStore();
  const rows = await db()`
    select * from souqy_messages
    where conversation_id = ${conversationId}
    order by created_at asc
  ` as unknown as MessageRow[];
  return rows.map(messageFromRow);
}

export async function addMessage(input: {
  conversationId: string;
  role: SouqyMessage['role'];
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<SouqyMessage> {
  const rows = await db()`
    insert into souqy_messages (conversation_id, role, content, metadata)
    values (
      ${input.conversationId},
      ${input.role},
      ${input.content},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    returning *
  ` as unknown as MessageRow[];
  const row = rows[0];
  if (!row) throw new Error('souqy_messages insert failed');
  await touchConversation(input.conversationId);
  return messageFromRow(row);
}

export async function updateMessageMetadata(
  messageId: string,
  metadata: Record<string, unknown>,
): Promise<SouqyMessage> {
  const rows = await db()`
    update souqy_messages
    set metadata = ${JSON.stringify(metadata)}::jsonb
    where id = ${messageId}
    returning *
  ` as unknown as MessageRow[];
  const row = rows[0];
  if (!row) throw new Error('souqy_messages update failed');
  return messageFromRow(row);
}

export function extractPlan(message: SouqyMessage): SouqyPlan | null {
  const parsed = SouqyPlanSchema.safeParse(message.metadata.plan);
  return parsed.success ? parsed.data : null;
}
