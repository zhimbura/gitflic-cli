// gitflic company — companies.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function printCompany(c, format) {
  if (format === "json") return printJson(c);
  process.stdout.write(
    `${color(c.alias || "?", 1)} (${c.name || "—"})\n` +
      `  id:          ${c.id}\n` +
      `  description: ${(c.description || "").split("\n")[0]}\n`,
  );
}

function printCompanyList(data, format) {
  const list = data?._embedded?.companyList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("companies");
  for (const c of list) printCompany(c, "pretty");
}

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path: "/company",
    embeddedKey: "companyList",
    flags,
    extraQs: { q: flags.q },
  });
  if (data === null) return null; // streamed
  printCompanyList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic company get <alias>");
  const data = await http("GET", `${api}/company/${encodeURIComponent(alias)}`, token);
  printCompany(data, resolveFormat(flags, false));
  return data;
}

export const usage = `Company commands:
  company list [--q <query>]                            List companies
  company get <alias>                                   Get one company

Note: company create/edit/delete is restricted — use the GitFlic web UI.
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    default:
      die(`unknown company subcommand: ${sub}`);
  }
}