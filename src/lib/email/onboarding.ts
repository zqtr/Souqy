import 'server-only';

import { sendMail, type SendMailResult } from '@/lib/mailer';

export type SendStorefrontOnboardingEmailInput = {
  to: string;
  ownerName: string;
  storefrontName: string;
  storefrontUrl: string;
};

const DASHBOARD_URL = 'https://souqna.qa/account';
const DOCS_URL = 'https://souqna.qa/docs';
const WHATSAPP_URL = 'https://wa.me/97450525400';
const SUPPORT_EMAIL = 'support@souqna.qa';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildText(input: SendStorefrontOnboardingEmailInput): string {
  const { ownerName, storefrontName, storefrontUrl } = input;
  return [
    'Souqna · سوقنا',
    '',
    `Welcome, ${ownerName}.`,
    '',
    'Your storefront is live. Congratulations',
    '',
    `${storefrontName} is now published at: ${storefrontUrl}`,
    '',
    '────────────────────',
    '',
    "You've taken the first step every Qatari home business deserves to take — moving your work from Instagram DMs into a real online home you own.",
    '',
    "Here's what to do next:",
    '',
    '·  Add your first products Photos, prices, descriptions in Arabic and English.',
    '',
    '·  Customize your look Choose your colors, your fonts, your story.',
    '',
    `·  Share your link Send ${storefrontUrl} to your customers, your family, your WhatsApp groups. Let Qatar see what you've built.`,
    '',
    '·  Test your first order Walk through it as a customer would. Make sure everything feels right.',
    '',
    '────────────────────',
    '',
    'A note from Souqna:',
    '',
    'We built this for you — the Qatari home businesses who deserve more than Instagram screenshots and forgotten WhatsApp chats. Your work has always been worth a real storefront. Now you have one.',
    '',
    "If you need anything, we're a message away. Reply directly to this email or message us on WhatsApp.",
    '',
    '────────────────────',
    '',
    'أهلاً بك في سوقنا',
    '',
    'متجرك صار حيّ',
    '',
    'أضف منتجاتك. عدّل تصميمك. شارك رابطك مع زبائنك. ولو احتجت أي شي — احنا قريبين منك',
    '',
    '────────────────────',
    '',
    `Open your dashboard: ${DASHBOARD_URL}`,
    '',
    `Get help: ${DOCS_URL}`,
    '',
    `WhatsApp us: ${WHATSAPP_URL}`,
    '',
    '────────────────────',
    '',
    `Souqna · سوقنا Built in Doha, for Doha. صُنع في الدوحة، للدوحة.`,
    '',
    `souqna.qa  ·  ${SUPPORT_EMAIL}`,
  ].join('\n');
}

function buildHtml(input: SendStorefrontOnboardingEmailInput): string {
  const ownerName = escapeHtml(input.ownerName);
  const storefrontName = escapeHtml(input.storefrontName);
  const storefrontUrl = escapeHtml(input.storefrontUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f1e8;color:#1d160f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">Your Souqna storefront is live at ${storefrontUrl}.</div>
    <main style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <section style="background:#fffaf2;border:1px solid #eadfcd;border-radius:24px;padding:32px;">
        <p style="margin:0 0 24px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b6046;">Souqna · سوقنا</p>
        <h1 style="margin:0 0 8px;font-size:30px;line-height:1.15;">Welcome, ${ownerName}.</h1>
        <p style="margin:0 0 20px;font-size:18px;">Your storefront is live. Congratulations.</p>
        <p style="margin:0 0 28px;font-size:16px;line-height:1.6;"><strong>${storefrontName}</strong> is now published at:<br><a href="${storefrontUrl}" style="color:#8a4b20;">${storefrontUrl}</a></p>
        <hr style="border:0;border-top:1px solid #eadfcd;margin:28px 0;">
        <p style="font-size:16px;line-height:1.7;margin:0 0 20px;">You've taken the first step every Qatari home business deserves to take — moving your work from Instagram DMs into a real online home you own.</p>
        <p style="font-size:16px;font-weight:700;margin:0 0 12px;">Here's what to do next:</p>
        <ul style="padding-inline-start:22px;margin:0 0 24px;font-size:15px;line-height:1.7;">
          <li><strong>Add your first products.</strong> Photos, prices, descriptions in Arabic and English.</li>
          <li><strong>Customize your look.</strong> Choose your colors, your fonts, your story.</li>
          <li><strong>Share your link.</strong> Send <a href="${storefrontUrl}" style="color:#8a4b20;">${storefrontUrl}</a> to your customers, your family, your WhatsApp groups. Let Qatar see what you've built.</li>
          <li><strong>Test your first order.</strong> Walk through it as a customer would. Make sure everything feels right.</li>
        </ul>
        <hr style="border:0;border-top:1px solid #eadfcd;margin:28px 0;">
        <p style="font-size:16px;font-weight:700;margin:0 0 12px;">A note from Souqna:</p>
        <p style="font-size:16px;line-height:1.7;margin:0 0 16px;">We built this for you — the Qatari home businesses who deserve more than Instagram screenshots and forgotten WhatsApp chats. Your work has always been worth a real storefront. Now you have one.</p>
        <p style="font-size:16px;line-height:1.7;margin:0 0 24px;">If you need anything, we're a message away. Reply directly to this email or message us on WhatsApp.</p>
        <div dir="rtl" lang="ar" style="background:#f3eadc;border-radius:18px;padding:20px;margin:0 0 24px;text-align:right;">
          <p style="font-size:20px;font-weight:700;margin:0 0 8px;">أهلاً بك في سوقنا</p>
          <p style="font-size:17px;font-weight:700;margin:0 0 8px;">متجرك صار حيّ</p>
          <p style="font-size:15px;line-height:1.8;margin:0;">أضف منتجاتك. عدّل تصميمك. شارك رابطك مع زبائنك. ولو احتجت أي شي — احنا قريبين منك</p>
        </div>
        <p style="margin:0 0 8px;"><a href="${DASHBOARD_URL}" style="color:#8a4b20;font-weight:700;">Open your dashboard</a></p>
        <p style="margin:0 0 8px;"><a href="${DOCS_URL}" style="color:#8a4b20;">Get help</a></p>
        <p style="margin:0 0 24px;"><a href="${WHATSAPP_URL}" style="color:#8a4b20;">WhatsApp us</a></p>
        <hr style="border:0;border-top:1px solid #eadfcd;margin:28px 0;">
        <p style="font-size:13px;line-height:1.6;color:#7b6046;margin:0;">Souqna · سوقنا<br>Built in Doha, for Doha. صُنع في الدوحة، للدوحة.<br>souqna.qa · <a href="mailto:${SUPPORT_EMAIL}" style="color:#7b6046;">${SUPPORT_EMAIL}</a></p>
      </section>
    </main>
  </body>
</html>`;
}

export async function sendStorefrontOnboardingEmail(
  input: SendStorefrontOnboardingEmailInput,
): Promise<SendMailResult> {
  return sendMail({
    provider: 'resend',
    to: input.to,
    subject: `Welcome to Souqna — ${input.storefrontName} is live`,
    html: buildHtml(input),
    text: buildText(input),
    replyTo: SUPPORT_EMAIL,
    tag: 'storefront-onboarding',
  });
}
