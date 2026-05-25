import { cookies, headers } from 'next/headers';
import { THEME_COOKIE, THEME_INIT_SCRIPT, type Theme, isTheme } from '@/lib/theme';

/**
 * Server-only helper that reads the theme cookie. Falls back to `'light'`
 * when the cookie is absent — the inline `THEME_INIT_SCRIPT` will quickly
 * re-flip to the user's system preference and persist it for next time.
 *
 * Wrapped in try/catch because some Next runtimes (edge middleware,
 * preview routes) call this without a request context.
 */
export async function getServerTheme(): Promise<Theme> {
  try {
    const c = await cookies();
    const v = c.get(THEME_COOKIE)?.value;
    if (isTheme(v)) return v;
  } catch {
    /* fall through */
  }
  try {
    const h = await headers();
    const cookieHeader = h.get('cookie');
    if (cookieHeader) {
      const m = cookieHeader.match(/(?:^|;\s*)souqna-theme=(light|dark)\b/);
      if (m && isTheme(m[1])) return m[1];
    }
  } catch {
    /* fall through */
  }
  return 'light';
}

/**
 * Renders the inline `<script>` tag that flips `<html data-theme>` and
 * persists the cookie before paint. Drop this as the first child of
 * `<head>` (or just inside `<body>` before any UI) in every document
 * shell so first paint is correct.
 */
export function ThemeInitScript() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  );
}
