import { Chip, Group, SegmentedControl, Text, Tooltip } from '@mantine/core';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import type { TextMode } from '../Model/types';
import styles from './CacheListToolbar.module.css';

// The `text` query-param options offered by the Mode selector.
const TEXT_MODE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'full', label: 'Full' },
];

// Toolbar between the cache list header and grid: toggles the extra properties
// shown inside each cell (ID and token count are always shown and not listed).
// The options persist in app settings. The right-aligned Mode selector picks
// the `text` query-param sent to the engine.
function CacheListToolbar() {
  const showResidency = useSettingsStore((s) => s.settings.cellShowResidency);
  const showPages = useSettingsStore((s) => s.settings.cellShowPages);
  const showHostMem = useSettingsStore((s) => s.settings.cellShowHostMem);
  const textMode = useSettingsStore((s) => s.settings.textMode);

  return (
    <div className={styles.toolbar}>
      <Chip
        size="xs"
        variant={showResidency ? 'filled' : 'light'}
        checked={showResidency}
        onChange={(checked) => Services.settings.setCellShowResidency(checked)}
      >
        Residency
      </Chip>
      <Chip
        size="xs"
        variant={showPages ? 'filled' : 'light'}
        checked={showPages}
        onChange={(checked) => Services.settings.setCellShowPages(checked)}
      >
        Pages
      </Chip>
      <Chip
        size="xs"
        variant={showHostMem ? 'filled' : 'light'}
        checked={showHostMem}
        onChange={(checked) => Services.settings.setCellShowHostMem(checked)}
      >
        Host Mem
      </Chip>
      <Group gap="xs" className={styles.modeGroup}>
        <Tooltip label="None: stats only. Full: include chat context raw text." withArrow>
          <Group gap="xs">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Mode
            </Text>
            <SegmentedControl
              size="xs"
              data={TEXT_MODE_OPTIONS}
              value={textMode}
              onChange={(value) => Services.engine.setTextMode(value as TextMode)}
            />
          </Group>
        </Tooltip>
      </Group>
    </div>
  );
}

export default CacheListToolbar;
