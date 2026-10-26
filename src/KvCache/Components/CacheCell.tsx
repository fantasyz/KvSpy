import { Text, Tooltip } from "@mantine/core";
import {
  IconCirclesRelation,
  IconPinFilled,
  IconRecycle,
  IconSkull,
} from "@tabler/icons-react";
import { formatBytes, formatTokens } from "../../utils/format";
import { Const } from "../Model/Const";
import type { ContextCacheEntry } from "../Model/types";
import useCellFlashStore from "../Store/useCellFlashStore";
import useCellHighlightStore from "../Store/useCellHighlightStore";
import usePendingReleaseStore from "../Store/usePendingReleaseStore";
import useSelectionStore from "../Store/useSelectionStore";
import useSettingsStore from "../Store/useSettingsStore";
import styles from "./CacheCell.module.css";

interface CacheCellProps {
  entry: ContextCacheEntry;
}

// A single small KV-cache cell showing the session key, optional extra
// properties, and the token count (size, colored by value). Clicking selects
// it for the detail panel; clicking the selected cell again deselects it and
// clears the related-cells highlight. When the related-cells search matches, a
// depth level badge overlays it (negative = ancestor/parent, positive =
// descendant/child). Hovering shows a popover with all properties.
function CacheCell({ entry }: CacheCellProps) {
  const selectedId = useSelectionStore((s) => s.selectedEntryId);
  const selectEntry = useSelectionStore((s) => s.selectEntry);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const clearHighlight = useCellHighlightStore((s) => s.clear);
  // Depth level of this cell relative to the selected one: negative = ancestor
  // (parent), positive = descendant (child). undefined when not related.
  const relatedLevel = useCellHighlightStore((s) =>
    s.relatedLevels.get(entry.id),
  );
  const showResidency = useSettingsStore((s) => s.settings.cellShowResidency);
  const showPages = useSettingsStore((s) => s.settings.cellShowPages);
  const showHostMem = useSettingsStore((s) => s.settings.cellShowHostMem);
  const isSelected = selectedId === entry.id;
  const isFlashing = useCellFlashStore((s) => s.flashing.has(entry.id));
  const isLatestChanged = useCellFlashStore(
    (s) => s.latestChangedId === entry.id,
  );
  // True while a pending trigger release task targets this entry (the delay
  // window between marker detection and the actual release).
  const isPendingRelease = usePendingReleaseStore((s) =>
    s.pendingReleaseIds.has(entry.id),
  );

  const onCellClick = () => {
    if (isSelected) {
      clearSelection();
      clearHighlight();
      return;
    }
    selectEntry(entry.id);
  };

  // In-flight entries report 0 for their byte/token stats; show '?' for them.
  const inFlight = entry.active;

  // Residency as small colored badges (dev = blue-green, host = pale yellow).
  const renderResidency = () => {
    if (!entry.residency) {
      return (
        <Text size="xs" c="dimmed" className={styles.option}>
          {"—"}
        </Text>
      );
    }
    const badges = [
      (entry.residency === "device" || entry.residency === "both") && {
        key: "dev",
        label: "dev",
        cls: styles.resBadgeDev,
      },
      (entry.residency === "host" || entry.residency === "both") && {
        key: "host",
        label: "host",
        cls: styles.resBadgeHost,
      },
    ].filter(Boolean) as { key: string; label: string; cls: string }[];
    if (badges.length === 0) {
      return (
        <Text size="xs" c="dimmed" className={styles.option}>
          {entry.residency}
        </Text>
      );
    }
    return badges.map((b) => (
      <span key={b.key} className={`${styles.resBadge} ${b.cls}`}>
        {b.label}
      </span>
    ));
  };

  // Tooltip content: all properties in multi-line format.
  const renderTooltip = () => (
    <div className={styles.tooltipContent}>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>ID:</span>
        <span>{entry.id}</span>
      </div>
      {entry.sessionKey && (
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Session:</span>
          <span>{entry.sessionKey}</span>
        </div>
      )}
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Tokens:</span>
        <span>{inFlight ? "?" : entry.promptTokens.toLocaleString()}</span>
      </div>
      {inFlight && (
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>State:</span>
          <span>in flight (stats not final)</span>
        </div>
      )}
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Residency:</span>
        <span>{entry.residency}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Retention:</span>
        <span>
          {entry.retention}
          {entry.retentionExplicit && (
            <span className={styles.explicitHint}> (user-set)</span>
          )}
        </span>
      </div>
      {entry.deviceKvPages != null && (
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Device pages (excl.):</span>
          <span>{inFlight ? "?" : entry.deviceKvPages}</span>
        </div>
      )}
      {entry.deviceKvPagesTotal != null && (
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Device pages (total):</span>
          <span>{inFlight ? "?" : entry.deviceKvPagesTotal}</span>
        </div>
      )}
      {entry.hostKvBytes != null && (
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Host bytes:</span>
          <span>{inFlight ? "?" : formatBytes(entry.hostKvBytes)}</span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip
      label={renderTooltip()}
      withArrow
      position="right-start"
      withinPortal
    >
      <div className={styles.cellWrapper}>
        <button
          type="button"
          className={
            isSelected ? `${styles.cell} ${styles.selected}` : styles.cell
          }
          onClick={onCellClick}
        >
          <Text
            size="sm"
            className={`${styles.key} ${
              entry.id.startsWith("shared:")
                ? styles.sharedKey
                : styles.privateKey
            }`}
          >
            {entry.sessionKey || entry.id}
          </Text>
          {inFlight ? (
            // In-flight: the property rows report 0, so hide them and show a
            // single BUSY marker instead.
            <div className={styles.options}>
              <Text size="xs" className={styles.busy}>
                BUSY
              </Text>
            </div>
          ) : showResidency || showPages || showHostMem ? (
            <div className={styles.options}>
              {showResidency && (
                <div className={styles.residencyRow}>{renderResidency()}</div>
              )}
              {showPages && (
                <Text size="xs" c="dimmed" className={styles.option}>
                  {entry.deviceKvPages != null
                    ? `${entry.deviceKvPages} pages`
                    : "—"}
                </Text>
              )}
              {showHostMem &&
                (entry.hostKvBytes != null ? (
                  <Text
                    size="xs"
                    className={styles.option}
                    style={{
                      color: Const.ui.hostMemColor(entry.hostKvBytes),
                    }}
                  >
                    {formatBytes(entry.hostKvBytes)}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed" className={styles.option}>
                    {"—"}
                  </Text>
                ))}
            </div>
          ) : null}
          <Text
            size="sm"
            fw={700}
            className={styles.size}
            style={
              inFlight
                ? undefined
                : { color: Const.ui.tokenColor(entry.promptTokens) }
            }
          >
            {inFlight ? "?" : formatTokens(entry.promptTokens)}
          </Text>
        </button>
        {/* Deletion marker: skull in the bottom-left corner while a pending
            trigger task will release this cell (the delay window). */}
        {isPendingRelease && (
          <span className={styles.skullIcon} aria-hidden>
            <IconSkull size={18} />
          </span>
        )}
        {/* Disposable marker: recycle icon in the bottom-right corner for a
            cell whose retention is 'disposable' (may be evicted anytime). */}
        {entry.retention === "disposable" && (
          <span className={styles.recycleIcon} aria-hidden>
            <IconRecycle size={18} />
          </span>
        )}
        {/* Pinned marker: bottom-right corner for a cell whose retention is
            'pinned' (same slot as the recycle badge; mutually exclusive). */}
        {entry.retention === "pinned" && (
          <span className={styles.pinIcon} aria-hidden>
            <IconPinFilled size={18} />
          </span>
        )}
        {/* Related-cells badge positioned outside the cell to avoid the
            button's overflow clipping (it straddles the top edge). */}
        {relatedLevel != null && (
          <div className={styles.badgeStack}>
            <span
              className={
                relatedLevel < 0 ? styles.parentBadge : styles.childBadge
              }
            >
              <IconCirclesRelation size={16} />
              {relatedLevel < 0 ? relatedLevel : `+${relatedLevel}`}
            </span>
          </div>
        )}
        {/* Change-flash overlay: pointer-events none so the cell stays clickable. */}
        {isFlashing && <div className={styles.flashOverlay} aria-hidden />}
        {/* Persistent marker for the most recently updated cell. */}
        {isLatestChanged && <span className={styles.latestDot} aria-hidden />}
      </div>
    </Tooltip>
  );
}

export default CacheCell;
