import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Log } from '../../Common/Log';
import useSelectionStore from '../Store/useSelectionStore';
import { CacheRelationshipService } from './CacheRelationshipService';
import type { ContextCacheEntry } from '../Model/types';

// Keeps a user selection alive across auto-refresh polls when the engine
// replaces the selected entry's id. The engine mints a new private id per
// conversation turn (the selected entry is superseded by a continuation that
// extends its prompt text), so the raw selected id can vanish from a fresh
// listing. When that happens, the selection is re-anchored to the entry that
// continues the selected context: the shortest entry whose prompt text is a
// proper extension of the selected text (its direct child in the prefix tree).
// Requires prompt content, so it only traces in full text mode.
export abstract class SelectionTraceService {
  private static initialized = false;
  // Snapshot of the last-seen listing: a gone entry's prompt text must still be
  // available after it has left the fresh listing.
  private static lastEntries: ContextCacheEntry[] = [];

  // Wire up the cache-updated listener. Call once at boot.
  static init(): void {
    if (SelectionTraceService.initialized) {
      return;
    }
    SelectionTraceService.initialized = true;

    bus.on(AppEvents.cacheUpdated, (payload: { entries: ContextCacheEntry[] }) => {
      SelectionTraceService.traceSelection(payload.entries);
    });
  }

  // React to a fresh listing: remember it and re-anchor the selection if the
  // selected id churned away.
  private static traceSelection(entries: ContextCacheEntry[]): void {
    const previousEntries = SelectionTraceService.lastEntries;
    SelectionTraceService.lastEntries = entries;

    const selectedId = useSelectionStore.getState().selectedEntryId;
    if (selectedId == null) {
      return;
    }

    // A live selection is never touched.
    if (entries.some((e) => e.id === selectedId)) {
      return;
    }

    // The selected entry left the listing. Find its text in the snapshot so we
    // can trace the continuation; no snapshot entry means the first listing
    // after connect, where there is nothing to trace from.
    const previous = previousEntries.find((e) => e.id === selectedId);
    if (previous === undefined) {
      return;
    }
    const previousText = CacheRelationshipService.promptTextOf(previous);
    if (previousText == null || previousText.length === 0) {
      // No prompt content (text=none mode): tracing is impossible. Silent by
      // design — this would fire on every poll while a selection dangles.
      return;
    }

    // Successors: entries whose prompt continues the selected context. The
    // shortest proper extension is the direct child; longer ones are further
    // descendants of it.
    let successor: ContextCacheEntry | null = null;
    let successorTextLength = Infinity;
    for (const entry of entries) {
      const text = CacheRelationshipService.promptTextOf(entry);
      if (text == null || text.length <= previousText.length || !text.startsWith(previousText)) {
        continue;
      }
      if (text.length < successorTextLength) {
        successor = entry;
        successorTextLength = text.length;
      }
    }
    if (successor == null) {
      return;
    }

    useSelectionStore.getState().selectEntry(successor.id);
    Log.write(`Selection traced: ${selectedId} -> ${successor.id} (continuation of selected context)`);
  }

  // Clear the snapshot (used on disconnect, where a stale snapshot would
  // trace a selection from a previous session after reconnecting).
  static reset(): void {
    SelectionTraceService.lastEntries = [];
  }
}
