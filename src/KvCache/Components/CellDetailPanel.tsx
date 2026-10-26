import { Text } from '@mantine/core';
import useConnectionStore from '../Store/useConnectionStore';
import useSelectionStore from '../Store/useSelectionStore';
import type { ContextCacheEntry } from '../Model/types';
import CellDetailHeader from './CellDetailHeader';
import CellDetailToolbar from './CellDetailToolbar';
import CellDetailBody from './CellDetailBody';
import EntryRelationships from './EntryRelationships';
import styles from './CellDetailPanel.module.css';

// Stable empty list so the entries reference does not churn when disconnected.
const EMPTY_ENTRIES: ContextCacheEntry[] = [];

// Col 2: shows the key info + context of the currently selected cell. The
// selected entry is resolved from the last result; when it is gone the panel
// falls back to an empty hint.
function CellDetailPanel() {
  const lastResult = useConnectionStore((s) => s.lastResult);
  const selectedId = useSelectionStore((s) => s.selectedEntryId);
  const entries = lastResult?.entries ?? EMPTY_ENTRIES;
  const entry = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <div className={styles.panel}>
      {entry ? (
        <>
          <CellDetailHeader entry={entry} />
          <CellDetailToolbar />
          <EntryRelationships entry={entry} entries={entries} />
          <CellDetailBody entry={entry} />
        </>
      ) : (
        <div className={styles.empty}>
          <Text size="sm" c="dimmed">
            Select a cache cell to inspect it.
          </Text>
        </div>
      )}
    </div>
  );
}

export default CellDetailPanel;
