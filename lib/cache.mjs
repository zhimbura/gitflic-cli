// Tiny file-based cache for things like project UUID resolution that we
// hit on almost every command.
//
//   $XDG_CACHE_HOME/gitflic-cli/cache.json   (single JSON map)
//   or $HOME/.cache/gitflic-cli/cache.json   (fallback)
//
// Each entry: { v: <value>, e: <expiresAtEpochMs> }
// On read: if e <= now, treat as miss and delete the key.
//
// Disabled entirely with GITFLIC_NO_CACHE=1.

import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const FILE_NAME = "cache.json";

function cacheFile() {
  const base = process.env.XDG_CACHE_HOME || join(process.env.HOME || "~", ".cache");
  return join(base, "gitflic-cli", FILE_NAME);
}

function isEnabled() {
  return process.env.GITFLIC_NO_CACHE !== "1";
}

function readAll() {
  const f = cacheFile();
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  const f = cacheFile();
  mkdirSync(dirname(f), { recursive: true });
  // Atomic-ish: write to tmp then rename. Avoids half-written cache on crash.
  const tmp = f + ".tmp";
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  // rename() is atomic on same FS
  renameSync(tmp, f);
}

export function cacheGet(key) {
  if (!isEnabled()) return undefined;
  const all = readAll();
  const entry = all[key];
  if (!entry) return undefined;
  if (typeof entry.e !== "number" || entry.e <= Date.now()) {
    delete all[key];
    writeAll(all);
    return undefined;
  }
  return entry.v;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (!isEnabled()) return;
  const all = readAll();
  all[key] = { v: value, e: Date.now() + ttlMs };
  writeAll(all);
}

export function cacheDelete(key) {
  if (!isEnabled()) return;
  const all = readAll();
  delete all[key];
  writeAll(all);
}

export function cacheClear() {
  if (!isEnabled()) return;
  const f = cacheFile();
  if (existsSync(f)) unlinkSync(f);
}

// Expose path for tooling / `gitflic cache path`.
export function cachePath() {
  return cacheFile();
}

// Default TTL (for callers that want to know).
export const CACHE_DEFAULT_TTL_MS = DEFAULT_TTL_MS;
