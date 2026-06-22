// Helper: figure out which project (owner/alias) to use when an MCP tool
// is called without an explicit `project` argument.
//
// Resolution order:
//   1. process.env.GITFLIC_PROJECT     (e.g. "tikhon/wave")
//   2. autodetect from `git remote get-url origin` in the current cwd
//   3. return null — let the tool/CLI surface its own error
//
// This mirrors the auto-detect that the gitflic CLI does, so MCP tools
// work without per-call boilerplate when the agent is in a clone.

import { spawnSync } from "node:child_process";

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

function detectFromRemote() {
  const url = runGit(["config", "--get", "remote.origin.url"]);
  if (!url) return null;
  // Matches:
  //   git@gitflic.ru:owner/alias[.git]
  //   ssh://git@gitflic.ru[:port]/owner/alias[.git]
  //   https://gitflic.ru/owner/alias[.git]
  //   https://[subdomain.]gitflic.ru/owner/alias[.git]
  const gitflicMatch = url.match(
    /gitflic\.ru[:/]([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  );
  if (gitflicMatch) return `${gitflicMatch[1]}/${gitflicMatch[2]}`;
  // Self-hosted: any host with /owner/alias path.
  const genericMatch = url.match(/\/([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  if (genericMatch) return `${genericMatch[1]}/${genericMatch[2]}`;
  return null;
}

export function resolveProjectArg(args) {
  if (args && typeof args.project === "string" && args.project.length) {
    return args;
  }
  const envProj = process.env.GITFLIC_PROJECT;
  if (envProj && envProj.length) {
    return { ...args, project: envProj };
  }
  const auto = detectFromRemote();
  if (auto) {
    return { ...args, project: auto };
  }
  return args;
}
