import { Log } from '../../Common/Log';
import useSettingsStore from '../Store/useSettingsStore';
import type { ContextCacheEntry, ContextCacheResponse } from '../Model/types';

// Client-side state for delta sync of GET /v1/context-cache.
//
// Holds the entries the client already knows (id -> entry, including each
// entry's catalog revision). Background polls send this state as ?known= so
// the server answers only the diff; applyDelta() merges the diff back into a
// full list, so downstream consumers never see a partial result.
export abstract class CacheDeltaService {
  // Server-side cap on ?known= pairs (kContextCacheKnownMaxEntries); above it
  // the server answers the full list, so sending more would be pointless.
  private static readonly knownCap = 256;
  private static knownEntries = new Map<string, ContextCacheEntry>();

  // (Re)seed the state from a full listing (connect, text-mode change,
  // post-mutation refresh).
  static rebuildFrom(entries: ContextCacheEntry[]): void {
    CacheDeltaService.knownEntries = new Map(entries.map((entry) => [entry.id, entry]));
    Log.write(`Delta state seeded: ${entries.length} entrie(s).`);
  }

  // The ?known= query value for the current state, or null when there is
  // nothing to send (empty state) or the state exceeds the server cap (the
  // server would answer the full list anyway).
  static knownParam(): string | null {
    const entries = [...CacheDeltaService.knownEntries.values()];
    if (entries.length === 0 || entries.length > CacheDeltaService.knownCap) {
      return null;
    }
    return entries.map((entry) => `${entry.id}:${entry.revision}`).join(',');
  }

  // Apply a server response to the local state and return the merged full
  // list: full entries are upserted, unchanged entries get a fresh age, and
  // ids mentioned in neither list are deleted.
  static applyDelta(response: ContextCacheResponse): ContextCacheEntry[] {
    const known = CacheDeltaService.knownEntries;
    const fullIds = new Set(response.entries.map((entry) => entry.id));

    for (const entry of response.entries) {
      known.set(entry.id, entry);
    }

    let unchangedCount = 0;
    for (const unchanged of response.unchangedEntries) {
      const local = known.get(unchanged.id);
      if (local === undefined) {
        // The server only lists ids it was told about, so this means stale
        // local state; drop it quietly and let the next full fetch repair.
        Log.write(`Delta: unchanged entry ${unchanged.id} not held locally; ignored.`, true);
        continue;
      }
      known.set(unchanged.id, { ...local, lastHitAgeMs: unchanged.ageMs });
      unchangedCount++;
    }

    let removedCount = 0;
    for (const id of [...known.keys()]) {
      if (!fullIds.has(id) && !response.unchangedEntries.some((u) => u.id === id)) {
        known.delete(id);
        removedCount++;
      }
    }

    // Merged full list: server-rendered entries first (catalog order), then the
    // unchanged survivors in local order (the catalog order of the last seed).
    const merged: ContextCacheEntry[] = [
      ...response.entries,
      ...[...known.values()].filter((entry) => !fullIds.has(entry.id)),
    ];

    // Summary line, behind the logDeltaPoll setting (off by default).
    if (
      useSettingsStore.getState().settings.logDeltaPoll &&
      (response.entries.length > 0 || removedCount > 0)
    ) {
      Log.write(
        `Delta poll: +${response.entries.length} changed, ` +
          `${unchangedCount} unchanged, -${removedCount} removed.`
      );
    }
    return merged;
  }

  // Clear the state (disconnect).
  static reset(): void {
    if (CacheDeltaService.knownEntries.size > 0) {
      Log.write(`Delta state cleared (${CacheDeltaService.knownEntries.size} entrie(s)).`);
    }
    CacheDeltaService.knownEntries = new Map();
  }
}
