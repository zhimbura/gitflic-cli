// Persistent user config — key/value map stored as JSON.
// Location: $XDG_CONFIG_HOME/gitflic-cli/config.json
//           (falls back to $HOME/.config/gitflic-cli/config.json).
//
// Disable with GITFLIC_NO_CONFIG=1.

import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

const FILE_NAME = "config.json";

function configFile() {
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
  mkdirSync(dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, f);
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
