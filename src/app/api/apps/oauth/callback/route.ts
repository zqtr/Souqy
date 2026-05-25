import { NextResponse, type NextRequest } from 'next/server';
import { recordAudit } from '@/lib/audit';
import {
  consumeOAuthState,
  oauthRedirectUri,
  requiredOAuthEnv,
} from '@/lib/apps/oauth';
import {
  exchangeKlaviyoCode,
  exchangeMailchimpCode,
  exchangeMetaCode,
  persistOAuthInstall,
  syncOAuthApp,
} from '@/lib/apps/oauth-providers';

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get('state') ?? '';
  const state = await consumeOAuthState(stateParam);
  const fallback = new URL('/account/apps', req.url);
  if (!state) {
    fallback.searchParams.set('error', 'invalid_oauth_state');
    return NextResponse.redirect(fallback);
  }

  const appUrl = new URL(`/account/apps/${state.appId}`, req.url);
  appUrl.searchParams.set('store', state.storefrontSlug);
  const configureUrl = new URL(`/account/apps/${state.appId}/configure`, req.url);
  configureUrl.searchParams.set('store', state.storefrontSlug);

  const providerError =
    req.nextUrl.searchParams.get('error_description') ??
    req.nextUrl.searchParams.get('error');
  if (providerError) {
    await recordAudit({
      storefrontSlug: state.storefrontSlug,
      clerkUserId: state.clerkUserId,
      action: 'app.oauth.denied',
      targetId: state.appId,
      summary: `OAuth connection denied for ${state.appId}`,
      meta: { reason: providerError.slice(0, 500) },
    }).catch(() => {});
    appUrl.searchParams.set('error', 'oauth_denied');
    return NextResponse.redirect(appUrl);
  }

  const code = req.nextUrl.searchParams.get('code') ?? '';
  const client = requiredOAuthEnv(state.appId);
  if (!code || !client) {
    appUrl.searchParams.set('error', 'oauth_config');
    return NextResponse.redirect(appUrl);
  }

  try {
    const redirectUri = oauthRedirectUri();
    const tokens =
      state.appId === 'mailchimp'
        ? await exchangeMailchimpCode({
            code,
            redirectUri,
            clientId: client.clientId,
            clientSecret: client.clientSecret,
          })
        : state.appId === 'klaviyo'
          ? await exchangeKlaviyoCode({
              code,
              redirectUri,
              codeVerifier:
                typeof state.payload.codeVerifier === 'string'
                  ? state.payload.codeVerifier
                  : '',
              clientId: client.clientId,
              clientSecret: client.clientSecret,
            })
          : state.appId === 'whatsapp-business' || state.appId === 'instagram-shop'
            ? await exchangeMetaCode({
                appId: state.appId,
                code,
                redirectUri,
                clientId: client.clientId,
                clientSecret: client.clientSecret,
              })
            : null;

    if (!tokens) throw new Error('Unsupported OAuth app.');
    await persistOAuthInstall({
      storefrontSlug: state.storefrontSlug,
      appId: state.appId,
      clerkUserId: state.clerkUserId,
      tokens,
    });
    await syncOAuthApp(state.storefrontSlug, state.appId).catch(async (err) => {
      await recordAudit({
        storefrontSlug: state.storefrontSlug,
        clerkUserId: state.clerkUserId,
        action: 'app.oauth.sync_failed',
        targetId: state.appId,
        summary: `Connected ${state.appId}, sync needs attention`,
        meta: { reason: err instanceof Error ? err.message.slice(0, 500) : 'sync failed' },
      }).catch(() => {});
    });
    configureUrl.searchParams.set('connected', '1');
    return NextResponse.redirect(configureUrl);
  } catch (err) {
    await recordAudit({
      storefrontSlug: state.storefrontSlug,
      clerkUserId: state.clerkUserId,
      action: 'app.oauth.failed',
      targetId: state.appId,
      summary: `OAuth connection failed for ${state.appId}`,
      meta: { reason: err instanceof Error ? err.message.slice(0, 500) : 'unknown' },
    }).catch(() => {});
    appUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(appUrl);
  }
}
