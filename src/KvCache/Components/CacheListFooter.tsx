import { Button, Group, Tooltip } from '@mantine/core';
import {
  IconPin,
  IconPinFilled,
  IconTrash,
  IconRecycle,
  IconRecycleOff,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Services } from '../../services';
import { Log } from '../../Common/Log';
import type { ContextCacheEntry } from '../Model/types';
import ConfirmOverlayLauncher from '../Store/ConfirmOverlayLauncher';
import useConnectionStore from '../Store/useConnectionStore';
import useSelectionStore from '../Store/useSelectionStore';
import useSettingsStore from '../Store/useSettingsStore';
import styles from './CacheListFooter.module.css';

// Stable empty list so the entries reference does not churn when disconnected.
const EMPTY_ENTRIES: ContextCacheEntry[] = [];

// Footer of the cache list column: admin controls for the selected entry
// (set retention, release). Listens for the findRelatedCells event from the menu.
function CacheListFooter() {
  const selectedId = useSelectionStore((s) => s.selectedEntryId);
  const lastResult = useConnectionStore((s) => s.lastResult);
  const textMode = useSettingsStore((s) => s.settings.textMode);

  const entries = lastResult?.entries ?? EMPTY_ENTRIES;
  const selectedEntry = selectedId ? entries.find((e) => e.id === selectedId) : null;
  const canAnalyze =
    textMode === 'full' && selectedId != null && entries.some((e) => e.id === selectedId);

  // Listen for the findRelatedCells event from the Selection menu.
  useEffect(() => {
    const handler = () => {
      if (selectedId == null) {
        return;
      }
      if (!canAnalyze) {
        Log.write('Find related cells skipped: switch to Full text mode first.', true);
        return;
      }
      Services.cacheRelationship.applyRelatedHighlight(entries, selectedId);
    };
    
    bus.on(AppEvents.findRelatedCells, handler);
    return () => {
      bus.off(AppEvents.findRelatedCells, handler);
    };
  }, [selectedId, canAnalyze, entries]);

  // Derived UI state for the retention controls.
  const isPinned = selectedEntry?.retention === 'pinned';
  const isDisposable = selectedEntry?.retention === 'disposable';
  // Shared prefixes reject retention changes and release (engine 409).
  const isShared = selectedEntry?.shared === true;

  // Pin toggle: set an explicit pinned retention, or clear it back to auto.
  const onTogglePin = () => {
    if (!selectedEntry) return;
    void Services.engine.setRetention(selectedEntry.id, isPinned ? 'auto' : 'pinned');
  };

  // Disposable toggle: mark disposable, or clear the flag back to auto.
  const onToggleDisposable = () => {
    if (!selectedEntry) return;
    void Services.engine.setRetention(
      selectedEntry.id,
      isDisposable ? 'auto' : 'disposable',
    );
  };

  const onRelease = async () => {
    if (!selectedEntry) return;
    if (selectedEntry.active) {
      Log.write(`Release skipped: entry ${selectedEntry.id} is in flight.`, true);
      return;
    }
    const confirmEnabled = useSettingsStore.getState().settings.releaseConfirm;
    const confirmed = confirmEnabled
      ? await ConfirmOverlayLauncher.openAsync(
          `Release entry ${selectedEntry.id} from the cache?\n\nThis will immediately remove it from all tiers (VRAM, Sys RAM, Disk).`,
          {
            dontAskAgain: {
              label: "Don't ask again",
              onConfirm: () => Services.settings.setReleaseConfirm(false),
            },
          },
        )
      : true;
    if (confirmed) {
      void Services.engine.releaseEntry(selectedEntry.id);
    }
  };

  return (
    <div className={styles.footer}>
      <div className={styles.controls}>
        <Tooltip
          label={
            isPinned
              ? 'Un-pin: return this entry to automatic management'
              : 'Pin this entry: protect it from eviction'
          }
          withArrow
        >
          <Button
            variant="subtle"
            size="sm"
            leftSection={isPinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
            disabled={!selectedEntry || isShared}
            onClick={onTogglePin}
          >
            {isPinned ? 'Un-pin' : 'Pin'}
          </Button>
        </Tooltip>

        <Tooltip
          label={
            isDisposable
              ? 'Un-disposable: return this entry to automatic management'
              : 'Mark this entry as disposable: the engine will evict it first when space is needed (but it can still be resumed from disk)'
          }
          withArrow
        >
          <Button
            variant="subtle"
            size="sm"
            leftSection={
              isDisposable ? <IconRecycleOff size={16} /> : <IconRecycle size={16} />
            }
            disabled={!selectedEntry || isShared}
            onClick={onToggleDisposable}
          >
            {isDisposable ? 'Un-disposable' : 'Disposable'}
          </Button>
        </Tooltip>
        
        <Tooltip
          label={
            selectedEntry?.active
              ? 'Entry is in flight (being served); the engine rejects release while a request reads it'
              : 'Immediately release this entry from all tiers (VRAM, Sys RAM, Disk). The entry cannot be resumed.'
          }
          withArrow
        >
          {/* Group so the tooltip works while the button is disabled. */}
          <Group>
            <Button
              variant="subtle"
              size="sm"
              color="red"
              className={styles.release}
              leftSection={<IconTrash size={16} />}
              disabled={!selectedEntry || isShared || selectedEntry.active}
              onClick={onRelease}
            >
              Release
            </Button>
          </Group>
        </Tooltip>
      </div>
    </div>
  );
}

export default CacheListFooter;
