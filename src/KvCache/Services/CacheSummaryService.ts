import { Log } from '../../Common/Log';
import type { ContextCacheResponse } from '../Model/types';

// Builds a JSON snapshot of the cache state (aggregate globals + entries) and
// copies it to the clipboard. Intended for dev/debug inspection.
export abstract class CacheSummaryService {
  // The top-level aggregate fields in the engine's wire format (snake_case).
  private static wireGlobals(response: ContextCacheResponse) {
    return {
      device_kv_pages: response.deviceKvPages,
      device_page_tokens: response.devicePageTokens,
      disk_bytes: response.diskBytes,
      disk_tier: response.diskTier,
      host_kv_bytes: response.hostKvBytes,
      host_kv_capacity_bytes: response.hostKvCapacityBytes,
    };
  }

  // Serialize the snapshot without prompt segments (compact stats view).
  static buildStatsJson(response: ContextCacheResponse): string {
    const entries = response.entries.map(({ promptSegments: _promptSegments, ...rest }) => rest);
    return JSON.stringify({ ...CacheSummaryService.wireGlobals(response), entries }, null, 2);
  }

  // Serialize the snapshot including prompt segments (full view).
  static buildFullJson(response: ContextCacheResponse): string {
    return JSON.stringify({ ...CacheSummaryService.wireGlobals(response), entries: response.entries }, null, 2);
  }

  // Copy the JSON snapshot of the given response to the clipboard.
  // Returns true on success, false otherwise.
  static async copySummary(response: ContextCacheResponse, full: boolean): Promise<boolean> {
    if (response.entries.length === 0) {
      Log.write('Copy Summary: nothing to copy (no cache entries).');
      return false;
    }
    const json = full
      ? CacheSummaryService.buildFullJson(response)
      : CacheSummaryService.buildStatsJson(response);
    const ok = await CacheSummaryService.writeClipboard(json);
    if (ok) {
      Log.write(`Copy Summary: copied ${response.entries.length} entries (${json.length} chars) to clipboard.`);
    } else {
      Log.write('Copy Summary: failed to write to clipboard.', true);
    }
    return ok;
  }

  // Write text to the clipboard, preferring the modern async Clipboard API and
  // falling back to a legacy hidden-textarea approach for environments where it
  // is unavailable (works in dev on localhost and the desktop webview).
  static async writeClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to the legacy path below.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
    return ok;
  }
}
