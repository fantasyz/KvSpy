# Context-Marker Triggers

KvSpy watches the cache for **context markers** — user-defined text patterns in
an entry's prompt content. When a (non-shared) entry contains a marker, KvSpy
performs a configured action after a configurable delay:

- **Set Disposable** — `PATCH /v1/context-cache/entries/{id}` with
  `retention=disposable` (the engine evicts it first when space is needed).
- **Release** — `DELETE /v1/context-cache/entries/{id}` (immediately freed
  from all tiers).

## Purpose

With 3rd-party harnesses you cannot modify, a prompt instruction makes a
sub-agent emit a marker in its final response, e.g.

```text
== SUB-AGENT EXITING ==
```

KvSpy detects it in the arriving cache entry and recycles that session's KV.
Harness-cooperating variants use the same engine with richer marker formats,
implemented as **fixed triggers** (see below):

- Cross-session: `== SESSION {ID} BEGINS ==` /
  `== SESSION {ID} ENDED ==` (harness-injected, deterministic).
- Session-key: `== ENDED-SESSION-KEY {SessionKey} ==` (harness tags sub-agent
  sessions with a key).

The app seeds four disabled triggers out of the box: the example
`== SUB-AGENT EXITING ==` (release, 5s) plus the three fixed
throw-away-session entries.

## Fixed throw-away-session triggers

Three trigger entries are **fixed**: seeded with stable ids, non-deletable
(lock icon in the row, no Delete in the footer). Their marker, action, and
delay are editable, and they can be disabled like any trigger. The marker is
a **template**: the `{ID}` / `{SessionKey}` token is a placeholder, and the
text captured between the pattern's prefix and suffix is the session ID / key.
Matching stays a plain (case-sensitive) prefix/suffix scan — no regex. The
captured value must be a valid session ID / key: non-empty and limited to
`[A-Za-z0-9_-]`. An **empty capture** (some harnesses leave the session key
blank) or one with other characters is invalid: the marker does not match
and is ignored.

| Seeded entry                           | Type                     | Semantics                                                                                                                                                   |
| -------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `== SESSION {ID} BEGINS ==`            | `startSessionById`       | Registers `ID → entry id` in an in-memory session registry. No action fires (row shows `register {ID}`).                                                    |
| `== SESSION {ID} ENDED ==`             | `endSessionById`         | Captures the ID, resolves the registered entry, and schedules the action on **that** entry (cross-entry). ENDED without a prior BEGINS is ignored (logged). |
| `== ENDED-SESSION-KEY {SessionKey} ==` | `endSessionBySessionKey` | Captures the key and schedules the action on the entry whose `session_key` field equals it. No matching entry → ignored (logged).                           |

Cross-entry firing uses the same Case 2 re-resolution: at fire time the
target is re-looked-up — for `endSessionById` the registry's current entry id
(with a re-scan for the BEGIN marker if the id was replaced by a session
extension), for `endSessionBySessionKey` a fresh `session_key` lookup. A
successful release drops the session's registry entry. The registry is
in-memory and cleared on disconnect.

Verification status: the BEGIN/END (`{ID}`) pair is verified end-to-end
against a live engine (registration, cross-entry resolution, delayed
release). The `{SessionKey}` entry is **unverified** — the current harness
(Qwen Code) leaves `session_key` empty, so no entry carries a key to match.

Tokens are restricted to the fixed entries; user-created triggers stay plain
literals matched on the same entry.

## How detection works

- Detection rides on the existing delta-sync poll (`text=full`): every
  new/changed entry carries `prompt_segments`, so no extra traffic. With text
  mode `none`, entries have no content and detection is skipped (logged once).
- A marker match is a **plain case-sensitive substring** across the entry's
  prompt segments. The `==`/`##` delimiters in the marker value are what make
  it near-unique; no regex.
- Only **non-shared** entries trigger (shared prefixes are `shared_stable` and
  reject retention changes).

### Delayed firing (Case 2 semantics)

