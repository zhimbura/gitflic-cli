// gitflic environment — environment-protection rules (NOT generic environments).
// GitFlic's public REST API only documents `environment-protection` endpoints
// (team/company-scoped). Generic environment list/create is not exposed.

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";

async function protectionList(ctx, _args, flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias || (flags.team || flags.company);
  if (!a) die(`environment protection list: provide --project owner/alias (as team/company alias)`);
  const data = await http("GET", `${api}/${level}/${a}/environment-protection`, token);
  printJson(data);
  return data;
}

async function protectionCreate(ctx, _args, flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias || (flags.team || flags.company);
  if (!a || !flags.template) die("usage: --template <P> --allow-to-deploy NO_ONE|DEVELOPER|ADMINS");
  const data = await http(
    "POST",
    `${api}/${level}/${a}/environment-protection/create`,
    token,
    { environmentTemplate: flags.template, allowToDeploy: flags["allow-to-deploy"] || flags.allow },
  );
  printJson(data);
  return data;
}

async function protectionDelete(ctx, args, _flags, level) {
  const { api, token } = ctx;
  const a = ctx.alias;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic environment protection delete <uuid>");
  await http("DELETE", `${api}/${level}/${a}/environment-protection/${uuid}`, token);
  process.stdout.write(`gitflic: environment protection rule '${uuid}' deleted\n`);
}

export const usage = `Environment protection rules (team/company-scoped, not project-scoped):

  environment protection list                               List rules (pass --project as the team/company alias)
  environment protection create --template P --allow-to-deploy X
                                                            Create rule
  environment protection delete <uuid>                     Delete rule

Note: GitFlic does not expose generic environment CRUD via REST — environments
are managed as deploy targets per pipeline job in the web UI.
`;

export async function handle(ctx, sub, args, flags) {
  if (sub === "protection") {
    const pSub = args[0];
    const pArgs = args.slice(1);
    const level = flags.envLevel || (ctx.owner === "team" ? "team" : "company");
    switch (pSub) {
      case "list":
      case undefined:
        return protectionList(ctx, pArgs, flags, level);
      case "create":
        return protectionCreate(ctx, pArgs, flags, level);
      case "delete":
        return protectionDelete(ctx, pArgs, flags, level);
      default:
        die(`unknown environment protection subcommand: ${pSub}`);
    }
  }
  die(`unknown environment subcommand: ${sub}. Use 'environment protection ...'`);
}