import { describe, it, expect } from "vitest";
import { TOOLS } from "../tools.mjs";
import { selectTools } from "../filter.mjs";
import { parseMcpArgs, usageText } from "../args.mjs";

// A fixed base env: parseMcpArgs must copy it and only override flag targets.
const BASE = {
  GITFLIC_TOKEN: "tok",
  GITFLIC_MCP_RAW: "1",
  GITFLIC_MCP_TOOLS: "gitflic_mr_list",
};

describe("parseMcpArgs: defaults", () => {
  it("returns a copy of env with no overrides on empty argv", () => {
    const { env, warnings, help } = parseMcpArgs([], BASE);
    expect(help).toBe(false);
    expect(warnings).toEqual([]);
    expect(env).toEqual(BASE);
    // The result must be a fresh object, not the same reference.
    expect(env).not.toBe(BASE);
  });

  it("defaults argv to process.argv.slice(2) and env to process.env", () => {
    const { env, warnings, help } = parseMcpArgs(process.argv.slice(2), process.env);
    expect(help).toBe(false);
    expect(warnings).toEqual([]);
    expect(env).toEqual(process.env);
  });
});

describe("parseMcpArgs: --output", () => {
  it("accepts the space form and normalizes case", () => {
    const { env, warnings } = parseMcpArgs(["--output", "FULL"], BASE);
    expect(env.GITFLIC_MCP_OUTPUT).toBe("full");
    expect(warnings).toEqual([]);
  });

  it("accepts the = form, including the raw alias", () => {
    expect(parseMcpArgs(["--output=slim"], {}).env.GITFLIC_MCP_OUTPUT).toBe("slim");
    expect(parseMcpArgs(["--output=raw"], {}).env.GITFLIC_MCP_OUTPUT).toBe("raw");
  });

  it("silences the GITFLIC_MCP_RAW env alias (RAW would beat OUTPUT otherwise)", () => {
    // BASE has GITFLIC_MCP_RAW=1; without the silencing, slim.mjs would
    // ignore --output and always return "full".
    const { env } = parseMcpArgs(["--output", "slim"], BASE);
    expect(env.GITFLIC_MCP_OUTPUT).toBe("slim");
    expect(env.GITFLIC_MCP_RAW).toBe("");
  });

  it("warns on an invalid value and leaves env untouched", () => {
    const { env, warnings } = parseMcpArgs(["--output", "compact"], BASE);
    expect(env.GITFLIC_MCP_OUTPUT).toBeUndefined();
    expect(env.GITFLIC_MCP_RAW).toBe("1"); // env alias survives
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/--output/);
    expect(warnings[0]).toMatch(/slim\|full\|raw/);
  });

  it("warns when the value is missing", () => {
    for (const argv of [["--output"], ["--output", "--readonly"]]) {
      const { warnings } = parseMcpArgs(argv, {});
      expect(warnings.some((w) => /--output requires a value/.test(w))).toBe(true);
    }
  });
});

describe("parseMcpArgs: --groups", () => {
  it("accepts comma lists in both forms", () => {
    expect(parseMcpArgs(["--groups", "mr,issue"], {}).env.GITFLIC_MCP_GROUPS).toBe("mr,issue");
    expect(parseMcpArgs(["--groups=webhook"], {}).env.GITFLIC_MCP_GROUPS).toBe("webhook");
  });

  it("warns when the value is missing", () => {
    const { warnings } = parseMcpArgs(["--groups"], {});
    expect(warnings.some((w) => /--groups requires a value/.test(w))).toBe(true);
  });

  it("lets the last occurrence win", () => {
    const { env } = parseMcpArgs(["--groups", "mr", "--groups", "issue"], {});
    expect(env.GITFLIC_MCP_GROUPS).toBe("issue");
  });
});

