import { Button, Text, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { formatBytes } from '../../utils/format';
import { Services } from '../../services';
import useConnectionStore from '../Store/useConnectionStore';
import useSettingsStore from '../Store/useSettingsStore';
import styles from './CacheListHeader.module.css';

// Header of the left (cache list) column: aggregate physical usage (device
// pages / disk / host), an Auto-Refresh On/Off toggle, and a Refresh button.
function CacheListHeader() {
  const lastResult = useConnectionStore((s) => s.lastResult);
  const status = useConnectionStore((s) => s.status);
  const autoRefresh = useSettingsStore((s) => s.settings.autoRefresh);
  // Refresh is only busy while a fetch is in flight; it also works as the
  // first fetch after boot.
  const refreshDisabled = status === 'connecting';

  // Top-level aggregate usage (0 when not connected / data not fetched yet).
  const deviceKvPages = lastResult?.deviceKvPages ?? 0;
  const hostKvBytes = lastResult?.hostKvBytes ?? 0;
  const hostKvCapacityBytes = lastResult?.hostKvCapacityBytes ?? 0;
  const diskBytes = lastResult?.diskBytes ?? 0;
  const diskTier = lastResult?.diskTier ?? false;
  // Sum of the per-entry exclusive page counts (what each entry's release
  // would return); the gap to the total is shared pages.
  const deviceKvPagesExclusive =
    lastResult?.entries.reduce((sum, entry) => sum + (entry.deviceKvPages ?? 0), 0) ?? 0;

  return (
    <div className={styles.header}>
      <div className={styles.infoRow}>
        <Tooltip
          label="Device KV pages: exclusively owned by cache entries / total in use. The gap is shared pages referenced by multiple entries."
          position="bottom-start"
          withArrow
          withinPortal
        >
          <Text size="sm" c="dimmed">
            Page: {deviceKvPagesExclusive}/{deviceKvPages}
          </Text>
        </Tooltip>
        <span className={styles.infoSpacer} />
        <Tooltip
          label={`Bytes stored on the disk tier; OFF when the tier is disabled. (${diskBytes.toLocaleString()} bytes)`}
          position="bottom"
          withArrow
          withinPortal
        >
          <Text size="sm" c="dimmed">
            Disk: {diskTier ? formatBytes(diskBytes) : 'OFF'}
          </Text>
        </Tooltip>
        <span className={styles.infoSpacer} />
        <Tooltip
          label={`Host (Sys RAM) KV bytes: in use / total capacity. (${hostKvBytes.toLocaleString()} / ${hostKvCapacityBytes.toLocaleString()} bytes)`}
          position="bottom-end"
          withArrow
          withinPortal
        >
          <Text size="sm" c="dimmed">
            Host: {hostKvCapacityBytes > 0 ? `${formatBytes(hostKvBytes)}/${formatBytes(hostKvCapacityBytes)}` : formatBytes(hostKvBytes)}
          </Text>
        </Tooltip>
      </div>
      <div className={styles.controlsRow}>
        <Button
          variant={autoRefresh ? 'light' : 'subtle'}
          size="sm"
          className={autoRefresh ? undefined : styles.toggleOff}
          leftSection={
            <span
              className={`${styles.ledDot} ${autoRefresh ? styles.ledOn : ''}`}
            />
          }
          aria-pressed={autoRefresh}
          onClick={() => Services.settings.setAutoRefresh(!autoRefresh)}
        >
          Auto-Refresh
        </Button>
        {/* Hidden while auto refresh runs: manual refresh is redundant there. */}
        {!autoRefresh && (
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconRefresh size={14} />}
            loading={status === 'connecting'}
            disabled={refreshDisabled}
            onClick={() => void Services.engine.connect()}
          >
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}

export default CacheListHeader;
