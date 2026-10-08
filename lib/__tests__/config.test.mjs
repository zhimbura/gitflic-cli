import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

let tempDir;
let prevXdg;
let prevNoConfig;
let prevHome;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gitflic-config-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevNoConfig = process.env.GITFLIC_NO_CONFIG;
  prevHome = process.env.HOME;
  process.env.XDG_CONFIG_HOME = tempDir;
  process.env.HOME = tempDir;
  delete process.env.GITFLIC_NO_CONFIG;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  if (prevNoConfig === undefined) delete process.env.GITFLIC_NO_CONFIG;
  else process.env.GITFLIC_NO_CONFIG = prevNoConfig;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
});

async function freshImport() {
  vi.resetModules();
  return await import("../config.mjs");
}

describe("config location", () => {
  it("uses XDG_CONFIG_HOME when set", async () => {
    const c = await freshImport();
    expect(c.configFile()).toBe(join(tempDir, "gitflic-cli", "config.json"));
  });

  // Windows has no HOME: the old `process.env.HOME || "~"` produced a relative
  // "~/.config" directory in the current folder. os.homedir() resolves it on every OS.
  it("falls back to os.homedir()/.config when XDG_CONFIG_HOME is unset", async () => {
    delete process.env.XDG_CONFIG_HOME;
    const c = await freshImport();
    expect(c.configFile()).toBe(join(homedir(), ".config", "gitflic-cli", "config.json"));
  });
});

describe("config get/set", () => {
  it("returns undefined for missing key", async () => {
    const c = await freshImport();
    expect(c.configGet("nope")).toBeUndefined();
  });

  it("stores and retrieves a value", async () => {
    const c = await freshImport();
    c.configSet("k", "v");
    expect(c.configGet("k")).toBe("v");
  });

  it("overwrites a previous value", async () => {
    const c = await freshImport();
    c.configSet("k", "v1");
    c.configSet("k", "v2");
    expect(c.configGet("k")).toBe("v2");
  });

  it("supports any JSON-serializable value", async () => {
    const c = await freshImport();
    c.configSet("obj", { foo: "bar", n: 42 });
    expect(c.configGet("obj")).toEqual({ foo: "bar", n: 42 });
  });
});

describe("config list", () => {
  it("returns all keys", async () => {
    const c = await freshImport();
    c.configSet("a", 1);
    c.configSet("b", 2);
    expect(c.configList()).toEqual({ a: 1, b: 2 });
  });

  it("returns empty object when no config exists", async () => {
    const c = await freshImport();
    expect(c.configList()).toEqual({});
  });
});

describe("config delete / clear", () => {
  it("delete removes a key", async () => {
    const c = await freshImport();
    c.configSet("k", "v");
    c.configDelete("k");
    expect(c.configGet("k")).toBeUndefined();
  });

  it("clear removes the whole file", async () => {
    const c = await freshImport();
    c.configSet("k", "v");
    expect(existsSync(c.configPath())).toBe(true);
    c.configClear();
    expect(existsSync(c.configPath())).toBe(false);
  });
});

describe("GITFLIC_NO_CONFIG", () => {
  it("set is a no-op when disabled", async () => {
    process.env.GITFLIC_NO_CONFIG = "1";
    const c = await freshImport();
    c.configSet("k", "v");
    expect(c.configGet("k")).toBeUndefined();
  });
});
