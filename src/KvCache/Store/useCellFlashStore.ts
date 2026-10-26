import { create } from 'zustand';

// Visual state for the cell change flash. Data-only (Zustand): the diff
// logic lives in CellFlashService.
//
// `lastSignatures` is the previous poll's snapshot (entry id -> signature of
// the tracked fields), kept here so the service can detect changes without
// owning the state itself.

// The tracked fields of one cache entry, used for change detection.
export interface EntryFlashSignature {
  promptTokens: number;
  deviceKvPages: number | null;
  hostKvBytes: number | null;
  residency: string;
  retention: string;
  retentionExplicit: boolean;
}

interface CellFlashStore {
  lastSignatures: Map<string, EntryFlashSignature>;
  flashing: Set<string>;
  // The most recently changed entry: a persistent marker (not cleared with
  // the flash) shown as a dot on the cell; superseded by the next change and
  // cleared on disconnect.
  latestChangedId: string | null;
  setLastSignatures: (signatures: Map<string, EntryFlashSignature>) => void;
  setFlashing: (entryIds: string[]) => void;
  clearFlashing: () => void;
  setLatestChangedId: (entryId: string | null) => void;
}

const useCellFlashStore = create<CellFlashStore>()((set) => ({
  // subject: last-seen snapshot
  lastSignatures: new Map<string, EntryFlashSignature>(),

  setLastSignatures: (signatures) => set({ lastSignatures: signatures }),

  // subject: flash animation
  flashing: new Set<string>(),

  setFlashing: (entryIds) => set({ flashing: new Set(entryIds) }),

  clearFlashing: () => set({ flashing: new Set<string>() }),

  // subject: latest-changed marker
  latestChangedId: null,

  setLatestChangedId: (entryId) => set({ latestChangedId: entryId }),
}));

export default useCellFlashStore;
