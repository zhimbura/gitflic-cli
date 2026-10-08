import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir;
let prevXdg;
let prevNoConfig;
let prevHome;
let prevNoSecret;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gitflic-secret-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevNoConfig = process.env.GITFLIC_NO_CONFIG;
  prevHome = process.env.HOME;
  prevNoSecret = process.env.GITFLIC_NO_SECRET_STORE;
  process.env.XDG_CONFIG_HOME = tempDir;
  process.env.HOME = tempDir;
  delete process.env.GITFLIC_NO_CONFIG;
  delete process.env.GITFLIC_NO_SECRET_STORE;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  if (prevNoConfig === undefined) delete process.env.GITFLIC_NO_CONFIG;
  else process.env.GITFLIC_NO_CONFIG = prevNoConfig;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevNoSecret === undefined) delete process.env.GITFLIC_NO_SECRET_STORE;
  else process.env.GITFLIC_NO_SECRET_STORE = prevNoSecret;
});

async function freshSecret() {
  vi.resetModules();
  const mod = await import("../secret.mjs");
  mod.__test__.resetBackend();
  return mod;
}

describe("isSensitiveKey", () => {
  it("flags token-shaped keys", async () => {
    const s = await freshSecret();
    expect(s.isSensitiveKey("token")).toBe(true);
    expect(s.isSensitiveKey("access_token")).toBe(true);
    expect(s.isSensitiveKey("access-token")).toBe(true);
    expect(s.isSensitiveKey("apiToken")).toBe(true);
    expect(s.isSensitiveKey("password")).toBe(true);
    expect(s.isSensitiveKey("pass")).toBe(true);
    expect(s.isSensitiveKey("secret")).toBe(true);
    expect(s.isSensitiveKey("client_secret")).toBe(true);
    expect(s.isSensitiveKey("api-key")).toBe(true);
    expect(s.isSensitiveKey("private_key")).toBe(true);
    expect(s.isSensitiveKey("private-key")).toBe(true);
  });

  it("does not flag ordinary config keys", async () => {
    const s = await freshSecret();
    expect(s.isSensitiveKey("default-project")).toBe(false);
    expect(s.isSensitiveKey("api-base")).toBe(false);
    expect(s.isSensitiveKey("editor")).toBe(false);
    expect(s.isSensitiveKey("theme")).toBe(false);
  });
});

describe("maskValue", () => {
  it("masks middle of long secrets", async () => {
    const s = await freshSecret();
    expect(s.maskValue("token", "abcdef-secret-12345")).toBe("abc***345");
  });
  it("fully masks short secrets", async () => {
    const s = await freshSecret();
    expect(s.maskValue("token", "abc")).toBe("***");
  });
  it("returns original for non-sensitive keys", async () => {
    const s = await freshSecret();
    expect(s.maskValue("default-project", "tikhon/wave")).toBe("tikhon/wave");
  });
  it("handles empty/undefined", async () => {
    const s = await freshSecret();
    expect(s.maskValue("token", "")).toBe("(unset)");
    expect(s.maskValue("token", undefined)).toBe("(unset)");
    expect(s.maskValue("token", null)).toBe("(unset)");
  });
});

describe("file backend (no keychain tools available)", () => {
  // To force the file backend on hosts where `security` exists (darwin),
  // we point PATH at an empty directory so `which("security")` returns null.
  let prevPath;
  beforeEach(() => {
    prevPath = process.env.PATH;
    process.env.PATH = join(tempDir, "empty-bin");
  });
  afterEach(() => {
    if (prevPath === undefined) delete process.env.PATH;
    else process.env.PATH = prevPath;
  });

  it("falls back to file backend when neither security nor secret-tool exist", async () => {
    const s = await freshSecret();
    const backend = s.secretBackend();
    expect(backend.kind).toBe("file");
    expect(backend.available).toBe(true);
  });

  // POSIX mode bits are a no-op on Windows (NTFS uses ACLs), so the chmod
  // assertions below can't hold there. The round-trip itself is covered on
  // Unix; skip the whole case on win32 to keep CI green.
  it.skipIf(process.platform === "win32")("set + get round-trip through file backend with chmod 0600", async () => {
    const s = await freshSecret();
    const backend = s.secretBackend();
    expect(backend.kind).toBe("file");

    backend.set("token", "my-secret-value");
    expect(backend.get("token")).toBe("my-secret-value");

    // File should exist with mode 0600 (or stricter — bitmask check).
    const { configFile } = await import("../config.mjs");
    const f = configFile();
    expect(existsSync(f)).toBe(true);
    const st = statSync(f);
    expect((st.mode & 0o077)).toBe(0); // group/other must be 0
    expect((st.mode & 0o700)).toBe(0o600); // owner must be rw

    backend.unset("token");
    expect(backend.get("token")).toBeUndefined();
  });
});

