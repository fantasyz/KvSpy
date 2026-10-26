// Centralized event names for the app-wide event bus (see utils/eventBus.ts).
//
// Defining events in one place means emitters and listeners share a single
// source of truth (string literals stay consistent and are easy to
// autocomplete). Add your app's events here.
export abstract class AppEvents {
  /** Emitted once, after the boot sequence completes. */
  static appReady: string = 'appReady';

  // KV-cache feature events.
  static cacheUpdated: string = 'cacheUpdated';
  static connectionChanged: string = 'connectionChanged';
  static commandTriggered: string = 'commandTriggered';
  static autoRefreshChanged: string = 'autoRefreshChanged';
  // The trigger definitions were added/edited (see TriggerService).
  static triggersChanged: string = 'triggersChanged';
  
  // Selection events.
  static findRelatedCells: string = 'findRelatedCells';
}
