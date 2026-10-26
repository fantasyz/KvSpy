import { Log } from '../../Common/Log';
import { Paths } from '../../Common/Paths';
import { ensureLib } from '../../platform/lib';
import useSettingsStore from '../Store/useSettingsStore';

// Owns the engine response dump files under ~/.KvSpy/responses/: saving a
// response to disk and pruning the folder on app start. Keeps the file-naming
// and directory logic out of EngineService so the engine code stays focused on
// talking to the API.
export abstract class ResponseLogService {
  // Prune the responses folder down to the `keepCount` most recent files.
  // keepCount of 0 deletes everything. Tolerant of a missing/empty directory
  // and a folder already within the limit (nothing to do).
  static async prune(keepCount: number): Promise<void> {
    const lib = await ensureLib();
    const dir = Paths.current.responsesDir;
    let entries;
    try {
      entries = await lib.filesystem.readDirectory(dir);
    } catch {
      Log.write(`Response log prune skipped: ${dir} not present.`);
      return;
    }
    // Only files are pruned; skip any subdirectory (type is "File"/"Directory").
    const files = entries.filter((entry) => entry.type.toLowerCase() !== 'directory');
    if (files.length <= keepCount) {
      Log.write(`Response log prune: keeping all ${files.length} file(s) (limit ${keepCount}).`);
      return;
    }

    // Stat each file so we can delete the oldest excess, not an arbitrary set.
    const filesWithTime = await Promise.all(
      files.map(async (entry) => {
        const stats = await lib.filesystem
          .getStats(entry.path)
          .catch(() => null);
        return { path: entry.path, modifiedAt: stats?.modifiedAt ?? 0 };
      })
    );
    // Newest first, so the tail of the list is the oldest to drop.
    filesWithTime.sort((a, b) => b.modifiedAt - a.modifiedAt);
    const toDelete = filesWithTime.slice(keepCount);

    let removed = 0;
    for (const file of toDelete) {
      try {
        await lib.filesystem.remove(file.path);
        removed++;
      } catch (err) {
        Log.write(`Failed to remove response file ${file.path}: ${errMsg(err)}`, true);
      }
    }
    Log.write(`Response log prune: removed ${removed} old file(s), keeping ${keepCount}.`);
  }

  // Save an engine response to a standalone file under ~/.KvSpy/responses/.
  // Filename: normalized-query-string_timestamp.json
  // Example: context-cache?text-full_2026-10-24T08-30-15Z.json
  // No-op when the response file log is disabled in settings.
  static async save(url: string, body: string): Promise<void> {
    if (!useSettingsStore.getState().settings.logResponses) {
      return;
    }
    try {
      const lib = await ensureLib();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Normalize: extract path and query params, replace special chars
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/\//g, '-').replace(/^-+/, '');
      const textMode = urlObj.searchParams.get('text') || 'none';
      const filename = `${path}-${textMode}_${timestamp}.json`;
      const filepath = `${Paths.current.responsesDir}/${filename}`;

      await lib.filesystem.writeFile(filepath, body);
      Log.write(`Response saved: ${filename}`);
    } catch (err) {
      Log.write(`Failed to save response: ${errMsg(err)}`, true);
    }
  }
}

// Render an error (which may be a Neutralino error object, not a JS Error).
function errMsg(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    const base = e.message ? String(e.message) : JSON.stringify(err);
    return e.code ? `${base} (${String(e.code)})` : base;
  }
  return String(err);
}
