import { Text } from '@mantine/core';
import { IconDatabaseOff } from '@tabler/icons-react';
import { useEffect, type CSSProperties } from 'react';
import { Services } from '../../services';
import { Const } from '../Model/Const';
import useConnectionStore from '../Store/useConnectionStore';
import useSelectionStore from '../Store/useSelectionStore';
import useSettingsStore from '../Store/useSettingsStore';
import CacheCell from './CacheCell';
import styles from './CacheCells.module.css';

// The cache grid (Col 1): one cell per entry, or an empty hint. The parent
// column owns scrolling; this component only lays out the cells. When the
// auto-find-related-cells setting is on, selecting a cell runs the search.
function CacheCells() {
  const lastResult = useConnectionStore((s) => s.lastResult);
  const status = useConnectionStore((s) => s.status);
  const textMode = useSettingsStore((s) => s.settings.textMode);
  const selectedId = useSelectionStore((s) => s.selectedEntryId);
  const autoFind = useSettingsStore((s) => s.settings.autoFindRelatedCells);
  const showResidency = useSettingsStore((s) => s.settings.cellShowResidency);
  const showPages = useSettingsStore((s) => s.settings.cellShowPages);
  const showHostMem = useSettingsStore((s) => s.settings.cellShowHostMem);
  const isConnected = status === 'connected';

  // Cell height grows with each enabled option row beyond the base two; the
  // --cell-height variable sizes both the grid rows and the cell wrappers.
  const enabledOptionRows = [showResidency, showPages, showHostMem].filter(
    Boolean,
  ).length;
  const cellHeight = Const.ui.cellHeightForOptionRows(enabledOptionRows);
  const gridStyle = {
    '--cell-height': `${cellHeight}px`,
  } as CSSProperties;

  // Auto-highlight the related cells of the selected entry when the setting is
  // on; requires prompt content, so full text mode only.
  useEffect(() => {
    if (!autoFind || selectedId == null || textMode !== 'full') {
      return;
    }
    const entries = lastResult?.entries ?? [];
    if (!entries.some((e) => e.id === selectedId)) {
      return;
    }
    Services.cacheRelationship.applyRelatedHighlight(entries, selectedId, { quiet: true });
  }, [autoFind, selectedId, textMode, lastResult]);

  const entries = lastResult?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <IconDatabaseOff size={44} stroke={0.9} />
        <Text size="lg">{isConnected ? 'Cache is empty' : 'No cache data'}</Text>
        <Text size="sm" c="dimmed" ta="center">
          {isConnected
            ? 'The engine reports no cache entries.'
            : <>Press <b>Connect</b> to query the engine's context cache.</>}
        </Text>
      </div>
    );
  }

  // Larger caches first: order by token count descending, breaking ties by
  // session key so the layout is stable across re-renders.
  const sortedEntries = [...entries].sort(
    (a, b) => b.promptTokens - a.promptTokens || a.sessionKey.localeCompare(b.sessionKey),
  );

  return (
    <div className={styles.grid} style={gridStyle}>
      {sortedEntries.map((entry) => (
        <CacheCell key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default CacheCells;
