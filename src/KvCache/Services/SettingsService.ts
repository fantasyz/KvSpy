import { Log } from '../../Common/Log';
import { Paths } from '../../Common/Paths';
import { ensureLib } from '../../platform/lib';
import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import useSettingsStore from '../Store/useSettingsStore';
import { Const } from '../Model/Const';
import type { AppSettings, TextMode, TriggerDef } from '../Model/types';

// Loads/saves settings.json under ~/.kvspy and toggles app settings. Keeps the
// store free of business logic: read the current value, write the flipped
// value, then persist.
export abstract class SettingsService {
  // Load settings from disk, seeding the defaults (and writing the file) if
  // it does not exist yet. Called at boot before any store is read.
  static async load(): Promise<AppSettings> {
    const lib = await ensureLib();
    const file = Paths.current.settingsFile;
    try {
      const raw = await lib.filesystem.readFile(file);
      return SettingsService.mergeDefaults(JSON.parse(raw) as Partial<AppSettings>);
    } catch {
      const defaults = useSettingsStore.getState().settings;
      Log.write('No settings found; seeding defaults.');
      void SettingsService.save();
      return defaults;
    }
  }

  // Fill any missing keys with defaults so old settings files still work.
  private static mergeDefaults(stored: Partial<AppSettings>): AppSettings {
    const current = useSettingsStore.getState().settings;
    return {
      ...current,
      ...stored,
      triggers: SettingsService.normalizeTriggers(stored.triggers ?? current.triggers),
    };
  }

  // Migrate stored triggers (older files lack `type`) and make sure the fixed
  // throw-away-session entries are present (stable ids, seeded disabled).
  private static normalizeTriggers(stored: Array<Partial<TriggerDef>>): TriggerDef[] {
    const migrated: TriggerDef[] = stored.map((t) => ({
      id: t.id ?? crypto.randomUUID(),
      type: t.type ?? 'endCurrentSession',
      marker: t.marker ?? '',
      enabled: t.enabled ?? false,
      action: t.action ?? 'none',
      delaySec: t.delaySec ?? 0,
    }));
    const existingIds = new Set(migrated.map((t) => t.id));
    const missing = Const.app.triggerFixedDefaults.filter((d) => !existingIds.has(d.id));
    if (missing.length === 0) {
      return migrated;
    }
    return [...migrated, ...missing.map((d) => ({ ...d, enabled: false }))];
  }

  // Persist the current settings store to disk.
  static async save(): Promise<void> {
    const { settings } = useSettingsStore.getState();
    const lib = await ensureLib();
    try {
      await lib.filesystem.writeFile(Paths.current.settingsFile, JSON.stringify(settings, null, 2));
    } catch (err) {
      Log.write(`Failed to save settings: ${err}`, true);
    }
  }

  static toggleConsole(): void {
    const { settings } = useSettingsStore.getState();
    const next = !settings.consoleVisible;
    useSettingsStore.getState().setConsoleVisible(next);
    void SettingsService.save();
    Log.write(`Console ${next ? 'shown' : 'hidden'}.`);
  }

  static hideConsole(): void {
    const { settings } = useSettingsStore.getState();
    if (!settings.consoleVisible) return;
    useSettingsStore.getState().setConsoleVisible(false);
    void SettingsService.save();
    Log.write('Console hidden.');
  }

  // Show the console if it is hidden (e.g. so trigger Detect results are visible).
  static showConsole(): void {
    const { settings } = useSettingsStore.getState();
    if (settings.consoleVisible) return;
    useSettingsStore.getState().setConsoleVisible(true);
    void SettingsService.save();
    Log.write('Console shown.');
  }

  static setEngineUrl(url: string): void {
    useSettingsStore.getState().setEngineUrl(url);
    void SettingsService.save();
    Log.write(`Engine URL set to ${url} (default: ${Const.app.defaultEngineUrl}).`);
  }

  static setTextMode(mode: TextMode): void {
    useSettingsStore.getState().setTextMode(mode);
    void SettingsService.save();
    Log.write(`Text mode set to '${mode}'.`);
  }

  // Save the current window dimensions and persist them.
  static saveWindowSize(width: number, height: number): void {
    useSettingsStore.getState().setWindowSize(width, height);
    void SettingsService.save();
  }

