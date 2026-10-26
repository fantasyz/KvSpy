import { Collapse } from '@mantine/core';
import { useEffect, useRef } from 'react';
import useSettingsStore from '../Store/useSettingsStore';
import type { LogLine } from '../Store/useLogStore';
import styles from './ConsolePanelBody.module.css';

interface ConsolePanelBodyProps {
  lines: LogLine[];
  filterActive: boolean;
}

// The console body: monospace lines that auto-scroll to the newest entry;
// shows a placeholder when empty or when the filter matches nothing.
function ConsolePanelBody({ lines, filterActive }: ConsolePanelBodyProps) {
  const visible = useSettingsStore((s) => s.settings.consoleVisible);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as new entries arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, visible]);

  return (
    <Collapse expanded={visible}>
      <div ref={scrollRef} className={styles.body}>
        {lines.length === 0 && (
          <div className={styles.empty}>
            {filterActive ? 'No lines match the filter.' : 'No log entries yet.'}
          </div>
        )}
        {lines.map((line, index) => (
          <div key={index} className={styles.line}>
            <span className={styles.time}>[{line.time}]</span> {line.text}
          </div>
        ))}
      </div>
    </Collapse>
  );
}

export default ConsolePanelBody;
