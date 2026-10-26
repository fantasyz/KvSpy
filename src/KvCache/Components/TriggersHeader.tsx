import { Button, Switch, Tooltip } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { Log } from '../../Common/Log';
import { Services } from '../../services';
import useSelectionStore from '../Store/useSelectionStore';
import useSettingsStore from '../Store/useSettingsStore';
import styles from './TriggersHeader.module.css';

interface TriggersHeaderProps {
  // Create a new trigger and select it (owned by the panel).
  onNew: () => void;
}

// Header of the Triggers tab: + New, the Dry-run mode toggle, and the Test
// button (dry-run: evaluates all markers against the cache-selected entry
// and logs the result; no engine requests are issued).
function TriggersHeader({ onNew }: TriggersHeaderProps) {
  const dryRun = useSettingsStore((s) => s.settings.triggerDryRun);
  const triggers = useSettingsStore((s) => s.settings.triggers);
  const selectedEntryId = useSelectionStore((s) => s.selectedEntryId);
  // Nothing to detect with: no triggers at all, or none of them enabled.
  const detectDisabled =
    triggers.length === 0 || !triggers.some((t) => t.enabled);

  const onDetect = () => {
    // Results land in the log panel; make sure it is visible.
    Services.settings.showConsole();
    if (!selectedEntryId) {
      Log.write('Test: select a cache entry in the Cache tab first.', true);
      return;
    }
    Services.trigger.detect(selectedEntryId);
  };

  return (
    <div className={styles.header}>
      <Button
        variant="subtle"
        size="sm"
        leftSection={<IconPlus size={14} />}
        onClick={onNew}
      >
        New
      </Button>
      <span className={styles.spacer} />
      <Tooltip
        label="Dry-run: the trigger system runs normally, but actions are logged as fake requests instead of reaching the engine"
        position="bottom-end"
        withArrow
        withinPortal
      >
        <Switch
          size="xs"
          label="Dry-run"
          checked={dryRun}
          onChange={(e) => Services.settings.setTriggerDryRun(e.target.checked)}
        />
      </Tooltip>
      <Tooltip
        label="Dry-run: check all markers against the selected cache entry and log the result (no engine requests)"
        position="bottom-end"
        withArrow
        withinPortal
      >
        <Button
          variant="filled"
          size="sm"
          leftSection={<IconSearch size={14} />}
          disabled={detectDisabled}
          onClick={onDetect}
        >
          Test
        </Button>
      </Tooltip>
    </div>
  );
}

export default TriggersHeader;
