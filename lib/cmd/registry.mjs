// gitflic registry — package registry (Maven, NPM, PyPI, Docker, etc.).

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";

async function listPackages(ctx, args, flags) {
  const { api, token } = ctx;
  // /package — instance-level packages; /company/{a}/packages; /project/{o}/{a}/packages
  const scope = flags.scope || "instance";
  let path;
  if (scope === "instance") path = `${api}/package`;
  else if (scope === "company") {
    const a = args[0];
    if (!a) die("usage: gitflic registry list --scope company <companyAlias>");
    path = `${api}/company/${encodeURIComponent(a)}/package`;
  } else if (scope === "project") {
    const a = args[0];
    if (!a) die("usage: gitflic registry list --scope project <owner/alias>");
    const [o, p] = a.split("/");
    if (!o || !p) die("--scope project requires owner/alias");
    path = `${api}/project/${encodeURIComponent(o)}/${encodeURIComponent(p)}/package`;
  } else {
    die(`unknown scope: ${scope}`);
  }
  const qs = new URLSearchParams();
  if (flags.type) qs.set("type", flags.type);
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  const data = await http("GET", `${path}${qs.size ? "?" + qs : ""}`, token);
  printJson(data);
  return data;
}

async function listRepositories(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http(
    "GET",
    `${api}/registry-repository?page=${flags.page ?? 0}&size=${flags.size ?? 20}`,
    token,
  );
  printJson(data);
  return data;
}

export const usage = `Registry / package commands:
  registry list [--scope instance|company|project] [--type MAVEN|NPM|PYPI|DOCKER|...]
                        [owner/alias (for project scope)] [--page N]
                                                          List packages (instance/company/project level)
  registry repos                                            List registry repositories (instance-level)

EXAMPLES
  gitflic registry list                                    # all instance packages
  gitflic registry list --type NPM                         # filter by type
  gitflic registry list --scope project tikhon/wave        # packages in one project
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return listPackages(ctx, args, flags);
    case "repos":
      return listRepositories(ctx, args, flags);
    default:
      die(`unknown registry subcommand: ${sub}`);
  }
}