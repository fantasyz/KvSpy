# Key Files

- `package.json` — npm scripts and dependencies.
- `neutralino.config.json` — native app config: window, port, `nativeAllowList`, desktop build.
- `vite.config.ts` — dev server / build config (`emptyOutDir: false` shares `dist/` with `neu`).
- `index.html` — HTML entry; loads `public/neutralino.js`.
- `src/main.tsx` — app bootstrap; imports CSS and calls `initNativePlatform()`.
- `src/App.tsx` — root layout (Mantine theme + flex shell).
- `src/KvCache/Model/Const.ts` — global constants (window title, engine URL, `~/.KvSpy` paths, markers).
- `src/KvCache/Services/EngineService.ts` — engine HTTP client (`GET /v1/context-cache` via native `net.request`).
- `src/services/index.ts` — cross-feature services facade.
- `src/utils/eventKeys.ts` — app event-bus event names.

# Common Folders

- `/src/platform` — Neutralino bridge (lib loader, native window, quitApp, dev-bridge).
- `/src/Common` — logging, paths, build version.
- `/src/utils` — event bus (`dush`), helpers.
- `/src/KvCache` — KV-cache feature (`Model/`, `Store/`, `Services/`, `Components/`).
- `/scripts` — build / package / install shell wrappers.
- `/resources/icons` — app icon + placeholder generator.
- `/docs` — documentation.

# Search Pointers

- Boot flow: `src/main.tsx` → `src/platform/native.ts` → `src/KvCache/Services/BootService.ts`.
- Placeholder icon generator: `resources/icons/make-placeholder-icon.mjs`.
- Engine admin API (external): `/mnt/WD-AI/ninfer-tp2/plans/context-cache-admin-api.md`.
- Context-marker triggers feature: `docs/trigger-markers.md` (implementation: `src/KvCache/Services/TriggerService.ts`, `src/KvCache/Components/Triggers*`).
