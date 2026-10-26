import { create } from 'zustand';

// Visual state for the related-cells highlight. Data-only; the matching logic
// lives in CacheRelationshipService.

interface CellHighlightStore {
  // Maps a related entry id to its depth level relative to the selected entry:
  // negative = ancestor (parent), positive = descendant (child).
  relatedLevels: Map<string, number>;
  apply: (relatedLevels: Map<string, number>) => void;
  clear: () => void;
}

const useCellHighlightStore = create<CellHighlightStore>()((set) => ({
  relatedLevels: new Map<string, number>(),

  apply: (relatedLevels) =>
    set({
      relatedLevels: new Map(relatedLevels),
    }),

  clear: () => set({ relatedLevels: new Map<string, number>() }),
}));

export default useCellHighlightStore;
