ideas:

- call back from inference engine for live update whenever cache get updated. e.g. with `socket.io` live connection?
  - when a cache is created, evicted, updated, moved (among VRAM, RAM, DISK)
  - OR let engine accumulate message and let client to get it when doing pulling.

- server return latest cache summary directly when a update command return not found.
  - include local state param when requesting summary to avoid length text segments.
    e.g. current segment length or hash by ID?
