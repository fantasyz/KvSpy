#!/usr/bin/env bash
# Install a Linux desktop (freedesktop / start-menu) launcher for the built
# KvSpy binary. Writes a .desktop file to the user's applications directory
# that points at the currently-built binary in dist/.
#
# - Requires the binary to exist (run scripts/build_package.sh first).
# - Re-run this script after rebuilding or moving the project to keep it in sync.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT/dist/KvSpy"
ICON="$ROOT/resources/icons/icon.png"
DESKTOP_ID="com.app.kvspy"

# Resolve the binary for the current platform/architecture.
case "$(uname -s)" in
  Linux)  plat="linux" ;;
  Darwin) plat="mac" ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64)  bin="KvSpy-${plat}_x64" ;;
  aarch64|arm64) bin="KvSpy-${plat}_arm64" ;;
  armv7l)        bin="KvSpy-linux_armhf" ;;
  *) echo "Unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac
BIN_PATH="$DIST_DIR/$bin"

if [ ! -x "$BIN_PATH" ]; then
  echo "Binary not found: $BIN_PATH" >&2
  echo "Run scripts/build_package.sh first." >&2
  exit 1
fi

# Respect XDG_DATA_HOME if set; otherwise the standard ~/.local/share.
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS_DIR"
DESKTOP_FILE="$APPS_DIR/$DESKTOP_ID.desktop"

# Pass --resourcesPath so the binary finds resources.neu regardless of the
# working directory the desktop environment launches it from.
# NOTE: assumes the project path contains no whitespace.
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=KvSpy
GenericName=KV cache inspector
Comment=Inspect and manage the KV cache of a local inference engine.
Exec=$BIN_PATH --resourcesPath $DIST_DIR
Icon=$ICON
Terminal=false
Categories=Development;
StartupWMClass=$DESKTOP_ID
EOF

# Refresh the desktop database so the launcher appears right away (best effort).
command -v update-desktop-database >/dev/null 2>&1 && \
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true

echo "Installed launcher: $DESKTOP_FILE"
echo "Look for 'KvSpy' in your applications/start menu."
