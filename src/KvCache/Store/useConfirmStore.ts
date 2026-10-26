import { create } from 'zustand';
import useOverlaysStore from './useOverlaysStore';

// Lifecycle of the confirmation dialog.
export enum ConfirmState {
  Inactive,
  Active,
}

// Optional "Don't ask again" checkbox; the callback fires when the dialog
// is confirmed with the box checked.
export interface DontAskAgainOption {
  label: string;
  onConfirm: () => void;
}

interface ConfirmStore {
  state: ConfirmState;
  message: string;
  dontAskAgain: DontAskAgainOption | null;
  // Resolves the launcher's promise; null when inactive.
  resolver: ((confirmed: boolean) => void) | null;
  open: (
    message: string,
    resolver: (confirmed: boolean) => void,
    dontAskAgain: DontAskAgainOption | null,
  ) => void;
  resolve: (confirmed: boolean) => void;
}

const useConfirmStore = create<ConfirmStore>()((set, get) => ({
  state: ConfirmState.Inactive,
  message: '',
  dontAskAgain: null,
  resolver: null,

  open: (message, resolver, dontAskAgain) =>
    set({ state: ConfirmState.Active, message, resolver, dontAskAgain }),

  // No-op if already resolved (e.g. both a button click and Escape fire).
  resolve: (confirmed) => {
    const { state, resolver } = get();
    if (state !== ConfirmState.Active) return;
    set({ state: ConfirmState.Inactive, resolver: null, dontAskAgain: null });
    useOverlaysStore.getState().close('confirm');
    resolver?.(confirmed);
  },
}));

export default useConfirmStore;
