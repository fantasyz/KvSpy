import { ensureLib } from './lib';
import { Const } from '../KvCache/Model/Const';
import { BootService } from '../KvCache/Services/BootService';

// Native window management + app boot, desktop-only.
//
// The Neutralino binary injects the NL_PORT/NL_TOKEN globals into the page
// (it spins up its WebSocket bridge asynchronously). In dev (`neu run`), the
// CLI additionally patches index.html once Vite is ready, which makes Vite
// do a FULL PAGE RELOAD. The injection is a document-start userscript that
// can be MISSED by a page that loaded before the dev extension finished
// initialising, so a document may never receive the globals. This module
// copes with that in three ways:
//   1. persist NL_PORT/NL_TOKEN to sessionStorage the moment they appear, so
//      a later document (e.g. the CLI-triggered reload) can still find them
//      (the client library itself also reads NL_TOKEN from sessionStorage as
//      a fallback); a fresh injection always wins over the stored values;
//   2. restore the stored values on a document that lacks them — the port
//      only when the stored binary instance is still alive (a stale token
//      from an older run would make the client wipe the page with
//      NE_CL_IVCTOKN);
//   3. if this document still has no bridge after a grace period, reload the
//      page (bounded per tab session) so the binary gets another chance to
//      inject into a fresh document.
//
// Note: close-confirmation on the native X button is NOT supported in
// Neutralino v6 — the X button terminates the process (exitProcessOnClose)
// without giving the webview a chance to run JS.

const SESSION_KEY_PORT = 'NL_PORT';
const SESSION_KEY_TOKEN = 'NL_TOKEN';
const SESSION_KEY_SELF_RELOADS = '__neuBridgeSelfReloads';

// Reload the page if the bridge is still missing after this grace period.
// By then the CLI's own patch+reload has settled and the dev extension is
// definitely initialised, so a fresh document has a real chance at the
// injection.
const RELOAD_GRACE_MS = 12_000;
const MAX_SELF_RELOADS = 3;

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage unavailable — the bridge still works for this document.
  }
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Persist the injected bridge values right away, so a subsequent
// CLI-triggered page reload can still find them.
function persistBridge(): void {
  const w = globalThis as { NL_PORT?: unknown; NL_TOKEN?: unknown };
  if (typeof w.NL_TOKEN === 'string' && w.NL_TOKEN.length > 0) {
    sessionSet(SESSION_KEY_TOKEN, w.NL_TOKEN);
  }
  if (w.NL_PORT !== undefined && w.NL_PORT !== null) {
    sessionSet(SESSION_KEY_PORT, String(w.NL_PORT));
  }
}

