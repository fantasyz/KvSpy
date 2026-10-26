import { Group, Input, Text } from '@mantine/core';
import { useState } from 'react';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import useConnectionStore from '../Store/useConnectionStore';
import styles from './ConnectionBar.module.css';

// The connection row: engine URL input and the last error message. There is
// no Start/Stop button: each engine call is a single stateless HTTP request,
// so fetching is driven by Auto-Refresh / Refresh (plus an initial fetch at
// boot) rather than a maintained connection.
function ConnectionBar() {
  const engineUrl = useSettingsStore((s) => s.settings.engineUrl);
  const status = useConnectionStore((s) => s.status);
  const message = useConnectionStore((s) => s.message);

  const [hostInput, setHostInput] = useState(engineUrl);

  // Commit the URL when the input loses focus (only when it changed).
  const onUrlBlur = () => {
    if (hostInput.trim() !== engineUrl) {
      Services.settings.setEngineUrl(hostInput);
    }
  };

  return (
    <div className={styles.bar}>
      <Group gap="md" wrap="wrap" className={styles.row}>
        <Input
          size="sm"
          w={250}
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          onBlur={onUrlBlur}
          title="Engine URL"
        />
      </Group>

      {status === 'error' && message && (
        <Text size="sm" c="red" className={styles.error}>
          {message}
        </Text>
      )}
    </div>
  );
}

export default ConnectionBar;
