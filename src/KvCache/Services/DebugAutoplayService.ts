import { Log } from '../../Common/Log';
import { Paths } from '../../Common/Paths';
import { Const } from '../Model/Const';
import { ensureLib } from '../../platform/lib';
import { EngineService } from './EngineService';
import useSettingsStore from '../Store/useSettingsStore';
import useConnectionStore from '../Store/useConnectionStore';
import type { TextMode } from '../Model/types';

// One action in the headless replay script (~/.KvSpy/debug-autoplay.json). The
// union grows as more action types are needed; add the executor to `executors` too.
type AutoplayAction =
  | { type: 'connect'; host: string; text?: TextMode }
  | { type: 'query'; text: TextMode };

// The on-disk script shape: { "action": [ ... ] }.
interface AutoplayScript {
  action?: AutoplayAction[];
}

type AutoplayExecutor = (action: AutoplayAction) => Promise<void>;

// Loads and runs an optional debug script at boot so the app can be driven and
// observed headlessly (from the log) without clicking through the UI. Skipped
// entirely when the script is absent, so normal interactive runs are unaffected.
export abstract class DebugAutoplayService {
  // Action type -> executor. Extend here to support new actions.
  private static readonly executors: Record<string, AutoplayExecutor> = {
    connect: DebugAutoplayService.onConnect,
    query: DebugAutoplayService.onQuery,
  };

  // Run the replay script, if present. Returns immediately when absent.
  static async run(): Promise<void> {
    const raw = await DebugAutoplayService.loadScript();
    if (raw === null) {
      return;
    }
    const actions = DebugAutoplayService.parseActions(raw);
    if (actions.length === 0) {
      Log.write('[autoplay] No actions defined; nothing to run.');
      return;
    }
    Log.write(`[autoplay] Running ${actions.length} action(s).`);
    // Run in order and await each one: a later action (e.g. query) may depend on
    // an earlier one (e.g. connect) having completed.
    for (const [index, action] of actions.entries()) {
      const executor = DebugAutoplayService.executors[action.type];
      if (!executor) {
        Log.write(`[autoplay] Unknown action type '${action.type}'; skipping.`, true);
        continue;
      }
      Log.write(`[autoplay] [${index}] ${action.type} ${summarize(action)}`);
      try {
        await executor(action);
      } catch (err) {
        Log.write(`[autoplay] Action '${action.type}' failed: ${errMsg(err)}`, true);
      }
    }
    Log.write('[autoplay] Done.');
  }

  // connect: point the app at the given host, set the optional text level, and connect.
  private static async onConnect(action: AutoplayAction): Promise<void> {
    const { host, text } = action as { host?: string; text?: TextMode };
    if (host) {
      useSettingsStore.getState().setEngineUrl(hostUrl(host));
    }
    if (text) {
      useSettingsStore.getState().setTextMode(text);
      Log.write(`[autoplay] Text mode set to '${text}'.`);
    }
    await EngineService.connect();
  }

  // query: switch the text level, then re-query so the new content is fetched.
  private static async onQuery(action: AutoplayAction): Promise<void> {
    const text = (action as { text?: TextMode }).text;
    if (!text) {
      Log.write('[autoplay] query action missing "text"; skipping.');
      return;
    }
    useSettingsStore.getState().setTextMode(text);
    Log.write(`[autoplay] Text mode set to '${text}'.`);
    if (useConnectionStore.getState().status === 'connected') {
      await EngineService.connect();
    }
  }

  // Read the raw script, or null when it does not exist (the normal case).
  private static async loadScript(): Promise<string | null> {
    const lib = await ensureLib();
    const path = `${Paths.current.root}/${Const.app.debugAutoplayFile}`;
    try {
      const raw = await lib.filesystem.readFile(path);
      Log.write(`[autoplay] Loaded ${path}`);
      return raw;
    } catch {
      return null;
    }
  }

  // Parse the script body; never throw so a malformed file can't block boot.
  private static parseActions(raw: string): AutoplayAction[] {
    try {
      const script = JSON.parse(raw) as AutoplayScript;
      return Array.isArray(script.action) ? script.action : [];
    } catch (err) {
      Log.write(`[autoplay] Could not parse script: ${errMsg(err)}`, true);
      return [];
    }
  }
}

// A short human-readable argument list for a log line.
function summarize(action: AutoplayAction): string {
  switch (action.type) {
    case 'connect':
      return action.text ? `host=${action.host} text=${action.text}` : `host=${action.host}`;
    case 'query':
      return `text=${action.text}`;
  }
}

// Turn a bare host (127.0.0.1:8080) into a full URL; pass through if already set.
function hostUrl(host: string): string {
  const trimmed = host.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

// Render an error (which may be a Neutralino error object, not a JS Error).
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}
