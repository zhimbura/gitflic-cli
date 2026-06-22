// gitflic user — users: me, search, by-id, projects, followers, following.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";
import { buildPageQs } from "../paginate.mjs";

function printUser(u, format) {
  if (format === "json") return printJson(u);
  process.stdout.write(
    `${color(u.username || "?", 1)} (${u.fullName || "—"})\n` +
      `  id:       ${u.id}\n` +
      (u.email ? `  email:    ${u.email}\n` : "") +
      `  avatar:   ${u.avatar || "—"}\n`,
  );
}

function printUserList(data, format) {
  // /user returns _embedded.userList, /user/{a}/projects returns _embedded.projectList (different shape)
  const list = data?._embedded?.userList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("users");
  for (const u of list) printUser(u, "pretty");
}

async function me(ctx, _args, flags) {
  const { api, token } = ctx;
  const me = await http("GET", `${api}/user/me`, token);
  printUser(me, resolveFormat(flags, false));
  return me;
}

async function search(ctx, _args, flags) {
  const { api, token } = ctx;
  const qs = new URLSearchParams();
  if (flags.q) qs.set("q", flags.q);
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  const data = await http(
    "GET",
    `${api}/user${qs.size ? "?" + qs : ""}`,
    token,
  );
  printUserList(data, resolveFormat(flags, true));
  return data;
}

async function byAlias(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic user get <alias>");
  const data = await http("GET", `${api}/user/${encodeURIComponent(alias)}`, token);
  printUser(data, resolveFormat(flags, false));
  return data;
}

async function projects(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic user projects <alias>");
  const qs = buildPageQs(flags);
  const data = await http(
    "GET",
    `${api}/user/${encodeURIComponent(alias)}/projects${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function followers(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic user followers <alias>");
  const qs = buildPageQs(flags);
  const data = await http(
    "GET",
    `${api}/user/${encodeURIComponent(alias)}/followers${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function following(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic user following <alias>");
  const qs = buildPageQs(flags);
  const data = await http(
    "GET",
    `${api}/user/following/${encodeURIComponent(alias)}${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

export const usage = `User commands (no project needed):
  user me                              Current user (with email)
  user search [--q <query>] [--page N] Search users (paged)
  user get <alias>                     Get user by alias
  user projects <alias> [--page N] [--size N]   List public projects of a user
  user followers <alias> [--page N] [--size N]   List followers of a user
  user following <alias> [--page N] [--size N]   List users this user follows

EXAMPLES
  gitflic user me
  gitflic user search --q tikhon
  gitflic user projects tikhon
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "me":
      return me(ctx, args, flags);
    case "search":
      return search(ctx, args, flags);
    case "get":
      return byAlias(ctx, args, flags);
    case "projects":
      return projects(ctx, args, flags);
    case "followers":
      return followers(ctx, args, flags);
    case "following":
      return following(ctx, args, flags);
    default:
      die(`unknown user subcommand: ${sub}`);
  }
}