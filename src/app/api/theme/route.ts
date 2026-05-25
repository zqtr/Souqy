import { NextRequest, NextResponse } from 'next/server';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isTheme } from '@/lib/theme';

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function GET(request: NextRequest) {
  const theme = request.nextUrl.searchParams.get('theme');
  const redirectTo = safeRedirectPath(request.nextUrl.searchParams.get('redirect'));
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  if (isTheme(theme)) {
    response.cookies.set(THEME_COOKIE, theme, {
      maxAge: THEME_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    });
  }

  return response;
}
