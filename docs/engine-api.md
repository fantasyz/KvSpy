# Inference Engine API Spec

KvSpy talks to an inference engine over plain HTTP + JSON. Any engine that
exposes the endpoints below can be inspected and managed with KvSpy.

The app connects to the engine's base URL (e.g. `http://127.0.0.1:8080`) entered
in the connection bar. Requests are issued from the native side (Neutralino
`net.request`), so there are no browser CORS constraints; authentication is
engine-specific (configure it on the engine side, e.g. a bearer token on the
admin routes).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/context-cache` | List cache entries (full or delta) |
| `PATCH` | `/v1/context-cache/entries/{id}` | Set an entry's retention |
| `DELETE` | `/v1/context-cache/entries/{id}` | Release an entry from all tiers |

## Query: `GET /v1/context-cache`

Query parameters:

- `text=none` (default) — no prompt text in the response.
- `text=full` — each entry carries its captured prompt as `prompt_segments`
  (one `{role, text}` object per rendered message).
- `known=...` — delta sync (see below).

The response has **one shape** for first polls and delta polls:

```json
{
  "object": "list",
  "entries": [
    {
      "id": "private:4",
      "session_key": "",
      "shared": false,
      "active": false,
      "prompt_tokens": 82372,
      "residency": "device",
      "retention": "recent_private",
      "retention_explicit": false,
      "revision": 11,
      "last_hit_age_ms": 20294,
      "active_references": 0,
      "device_kv_pages": 3,
      "device_kv_pages_total": 1288,
      "host_kv_bytes": 0,
      "origin_entry_id": "private:2",
      "prompt_segments": [ { "role": "user", "text": "..." } ]
    }
  ],
  "unchanged_entries": [ { "id": "shared:1", "ageMs": 0 } ],
  "device_page_tokens": 64,
  "device_kv_pages": 1301,
  "host_kv_bytes": 0,
  "host_kv_capacity_bytes": 8589934592,
  "disk_bytes": 0,
  "disk_tier": false
}
```

### Entry fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Namespaced: `private:<n>` (session continuation) or `shared:<n>` (shared prefix); disjoint id sequences per namespace. Process-local, not stable across restarts. |
| `session_key` | string | Client-supplied stable key when one was sent; may be empty. |
| `shared` | bool | True for shared prefixes. |
| `active` | bool | True while the entry's request is in flight. Its KV counts (`prompt_tokens`, `device_kv_pages*`, `host_kv_bytes`) are **not final and report 0** until the request commits. |
| `prompt_tokens` | int | Token count of the captured prompt. |
| `residency` | string | Where a replica currently lives: `device`, `host`, `both`, or `evicted`. |
| `retention` | string | Current retention class: `shared_stable`, `live_session`, `recent_private`, `disposable`, `pinned`. |
| `retention_explicit` | bool | True only while a client-set retention flag is in force. |
| `revision` | int | Catalog counter advanced on every in-place mutation (demotion, retention change, ...); the delta-sync token. Omit → treat as 0. |
| `last_hit_age_ms` | int | Age since the entry was last hit. |
| `active_references` | int | Number of live references to the entry. |
| `device_kv_pages` | int | Exclusive device KV pages (what a release would return). Optional. |
| `device_kv_pages_total` | int | Logical device pages total, incl. shared. Optional. |
| `host_kv_bytes` | int | Exclusive host (Sys RAM) KV bytes. Optional. |
| `prompt_segments` | array | Present with `text=full`; one `{role, text}` per rendered message. |
| `origin_entry_id` | string | Shared entries only: the private continuation the prefix was captured from (soft reference; may already be evicted). |

### Top-level aggregate fields

| Field | Notes |
|---|---|
| `device_page_tokens` | Token size of one device KV page; converts page counts into token estimates. |
| `device_kv_pages` | Total device KV pages in use. |
| `host_kv_bytes` / `host_kv_capacity_bytes` | Host tier used / total capacity bytes (capacity 0 when there is no host tier). |
| `disk_bytes` / `disk_tier` | Bytes on the disk tier; whether the tier is enabled. |

## Delta sync (`known`)

For frequent polling, the client sends the entries it already holds:

```
GET /v1/context-cache?text=full&known=private:4:11,shared:1:2
```

Each pair is `id:revision` (revision from the last response). The server then:

- renders entries the client does not know, or whose `revision` changed, in full
  under `entries`;
- renders known entries with an unchanged `revision` as `{id, ageMs}` under
  `unchanged_entries` — the age is re-issued on every poll because a served
  request does not advance the `revision`;
- omits known ids that no longer exist — the client deletes them.

**Client contract:** upsert `entries`, refresh `ageMs` from `unchanged_entries`,
delete any known id mentioned in neither list. Because `text` applies only to
`entries`, this is what makes `text=full` polling cheap.

Id lifecycle: extending a conversation publishes a *new* entry under a new
`private:` id and the old id disappears; in-place changes keep the id and
advance the `revision`. An unparseable `known`, or one with more than 256
pairs, simply answers the first-poll shape (everything in `entries`) — polling
never fails on a client bug.

## Steer retention: `PATCH /v1/context-cache/entries/{id}`

Body: `{"retention": "pinned" | "default" | "live_session" | "disposable" | "auto"}`.

- `pinned` — the entry is the last eviction/demotion victim while set (soft
  constraint: it can still be evicted when device + host are exhausted).
- `auto` — returns the entry to engine-managed retention and clears
  `retention_explicit`.
- Any other value marks the entry client-controlled (`retention_explicit`
  true): the engine's session-lifecycle logic does not silently change
  `retention` while it is set.

The change only reorders eviction; it never moves pages immediately. Shared
prefixes are always `shared_stable` and reject the change.

Responses: `200` success, `404` unknown id, `409` not allowed.

## Release: `DELETE /v1/context-cache/entries/{id}`

Immediately releases the entry from the device and host tiers (and its disk
sections, when a disk tier is configured). A private entry is released
best-effort: its exclusive KV is freed, and pages shared with other entries
stay available to their holders.

Responses: `200` success, `404` unknown id, `409` while an in-flight request
reads the entry.