describe("parseMcpArgs: boolean flags", () => {
  it("bare --readonly / --no-destructive mean true", () => {
    const { env, warnings } = parseMcpArgs(["--readonly", "--no-destructive"], {});
    expect(env.GITFLIC_MCP_READONLY).toBe("1");
    expect(env.GITFLIC_MCP_NO_DESTRUCTIVE).toBe("1");
    expect(warnings).toEqual([]);
  });

  it("explicit =false turns them off (and beats env)", () => {
    const env0 = { GITFLIC_MCP_READONLY: "1" };
    const { env } = parseMcpArgs(["--readonly=false"], env0);
    expect(env.GITFLIC_MCP_READONLY).toBe("0");
    expect(parseMcpArgs(["--no-destructive=0"], {}).env.GITFLIC_MCP_NO_DESTRUCTIVE).toBe("0");
  });

  it("accepts all truthy/falsy spellings", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE", "On"]) {
      expect(parseMcpArgs([`--readonly=${v}`], {}).env.GITFLIC_MCP_READONLY).toBe("1");
    }
    for (const v of ["0", "false", "no", "off"]) {
      expect(parseMcpArgs([`--readonly=${v}`], {}).env.GITFLIC_MCP_READONLY).toBe("0");
    }
  });

  it("warns on an unrecognized boolean value", () => {
    const { warnings } = parseMcpArgs(["--readonly=enabled"], {});
    expect(warnings.some((w) => /--readonly/.test(w) && /boolean/.test(w))).toBe(true);
  });

  it("a space-form value after a boolean is a positional, not the value", () => {
    // Booleans only take explicit values via "="; "--readonly false" must not
    // silently become false.
    const { env, warnings } = parseMcpArgs(["--readonly", "false"], {});
    expect(env.GITFLIC_MCP_READONLY).toBe("1");
    expect(warnings.some((w) => /positional/.test(w))).toBe(true);
  });
});

describe("parseMcpArgs: help and junk", () => {
  it("flags --help and -h", () => {
    expect(parseMcpArgs(["--help"], {}).help).toBe(true);
    expect(parseMcpArgs(["-h"], {}).help).toBe(true);
  });

  it("collects other flags in the same run", () => {
    const { env, help } = parseMcpArgs(["--help", "--groups", "mr"], {});
    expect(help).toBe(true);
    expect(env.GITFLIC_MCP_GROUPS).toBe("mr");
  });

  it("warns on unknown options and positionals without crashing", () => {
    const { warnings } = parseMcpArgs(["--wat", "positional"], {});
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/Unknown option "--wat"/);
    expect(warnings[1]).toMatch(/positional/);
  });
});

describe("parseMcpArgs: precedence", () => {
  it("a flag wins over the same-named env var", () => {
    const env0 = { GITFLIC_MCP_GROUPS: "project", GITFLIC_MCP_READONLY: "1" };
    const { env } = parseMcpArgs(["--groups", "mr", "--readonly=false"], env0);
    expect(env.GITFLIC_MCP_GROUPS).toBe("mr");
    expect(env.GITFLIC_MCP_READONLY).toBe("0");
  });

  it("env vars the flags don't touch pass through unchanged", () => {
    const { env } = parseMcpArgs(["--groups", "mr"], BASE);
    expect(env.GITFLIC_TOKEN).toBe("tok");
    expect(env.GITFLIC_MCP_TOOLS).toBe("gitflic_mr_list");
  });

  it("unrelated env vars stay intact alongside a silenced RAW alias", () => {
    const { env } = parseMcpArgs(["--output", "full"], BASE);
    expect(env).toEqual({ ...BASE, GITFLIC_MCP_OUTPUT: "full", GITFLIC_MCP_RAW: "" });
  });
});

describe("parseMcpArgs: end-to-end with selectTools", () => {
  it("flags scope the catalog exactly like their env twins", () => {
    const viaEnv = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr,issue", GITFLIC_MCP_READONLY: "1" });
    const { env } = parseMcpArgs(["--groups", "mr,issue", "--readonly"], {});
    const viaFlags = selectTools(TOOLS, env);
    expect(viaFlags.selected).toEqual(viaEnv.selected);
    expect(viaFlags.selected.length).toBeGreaterThan(0);
    expect(viaFlags.selected.every((t) => t.annotations?.readOnlyHint === true));
    expect(viaFlags.selected.every((t) => t.name.startsWith("gitflic_mr_") || t.name.startsWith("gitflic_issue_")));
  });

  it("--no-destructive drops the *_delete tools", () => {
    const { env } = parseMcpArgs(["--no-destructive"], {});
    const { selected } = selectTools(TOOLS, env);
    expect(selected.every((t) => !/_delete$/.test(t.name))).toBe(true);
  });
});

describe("usageText", () => {
  it("documents every supported flag", () => {
    for (const flag of ["--output", "--groups", "--readonly", "--no-destructive", "--help"]) {
      expect(usageText()).toContain(flag);
    }
  });
});
