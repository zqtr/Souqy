import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getAppDescriptor } from '@/lib/apps/registry';
import {
  codeChallenge,
  createOAuthState,
  newVerifier,
  oauthRedirectUri,
  requiredOAuthEnv,
} from '@/lib/apps/oauth';
import { assertStorefrontOwner } from '@/lib/products';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      new URL('/sign-in?redirect_url=/account/apps', req.url),
    );
  }

  const appId = req.nextUrl.searchParams.get('app')?.trim() ?? '';
  const storefrontSlug = req.nextUrl.searchParams.get('store')?.trim() ?? '';
  const desc = getAppDescriptor(appId);
  const failUrl = new URL(`/account/apps/${encodeURIComponent(appId)}`, req.url);
  if (storefrontSlug) failUrl.searchParams.set('store', storefrontSlug);

  if (!desc || !desc.available || desc.authKind !== 'oauth') {
    failUrl.searchParams.set('error', 'unavailable');
    return NextResponse.redirect(failUrl);
  }
  const owner = await assertStorefrontOwner(storefrontSlug, userId);
  if (!owner) {
    failUrl.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(failUrl);
  }
  if (!env.APPS_ENCRYPTION_KEY) {
    failUrl.searchParams.set('error', 'vault');
    return NextResponse.redirect(failUrl);
  }
  const client = requiredOAuthEnv(appId);
  const authBase =
    appId === 'whatsapp-business' || appId === 'instagram-shop'
      ? `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`
      : desc.oauthAuthorizationUrl;
  if (!client || !authBase) {
    failUrl.searchParams.set('error', 'env');
    return NextResponse.redirect(failUrl);
  }

  const verifier = appId === 'klaviyo' ? newVerifier() : null;
  const state = await createOAuthState({
    storefrontSlug,
    appId,
    clerkUserId: userId,
    payload: verifier ? { codeVerifier: verifier } : {},
  });
  const redirectUri = oauthRedirectUri();
  const authUrl = new URL(authBase);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', client.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  if (desc.oauthScope) authUrl.searchParams.set('scope', desc.oauthScope);
  if (verifier) {
    authUrl.searchParams.set('code_challenge', codeChallenge(verifier));
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  return NextResponse.redirect(authUrl);
}
