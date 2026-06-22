// gitflic admin — admin-only endpoints. Most require admin scope on the token.
// Implemented as code-only — live tests skipped unless you have admin scope.

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";

async function listUsers(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/admin/user`, token);
  printJson(data);
  return data;
}

async function listProjects(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/admin/project`, token);
  printJson(data);
  return data;
}

export const usage = `Admin commands (require admin scope — code-only, not live-tested):
  admin user list                                        List ALL users (admin)
  admin project list                                     List ALL projects (admin)

Most other admin endpoints are NOT exposed via public REST API — use the
GitFlic admin panel in the web UI for global administration.
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "user":
      return dispatchUser(ctx, args[0], args.slice(1), flags);
    case "project":
      return dispatchProject(ctx, args[0], args.slice(1), flags);
    default:
      die(`unknown admin subcommand: ${sub}`);
  }
}

function dispatchUser(ctx, sub, _args, _flags) {
  switch (sub) {
    case "list":
      return listUsers(ctx, [], _flags);
    default:
      die(`unknown admin user subcommand: ${sub}`);
  }
}
function dispatchProject(ctx, sub, _args, _flags) {
  switch (sub) {
    case "list":
      return listProjects(ctx, [], _flags);
    default:
      die(`unknown admin project subcommand: ${sub}`);
  }
}