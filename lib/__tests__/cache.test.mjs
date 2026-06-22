import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We don't mock fs; we redirect XDG_CACHE_HOME to a temp dir and clear between
// tests. The implementation reads/writes real files.

let tempDir;
let prevXdg;
let prevNoCache;
let prevHome;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gitflic-cache-"));
  prevXdg = process.env.XDG_CACHE_HOME;
  prevNoCache = process.env.GITFLIC_NO_CACHE;
  prevHome = process.env.HOME;
  process.env.XDG_CACHE_HOME = tempDir;
  delete process.env.GITFLIC_NO_CACHE;
  process.env.HOME = tempDir; // for fallback path
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (prevXdg === undefined) delete process.env.XDG_CACHE_HOME;
  else process.env.XDG_CACHE_HOME = prevXdg;
  if (prevNoCache === undefined) delete process.env.GITFLIC_NO_CACHE;
  else process.env.GITFLIC_NO_CACHE = prevNoCache;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
});

// Import after env is set so cacheFile() resolution at call time works.
async function freshImport() {
  vi.resetModules();
  return await import("../cache.mjs");
}

describe("cache get/set", () => {
  it("returns undefined for missing key", async () => {
    const c = await freshImport();
    expect(c.cacheGet("nope")).toBeUndefined();
  });

  it("stores and retrieves a value", async () => {
    const c = await freshImport();
    c.cacheSet("k", { id: "abc-123" }, 60_000);
    expect(c.cacheGet("k")).toEqual({ id: "abc-123" });
  });

  it("uses default TTL of 1h", async () => {
    const c = await freshImport();
    expect(c.CACHE_DEFAULT_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("expires entries after TTL", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v", 1); // 1ms TTL
    // Sleep 5ms to be safe
    await new Promise((r) => setTimeout(r, 5));
    expect(c.cacheGet("k")).toBeUndefined();
  });

  it("expired entry is also deleted from disk", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v", 1);
    await new Promise((r) => setTimeout(r, 5));
    c.cacheGet("k"); // triggers cleanup
    const file = c.cachePath();
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      expect("k" in parsed).toBe(false);
    }
  });
});

describe("cache isolation", () => {
  it("different keys are independent", async () => {
    const c = await freshImport();
    c.cacheSet("a", 1, 60_000);
    c.cacheSet("b", 2, 60_000);
    expect(c.cacheGet("a")).toBe(1);
    expect(c.cacheGet("b")).toBe(2);
  });

  it("cacheSet overwrites a previous entry", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v1", 60_000);
    c.cacheSet("k", "v2", 60_000);
    expect(c.cacheGet("k")).toBe("v2");
  });
});

describe("cache delete / clear", () => {
  it("delete removes a key", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v", 60_000);
    c.cacheDelete("k");
    expect(c.cacheGet("k")).toBeUndefined();
  });

  it("delete of non-existent key is a no-op", async () => {
    const c = await freshImport();
    expect(() => c.cacheDelete("nope")).not.toThrow();
  });

  it("clear removes the file", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v", 60_000);
    expect(existsSync(c.cachePath())).toBe(true);
    c.cacheClear();
    expect(existsSync(c.cachePath())).toBe(false);
  });

  it("clear when no file is a no-op", async () => {
    const c = await freshImport();
    expect(() => c.cacheClear()).not.toThrow();
  });
});

describe("GITFLIC_NO_CACHE", () => {
  it("set is a no-op when disabled", async () => {
    process.env.GITFLIC_NO_CACHE = "1";
    const c = await freshImport();
    c.cacheSet("k", "v", 60_000);
    expect(c.cacheGet("k")).toBeUndefined();
  });
});

describe("cache file", () => {
  it("is created on first write", async () => {
    const c = await freshImport();
    c.cacheSet("k", "v", 60_000);
    const file = c.cachePath();
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    expect(parsed.k).toBeDefined();
    expect(parsed.k.v).toBe("v");
    expect(typeof parsed.k.e).toBe("number");
  });

  it("survives a corrupted cache file (returns empty)", async () => {
    const c = await freshImport();
    // Force the file (and parent dir) into existence by writing a valid entry first.
    c.cacheSet("seed", "ok", 60_000);
    // Now corrupt it.
    const file = c.cachePath();
    writeFileSync(file, "{not valid json");
    // A read should swallow the parse error and return undefined.
    expect(c.cacheGet("k")).toBeUndefined();
  });
});
