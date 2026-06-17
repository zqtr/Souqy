import { sendMail, type SendMailResult } from '@/lib/mailer';
import { env } from '@/lib/env';
import type { Order } from '@/lib/checkout-orders';

/**
 * Order email helpers — wrap `src/lib/mailer.ts` so the checkout flow
 * doesn't have to assemble HTML/text + subject lines itself.
 *
 * Templates are intentionally inline (no external template engine).
 * Body is plain HTML + a parallel text fallback. Every paragraph uses
 * `dir="auto"` so the renderer picks LTR vs RTL per content, which is
 * what Souqna needs for mixed Arabic + English orders.
 *
 * Currency formatting uses Intl.NumberFormat with the order's currency
 * code (almost always QAR in v1) so future multi-currency stores
 * render correctly without a template change.
 */

export type PaymentInstructionBlock = {
  /** Heading line — e.g. "Bank transfer details". */
  heading: string;
  /** Multi-line plain-text body. Each line becomes its own <p>. */
  body: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amountQar: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amountQar);
  } catch {
    return `${currency} ${amountQar}`;
  }
}

function formatAddressLines(order: Order): string[] {
  const a = order.address;
  if (!a) return [];
  const parts = [
    a.line1,
    a.line2 ?? '',
    [a.area, a.city].filter(Boolean).join(', '),
    [a.zip, a.country].filter(Boolean).join(' '),
  ];
  return parts.filter((line) => line && line.trim().length > 0);
}

function paragraphs(lines: string[]): { html: string; text: string } {
  const html = lines
    .map((line) => `<p dir="auto" style="margin:0 0 8px 0;">${escapeHtml(line)}</p>`)
    .join('');
  const text = lines.join('\n');
  return { html, text };
}

function instructionsBlock(block: PaymentInstructionBlock | null): { html: string; text: string } {
  if (!block) return { html: '', text: '' };
  const bodyLines = block.body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const html = `
    <h3 dir="auto" style="margin:24px 0 8px 0;font-size:15px;">
      ${escapeHtml(block.heading)}
    </h3>
    ${bodyLines
      .map((line) => `<p dir="auto" style="margin:0 0 6px 0;">${escapeHtml(line)}</p>`)
      .join('')}
  `;
  const text = `\n${block.heading}\n${bodyLines.join('\n')}\n`;
  return { html, text };
}

function itemsTable(order: Order): { html: string; text: string } {
  const rows = order.items
    .map((item) => {
      const line = formatMoney(item.priceQarSnapshot * item.quantity, order.currency);
      const optionLines = itemOptionLines(item);
      const label = optionLines.length
        ? `${item.titleSnapshot} (${optionLines.join(', ')})`
        : item.titleSnapshot;
      return `
        <tr>
          <td dir="auto" style="padding:6px 0;">
            ${escapeHtml(label)} × ${item.quantity}
          </td>
          <td style="padding:6px 0;text-align:end;white-space:nowrap;">
            ${line}
          </td>
        </tr>`;
    })
    .join('');
  const html = `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
      ${rows}
      <tr><td colspan="2" style="padding:6px 0;border-top:1px solid #e5e5e5;"></td></tr>
      <tr>
        <td dir="auto" style="padding:4px 0;color:#555;">Subtotal</td>
        <td style="padding:4px 0;text-align:end;">${formatMoney(order.subtotalQar, order.currency)}</td>
      </tr>
      <tr>
        <td dir="auto" style="padding:4px 0;color:#555;">Shipping</td>
        <td style="padding:4px 0;text-align:end;">${formatMoney(order.shippingQar, order.currency)}</td>
      </tr>
      <tr>
        <td dir="auto" style="padding:8px 0;font-weight:600;">Total</td>
        <td style="padding:8px 0;text-align:end;font-weight:600;">${formatMoney(order.totalQar, order.currency)}</td>
      </tr>
    </table>
  `;
  const text = [
    ...order.items.map((it) => {
      const optionLines = itemOptionLines(it);
      const label = optionLines.length
        ? `${it.titleSnapshot} (${optionLines.join(', ')})`
        : it.titleSnapshot;
      return `- ${label} × ${it.quantity} — ${formatMoney(
        it.priceQarSnapshot * it.quantity,
        order.currency,
      )}`;
    }),
    `Subtotal: ${formatMoney(order.subtotalQar, order.currency)}`,
    `Shipping: ${formatMoney(order.shippingQar, order.currency)}`,
    `Total: ${formatMoney(order.totalQar, order.currency)}`,
  ].join('\n');
  return { html, text };
}

