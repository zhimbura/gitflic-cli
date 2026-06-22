// gitflic branch — branches and branch-protection commands.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  statusColor,
  urlProject,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList, buildPageQs } from "../paginate.mjs";

function shortCommit(c) {
  if (!c) return "?";
  return `${(c.hash || "").slice(0, 8)} ${c.shortMessage || ""}`.trim();
}

function printBranch(b, format) {
  if (format === "json") return printJson(b);
  const tag = b.default ? color("[default]", 32) : b.work ? color("[work]", 36) : "";
  process.stdout.write(
    `${color(b.name, 1)} ${tag}\n` +
      `  ${shortCommit(b.lastCommit)}\n` +
      `  merged: ${b.merged}\n`,
  );
}

function printBranchList(data, format) {
  const list = data?._embedded?.branchList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("branches");
  for (const b of list) printBranch(b, "pretty");
}

function printProtection(p, format) {
  if (format === "json") return printJson(p);
  process.stdout.write(
    `${color(p.id?.slice(0, 8) || "?", 36)} ${color(p.branchTemplate || "?", 1)}\n` +
      `  push:    ${p.allowedToPush}\n` +
      `  merge:   ${p.allowedToMerge}\n` +
      `  force:   ${p.allowForcePush}\n` +
      `  owner:   ${p.codeOwnerApprovalRequired}\n` +
      `  auto:    ${p.autoMergeByDefault}\n`,
  );
}

function printProtectionList(data, format) {
  const list = data?._embedded?.branchProtectionApiModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("protection rules");
  for (const p of list) printProtection(p, "pretty");
}

const VALID_ACCESS = ["NO_ONE", "DEVELOPER", "ADMINS"];

// Resolve company/team scope for branch-protection. When --scope/--company/--team
// is given, build an absolute `${api}/${level}/${alias}/...` URL ignoring ctx.owner/alias.
// Returns null when no scope flag is present (=> use the project-scoped path).
function resolveScope(ctx, flags) {
  let level;
  let alias;
  if (flags.company) {
    level = "company";
    alias = flags.company === true ? ctx.alias : flags.company;
  } else if (flags.team) {
    level = "team";
    alias = flags.team === true ? ctx.alias : flags.team;
  } else if (flags.scope === "company" || flags.scope === "team") {
    level = flags.scope;
    alias = ctx.alias;
  } else {
    return null; // project-scoped
  }
  if (!alias)
    die(`branch protection: provide a scope alias via --company <alias> / --team <alias> (or --project owner/alias with --scope company|team)`);
  return { level, alias };
}

// Base URL for branch-protection given an optional scope.
function protectionBase(ctx, flags) {
  const { api, owner, alias } = ctx;
  const scope = resolveScope(ctx, flags);
  if (scope) return `${api}/${scope.level}/${encodeURIComponent(scope.alias)}/branch-protection`;
  return `${urlProject(api, owner, alias)}/branch-protection`;
}

// ---------- handlers ------------------------------------------------------

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/branch",
    embeddedKey: "branchList",
    flags,
  });
  if (data === null) return null; // streamed
  printBranchList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const name = args[0];
  if (!name) die("usage: gitflic branch get <name>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch?name=${encodeURIComponent(name)}`,
    token,
  );
  printBranch(data, resolveFormat(flags, false));
  return data;
}

async function defaultBranch(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch/default`,
    token,
  );
  printBranch(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const newBranch = args[0];
  const originBranch = flags.from || args[1] || "master";
  if (!newBranch) die("usage: gitflic branch create <newBranch> [--from <originBranch>]");
  const data = await http("POST", `${urlProject(api, owner, alias)}/branch`, token, {
    newBranch,
    originBranch,
  });
  printBranch(data, resolveFormat(flags, false));
  return data;
}

async function deleteBranch(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const name = args[0];
  if (!name) die("usage: gitflic branch delete <name>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/branch?branchName=${encodeURIComponent(name)}`,
    token,
  );
  process.stdout.write(`gitflic: branch '${name}' deleted\n`);
}

