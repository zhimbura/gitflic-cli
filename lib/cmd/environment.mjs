// gitflic environment — environment-protection rules (NOT generic environments).
// GitFlic's public REST API only documents `environment-protection` endpoints
// (team/company-scoped). Generic environment list/create is not exposed.
//
// All endpoints are team/company-scoped: build `${api}/${level}/${alias}/...`
// where level is "team" or "company". The scope alias comes from --team/--company
// (or --scope team|company combined with --project), NOT from ctx.owner/alias.

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";

const VALID_ACCESS = ["NO_ONE", "DEVELOPER", "ADMINS"];

// Resolve scope (level) and alias from flags / ctx.
function resolveScope(ctx, flags) {
  let level = flags.envLevel;
  let alias;
  if (flags.team) {
    level = "team";
    alias = flags.team === true ? ctx.alias : flags.team;
  } else if (flags.company) {
    level = "company";
    alias = flags.company === true ? ctx.alias : flags.company;
  } else {
    if (flags.scope === "team" || flags.scope === "company") level = flags.scope;
    if (!level) level = ctx.owner === "team" ? "team" : "company";
    alias = ctx.alias;
  }
  if (!alias) die(`environment protection: provide a scope alias via --team <alias> / --company <alias> (or --project owner/alias with --scope team|company)`);
  return { level, alias };
}

async function protectionList(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const data = await http("GET", `${api}/${level}/${alias}/environment-protection`, token);
  printJson(data);
  return data;
}

async function protectionGet(ctx, args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const uuid = args[0];
  if (!uuid) die("usage: gitflic environment protection get <uuid>");
  const data = await http(
    "GET",
    `${api}/${level}/${alias}/environment-protection/${encodeURIComponent(uuid)}`,
    token,
  );
  printJson(data);
  return data;
}

async function protectionCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const template = flags.template;
  const allowToDeploy = flags["allow-to-deploy"] || flags.allow;
  if (!template) die("usage: gitflic environment protection create --template <pattern> --allow-to-deploy NO_ONE|DEVELOPER|ADMINS");
  if (allowToDeploy && !VALID_ACCESS.includes(allowToDeploy))
    die(`--allow-to-deploy must be one of ${VALID_ACCESS.join(" | ")}`);
  const data = await http(
    "POST",
    `${api}/${level}/${alias}/environment-protection/create`,
    token,
    { environmentTemplate: template, allowToDeploy },
  );
  printJson(data);
  return data;
}

async function protectionEdit(ctx, args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const uuid = args[0] || flags.uuid;
  if (!uuid) die("usage: gitflic environment protection edit <uuid> [--template <pattern>] [--allow-to-deploy NO_ONE|DEVELOPER|ADMINS]");
  const body = { uuid };
  if (flags.template) body.environmentTemplate = flags.template;
  const allowToDeploy = flags["allow-to-deploy"] || flags.allow;
  if (allowToDeploy) {
    if (!VALID_ACCESS.includes(allowToDeploy))
      die(`--allow-to-deploy must be one of ${VALID_ACCESS.join(" | ")}`);
    body.allowToDeploy = allowToDeploy;
  }
  if (Object.keys(body).length === 1) die("no fields to update; pass --template and/or --allow-to-deploy");
  const data = await http(
    "PATCH",
    `${api}/${level}/${alias}/environment-protection/edit`,
    token,
    body,
  );
  printJson(data);
  return data;
}

async function protectionApply(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const data = await http(
    "POST",
    `${api}/${level}/${alias}/environment-protection/apply-settings-to-projects`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: environment protection settings applied to ${level} '${alias}' projects\n`);
    return;
  }
  printJson(data);
  return data;
}

async function protectionDelete(ctx, args, flags) {
  const { api, token } = ctx;
  const { level, alias } = resolveScope(ctx, flags);
  const uuid = args[0];
  if (!uuid) die("usage: gitflic environment protection delete <uuid>");
  await http(
    "DELETE",
    `${api}/${level}/${alias}/environment-protection/${encodeURIComponent(uuid)}`,
    token,
  );
  process.stdout.write(`gitflic: environment protection rule '${uuid}' deleted\n`);
}

export const usage = `Environment protection rules (team/company-scoped, not project-scoped).
Specify scope with --team <alias> / --company <alias> (or --project owner/alias --scope team|company):

  environment protection list                              List rules
  environment protection get <uuid>                        Get one rule
  environment protection create                            Create rule
                                                            --template <pattern>
                                                            --allow-to-deploy NO_ONE|DEVELOPER|ADMINS
  environment protection edit <uuid>                       Edit rule (--template / --allow-to-deploy)
  environment protection apply-settings-to-projects        Apply rules to all scope projects
  environment protection delete <uuid>                     Delete rule

Note: available in Enterprise and on gitflic.ru. GitFlic does not expose generic
environment CRUD via REST — environments are managed as deploy targets in the web UI.
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
      case "apply-settings-to-projects":
      case "apply":
        return protectionApply(ctx, pArgs, flags);
      case "delete":
        return protectionDelete(ctx, pArgs, flags);
      default:
        die(`unknown environment protection subcommand: ${pSub}`);
    }
  }
  die(`unknown environment subcommand: ${sub}. Use 'environment protection ...'`);
}
