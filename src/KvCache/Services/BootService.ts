import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Paths } from '../../Common/Paths';
import { FileLog } from '../../Common/FileLog';
import { Log } from '../../Common/Log';
import { BUILD_ID } from '../../Common/version';
import { ensureLib } from '../../platform/lib';
import { SettingsService } from './SettingsService';
import { EngineService } from './EngineService';
import { DebugAutoplayService } from './DebugAutoplayService';
import { CachePollerService } from './CachePollerService';
import { SelectionTraceService } from './SelectionTraceService';
import { TriggerService } from './TriggerService';
import { ResponseLogService } from './ResponseLogService';
import useSettingsStore from '../Store/useSettingsStore';

// The boot sequence: resolve paths → load persisted settings into the stores →
// wire event listeners → signal ready. Extend this as the KV-cache feature
// (engine connection, cache poller) takes shape.
export abstract class BootService {
  private static started = false;

  static async init(): Promise<void> {
    if (BootService.started) {
      Log.write('Boot already ran; skipping duplicate init.');
      return;
    }
    BootService.started = true;

    // 1. Resolve ~/.kvspy and create the directory tree. Logging requires
    //    paths to be resolved first (FileLog reads Paths.current).
    await Paths.init();
    // Start each run with a clean persistent log (the in-memory console is
    // already empty). Chained before the first Log.write so it lands first.
    FileLog.clear();
    // Log the build marker so a running app can be matched against the current
    // source (confirm the exe on disk is a fresh build, not a stale binary).
    Log.write(`Booting KvSpy… (build ${BUILD_ID})`);

    // 2. Load persisted settings (seeding the file if missing) into the store.
    const settings = await SettingsService.load();
    useSettingsStore.getState().setSettings(settings);
    Log.write(`Engine URL: ${settings.engineUrl}`);
    if (settings.textMode === 'none') {
      Log.write(
        'Text mode is "none": prompt content is unavailable, so features like ' +
          'related-cell search, new-entry attribution, and segment display will not work. ' +
          'Switch to Full mode in the cache toolbar to enable them.'
      );
    }

    // Prune the response dump folder down to the configured limit so it does
    // not pile up across runs. Non-blocking: a slow prune must not delay
    // startup.
    void ResponseLogService.prune(settings.responseFileLimit).catch((err) =>
      Log.write(`Failed to prune response folder: ${err}`, true)
    );

    // 2a. Restore the window size from the saved settings, if any.
    await BootService.restoreWindowSize(settings.windowWidth, settings.windowHeight);

    // Listen for window resize and persist the new size.
    BootService.initWindowSizeListener();

    // 2b. Start the auto-refresh poller listeners (polls while auto-refresh
    //     is enabled; the first poll also serves as the initial fetch).
    CachePollerService.init();

    // 2b'. When auto-refresh is off, the poller will never run, so fetch once
    //      to initialize the cache state; otherwise the poller's first cycle
    //      does it.
    if (!settings.autoRefresh) {
      Log.write('Auto-refresh off; performing initial fetch.');
      void EngineService.connect();
    }

    // 2c. Start the selection tracer (re-anchors a selection whose entry id
    //     churned away on a refresh).
    SelectionTraceService.init();

    // 2d. Start the context-marker trigger watcher (no-op until triggers are
    //     defined and the cache updates).
    TriggerService.init();

    // 3. Signal readiness so the UI can finalize.
    bus.emit(AppEvents.appReady);
    Log.write('KvSpy is ready.');

    // 4. Run the optional headless debug replay (~/.KvSpy/debug-autoplay.json) in
    //    the background so it does not block startup. No-op when the file is absent.
    void DebugAutoplayService.run().catch((err) =>
      Log.write(`Autoplay run failed: ${err}`, true)
    );
  }

  // Restore the window size from the saved dimensions, if valid.
  private static async restoreWindowSize(width: number, height: number): Promise<void> {
    const lib = await ensureLib();
    if (!lib || !lib.window) {
      Log.write('Window API not available; skipping window size restore.');
      return;
    }
    // Only restore if the dimensions are reasonable (avoid edge cases).
    if (width >= 720 && height >= 440) {
      await lib.window
        .setSize({ width, height })
        .then(() => Log.write(`Restored window size: ${width}x${height}`))
        .catch((err) => Log.write(`Failed to restore window size: ${err}`, true));
    }
  }

  // Attach a resize listener to persist the window dimensions when the user
  // resizes the window.
  private static initWindowSizeListener(): void {
    let resizeTimeout: number | null = null;

    window.addEventListener('resize', () => {
      // Debounce the resize event to avoid excessive writes.
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        const { settings } = useSettingsStore.getState();
        if (
          window.innerWidth !== settings.windowWidth ||
          window.innerHeight !== settings.windowHeight
        ) {
          SettingsService.saveWindowSize(window.innerWidth, window.innerHeight);
        }
      }, 500);
    });
  }
}
