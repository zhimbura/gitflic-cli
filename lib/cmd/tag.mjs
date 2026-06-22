// gitflic tag — tags and tag-protection commands.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function printTag(t, format) {
  if (format === "json") return printJson(t);
  process.stdout.write(
    `${color(t.name, 1)} ${t.lightWeight ? color("[lightweight]", 90) : color("[annotated]", 36)}\n` +
      `  commit: ${t.commitId?.slice(0, 12)}\n` +
      `  by:     ${t.personIdent?.name} <${t.personIdent?.emailAddress}>\n` +
      `  when:   ${t.personIdent?.when}\n` +
      (t.shortMessage ? `  msg:    ${t.shortMessage}\n` : ""),
  );
}

function printTagList(data, format) {
  const list = data?._embedded?.tagList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("tags");
  for (const t of list) printTag(t, "pretty");
}

function printTagProtection(p, format) {
  if (format === "json") return printJson(p);
  process.stdout.write(
    `${color(p.uuid?.slice(0, 8) || "?", 36)} ${color(p.tagTemplate || "?", 1)}\n` +
      `  allow: ${p.allowToCreate}\n` +
      `  type:  ${p.ownerType}\n`,
  );
}

function printTagProtectionList(data, format) {
  const list = data?._embedded?.restTagProtectionModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("tag protection rules");
  for (const p of list) printTagProtection(p, "pretty");
}

const VALID_ACCESS = ["NO_ONE", "DEVELOPER", "ADMINS"];

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/tag",
    embeddedKey: "tagList",
    flags,
  });
  if (data === null) return null; // streamed
  printTagList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const name = args[0];
  if (!name) die("usage: gitflic tag get <name>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/tag/${encodeURIComponent(name)}`,
    token,
  );
  printTag(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const tagName = args[0];
  if (!tagName) die("usage: gitflic tag create <tagName> [--branch <b>|--commit <hash>] [--message <text>]");
  const body = { tagName };
  if (flags.commit) body.commitId = flags.commit;
  else body.branchName = flags.branch || flags.from || "master";
  if (flags.message) body.message = flags.message;
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/tag/create`,
    token,
    body,
  );
  printTag(data, resolveFormat(flags, false));
  return data;
}

async function deleteTag(ctx, args) {
  // No public DELETE endpoint documented in /api/tag/ — workaround: skip.
  // GitFlic supports tag deletion only via git CLI: `git push origin :tagName`
  die(
    "no public API endpoint for tag deletion. Use: git push origin :" +
      args[0] +
      " (then run \`git fetch --prune origin\` to update local refs)",
  );
  // args is read by the line above so don't remove the parameter
  void args;
}

// Tag protection is team/company-scoped only. Resolve {level, alias} from
// --scope team|company + --team/--company <alias> (same convention as branch.mjs).
function tagProtectionBase(ctx, flags) {
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
    alias = ctx.alias; // came in via --project as the team/company alias
  } else {
    die("tag protection is team/company-scoped — pass --scope team|company with --team <alias> or --company <alias>");
  }
  if (!alias) die(`tag protection: provide the ${level} alias via --${level} <alias>`);
  return { base: `${ctx.api}/${level}/${encodeURIComponent(alias)}/tag-protection`, level, alias };
}

async function protectionList(ctx, _args, flags) {
  const { token } = ctx;
  const { base } = tagProtectionBase(ctx, flags);
  const data = await http("GET", base, token);
  printTagProtectionList(data, resolveFormat(flags, true));
  return data;
}

async function protectionGet(ctx, args, flags) {
  const { token } = ctx;
  const { base } = tagProtectionBase(ctx, flags);
  const uuid = args[0];
  if (!uuid) die("usage: gitflic tag protection get <uuid> --scope team|company --team/--company <alias>");
  const data = await http("GET", `${base}/${encodeURIComponent(uuid)}`, token);
  printTagProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionCreate(ctx, _args, flags) {
  const { token } = ctx;
  const { base } = tagProtectionBase(ctx, flags);
  if (!flags.template && !flags["tag-template"]) die("usage: --tag-template <pattern> --allow-to-create NO_ONE|DEVELOPER|ADMINS");
  const allow = flags["allow-to-create"] || flags["allowed-to-create"] || flags.allow;
  if (!allow || !VALID_ACCESS.includes(allow)) die(`--allow-to-create must be one of ${VALID_ACCESS.join(" | ")}`);
  const body = { tagTemplate: flags["tag-template"] || flags.template, allowToCreate: allow };
  const data = await http("POST", `${base}/create`, token, body);
  printTagProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionEdit(ctx, args, flags) {
  const { token } = ctx;
  const { base } = tagProtectionBase(ctx, flags);
  const uuid = args[0];
  if (!uuid) die("usage: gitflic tag protection edit <uuid> --allow-to-create X");
  const allow = flags["allow-to-create"] || flags["allowed-to-create"] || flags.allow;
  if (!allow || !VALID_ACCESS.includes(allow)) die(`--allow-to-create must be one of ${VALID_ACCESS.join(" | ")}`);
  const data = await http("PATCH", `${base}/edit`, token, { uuid, allowToCreate: allow });
  printTagProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionDelete(ctx, args, flags) {
  const { token } = ctx;
  const { base } = tagProtectionBase(ctx, flags);
  const uuid = args[0];
  if (!uuid) die("usage: gitflic tag protection delete <uuid>");
  await http("DELETE", `${base}/${encodeURIComponent(uuid)}`, token);
  process.stdout.write(`gitflic: tag protection rule '${uuid}' deleted\n`);
}

// POST /{company|team}/{alias}/tag-protection/apply-settings-to-projects
async function protectionApply(ctx, _args, flags) {
  const { token } = ctx;
  const { base, level, alias } = tagProtectionBase(ctx, flags);
  const data = await http("POST", `${base}/apply-settings-to-projects`, token);
  if (data) printJson(data);
  else process.stdout.write(`gitflic: ${level} '${alias}' tag-protection settings applied to projects\n`);
  return data;
}

export const usage = `Tag commands:
  tag list [--page N --size N] [--all]                  List all tags (--all auto-paginates)
  tag get <name>                                        Get one tag
  tag create <tagName> [--branch <b>|--commit <hash>] [--message <text>]
                                                          Create tag (branch defaults to master)
  tag delete <name>                                     (no API endpoint — use \`git push origin :name\`)

  Tag protection (team/company-scoped — pass --scope team|company with --team/--company <alias>):
  tag protection list --scope team --team <alias>       List tag protection rules (team or company)
  tag protection get <uuid> --scope company --company <alias>   Get one tag protection rule
  tag protection create --scope team --team <alias> --tag-template <P> --allow-to-create NO_ONE|DEVELOPER|ADMINS
  tag protection edit <uuid> --scope team --team <alias> --allow-to-create X    Edit rule
  tag protection delete <uuid> --scope team --team <alias>      Delete rule
  tag protection apply-settings --scope team --team <alias>     Apply team/company tag-protection settings to its projects
`;

export async function handle(ctx, sub, args, flags) {
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
        die(`unknown tag protection subcommand: ${pSub}`);
    }
  }
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "delete":
      return deleteTag(ctx, args);
    default:
      die(`unknown tag subcommand: ${sub}`);
  }
}