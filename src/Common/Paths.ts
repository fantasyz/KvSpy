import { ensureLib } from '../platform/lib';
import { Const } from '../KvCache/Model/Const';

// Resolves the ~/.kvspy directory layout once at boot and exposes the file
// paths used across the app. All app data (settings, logs) lives under
// ~/.kvspy so it survives app updates and is easy to inspect.
export interface AppPaths {
  home: string;
  root: string;
  settingsFile: string;
  logFile: string;
  responsesDir: string;
}

let cached: AppPaths | null = null;

function joinPath(base: string, ...parts: string[]): string {
  return [base, ...parts].join('/');
}

// Resolve the user home dir. Windows uses USERPROFILE; POSIX uses HOME.
async function resolveHome(): Promise<string> {
  const lib = await ensureLib();
  for (const key of ['HOME', 'USERPROFILE']) {
    try {
      const value = await lib.os.getEnv(key);
      if (value && value.trim() !== '') {
        return value;
      }
    } catch {
      // Env var not set; try the next one.
    }
  }
  // Fallback to the OS config dir (still under the user profile on both OSes).
  try {
    return await lib.os.getPath('config');
  } catch {
    console.warn('[paths] could not resolve home; defaulting to cwd');
    return '.';
  }
}

export abstract class Paths {
  // Resolve ~/.kvspy, create the directory tree, and cache the paths.
  static async init(): Promise<AppPaths> {
    const home = await resolveHome();
    const root = joinPath(home, Const.app.appDirName);
    const paths: AppPaths = {
      home,
      root,
      settingsFile: joinPath(root, Const.app.settingsFile),
      logFile: joinPath(root, Const.app.logFile),
      responsesDir: joinPath(root, Const.app.responsesDir),
    };
    await Paths.ensureDirectories(paths);
    cached = paths;
    console.log('[paths] app dir resolved:', paths.root);
    return paths;
  }

  // The cached paths. Must be resolved via init() first (called at boot).
  static get current(): AppPaths {
    if (!cached) {
      throw new Error('Paths.init() must be called before reading paths');
    }
    return cached;
  }

  static get root(): string {
    return Paths.current.root;
  }

  // Create the app directory tree if missing. Tolerant of "already exists".
  private static async ensureDirectories(paths: AppPaths): Promise<void> {
    const lib = await ensureLib();
    for (const dir of [paths.root, paths.responsesDir]) {
      try {
        await lib.filesystem.createDirectory(dir);
      } catch {
        // Already exists (or its parent) — fine.
      }
    }
  }
}
