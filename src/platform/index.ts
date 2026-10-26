import { ensureLib } from './lib';

// Terminate the app by killing the process directly.
//
// Workaround for Neutralino double-exit bug: calling `app.exit()` or closing
// the window triggers a race condition where both the window state handler and
// the webview dispose handler try to exit, causing a crash in the websocket
// shutdown.
//
// Solution: use `killProcess()` to terminate the process cleanly without going
// through the window close path that causes the race condition.
export async function quitApp(): Promise<void> {
  console.log('[platform] quitApp → app.killProcess()');
  const lib = await ensureLib();
  await lib.app.killProcess();
}
