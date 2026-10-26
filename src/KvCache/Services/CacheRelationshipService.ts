import { Log } from '../../Common/Log';
import useCellHighlightStore from '../Store/useCellHighlightStore';
import type { ContextCacheEntry } from '../Model/types';

// The result of a content-based relationship search around one entry.
export interface CacheRelationshipResult {
  parents: string[];
  children: string[];
  // Depth level per related entry id: negative = ancestor (parent),
  // positive = descendant (child); magnitude is the distance from the selected
  // entry in the inferred prefix tree.
  levels: Map<string, number>;
}

// Infers the KV-cache prefix relationships between entries from their prompt
// content, rather than from the engine's origin links (which dangle once the
// origin is evicted).
//
// A shorter entry whose prompt text is a proper prefix of another entry's prompt
// text is that entry's "parent" (the shared prefix); the longer one is its
// "child" (the continuation). This recovers the prefix-tree even after the
// origin IDs it was captured from have been evicted.
export abstract class CacheRelationshipService {
  // Find the parents and children of the given entry within the listing, plus a
  // depth level for each. Requires prompt content (text=full); returns empty
  // results otherwise.
  static findRelationships(
    entries: ContextCacheEntry[],
    selectedId: string,
  ): CacheRelationshipResult {
    const selected = entries.find((e) => e.id === selectedId);
    const selectedText = selected ? CacheRelationshipService.promptTextOf(selected) : null;
    if (!selectedText) {
      return { parents: [], children: [], levels: new Map() };
    }

    const parentEntries: ContextCacheEntry[] = [];
    const childEntries: ContextCacheEntry[] = [];
    for (const entry of entries) {
      if (entry.id === selectedId) {
        continue;
      }
      const text = CacheRelationshipService.promptTextOf(entry);
      if (!text) {
        continue;
      }
      if (isProperPrefix(selectedText, text)) {
        // selected is a prefix of this one -> this is a child.
        childEntries.push(entry);
      } else if (isProperPrefix(text, selectedText)) {
        // this is a prefix of selected -> this is a parent.
        parentEntries.push(entry);
      }
    }

    const levels = computeDepthLevels(parentEntries, childEntries);
    return {
      parents: parentEntries.map((e) => e.id),
      children: childEntries.map((e) => e.id),
      levels,
    };
  }

  // Run the search for the given entry, apply the grid highlight, and log the
  // result. Shared by the footer button and the auto-find-on-selection.
  // Pass quiet to skip logging (used by the auto-find effect, which re-runs on
  // every auto-refresh and would otherwise spam the console).
  static applyRelatedHighlight(
    entries: ContextCacheEntry[],
    selectedId: string,
    options?: { quiet?: boolean },
  ): void {
    const { parents, children, levels } = CacheRelationshipService.findRelationships(entries, selectedId);
    useCellHighlightStore.getState().apply(levels);
    if (options?.quiet) {
      return;
    }
    Log.write(
      `Find related cells of ${selectedId}: ${parents.length} parent(s), ${children.length} child(ren)` +
        (parents.length ? ` parents -> ${parents.join(', ')}` : '') +
        (children.length
          ? (parents.length ? '; ' : ' ') + `children -> ${children.join(', ')}`
          : ''),
    );
  }

  // The entry's full prompt text reconstructed from its segments, or null when
  // there are none (text=none, or the engine returned no segments). Shared with
  // SelectionTraceService, which traces selection the same prefix way.
  static promptTextOf(entry: ContextCacheEntry): string | null {
    const segments = entry.promptSegments;
    if (!segments || segments.length === 0) {
      return null;
    }
    return segments.map((s) => s.text).join('');
  }
}

// Assign a depth level to each related entry relative to the selected entry.
// Parents (all prefixes of the selected entry) form a single chain by length, so
// the longest is the direct parent (-1) and each shorter one is a further
// ancestor (-2, -3, ...). Children (all superstrings) are ranked by length
// ascending: the shortest is the direct child (+1), each longer one a further
// descendant (+2, +3, ...).
function computeDepthLevels(
  parentEntries: ContextCacheEntry[],
  childEntries: ContextCacheEntry[],
): Map<string, number> {
  const levels = new Map<string, number>();
  const textLen = (e: ContextCacheEntry) => CacheRelationshipService.promptTextOf(e)!.length;

  const sortedParents = [...parentEntries].sort((a, b) => textLen(b) - textLen(a));
  sortedParents.forEach((e, i) => levels.set(e.id, -(i + 1)));

  const sortedChildren = [...childEntries].sort((a, b) => textLen(a) - textLen(b));
  sortedChildren.forEach((e, i) => levels.set(e.id, i + 1));

  return levels;
}

// True when `prefix` is a non-empty proper prefix of `full`.
function isProperPrefix(prefix: string, full: string): boolean {
  if (prefix.length === 0 || prefix.length >= full.length) {
    return false;
  }
  return full.startsWith(prefix);
}
