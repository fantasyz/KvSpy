#!/usr/bin/env bash
# Build the web frontend AND package the Neutralino desktop binaries.
# Thin wrapper around `npm run build:desktop` (neu build). Fetches the raw
# platform binaries (bin/) via `neu update` first if they are missing.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d bin ]; then
  echo ">> bin/ not found; running 'neu update' to fetch platform binaries..."
  npx neu update
fi
npm run build:desktop
echo
echo ">> Done. Output:"
echo "   dist/         web assets"
echo "   dist/KvSpy/   desktop binaries (KvSpy-<platform>) + resources.neu"
