// Secure storage for sensitive values (tokens, passwords, API keys).
//
// Backend detection is cached for the process lifetime and resolved once,
// in this order:
//
//   1. macOS Keychain  via `security`           (preferred — zero deps)
//   2. Linux libsecret  via `secret-tool`       (preferred — zero deps if installed)
//   3. Plain JSON file at configPath()          (fallback — chmod 0600, with warning)
//
// Disable entirely with GITFLIC_NO_SECRET_STORE=1 — in that case sensitive
// keys simply cannot be persisted; users must use env vars.
//
// Notes
// -----
// * Keychain entries are per-user (login.keychain / kwallet), encrypted at
//   rest by the OS, and not world-readable. Same security model as `gh`
//   and `glab`.
// * The file backend is best-effort. We chmod 0600 on the file and 0700
//   on the parent dir so accidental leakage via umask is mitigated.
//   Still: anyone with read access to the user's home dir can read the
//   token. We print a one-time warning when writing sensitive keys to file.
// * `maskValue()` is used by `alias list|get` so secrets never appear in
//   terminal scrollback, shell history, or screencasts.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  configFile, configGet as fileConfigGet, configSet as fileConfigSet, configDelete as fileConfigDelete,
} from "./config.mjs";

// ---- constants ------------------------------------------------------------

const SERVICE = "gitflic-cli";

// Storage key for an account's token. The default account uses "token"
// (backward compat with the pre-multi-account format); named accounts use
// "token:<name>". Centralized here so resolveToken and auth.mjs agree.
const DEFAULT_ACCOUNT = "default";
export function tokenKey(account) {
  return !account || account === DEFAULT_ACCOUNT ? "token" : `token:${account}`;
}

// Keys whose values MUST be treated as secrets regardless of backend.
const SENSITIVE_PATTERNS = [
  /^token$/i,
  /^access[-_]?token$/i,
  /^api[-_]?token$/i,
  /^password$/i,
  /^pass$/i,
  /^secret$/i,
  /^.*[-_]?secret$/i,
  /^api[-_]?key$/i,
  /^private[-_]?key$/i,
];

export function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.some((re) => re.test(key));
}

