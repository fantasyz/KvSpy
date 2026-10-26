import { create } from "zustand";
import { Const } from "../Model/Const";
import type { AppSettings, TextMode, TriggerDef } from "../Model/types";

// Build the default settings used when settings.json does not exist yet.
function defaultSettings(): AppSettings {
  return {
    engineUrl: Const.app.defaultEngineUrl,
    pollMs: Const.app.defaultPollMs,
    textMode: "full",
    consoleVisible: true,
    windowWidth: 1500,
    windowHeight: 840,
    leftColumnWidth: 500,
    // Seeded (disabled) example: the sub-agent-exiting marker pattern, plus
    // the fixed throw-away-session entries (see Const.app.triggerFixedDefaults).
    triggers: [
      {
        id: "default-sub-agent-exiting",
        type: "endCurrentSession",
        marker: "== SUB-AGENT EXITING ==",
        enabled: false,
        action: "release",
        delaySec: 5,
      },
      ...Const.app.triggerFixedDefaults.map((t) => ({
        ...t,
        enabled: false,
      })),
    ],
    triggerDryRun: false,
    autoFindRelatedCells: false,
    autoRefresh: false,
    refreshIntervalMs: Const.app.defaultAutoRefreshIntervalMs,
    logRefreshPayload: false,
    logDeltaPoll: false,
    cellShowResidency: true,
    cellShowPages: false,
    cellShowHostMem: true,
    detailVisibleRoles: [...Const.app.detailRoleFilters],
    detailSortDesc: false,
    detailStripMarkers: true,
    releaseConfirm: true,
    logResponses: true,
    responseFileLimit: 20,
  };
}

// Zustand data store for app settings. Holds state only (no business logic) —
// mutation goes through SettingsService.
interface SettingsStore {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  setConsoleVisible: (value: boolean) => void;
  setEngineUrl: (url: string) => void;
  setTextMode: (mode: TextMode) => void;
  setWindowSize: (width: number, height: number) => void;
  setLeftColumnWidth: (width: number) => void;
  setTriggers: (triggers: TriggerDef[]) => void;
  setTriggerDryRun: (value: boolean) => void;
  setAutoFindRelatedCells: (value: boolean) => void;
  setAutoRefresh: (value: boolean) => void;
  setRefreshIntervalMs: (value: number) => void;
  setLogRefreshPayload: (value: boolean) => void;
  setLogDeltaPoll: (value: boolean) => void;
  setCellShowResidency: (value: boolean) => void;
  setCellShowPages: (value: boolean) => void;
  setCellShowHostMem: (value: boolean) => void;
  setDetailVisibleRoles: (roles: string[]) => void;
  setDetailSortDesc: (value: boolean) => void;
  setDetailStripMarkers: (value: boolean) => void;
  setReleaseConfirm: (value: boolean) => void;
  setLogResponses: (value: boolean) => void;
  setResponseFileLimit: (value: number) => void;
}

const useSettingsStore = create<SettingsStore>()((set) => ({
  settings: defaultSettings(),

  setSettings: (settings) => set({ settings }),

  setConsoleVisible: (value) =>
    set((state) => ({
      settings: { ...state.settings, consoleVisible: value },
    })),

  setEngineUrl: (url) =>
    set((state) => ({
      settings: { ...state.settings, engineUrl: url.trim() },
    })),

  setTextMode: (mode) =>
    set((state) => ({
      settings: { ...state.settings, textMode: mode },
    })),

  setWindowSize: (width, height) =>
    set((state) => ({
      settings: { ...state.settings, windowWidth: width, windowHeight: height },
    })),

  setLeftColumnWidth: (width) =>
    set((state) => ({
      settings: { ...state.settings, leftColumnWidth: width },
    })),

  setTriggers: (triggers) =>
    set((state) => ({
      settings: { ...state.settings, triggers },
    })),

  setTriggerDryRun: (value) =>
    set((state) => ({
      settings: { ...state.settings, triggerDryRun: value },
    })),

  setAutoFindRelatedCells: (value) =>
    set((state) => ({
      settings: { ...state.settings, autoFindRelatedCells: value },
    })),

  setAutoRefresh: (value) =>
    set((state) => ({
      settings: { ...state.settings, autoRefresh: value },
    })),

  setRefreshIntervalMs: (value) =>
    set((state) => ({
      settings: { ...state.settings, refreshIntervalMs: value },
    })),

  setLogRefreshPayload: (value) =>
    set((state) => ({
      settings: { ...state.settings, logRefreshPayload: value },
    })),

  setLogDeltaPoll: (value) =>
    set((state) => ({
      settings: { ...state.settings, logDeltaPoll: value },
    })),

  setCellShowResidency: (value) =>
    set((state) => ({
      settings: { ...state.settings, cellShowResidency: value },
    })),

  setCellShowPages: (value) =>
    set((state) => ({
      settings: { ...state.settings, cellShowPages: value },
    })),

  setCellShowHostMem: (value) =>
    set((state) => ({
      settings: { ...state.settings, cellShowHostMem: value },
    })),

  setDetailVisibleRoles: (roles) =>
    set((state) => ({
      settings: { ...state.settings, detailVisibleRoles: roles },
    })),

  setDetailSortDesc: (value) =>
    set((state) => ({
      settings: { ...state.settings, detailSortDesc: value },
    })),

  setDetailStripMarkers: (value) =>
    set((state) => ({
      settings: { ...state.settings, detailStripMarkers: value },
    })),

  setReleaseConfirm: (value) =>
    set((state) => ({
      settings: { ...state.settings, releaseConfirm: value },
    })),

  setLogResponses: (value) =>
    set((state) => ({
      settings: { ...state.settings, logResponses: value },
    })),

  setResponseFileLimit: (value) =>
    set((state) => ({
      settings: { ...state.settings, responseFileLimit: value },
    })),
}));

export default useSettingsStore;
