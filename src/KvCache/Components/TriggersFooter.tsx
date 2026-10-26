import {
  Button,
  Group,
  Input,
  Popover,
  Select,
  Slider,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconClock, IconTrash } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Services } from '../../services';
import { Const } from '../Model/Const';
import ConfirmOverlayLauncher from '../Store/ConfirmOverlayLauncher';
import type { TriggerAction, TriggerDef, TriggerMarkerType } from '../Model/types';
import styles from './TriggersFooter.module.css';

const ACTION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'disposable', label: 'Set Disposable' },
  { value: 'release', label: 'Release' },
];

// The template token a trigger type requires in its marker (null = no token).
function requiredToken(type: TriggerMarkerType): string | null {
  switch (type) {
    case 'startSessionById':
    case 'endSessionById':
      return Const.app.triggerTokenId;
    case 'endSessionBySessionKey':
      return Const.app.triggerTokenSessionKey;
    default:
      return null;
  }
}

// A token problem in the draft marker (null = valid).
function tokenProblem(marker: string, type: TriggerMarkerType): string | null {
  const token = requiredToken(type);
  if (!token) {
    return null;
  }
  const count = marker.split(token).length - 1;
  if (count === 0) {
    return `Missing ${token} token.`;
  }
  if (count > 1) {
    return `Multiple ${token} tokens.`;
  }
  return null;
}

interface TriggersFooterProps {
  // The selected trigger (null when nothing is selected). The parent remounts
  // this component (via key) when the selection changes, which re-seeds the
  // draft from the fresh prop.
  trigger: TriggerDef | null;
  // One-shot (set by the panel after + New): focus the marker input with its
  // value selected so the user can type a new pattern immediately.
  focusMarker: boolean;
  onFocusHandled: () => void;
  // Clear the panel's row selection after this trigger is deleted.
  onDeleted: () => void;
}

// Footer of the Triggers tab: an editor for the selected trigger row. Line 1
// edits the marker/action/delay (draft + Apply/Cancel); line 2 holds Delete
// (left) and Apply/Cancel (right).
function TriggersFooter({
  trigger: selected,
  focusMarker,
  onFocusHandled,
  onDeleted,
}: TriggersFooterProps) {
  const [draft, setDraft] = useState<TriggerDef | null>(selected);
  const [delayOpen, setDelayOpen] = useState(false);
  const markerInputRef = useRef<HTMLInputElement>(null);

  // Run once on mount: a newly created row gets the marker input focused with
  // its text selected. (Mount-only by design: the keyed remount per selection
  // makes this the "just created" hook.)
  useEffect(() => {
    if (!focusMarker) {
      return;
    }
    markerInputRef.current?.focus();
    markerInputRef.current?.select();
    onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selected || !draft) {
    return (
      <div className={styles.footer}>
        <Text size="sm" c="dimmed">
          Select a trigger to edit.
        </Text>
      </div>
    );
  }

  const isFixed = selected.type !== 'endCurrentSession';
  // The BEGIN entry only registers the session: no action/delay to edit.
  const isBegin = selected.type === 'startSessionById';

  // Apply trims the marker, so compare trimmed to keep Apply/Cancel stable.
  // (enabled is toggled directly on the row, not edited here.)
  const isDirty =
    draft.marker.trim() !== selected.marker ||
    (!isBegin && (draft.action !== selected.action || draft.delaySec !== selected.delaySec));

  const markerInvalid = tokenProblem(draft.marker, selected.type) !== null;

  const onApply = () => {
    // An empty marker would never match; fall back to the saved value.
    const marker = draft.marker.trim() || selected.marker;
    Services.settings.updateTrigger({ ...draft, marker });
  };

  const onCancel = () => {
    setDraft(selected);
  };

  const onDelete = async () => {
    const confirmed = await ConfirmOverlayLauncher.openAsync(
      `Delete trigger "${selected.marker}"?`
    );
    if (confirmed) {
      Services.settings.removeTrigger(selected.id);
      onDeleted();
    }
  };

  return (
    <div className={styles.footer}>
      <Group gap="xs" wrap="wrap" className={styles.row}>
        <Input
          ref={markerInputRef}
          size="xs"
          w={220}
          value={draft.marker}
          onChange={(e) => setDraft({ ...draft, marker: e.target.value })}
          title="Marker text"
        />
        {!isBegin && (
          <>
            <Select
              size="xs"
              w={150}
              value={draft.action}
              data={ACTION_OPTIONS}
              onChange={(value) =>
                setDraft({ ...draft, action: (value ?? 'none') as TriggerAction })
              }
            />
            <Tooltip
              label="Delay before the action fires after detection"
              position="top"
              withArrow
              withinPortal
            >
              <Popover width={180} position="top-start" opened={delayOpen} onChange={setDelayOpen}>
                <Popover.Target>
                  {/* Controlled popover: Mantine attaches no click handler to
                      the target, so the toggle lives here. */}
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconClock size={12} />}
                    aria-label="Action delay"
                    aria-expanded={delayOpen}
                    onClick={() => setDelayOpen((open) => !open)}
                  >
                    {draft.delaySec}s
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Text size="xs" c="dimmed">
                    Delay (seconds)
                  </Text>
                  <Slider
                    min={0}
                    max={Const.app.triggerMaxDelaySec}
                    step={1}
                    value={draft.delaySec}
                    onChange={(value) => setDraft({ ...draft, delaySec: value })}
                    label={(value) => `${value}s`}
                  />
                </Popover.Dropdown>
              </Popover>
            </Tooltip>
          </>
        )}
      </Group>
      {markerInvalid && (
        <Text size="xs" c="red" className={styles.warning}>
          {tokenProblem(draft.marker, selected.type)}
        </Text>
      )}
      <Group gap="xs" justify="space-between" className={styles.actions}>
        {isFixed ? (
          <span />
        ) : (
          <Button
            variant="subtle"
            size="xs"
            color="red"
            leftSection={<IconTrash size={12} />}
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        )}
        <Group gap="xs">
          <Button variant="filled" size="xs" onClick={onApply} disabled={!isDirty || markerInvalid}>
            Apply
          </Button>
          <Button variant="subtle" size="xs" onClick={onCancel} disabled={!isDirty}>
            Cancel
          </Button>
        </Group>
      </Group>
    </div>
  );
}

export default TriggersFooter;
