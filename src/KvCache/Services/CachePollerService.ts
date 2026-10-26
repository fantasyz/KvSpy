import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Log } from '../../Common/Log';
import useSettingsStore from '../Store/useSettingsStore';
import { EngineService } from './EngineService';

// Background poller that re-pulls the cache on an interval when auto-refresh
// is enabled. The first poll also serves as the initial fetch (EngineService
// adopts it when no data is held yet). Listens for settings changes and keeps
// the interval reconciled with them; all the fetching itself is done by
// EngineService.poll() (silent).
export abstract class CachePollerService {
  private static timerId: number | null = null;
  private static currentIntervalMs: number | null = null;
  private static initialized = false;

  // Wire up the listeners and reconcile once. Call once at boot.
  static init(): void {
    if (CachePollerService.initialized) {
      return;
    }
    CachePollerService.initialized = true;

    const reconcile = () => CachePollerService.reconcile();
    bus.on(AppEvents.autoRefreshChanged, reconcile);

    CachePollerService.reconcile();
  }

  // (Re)evaluate whether the interval should be running and start/stop it.
  // A running poller is restarted when the configured interval changes.
  private static reconcile(): void {
    const { autoRefresh, refreshIntervalMs } = useSettingsStore.getState().settings;
    const shouldPoll = autoRefresh;

    if (
      shouldPoll &&
      (CachePollerService.timerId === null ||
        CachePollerService.currentIntervalMs !== refreshIntervalMs)
    ) {
      CachePollerService.start(refreshIntervalMs);
    } else if (!shouldPoll && CachePollerService.timerId !== null) {
      CachePollerService.stop();
    }
  }

  private static start(intervalMs: number): void {
    if (CachePollerService.timerId !== null) {
      window.clearInterval(CachePollerService.timerId);
    }
    CachePollerService.currentIntervalMs = intervalMs;
    CachePollerService.timerId = window.setInterval(() => {
      void EngineService.poll();
    }, intervalMs);
    Log.write(`Auto-refresh started (every ${intervalMs}ms).`);
  }

  private static stop(): void {
    if (CachePollerService.timerId !== null) {
      window.clearInterval(CachePollerService.timerId);
      CachePollerService.timerId = null;
      CachePollerService.currentIntervalMs = null;
      Log.write('Auto-refresh stopped.');
    }
  }
}
