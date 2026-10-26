import { useMemo } from 'react';
import { Text } from '@mantine/core';
import { IconArrowBarToDown, IconArrowBarToUp } from '@tabler/icons-react';
import useSettingsStore from '../Store/useSettingsStore';
import type { ContextCacheEntry } from '../Model/types';
import PromptSegments, {
  type IndexedPromptSegment,
} from './PromptSegments';
import { useScrollToEdges } from './useScrollToEdges';
import styles from './CellDetailBody.module.css';

interface CellDetailBodyProps {
  entry: ContextCacheEntry;
}

// The prompt content for the selected entry, shown as collapsible message
// sections. Content is only available when queried with `text=full`; otherwise
// a hint asks the user to switch modes.
function CellDetailBody({ entry }: CellDetailBodyProps) {
  const textMode = useSettingsStore((s) => s.settings.textMode);
  const visibleRoles = useSettingsStore((s) => s.settings.detailVisibleRoles);
  const sortDesc = useSettingsStore((s) => s.settings.detailSortDesc);
  const segments = entry.promptSegments;
  // Segments to display: filtered by the role pills, then ordered by the
  // chosen sort direction. Each item keeps its original position index so the
  // displayed numbering follows the sort direction (ascending 0→n-1,
  // descending n-1→0).
  const shownSegments = useMemo((): IndexedPromptSegment[] => {
    if (!segments) return [];
    const indexed = segments.map((segment, index) => ({ segment, index }));
    const filtered = indexed.filter(({ segment }) =>
      visibleRoles.includes(segment.role.toLowerCase()),
    );
    return sortDesc ? [...filtered].reverse() : filtered;
  }, [segments, visibleRoles, sortDesc]);
  const {
    ref: bodyRef,
    showTop,
    showBottom,
    scrollToTop,
    scrollToBottom,
  } = useScrollToEdges(shownSegments);

  if (!segments) {
    return (
      <div className={styles.body}>
        <Text size="sm" c="dimmed" className={styles.hint}>
          {textMode === 'none'
            ? 'Prompt content is only available in Full mode. Use the Mode selector to enable it.'
            : 'No prompt content returned by the engine.'}
        </Text>
      </div>
    );
  }

  if (shownSegments.length === 0) {
    return (
      <div className={styles.body}>
        <Text size="sm" c="dimmed" className={styles.hint}>
          No segments match the selected role filters.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.body} ref={bodyRef}>
      {showTop && (
        <div className={styles.scrollToTopRow}>
          <button
            type="button"
            className={styles.scrollJumpBtn}
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <IconArrowBarToUp size={16} />
          </button>
        </div>
      )}
      <PromptSegments segments={shownSegments} />
      {showBottom && (
        <div className={styles.scrollToBottomRow}>
          <button
            type="button"
            className={styles.scrollJumpBtn}
            onClick={scrollToBottom}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <IconArrowBarToDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default CellDetailBody;
