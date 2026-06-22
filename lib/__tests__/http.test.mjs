// Smoke test — verifies parseArgs behavior, the most-stable public helper.
// This is a placeholder for the actual test suite that will be added per feature.
import { describe, it, expect } from "vitest";
import { parseArgs } from "../http.mjs";

describe("parseArgs (smoke)", () => {
  it("parses positional args", () => {
    const r = parseArgs(["mr", "list"]);
    expect(r._).toEqual(["mr", "list"]);
    expect(r.flags).toEqual({});
  });

  it("parses --key value", () => {
    const r = parseArgs(["mr", "create", "--title", "Fix login", "--to", "main"]);
    expect(r._).toEqual(["mr", "create"]);
    expect(r.flags.title).toBe("Fix login");
    expect(r.flags.to).toBe("main");
  });

  it("--json sets format=json", () => {
    const r = parseArgs(["mr", "list", "--json"]);
    expect(r.flags.format).toBe("json");
  });

  it("boolean flags", () => {
    const r = parseArgs(["mr", "merge", "42", "--squash", "--no-remove-branch"]);
    expect(r.flags.squash).toBe(true);
    expect(r.flags.removeBranch).toBe(false);
  });

  it("--help short and long", () => {
    expect(parseArgs(["-h"]).flags.help).toBe(true);
    expect(parseArgs(["mr", "--help"]).flags.help).toBe(true);
  });
});
