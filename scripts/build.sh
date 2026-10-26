#!/usr/bin/env bash
# Build the web frontend only (tsc type-check + Vite bundle → dist/).
# Fast, web-side only: it does NOT package the desktop binary.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
