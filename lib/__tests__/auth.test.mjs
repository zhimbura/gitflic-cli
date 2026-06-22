import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Capture die() so it throws instead of exiting the test runner.
vi.mock("../format.mjs", () => ({
  die: (msg) => {
    const e = new Error(typeof msg === "string" ? msg : String(msg));
    e.name = "DieError";
    throw e;
  },
  // Other format helpers are unused by auth.mjs but may be transitively imported.
  printJson: () => {},
}));

// auth.mjs uses globalThis.fetch directly for validation/status (NOT http.mjs,
// because http.mjs calls die() which exits the process). Mock fetch here.
// resolveApiBase / resolveToken / parseArgs from http.mjs are used as-is.

// Helper: build a fake Response for fetch mocks.
function fakeRes(status, body = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => (body == null ? "" : typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  };
}

// Mock fetch — auth.mjs uses it directly.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

let tempDir;
let prevXdg;
let prevNoConfig;
let prevNoSecret;
let prevHome;
let prevPath;
let stdoutBuf;
let stderrBuf;
let exitCode;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gitflic-auth-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevNoConfig = process.env.GITFLIC_NO_CONFIG;
  prevNoSecret = process.env.GITFLIC_NO_SECRET_STORE;
  prevHome = process.env.HOME;
  prevPath = process.env.PATH;
  process.env.XDG_CONFIG_HOME = tempDir;
  process.env.HOME = tempDir;
  process.env.PATH = join(tempDir, "empty-bin"); // force file backend
  delete process.env.GITFLIC_NO_CONFIG;
  delete process.env.GITFLIC_NO_SECRET_STORE;
  delete process.env.GITFLIC_TOKEN;
  stdoutBuf = []; stderrBuf = []; exitCode = 0;
  process.stdout.write = (s) => { stdoutBuf.push(String(s)); return true; };
  process.stderr.write = (s) => { stderrBuf.push(String(s)); return true; };
  process.exit = (c) => { exitCode = c; throw new Error(`__exit:${c}`); };
  fetchMock.mockReset();
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
  if (prevPath === undefined) delete process.env.PATH;
  else process.env.PATH = prevPath;
});

async function importAuth() {
  vi.resetModules();
  return await import("../cmd/auth.mjs");
}

function captured() {
  return { stdout: stdoutBuf.join(""), stderr: stderrBuf.join(""), exitCode };
}

async function run(authMod, sub, args, flags = {}, ctx = {}) {
  stdoutBuf = []; stderrBuf = []; exitCode = 0;
  try {
    await authMod.handle(ctx, sub, args, flags);
  } catch (e) {
    if (!String(e.message || "").startsWith("__exit:")) throw e;
  }
  return captured();
}

describe("auth login", () => {
  it("stores token after /user/me returns 200", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "tikhon", email: "t@example.com" }));
    const auth = await importAuth();
    const r = await run(auth, "login", [], { token: "valid-tok-1234567890" });
    expect(r.stdout).toMatch(/logged in as tikhon/);
    expect(r.stdout).toMatch(/account: default/);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.gitflic.ru/user/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "token valid-tok-1234567890" }),
      }),
    );
    // Token must actually be persisted.
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token")).toBe("valid-tok-1234567890");
  });

  it("refuses to store when /user/me returns 401", async () => {
    fetchMock.mockResolvedValue(fakeRes(401, "unauthorized"));
    const auth = await importAuth();
    let err;
    try {
      await run(auth, "login", [], { token: "bad-token" });
    } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(err.message).toMatch(/token rejected/);
    // Token must NOT be persisted.
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token")).toBeUndefined();
  });

  it("--as <name> stores under token:<name> and sets active-account", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "tikhon" }));
    const auth = await importAuth();
    const r = await run(auth, "login", [], { token: "work-tok-aaaaaaaa", as: "work" });
    expect(r.stdout).toMatch(/account: work/);
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token:work")).toBe("work-tok-aaaaaaaa");
    expect(secretGet("token")).toBeUndefined();
    const { configGet } = await import("../config.mjs");
    expect(configGet("active-account")).toBe("work");
    expect(configGet("account:work")).toBe("1");
  });

  it("--stdin reads token from stdin", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    // Inject stdin.
    const { Readable } = await import("node:stream");
    const stdin = Readable.from(["stdin-token-zzzzz\n"]);
    const origStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
    try {
      const auth = await importAuth();
      const r = await run(auth, "login", [], { stdin: true });
      expect(r.stdout).toMatch(/logged in/);
      const { secretGet } = await import("../secret.mjs");
      expect(secretGet("token")).toBe("stdin-token-zzzzz");
    } finally {
      Object.defineProperty(process, "stdin", { value: origStdin, configurable: true });
    }
  });

  it("dies when no token source is given", async () => {
    const auth = await importAuth();
    let err;
    try {
      await run(auth, "login", [], {});
    } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(err.message).toMatch(/no token/);
  });
});

