#!/usr/bin/env bash
# install.sh — installer for gitflic-cli (Linux / macOS / WSL).
#
# Realistic one-shot (assumes you have an SSH key on https://gitflic.ru):
#   git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
#   cd ~/tools/gitflic-cli && bash install.sh
#
# Or with a token (HTTPS instead of SSH):
#   GITFLIC_TOKEN=... bash install.sh
#
# Env vars:
#   REPO=owner/name           Default: tikhon/gitflic-cli
#   BRANCH=main               Default: main
#   PREFIX=$HOME/.local       Default: ~/.local
#   GITFLIC_TOKEN=...         Optional. Used for HTTPS clone if SSH not available.
#
# Flags: --prefix DIR --branch NAME --repo OWNER/NAME --no-symlink --dry-run -q
set -euo pipefail

REPO="${REPO:-tikhon/gitflic-cli}"
BRANCH="${BRANCH:-main}"
PREFIX="${PREFIX:-$HOME/.local}"
INSTALL_DIR="$PREFIX/share/gitflic-cli"
BIN_DIR="$PREFIX/bin"
SYMLINK_NAME="gitflic"

NO_SYMLINK=0
DRY_RUN=0
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix=*)   PREFIX="${1#*=}" ;;
    --prefix)     [[ $# -ge 2 ]] || { echo "install.sh: --prefix needs a value" >&2; exit 2; }; PREFIX="$2"; shift ;;
    --branch=*)   BRANCH="${1#*=}" ;;
    --branch)     [[ $# -ge 2 ]] || { echo "install.sh: --branch needs a value" >&2; exit 2; }; BRANCH="$2"; shift ;;
    --repo=*)     REPO="${1#*=}" ;;
    --repo)       [[ $# -ge 2 ]] || { echo "install.sh: --repo needs a value" >&2; exit 2; }; REPO="$2"; shift ;;
    --no-symlink) NO_SYMLINK=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    -q|--quiet)   QUIET=1 ;;
    -h|--help)    sed -n '2,20p' "$0"; exit 0 ;;
    --)           shift; break ;;
    *) echo "install.sh: unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

INSTALL_DIR="$PREFIX/share/gitflic-cli"
BIN_DIR="$PREFIX/bin"

# ---------- output ----------
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
  C_OK="\033[32m"; C_WARN="\033[33m"; C_ERR="\033[31m"; C_DIM="\033[2m"; C_RST="\033[0m"
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_RST=""
fi
log()  { [[ $QUIET -eq 1 ]] || echo -e "${C_DIM}[install]${C_RST} $*"; }
ok()   { [[ $QUIET -eq 1 ]] || echo -e "${C_OK}[ ok ]${C_RST} $*"; }
warn() { echo -e "${C_WARN}[warn]${C_RST} $*" >&2; }
die()  { echo -e "${C_ERR}[fail]${C_RST} $*" >&2; exit 1; }

# ---------- preflight ----------
need() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }
need git
need node
need tar

NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" -ge 18 ]] || die "need Node 18+ (have $(node -v))"

log "repo       $REPO @ $BRANCH"
log "prefix     $PREFIX"
log "install    $INSTALL_DIR"
log "bin dir    $BIN_DIR"

# ---------- source: local checkout OR fresh clone ----------
WORK=""
LOCAL_MODE=0
cleanup() {
  # Never remove the cwd (would brick the shell) — only remove tmp clones.
  if [[ $LOCAL_MODE -eq 0 ]] && [[ -n "$WORK" ]] && [[ -d "$WORK" ]]; then
    rm -rf "$WORK" || true
  fi
}
trap cleanup EXIT

# Case 1: running from inside a gitflic-cli checkout — reuse it.
if [[ -f "./bin/gitflic" && -f "./lib/gitflic.mjs" && -d "./.git" ]]; then
  log "using local checkout: $(pwd)"
  WORK="$(pwd)"
  LOCAL_MODE=1
else
  # Case 2: clone via SSH.
  WORK="$(mktemp -d -t gitflic-install.XXXXXX)"
  if git clone --depth 1 --branch "$BRANCH" --quiet "git@gitflic.ru:$REPO.git" "$WORK" 2>/dev/null; then
    log "cloned via SSH"
  else
    # Case 3: HTTPS — with token if provided, else fail with hint.
    if [[ -n "${GITFLIC_TOKEN:-}" ]]; then
      AUTH_URL="https://oauth2:${GITFLIC_TOKEN}@gitflic.ru/$REPO.git"
    else
      AUTH_URL="https://gitflic.ru/$REPO.git"
    fi
    if git clone --depth 1 --branch "$BRANCH" --quiet "$AUTH_URL" "$WORK" 2>/dev/null; then
      log "cloned via HTTPS"
    else
      die "could not reach $REPO. Either add an SSH key to https://gitflic.ru or set GITFLIC_TOKEN=<pat> and retry."
    fi
  fi
fi

# Sanity.
for f in bin/gitflic lib/gitflic.mjs package.json README.md; do
  [[ -e "$WORK/$f" ]] || die "source is missing $f — wrong branch?"
done

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY RUN — would install to $INSTALL_DIR and link $BIN_DIR/$SYMLINK_NAME"
  exit 0
fi

# ---------- install ----------
if [[ -L "$BIN_DIR/$SYMLINK_NAME" ]] || [[ -e "$BIN_DIR/$SYMLINK_NAME" ]]; then
  log "removing previous symlink"
  rm -f "$BIN_DIR/$SYMLINK_NAME"
fi
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
# `cp -RP src/. dst/` copies the *contents* of src into dst, including dotfiles.
cp -RP "$WORK/." "$INSTALL_DIR/"
# Strip the .git history from the install copy (not useful in $PREFIX).
rm -rf "$INSTALL_DIR/.git"
chmod +x "$INSTALL_DIR/bin/gitflic"
ok "installed to $INSTALL_DIR"

# ---------- symlink ----------
if [[ $NO_SYMLINK -eq 0 ]]; then
  mkdir -p "$BIN_DIR"
  ln -s "$INSTALL_DIR/bin/gitflic" "$BIN_DIR/$SYMLINK_NAME"
  ok "linked $BIN_DIR/$SYMLINK_NAME -> $INSTALL_DIR/bin/gitflic"
else
  log "symlink skipped (--no-symlink). Add $INSTALL_DIR/bin to PATH manually."
fi

# ---------- verify ----------
log "smoke test: gitflic help"
if "$INSTALL_DIR/bin/gitflic" help >/dev/null 2>&1; then
  ok "binary works"
else
  warn "binary installed but self-check failed — run \`gitflic help\` to debug"
fi

# ---------- PATH hint ----------
if [[ $NO_SYMLINK -eq 0 ]] && [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo
  warn "$BIN_DIR is not on your PATH."
  echo "       Add this to ~/.bashrc, ~/.zshrc, or ~/.profile:"
  echo "         export PATH=\"$BIN_DIR:\$PATH\""
  echo
fi

# ---------- token hint ----------
if [[ -z "${GITFLIC_TOKEN:-}" ]]; then
  echo
  warn "GITFLIC_TOKEN is not set."
  echo "       Get a token at https://gitflic.ru -> Profile -> API tokens, then:"
  echo "         export GITFLIC_TOKEN=\"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\""
  echo
fi

ok "done. Try:  gitflic auth"