// Mask a secret value for display: "abcdef-secret-123" -> "abc***123".
// Returns "[set, hidden]" for empty/undefined to avoid leaking length.
export function maskValue(key, value) {
  if (value === undefined || value === null || value === "") return "(unset)";
  if (!isSensitiveKey(key)) return String(value);
  const s = String(value);
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

// ---- backend detection ----------------------------------------------------

let _backend = null;
let _warnedFileFallback = false;

function which(bin) {
  // PATH lookup without depending on `which`/`command -v` (not portable).
  const path = process.env.PATH || "";
  const sep = process.platform === "win32" ? ";" : ":";
  const exts = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of path.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = join(dir, bin + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

// Default runner — overridable in tests via __test__.withRunner().
function defaultRunner(bin, args, { stdin } = {}) {
  return spawnSync(bin, args, {
    input: stdin,
    encoding: "utf8",
    timeout: 5000,
    // Don't throw on non-zero exit (key-not-found is normal).
    stdio: ["pipe", "pipe", "pipe"],
  });
}

let _runner = defaultRunner;

function platformKeychain() {
  if (process.platform === "darwin") {
    const bin = which("security");
    if (!bin) return null;
    return makeMacBackend(bin);
  }
  if (process.platform === "linux") {
    const bin = which("secret-tool");
    if (!bin) return null;
    return makeLibsecretBackend(bin);
  }
  return null;
}

function makeMacBackend(bin) {
  return {
    kind: "keychain",
    platform: "darwin",
    available: true,
    get(key) {
      const r = _runner(bin, [
        "find-generic-password",
        "-a", key,
        "-s", SERVICE,
        "-w",
      ]);
      if (r.status !== 0) {
        // 44 = item not found. Anything else → log to stderr for debug.
        if (r.status !== 44 && r.stderr) {
          process.stderr.write(`gitflic: security get(${key}) failed: ${r.stderr.trim()}\n`);
        }
        return undefined;
      }
      const v = (r.stdout || "").trim();
      return v.length ? v : undefined;
    },
    set(key, value) {
      // -U updates in place if the item exists; otherwise add.
      const r = _runner(bin, [
        "add-generic-password",
        "-a", key,
        "-s", SERVICE,
        "-w", value,
        "-U",
      ]);
      if (r.status !== 0) {
        throw new Error(`security add-generic-password failed: ${(r.stderr || "").trim()}`);
      }
    },
    unset(key) {
      // delete-generic-password exits non-zero if not present — that's fine.
      _runner(bin, ["delete-generic-password", "-a", key, "-s", SERVICE]);
    },
  };
}

function makeLibsecretBackend(bin) {
  return {
    kind: "keychain",
    platform: "linux",
    available: true,
    get(key) {
      const r = _runner(bin, [
        "lookup", "service", SERVICE, "account", key,
      ]);
      if (r.status !== 0) return undefined;
      const v = (r.stdout || "").trim();
      return v.length ? v : undefined;
    },
    set(key, value) {
      const r = _runner(bin, [
        "store",
        "--label", `GitFlic CLI: ${key}`,
        "service", SERVICE,
        "account", key,
      ], { stdin: value });
      if (r.status !== 0) {
        throw new Error(`secret-tool store failed: ${(r.stderr || "").trim()}`);
      }
    },
    unset(key) {
      _runner(bin, ["clear", "service", SERVICE, "account", key]);
    },
  };
}

function makeFileBackend() {
  return {
    kind: "file",
    platform: process.platform,
    available: true,
    get(key) {
      return fileConfigGet(key);
    },
    set(key, value) {
      fileConfigSet(key, value);
      // Tighten permissions on every write — defense in depth in case
      // umask changed or the file was created earlier with looser mode.
      try {
        chmodSync(configFile(), 0o600);
        mkdirSync(dirname(configFile()), { recursive: true, mode: 0o700 });
      } catch {
        // best-effort — chmod may not be supported on some filesystems.
      }
    },
    unset(key) {
      fileConfigDelete(key);
    },
  };
}

export function secretBackend() {
  if (_backend) return _backend;
  if (process.env.GITFLIC_NO_SECRET_STORE === "1") {
    _backend = {
      kind: "none",
      platform: process.platform,
      available: false,
      get() { return undefined; },
      set() { throw new Error("secret store disabled (GITFLIC_NO_SECRET_STORE=1)"); },
      unset() { /* no-op */ },
    };
    return _backend;
  }
  const kc = platformKeychain();
  _backend = kc || makeFileBackend();
  return _backend;
}

// Warn (once per process) when sensitive data is about to be written to the
// file fallback. The user deserves to know their token isn't in the keychain.
function maybeWarnFileFallback(key) {
  if (_warnedFileFallback) return;
  if (!isSensitiveKey(key)) return;
  const b = secretBackend();
  if (b.kind !== "file") return;
  _warnedFileFallback = true;
  process.stderr.write(
    `gitflic: WARNING — storing '${key}' in plaintext file ${configFile()} (chmod 0600).\n` +
      `gitflic: For stronger protection, install an OS keychain (macOS ships \`security\`,\n` +
      `gitflic: Linux needs \`secret-tool\` from libsecret + gnome-keyring/kwallet).\n`,
  );
}

// ---- public surface -------------------------------------------------------

export function secretGet(key) {
  return secretBackend().get(key);
}

export function secretSet(key, value) {
  const b = secretBackend();
  if (b.kind === "file") maybeWarnFileFallback(key);
  return b.set(key, value);
}

export function secretUnset(key) {
  return secretBackend().unset(key);
}

// Token resolution chain: --token flag > GITFLIC_TOKEN env > secret store.
// Returns { value, source } or { value: undefined, source: null }.
export function resolveTokenFromSecret() {
  // env var is checked by the caller (http.mjs) so it can short-circuit.
  // We only handle the secret-store layer here.
  const v = secretGet("token");
  return v ? { value: v, source: secretBackend().kind } : { value: undefined, source: null };
}

// For tests — inject a custom runner and/or platform.
export const __test__ = {
  isSensitiveKey,
  maskValue,
  resetBackend() {
    _backend = null;
    _warnedFileFallback = false;
  },
  withRunner(fn) {
    _runner = fn;
  },
  forceBackend(b) {
    _backend = b;
  },
  // Exposed for the test file to assert internal helpers.
  _which: which,
  _defaultRunner: defaultRunner,
};
