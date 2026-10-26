import { create } from 'zustand';
import type { ContextCacheResponse } from '../Model/types';

// UI-facing connection status for the engine. Data-only (Zustand): the actual
// HTTP logic lives in EngineService, which writes to this store.

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectionStore {
  status: ConnectionStatus;
  // A human-readable detail (the error reason, or a short note).
  message: string | null;
  // The most recent successful query result.
  lastResult: ContextCacheResponse | null;
  setStatus: (status: ConnectionStatus, message?: string | null) => void;
  setLastResult: (result: ContextCacheResponse | null) => void;
}

const useConnectionStore = create<ConnectionStore>()((set) => ({
  status: 'disconnected',
  message: null,
  lastResult: null,

  setStatus: (status, message = null) => set({ status, message }),

  setLastResult: (result) => set({ lastResult: result }),
}));

export default useConnectionStore;
