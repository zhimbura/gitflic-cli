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
    `${color(c.alias || "?", 1)} (${c.title || c.name || "—"})\n` +
      `  id:          ${c.id}\n` +
      `  private:     ${c.private}\n` +
      `  owner:       ${c.ownerAlias || "—"}\n` +
      `  description: ${(c.description || "").split("\n")[0]}\n`,
  );
}

function printCompanyList(data, format) {
  const list = data?._embedded?.companyList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("companies");
  for (const c of list) printCompany(c, "pretty");
}

function printMemberList(data, format) {
  if (format === "json") return printJson(data);
  const list =
    data?._embedded?.companyUserList ||
    data?._embedded?.userList ||
    data?._embedded?.memberList ||
    [];
  if (!list.length) {
    // Non-obvious embedded key — fall back to raw for correctness.
    if (data && typeof data === "object" && data._embedded) {
      const keys = Object.keys(data._embedded);
      if (keys.length) return printJson(data);
    }
    return printEmpty("members");
  }
  for (const m of list) {
    const u = m.user || m;
    const username = u.username || u.alias || m.userAlias || "?";
    const role = m.role || m.companyRole || "—";
    process.stdout.write(
      `${color(username, 1)}  ${color(role, 36)}  ${u.fullName || ""}\n`,
    );
  }
}

// ---------- API wrappers ---------------------------------------------------

async function listCompanies(ctx, path, embeddedKey, flags, extraQs) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path,
    embeddedKey,
    flags,
    extraQs,
  });
  if (data === null) return null; // streamed
  printCompanyList(data, resolveFormat(flags, true));
  return data;
}

async function list(ctx, _args, flags) {
  return listCompanies(ctx, "/company", "companyList", flags, { q: flags.q });
}

async function my(ctx, _args, flags) {
  return listCompanies(ctx, "/company/my", "companyList", flags);
}

async function shared(ctx, _args, flags) {
  return listCompanies(ctx, "/company/shared", "companyList", flags);
}

async function get(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic company get <alias>");
  const data = await http("GET", `${api}/company/${encodeURIComponent(alias)}`, token);
  printCompany(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.title) die("gitflic company create requires --title");
  if (!flags.alias) die("gitflic company create requires --alias");
  const body = {
    title: flags.title,
    alias: flags.alias,
    isPrivate: flags.private === true ? true : flags.private === false ? false : !!flags.private,
    description: flags.description || "",
  };
  const data = await http("POST", `${api}/company`, token, body);
  printCompany(data, resolveFormat(flags, false));
  return data;
}

async function memberList(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic company member list <companyAlias> [--q <userName>]");
  const qs = new URLSearchParams();
  if (flags.q) qs.set("q", flags.q);
  const url =
    `${api}/company/${encodeURIComponent(alias)}/member` +
    (qs.size ? `?${qs}` : "");
  const data = await http("GET", url, token);
  printMemberList(data, resolveFormat(flags, true));
  return data;
}

async function memberInvite(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  const userAlias = args[1] || flags.user;
  const role = args[2] || flags.role;
  if (!alias || !userAlias || !role)
    die("usage: gitflic company member invite <companyAlias> <userAlias> <role>  (role: GUEST|REPORTER|DEVELOPER|ADMIN)");
  const data = await http(
    "POST",
    `${api}/company/${encodeURIComponent(alias)}/member/invite`,
    token,
    { userAlias, role },
  );
  printJson(data);
  return data;
}

async function memberRole(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  const userAlias = args[1] || flags.user;
  const role = args[2] || flags.role;
  if (!alias || !userAlias || !role)
    die("usage: gitflic company member role <companyAlias> <userAlias> <role>  (role: GUEST|REPORTER|DEVELOPER|ADMIN)");
  const data = await http(
    "PUT",
    `${api}/company/${encodeURIComponent(alias)}/member/role`,
    token,
    { userAlias, role },
  );
  printJson(data);
  return data;
}

async function memberRemove(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  const userAlias = args[1];
  if (!alias || !userAlias)
    die("usage: gitflic company member remove <companyAlias> <userAlias>");
  const data = await http(
    "DELETE",
    `${api}/company/${encodeURIComponent(alias)}/member/${encodeURIComponent(userAlias)}`,
    token,
  );
  printJson(data ?? { ok: true });
  return data;
}

async function importGet(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic company import get <companyAlias>");
  const data = await http(
    "GET",
    `${api}/company/${encodeURIComponent(alias)}/setting/import`,
    token,
  );
  printJson(data);
  return data;
}

async function importRun(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic company import run <companyAlias> [--branch] [--environment] [--tag] [--mr-approval] [--pipeline-lifetime]");
  const body = {
    allowImportBranchProtection: !!flags.branch,
    allowImportEnvironmentProtection: !!flags.environment,
    allowImportTagProtection: !!flags.tag,
    allowImportMrApprovalConfigAndRules: !!flags["mr-approval"],
    allowImportPipelineLifetimeSetting: !!flags["pipeline-lifetime"],
  };
  const data = await http(
    "POST",
    `${api}/company/${encodeURIComponent(alias)}/setting/import`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `Company commands:
  company list [--q <query>]                            List public companies
  company my                                            List companies of the active user
  company shared                                        List companies the user participates in
  company get <alias>                                   Get one company
  company create --title <t> --alias <a> [--private] [--description <d>]
                                                        Create a company
  company member list <companyAlias> [--q <userName>]   List company members
  company member invite <companyAlias> <userAlias> <role>
                                                        Add member (role: GUEST|REPORTER|DEVELOPER|ADMIN)
  company member role <companyAlias> <userAlias> <role> Change member role
  company member remove <companyAlias> <userAlias>      Remove member from company
  company import get <companyAlias>                     Get template-import settings state
  company import run <companyAlias> [--branch] [--environment] [--tag] [--mr-approval] [--pipeline-lifetime]
                                                        Apply template-import settings to child projects

All list commands support --page/--size/--all/--stream/--format json.
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "my":
      return my(ctx, args, flags);
    case "shared":
      return shared(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "member": {
      const mSub = args[0];
      const mArgs = args.slice(1);
      switch (mSub) {
        case "list":
          return memberList(ctx, mArgs, flags);
        case "invite":
          return memberInvite(ctx, mArgs, flags);
        case "role":
          return memberRole(ctx, mArgs, flags);
        case "remove":
          return memberRemove(ctx, mArgs, flags);
        default:
          die(`unknown company member subcommand: ${mSub}. Use list | invite | role | remove.`);
      }
    }
    // eslint-disable-next-line no-fallthrough
    case "import": {
      const iSub = args[0];
      const iArgs = args.slice(1);
      switch (iSub) {
        case "get":
          return importGet(ctx, iArgs, flags);
        case "run":
          return importRun(ctx, iArgs, flags);
        default:
          die(`unknown company import subcommand: ${iSub}. Use get | run.`);
      }
    }
    // eslint-disable-next-line no-fallthrough
    default:
      die(`unknown company subcommand: ${sub}`);
  }
}
