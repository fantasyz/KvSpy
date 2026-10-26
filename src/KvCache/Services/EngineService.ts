import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Log } from '../../Common/Log';
import { ensureLib } from '../../platform/lib';
import { Const } from '../Model/Const';
import useSettingsStore from '../Store/useSettingsStore';
import useConnectionStore from '../Store/useConnectionStore';
import { CellFlashService } from './CellFlashService';
import { CacheDeltaService } from './CacheDeltaService';
import { SettingsService } from './SettingsService';
import { ResponseLogService } from './ResponseLogService';
import type {
  ContextCacheEntry,
  ContextCacheResponse,
  PromptSegment,
  TextMode,
} from '../Model/types';

// Talks to the inference engine's admin API.
//
// HTTP goes through the Neutralino native bridge (net.request) rather than the
// webview's fetch(): the engine sends no CORS headers, so a browser fetch from
// the app origin would be blocked; net.request runs the call on the native side
// and is not subject to CORS.

// Monotonic generation token for connection attempts. A superseded attempt
// bumps it so the (still in-flight) request's late result is discarded —
// the native bridge offers no real request abort.
let connectionAttempt = 0;

// Monotonic generation token for the delta-sync state. connect() (and a
// poll that adopts the initial snapshot) bumps it so an in-flight poll —
// whose ?known= was built against the previous state — discards its late
// result instead of merging a stale diff.
let syncGeneration = 0;

export abstract class EngineService {
  // Build the cache-query URL from the current engine URL + text mode,
  // optionally appending the delta-sync ?known= parameter.
  private static buildCacheUrl(knownParam: string | null = null): string {
    const { engineUrl, textMode } = useSettingsStore.getState().settings;
    const base = `${trimTrailingSlash(engineUrl)}${Const.app.contextCachePath}?text=${textMode}`;
    return knownParam !== null ? `${base}&known=${knownParam}` : base;
  }

  // Connect: issue a context-cache query against the engine and log the result.
  static async connect(): Promise<void> {
    const attempt = ++connectionAttempt;
    const url = EngineService.buildCacheUrl();
    useConnectionStore.getState().setStatus('connecting');
    Log.write(`GET ${url}`);

    try {
      const lib = await ensureLib();
      const res = await lib.net.get(url);

      // A later attempt now owns the connection state; discard this
      // attempt's result.
      if (attempt !== connectionAttempt) {
        Log.write('Connect result discarded: attempt superseded.');
        return;
      }

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const result = parseContextCache(res.body);
      // Re-seed the delta state from this full listing; any in-flight poll
      // built its ?known= against the old state and must discard its result.
      ++syncGeneration;
      CacheDeltaService.rebuildFrom(result.entries);
      const conn = useConnectionStore.getState();
      conn.setStatus('connected', `${result.entries.length} entrie(s)`);
      conn.setLastResult(result);
      CellFlashService.onCacheUpdated(result);
      bus.emit(AppEvents.connectionChanged, { connected: true });
      bus.emit(AppEvents.cacheUpdated, { entries: result.entries });

      // Log connection status and save response to a standalone file.
      Log.write(`Connected. ${result.entries.length} cache entrie(s) returned.`);
      await ResponseLogService.save(url, res.body);
    } catch (err) {
      // A superseded attempt must not surface as an error.
      if (attempt !== connectionAttempt) {
        return;
      }
      const msg = errMsg(err);
      useConnectionStore.getState().setStatus('error', msg);
      bus.emit(AppEvents.connectionChanged, { connected: false });
      Log.write(`Connect failed: ${msg}`, true);
    }
  }

