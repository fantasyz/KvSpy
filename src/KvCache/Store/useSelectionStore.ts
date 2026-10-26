import { create } from 'zustand';

// UI selection state for the cache cells grid. Which cell the user has picked
// so the detail panel can show its data. Data-only (Zustand).

interface SelectionStore {
  // The selected cache-entry id (a namespaced string), or null when nothing is selected.
  selectedEntryId: string | null;
  selectEntry: (id: string) => void;
  clearSelection: () => void;
}

const useSelectionStore = create<SelectionStore>()((set) => ({
  selectedEntryId: null,

  selectEntry: (id) => set({ selectedEntryId: id }),

  clearSelection: () => set({ selectedEntryId: null }),
}));

export default useSelectionStore;
