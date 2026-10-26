import { useState } from 'react';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import LeftColumnTabs from './LeftColumnTabs';
import CellDetailPanel from './CellDetailPanel';
import styles from './CacheView.module.css';

// The main cache view: two resizable columns with a 3px drag handle between
// them. The left column width is persisted in settings (see useSettingsStore)
// so the split survives restarts and the prompt-content drawer can match it.
function CacheView() {
  const leftColumnWidth = useSettingsStore((s) => s.settings.leftColumnWidth);
  const setLeftColumnWidth = useSettingsStore((s) => s.setLeftColumnWidth);
  const [resizing, setResizing] = useState(false);

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      e.currentTarget.previousElementSibling?.clientWidth ?? leftColumnWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(500, startWidth + delta);
      // Live update only; the settings file is written once when the drag ends.
      setLeftColumnWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      Services.settings.save();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className={styles.view}>
      <div className={styles.columns}>
        <div className={styles.cellsColumn} style={{ flex: `0 0 ${leftColumnWidth}px` }}>
          <LeftColumnTabs />
        </div>
        <div
          className={`${styles.divider} ${resizing ? styles.dividerActive : ''}`}
          onMouseDown={onDividerMouseDown}
          role="separator"
          aria-orientation="vertical"
        />
        <div className={styles.detailColumn}>
          <CellDetailPanel />
        </div>
      </div>
    </div>
  );
}

export default CacheView;
