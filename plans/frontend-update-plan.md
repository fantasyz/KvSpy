# Frontend Update Plan - Context Cache Admin API

## Overview
Update KvSpy frontend to use the new API response shape and add admin controls for cache entries.

## Changes

### 1. Update Types (`src/KvCache/Model/types.ts`)
- Add `deviceKvPagesTotal?: number` to `ContextCacheEntry`
- Add `hostKvBytes?: number` to `ContextCacheEntry`

### 2. Update EngineService (`src/KvCache/Services/EngineService.ts`)
- Parse the new fields in `parseContextCache()`
- Add methods for PATCH/DELETE operations:
  - `setRetention(entryId: string, retention: string): Promise<void>`
  - `releaseEntry(entryId: string): Promise<void>`

### 3. Update CacheCell (`src/KvCache/Components/CacheCell.tsx`)
- Add residency badge at top-right corner:
  - `D` = Device (blue)
  - `H` = Host RAM (orange)
  - `S` = Storage/SSD (purple)
  - `D+H` = Both (cyan)

### 4. Update CellDetailPanel or create new component
- Show additional fields:
  - Device KV pages (exclusive): `deviceKvPages`
  - Device KV pages total (logical): `deviceKvPagesTotal`
  - Host KV bytes (formatted as MB/GB): `hostKvBytes`

### 5. Update CacheListFooter (`src/KvCache/Components/CacheListFooter.tsx`)
- Add retention control buttons (right-aligned):
  - "Pin" / "Unpin" button
  - "Mark Disposable" button
- Add release button:
  - "Release" button (with confirmation)

## File List
1. `src/KvCache/Model/types.ts`
2. `src/KvCache/Services/EngineService.ts`
3. `src/KvCache/Components/CacheCell.tsx`
4. `src/KvCache/Components/CacheCell.module.css`
5. `src/KvCache/Components/CellDetailPanel.tsx` (or new component)
6. `src/KvCache/Components/CacheListFooter.tsx`
7. `src/KvCache/Components/CacheListFooter.module.css`
