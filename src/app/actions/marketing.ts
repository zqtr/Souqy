'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { assertStorefrontOwner } from '@/lib/products';
import { listCustomers } from '@/lib/customers';
import { recordAudit } from '@/lib/audit';

const Schema = z.object({
  storefrontSlug: z.string().trim().min(1).max(64),
  subject: z.string().trim().min(1).max(280),
  body: z.string().trim().min(1).max(20000),
  audience: z.enum(['all_customers', 'consented_only', 'recent_30d']),
  preview: z.boolean().optional().default(false),
});

export type BroadcastInput = z.input<typeof Schema>;
export type BroadcastState =
  | { status: 'idle' }
  | { status: 'success'; sent: number; skipped: number }
  | { status: 'error'; message: string };

/**
 * Marketing broadcast — picks an audience, renders a tiny HTML email,
 * and sends through Resend. The send is sequential (one email per
 * customer) which is fine at Souqna's current per-store list size; we
 * upgrade to Resend's batch API once a single store crosses ~1000
 * customers.
 *
 * Audience semantics:
 *
 *   - `all_customers`     every customer with an email on file
 *   - `consented_only`    only customers with `marketing_consent = true`
 *   - `recent_30d`        customers with activity in the last 30 days
 *
 * No auto-unsubscribe link in v1 — we instead append a footer telling
 * recipients to reply with "unsubscribe" and surface those replies in
 * the inquiry log.
 */
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastState> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid form' };
  }
  const { userId } = await auth();
  if (!userId) return { status: 'error', message: 'Sign in to send.' };
  const owner = await assertStorefrontOwner(parsed.data.storefrontSlug, userId);
  if (!owner) return { status: 'error', message: 'Forbidden' };
  if (!env.RESEND_API_KEY) {
    return {
      status: 'error',
      message:
        'Resend API key is not configured on this Souqna environment. Add RESEND_API_KEY in Vercel env to enable broadcasts.',
    };
  }

  const customers = await listCustomers(parsed.data.storefrontSlug, { limit: 1000 });
  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const audience = customers.filter((c) => {
    if (!c.email) return false;
    if (parsed.data.audience === 'consented_only') return c.marketingConsent;
    if (parsed.data.audience === 'recent_30d') {
      return (
        c.lastSeenAt &&
        c.lastSeenAt.getTime() > cutoff30 &&
        c.marketingConsent
      );
    }
    return true;
  });

  if (parsed.data.preview) {
    return {
      status: 'success',
      sent: 0,
      skipped: audience.length,
    };
  }

  if (audience.length === 0) {
    return {
      status: 'error',
      message: 'No customers in that audience yet.',
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const fromAddress =
    env.CONTACT_FROM ?? `Souqna <support@souqna.qa>`;
  const html = renderEmailHtml({
    body: parsed.data.body,
    storeName: owner.businessName,
    storeUrl: `https://${parsed.data.storefrontSlug}.souqna.qa`,
  });

  let sent = 0;
  let skipped = 0;
  for (const c of audience) {
    if (!c.email) {
      skipped++;
      continue;
    }
    try {
      await resend.emails.send({
        from: fromAddress,
        to: c.email,
        subject: parsed.data.subject,
        html,
      });
      sent++;
    } catch (err) {
      console.error('[broadcast] send failed', c.email, err);
      skipped++;
    }
  }

  await recordAudit({
    storefrontSlug: parsed.data.storefrontSlug,
    clerkUserId: userId,
    action: 'marketing.broadcast',
    summary: `Sent broadcast "${parsed.data.subject}" to ${sent} (skipped ${skipped})`,
    meta: {
      audience: parsed.data.audience,
      subject: parsed.data.subject,
      sent,
      skipped,
    },
  });

  return { status: 'success', sent, skipped };
}

function renderEmailHtml({
  body,
  storeName,
  storeUrl,
}: {
  body: string;
  storeName: string;
  storeUrl: string;
}): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1e9d7;font-family:Georgia, 'Times New Roman', serif;color:#1f1b16;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(31,27,22,0.08);">
    <tr><td>
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a8893f;margin-bottom:14px;">◈ ${storeName}</div>
      ${paragraphs}
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(31,27,22,0.08);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:rgba(31,27,22,0.6);">
        Sent by <a href="${storeUrl}" style="color:#a8893f;text-decoration:none;">${storeName}</a> via Souqna.
        Reply with "unsubscribe" if you'd rather not hear from us.
      </div>
    </td></tr>
  </table>
</body></html>
  `.trim();
}