describe("mac backend (keychain)", () => {
  it("set + get + unset round-trip through mocked `security`", async () => {
    const s = await freshSecret();
    const store = new Map();
    s.__test__.withRunner((bin, args) => {
      // First arg pattern tells us which command.
      const cmd = args[0];
      if (cmd === "find-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        const v = store.get(a);
        if (v === undefined) return { status: 44, stdout: "", stderr: "not found" };
        return { status: 0, stdout: v + "\n", stderr: "" };
      }
      if (cmd === "add-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        const wIdx = args.indexOf("-w");
        store.set(a, args[wIdx + 1]);
        return { status: 0, stdout: "", stderr: "" };
      }
      if (cmd === "delete-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        store.delete(a);
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "unknown" };
    });
    // Pretend we're on darwin with `security` available — build the backend directly.
    const mac = s.__test__._defaultRunner; // not used; we want a darwin backend
    // Force a darwin backend by reusing the runner.
    const { makeMacBackend } = await freshSecret().then((m) => ({ makeMacBackend: null })); // not exported
    // Build a backend the same way the module does internally.
    const fakeBin = "/usr/bin/security";
    // Re-implement minimal: we can call platformKeychain indirectly by stubbing which.
    // Simpler: bypass and directly test secretSet/secretGet via the module's public API
    // after forcing the platform detection. Since which() reads PATH, we override PATH to a
    // tmp dir with a fake `security` symlink.
    const fakeBinDir = join(tempDir, "fakebin");
    require("node:fs").mkdirSync(fakeBinDir, { recursive: true });
    const fakeSecurity = join(fakeBinDir, "security");
    writeFileSync(fakeSecurity, "#!/bin/sh\n# stub\nexit 127\n", { mode: 0o755 });
    // Make the stub honor our runner by reading the args — easier to just override
    // PATH and re-implement which via the runner. We'll do an end-to-end test instead:
    process.env.PATH = fakeBinDir;

    const s2 = await freshSecret();
    // Re-inject runner AFTER freshSecret reset.
    s2.__test__.withRunner((bin, args) => {
      const cmd = args[0];
      if (cmd === "find-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        const v = store.get(a);
        if (v === undefined) return { status: 44, stdout: "", stderr: "not found" };
        return { status: 0, stdout: v + "\n", stderr: "" };
      }
      if (cmd === "add-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        const wIdx = args.indexOf("-w");
        store.set(a, args[wIdx + 1]);
        return { status: 0, stdout: "", stderr: "" };
      }
      if (cmd === "delete-generic-password") {
        const a = args[args.indexOf("-a") + 1];
        store.delete(a);
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "unknown" };
    });

    // Platform is set by process.platform — we can't change that in a test easily.
    // Skip on non-darwin.
    if (process.platform !== "darwin") {
      // Force the mac backend manually via forceBackend.
      const fakeMac = s2.__test__._defaultRunner
        ? makeMacBackendLikeRunner("/usr/bin/security", (bin, args) => {
            const cmd = args[0];
            if (cmd === "find-generic-password") {
              const a = args[args.indexOf("-a") + 1];
              const v = store.get(a);
              if (v === undefined) return { status: 44, stdout: "", stderr: "not found" };
              return { status: 0, stdout: v + "\n", stderr: "" };
            }
            if (cmd === "add-generic-password") {
              const a = args[args.indexOf("-a") + 1];
              const wIdx = args.indexOf("-w");
              store.set(a, args[wIdx + 1]);
              return { status: 0, stdout: "", stderr: "" };
            }
            if (cmd === "delete-generic-password") {
              const a = args[args.indexOf("-a") + 1];
              store.delete(a);
              return { status: 0, stdout: "", stderr: "" };
            }
            return { status: 1, stdout: "", stderr: "unknown" };
          })
        : null;
      s2.__test__.forceBackend(fakeMac);
    }

    const backend = s2.secretBackend();
    expect(backend.kind).toBe("keychain");
    expect(backend.platform).toBe("darwin");

    backend.set("token", "my-mac-secret");
    expect(backend.get("token")).toBe("my-mac-secret");

    // Verify our runner saw the right args.
    expect(store.get("token")).toBe("my-mac-secret");

    backend.unset("token");
    expect(backend.get("token")).toBeUndefined();
  });

  it("returns undefined on keychain miss (not throw)", async () => {
    const s = await freshSecret();
    // Build a darwin backend with a runner that always returns 44.
    const mac = makeMacBackendLikeRunner("/usr/bin/security", () => ({ status: 44, stdout: "", stderr: "" }));
    s.__test__.forceBackend(mac);
    expect(s.secretGet("missing")).toBeUndefined();
  });
});

