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
  const qs = new URLSearchParams();
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  const url = `${urlProject(api, owner, alias)}/tag${qs.size ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
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

async function protectionList(ctx, _args, flags, level) {
  // Tag protection is team/company-only — no project-scope. level = "team"|"company"
  const { api, token } = ctx;
  const a = ctx.alias || ctx[level + "Alias"];
  if (!a) die(`tag protection list: provide --project owner/alias (team alias) or use \`gitflic ${level} <alias>\``);
  const path = level === "company" ? `company/${a}/tag-protection` : `team/${a}/tag-protection`;
  const data = await http("GET", `${api}/${path}`, token);
  printTagProtectionList(data, resolveFormat(flags, true));
  return data;
}

async function protectionCreate(ctx, _args, flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias || ctx[level + "Alias"];
  if (!a) die(`tag protection create: provide owner/alias`);
  if (!flags.template && !flags["tag-template"]) die("usage: --tag-template <pattern> --allow-to-create NO_ONE|DEVELOPER|ADMINS");
  const allow = flags["allow-to-create"] || flags.allow;
  if (!allow || !VALID_ACCESS.includes(allow)) die(`--allow-to-create must be one of ${VALID_ACCESS.join(" | ")}`);
  const body = { tagTemplate: flags["tag-template"] || flags.template, allowToCreate: allow };
  const data = await http(
    "POST",
    `${api}/${level}/${a}/tag-protection/create`,
    token,
    body,
  );
  printTagProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionEdit(ctx, args, flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias || ctx[level + "Alias"];
  const uuid = args[0];
  if (!uuid) die("usage: gitflic tag protection edit <uuid> --allow-to-create X");
  const allow = flags["allow-to-create"] || flags.allow;
  if (!allow || !VALID_ACCESS.includes(allow)) die(`--allow-to-create must be one of ${VALID_ACCESS.join(" | ")}`);
  const data = await http(
    "PATCH",
    `${api}/${level}/${a}/tag-protection/edit`,
    token,
    { uuid, allowToCreate: allow },
  );
  printTagProtection(data, resolveFormat(flags, false));
  return data;
}

async function protectionDelete(ctx, args, _flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias || ctx[level + "Alias"];
  const uuid = args[0];
  if (!uuid) die("usage: gitflic tag protection delete <uuid>");
  await http("DELETE", `${api}/${level}/${a}/tag-protection/${uuid}`, token);
  process.stdout.write(`gitflic: tag protection rule '${uuid}' deleted\n`);
}

export const usage = `Tag commands:
  tag list [--page N --size N]                          List all tags
  tag get <name>                                        Get one tag
  tag create <tagName> [--branch <b>|--commit <hash>] [--message <text>]
                                                          Create tag (branch defaults to master)
  tag delete <name>                                     (no API endpoint — use \`git push origin :name\`)

  Tag protection (team/company-scoped — pass --project owner/alias as the team/company alias):
  tag protection list                                   List tag protection rules (team or company)
  tag protection create --tag-template <P> --allow-to-create NO_ONE|DEVELOPER|ADMINS
  tag protection edit <uuid> --allow-to-create X        Edit rule
  tag protection delete <uuid>                         Delete rule
`;

export async function handle(ctx, sub, args, flags) {
  if (sub === "protection") {
    const pSub = args[0];
    const pArgs = args.slice(1);
    // level comes from --project: if it looks like a team/company alias, use that.
    // Heuristic: caller passes --project teamAlias or --project companyAlias. We try team first.
    const level = ctx.flags.tagLevel || (ctx.owner && ctx.owner === "team" ? "team" : "company");
    switch (pSub) {
      case "list":
      case undefined:
        return protectionList(ctx, pArgs, flags, level);
      case "create":
        return protectionCreate(ctx, pArgs, flags, level);
      case "edit":
        return protectionEdit(ctx, pArgs, flags, level);
      case "delete":
        return protectionDelete(ctx, pArgs, flags, level);
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