import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir;
let prevXdg;
let prevNoConfig;
let prevNoSecret;
let prevHome;
let stdout = [];
let stderr = [];
let exitCode = 0;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gitflic-alias-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevNoConfig = process.env.GITFLIC_NO_CONFIG;
  prevNoSecret = process.env.GITFLIC_NO_SECRET_STORE;
  prevHome = process.env.HOME;
  process.env.XDG_CONFIG_HOME = tempDir;
  process.env.HOME = tempDir;
  delete process.env.GITFLIC_NO_CONFIG;
  delete process.env.GITFLIC_NO_SECRET_STORE;
  // Empty PATH → force file backend.
  process.env.PATH = join(tempDir, "empty-bin");
  stdout = [];
  stderr = [];
  exitCode = 0;
  _mod = null;
  // Capture stdout/stderr without actually exiting the test runner.
  process.stdout.write = (s) => { stdout.push(String(s)); return true; };
  process.stderr.write = (s) => { stderr.push(String(s)); return true; };
  process.exit = (code) => { exitCode = code; throw new Error(`__exit:${code}`); };
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  if (prevNoConfig === undefined) delete process.env.GITFLIC_NO_CONFIG;
  else process.env.GITFLIC_NO_CONFIG = prevNoConfig;
  if (prevNoSecret === undefined) delete process.env.GITFLIC_NO_SECRET_STORE;
  else process.env.GITFLIC_NO_SECRET_STORE = prevNoSecret;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  vi.restoreAllMocks();
});

async function importFresh() {
  vi.resetModules();
  const mod = await import("../cmd/alias.mjs");
  return mod;
}

function captured() {
  return { stdout: stdout.join(""), stderr: stderr.join(""), exitCode };
}

// One module instance per test (state must persist across `run` calls).
let _mod = null;
async function run(args, flags = {}) {
  if (!_mod) _mod = await importFresh();
  // Reset capture buffers.
  stdout = []; stderr = []; exitCode = 0;
  try {
    await _mod.handle({}, args[0], args.slice(1), flags);
  } catch (e) {
    if (!String(e.message).startsWith("__exit:")) throw e;
  }
  return captured();
}

describe("alias list", () => {
  it("shows empty-state hint when nothing is set", async () => {
    const r = await run(["list"]);
    expect(r.stdout).toMatch(/no keys set/);
  });

  it("masks sensitive keys in listing", async () => {
    await run(["set", "token", "very-secret-token-12345"]);
    const r = await run(["list"]);
    expect(r.stdout).toMatch(/token = v.*\*.*5/); // masked
    expect(r.stdout).not.toContain("very-secret-token-12345");
    expect(r.stdout).toMatch(/token backend: file/);
  });

  it("does not mask non-sensitive keys", async () => {
    await run(["set", "default-project", "tikhon/wave"]);
    const r = await run(["list"]);
    expect(r.stdout).toMatch(/default-project = tikhon\/wave/);
  });
});

describe("alias get", () => {
  it("masks sensitive values without --reveal", async () => {
    await run(["set", "token", "abcdef-secret-9999"]);
    const r = await run(["get", "token"]);
    expect(r.stdout).toMatch(/abc.*\*.*999/);
    expect(r.stdout).not.toContain("abcdef-secret-9999");
    expect(r.stderr).toMatch(/--reveal/);
  });

  it("prints full value with --reveal", async () => {
    await run(["set", "token", "abcdef-secret-9999"]);
    const r = await run(["get", "token"], { reveal: true });
    expect(r.stdout).toContain("abcdef-secret-9999");
    expect(r.stderr).not.toMatch(/masked/);
  });

  it("prints non-sensitive values plainly", async () => {
    await run(["set", "default-project", "tikhon/wave"]);
    const r = await run(["get", "default-project"]);
    expect(r.stdout).toContain("tikhon/wave");
  });

  it("exits 1 for missing keys", async () => {
    const r = await run(["get", "nope"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/not set/);
  });
});

describe("alias set", () => {
  it("stores non-sensitive keys in file", async () => {
    const r = await run(["set", "default-project", "tikhon/wave"]);
    expect(r.stdout).toMatch(/default-project set \(backend: file\)/);
  });

  it("stores sensitive keys in secret backend (file here)", async () => {
    const r = await run(["set", "api-key", "sk-1234567890"]);
    expect(r.stdout).toMatch(/api-key set \(backend: file\)/);
    expect(r.stdout).not.toContain("sk-1234567890");
  });

  it("exits 2 when args missing", async () => {
    const r = await run(["set", "only-key"]);
    expect(r.exitCode).toBe(2);
  });
});

describe("alias unset", () => {
  it("removes from both stores (idempotent)", async () => {
    await run(["set", "token", "abc"]);
    const r = await run(["unset", "token"]);
    expect(r.stdout).toMatch(/token removed/);
    // Setting it again should not find leftover in either store.
    const r2 = await run(["get", "token"]);
    expect(r2.exitCode).toBe(1);
  });
});

describe("alias info", () => {
  it("prints backend info", async () => {
    const r = await run(["info"]);
    expect(r.stdout).toMatch(/secret store: file/);
    expect(r.stdout).toMatch(/token:/);
    expect(r.stdout).toMatch(/GITFLIC_NO_SECRET_STORE=1/);
  });
});
