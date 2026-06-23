// Tool selection for the MCP server.
//
// Lets users scope WHICH of the tools get registered, to keep the model's
// context small (the full catalog costs ~6K tokens before the first call).
// All config is via environment variables — see README "Ограничение набора
// тулзов (экономия контекста)".
//
// Env vars (all optional; default = register everything):
//   GITFLIC_MCP_GROUPS    comma/space list of groups, e.g. "mr,issue"
//   GITFLIC_MCP_READONLY  "1"/"true"/"yes"/"on" → only read-only tools
//   GITFLIC_MCP_TOOLS     comma/space list of exact tool names (allowlist)
//   GITFLIC_MCP_EXCLUDE   comma/space list of exact tool names to drop
//
// Pure + testable: selectTools() takes an explicit env object, so tests never
// touch process.env.

// Derive the group of a tool from its name: gitflic_<group>_<action>.
// e.g. gitflic_mr_create → "mr", gitflic_branch_protection_list → "branch".
export function toolGroup(name) {
  return name.replace(/^gitflic_/, "").split("_")[0];
}

// All distinct groups present in the catalog, sorted.
export function groupsOf(tools) {
  return [...new Set(tools.map((t) => toolGroup(t.name)))].sort();
}

// A tool is read-only iff its annotations say so.
export function isReadOnly(tool) {
  return Boolean(tool.annotations && tool.annotations.readOnlyHint === true);
}

// Parse a comma/space-separated env value into a clean array.
function parseList(value, { lower = false } = {}) {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (lower ? s.toLowerCase() : s));
}

const TRUTHY = ["1", "true", "yes", "on"];
const FALSEY = ["0", "false", "no", "off", ""];

// Truthy env flag: "1", "true", "yes", "on" (case-insensitive). Anything
// else (including "0", "false", "", undefined) is falsey.
function isTruthy(value) {
  if (value == null) return false;
  return TRUTHY.includes(String(value).trim().toLowerCase());
}

// Select which tools to register based on env config.
//
// Precedence:
//   1. Base set:
//        - GITFLIC_MCP_TOOLS (explicit allowlist), if set; else
//        - GITFLIC_MCP_GROUPS (by group), if set; else
//        - all tools.
//   2. GITFLIC_MCP_READONLY truthy → keep only read-only tools (overlay).
//   3. GITFLIC_MCP_EXCLUDE → drop named tools (applied last, always wins).
//
// Returns { selected, warnings } — warnings are human-readable strings the
// caller prints to stderr. Unknown names/groups are warned about, not fatal.
export function selectTools(tools, env = {}) {
  const warnings = [];
  const allGroups = groupsOf(tools);
  const byName = new Map(tools.map((t) => [t.name, t]));

  // Tool names are all lowercase, so match TOOLS/EXCLUDE case-insensitively
  // too (consistent with GROUPS). Otherwise a mis-cased EXCLUDE of a write
  // tool would silently keep it registered.
  const wantTools = parseList(env.GITFLIC_MCP_TOOLS, { lower: true });
  const wantGroups = parseList(env.GITFLIC_MCP_GROUPS, { lower: true });
  const exclude = parseList(env.GITFLIC_MCP_EXCLUDE, { lower: true });

  const readonlyRaw = env.GITFLIC_MCP_READONLY;
  const readonly = isTruthy(readonlyRaw);
  if (readonlyRaw != null) {
    const v = String(readonlyRaw).trim().toLowerCase();
    if (v !== "" && !TRUTHY.includes(v) && !FALSEY.includes(v)) {
      warnings.push(
        `GITFLIC_MCP_READONLY="${readonlyRaw}" is not a recognized boolean (use 1/true/yes/on); treating as off.`,
      );
    }
  }

  let base;
  if (wantTools.length) {
    if (wantGroups.length) {
      warnings.push(
        "GITFLIC_MCP_TOOLS is set, so GITFLIC_MCP_GROUPS is ignored (explicit tool list wins).",
      );
    }
    for (const n of wantTools) {
      if (!byName.has(n)) {
        warnings.push(`GITFLIC_MCP_TOOLS: unknown tool "${n}" (ignored).`);
      }
    }
    base = tools.filter((t) => wantTools.includes(t.name));
  } else if (wantGroups.length) {
    for (const g of wantGroups) {
      if (!allGroups.includes(g)) {
        warnings.push(
          `GITFLIC_MCP_GROUPS: unknown group "${g}" (ignored). Valid groups: ${allGroups.join(", ")}.`,
        );
      }
    }
    base = tools.filter((t) => wantGroups.includes(toolGroup(t.name)));
  } else {
    base = tools.slice();
  }

  if (readonly) {
    const before = base.length;
    base = base.filter(isReadOnly);
    if (before > 0 && base.length === 0) {
      warnings.push(
        "GITFLIC_MCP_READONLY removed every selected tool (the selection contained only write tools).",
      );
    }
  }

  if (exclude.length) {
    for (const n of exclude) {
      if (!byName.has(n)) {
        warnings.push(`GITFLIC_MCP_EXCLUDE: unknown tool "${n}" (ignored).`);
      }
    }
    base = base.filter((t) => !exclude.includes(t.name));
  }

  if (base.length === 0) {
    warnings.push(
      "Tool filter matched 0 tools — the server will start with no tools registered. Check your GITFLIC_MCP_* settings.",
    );
  }

  return { selected: base, warnings };
}
