#!/usr/bin/env bash
# uninstall.sh — remove gitflic-cli installed via install.sh.
# Usage:
#   bash uninstall.sh
#   bash uninstall.sh --prefix ~/.local
set -euo pipefail

PREFIX="${PREFIX:-$HOME/.local}"
INSTALL_DIR="$PREFIX/share/gitflic-cli"
BIN_DIR="$PREFIX/bin"
SYMLINK_NAME="gitflic"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix=*) PREFIX="${1#*=}" ;;
    --prefix)   [[ $# -ge 2 ]] || { echo "uninstall.sh: --prefix needs a value" >&2; exit 2; }; PREFIX="$2"; shift ;;
    -h|--help)  sed -n '2,8p' "$0"; exit 0 ;;
    --)         shift; break ;;
    *) echo "uninstall.sh: unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

INSTALL_DIR="$PREFIX/share/gitflic-cli"
BIN_DIR="$PREFIX/bin"

removed=0
if [[ -L "$BIN_DIR/$SYMLINK_NAME" ]] || [[ -e "$BIN_DIR/$SYMLINK_NAME" ]]; then
  echo "[uninstall] removing $BIN_DIR/$SYMLINK_NAME"
  rm -f "$BIN_DIR/$SYMLINK_NAME"
  removed=1
fi
if [[ -d "$INSTALL_DIR" ]]; then
  echo "[uninstall] removing $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"
  removed=1
fi

if [[ $removed -eq 0 ]]; then
  echo "[uninstall] nothing to remove at prefix $PREFIX"
  exit 0
fi

# PATH hint
if [[ ":$PATH:" == *":$BIN_DIR:"* ]]; then
  echo "[uninstall] NOTE: $BIN_DIR is still on your PATH. Remove the export line from your shell rc."
fi
echo "[uninstall] done"
