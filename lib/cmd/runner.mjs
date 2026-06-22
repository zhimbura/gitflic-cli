// gitflic runner — CI/CD runner / agent commands.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/runner`, token);
  printJson(data);
  return data;
}

async function get(ctx, args, flags) {
  const { api, token } = ctx;
  const id = args[0];
  if (!id) die("usage: gitflic runner get <id>");
  const data = await http("GET", `${api}/runner/${id}`, token);
  printJson(data);
  return data;
}

export const usage = `Runner commands (no project needed):
  runner list                                            List CI/CD runners (agents)
  runner get <id>                                        Get one runner
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    default:
      die(`unknown runner subcommand: ${sub}`);
  }
}