function itemOptionLines(item: Order['items'][number]): string[] {
  const lines: string[] = [];
  if (item.variantLabel) lines.push(`Size: ${item.variantLabel}`);
  if (item.customInputs.height) {
    lines.push(`${item.customInputs.heightLabel || 'Height'}: ${item.customInputs.height}`);
  }
  return lines;
}

function orderRefShort(order: Order): string {
  // First 8 chars of the uuid is plenty for a human reference.
  return order.id.slice(0, 8).toUpperCase();
}

function paymentMethodLabel(order: Order): string {
  switch (order.paymentMethod) {
    case 'cod':
      return 'Cash on delivery';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'skipcash':
      return 'SkipCash';
    case 'sadad':
      return 'SADAD';
    case 'pay_link':
      return 'Online payment link';
  }
}

export type SendOwnerEmailInput = {
  ownerEmail: string;
  slug: string;
  order: Order;
  paymentInstructions?: PaymentInstructionBlock | null;
};

export async function sendNewOrderToOwner(input: SendOwnerEmailInput): Promise<SendMailResult> {
  const { ownerEmail, slug, order } = input;
  const ref = orderRefShort(order);
  const subject = `New order #${ref} on ${slug}`;
  const dashboardUrl = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')}/account/orders/${order.id}`;

  const customerLines = [
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    order.customerEmail ? `Email: ${order.customerEmail}` : '',
  ].filter((line) => line.length > 0);
  const addressLines = formatAddressLines(order);

  const items = itemsTable(order);
  const instr = instructionsBlock(input.paymentInstructions ?? null);
  const customer = paragraphs(customerLines);
  const address = addressLines.length > 0 ? paragraphs(addressLines) : { html: '', text: '' };

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;">
      <h2 dir="auto" style="margin:0 0 12px 0;font-size:18px;">
        New order #${escapeHtml(ref)}
      </h2>
      <p dir="auto" style="margin:0 0 16px 0;color:#444;">
        Payment method: ${escapeHtml(paymentMethodLabel(order))}
      </p>
      ${items.html}
      <h3 dir="auto" style="margin:16px 0 8px 0;font-size:15px;">Customer</h3>
      ${customer.html}
      ${addressLines.length > 0 ? `<h3 dir="auto" style="margin:16px 0 8px 0;font-size:15px;">Shipping address</h3>${address.html}` : ''}
      ${order.notes ? `<h3 dir="auto" style="margin:16px 0 8px 0;font-size:15px;">Notes</h3><p dir="auto" style="margin:0 0 8px 0;">${escapeHtml(order.notes)}</p>` : ''}
      ${instr.html}
      <p style="margin:24px 0 0 0;">
        <a href="${dashboardUrl}" style="color:#0a0a0a;text-decoration:underline;">
          Open order in dashboard
        </a>
      </p>
    </div>
  `;

  const text = [
    `New order #${ref} on ${slug}`,
    `Payment method: ${paymentMethodLabel(order)}`,
    '',
    items.text,
    '',
    'Customer',
    customer.text,
    addressLines.length > 0 ? `\nShipping address\n${address.text}` : '',
    order.notes ? `\nNotes\n${order.notes}` : '',
    instr.text,
    '',
    `Open order: ${dashboardUrl}`,
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  return sendMail({
    to: ownerEmail,
    subject,
    html,
    text,
    tag: 'order-owner',
    replyTo: order.customerEmail ?? undefined,
  });
}

export type SendBuyerEmailInput = {
  buyerEmail: string;
  slug: string;
  order: Order;
  paymentInstructions?: PaymentInstructionBlock | null;
};

export async function sendOrderConfirmationToBuyer(
  input: SendBuyerEmailInput,
): Promise<SendMailResult> {
  const { buyerEmail, slug, order } = input;
  const ref = orderRefShort(order);
  const subject = `Your order #${ref}`;

  const items = itemsTable(order);
  const instr = instructionsBlock(input.paymentInstructions ?? null);
  const greeting = paragraphs([
    `Thank you, ${order.customerName}.`,
    'We have received your order and will be in touch shortly.',
  ]);

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;">
      <h2 dir="auto" style="margin:0 0 12px 0;font-size:18px;">
        Order #${escapeHtml(ref)} — ${escapeHtml(slug)}
      </h2>
      ${greeting.html}
      ${items.html}
      <p dir="auto" style="margin:0 0 8px 0;color:#444;">
        Payment method: ${escapeHtml(paymentMethodLabel(order))}
      </p>
      ${instr.html}
    </div>
  `;

  const text = [
    `Order #${ref} — ${slug}`,
    '',
    greeting.text,
    '',
    items.text,
    '',
    `Payment method: ${paymentMethodLabel(order)}`,
    instr.text,
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  return sendMail({
    to: buyerEmail,
    subject,
    html,
    text,
    tag: 'order-buyer',
  });
}
