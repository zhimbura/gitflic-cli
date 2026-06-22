// HTTP client + arg parsing + project auto-detection shared across all cmd modules.

import { spawnSync } from "node:child_process";
import { die } from "./format.mjs";

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

export async function http(method, url, token, body) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/json",
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    die(`network error: ${err.message || err}`);
  }
  const text = await res.text();
  let parsed;
  try {
    parsed = text.length ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail =
      (parsed && (parsed.message || parsed.error || parsed.errorMessage)) ||
      (typeof parsed === "string" ? parsed : "") ||
      res.statusText;
    die(`HTTP ${res.status} ${res.statusText} — ${detail}\nURL: ${method} ${url}`);
  }
  return parsed;
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
  return http("GET", `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}`, token);
}