  static setAutoFindRelatedCells(value: boolean): void {
    useSettingsStore.getState().setAutoFindRelatedCells(value);
    void SettingsService.save();
    Log.write(`Auto-find related cells on selection: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Set auto-refresh on/off. Broadcasts the change so the cache poller can
  // start/stop; persistence and the store write are handled here (not the UI).
  static setAutoRefresh(value: boolean): void {
    useSettingsStore.getState().setAutoRefresh(value);
    void SettingsService.save();
    bus.emit(AppEvents.autoRefreshChanged);
    Log.write(`Auto-refresh: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Set the auto-refresh interval (ms). Broadcasts so a running poller
  // restarts with the new interval. No per-change log: the slider emits one
  // per drag step and would flood the console.
  static setRefreshIntervalMs(value: number): void {
    useSettingsStore.getState().setRefreshIntervalMs(value);
    void SettingsService.save();
    bus.emit(AppEvents.autoRefreshChanged);
  }

  // Toggle the per-poll payload-size log (debug aid for delta sync).
  static setLogRefreshPayload(value: boolean): void {
    useSettingsStore.getState().setLogRefreshPayload(value);
    void SettingsService.save();
    Log.write(`Refresh payload log: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Toggle the per-delta-poll summary log line.
  static setLogDeltaPoll(value: boolean): void {
    useSettingsStore.getState().setLogDeltaPoll(value);
    void SettingsService.save();
    Log.write(`Delta poll log: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Add a new trigger with the first free TRIGGER_MARKER_<N> text.
  static addTrigger(): TriggerDef {
    const { settings } = useSettingsStore.getState();
    const existing = new Set(settings.triggers.map((t) => t.marker));
    let index = 1;
    while (existing.has(`${Const.app.triggerMarkerPrefix}${index}`)) {
      index++;
    }
    const trigger: TriggerDef = {
      id: crypto.randomUUID(),
      type: 'endCurrentSession',
      marker: `${Const.app.triggerMarkerPrefix}${index}`,
      enabled: true,
      action: 'none',
      delaySec: 0,
    };
    useSettingsStore.getState().setTriggers([...settings.triggers, trigger]);
    void SettingsService.save();
    bus.emit(AppEvents.triggersChanged);
    Log.write(`Trigger added: "${trigger.marker}".`);
    return trigger;
  }

  // Replace a trigger by id (the Triggers tab footer Apply).
  static updateTrigger(trigger: TriggerDef): void {
    const { settings } = useSettingsStore.getState();
    if (!settings.triggers.some((t) => t.id === trigger.id)) {
      Log.write(`Trigger update skipped: unknown id ${trigger.id}.`, true);
      return;
    }
    useSettingsStore
      .getState()
      .setTriggers(settings.triggers.map((t) => (t.id === trigger.id ? trigger : t)));
    void SettingsService.save();
    bus.emit(AppEvents.triggersChanged);
    Log.write(
      `Trigger updated: "${trigger.marker}" (${trigger.action}, ${trigger.delaySec}s, ${trigger.enabled ? 'enabled' : 'disabled'}).`
    );
  }

  // Remove a trigger by id (the Triggers tab footer Delete).
  static removeTrigger(triggerId: string): void {
    const { settings } = useSettingsStore.getState();
    const trigger = settings.triggers.find((t) => t.id === triggerId);
    if (!trigger) {
      Log.write(`Trigger delete skipped: unknown id ${triggerId}.`, true);
      return;
    }
    useSettingsStore
      .getState()
      .setTriggers(settings.triggers.filter((t) => t.id !== triggerId));
    void SettingsService.save();
    bus.emit(AppEvents.triggersChanged);
    Log.write(`Trigger deleted: "${trigger.marker}".`);
  }

  // Toggle trigger dry-run mode (actions are logged as fake requests).
  static setTriggerDryRun(value: boolean): void {
    useSettingsStore.getState().setTriggerDryRun(value);
    void SettingsService.save();
    Log.write(`Trigger dry-run: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Toggle the confirmation dialog before releasing a cache entry.
  static setReleaseConfirm(value: boolean): void {
    useSettingsStore.getState().setReleaseConfirm(value);
    void SettingsService.save();
    Log.write(`Release confirmation: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Toggle saving engine responses to files under ~/.KvSpy/responses/.
  static setLogResponses(value: boolean): void {
    useSettingsStore.getState().setLogResponses(value);
    void SettingsService.save();
    Log.write(`Response file log: ${value ? 'enabled' : 'disabled'}.`);
  }

  // Set how many response files to keep; the oldest excess is pruned on start.
  static setResponseFileLimit(value: number): void {
    useSettingsStore.getState().setResponseFileLimit(value);
    void SettingsService.save();
    Log.write(`Response file limit set to ${value}.`);
  }

  static setCellShowResidency(value: boolean): void {
    useSettingsStore.getState().setCellShowResidency(value);
    void SettingsService.save();
    Log.write(`Cell display: residency ${value ? 'shown' : 'hidden'}.`);
  }

  static setCellShowPages(value: boolean): void {
    useSettingsStore.getState().setCellShowPages(value);
    void SettingsService.save();
    Log.write(`Cell display: pages ${value ? 'shown' : 'hidden'}.`);
  }

  static setCellShowHostMem(value: boolean): void {
    useSettingsStore.getState().setCellShowHostMem(value);
    void SettingsService.save();
    Log.write(`Cell display: host memory ${value ? 'shown' : 'hidden'}.`);
  }

  static setDetailVisibleRoles(roles: string[]): void {
    useSettingsStore.getState().setDetailVisibleRoles(roles);
    void SettingsService.save();
    Log.write(`Detail role filter: showing [${roles.join(', ')}].`);
  }

  static setDetailSortDesc(desc: boolean): void {
    useSettingsStore.getState().setDetailSortDesc(desc);
    void SettingsService.save();
    Log.write(`Detail sort direction: ${desc ? 'descending' : 'ascending'}.`);
  }

  static setDetailStripMarkers(value: boolean): void {
    useSettingsStore.getState().setDetailStripMarkers(value);
    void SettingsService.save();
    Log.write(`Detail strip message markers: ${value ? 'enabled' : 'disabled'}.`);
  }
}
