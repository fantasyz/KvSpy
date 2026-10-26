import { useMemo, useState } from 'react';
import { Services } from '../../services';
import useLogStore from '../Store/useLogStore';
import useSettingsStore from '../Store/useSettingsStore';
import ConsolePanelBody from './ConsolePanelBody';
import ConsolePanelHeader from './ConsolePanelHeader';
import styles from './ConsolePanel.module.css';

// The bottom log console: a fixed header (fold toggle, line filter, clear)
// and a scrollable monospace body. Typing a filter shows only lines that
// contain every space-separated term (case-insensitive).
function ConsolePanel() {
  const visible = useSettingsStore((s) => s.settings.consoleVisible);
  const lines = useLogStore((s) => s.lines);
  const clear = useLogStore((s) => s.clear);

  const [filterText, setFilterText] = useState('');

  // Case-insensitive; every space-separated term must appear in the line.
  const filteredLines = useMemo(() => {
    const terms = filterText
      .toLowerCase()
      .split(' ')
      .filter((term) => term.length > 0);
    if (terms.length === 0) return lines;
    return lines.filter((line) => {
      const haystack = line.text.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [lines, filterText]);

  return (
    <div className={styles.panel}>
      <ConsolePanelHeader
        visible={visible}
        filterText={filterText}
        matchCount={filteredLines.length}
        totalLines={lines.length}
        onFilterChange={setFilterText}
        onClear={clear}
        onToggle={() => Services.settings.toggleConsole()}
      />
      <ConsolePanelBody
        lines={filteredLines}
        filterActive={filterText.trim().length > 0}
      />
    </div>
  );
}

export default ConsolePanel;
