// gitflic team — teams.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function printTeam(t, format) {
  if (format === "json") return printJson(t);
  process.stdout.write(
    `${color(t.alias || "?", 1)} (${t.name || "—"})\n` +
      `  id:          ${t.id}\n` +
      `  description: ${(t.description || "").split("\n")[0]}\n` +
      `  private:     ${t.private}\n`,
  );
}

function printTeamList(data, format) {
  const list = data?._embedded?.teamList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("teams");
  for (const t of list) printTeam(t, "pretty");
}

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path: "/team",
    embeddedKey: "teamList",
    flags,
    extraQs: { q: flags.q },
  });
  printTeamList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team get <alias>");
  const data = await http("GET", `${api}/team/${encodeURIComponent(alias)}`, token);
  printTeam(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.alias || !flags.name) die("usage: gitflic team create --alias A --name N [--description D] [--private]");
  const body = {
    alias: flags.alias,
    name: flags.name,
    description: flags.description || "",
    isPrivate: flags.private ? "true" : "false",
  };
  const data = await http("POST", `${api}/team`, token, body);
  printTeam(data, resolveFormat(flags, false));
  return data;
}

async function edit(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team edit <alias> [--name N] [--description D] [--private|--public]");
  const body = { alias };
  if (flags.name) body.name = flags.name;
  if (flags.description !== undefined) body.description = flags.description;
  if (flags.private) body.isPrivate = "true";
  if (flags.public) body.isPrivate = "false";
  const data = await http("PUT", `${api}/team/${encodeURIComponent(alias)}`, token, body);
  printTeam(data, resolveFormat(flags, false));
  return data;
}

async function deleteTeam(ctx, args) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team delete <alias>");
  await http("DELETE", `${api}/team/${encodeURIComponent(alias)}`, token);
  process.stdout.write(`gitflic: team '${alias}' deleted\n`);
}

async function members(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team members <alias>");
  const data = await http(
    "GET",
    `${api}/team/${encodeURIComponent(alias)}/members`,
    token,
  );
  printJson(data);
  return data;
}

export const usage = `Team commands:
  team list [--q <query>]                               List teams
  team get <alias>                                      Get one team
  team create --alias A --name N [--description D] [--private]
                                                         Create team
  team edit <alias> [--name N] [--description D] [--private|--public]
                                                         Edit team
  team delete <alias>                                   Delete team
  team members <alias>                                  List team members
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "edit":
      return edit(ctx, args, flags);
    case "delete":
      return deleteTeam(ctx, args);
    case "members":
      return members(ctx, args, flags);
    default:
      die(`unknown team subcommand: ${sub}`);
  }
}