// Central access to the @neutralinojs/lib client.
//
// The app is desktop-only: every native capability goes through this single
// loader. `ensureLib()` resolves the lib once and wires it to the Neutralino
// runtime (the NL_* globals injected by the binary). init() is idempotent, so
// calling it again after a reconnect is safe.
type NeutralinoLib = typeof import('@neutralinojs/lib');

let libPromise: Promise<NeutralinoLib> | null = null;

// Load the client lib and connect it to the native runtime.
export function ensureLib(): Promise<NeutralinoLib> {
  if (!libPromise) {
    libPromise = import('@neutralinojs/lib').then((lib) => {
      try {
        lib.init();
      } catch {
        // NL_PORT may not be ready yet; init() is retried on the next call.
      }
      return lib;
    });
  }
  return libPromise;
}
