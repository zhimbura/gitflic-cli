// gitflic team — teams.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList, buildPageQs } from "../paginate.mjs";

function printTeam(t, format) {
  if (format === "json") return printJson(t);
  process.stdout.write(
    `${color(t.alias || "?", 1)} (${t.title || t.name || "—"})\n` +
      `  id:          ${t.id}\n` +
      `  owner:       ${t.ownerAlias || "—"}\n` +
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
  if (data === null) return null; // streamed
  printTeamList(data, resolveFormat(flags, true));
  return data;
}

async function listScoped(ctx, scope, flags) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path: `/team/${scope}`,
    embeddedKey: "teamList",
    flags,
  });
  if (data === null) return null; // streamed
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
  const title = flags.title || flags.name;
  if (!flags.alias || !title) {
    die(
      "usage: gitflic team create --alias A --title N [--description D] [--private] " +
        "[--owner ALIAS --owner-type USER|COMPANY]",
    );
  }
  // ownerAlias/ownerAliasType are required by the API. Default to the current
  // user (USER scope) when not given, so `team create --alias A --title N` works.
  let ownerAlias = flags.owner;
  let ownerAliasType = flags["owner-type"] || "USER";
  if (!ownerAlias) {
    const me = await http("GET", `${api}/user/me`, token);
    ownerAlias = me.username;
    ownerAliasType = "USER";
  }
  const body = {
    alias: flags.alias,
    title,
    description: flags.description || "",
    isPrivate: flags.private ? "true" : "false",
    ownerAlias,
    ownerAliasType,
  };
  const data = await http("POST", `${api}/team`, token, body);
  printTeam(data, resolveFormat(flags, false));
  return data;
}

// NOTE: GitFlic's public REST API has NO team edit or team delete endpoint
// (PUT/DELETE /team/{alias} both return HTTP 405). Edit/delete a team via the
// GitFlic web UI. Use `team transfer` to change ownership.

async function transfer(ctx, _args, flags) {
  const { api, token } = ctx;
  const teamAlias = flags.team || flags.alias;
  const ownerAlias = flags.owner || flags.to;
  if (!teamAlias || !ownerAlias) {
    die("usage: gitflic team transfer --team ALIAS --owner NEW_OWNER_ALIAS");
  }
  const data = await http("POST", `${api}/team/transfer`, token, {
    teamAlias,
    ownerAlias,
  });
  printTeam(data, resolveFormat(flags, false));
  return data;
}

async function memberList(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team member list <teamAlias> [--q userName]");
  const qs = buildPageQs(flags, { withExtra: { q: flags.q } });
  const url = `${api}/team/${encodeURIComponent(alias)}/member${qs.toString() ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
  printJson(data);
  return data;
}

async function memberInvite(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  const userAlias = args[1] || flags.user;
  const role = flags.role;
  if (!alias || !userAlias || !role) {
    die("usage: gitflic team member invite <teamAlias> <userAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN");
  }
  const data = await http(
    "POST",
    `${api}/team/${encodeURIComponent(alias)}/member/invite`,
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
  const role = flags.role;
  if (!alias || !userAlias || !role) {
    die("usage: gitflic team member role <teamAlias> <userAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN");
  }
  const data = await http(
    "PUT",
    `${api}/team/${encodeURIComponent(alias)}/member/role`,
    token,
    { userAlias, role },
  );
  printJson(data);
  return data;
}

async function memberRemove(ctx, args) {
  const { api, token } = ctx;
  const alias = args[0];
  const userAlias = args[1];
  if (!alias || !userAlias) die("usage: gitflic team member remove <teamAlias> <userAlias>");
  await http(
    "DELETE",
    `${api}/team/${encodeURIComponent(alias)}/member/${encodeURIComponent(userAlias)}`,
    token,
  );
  process.stdout.write(`gitflic: removed '${userAlias}' from team '${alias}'\n`);
}

async function importGet(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) die("usage: gitflic team import get <teamAlias>");
  const data = await http(
    "GET",
    `${api}/team/${encodeURIComponent(alias)}/setting/import`,
    token,
  );
  if (resolveFormat(flags, false) === "json") return printJson(data), data;
  printJson(data);
  return data;
}

async function importRun(ctx, args, flags) {
  const { api, token } = ctx;
  const alias = args[0];
  if (!alias) {
    die(
      "usage: gitflic team import set <teamAlias> [--branch] [--environment] [--tag] " +
        "[--mr-approval] [--pipeline-lifetime]",
    );
  }
  const body = {
    allowImportBranchProtection: !!flags.branch,
    allowImportEnvironmentProtection: !!flags.environment,
    allowImportTagProtection: !!flags.tag,
    allowImportMrApprovalConfigAndRules: !!flags["mr-approval"],
    allowImportPipelineLifetimeSetting: !!flags["pipeline-lifetime"],
  };
  const data = await http(
    "POST",
    `${api}/team/${encodeURIComponent(alias)}/setting/import`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `Team commands:
  team list [--q <query>] [--page N --size N]           List public teams
  team my [--page N --size N]                           List teams you belong to
  team shared [--page N --size N]                       List teams shared with you
  team get <alias>                                      Get one team
  team create --alias A --title N [--description D] [--private] [--owner ALIAS --owner-type USER|COMPANY]
                                                         Create team (owner defaults to you)
  team transfer --team ALIAS --owner NEW_OWNER          Transfer team to a new owner
  (note: GitFlic REST has no team edit/delete — use the web UI)
  team member list <teamAlias> [--q userName] [--page N --size N]
                                                         List team members
  team member invite <teamAlias> <userAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN
                                                         Invite a user to the team
  team member role <teamAlias> <userAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN
                                                         Change a member's role
  team member remove <teamAlias> <userAlias>            Remove a member from the team
  team import get <teamAlias>                           Get template-settings import state
  team import set <teamAlias> [--branch] [--environment] [--tag] [--mr-approval] [--pipeline-lifetime]
                                                         Set which protections import to child projects
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "my":
      return listScoped(ctx, "my", flags);
    case "shared":
      return listScoped(ctx, "shared", flags);
    case "get":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "transfer":
      return transfer(ctx, args, flags);
    case "member": {
      const mSub = args[0];
      const mArgs = args.slice(1);
      switch (mSub) {
        case undefined:
        case "list":
          return memberList(ctx, mArgs, flags);
        case "invite":
          return memberInvite(ctx, mArgs, flags);
        case "role":
          return memberRole(ctx, mArgs, flags);
        case "remove":
        case "delete":
          return memberRemove(ctx, mArgs);
        default:
          die(`unknown team member subcommand: ${mSub}. Use list | invite | role | remove.`);
      }
    }
    // eslint-disable-next-line no-fallthrough
    case "members":
      // backward-compat alias for `team member list <alias>`
      return memberList(ctx, args, flags);
    case "import": {
      const iSub = args[0];
      const iArgs = args.slice(1);
      switch (iSub) {
        case "get":
          return importGet(ctx, iArgs, flags);
        case "set":
        case "run":
          return importRun(ctx, iArgs, flags);
        default:
          die(`unknown team import subcommand: ${iSub}. Use get | set.`);
      }
    }
    // eslint-disable-next-line no-fallthrough
    default:
      die(`unknown team subcommand: ${sub}`);
  }
}