describe("auth logout", () => {
  it("removes the active account's token", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "t1-aaaaaaaaaa" });
    const r = await run(auth, "logout", [], {});
    expect(r.stdout).toMatch(/logged out/);
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token")).toBeUndefined();
  });

  it("--as removes only the named account", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "default-tok-aaaa", as: "default" });
    await run(auth, "login", [], { token: "work-tok-bbbbbb", as: "work" });
    const r = await run(auth, "logout", [], { as: "work" });
    expect(r.stdout).toMatch(/account: work/);
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token:work")).toBeUndefined();
    expect(secretGet("token")).toBe("default-tok-aaaa"); // untouched
  });

  it("--all removes every known account", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "def-aaaaaaa" });
    await run(auth, "login", [], { token: "wrk-bbbbbbb", as: "work" });
    const r = await run(auth, "logout", [], { all: true });
    expect(r.stdout).toMatch(/all tokens cleared/);
    const { secretGet } = await import("../secret.mjs");
    expect(secretGet("token")).toBeUndefined();
    expect(secretGet("token:work")).toBeUndefined();
    const { configGet } = await import("../config.mjs");
    expect(configGet("active-account")).toBeUndefined();
  });
});

describe("auth switch", () => {
  it("succeeds for an existing named account", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "w-cccccccccc", as: "work" });
    const r = await run(auth, "switch", ["work"]);
    expect(r.stdout).toMatch(/switched to account 'work'/);
    const { configGet } = await import("../config.mjs");
    expect(configGet("active-account")).toBe("work");
  });

  it("dies for a non-existent account", async () => {
    const auth = await importAuth();
    let err;
    try {
      await run(auth, "switch", ["ghost"]);
    } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(err.message).toMatch(/no token stored for account 'ghost'/);
  });

  it("dies without a name argument", async () => {
    const auth = await importAuth();
    let err;
    try { await run(auth, "switch", []); } catch (e) { err = e; }
    expect(err.message).toMatch(/auth switch <name>/);
  });
});

describe("auth status", () => {
  it("shows identity when token is valid", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "tikhon", email: "t@example.com" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "valid-token-aaaa" });
    // Pass a pre-resolved token via ctx to skip resolveToken's env check.
    const r = await run(auth, "status", [], {}, { token: "valid-token-aaaa", api: "https://api.gitflic.ru" });
    expect(r.stdout).toMatch(/identity:.*tikhon/);
    expect(r.stdout).toMatch(/t@example\.com/);
    expect(r.stdout).toMatch(/backend:\s+file/);
  });

  it("fails (exit 1) when token is rejected", async () => {
    fetchMock.mockResolvedValue(fakeRes(401, "unauthorized"));
    const auth = await importAuth();
    const r = await run(auth, "status", [], {}, { token: "any", api: "https://api.gitflic.ru" });
    expect(r.stdout).toMatch(/unreachable/);
    expect(process.exitCode).toBe(1);
  });
});

describe("auth list", () => {
  it("shows empty-state hint when nothing is stored", async () => {
    const auth = await importAuth();
    const r = await run(auth, "list", []);
    expect(r.stdout).toMatch(/no accounts/);
  });

  it("lists accounts with active marker", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "default-aaaaaa" });
    await run(auth, "login", [], { token: "work-bbbbbbb", as: "work" });
    await run(auth, "switch", ["work"]); // make work active
    const r = await run(auth, "list", []);
    expect(r.stdout).toMatch(/default/);
    expect(r.stdout).toMatch(/work/);
    expect(r.stdout).toMatch(/active: work/);
    expect(r.stdout).toMatch(/def\*+/); // masked default value (work is active — default has ' ' marker)
    // The active account's row should have a '*' marker.
    const lines = r.stdout.split("\n");
    const workLine = lines.find((l) => l.includes("work"));
    expect(workLine.trimStart().startsWith("*")).toBe(true);
  });

  it("masks sensitive values", async () => {
    fetchMock.mockResolvedValue(fakeRes(200, { alias: "u" }));
    const auth = await importAuth();
    await run(auth, "login", [], { token: "verysecretvalue-9999" });
    const r = await run(auth, "list", []);
    expect(r.stdout).not.toContain("verysecretvalue-9999");
    expect(r.stdout).toMatch(/ver\*+999/);
  });
});

describe("tokenKey helper", () => {
  it("uses 'token' for default account", async () => {
    const auth = await importAuth();
    expect(auth.tokenKey("default")).toBe("token");
  });
  it("namespaces named accounts", async () => {
    const auth = await importAuth();
    expect(auth.tokenKey("work")).toBe("token:work");
    expect(auth.tokenKey("personal")).toBe("token:personal");
  });
});
