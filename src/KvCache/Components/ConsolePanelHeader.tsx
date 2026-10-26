import { Button, Input } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconTrashFilled,
} from '@tabler/icons-react';
import type { MouseEvent } from 'react';
import styles from './ConsolePanelHeader.module.css';

interface ConsolePanelHeaderProps {
  visible: boolean;
  filterText: string;
  matchCount: number;
  totalLines: number;
  onFilterChange: (value: string) => void;
  onClear: () => void;
  onToggle: () => void;
}

// The console header: fold toggle, title (with filter match stats while a
// filter is active), a line-filter input, and a Clear button. Clicking
// anywhere except the filter input and Clear button toggles the fold state.
function ConsolePanelHeader({
  visible,
  filterText,
  matchCount,
  totalLines,
  onFilterChange,
  onClear,
  onToggle,
}: ConsolePanelHeaderProps) {
  const filterActive = filterText.trim().length > 0;
  // Stops propagation so clicking the fold button does not also trigger the
  // header's fold toggle (which would cancel out).
  const onFoldClick = (event: MouseEvent) => {
    event.stopPropagation();
    onToggle();
  };
  // Stops propagation so clicking Clear only clears, not toggles the fold.
  const onClearClick = (event: MouseEvent) => {
    event.stopPropagation();
    onClear();
  };

  return (
    <div className={styles.header} onClick={onToggle}>
      <Button
        size="xs"
        variant="subtle"
        c="dimmed"
        onClick={onFoldClick}
        aria-label={visible ? 'Fold console' : 'Unfold console'}
      >
        {visible ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
      </Button>
      <span className={styles.title}>
        Console{filterActive ? ` (${matchCount}/${totalLines})` : ''}
      </span>
      <div className={styles.headerActions}>
        <Input
          size="xs"
          w={180}
          leftSection={<IconSearch size={12} />}
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Filter log lines; space separates terms (all must match)"
          placeholder="Filter"
        />
        <Button
          size="xs"
          variant="subtle"
          c="red"
          onClick={onClearClick}
          aria-label="Clear console"
        >
          <IconTrashFilled size={16} />
        </Button>
      </div>
    </div>
  );
}

export default ConsolePanelHeader;