  // Background auto-refresh poll: re-pull the cache silently. Unlike connect(),
  // this does not flip the status to 'connecting' (no UI flicker), does not save
  // a response file, and is independent of the interactive connection token.
  // Failures are logged but never tear down the visible connection.
  static async poll(): Promise<void> {
    // Capture the generation now: if a connect (or an adopting poll) re-seeds
    // the delta state while this request is in flight, its diff is stale and
    // discarded.
    const generation = syncGeneration;
    const knownParam = CacheDeltaService.knownParam();
    try {
      const url = EngineService.buildCacheUrl(knownParam);
      const lib = await ensureLib();
      const res = await lib.net.get(url);

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      // Ignore a late poll superseded by a (re)seed of the delta state.
      if (generation !== syncGeneration) {
        return;
      }
      const conn = useConnectionStore.getState();
      if (conn.status !== 'connected') {
        // We hold no data yet (fresh boot): only a full fetch (no ?known=)
        // can seed the initial snapshot — a delta in flight while a connect
        // is starting carries a partial list and must be discarded.
        if (knownParam !== null) {
          return;
        }
        const full = parseContextCache(res.body);
        ++syncGeneration;
        CacheDeltaService.rebuildFrom(full.entries);
        conn.setStatus('connected', `${full.entries.length} entrie(s)`);
        conn.setLastResult(full);
        CellFlashService.onCacheUpdated(full);
        bus.emit(AppEvents.connectionChanged, { connected: true });
        bus.emit(AppEvents.cacheUpdated, { entries: full.entries });
        Log.write(`Auto-refresh adopted initial cache snapshot (${full.entries.length} entrie(s)).`);
        return;
      }

      // Merge the diff into the locally held entries so consumers keep seeing
      // a full list (a full-list response merges identically to a reseed).
      const response = parseContextCache(res.body);
      const entries = CacheDeltaService.applyDelta(response);
      // Payload trace (behind the logRefreshPayload debug setting): the
      // visible proof that the poll ran as a delta (a few hundred bytes)
      // rather than a full listing (megabytes with text=full).
      if (useSettingsStore.getState().settings.logRefreshPayload) {
        const responseBytes = new TextEncoder().encode(res.body).length;
        Log.write(
          knownParam !== null
            ? `Auto-refresh: ${responseBytes} B delta response (${knownParam.split(',').length} known pair(s)).`
            : `Auto-refresh: ${responseBytes} B full response (no known state).`
        );
      }
      const result = { ...response, entries };
      useConnectionStore.getState().setLastResult(result);
      CellFlashService.onCacheUpdated(result);
      bus.emit(AppEvents.cacheUpdated, { entries });
    } catch (err) {
      Log.write(`Auto-refresh failed: ${errMsg(err)}`, true);
    }
  }

  // Set the `text` query parameter mode (none|full) and re-query the
  // cache when we are already connected so the new content is reflected.
  static setTextMode(mode: TextMode): void {
    // Persistence and logging go through the settings service.
    SettingsService.setTextMode(mode);
    if (useConnectionStore.getState().status === 'connected') {
      void EngineService.connect();
    }
  }

  // Set the retention hint for a cache entry via PATCH.
  // `'auto'` clears any explicit retention and returns the entry to automatic
  // management; the other values set an explicit retention class.
  // Returns true on success, false on error.
  static async setRetention(
    entryId: string,
    retention: 'pinned' | 'default' | 'auto' | 'live_session' | 'disposable'
  ): Promise<boolean> {
    const { engineUrl } = useSettingsStore.getState().settings;
    const url = `${trimTrailingSlash(engineUrl)}${Const.app.contextCacheEntriesPath}/${entryId}`;
    Log.write(`PATCH ${url} retention: ${retention}`);

    try {
      const lib = await ensureLib();
      // Use the generic request method with PATCH. The body is passed as an extension
      // of the options (the native library accepts it even though the types don't show it).
      const options: Record<string, unknown> = {
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify({ retention }),
      };
      const res = await lib.net.request(url, 'PATCH', options as never);

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      Log.write(`Retention set to '${retention}' for entry ${entryId}.`);
      // Refresh the cache to reflect the new retention.
      await EngineService.connect();
      return true;
    } catch (err) {
      Log.write(`Failed to set retention: ${errMsg(err)}`, true);
      return false;
    }
  }

