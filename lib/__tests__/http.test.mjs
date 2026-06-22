// Smoke test — verifies parseArgs behavior, the most-stable public helper.
// This is a placeholder for the actual test suite that will be added per feature.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// die() must throw, not exit.
vi.mock("../format.mjs", () => ({
  die: (msg) => {
    const e = new Error(typeof msg === "string" ? msg : String(msg));
    e.name = "DieError";
    throw e;
  },
  printJson: () => {},
  printEmpty: () => {},
  color: () => "",
  resolveFormat: () => "pretty",
  shouldUseColor: () => false,
  setColorEnabled: () => {},
  statusColor: (s) => s,
}));

import { parseArgs, resolveToken } from "../http.mjs";

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

describe("resolveToken precedence", () => {
  let tempDir, prevXdg, prevHome, prevNoSecret, prevPath;
  let stderrBuf;
  beforeEach(() => {
    vi.resetModules();
    tempDir = mkdtempSync(join(tmpdir(), "gitflic-rt-"));
    prevXdg = process.env.XDG_CONFIG_HOME;
    prevHome = process.env.HOME;
    prevNoSecret = process.env.GITFLIC_NO_SECRET_STORE;
    prevPath = process.env.PATH;
    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.HOME = tempDir;
    process.env.PATH = join(tempDir, "empty-bin"); // force file backend
    delete process.env.GITFLIC_NO_SECRET_STORE;
    delete process.env.GITFLIC_TOKEN;
    stderrBuf = [];
    process.stderr.write = (s) => { stderrBuf.push(String(s)); return true; };
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevNoSecret === undefined) delete process.env.GITFLIC_NO_SECRET_STORE;
    else process.env.GITFLIC_NO_SECRET_STORE = prevNoSecret;
    if (prevPath === undefined) delete process.env.PATH;
    else process.env.PATH = prevPath;
  });

  async function fresh() {
    vi.resetModules();
    return await import("../http.mjs");
  }

  it("--token flag wins over everything", async () => {
    const { secretSet } = await import("../secret.mjs");
    secretSet("token", "file-tok");
    const h = await fresh();
    expect(h.resolveToken({ token: "flag-tok", project: "x/y" })).toBe("flag-tok");
  });

  it("env GITFLIC_TOKEN beats secret store", async () => {
    process.env.GITFLIC_TOKEN = "env-tok";
    const { secretSet } = await import("../secret.mjs");
    secretSet("token", "file-tok");
    const h = await fresh();
    expect(h.resolveToken({ project: "x/y" })).toBe("env-tok");
  });

  it("per-project binding beats active-account", async () => {
    const { secretSet } = await import("../secret.mjs");
    const { configSet } = await import("../config.mjs");
    secretSet("token", "default-tok");
    secretSet("token:work", "work-tok");
    configSet("active-account", "default");
    configSet("account-bind:FerdBur/wave", "work");
    const h = await fresh();
    expect(h.resolveToken({ project: "FerdBur/wave" })).toBe("work-tok");
  });

  it("falls back to active-account when no binding for project", async () => {
    const { secretSet } = await import("../secret.mjs");
    const { configSet } = await import("../config.mjs");
    secretSet("token:work", "work-tok");
    configSet("active-account", "work");
    const h = await fresh();
    expect(h.resolveToken({ project: "unbound/project" })).toBe("work-tok");
  });

  it("falls back to legacy 'token' key when no active-account", async () => {
    const { secretSet } = await import("../secret.mjs");
    secretSet("token", "legacy-tok");
    const h = await fresh();
    expect(h.resolveToken({ project: "any/proj" })).toBe("legacy-tok");
  });

  it("warns + falls through when binding points at account with no token", async () => {
    const { secretSet } = await import("../secret.mjs");
    const { configSet } = await import("../config.mjs");
    secretSet("token", "default-tok"); // active would be this
    configSet("account-bind:FerdBur/wave", "ghost"); // ghost has no token
    const h = await fresh();
    expect(h.resolveToken({ project: "FerdBur/wave" })).toBe("default-tok");
    expect(stderrBuf.join("")).toMatch(/bound to account 'ghost'/);
    expect(stderrBuf.join("")).toMatch(/gitflic auth login --as ghost/);
  });

  it("dies with helpful message when nothing is stored", async () => {
    const h = await fresh();
    expect(() => h.resolveToken({ project: "any/proj" })).toThrow(/no token/);
  });
});