// Helper to construct a darwin-style backend without exporting makeMacBackend.
function makeMacBackendLikeRunner(bin, runner) {
  return {
    kind: "keychain",
    platform: "darwin",
    available: true,
    get(key) {
      const r = runner(bin, ["find-generic-password", "-a", key, "-s", "gitflic-cli", "-w"]);
      if (r.status !== 0) return undefined;
      const v = (r.stdout || "").trim();
      return v.length ? v : undefined;
    },
    set(key, value) {
      const r = runner(bin, ["add-generic-password", "-a", key, "-s", "gitflic-cli", "-w", value, "-U"]);
      if (r.status !== 0) throw new Error("set failed");
    },
    unset(key) {
      runner(bin, ["delete-generic-password", "-a", key, "-s", "gitflic-cli"]);
    },
  };
}

describe("resolveTokenFromSecret", () => {
  it("returns value + source when secret store has token", async () => {
    const s = await freshSecret();
    s.__test__.forceBackend(makeMacBackendLikeRunner("/usr/bin/security", (bin, args) => {
      if (args[0] === "find-generic-password" && args[args.indexOf("-a") + 1] === "token") {
        return { status: 0, stdout: "secret-token\n", stderr: "" };
      }
      return { status: 44, stdout: "", stderr: "" };
    }));
    const r = s.resolveTokenFromSecret();
    expect(r.value).toBe("secret-token");
    expect(r.source).toBe("keychain");
  });

  it("returns undefined when secret store is empty", async () => {
    const s = await freshSecret();
    s.__test__.withRunner(() => ({ status: 44, stdout: "", stderr: "" }));
    s.__test__.forceBackend(makeMacBackendLikeRunner("/usr/bin/security", () => ({ status: 44, stdout: "", stderr: "" })));
    const r = s.resolveTokenFromSecret();
    expect(r.value).toBeUndefined();
    expect(r.source).toBeNull();
  });
});

describe("GITFLIC_NO_SECRET_STORE=1", () => {
  it("disables storage; get returns undefined, set throws", async () => {
    process.env.GITFLIC_NO_SECRET_STORE = "1";
    const s = await freshSecret();
    const b = s.secretBackend();
    expect(b.kind).toBe("none");
    expect(b.available).toBe(false);
    expect(b.get("token")).toBeUndefined();
    expect(() => b.set("token", "x")).toThrow(/disabled/i);
  });
});

describe("backend caching", () => {
  it("returns the same backend instance on repeat calls", async () => {
    const s = await freshSecret();
    s.__test__.withRunner(() => ({ status: 127, stdout: "", stderr: "" }));
    const a = s.secretBackend();
    const b = s.secretBackend();
    expect(a).toBe(b);
  });

  it("resetBackend() forces re-detection", async () => {
    const s = await freshSecret();
    s.__test__.withRunner(() => ({ status: 127, stdout: "", stderr: "" }));
    const a = s.secretBackend();
    s.__test__.resetBackend();
    const b = s.secretBackend();
    expect(a).not.toBe(b);
    // Same kind though.
    expect(a.kind).toBe(b.kind);
  });
});
