import { useMemo } from 'react';
import useSelectionStore from '../Store/useSelectionStore';
import type { ContextCacheEntry } from '../Model/types';
import EntryChip from './EntryChip';
import styles from './EntryRelationships.module.css';

interface EntryRelationshipsProps {
  entry: ContextCacheEntry;
  entries: ContextCacheEntry[];
}

// Relationship links for the selected cache entry, and navigation to the linked
// entries.
//
//  - A shared entry's `originEntryId` names the private entry it was captured
//    from (the engine's "shared -> origin" link).
//  - The reverse direction (which shared prefixes reuse this entry as their
//    origin) is derived here by scanning the current listing.
//
// A link resolves to a real entry only while that entry is present in the latest
// listing; otherwise it is shown as "no longer in cache" (the origin is a soft
// reference and may be evicted between queries).
function EntryRelationships({ entry, entries }: EntryRelationshipsProps) {
  const selectEntry = useSelectionStore((s) => s.selectEntry);

  const entriesById = useMemo(() => {
    const map = new Map<string, ContextCacheEntry>();
    for (const item of entries) {
      map.set(item.id, item);
    }
    return map;
  }, [entries]);

  const originId = entry.originEntryId;
  const origin = originId != null ? entriesById.get(originId) : undefined;

  const consumers = entries.filter(
    (item) => item.originEntryId === entry.id && item.id !== entry.id,
  );

  if (originId == null && consumers.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      {originId != null && (
        <div className={styles.row}>
          <span className={styles.label}>Captured from</span>
          {origin ? (
            <EntryChip entry={origin} onOpen={selectEntry} />
          ) : (
            <span className={styles.dangling}>#{originId} — no longer in cache</span>
          )}
        </div>
      )}

      {consumers.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Shared as</span>
          <div className={styles.links}>
            {consumers.map((consumer) => (
              <EntryChip
                key={consumer.id}
                entry={consumer}
                onOpen={selectEntry}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EntryRelationships;
