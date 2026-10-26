import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Text } from '@mantine/core';
import useOverlaysStore from '../Store/useOverlaysStore';
import useConfirmStore from '../Store/useConfirmStore';
import styles from './ConfirmOverlay.module.css';

// Generic confirmation dialog. Opened via ConfirmOverlayLauncher with a
// message; resolves false on Cancel / X / Escape. Optionally offers a
// "Don't ask again" checkbox whose callback fires on a confirmed dialog.
function ConfirmOverlay() {
  const opened = useOverlaysStore((s) => s.openStack.includes('confirm'));
  const message = useConfirmStore((s) => s.message);
  const dontAskAgain = useConfirmStore((s) => s.dontAskAgain);
  const resolve = useConfirmStore((s) => s.resolve);
  const [dontAskChecked, setDontAskChecked] = useState(false);

  // Always re-open the dialog with the box unchecked.
  const onResolve = (confirmed: boolean) => {
    setDontAskChecked(false);
    resolve(confirmed);
  };

  const onConfirmClick = () => {
    if (dontAskChecked && dontAskAgain) {
      dontAskAgain.onConfirm();
    }
    onResolve(true);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => onResolve(false)}
      title="Confirm"
      centered
    >
      <Text size="sm" className={styles.message}>
        {message}
      </Text>
      {dontAskAgain && (
        <Checkbox
          label={dontAskAgain.label}
          size="sm"
          mt="xs"
          checked={dontAskChecked}
          onChange={(event) => setDontAskChecked(event.currentTarget.checked)}
        />
      )}
      <Group justify="flex-end" mt="sm">
        <Button variant="subtle" size="sm" onClick={() => onResolve(false)}>
          Cancel
        </Button>
        <Button variant="filled" size="sm" color="red" onClick={onConfirmClick}>
          Confirm
        </Button>
      </Group>
    </Modal>
  );
}

export default ConfirmOverlay;
