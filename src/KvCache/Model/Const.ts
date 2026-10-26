import { ConnectionState, TriggerMarkerType } from "./types";

// App-level constants, grouped under a single `Const` accessor so call sites
// stay short (Const.app.windowTitle) and import lists stay small.
class AppConstants {
  // Under the user home dir.
  appDirName = ".KvSpy";
  settingsFile = "settings.json";
  // Log file (~/.KvSpy/app.log), cleared on each app run (see BootService).
  logFile = "app.log";
  // Optional headless replay script (~/.KvSpy/debug-autoplay.json, see
  // DebugAutoplayService). Present only when running automated checks.
  debugAutoplayFile = "debug-autoplay.json";
  // Directory for engine response dumps (~/.KvSpy/responses/).
  responsesDir = "responses";
  // In-memory console buffer cap.
  maxLogLines = 500;
  // Window title shown in the native titlebar.
  windowTitle = "KvSpy";
  // Default inference-engine base URL (override in settings at runtime).
  defaultEngineUrl = "http://127.0.0.1:8080";
  // Context-cache admin API path (GET {engineUrl}/v1/context-cache).
  contextCachePath = "/v1/context-cache";
  // Context-cache entries path for mutations (PATCH/DELETE {engineUrl}/v1/context-cache/entries/{id}).
  contextCacheEntriesPath = "/v1/context-cache/entries";
  // Default polling interval for cache state (ms).
  defaultPollMs = 2000;
  // Default auto-refresh interval (ms): how often to re-pull the cache while
  // auto-refresh is on (override in settings at runtime).
  defaultAutoRefreshIntervalMs = 1000;
  // Default marker text for new triggers (TRIGGER_MARKER_<N>, first free N).
  triggerMarkerPrefix = "TRIGGER_MARKER_";
  // Trigger delay slider range in seconds.
  triggerMaxDelaySec = 30;
  // Release retry backoff steps on HTTP 409 (an in-flight request reads the
  // entry) in ms.
  triggerReleaseRetryDelaysMs = [1000, 2000, 4000];
  // Template tokens in fixed throw-away-session markers: the text captured
  // between the prefix and suffix around the token is the session ID / key.
  triggerTokenId = "{ID}";
  triggerTokenSessionKey = "{SessionKey}";
  // Valid captured token values: alphanumerics plus '-' and '_'. Empty or
  // other characters (some harnesses leave the key blank) are invalid.
  triggerTokenValuePattern = /^[A-Za-z0-9_-]+$/;
  // Fixed (non-deletable) trigger entries, seeded disabled. Stable ids make
  // re-seeding an old settings file idempotent.
  triggerFixedDefaults: ReadonlyArray<{
    id: string;
    type: TriggerMarkerType;
    marker: string;
    action: "none" | "disposable" | "release";
    delaySec: number;
  }> = [
    {
      id: "fixed-begin-id",
      type: "startSessionById",
      marker: "== SESSION {ID} BEGINS ==",
      action: "none",
      delaySec: 0,
    },
    {
      id: "fixed-end-id",
      type: "endSessionById",
      marker: "== SESSION {ID} ENDED ==",
      action: "release",
      delaySec: 5,
    },
    {
      id: "fixed-end-sessionkey",
      type: "endSessionBySessionKey",
      marker: "== ENDED-SESSION-KEY {SessionKey} ==",
      action: "release",
      delaySec: 5,
    },
  ];
  // Message roles offered by the detail panel's role filter pills.
  detailRoleFilters = ["system", "user", "assistant", "tool"];
  // Model message markers stripped from segment previews when the
  // strip-markers toggle is on. `stripRole` also removes the role word that
  // immediately follows the marker (e.g. "<|im_start|>system").
  detailMsgMarkers = [
    { text: "<|im_start|>", stripRole: true },
    { text: "<|im_end|>", stripRole: false },
  ];
  // Initial connection state until the engine is reachable.
  initialConnection: ConnectionState = ConnectionState.Disconnected;
}

// Shared UI presentation constants.
class UiConstants {
  // Delay before a hover tooltip shows.
  tooltipOpenDelayMs = 300;

  // Duration of the change-flash animation on a cache cell (ms).
  cellFlashDurationMs = 300;

  // Base cache-cell height (px): fits the key (up to 2 lines), two option
  // rows in the middle, and the token count at the bottom.
  cellBaseHeight = 84;
  // Option rows the base cell height already fits.
  cellBaseOptionRows = 2;
  // Extra height (px) added per option row beyond the base.
  cellExtraRowHeight = 16;

  // Compute the cache-cell height for the number of enabled option rows.
  cellHeightForOptionRows(optionRows: number): number {
    const extraRows = Math.max(0, optionRows - this.cellBaseOptionRows);
    return this.cellBaseHeight + extraRows * this.cellExtraRowHeight;
  }

  // Cell token-count color scale: as the token value (in thousands) rises from 0
  // to ~250 the color steps blue -> cyan -> teal -> yellow -> orange -> red.
  // Each entry is [maxExclusive, Mantine color token] (lowest first).
  readonly tokenColorScale: ReadonlyArray<readonly [number, string]> = [
    [40, "var(--mantine-color-blue-4)"],
    [80, "var(--mantine-color-cyan-4)"],
    [120, "var(--mantine-color-teal-4)"],
    [160, "var(--mantine-color-yellow-4)"],
    [200, "var(--mantine-color-orange-4)"],
    [Number.MAX_SAFE_INTEGER, "var(--mantine-color-red-4)"],
  ];

  // Pick a color token from the token-count scale (input in raw token count).
  tokenColor(rawTokens: number): string {
    const k = rawTokens / 1000;
    for (const [maxExclusive, color] of this.tokenColorScale) {
      if (k < maxExclusive) return color;
    }
    return this.tokenColorScale[this.tokenColorScale.length - 1][1];
  }

  // Host-memory color scale for cache cells: 0 bytes is plain dimmed gray
  // (nothing to highlight); as the byte count rises the color steps
  // blue -> cyan -> teal -> yellow -> orange -> red (same "bigger is
  // hotter" language as the token scale).
  // Each entry is [maxExclusiveBytes, Mantine color token] (lowest first).
  readonly hostMemColorScale: ReadonlyArray<readonly [number, string]> = [
    [1, "var(--mantine-color-dimmed)"],
    [128 * 1024 * 1024, "var(--mantine-color-blue-4)"],
    [512 * 1024 * 1024, "var(--mantine-color-cyan-4)"],
    [1024 * 1024 * 1024, "var(--mantine-color-teal-4)"],
    [2 * 1024 * 1024 * 1024, "var(--mantine-color-yellow-4)"],
    [4 * 1024 * 1024 * 1024, "var(--mantine-color-orange-4)"],
    [Number.MAX_SAFE_INTEGER, "var(--mantine-color-red-4)"],
  ];

  // Pick a color token from the host-memory scale (input in bytes).
  hostMemColor(bytes: number): string {
    for (const [maxExclusive, color] of this.hostMemColorScale) {
      if (bytes < maxExclusive) return color;
    }
    return this.hostMemColorScale[this.hostMemColorScale.length - 1][1];
  }
}

export abstract class Const {
  static readonly app = new AppConstants();
  static readonly ui = new UiConstants();
}
