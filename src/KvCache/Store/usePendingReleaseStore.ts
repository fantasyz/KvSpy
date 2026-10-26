import { create } from 'zustand';

// Entry ids that a pending trigger release task will delete. Written by
// TriggerService (the owner of the tasks), read by CacheCell to show the
// skull marker during the delay window. Data only: set semantics, no logic.
interface PendingReleaseStore {
  pendingReleaseIds: Set<string>;
  add: (entryId: string) => void;
  remove: (entryId: string) => void;
  clear: () => void;
}

const usePendingReleaseStore = create<PendingReleaseStore>()((set) => ({
  pendingReleaseIds: new Set<string>(),

  add: (entryId) =>
    set((state) => {
      if (state.pendingReleaseIds.has(entryId)) {
        return state;
      }
      const next = new Set(state.pendingReleaseIds);
      next.add(entryId);
      return { pendingReleaseIds: next };
    }),

  remove: (entryId) =>
    set((state) => {
      if (!state.pendingReleaseIds.has(entryId)) {
        return state;
      }
      const next = new Set(state.pendingReleaseIds);
      next.delete(entryId);
      return { pendingReleaseIds: next };
    }),

  clear: () => set({ pendingReleaseIds: new Set<string>() }),
}));

export default usePendingReleaseStore;
