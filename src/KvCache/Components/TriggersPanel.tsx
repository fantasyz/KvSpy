import { useState } from 'react';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import TriggersHeader from './TriggersHeader';
import TriggersList from './TriggersList';
import TriggersFooter from './TriggersFooter';
import styles from './TriggersPanel.module.css';

// The Triggers tab: a header (+ New, Dry-run, Test), the trigger list, and
// a footer editor for the selected row. Owns the row selection (session
// state, like the cache-cell selection is owned by its store).
function TriggersPanel() {
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  // One-shot flag: focus + select the marker input of a freshly created row.
  const [focusMarker, setFocusMarker] = useState(false);
  const triggers = useSettingsStore((s) => s.settings.triggers);
  const selected = selectedTriggerId
    ? (triggers.find((t) => t.id === selectedTriggerId) ?? null)
    : null;

  const onNew = () => {
    const created = Services.settings.addTrigger();
    setSelectedTriggerId(created.id);
    setFocusMarker(true);
  };

  return (
    <div className={styles.panel}>
      <TriggersHeader onNew={onNew} />
      <div className={styles.content}>
        <TriggersList
          selectedTriggerId={selectedTriggerId}
          onSelect={setSelectedTriggerId}
        />
      </div>
      {/* Keyed remount re-seeds the footer draft from the new selection. */}
      <TriggersFooter
        key={selectedTriggerId ?? 'none'}
        trigger={selected}
        focusMarker={focusMarker}
        onFocusHandled={() => setFocusMarker(false)}
        onDeleted={() => setSelectedTriggerId(null)}
      />
    </div>
  );
}

export default TriggersPanel;
