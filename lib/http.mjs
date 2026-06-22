// HTTP client + arg parsing + project auto-detection shared across all cmd modules.

import { spawnSync } from "node:child_process";
import { die } from "./format.mjs";
import { cacheGet, cacheSet, CACHE_DEFAULT_TTL_MS } from "./cache.mjs";

export const DEFAULT_API_BASE = "https://api.gitflic.ru";

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      out.flags.help = true;
      i++;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      // Boolean / short-form flags
      if (key === "squash" || key === "private" || key === "mirror") {
        out.flags[key] = true;
        i++;
        continue;
      }
      if (key === "no-remove-branch") {
        out.flags.removeBranch = false;
        i++;
        continue;
      }
      if (key === "json") {
        out.flags.format = "json";
        i++;
        continue;
      }
      if (key === "pretty") {
        out.flags.format = "pretty";
        i++;
        continue;
      }
      if (next === undefined || next.startsWith("--")) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i++;
      }
      i++;
      continue;
    }
    out._.push(a);
    i++;
  }
  return out;
}

export function envFlag(name) {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function envInt(name, def) {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function resolveApiBase(flags) {
  return flags["api-base"] || envFlag("GITFLIC_API_BASE") || DEFAULT_API_BASE;
}

export function resolveToken(flags) {
  const t = flags.token || envFlag("GITFLIC_TOKEN");
  if (!t) {
    die(
      "no token. Set GITFLIC_TOKEN or pass --token. Get one in your GitFlic profile under 'API tokens'.",
    );
  }
  return t;
}

// ---------- retry / rate-limit handling ----------

// HTTP status codes we treat as transient and retry-worthy.
export const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

// Per-call retry config (also re-readable from env).
export function defaultRetryOptions() {
  return {
    retries: envInt("GITFLIC_HTTP_RETRIES", 3),
    retryDelay: envInt("GITFLIC_HTTP_RETRY_DELAY", 500),
    // No retry if explicitly disabled.
    enabled: process.env.GITFLIC_NO_RETRY !== "1",
    // Hook for surfacing retry attempts to the user (CLI warns, library stays silent).
    onRetry: undefined,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse Retry-After header: either number of seconds, or an HTTP-date.
function parseRetryAfter(headerVal) {
  if (!headerVal) return null;
  const asInt = parseInt(headerVal, 10);
  if (Number.isFinite(asInt) && String(asInt) === headerVal.trim()) {
    return Math.max(0, asInt * 1000);
  }
  const t = Date.parse(headerVal);
  if (!Number.isNaN(t)) return Math.max(0, t - Date.now());
  return null;
}

function backoffDelay(attempt, baseMs) {
  // Exponential backoff with full jitter (AWS-style).
  const cap = 30_000;
  const exp = Math.min(cap, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exp);
}

function detailFromError(parsed, statusText) {
  return (
    (parsed && (parsed.message || parsed.error || parsed.errorMessage)) ||
    (typeof parsed === "string" ? parsed : "") ||
    statusText ||
    ""
  );
}

async function readBody(res) {
  const text = await res.text();
  if (!text.length) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * httpWithRetry — the actual fetch loop with retry/backoff.
 *
 * opts:
 *   retries     max retry attempts (default 3)
 *   retryDelay  base delay in ms for backoff (default 500)
 *   enabled     if false, behaves like a single fetch attempt
 *   onRetry     fn({ attempt, method, url, status, reason, delayMs }) called
 *               before each retry sleep
 *   fetchImpl   override for tests (defaults to globalThis.fetch)
 */
export async function httpWithRetry(method, url, token, body, opts = {}) {
  const {
    retries = 3,
    retryDelay = 500,
    enabled = true,
    onRetry = undefined,
    fetchImpl = globalThis.fetch,
  } = opts;

  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/json",
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const maxAttempts = enabled ? Math.max(0, retries) + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (err) {
      // Network error: retry up to limit, then die.
      if (attempt + 1 >= maxAttempts) {
        die(
          `network error after ${attempt + 1} attempt(s): ${err.message || err}\nURL: ${method} ${url}`,
        );
      }
      const delayMs = backoffDelay(attempt, retryDelay);
      if (onRetry) onRetry({ attempt, method, url, reason: "network", delayMs });
      await sleep(delayMs);
      continue;
    }

    if (res.ok) return await readBody(res);

    // Not OK. Decide if we retry.
    const status = res.status;
    if (enabled && attempt + 1 < maxAttempts && RETRYABLE_STATUS.has(status)) {
      const ra = parseRetryAfter(res.headers.get("retry-after"));
      const delayMs = ra ?? backoffDelay(attempt, retryDelay);
      // Drain body so the connection can be reused / closed cleanly.
      await readBody(res).catch(() => {});
      if (onRetry) onRetry({ attempt, method, url, status, reason: "throttled", delayMs });
      await sleep(delayMs);
      continue;
    }

    // Non-retryable (or out of attempts): die with a useful message.
    const parsed = await readBody(res);
    const detail = detailFromError(parsed, res.statusText);
    die(
      `HTTP ${res.status} ${res.statusText} — ${detail}\nURL: ${method} ${url}`,
    );
  }

  // Unreachable — loop always returns or die()s.
  /* istanbul ignore next */
  die(`unreachable: retry loop exited without result\nURL: ${method} ${url}`);
}

/**
 * http — back-compat wrapper. Same signature as before; retries are now
 * applied with defaults from env (GITFLIC_HTTP_RETRIES, GITFLIC_HTTP_RETRY_DELAY).
 */
export async function http(method, url, token, body) {
  return httpWithRetry(method, url, token, body, defaultRetryOptions());
}

function runGit(args) {
  try {
    const r = spawnSync("git", args, { encoding: "utf8" });
    if (r.status !== 0) return null;
    const out = (r.stdout || "").trim();
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function autodetectProject() {
  const url = runGit(["config", "--get", "remote.origin.url"]);
  if (!url) return null;
  // SSH:   git@gitflic.ru:owner/alias.git   or   ssh://git@gitflic.ru:22/owner/alias.git
  // HTTPS: https://gitflic.ru/owner/alias.git
  const sshMatch = url.match(/[:/](?:[^/]+\.)?gitflic\.ru[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (sshMatch) return { owner: sshMatch[1], alias: sshMatch[2] };
  // Generic: any host with /owner/alias path (works for self-hosted too)
  const genericMatch = url.match(/\/([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  if (genericMatch) return { owner: genericMatch[1], alias: genericMatch[2] };
  return null;
}

export function resolveProject(flags) {
  if (flags.project) {
    const m = String(flags.project).match(/^([^/]+)\/([^/]+)$/);
    if (!m) die(`--project must be owner/alias, got "${flags.project}"`);
    return { owner: m[1], alias: m[2] };
  }
  const detected = autodetectProject();
  if (detected) return detected;
  die(
    "could not detect project. Pass --project owner/alias or run inside a git repo with origin = gitflic.ru.",
  );
}

export function currentBranch() {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD";
}

export function projectIdFromOwnerAlias(api, token, owner, alias) {
  // Cached for 1h by default. GitFlic rarely renames / moves projects, and
  // the UUID is stable across renames. Use GITFLIC_NO_CACHE=1 to bypass.
  const cacheKey = `project:${api}:${owner}/${alias}`;
  const cached = cacheGet(cacheKey);
  if (cached) return Promise.resolve(cached);
  return http("GET", `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}`, token).then((proj) => {
    if (proj && typeof proj === "object" && proj.id) {
      cacheSet(cacheKey, proj, CACHE_DEFAULT_TTL_MS);
    }
    return proj;
  });
}
