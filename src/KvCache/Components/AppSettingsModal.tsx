import { Checkbox, Modal, NumberInput, Slider, Text } from "@mantine/core";
import { Services } from "../../services";
import useOverlaysStore from "../Store/useOverlaysStore";
import useSettingsStore from "../Store/useSettingsStore";
import styles from "./AppSettingsModal.module.css";

// Bounds and step for the auto-refresh interval slider (ms).
const REFRESH_INTERVAL_MIN_MS = 300;
const REFRESH_INTERVAL_MAX_MS = 10000;
const REFRESH_INTERVAL_STEP_MS = 100;

// Slider marks at every whole second (1s .. 10s).
const REFRESH_INTERVAL_MARKS = Array.from(
  { length: REFRESH_INTERVAL_MAX_MS / 1000 },
  (_, i) => ({ value: (i + 1) * 1000, label: `${i + 1}s` }),
);

// "3 s" / "500 ms" for the refresh interval readout.
function formatIntervalMs(ms: number): string {
  return ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`;
}

// The app settings popup (App > Settings).
function AppSettingsModal() {
  const opened = useOverlaysStore((s) => s.openStack.includes("appSettings"));
  const close = useOverlaysStore((s) => s.close);
  const autoFindRelatedCells = useSettingsStore(
    (s) => s.settings.autoFindRelatedCells,
  );
  const releaseConfirm = useSettingsStore((s) => s.settings.releaseConfirm);
  const refreshIntervalMs = useSettingsStore(
    (s) => s.settings.refreshIntervalMs,
  );
  const logRefreshPayload = useSettingsStore(
    (s) => s.settings.logRefreshPayload,
  );
  const logDeltaPoll = useSettingsStore((s) => s.settings.logDeltaPoll);
  const logResponses = useSettingsStore((s) => s.settings.logResponses);
  const responseFileLimit = useSettingsStore(
    (s) => s.settings.responseFileLimit,
  );

  return (
    <Modal
      opened={opened}
      onClose={() => close("appSettings")}
      title="Settings"
      centered
    >
      <div className={styles.body}>
        <Text size="sm" c="dimmed" className={styles.sectionTitle}>
          Cache view
        </Text>
        <Checkbox
          label="Auto Find related cells on cell selection"
          checked={autoFindRelatedCells}
          onChange={(event) =>
            Services.settings.setAutoFindRelatedCells(
              (event.currentTarget as HTMLInputElement).checked,
            )
          }
        />
        <Checkbox
          label="Confirm before releasing an entry"
          checked={releaseConfirm}
          onChange={(event) =>
            Services.settings.setReleaseConfirm(
              (event.currentTarget as HTMLInputElement).checked,
            )
          }
        />
        <Text size="sm" c="dimmed" className={styles.sectionTitle}>
          Auto-refresh
        </Text>
        <Text size="sm" c="dimmed">
          How often the cache is re-pulled while auto-refresh is on
        </Text>
        <Text size="sm" mt="xs">
          Refresh interval: <b>{formatIntervalMs(refreshIntervalMs)}</b>
        </Text>
        <Slider
          className={styles.intervalSlider}
          color="blue"
          min={REFRESH_INTERVAL_MIN_MS}
          max={REFRESH_INTERVAL_MAX_MS}
          step={REFRESH_INTERVAL_STEP_MS}
          marks={REFRESH_INTERVAL_MARKS}
          label={(value) => formatIntervalMs(value)}
          value={refreshIntervalMs}
          onChange={(value) => Services.settings.setRefreshIntervalMs(value)}
          aria-label="Refresh interval"
        />
        <Checkbox
          label="Log refresh payload size"
          description="Log each auto-refresh poll's response size (debugs delta sync)"
          checked={logRefreshPayload}
          onChange={(event) =>
            Services.settings.setLogRefreshPayload(
              (event.currentTarget as HTMLInputElement).checked,
            )
          }
        />
        <Checkbox
          label="Log delta poll summary"
          description='Log the "Delta poll: +N changed, N unchanged, -N removed" line'
          checked={logDeltaPoll}
          onChange={(event) =>
            Services.settings.setLogDeltaPoll(
              (event.currentTarget as HTMLInputElement).checked,
            )
          }
        />
        <Text size="sm" c="dimmed" className={styles.sectionTitle}>
          Response log
        </Text>
        <Checkbox
          label="Save engine responses to files"
          description="Write each engine response to ~/.KvSpy/responses/"
          checked={logResponses}
          onChange={(event) =>
            Services.settings.setLogResponses(
              (event.currentTarget as HTMLInputElement).checked,
            )
          }
        />
        <Text size="sm" c="dimmed">
          How many response files to keep; the oldest are deleted on app start
          (0 deletes all).
        </Text>
        <NumberInput
          className={styles.limitInput}
          label="Response files to keep"
          min={0}
          value={responseFileLimit}
          onChange={(value) => {
            if (value === null || value === "") return;
            const num = typeof value === "number" ? value : Number(value);
            if (Number.isInteger(num) && num >= 0) {
              Services.settings.setResponseFileLimit(num);
            }
          }}
        />
      </div>
    </Modal>
  );
}

export default AppSettingsModal;
