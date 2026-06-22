// Shared formatting helpers + pretty printers used by every command module.

import { envFlag } from "./http.mjs";

// Whether ANSI color codes are emitted. Resolved lazily and mutable via
// setColorEnabled() so main() can pick up --color / --no-color flags.
let _useColor = null;

function detectColor() {
  // Per https://no-color.org/ — any value, including "0" or "false",
  // disables color. The only way to opt in is absence of the var.
  if (envFlag("NO_COLOR") !== undefined) return false;
  if (envFlag("FORCE_COLOR") !== undefined) return true;
  return Boolean(process.stdout.isTTY);
}

export function shouldUseColor() {
  if (_useColor === null) _useColor = detectColor();
  return _useColor;
}

export function setColorEnabled(v) {
  // null/undefined -> lazy re-detect on next shouldUseColor() call
  if (v === null || v === undefined) {
    _useColor = null;
  } else {
    _useColor = !!v;
  }
}

export function color(s, code) {
  if (!shouldUseColor()) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}

export function short(s, n = 60) {
  if (!s) return "";
  const oneLine = s.replace(/\n/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
}

export function die(msg, code = 1) {
  process.stderr.write(`gitflic: ${msg}\n`);
  process.exit(code);
}

export function resolveFormat(flags, defaultPretty) {
  if (flags.format === "json") return "json";
  if (flags.format === "pretty") return "pretty";
  return defaultPretty ? "pretty" : "json";
}

export function statusColor(s) {
  const c = s?.color;
  if (c === "success") return "\x1b[32m";
  if (c === "warning") return "\x1b[33m";
  if (c === "danger") return "\x1b[31m";
  if (c === "info") return "\x1b[36m";
  return "\x1b[0m";
}

export function printJson(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printEmpty(label) {
  process.stdout.write(`(no ${label})\n`);
}

export function urlProject(api, owner, alias) {
  return `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}`;
}