async function compare(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const compareBranch = args[0];
  if (!compareBranch) die("usage: gitflic branch compare <compareBranch> [--base <baseBranch>]");
  const qs = new URLSearchParams({ compare: compareBranch });
  if (flags.base) qs.set("base", flags.base);
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch/compare?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

async function compareFile(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const filePath = flags["file-path"] || flags.path || args[0];
  const baseHash = flags["base-hash"] || flags.base;
  const compareHash = flags["compare-hash"] || flags.compare;
  if (!filePath || !baseHash || !compareHash)
    die("usage: gitflic branch compare-file --file-path <path> --base-hash <hash> --compare-hash <hash>");
  const qs = new URLSearchParams({ filePath, baseHash, compareHash });
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch/compare/file?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

async function commits(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const baseHash = flags["base-hash"] || flags.base;
  const compareHash = flags["compare-hash"] || flags.compare;
  if (!baseHash || !compareHash)
    die("usage: gitflic branch commits --base-hash <hash> --compare-hash <hash>  (baseHash must be older than compareHash)");
  const qs = new URLSearchParams({ baseHash, compareHash });
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch/commit?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

async function protectionList(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const scope = resolveScope(ctx, flags);
  if (scope) {
    // Company/team-scoped: not exposed via paginatedList (project-only); use http.
    const qs = buildPageQs(flags).toString();
    const url = `${api}/${scope.level}/${encodeURIComponent(scope.alias)}/branch-protection${qs ? `?${qs}` : ""}`;
    const data = await http("GET", url, token);
    printProtectionList(data, resolveFormat(flags, true));
    return data;
  }
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/branch-protection",
    embeddedKey: "branchProtectionApiModelList",
    flags,
  });
  printProtectionList(data, resolveFormat(flags, true));
  return data;
}

async function protectionGet(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic branch protection get <uuid> [--scope company|team --company/--team <alias>]");
  const data = await http(
    "GET",
    `${protectionBase(ctx, flags)}/${encodeURIComponent(uuid)}`,
    token,
  );
  printProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionCreate(ctx, _args, flags) {
  const { token } = ctx;
  if (!flags["branch-template"] && !flags.template)
    die("usage: gitflic branch protection create --branch-template <pattern> --allowed-to-push X --allowed-to-merge X [--allow-force-push] [--code-owner-approval] [--auto-merge]");
  const allowedToPush = flags["allowed-to-push"] || flags.push;
  const allowedToMerge = flags["allowed-to-merge"] || flags.merge;
  if (!allowedToPush || !VALID_ACCESS.includes(allowedToPush))
    die(`--allowed-to-push must be one of ${VALID_ACCESS.join(" | ")}`);
  if (!allowedToMerge || !VALID_ACCESS.includes(allowedToMerge))
    die(`--allowed-to-merge must be one of ${VALID_ACCESS.join(" | ")}`);
  const body = {
    branchTemplate: flags["branch-template"] || flags.template,
    allowedToPush,
    allowedToMerge,
  };
  if (flags["allow-force-push"] || flags.force) body.allowForcePush = true;
  if (flags["code-owner-approval"] || flags.owner) body.codeOwnerApprovalRequired = true;
  if (flags["auto-merge"] || flags.auto) body.autoMergeByDefault = true;
  const data = await http(
    "POST",
    protectionBase(ctx, flags),
    token,
    body,
  );
  printProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionEdit(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic branch protection edit <uuid> [--scope company|team --company/--team <alias>] [--allowed-to-push X] [--allowed-to-merge X] [--allow-force-push true|false] [--code-owner-approval true|false] [--auto-merge true|false]");
  const body = {};
  if (flags["allowed-to-push"] || flags.push) {
    const v = flags["allowed-to-push"] || flags.push;
    if (!VALID_ACCESS.includes(v)) die(`--allowed-to-push must be one of ${VALID_ACCESS.join(" | ")}`);
    body.allowedToPush = v;
  }
  if (flags["allowed-to-merge"] || flags.merge) {
    const v = flags["allowed-to-merge"] || flags.merge;
    if (!VALID_ACCESS.includes(v)) die(`--allowed-to-merge must be one of ${VALID_ACCESS.join(" | ")}`);
    body.allowedToMerge = v;
  }
  if (flags["allow-force-push"] !== undefined) body.allowForcePush = flags["allow-force-push"] === "true" || flags["allow-force-push"] === true;
  else if (flags.force) body.allowForcePush = true;
  if (flags["code-owner-approval"] !== undefined) body.codeOwnerApprovalRequired = flags["code-owner-approval"] === "true" || flags["code-owner-approval"] === true;
  else if (flags.owner) body.codeOwnerApprovalRequired = true;
  if (flags["auto-merge"] !== undefined) body.autoMergeByDefault = flags["auto-merge"] === "true" || flags["auto-merge"] === true;
  else if (flags.auto) body.autoMergeByDefault = true;
  if (!Object.keys(body).length) die("no fields to update; pass --allowed-to-push / --allowed-to-merge / --allow-force-push / etc.");
  const data = await http(
    "PUT",
    `${protectionBase(ctx, flags)}/${encodeURIComponent(uuid)}`,
    token,
    body,
  );
  printProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionDelete(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic branch protection delete <uuid> [--scope company|team --company/--team <alias>]");
  await http(
    "DELETE",
    `${protectionBase(ctx, flags)}/${encodeURIComponent(uuid)}`,
    token,
  );
  process.stdout.write(`gitflic: protection rule '${uuid}' deleted\n`);
}

// POST /{company|team}/{alias}/branch-protection/apply-settings-to-projects
async function protectionApply(ctx, _args, flags) {
  const { token } = ctx;
  const scope = resolveScope(ctx, flags);
  if (!scope || (scope.level !== "company" && scope.level !== "team"))
    die("usage: gitflic branch protection apply-settings --scope company|team --company/--team <alias>  (company/team scope required)");
  const data = await http(
    "POST",
    `${ctx.api}/${scope.level}/${encodeURIComponent(scope.alias)}/branch-protection/apply-settings-to-projects`,
    token,
  );
  if (data) printJson(data);
  else process.stdout.write(`gitflic: ${scope.level} '${scope.alias}' branch-protection settings applied to projects\n`);
  return data;
}

export const usage = `Branch commands (need --project owner/alias):
  branch list [--page N --size N] [--all]              List all branches (--all auto-paginates)
  branch get <name>                                     Get one branch
  branch default                                        Get the default branch
  branch create <newBranch> [--from <originBranch>]     Create branch from origin (default: master)
  branch delete <name>                                  Delete a branch
  branch compare <compareBranch> [--base <baseBranch>]  Compare two branches (file-level)
  branch compare-file --file-path P --base-hash H --compare-hash H
                                                         Compare one file between two commits
  branch commits --base-hash H --compare-hash H         List commits between two hashes (base must be older)

  Branch-protection (project by default; add --scope company|team --company/--team <alias> for company/team):
  branch protection list [--all]                        List branch-protection rules (--all auto-paginates)
  branch protection get <uuid>                          Get one protection rule
  branch protection create                              Create protection rule
                                                         --branch-template <pattern>
                                                         --allowed-to-push NO_ONE|DEVELOPER|ADMINS
                                                         --allowed-to-merge NO_ONE|DEVELOPER|ADMINS
                                                         [--allow-force-push] [--code-owner-approval] [--auto-merge]
  branch protection edit <uuid>                         Edit protection rule (same flags as create)
  branch protection delete <uuid>                       Delete protection rule
  branch protection apply-settings --scope company|team --company/--team <alias>
                                                         Apply company/team protection settings to its projects
`;

export async function handle(ctx, sub, args, flags) {
  // Sub-dispatch: "protection ..." goes to protection handlers
  if (sub === "protection") {
    const pSub = args[0];
    const pArgs = args.slice(1);
    switch (pSub) {
      case "list":
      case undefined:
        return protectionList(ctx, pArgs, flags);
      case "get":
        return protectionGet(ctx, pArgs, flags);
      case "create":
        return protectionCreate(ctx, pArgs, flags);
      case "edit":
        return protectionEdit(ctx, pArgs, flags);
      case "delete":
        return protectionDelete(ctx, pArgs, flags);
      case "apply-settings":
      case "apply-settings-to-projects":
        return protectionApply(ctx, pArgs, flags);
      default:
        die(`unknown branch protection subcommand: ${pSub}`);
    }
  }
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "default":
      return defaultBranch(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "delete":
      return deleteBranch(ctx, args);
    case "compare":
      return compare(ctx, args, flags);
    case "compare-file":
      return compareFile(ctx, args, flags);
    case "commits":
    case "commit":
      return commits(ctx, args, flags);
    default:
      die(`unknown branch subcommand: ${sub}`);
  }
}