  // Issue the DELETE and return the raw HTTP status without the follow-up
  // refresh (0 on transport error). Callers that may retry (TriggerService)
  // decide when to refresh.
  static async releaseEntryRaw(entryId: string): Promise<number> {
    const { engineUrl } = useSettingsStore.getState().settings;
    const url = `${trimTrailingSlash(engineUrl)}${Const.app.contextCacheEntriesPath}/${entryId}`;
    Log.write(`DELETE ${url}`);

    try {
      const lib = await ensureLib();
      const res = await lib.net.delete(url);
      return res.status;
    } catch (err) {
      Log.write(`Failed to release entry: ${errMsg(err)}`, true);
      return 0;
    }
  }

  // Release a cache entry via DELETE.
  // Returns true on success, false on error.
  static async releaseEntry(entryId: string): Promise<boolean> {
    const status = await EngineService.releaseEntryRaw(entryId);
    if (status < 200 || status >= 300) {
      return false;
    }
    Log.write(`Entry ${entryId} released.`);
    // Refresh the cache to reflect the removed entry.
    await EngineService.connect();
    return true;
  }

}

// Render an error (which may be a Neutralino error object, not a JS Error).
function errMsg(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    const base = e.message ? String(e.message) : JSON.stringify(err);
    return e.code ? `${base} (${String(e.code)})` : base;
  }
  return String(err);
}

// Map the raw wire response (snake_case) into the typed view. The server uses
// one shape for full and delta polls: `entries` (rendered in full) plus
// `unchanged_entries` ({id, ageMs} for ids the client already holds).
function parseContextCache(body: string): ContextCacheResponse {
  const json = JSON.parse(body) as {
    entries?: unknown[];
    unchanged_entries?: unknown[];
    device_kv_pages?: unknown;
    device_page_tokens?: unknown;
    host_kv_bytes?: unknown;
    host_kv_capacity_bytes?: unknown;
    disk_bytes?: unknown;
    disk_tier?: unknown;
  };
  const entries: ContextCacheEntry[] = (Array.isArray(json.entries) ? json.entries : []).map(
    (item) => parseEntryItem(item as Record<string, unknown>)
  );
  const unchangedRaw = Array.isArray(json.unchanged_entries) ? json.unchanged_entries : [];
  const unchangedEntries = unchangedRaw.map((item) => {
    const r = item as Record<string, unknown>;
    return { id: str(r.id), ageMs: num(r.ageMs) };
  });
  return {
    entries,
    unchangedEntries,
    // Top-level aggregate usage; `num()` yields 0 when an older server omits it.
    deviceKvPages: num(json.device_kv_pages),
    devicePageTokens: num(json.device_page_tokens),
    hostKvBytes: num(json.host_kv_bytes),
    hostKvCapacityBytes: num(json.host_kv_capacity_bytes),
    diskBytes: num(json.disk_bytes),
    diskTier: json.disk_tier === true,
  };
}

// Map one raw wire entry item (snake_case) into the typed view.
function parseEntryItem(r: Record<string, unknown>): ContextCacheEntry {
  return {
    id: str(r.id),
    sessionKey: str(r.session_key),
    promptTokens: num(r.prompt_tokens),
    residency: str(r.residency),
    retention: str(r.retention),
    retentionExplicit: r.retention_explicit === true,
    lastHitAgeMs: num(r.last_hit_age_ms),
    activeReferences: num(r.active_references),
    shared: r.shared === true,
    active: r.active === true,
    deviceKvPages: r.device_kv_pages != null ? num(r.device_kv_pages) : undefined,
    deviceKvPagesTotal: r.device_kv_pages_total != null ? num(r.device_kv_pages_total) : undefined,
    hostKvBytes: r.host_kv_bytes != null ? num(r.host_kv_bytes) : undefined,
    promptSegments: parseSegments(r.prompt_segments),
    originEntryId: r.origin_entry_id != null ? str(r.origin_entry_id) : undefined,
    revision: num(r.revision),
  };
}

// Map the raw wire segments (prompt_segments) into the typed view; omit when
// the engine returned none (e.g. shared prefixes, or `text=none`).
function parseSegments(raw: unknown): PromptSegment[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const segments: PromptSegment[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    segments.push({ role: str(r.role), text: str(r.text) });
  }
  return segments.length > 0 ? segments : undefined;
}

// Bound the logged response body so a large cache listing does not flood the log.
// (Removed - now saved to file instead of logged)

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
