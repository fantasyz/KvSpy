// Shared formatting helpers for display values (bytes, age, tokens, residency).

// Human-readable byte size using binary units, e.g. 8589934592 -> "8.0 GB".
// MB -> GB switches at 900 MB so values near 1 GB read as GB (0.9 GB, not 900 MB).
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const thresholds = [1024, 1024, 900, 1024];
  let value = bytes;
  let unitIndex = -1;
  while (unitIndex < units.length - 1 && value >= thresholds[unitIndex + 1]) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

// Human-friendly "how long ago" for a millisecond age.
export function formatAge(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  return `${Math.round(ms / 3600000)} h`;
}

// Format a raw token count as a compact "12k" style value, with one decimal
// place (dropped when it is .0).
export function formatTokens(raw: number): string {
  const k = raw / 1000;
  const label = k.toFixed(1).replace(/\.0$/, '');
  return `${label}k`;
}
