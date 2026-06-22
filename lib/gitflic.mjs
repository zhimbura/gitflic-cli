#!/usr/bin/env node
// gitflic — CLI for GitFlic REST API.
// Zero external deps. Pure Node ESM (>=18). Uses global fetch.

import process from "node:process";

import {
  DEFAULT_API_BASE,
  envFlag,
  parseArgs,
  resolveApiBase,
  resolveToken,
  resolveProject,
  http,
} from "./http.mjs";
import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  setColorEnabled,
  urlProject,
} from "./format.mjs";
import { configGet } from "./config.mjs";

import * as mr from "./cmd/mr.mjs";
import * as branch from "./cmd/branch.mjs";
import * as tag from "./cmd/tag.mjs";
import * as release from "./cmd/release.mjs";
import * as issue from "./cmd/issue.mjs";
import * as commit from "./cmd/commit.mjs";
import * as blob from "./cmd/blob.mjs";
import * as settings from "./cmd/settings.mjs";
import * as user from "./cmd/user.mjs";
import * as project from "./cmd/project.mjs";
import * as team from "./cmd/team.mjs";
import * as company from "./cmd/company.mjs";
import * as environment from "./cmd/environment.mjs";
import * as webhook from "./cmd/webhook.mjs";
import * as registry from "./cmd/registry.mjs";
import * as cicd from "./cmd/cicd.mjs";
import * as runner from "./cmd/runner.mjs";
import * as admin from "./cmd/admin.mjs";
import * as saml from "./cmd/saml.mjs";
import * as cacheCmd from "./cmd/cache.mjs";
import * as completionCmd from "./cmd/completion.mjs";
import * as aliasCmd from "./cmd/alias.mjs";
import * as authCmd from "./cmd/auth.mjs";

// ---------- command registry ----------------------------------------------

const COMMANDS = {
  auth: authCmd,
  mr, branch, tag, release, issue, commit, blob,
  settings, user, project, team, company, environment, webhook,
  registry, cicd, runner, admin, saml,
  cache: cacheCmd,
  completion: completionCmd,
  alias: aliasCmd,
};

// commands that do NOT need --project / owner/alias (they get refs from args)
const GLOBAL = new Set(["auth", "user", "settings", "project", "team", "company", "registry", "runner", "admin", "saml", "cache", "completion", "alias"]);

// commands that need api+token but no project (handled by themselves)
const NEEDS_TOKEN = new Set(Object.keys(COMMANDS).concat(["auth"]));

// ---------- USAGE builder --------------------------------------------------

function buildUsage() {
  const top = `gitflic — CLI for GitFlic REST API (gitflic.ru)

USAGE
  gitflic <command> [subcommand] [args] [flags]

Top-level commands (run \`gitflic <cmd>\` for sub-command help):
  auth                              Manage auth (login/logout/status/switch/list)
  mr                                Merge requests (list/view/diff/create/approve/merge/close/cancel/comment/discuss/settings)
  branch                            Branches (list/get/create/delete/protect)
  tag                               Tags (list/get/create/delete)
  release                           Releases (list/get/create/edit/delete)
  issue                             Issues + comments (list/view/create/edit/close/reopen/comment)
  commit                            Commits (list/get/show)
  blob                              Files/blobs (get/raw)
  project                           Projects (create/list/get/edit/delete/members/teams/archive/files/followers/stars/fork/mirror/import/deploy-token)
  user                              Users (me/search/by-id)
  settings                          User settings (ssh/oauth/access-token/transport-token/change-email/username/password)
  team                              Teams (list/get/create/edit/delete/members)
  company                           Companies (list/get)
  environment                       Environments (list/get/create/edit/delete)
  webhook                           Webhooks (list/get/create/edit/delete)
  registry                          Package registry (basic list)
  cicd                              CI/CD (pipelines/jobs basic)
  runner                            CI/CD runner / agent (basic)
  admin                             Admin endpoints (admin-only, code-only — not live-tested)
  saml                              SAML SSO endpoints (code-only)
  cache                             Local cache (project UUID resolution, etc.)
  completion                        Emit shell completion script (bash/zsh/fish)
  alias                             User-level config (default-project, api-base, etc.)

FLAGS (common to most commands)
  --project <owner>/<alias>         Project (else auto-detected from 'origin' remote)
  --api-base <url>                  API base (default: ${DEFAULT_API_BASE}; or env GITFLIC_API_BASE)
  --token <token>                   Access token (else env GITFLIC_TOKEN)
  --format json|pretty              Output format (default: pretty for lists, json for single)
  --page <n> --size <n>             Pagination for list endpoints
  -h, --help                        Show help for any sub-command

ENV
  GITFLIC_TOKEN                     Access token (Profile -> API tokens)
  GITFLIC_API_BASE                  Override --api-base
  GITFLIC_HTTP_RETRIES              Max retries on 429/502/503/504 (default 3)
  GITFLIC_HTTP_RETRY_DELAY          Base backoff delay in ms (default 500)
  GITFLIC_NO_RETRY=1                Disable HTTP retry
  GITFLIC_NO_CACHE=1                Disable local cache

EXAMPLES
  gitflic auth
  gitflic mr list --project FerdBur/wave
  gitflic mr create --title "Fix login" --to main
  gitflic branch list
  gitflic issue create --title "Bug: ..." --description "..."
  gitflic release create --name v1.0.0 --description "..."
  gitflic settings ssh add ~/.ssh/id_ed25519.pub --title "macbook"
`;

  const sections = Object.entries(COMMANDS)
    .map(([name, mod]) => (mod.usage ? `\n--- ${name} ---\n${mod.usage}` : ""))
    .join("\n");

  return top + "\n" + sections;
}

