// Persistent user config — key/value map stored as JSON.
// Location: $XDG_CONFIG_HOME/gitflic-cli/config.json
//           (falls back to $HOME/.config/gitflic-cli/config.json).
//
// Disable with GITFLIC_NO_CONFIG=1.
//
// Security: file mode is forced to 0600 and parent dir to 0700 on every write
// so sensitive keys (tokens, secrets) can't accidentally become world-readable
// due to a permissive umask. SecretStore (lib/secret.mjs) handles keys that
// belong in the OS keychain instead.

import { chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

const FILE_NAME = "config.json";

export function configFile() {
  const base = process.env.XDG_CONFIG_HOME || join(process.env.HOME || "~", ".config");
  return join(base, "gitflic-cli", FILE_NAME);
}

function isEnabled() {
  return process.env.GITFLIC_NO_CONFIG !== "1";
}

function readAll() {
  const f = configFile();
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  const f = configFile();
  // mkdir 0700 so the dir isn't world-traversable.
  mkdirSync(dirname(f), { recursive: true, mode: 0o700 });
  const tmp = f + ".tmp";
  // Write with explicit 0600 — overrides any loose umask.
  writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  renameSync(tmp, f);
  // Best-effort: tighten permissions after rename too (rename preserves mode
  // on some platforms but not all). chmod may not be supported on every FS.
  try { chmodSync(f, 0o600); } catch { /* ignore */ }
}

export function configGet(key) {
  if (!isEnabled()) return undefined;
  const all = readAll();
  return all[key];
}

export function configSet(key, value) {
  if (!isEnabled()) return;
  const all = readAll();
  all[key] = value;
  writeAll(all);
}

export function configDelete(key) {
  if (!isEnabled()) return;
  const all = readAll();
  delete all[key];
  writeAll(all);
}

export function configList() {
  if (!isEnabled()) return {};
  return readAll();
}

export function configPath() {
  return configFile();
}

export function configClear() {
  if (!isEnabled()) return;
  const f = configFile();
  if (existsSync(f)) unlinkSync(f);
}
