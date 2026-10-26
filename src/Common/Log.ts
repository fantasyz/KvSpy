import useLogStore from '../KvCache/Store/useLogStore';
import { FileLog } from './FileLog';

// The single entry point for logging. Routes each line to three places:
//   - the in-app console store (useLogStore) — shown in the Console panel
//   - the persistent ~/.kvspy/kvspy.log (async, fire-and-forget)
//   - the JS console (debug or error) for the built-in inspector
export abstract class Log {
  static write(text: string, isError = false): void {
    const line = isError ? `[ERROR] ${text}` : text;
    useLogStore.getState().add(line);
    if (isError) {
      console.error(line);
    } else {
      console.debug(line);
    }
    FileLog.append(line);
  }
}
