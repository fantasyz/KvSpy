import type { ContextCacheEntry } from '../Model/types';
import styles from './EntryChip.module.css';

interface EntryChipProps {
  entry: ContextCacheEntry;
  onOpen: (id: string) => void;
}

// A clickable chip that navigates to another cache entry (a relationship link).
function EntryChip({ entry, onOpen }: EntryChipProps) {
  const keyText = entry.sessionKey ? ` — ${entry.sessionKey}` : '';
  return (
    <button
      type="button"
      className={styles.chip}
      onClick={() => onOpen(entry.id)}
      title={`Open entry #${entry.id}${keyText}`}
    >
      <span>#{entry.id}</span>
      {entry.sessionKey && <span className={styles.chipKey}>{entry.sessionKey}</span>}
    </button>
  );
}

export default EntryChip;
