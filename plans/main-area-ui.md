# Plan: Main Area UI (cells + detail panel + text-mode control)

## Goal
Complete the main area of the cache view:
- Col 1 = KV-cache cells (grid), each shows size (promptTokens) + key info (sessionKey).
- Col 2 = Detail panel for the selected cell (header = key info, multi-row; body = context text).
- Connection row: add a segmented control to switch the `text` query param: `none | preview | full`.

## Data / state
- `Model/types.ts`: add `TextMode = 'none' | 'preview' | 'full'`.
- `Store/useConnectionStore.ts`: add `textMode` + `setTextMode` (drives the query param).
- `Store/useSelectionStore.ts` (new): `selectedEntryId` + `selectEntry` / `clearSelection`.

## Services
- `Services/EngineService.ts`:
  - `connect()` appends `?text={textMode}` to the cache URL.
  - `setTextMode(mode)` writes the store, logs, and re-queries when status is `connected`.

## Components (single responsibility per file)
- `Components/ConnectionBar.tsx` (+ css): extracted connection row — status badge, engine url,
  Connect button, **SegmentedControl (text mode)**, action icons, error message.
- `Components/CacheCells.tsx` (+ css): Col 1. Renders the grid from `lastResult.entries`, empty state.
- `Components/CacheCell.tsx` (+ css): one ~80x80 cell; click => select; selected styling.
- `Components/CellDetailPanel.tsx` (+ css): Col 2. Container: header + body; empty state when none selected.
- `Components/CellDetailHeader.tsx`: multi-row key info for the selected entry.
- `Components/CellDetailBody.tsx`: context text; hint when `text=none` or no text.

## Layout
- `App.module.css`: `main` => `overflow:hidden` (inner columns scroll independently).
- `CacheView.tsx`: thin container — `ConnectionBar` (fixed top) + a two-column flex row
  (cells column scrolls; detail column has its own scroll in the body).

## Notes / assumptions
- Changing text mode re-queries the engine when already connected (the sensible UX for a
  query-param switch). When disconnected it just stores the mode.
- Detail panel derives the entry from `lastResult` by selected id; if the id is gone it shows empty.
- Search / evict / keep icons stay placeholders for now (out of scope).
