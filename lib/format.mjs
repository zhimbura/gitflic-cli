// Shared formatting helpers + pretty printers used by every command module.

export function color(s, code) {
  if (!process.stdout.isTTY) return s;
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