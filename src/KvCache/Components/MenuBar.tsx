import { Button, Group, Menu } from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconPower,
  IconRefresh,
  IconSettings,
  IconTerminal,
} from '@tabler/icons-react';
import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { quitApp } from '../../platform';
import { Services } from '../../services';
import useConnectionStore from '../Store/useConnectionStore';
import useSettingsStore from '../Store/useSettingsStore';
import useOverlaysStore from '../Store/useOverlaysStore';
import ConnectionBar from './ConnectionBar';
import styles from './MenuBar.module.css';

// The header menu bar: App / Cache / View menus (Mantine v9 Menu.Target +
// Menu.Dropdown pattern).
function MenuBar() {
  const consoleVisible = useSettingsStore((s) => s.settings.consoleVisible);
  // Entry count drives the enabled state of the Copy Summary items.
  const entryCount = useConnectionStore((s) => s.lastResult?.entries.length ?? 0);

  return (
    <div className={styles.bar}>
      <Group gap="xs">
        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="subtle" size="sm">
              App
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconSettings size={14} />}
              onClick={() => useOverlaysStore.getState().open('appSettings')}
            >
              Settings
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconPower size={14} />} onClick={() => void quitApp()}>
              Exit
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="subtle" size="sm">
              Cache
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconRefresh size={14} />}
              onClick={() => void Services.engine.connect()}
            >
              Refresh
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCopy size={14} />}
              disabled={entryCount === 0}
              onClick={() => {
                const lastResult = useConnectionStore.getState().lastResult;
                if (lastResult) void Services.cacheSummary.copySummary(lastResult, false);
              }}
            >
              Copy Summary (stats)
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCopy size={14} />}
              disabled={entryCount === 0}
              onClick={() => {
                const lastResult = useConnectionStore.getState().lastResult;
                if (lastResult) void Services.cacheSummary.copySummary(lastResult, true);
              }}
            >
              Copy Summary (full)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="subtle" size="sm">
              Selection
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconLink size={14} />}
              onClick={() => bus.emit(AppEvents.findRelatedCells)}
            >
              Find Related Cells
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="subtle" size="sm">
              View
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconTerminal size={14} />}
              rightSection={consoleVisible ? <IconCheck size={14} /> : undefined}
              onClick={() => Services.settings.toggleConsole()}
            >
              Console
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <ConnectionBar />
    </div>
  );
}

export default MenuBar;
