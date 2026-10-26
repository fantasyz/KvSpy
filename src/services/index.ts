// Global service accessor.
//
// Components (and cross-feature code) reach services through this single entry
// point (e.g. `Services.settings.toggleConsole()`), keeping import lists short.
//
// Feature services never import `Services` — they reference each other via
// direct singletons (no circular dependency). Only the UI layer uses this
// facade. Each entry is the service class itself (static-method style).
import { BootService } from '../KvCache/Services/BootService';
import { SettingsService } from '../KvCache/Services/SettingsService';
import { EngineService } from '../KvCache/Services/EngineService';
import { DebugAutoplayService } from '../KvCache/Services/DebugAutoplayService';
import { CacheRelationshipService } from '../KvCache/Services/CacheRelationshipService';
import { CacheSummaryService } from '../KvCache/Services/CacheSummaryService';
import { CellFlashService } from '../KvCache/Services/CellFlashService';
import { SelectionTraceService } from '../KvCache/Services/SelectionTraceService';
import { TriggerService } from '../KvCache/Services/TriggerService';
import { ResponseLogService } from '../KvCache/Services/ResponseLogService';

export abstract class Services {
  static readonly boot = BootService;
  static readonly settings = SettingsService;
  static readonly engine = EngineService;
  static readonly debugAutoplay = DebugAutoplayService;
  static readonly cacheRelationship = CacheRelationshipService;
  static readonly cacheSummary = CacheSummaryService;
  static readonly cellFlash = CellFlashService;
  static readonly selectionTrace = SelectionTraceService;
  static readonly trigger = TriggerService;
  static readonly responseLog = ResponseLogService;
}
