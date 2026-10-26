import { create } from 'zustand';

// Content of a single prompt segment, shown in the content popup.
interface PromptContentStore {
  text: string;
  label: string;
  setContent: (text: string, label: string) => void;
}

const usePromptContentStore = create<PromptContentStore>()((set) => ({
  text: '',
  label: '',
  setContent: (text, label) => set({ text, label }),
}));

export default usePromptContentStore;
