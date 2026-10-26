import { Log } from '../../Common/Log';
import { Const } from '../Model/Const';
import useCellFlashStore, { type EntryFlashSignature } from '../Store/useCellFlashStore';
import type { ContextCacheEntry, ContextCacheResponse } from '../Model/types';
import { CacheRelationshipService } from './CacheRelationshipService';

// Detects which cache cells changed between two results and briefly flashes
// them in the grid. The previous snapshot lives in useCellFlashStore; this
// service computes the diff and schedules the flash clear.
export abstract class CellFlashService {
  private static flashTimerId: number | null = null;
  // Generation token so a pending clear never cancels a newer flash.
  private static flashGeneration = 0;
  // Snapshot of the previous listing: a new entry must be matched against the
  // old entries' prompt text to say which one it continues.
  private static lastEntries: ContextCacheEntry[] = [];

  // Feed a freshly fetched result: detect the changed entries, update the
  // snapshot, and flag them for flashing. An empty snapshot only seeds state
  // (the first result after connect never flashes).
  static onCacheUpdated(result: ContextCacheResponse): void {
    const store = useCellFlashStore.getState();
    const previous = store.lastSignatures;
    const previousEntries = CellFlashService.lastEntries;
    CellFlashService.lastEntries = result.entries;
    const next = new Map<string, EntryFlashSignature>();
    const changed: { id: string; detail: string }[] = [];

    for (const entry of result.entries) {
      const signature = signatureOf(entry);
      next.set(entry.id, signature);
      const lastSeen = previous.get(entry.id);
      if (lastSeen === undefined) {
        // A new entry appearing (e.g. a conversation whose cache entry the
        // engine re-created under a new id) is worth flashing too.
        if (previous.size > 0) {
          changed.push({ id: entry.id, detail: describeNewEntry(entry, previousEntries) });
        }
      } else {
        const detail = describeChange(lastSeen, signature);
        if (detail !== null) {
          changed.push({ id: entry.id, detail });
        }
      }
    }
    store.setLastSignatures(next);

    if (changed.length === 0) {
      return;
    }

    // Log which fields actually moved so a surprising flash is explainable.
    for (const change of changed) {
      Log.write(`Cache cell changed: ${change.id} (${change.detail})`);
    }

    // Restart the flash: replace the batch, bump the generation so any
    // pending clear from the previous batch becomes a no-op.
    CellFlashService.flashGeneration++;
    const generation = CellFlashService.flashGeneration;
    store.setFlashing(changed.map((c) => c.id));

    // Persistent marker for the most recently updated cell. The engine lists
    // entries newest-first, so the first change in the batch is the newest.
    store.setLatestChangedId(changed[0].id);

    if (CellFlashService.flashTimerId !== null) {
      window.clearTimeout(CellFlashService.flashTimerId);
    }
    CellFlashService.flashTimerId = window.setTimeout(() => {
      CellFlashService.flashTimerId = null;
      if (generation !== CellFlashService.flashGeneration) {
        return;
      }
      useCellFlashStore.getState().clearFlashing();
    }, Const.ui.cellFlashDurationMs);
  }

  // Clear the snapshot and any in-flight flash (used on disconnect, where the
  // stale snapshot would otherwise flash unrelated cells after reconnecting).
  static reset(): void {
    CellFlashService.flashGeneration++;
    if (CellFlashService.flashTimerId !== null) {
      window.clearTimeout(CellFlashService.flashTimerId);
      CellFlashService.flashTimerId = null;
    }
    const store = useCellFlashStore.getState();
    store.setLastSignatures(new Map<string, EntryFlashSignature>());
    store.clearFlashing();
    store.setLatestChangedId(null);
    CellFlashService.lastEntries = [];
  }
}

// Describe a newly appeared entry for the change log: attribute it to the old
// entry it continues — the previous entry with the longest prompt text that is
// a proper prefix of the new text (the direct parent in the prefix tree).
// Falls back to a bare "new entry" when prompt content is unavailable.
function describeNewEntry(entry: ContextCacheEntry, previousEntries: ContextCacheEntry[]): string {
  const text = CacheRelationshipService.promptTextOf(entry);
  if (text == null) {
    return 'new entry';
  }
  let parent: ContextCacheEntry | null = null;
  let parentTextLength = 0;
  for (const old of previousEntries) {
    const oldText = CacheRelationshipService.promptTextOf(old);
    if (oldText == null || oldText.length >= text.length || !text.startsWith(oldText)) {
      continue;
    }
    if (oldText.length > parentTextLength) {
      parent = old;
      parentTextLength = oldText.length;
    }
  }
  return parent != null ? `new entry from ${parent.id}` : 'new entry';
}

function signatureOf(entry: ContextCacheEntry): EntryFlashSignature {
  return {
    promptTokens: entry.promptTokens,
    deviceKvPages: entry.deviceKvPages ?? null,
    hostKvBytes: entry.hostKvBytes ?? null,
    residency: entry.residency,
    retention: entry.retention,
    retentionExplicit: entry.retentionExplicit ?? false,
  };
}

// Describe what changed between two snapshots, or null when nothing worth
// flashing moved. promptTokens / deviceKvPages trigger on an increase (a
// decrease is the engine releasing resources, not working on new context);
// retention changes trigger on any change since they alter the visible cell
// state. hostKvBytes and residency never trigger on their own: both also move
// when an idle entry is demoted from VRAM to host RAM — they are logged only
// so a real flash's detail stays explainable.
function describeChange(prev: EntryFlashSignature, cur: EntryFlashSignature): string | null {
  const notes: string[] = [];
  let triggered = false;

  const counterTrigger = (name: string, before: number | null, after: number | null): void => {
    if (after != null && (before == null || after > before)) {
      notes.push(`${name}: ${before ?? 0} -> ${after}`);
      triggered = true;
    }
  };
  counterTrigger('promptTokens', prev.promptTokens, cur.promptTokens);
  counterTrigger('deviceKvPages', prev.deviceKvPages, cur.deviceKvPages);

  if (prev.hostKvBytes !== cur.hostKvBytes) {
    notes.push(`hostKvBytes: ${prev.hostKvBytes ?? 0} -> ${cur.hostKvBytes ?? 0}`);
  }

  if (prev.residency !== cur.residency) {
    notes.push(`residency: ${prev.residency} -> ${cur.residency}`);
  }
  if (prev.retention !== cur.retention) {
    notes.push(`retention: ${prev.retention} -> ${cur.retention}`);
    triggered = true;
  }
  if (prev.retentionExplicit !== cur.retentionExplicit) {
    notes.push(`retentionExplicit: ${prev.retentionExplicit} -> ${cur.retentionExplicit}`);
    triggered = true;
  }

  return triggered ? notes.join('; ') : null;
}
