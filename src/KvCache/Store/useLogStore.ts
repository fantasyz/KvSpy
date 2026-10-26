import { create } from 'zustand';
import { Const } from '../Model/Const';

// A single console line: a timestamp string + the message text.
export interface LogLine {
  time: string;
  text: string;
}

// Returns a HH:MM:SS string for the current moment.
export function nowTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

// In-memory log buffer (the source for the on-screen console). Capped at
// Const.app.maxLogLines; the persistent copy lives in FileLog.
interface LogStore {
  lines: LogLine[];
  add: (text: string, time?: string) => void;
  clear: () => void;
}

const useLogStore = create<LogStore>()((set) => ({
  lines: [],

  add: (text, time) =>
    set((state) => {
      const lines = [...state.lines, { time: time ?? nowTime(), text }];
      const over = lines.length - Const.app.maxLogLines;
      return { lines: over > 0 ? lines.slice(over) : lines };
    }),

  clear: () => set({ lines: [] }),
}));

export default useLogStore;
