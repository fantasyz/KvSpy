import { Checkbox, Text } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import type { TriggerAction } from '../Model/types';
import styles from './TriggersList.module.css';

interface TriggersListProps {
  selectedTriggerId: string | null;
  onSelect: (triggerId: string) => void;
}

// Row action text: "release in 5s" / "release immediately" / "no action".
function actionLabel(action: TriggerAction, delaySec: number): string {
  const timing = delaySec > 0 ? `in ${delaySec}s` : 'immediately';
  switch (action) {
    case 'disposable':
      return `set disposable ${timing}`;
    case 'release':
      return `release ${timing}`;
    default:
      return 'no action';
  }
}

// The trigger rows: enable checkbox (applies immediately on toggle), marker
// text, action text; disabled rows are dimmed. Clicking a row selects it for
// the footer editor.
function TriggersList({ selectedTriggerId, onSelect }: TriggersListProps) {
  const triggers = useSettingsStore((s) => s.settings.triggers);

  if (triggers.length === 0) {
    return (
      <div className={styles.empty}>
        <Text size="sm" c="dimmed">
          No triggers defined. Click “+ New” to add one.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {triggers.map((trigger) => {
        const rowClasses = [
          styles.row,
          trigger.id === selectedTriggerId ? styles.rowSelected : '',
          trigger.enabled ? '' : styles.rowDisabled,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={trigger.id} className={rowClasses} onClick={() => onSelect(trigger.id)}>
            <Checkbox
              size="xs"
              checked={trigger.enabled}
              title="Enable / disable this trigger"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                Services.settings.updateTrigger({ ...trigger, enabled: e.target.checked })
              }
            />
            <Text size="sm" fw={600} className={styles.marker}>
              {trigger.marker}
            </Text>
            {trigger.type !== 'endCurrentSession' && (
              <IconLock size={12} className={styles.lock} title="Fixed trigger: cannot be deleted" />
            )}
            <span className={styles.spacer} />
            <Text size="xs" c="dimmed" className={styles.action}>
              {trigger.type === 'startSessionById'
                ? 'register {ID}'
                : actionLabel(trigger.action, trigger.delaySec)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

export default TriggersList;