Detection only **queues** a task `{trigger, entryId, fireAt}`. At `fireAt` the
marker is **re-matched against the current entry list** and the action lands on
the entry that exists then. This matters because extending a conversation
replaces the entry id (`private:80 → private:81`) while the marker stays in
the content: a background task reporting in after the sub-agent's final
response extends the session, and the delayed release correctly targets the
newest id. Releasing a stale id is a clean no-op (404).

Other rules:

- **Latest detection wins** — a re-match re-arms the pending task's fire time.
- **Release supersedes set-disposable** — a new release task for an entry drops
  its pending set-disposable task.
- **409 retries** — `DELETE` returns 409 while an in-flight request reads the
  entry; releases retry up to 3 times (1s / 2s / 4s backoff).
- Pending tasks are in-memory only (a restart drops them; the marker is still
  in the cache for the next detection). Editing/deleting a trigger prunes its
  pending tasks.

## UI (Triggers tab)

The left column of the cache view is a tabbed page: **Cache** (the existing
list) and **Triggers**.

- **List** — one row per trigger: enable checkbox (applies immediately on
  toggle), marker text (monospace), a lock icon on fixed entries, and the
  action text (`release in 5s` / `release immediately` / `no action`;
  `register {ID}` for the BEGIN entry). Disabled rows are dimmed; the
  selected row gets a border highlight.
- **Header** — `+ New` (creates `TRIGGER_MARKER_<N>`, first free N, and focuses
  the marker input with its text selected), a **Dry-run** toggle, and **Test**.
- **Footer editor** (selected row) — line 1: marker input, action select
  (`None` / `Set Disposable` / `Release`), delay badge opening a 0–30s slider
  popover; line 2: `Delete` (left, with confirmation) and `Apply` / `Cancel`
  (right). Edits land in a local draft; Apply commits. Fixed entries have no
  `Delete`; the BEGIN entry shows only the marker input (no action/delay to
  fire). Fixed entries validate their template: Apply is disabled with a
  warning while the required `{ID}` / `{SessionKey}` token is missing or
  duplicated.

### Modes

- **Dry-run toggle** (persisted): the live trigger system runs normally —
  detection, queueing, delays — but at fire time the engine call is replaced
  by a logged fake request, e.g.
  `[dry-run] Trigger: would DELETE /v1/context-cache/entries/private:80 (…)`.
- **Test button** (always a pure dry-run): evaluates _all_ triggers (enabled
  and disabled) against the cache-selected entry and logs one line per marker
  (`Test: marker "…" detected on private:80 → release in 5s.` /
  `… NOT detected.`). No engine requests are issued; the console auto-shows.
  It is disabled when there are no triggers or none are enabled.

## Data & code layout

| Concern                                                                        | Location                                                    |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `TriggerDef` / `TriggerAction` types, `AppSettings.triggers` / `triggerDryRun` | `src/KvCache/Model/types.ts`                                |
| Marker prefix, delay range, 409 retry backoff                                  | `src/KvCache/Model/Const.ts`                                |
| Detection queue, firing, 409 retries, `detect()` (Test)                        | `src/KvCache/Services/TriggerService.ts`                    |
| Trigger add/update/remove, dry-run toggle, persistence                         | `src/KvCache/Services/SettingsService.ts`                   |
| Raw-DELETE (status, no auto re-query) used by trigger retries                  | `src/KvCache/Services/EngineService.ts` (`releaseEntryRaw`) |
| Tabbed left column, Triggers panel/header/list/footer                          | `src/KvCache/Components/LeftColumnTabs.tsx`, `Triggers*`    |
| `triggersChanged` event (prunes pending tasks on edits)                        | `src/utils/eventKeys.ts`                                    |

Triggers persist in `~/.KvSpy/settings.json`; old files without the key are
seeded with the defaults on load.

## Out of scope / future

- Harness-side marker injection — pure prompt/harness configuration, no
  KvSpy code.
- `session_key` matching without a marker: directly recycling an entry when
  its `session_key` appears/disappears, without requiring the harness to
  also emit a marker.