// True if a Neutralino server on the stored dev port still answers. Used to
// avoid restoring a stale token when the binary is not running (e.g. the app
// opened in a plain browser after a dev run).
async function binaryAlive(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__neutralino_globals.js`, {
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Dev-only bridge credentials, provided by the automation driver: it mirrors
// the binary's .tmp/auth_info.json (written with --export-auth-info) to
// .tmp/bridge-credentials.js, which the driver injects as a <script> tag. Used
// when this document missed the binary's one-time token injection. Gated on
// freshness so a leftover file from an older run (dead binary) is never adopted.
const DEV_BRIDGE_MAX_AGE_MS = 5 * 60_000;

interface DevBridgeCredentials {
  port?: unknown;
  token?: unknown;
  capturedAt?: unknown;
}

function bridgeFromDevCredentials(): boolean {
  const creds = (globalThis as { __NEU_DEV_BRIDGE?: DevBridgeCredentials }).__NEU_DEV_BRIDGE;
  if (!creds || typeof creds.token !== 'string' || creds.token.length === 0) {
    return false;
  }
  if (
    typeof creds.capturedAt === 'string' &&
    Date.now() - Date.parse(creds.capturedAt) > DEV_BRIDGE_MAX_AGE_MS
  ) {
    return false;
  }
  const w = globalThis as { NL_PORT?: unknown; NL_TOKEN?: unknown; NL_GINJECTED?: boolean };
  if (typeof creds.port === 'number' && Number.isFinite(creds.port)) {
    w.NL_PORT = creds.port;
  }
  w.NL_TOKEN = creds.token;
  w.NL_GINJECTED = true;
  console.log(`[native] bridge restored from dev credentials (port=${String(creds.port)})`);
  return true;
}

// Copy a previous document's persisted bridge values into window scope so
// the client library can find them. `probePort` gates the (one-shot, per
// document) liveness fetch used to restore the port.
async function restoreBridge(probePort: boolean): Promise<void> {
  const w = globalThis as { NL_PORT?: unknown; NL_TOKEN?: unknown; NL_GINJECTED?: boolean };
  if (probePort && typeof w.NL_PORT === 'undefined') {
    const port = Number(sessionGet(SESSION_KEY_PORT));
    if (Number.isInteger(port) && port > 0 && (await binaryAlive(port))) {
      w.NL_PORT = port;
    }
  }
  if (typeof w.NL_TOKEN !== 'string' || w.NL_TOKEN.length === 0) {
    const token = sessionGet(SESSION_KEY_TOKEN);
    if (token) {
      w.NL_TOKEN = token;
      // Force the client to connect via 127.0.0.1 (where the binary listens
      // in dev) rather than the page's own hostname.
      w.NL_GINJECTED = true;
    }
  }
}

function bridgeIsReady(): boolean {
  const w = globalThis as { NL_PORT?: unknown; NL_TOKEN?: unknown };
  return (
    typeof w.NL_PORT !== 'undefined' &&
    typeof w.NL_TOKEN === 'string' &&
    w.NL_TOKEN.length > 0
  );
}

// Reload the page so the binary can inject the bridge into a fresh document.
// Bounded per tab session (the counter lives in sessionStorage and survives
// reloads; it is cleared when the bridge becomes ready).
function selfReload(): void {
  const attempts = Number(sessionGet(SESSION_KEY_SELF_RELOADS) ?? '0');
  if (!Number.isFinite(attempts) || attempts >= MAX_SELF_RELOADS) {
    return;
  }
  sessionSet(SESSION_KEY_SELF_RELOADS, String(attempts + 1));
  console.log(
    `[native] bridge globals missing from this document; reloading page ` +
      `(self-reload ${attempts + 1}/${MAX_SELF_RELOADS})…`,
  );
  location.reload();
  // Does not return.
}

// Wait until the native bridge is available, or time out. Persists the
// values the moment they arrive; on a document that never received the
// injection, falls back to the persisted values and, after a grace period,
// reloads the page (bounded) to get a fresh injection chance.
async function waitForBridge(timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  let portProbed = false;
  while (!bridgeIsReady() && Date.now() - start < timeoutMs) {
    persistBridge();
    if (!bridgeIsReady()) {
      // Cheap no-op once restored (window values are already set).
      await restoreBridge(!portProbed);
      portProbed = true;
    }
    if (!bridgeIsReady()) {
      // Cheap sync no-op once adopted (window values are already set).
      bridgeFromDevCredentials();
    }
    if (!bridgeIsReady() && Date.now() - start > RELOAD_GRACE_MS) {
      selfReload();
    }
    if (!bridgeIsReady()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (bridgeIsReady()) {
    sessionRemove(SESSION_KEY_SELF_RELOADS);
  }
  const w = globalThis as { NL_PORT?: unknown; NL_TOKEN?: unknown };
  const tokenDesc =
    typeof w.NL_TOKEN === 'undefined' ? 'undefined' : `len=${String(w.NL_TOKEN).length}`;
  console.log(
    bridgeIsReady()
      ? `[native] bridge ready (NL_PORT=${String(w.NL_PORT)} NL_TOKEN=${tokenDesc})`
      : `[native] bridge NOT ready after ${timeoutMs}ms (NL_PORT=${String(w.NL_PORT)} NL_TOKEN=${tokenDesc})`,
  );
  return bridgeIsReady();
}

// Initialize the native window and start the app. Call once from main.tsx.
export async function initNativePlatform(): Promise<void> {
  const ready = await waitForBridge();
  if (!ready) {
    // Do NOT init the client without a token — the failed WebSocket handshake
    // would make the client library wipe the page body with an error.
    console.error('[native] bridge never became ready; native APIs disabled.');
    return;
  }

  const lib = await ensureLib();

  const title = Const.app.windowTitle;
  await lib.window
    .setTitle(title)
    .then(() => console.log('[native] setTitle OK:', title))
    .catch((err) => console.warn('[native] setTitle FAILED:', err));

  // Boot the app now that the native bridge is ready.
  await BootService.init();
}
