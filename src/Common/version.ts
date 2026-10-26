// Build identity marker, logged at boot (see BootService). A running app can be
// matched against this constant to confirm the exe on disk is a fresh build of
// the current source: if the boot log shows exactly this string, the running
// binary is up to date. Bump this whenever you need to confirm a specific
// change is actually in the running exe (a `package.json` version is not
// enough — it does not change for a bugfix).
export const BUILD_ID = '2026-10-24-scaffold';
