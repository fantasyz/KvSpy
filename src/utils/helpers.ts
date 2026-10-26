import { useCallback } from 'react';

let idCounter = 0;

// Generate a unique ID via Date.now() + counter in base36 to avoid duplicates.
export function generateId(): string {
  return `${Date.now().toString(36)}_${idCounter++}`;
}

// Clamp value between min and max.
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Debounce a React callback by `delay` ms.
export function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const debouncedFn = useCallback(() => {
    const timer = setTimeout(() => fn(), delay);
    return () => clearTimeout(timer);
  }, [fn, delay]) as unknown as T;
  return debouncedFn;
}
