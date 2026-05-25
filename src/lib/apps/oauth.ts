import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getAppDescriptor } from './registry';

export type OAuthStatePayload = {
  stateId: string;
  storefrontSlug: string;
  appId: string;
  clerkUserId: string;
};

export type OAuthStateRecord = OAuthStatePayload & {
  payload: Record<string, unknown>;
};

type OAuthClient = {
  clientId: string;
  clientSecret: string;
};

function signingKey() {
  return env.APPS_ENCRYPTION_KEY ?? env.CLERK_SECRET_KEY ?? 'souqna-oauth-dev-only';
}

function signState(body: string) {
  return createHmac('sha256', signingKey()).update(body).digest('base64url');
}

function constantTimeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function newVerifier() {
  return randomBytes(32).toString('base64url');
}

export function codeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function createOAuthState(input: {
  storefrontSlug: string;
  appId: string;
  clerkUserId: string;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const stateId = randomBytes(32).toString('base64url');
  await db()`
    insert into oauth_state (
      state, storefront_slug, app_id, clerk_user_id, payload
    ) values (
      ${stateId}, ${input.storefrontSlug}, ${input.appId},
      ${input.clerkUserId}, ${JSON.stringify(input.payload ?? {})}::jsonb
    )
  `;

  const body = Buffer.from(
    JSON.stringify({
      stateId,
      storefrontSlug: input.storefrontSlug,
      appId: input.appId,
      clerkUserId: input.clerkUserId,
    } satisfies OAuthStatePayload),
    'utf8',
  ).toString('base64url');
  return `${body}.${signState(body)}`;
}

export async function consumeOAuthState(state: string): Promise<OAuthStateRecord | null> {
  const [body, signature] = state.split('.');
  if (!body || !signature || !constantTimeEqual(signState(body), signature)) {
    return null;
  }

  let decoded: OAuthStatePayload;
  try {
    decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    !decoded ||
    typeof decoded.stateId !== 'string' ||
    typeof decoded.storefrontSlug !== 'string' ||
    typeof decoded.appId !== 'string' ||
    typeof decoded.clerkUserId !== 'string'
  ) {
    return null;
  }

  const rows = (await db()`
    delete from oauth_state
    where state = ${decoded.stateId}
      and storefront_slug = ${decoded.storefrontSlug}
      and app_id = ${decoded.appId}
      and clerk_user_id = ${decoded.clerkUserId}
      and expires_at > now()
    returning payload
  `) as unknown as Array<{ payload: unknown }>;

  const payload = rows[0]?.payload;
  if (!rows[0]) return null;
  return {
    ...decoded,
    payload:
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  };
}

export function oauthRedirectUri() {
  return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, '')}/api/apps/oauth/callback`;
}

export function requiredOAuthEnv(appId: string): OAuthClient | null {
  const desc = getAppDescriptor(appId);
  const missing = (desc?.requiredEnv ?? []).filter((key) => !process.env[key]?.trim());
  if (!desc || missing.length > 0 || desc.authKind !== 'oauth') return null;
  if (appId === 'mailchimp') {
    return {
      clientId: process.env.MAILCHIMP_CLIENT_ID!,
      clientSecret: process.env.MAILCHIMP_CLIENT_SECRET!,
    };
  }
  if (appId === 'klaviyo') {
    return {
      clientId: process.env.KLAVIYO_CLIENT_ID!,
      clientSecret: process.env.KLAVIYO_CLIENT_SECRET!,
    };
  }
  if (appId === 'whatsapp-business' || appId === 'instagram-shop') {
    return {
      clientId: process.env.META_APP_ID!,
      clientSecret: process.env.META_APP_SECRET!,
    };
  }
  return null;
}