// ---------- dispatch -------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    process.stdout.write(buildUsage());
    return;
  }
  const { _, flags } = parseArgs(argv);

  // Color toggles. --color wins over --no-color wins over env.
  if (flags.color === true) setColorEnabled(true);
  else if (flags["no-color"] === true) setColorEnabled(false);
  // (else: leave as detected from env / TTY)

  // Bare "help" or "--help" anywhere — show full usage
  if (!_[0] || flags.help || _[0] === "help") {
    process.stdout.write(buildUsage());
    return;
  }

  const command = _[0];

  // Sub-command help: `gitflic <cmd> help`
  if (_[1] === "help" || _[1] === "--help") {
    const mod = COMMANDS[command];
    if (mod && mod.usage) {
      process.stdout.write(`gitflic ${command} — sub-commands:\n\n${mod.usage}\n`);
    } else {
      process.stdout.write(`gitflic ${command}: no detailed help available\n`);
    }
    return;
  }

  if (!NEEDS_TOKEN.has(command)) {
    process.stderr.write(`gitflic: unknown command '${command}'\n\n`);
    process.stdout.write(buildUsage());
    process.exit(1);
  }

  // `cache`, `completion`, and `alias` don't talk to the API — skip token/project resolution.
  if (command === "cache" || command === "completion" || command === "alias") {
    const mod = COMMANDS[command];
    const sub = _[1];
    const rest = _.slice(2);
    await mod.handle({}, sub, rest, flags);
    return;
  }

  // Run command
  const mod = COMMANDS[command];
  if (!mod) {
    process.stderr.write(`gitflic: unknown command '${command}'\n\n`);
    process.stdout.write(buildUsage());
    process.exit(1);
  }

  const sub = _[1];
  const rest = _.slice(2);

  // Every module exposes a single `handle(ctx, sub, args, flags)` entry point.
  if (typeof mod.handle !== "function") {
    die(`module ${command} has no handle() — bug in module`);
  }

  // `auth` has self-service subcommands that don't need a pre-resolved token
  // (login brings its own, logout/switch/list operate on the secret store).
  // Handle them BEFORE token resolution so `gitflic auth login --stdin` works
  // before the user has ever authenticated.
  const api = resolveApiBase(flags);
  const AUTH_SELF_SERVICE = new Set(["login", "logout", "switch", "list"]);
  if (command === "auth" && AUTH_SELF_SERVICE.has(sub)) {
    await mod.handle({ api, flags }, sub, rest, flags);
    return;
  }

  // Resolve auth context for everything else.
  const token = resolveToken(flags);
  const ctx = { api, token, flags };

  // Some commands need a project (mr/branch/tag/release/issue/commit/blob/project/environment/webhook)
  if (!GLOBAL.has(command)) {
    // Pre-populate --project from config if not given, so users with a
    // `default-project` set in their alias don't have to repeat it.
    if (!flags.project) {
      const def = configGet("default-project");
      if (def) flags.project = def;
    }
    const proj = resolveProject(flags);
    ctx.owner = proj.owner;
    ctx.alias = proj.alias;
  }

  // Pre-populate --api-base from config if not given.
  if (!flags["api-base"]) {
    const ab = configGet("api-base");
    if (ab) flags["api-base"] = ab;
  }

  await mod.handle(ctx, sub, rest, flags);
}

// Re-export commonly used helpers for module authors
export { http, printJson, printEmpty, color, urlProject, resolveFormat };

main().catch((err) => {
  die(err.stack || err.message || String(err));
});