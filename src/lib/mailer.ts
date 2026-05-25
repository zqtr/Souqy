/**
 * Souqna mailer — thin abstraction over our two transactional email
 * providers. Resend was the first integration (still wired into the
 * marketing broadcast and createBrief notify flows). Postmark was
 * added second for higher-deliverability transactional traffic
 * (welcome emails, order confirmations, password resets — anything
 * the founder *needs* to land in the inbox).
 *
 * Provider selection precedence:
 *
 *   1. Caller passes `provider: 'postmark' | 'resend'` explicitly.
 *   2. `MAILER_PROVIDER` env var (`postmark` or `resend`).
 *   3. Auto: prefer Postmark if `POSTMARK_API_TOKEN` is set,
 *      otherwise fall back to Resend.
 *
 * The API surface is intentionally tiny — `sendMail({ to, subject,
 * html, text, from?, replyTo?, tag? })`. Consumers don't need to
 * know which provider answered the call.
 */
import { Resend } from 'resend';
import { ServerClient as PostmarkClient } from 'postmark';
import { env } from '@/lib/env';

export type MailProvider = 'postmark' | 'resend';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Postmark message stream / Resend tag — used for analytics buckets. */
  tag?: string;
  provider?: MailProvider;
}

export interface SendMailResult {
  ok: boolean;
  provider: MailProvider;
  id?: string;
  error?: string;
}

function resolveProvider(explicit?: MailProvider): MailProvider | null {
  if (explicit) return explicit;
  const fromEnv = process.env.MAILER_PROVIDER as MailProvider | undefined;
  if (fromEnv === 'postmark' || fromEnv === 'resend') return fromEnv;
  if (process.env.POSTMARK_API_TOKEN) return 'postmark';
  if (env.RESEND_API_KEY) return 'resend';
  return null;
}

let postmark: PostmarkClient | null = null;
function getPostmark(): PostmarkClient | null {
  const token = process.env.POSTMARK_API_TOKEN;
  if (!token) return null;
  if (!postmark) postmark = new PostmarkClient(token);
  return postmark;
}

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const provider = resolveProvider(input.provider);
  if (!provider) {
    return {
      ok: false,
      provider: 'resend',
      error:
        'No mail provider configured. Set POSTMARK_API_TOKEN or RESEND_API_KEY in env.',
    };
  }

  const from = input.from ?? env.CONTACT_FROM;
  const toList = Array.isArray(input.to) ? input.to : [input.to];

  if (provider === 'postmark') {
    const client = getPostmark();
    if (!client) {
      return { ok: false, provider, error: 'POSTMARK_API_TOKEN missing.' };
    }
    try {
      const res = await client.sendEmail({
        From: from,
        To: toList.join(', '),
        Subject: input.subject,
        HtmlBody: input.html,
        TextBody: input.text,
        ReplyTo: input.replyTo,
        MessageStream: input.tag ?? process.env.POSTMARK_MESSAGE_STREAM ?? 'outbound',
      });
      return { ok: true, provider, id: res.MessageID };
    } catch (err) {
      return {
        ok: false,
        provider,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const r = getResend();
  if (!r) return { ok: false, provider, error: 'RESEND_API_KEY missing.' };
  if (!input.html && !input.text) {
    return { ok: false, provider, error: 'Either html or text is required.' };
  }
  try {
    // Resend's typings demand exactly-one of `html` / `text` / `react`
    // be present, so build the payload conditionally rather than
    // passing undefineds through.
    const base = {
      from,
      to: toList,
      subject: input.subject,
      replyTo: input.replyTo,
      tags: input.tag ? [{ name: 'category', value: input.tag }] : undefined,
    };
    const payload = input.html
      ? { ...base, html: input.html, text: input.text }
      : { ...base, text: input.text! };
    const res = await r.emails.send(payload);
    if (res.error) {
      return { ok: false, provider, error: res.error.message };
    }
    return { ok: true, provider, id: res.data?.id };
  } catch (err) {
    return {
      ok: false,
      provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
