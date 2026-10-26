// Domain types for the KV-cache feature. These are forward-looking: they
// describe the shape of data the engine API (see the inference-engine admin
// API plan) is expected to return, so the UI/stores have something to type
// against from day one.

// Lifecycle of the connection to the inference engine.
export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connected = 'Connected',
  Error = 'Error',
}

// The `text` query parameter for GET /v1/context-cache: how much prompt content
// each entry should return.
export type TextMode = 'none' | 'full';

// One message within a cached prompt, as returned in `prompt_segments`.
// Media parts are rendered inline as markers (e.g. "[image, 64 tokens]"), so
// only the role and its text are carried here.
export interface PromptSegment {
  role: string;
  text: string;
}

// A single context-cache entry as returned by the engine's admin API
// (GET /v1/context-cache). Field names are the camelCased view of the wire
// format (see EngineService for the mapping).
export interface ContextCacheEntry {
  // Namespaced ID (e.g. "private:7", "shared:1"): the engine's (kind, id) key
  // exposed as a string so the small local IDs can repeat across namespaces.
  id: string;
  sessionKey: string;
  promptTokens: number;
  // Residency tier: "device" | "host" | "both" | "evicted".
  residency: string;
  // Retention class: "shared_stable" | "live_session" | "recent_private" |
  // "disposable" | "pinned".
  retention: string;
  // True when the user explicitly set `retention` via the PATCH API. When false,
  // the engine is auto-managing the entry and the `retention` value is only
  // informational. Optional: older engine builds omit the field.
  retentionExplicit?: boolean;
  lastHitAgeMs: number;
  activeReferences: number;
  shared: boolean;
  // True while this entry's request is in flight (being served right now).
  // While active, the byte/token stats below are not final and report 0.
  active: boolean;
  // Exclusive Device KV pages (what release would return).
  deviceKvPages?: number;
  // Logical Device KV pages total (all referenced pages, incl. shared).
  deviceKvPagesTotal?: number;
  // Exclusive Host KV bytes (what release would free from host RAM).
  hostKvBytes?: number;
  promptSegments?: PromptSegment[];
  // For shared prefixes: the private continuation this entry was captured from,
  // as a namespaced ID (e.g. "private:2"). The engine's "shared -> origin" link;
  // may be evicted by the time we query, so treat it as a soft reference.
  originEntryId?: string;
  // Catalog revision: advanced by the engine on every in-place mutation of the
  // entry (demotion, retention change, ...). The client sends (id, revision)
  // pairs via ?known= for delta sync. 0 when an older server omits the field.
  revision: number;
}

// An entry the server did not render in full because the client already holds
// it at the same revision: its id plus a fresh age (a pure hit does not advance
// the revision, so the client cannot age it locally).
export interface ContextCacheUnchangedEntry {
  id: string;
  ageMs: number;
}

// The parsed GET /v1/context-cache response (single shape for full and delta
// polls).
export interface ContextCacheResponse {
  // Entries rendered in full: a first poll lists everything; a delta poll lists
  // only the ids the client does not know or whose revision changed.
  entries: ContextCacheEntry[];
  // Known ids whose revision is unchanged; the client keeps its local copy and
  // only refreshes the age from here.
  unchangedEntries: ContextCacheUnchangedEntry[];
  // Aggregate physical usage across all entries (top-level response fields).
  // deviceKvPages: total Device (VRAM) KV pages in use.
  deviceKvPages: number;
  // devicePageTokens: token size of one Device KV page.
  devicePageTokens: number;
  // hostKvBytes: total Host (Sys RAM) KV bytes in use.
  hostKvBytes: number;
  // hostKvCapacityBytes: Host KV tier's total capacity in bytes (0 when no host tier).
  hostKvCapacityBytes: number;
  // diskBytes: bytes stored on the disk tier.
  diskBytes: number;
  // diskTier: whether the disk tier is enabled.
  diskTier: boolean;
}

// Aggregate cache statistics shown in the header/overview.
export interface KvCacheStats {
  totalEntries: number;
  totalTokens: number;
  pinnedEntries: number;
  capacityTokens: number;
}

// Action a context-marker trigger performs when its marker is detected.
export type TriggerAction = 'none' | 'disposable' | 'release';

// What a trigger's marker means. `endCurrentSession` is a plain literal
// matched on the same entry; the other three are the fixed throw-away-session
// patterns whose markers carry a {ID} / {SessionKey} token and target a
// *different* entry (the registered BEGIN entry, or the entry with a matching
// session_key).
export type TriggerMarkerType =
  | 'endCurrentSession'
  | 'startSessionById'
  | 'endSessionById'
  | 'endSessionBySessionKey';

// A context-marker trigger definition (persisted in settings.json): when a
// non-shared entry's prompt content contains the marker, the action fires
// after the delay.
export interface TriggerDef {
  id: string;
  type: TriggerMarkerType;
  marker: string;
  enabled: boolean;
  action: TriggerAction;
  delaySec: number;
}

// A command the app can issue against the engine (evict, keep, ...).
export interface KvCacheCommand {
  type: 'evict' | 'keep' | 'unkeep' | 'refresh' | 'search';
  entryId?: string;
  payload?: Record<string, unknown>;
}

// Persisted app settings (see ~/.kvspy/settings.json).
export interface AppSettings {
  engineUrl: string;
  pollMs: number;
  // Prompt content mode for cache queries (none|full). 'none' saves bandwidth
  // but disables prompt-dependent features (related-cell search, new-entry
  // attribution, segment display).
  textMode: TextMode;
  consoleVisible: boolean;
  windowWidth: number;
  windowHeight: number;
  // Cache view left column width in px (persisted split position).
  leftColumnWidth: number;
  // Context-marker triggers (see TriggerDef).
  triggers: TriggerDef[];
  // Trigger dry-run mode: live detection fires, actions are logged as fake
  // requests instead of reaching the engine.
  triggerDryRun: boolean;
  // Run the related-cells search automatically whenever a cache cell is selected.
  autoFindRelatedCells: boolean;
  // Automatically re-pull the cache state on an interval while connected.
  autoRefresh: boolean;
  // Auto-refresh interval in ms.
  refreshIntervalMs: number;
  // Log the payload size of every auto-refresh poll (debug aid to verify
  // delta sync; off by default to keep the console quiet).
  logRefreshPayload: boolean;
  // Log the "Delta poll: +N changed, N unchanged, -N removed" summary line
  // on every delta poll.
  logDeltaPoll: boolean;
  // Cache cell display options (display toggle toolbar).
  cellShowResidency: boolean;
  cellShowPages: boolean;
  cellShowHostMem: boolean;
  // Detail panel: message roles shown in the prompt segment list (filter pills).
  detailVisibleRoles: string[];
  // Detail panel: sort the prompt segment list descending (default ascending).
  detailSortDesc: boolean;
  // Detail panel: strip model message markers (e.g. <|im_start|>) from
  // segment previews.
  detailStripMarkers: boolean;
  // Ask for confirmation before releasing (deleting) a cache entry.
  releaseConfirm: boolean;
  // Save each engine response to a file under ~/.KvSpy/responses/.
  logResponses: boolean;
  // Number of response files to keep; the oldest excess is pruned on app
  // start. 0 deletes them all.
  responseFileLimit: number;
}
