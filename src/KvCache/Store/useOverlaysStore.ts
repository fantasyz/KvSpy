import { create } from 'zustand';

// Stack of opened overlays; the position in the stack is the z-order.
export type OverlayKey = 'appSettings' | 'promptContent' | 'confirm';

interface OverlaysStore {
  openStack: OverlayKey[];
  open: (key: OverlayKey) => void;
  close: (key: OverlayKey) => void;
}

const useOverlaysStore = create<OverlaysStore>()((set) => ({
  openStack: [],

  // Push the overlay onto the stack (no-op if already open).
  open: (key) =>
    set((state) =>
      state.openStack.includes(key) ? state : { openStack: [...state.openStack, key] },
    ),

  close: (key) =>
    set((state) => ({ openStack: state.openStack.filter((k) => k !== key) })),
}));

export default useOverlaysStore;
