import 'server-only';
import { Sandbox } from '@vercel/sandbox';

/**
 * Pre-publish screenshot capture.
 *
 * After a successful build but before we flip `souqy_revision` to point
 * at the new artifact, we can spin up a sandbox-hosted browser to grab
 * a PNG of the rendered storefront. Two reasons:
 *
 *   1. **Diff against the previous revision** — surfaces "the layout
 *      shifted dramatically; are you sure?" affordances in the dashboard
 *      so a founder doesn't accidentally publish a busted re-prompt.
 *   2. **Audit artifact** — every revision row in `souqy_audit` can
 *      attach the URL so support can answer "what did the storefront
 *      look like at 3pm last Tuesday?" without re-rendering.
 *
 * V1 is opt-in: the `souqyKickoff` / `souqyReprompt` actions don't
 * block on this. The screenshot ships when `SOUQY_SCREENSHOT_ENABLED`
 * is `'true'`, otherwise the helper short-circuits and returns null so
 * cost stays predictable while we tune the trigger.
 *
 * Implementation note: the sandbox SDK exposes `screenshot()` for
 * Browser-typed sandboxes only. The capture pattern below boots a
 * lightweight microVM with `chromium` installed; for higher fidelity
 * we can swap to the `@vercel/sandbox/browser` runtime once that
 * lands in the SDK we ship with.
 */

export type ScreenshotOk = {
  status: 'ok';
  /** Browser-decodable data URL (base64 PNG). Caller uploads to Blob. */
  dataUrl: string;
  width: number;
  height: number;
};

export type ScreenshotErr = {
  status: 'disabled' | 'sandbox_failed' | 'capture_failed';
  message: string;
};

export type ScreenshotResult = ScreenshotOk | ScreenshotErr;

const SCREENSHOT_TIMEOUT_MS = 90_000;

export async function captureStorefrontScreenshot(args: {
  /** Public storefront URL — typically `https://<slug>.souqna.qa`. */
  url: string;
  width?: number;
  height?: number;
}): Promise<ScreenshotResult> {
  if (process.env.SOUQY_SCREENSHOT_ENABLED !== 'true') {
    return { status: 'disabled', message: 'Souqy screenshots are disabled by env.' };
  }
  const width = args.width ?? 1280;
  const height = args.height ?? 1600;

  let sandbox: InstanceType<typeof Sandbox>;
  try {
    sandbox = await Sandbox.create({
      runtime: 'node24',
      timeout: SCREENSHOT_TIMEOUT_MS,
    });
  } catch (err) {
    return {
      status: 'sandbox_failed',
      message: `Could not open screenshot sandbox: ${(err as Error).message}`,
    };
  }

  try {
    // Use Playwright's chromium binary inside the sandbox. We install
    // on demand so the cold path works; production should pre-bake a
    // dedicated browser snapshot (analogous to the build snapshot).
    const install = await sandbox.runCommand('npx', ['playwright@^1', 'install', '--with-deps', 'chromium']);
    if (install.exitCode !== 0) {
      return {
        status: 'sandbox_failed',
        message: `playwright install failed: ${(await install.stderr()).slice(0, 500)}`,
      };
    }
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ${width}, height: ${height} } });
  await page.goto(${JSON.stringify(args.url)}, { waitUntil: 'networkidle', timeout: 45000 });
  const buf = await page.screenshot({ fullPage: true });
  process.stdout.write(buf.toString('base64'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
`.trim();
    const b64Script = Buffer.from(script, 'utf8').toString('base64');
    const exec = await sandbox.runCommand('sh', [
      '-c',
      `printf '%s' '${b64Script}' | base64 -d > /tmp/shot.js && node /tmp/shot.js`,
    ]);
    if (exec.exitCode !== 0) {
      return {
        status: 'capture_failed',
        message: `screenshot capture failed: ${(await exec.stderr()).slice(0, 500)}`,
      };
    }
    const b64 = (await exec.stdout()).trim();
    return {
      status: 'ok',
      dataUrl: `data:image/png;base64,${b64}`,
      width,
      height,
    };
  } finally {
    try {
      await sandbox.stop();
    } catch (err) {
      console.warn('[souqy/screenshot] sandbox stop failed', err);
    }
  }
}
