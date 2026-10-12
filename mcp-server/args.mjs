// CLI flags for the MCP server.
//
// server.mjs historically took ALL configuration from GITFLIC_MCP_* env vars
// (see filter.mjs / slim.mjs). Env works fine for MCP hosts (they have an env
// block), but is awkward for ad-hoc runs from a shell. These flags duplicate
// the most common env vars — when a flag is given, it wins over the env var:
//
//   --output <slim|full|raw>   GITFLIC_MCP_OUTPUT (also silences GITFLIC_MCP_RAW)
//   --groups <list>            GITFLIC_MCP_GROUPS            (comma/space list)
//   --readonly                 GITFLIC_MCP_READONLY          (only read-only tools)
//   --no-destructive           GITFLIC_MCP_NO_DESTRUCTIVE    (drop *_delete tools)
//   --help / -h                print usage to stderr and exit 0
//
// Both `--flag value` and `--flag=value` forms are supported. Booleans accept
// an explicit `=false` (`--readonly=false`); a bare `--readonly` means true.
//
// Pure + testable: takes explicit argv/env, never reads process.argv or
// process.env on its own. Everything is advisory: unknown flags and bad values
// produce warnings (server.mjs prints them to stderr), never a crash — same
// policy as selectTools() in filter.mjs. The merged env object is what
// server.mjs feeds to selectTools() and slimResult(), so filter.mjs and
// slim.mjs stay untouched.

const OUTPUT_VALUES = ["slim", "full", "raw"];
const TRUTHY = ["1", "true", "yes", "on"];
const FALSEY = ["0", "false", "no", "off"];

// Flags that take a value (the `--flag value` / `--flag=value` forms).
const VALUE_FLAGS = new Set(["output", "groups"]);
// Flags that are boolean: bare `--flag` → "1", `--flag=false` → "0".
const BOOL_FLAGS = new Set(["readonly", "no-destructive"]);

// The env var a boolean flag maps to.
const BOOL_ENV = {
  readonly: "GITFLIC_MCP_READONLY",
  "no-destructive": "GITFLIC_MCP_NO_DESTRUCTIVE",
};

export function usageText() {
  return `gitflic-mcp — MCP server wrapping the gitflic CLI (stdio).

Usage: gitflic-mcp [options]

Options:
  --output <slim|full|raw>  Response shaping: slim (default) or full/raw = the
                            raw API answer. Duplicates GITFLIC_MCP_OUTPUT
                            (and overrides the GITFLIC_MCP_RAW env alias).
  --groups <list>           Register only tools of these groups (comma or
                            space separated), e.g. --groups "mr,issue".
                            Duplicates GITFLIC_MCP_GROUPS.
  --readonly                Register read-only tools only. Duplicates
                            GITFLIC_MCP_READONLY.
  --no-destructive          Drop *_delete tools. Duplicates
                            GITFLIC_MCP_NO_DESTRUCTIVE.
  --help / -h               This help (stderr; stdout is reserved for JSON-RPC).

Both "--flag value" and "--flag=value" work; booleans accept an explicit
"--readonly=false". Flags win over the same-named GITFLIC_MCP_* env vars;
everything else (GITFLIC_TOKEN, GITFLIC_API_BASE, GITFLIC_MCP_TOOLS,
GITFLIC_MCP_EXCLUDE, GITFLIC_MCP_RAW) is env-only. Full reference:
mcp-server/README.md.
`;
}

// Map a boolean-ish CLI value to "1"/"0"; null when unrecognized.
function normalizeBool(v) {
  const s = String(v).trim().toLowerCase();
  if (TRUTHY.includes(s)) return "1";
  if (FALSEY.includes(s)) return "0";
  return null;
}

// Parse the MCP server's own CLI flags and merge them over the env.
//
// Returns { env, warnings, help }:
//   env       — a fresh object: all of `env` plus flag overrides (flags win).
//   warnings  — human-readable strings; server.mjs prints them to stderr.
//   help      — true when --help/-h was present.
export function parseMcpArgs(argv = process.argv.slice(2), env = process.env) {
  const warnings = [];
  const overrides = {};
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    // Positionals have no meaning for a stdio MCP server — warn, don't crash.
    if (!token.startsWith("-")) {
      warnings.push(`Unexpected positional argument "${token}" (ignored).`);
      continue;
    }

    if (token === "-h" || token === "--help") {
      help = true;
      continue;
    }

    // Split the `--flag=value` form; value stays undefined for plain `--flag`.
    let name = token.replace(/^--?/, "");
    let value;
    const eq = name.indexOf("=");
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    name = name.toLowerCase();

    if (VALUE_FLAGS.has(name)) {
      // `--flag value` form: consume the next token unless it's another flag.
      if (value === undefined) {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          value = next;
          i++;
        }
      }
      if (value === undefined || value.trim() === "") {
        warnings.push(`--${name} requires a value (ignored).`);
        continue;
      }
      if (name === "output") {
        const v = value.trim().toLowerCase();
        if (!OUTPUT_VALUES.includes(v)) {
          warnings.push(
            `--output: expected slim|full|raw, got "${value}" (ignored).`,
          );
          continue;
        }
        // Flags are the topmost layer: an explicit --output must not be
        // silently defeated by the GITFLIC_MCP_RAW env alias (which wins over
        // GITFLIC_MCP_OUTPUT inside slim.mjs). Empty string = falsy there.
        overrides.GITFLIC_MCP_OUTPUT = v;
        overrides.GITFLIC_MCP_RAW = "";
      } else {
        // Groups go through as-is: filter.mjs normalizes case and separators.
        overrides.GITFLIC_MCP_GROUPS = value.trim();
      }
      continue;
    }

    if (BOOL_FLAGS.has(name)) {
      if (value === undefined) {
        overrides[BOOL_ENV[name]] = "1";
        continue;
      }
      const v = normalizeBool(value);
      if (v === null) {
        warnings.push(
          `--${name}: expected a boolean (1/true/yes/on or 0/false/no/off), got "${value}" (ignored).`,
        );
        continue;
      }
      overrides[BOOL_ENV[name]] = v;
      continue;
    }

    warnings.push(
      `Unknown option "${token}" (ignored). Supported: --output, --groups, --readonly, --no-destructive, --help.`,
    );
  }

  return { env: { ...env, ...overrides }, warnings, help };
}
