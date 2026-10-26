import { ensureLib } from '../platform/lib';
import { Paths } from './Paths';

// Appends timestamped lines to the persistent logs. Always writes to
// ~/.kvspy/kvspy.log; when extra targets are set the same line is mirrored to
// them too. Appends are fire-and-forget (a slow or failed write never blocks
// the caller); all of them are chained so `flush()` can await the whole queue
// — call it right before app.exit() so the final lines actually land on disk.
let extraTargets: string[] = [];
let pending: Promise<void> = Promise.resolve();

export abstract class FileLog {
  // Add extra files to mirror every log line to (in addition to kvspy.log).
  static setExtraTargets(targets: string[]): void {
    extraTargets = [...targets];
  }

  // Await every append queued so far (e.g. before terminating the app).
  static async flush(): Promise<void> {
    await pending;
  }

  // Truncate the persistent log file so a fresh app run starts with a clean
  // slate. Chained onto the same `pending` queue as append() so it runs before
  // any queued append lands (call it right after Paths.init(), before the first
  // Log.write).
  static clear(): void {
    const target = Paths.current.logFile;
    const job = (async () => {
      const lib = await ensureLib();
      try {
        await lib.filesystem.writeFile(target, '');
      } catch (err) {
        console.warn('[filelog] clear failed:', target, err);
      }
    })();
    pending = pending.then(() => job);
  }

  static append(text: string): void {
    const line = `[${new Date().toISOString()}] ${text}`;
    const targets = [Paths.current.logFile, ...extraTargets];
    const job = (async () => {
      const lib = await ensureLib();
      for (const target of targets) {
        try {
          await lib.filesystem.appendFile(target, line + '\n');
        } catch (err) {
          console.warn('[filelog] append failed:', target, err);
        }
      }
    })();
    pending = pending.then(() => job);
  }
}
