// gitflic project — projects: CRUD, members, teams, deploy-token, archive, files, stars, mirror, fork, import.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http, projectIdFromOwnerAlias } from "../http.mjs";

function printProject(p, format) {
  if (format === "json") return printJson(p);
  process.stdout.write(
    `${color(p.title, 1)} (${p.owner?.alias || "—"}/${p.alias})\n` +
      `  id:             ${p.id}\n` +
      `  defaultBranch:  ${p.defaultBranch}\n` +
      `  private:        ${p.private}\n` +
      `  mirror:         ${p.mirror}\n` +
      `  language:       ${p.language}\n` +
      `  httpUrl:        ${p.httpTransportUrl}\n` +
      `  sshUrl:         ${p.sshTransportUrl}\n` +
      (p.description ? `  description:    ${p.description.split("\n")[0]}\n` : ""),
  );
}

function printProjectList(data, format) {
  const list = data?._embedded?.projectList || data?._embedded?.ProjectList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("projects");
  for (const p of list) {
    process.stdout.write(
      `${color(p.title, 1)} (${p.owner?.alias || "—"}/${p.alias})${p.private ? " [private]" : ""}\n` +
        `  ${p.httpTransportUrl || ""}\n`,
    );
  }
}

// ---- CRUD ----------------------------------------------------------------

async function create(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.title || !flags.alias)
    die("usage: gitflic project create --title T --alias <project-alias> [--owner-alias <user|team|company>] [--owner-alias-type USER] [--language <lang>] [--private|--public] [--description D]");
  const body = {
    title: flags.title,
    isPrivate: flags.private ? "true" : flags.public ? "false" : "true",
    alias: flags.alias,
    ownerAlias: flags["owner-alias"] || flags.owner || (await defaultOwner(ctx)),
    ownerAliasType: flags["owner-alias-type"] || flags["owner-type"] || "USER",
    language: flags.language || "Markdown",
  };
  if (flags.description) body.description = flags.description;
  const data = await http("POST", `${api}/project`, token, body);
  printProject(data, resolveFormat(flags, false));
  return data;
}

async function defaultOwner(ctx) {
  // Best-effort: use the current user's username
  try {
    const me = await http("GET", `${ctx.api}/user/me`, ctx.token);
    return me.username;
  } catch {
    die("could not determine owner; pass --owner-alias");
  }
}

async function get(ctx, args, flags) {
  const { api, token } = ctx;
  const ref = args[0];
  if (!ref) die("usage: gitflic project get <owner/alias> OR <uuid>");
  let url;
  if (ref.includes("/")) {
    const [o, a] = ref.split("/");
    url = `${api}/project/${encodeURIComponent(o)}/${encodeURIComponent(a)}`;
  } else {
    url = `${api}/project/${ref}`;
  }
  const data = await http("GET", url, token);
  printProject(data, resolveFormat(flags, false));
  return data;
}

async function edit(ctx, args, flags) {
  const { api, token } = ctx;
  const ref = args[0];
  if (!ref) die("usage: gitflic project edit <owner/alias> [--title T] [--description D] [--private|--public] [--language L]");
  const cur = await get(ctx, args, { format: "json" });
  const body = {
    id: cur.id,
    title: flags.title || cur.title,
    description: flags.description !== undefined ? flags.description : cur.description,
    private: flags.private ? true : flags.public ? false : cur.private,
    language: flags.language || cur.language,
    alias: cur.alias,
    ownerAlias: cur.owner?.alias,
  };
  if (flags.defaultBranch) body.defaultBranch = flags.defaultBranch;
  const data = await http("PUT", `${api}/project`, token, body);
  printProject(data, resolveFormat(flags, false));
  return data;
}

async function deleteProject(ctx, args) {
  const { api, token } = ctx;
  const ref = args[0];
  if (!ref) die("usage: gitflic project delete <owner/alias>");
  const cur = await get(ctx, args, { format: "json" });
  await http("DELETE", `${api}/project/${cur.id}/delete`, token);
  process.stdout.write(`gitflic: project '${cur.alias}' deleted\n`);
}

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const scope = flags.scope || "public";
  const basePath =
    scope === "my" ? "/project/my"
      : scope === "shared" ? "/project/shared"
      : "/project";
  const data = await paginatedList({
    api, token,
    path: basePath,
    embeddedKey: "projectList",
    flags,
    extraQs: { q: flags.q },
  });
  if (data === null) return null; // streamed
  printProjectList(data, resolveFormat(flags, true));
  return data;
}

// ---- members / teams ----------------------------------------------------

async function memberList(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/member`,
    token,
  );
  printJson(data);
  return data;
}

async function memberInvite(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const userAlias = args[0];
  if (!userAlias || !flags.role) die("usage: gitflic project member invite <userAlias> --role GUEST|REPORTER|DEVELOPER|MAINTAINER|OWNER");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/member/${encodeURIComponent(userAlias)}/invite`,
    token,
    { role: flags.role },
  );
  printJson(data);
  return data;
}

async function memberRole(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const userAlias = args[0];
  if (!userAlias || !flags.role) die("usage: gitflic project member role <userAlias> --role <role>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/member/${encodeURIComponent(userAlias)}/role`,
    token,
    { role: flags.role },
  );
  printJson(data);
  return data;
}

async function memberDelete(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const userAlias = args[0];
  if (!userAlias) die("usage: gitflic project member delete <userAlias>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/member/${encodeURIComponent(userAlias)}`,
    token,
  );
  process.stdout.write(`gitflic: member '${userAlias}' removed\n`);
}

async function teamInvite(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const teamAlias = args[0];
  if (!teamAlias || !flags.role) die("usage: gitflic project team invite <teamAlias> --role <role>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/team/${encodeURIComponent(teamAlias)}/invite`,
    token,
    { role: flags.role },
  );
  printJson(data);
  return data;
}

async function teamDelete(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const teamAlias = args[0];
  if (!teamAlias) die("usage: gitflic project team delete <teamAlias>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/team/${encodeURIComponent(teamAlias)}`,
    token,
  );
  process.stdout.write(`gitflic: team '${teamAlias}' removed\n`);
}

// ---- archive / files / followers / stars --------------------------------

async function archive(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const branch = args[0] || "master";
  const qs = new URLSearchParams({ branch });
  const res = await fetch(`${urlProject(api, owner, alias)}/file/getArchive?${qs}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) die(`HTTP ${res.status} ${res.statusText}`);
  process.stdout.write(Buffer.from(await res.arrayBuffer()));
}

async function files(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const qs = new URLSearchParams();
  if (flags.path) qs.set("path", flags.path);
  if (flags.branch) qs.set("branch", flags.branch);
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/files${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function followers(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/followers`,
    token,
  );
  printJson(data);
  return data;
}

async function stars(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/stars`,
    token,
  );
  printJson(data);
  return data;
}

// ---- fork / mirror / import ---------------------------------------------

async function fork(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  const data = await http(
    "POST",
    `${api}/project/${proj.id}/forked`,
    token,
    { name: flags["new-alias"] || flags.alias || proj.alias },
  );
  printJson(data);
  return data;
}

async function createMirror(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  if (!flags.url) die("usage: gitflic project mirror --url <git-url> [--type PULL|PUSH]");
  const data = await http(
    "POST",
    `${api}/project/${proj.id}/create-mirror`,
    token,
    { mirrorUrl: flags.url, mirrorType: flags.type || "PULL" },
  );
  printJson(data);
  return data;
}

async function importBase(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.url || !flags["new-alias"])
    die("usage: gitflic project import --url <git-url> --new-alias <alias> [--title T] [--private]");
  const body = {
    url: flags.url,
    alias: flags["new-alias"],
    title: flags.title || flags["new-alias"],
    isPrivate: flags.private ? "true" : "false",
    language: flags.language || "Markdown",
    ownerAlias: flags["owner-alias"] || (await defaultOwner(ctx)),
    ownerAliasType: flags["owner-alias-type"] || "USER",
  };
  if (flags.description) body.description = flags.description;
  const data = await http("POST", `${api}/project/import-base`, token, body);
  printJson(data);
  return data;
}

// ---- deploy-token -------------------------------------------------------

async function deployTokenCreate(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.name) die("usage: gitflic project deploy-token create --name <name> [--scope READ_REGISTRY|REPOSITORY_READ|REPOSITORY_WRITE] [--expires <ISO>]");
  const scopes = [flags.scope].flat().filter(Boolean);
  const body = { name: flags.name, scopes: scopes.length ? scopes : ["REPOSITORY_READ"] };
  if (flags.expires) body.expiresAt = flags.expires;
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/deploy-token/create`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `Project commands:

  CRUD:
    project list [--scope public|my|shared] [--q <query>] [--page N]
                                                        List projects
    project get <owner/alias> OR <uuid>                  Get project (alias -> UUID)
    project create --title T --alias <alias> [--private|--public]
                          [--language L] [--description D]
                          [--owner-alias U] [--owner-alias-type USER|TEAM|COMPANY]
                                                        Create project
    project edit <owner/alias> [--title T] [--description D] [--private|--public] [--language L] [--default-branch B]
                                                        Edit project
    project delete <owner/alias>                         Delete project

  Members & teams (need --project owner/alias):
    project member list                                  List project members
    project member invite <userAlias> --role <role>      Invite user (role: GUEST|REPORTER|DEVELOPER|MAINTAINER|OWNER)
    project member role <userAlias> --role <role>        Change member role
    project member delete <userAlias>                    Remove member
    project team invite <teamAlias> --role <role>        Invite team to project
    project team delete <teamAlias>                      Remove team from project

  Archive / files / social:
    project archive [branch] > out.tar.gz               Download repo archive (binary)
    project files [--path P] [--branch B]                List files in repo
    project followers                                   List followers
    project stars                                        List stargazers

  Fork / mirror / import:
    project fork [--new-alias A]                        Fork project under current user
    project mirror --url <git-url> [--type PULL|PUSH]    Create mirror
    project import --url <git-url> --new-alias A [--title T] [--private]
                                                        Import external repo

  Deploy tokens (need --project):
    project deploy-token create --name N [--scope ...]   Create deploy token (for git push)
`;

export async function handle(ctx, sub, args, flags) {
  if (sub === "member") return dispatchMember(ctx, args[0], args.slice(1), flags);
  if (sub === "team") return dispatchTeam(ctx, args[0], args.slice(1), flags);
  if (sub === "deploy-token") return dispatchDeployToken(ctx, args[0], args.slice(1), flags);
  // Sub-commands that DON'T need --project (they take ref from args or flags)
  const NO_PROJECT_NEEDED = new Set([
    undefined, "list", "create", "get", "delete", "import", "fork",
  ]);
  // For sub-commands that need a project (member/team/archive/files/followers/stars/mirror/deploy-token),
  // ensure owner/alias is resolved from --project.
  if (!NO_PROJECT_NEEDED.has(sub) && (!ctx.owner || !ctx.alias)) {
    die(`project ${sub}: missing --project owner/alias`);
  }
  // For sub-commands that take an explicit project ref in arg, fall through
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
      return deleteProject(ctx, args);
    case "archive":
      return archive(ctx, args, flags);
    case "files":
      return files(ctx, args, flags);
    case "followers":
      return followers(ctx, args, flags);
    case "stars":
      return stars(ctx, args, flags);
    case "fork":
      return fork(ctx, args, flags);
    case "mirror":
      return createMirror(ctx, args, flags);
    default:
      die(`unknown project subcommand: ${sub}`);
  }
}

function dispatchMember(ctx, sub, args, flags) {
  switch (sub) {
    case "list":
    case undefined:
      return memberList(ctx, args, flags);
    case "invite":
      return memberInvite(ctx, args, flags);
    case "role":
      return memberRole(ctx, args, flags);
    case "delete":
      return memberDelete(ctx, args);
    default:
      die(`unknown project member subcommand: ${sub}`);
  }
}
function dispatchTeam(ctx, sub, args, flags) {
  switch (sub) {
    case "invite":
      return teamInvite(ctx, args, flags);
    case "delete":
      return teamDelete(ctx, args);
    default:
      die(`unknown project team subcommand: ${sub}`);
  }
}
function dispatchDeployToken(ctx, sub, args, flags) {
  switch (sub) {
    case "create":
      return deployTokenCreate(ctx, args, flags);
    default:
      die(`unknown project deploy-token subcommand: ${sub}`);
  }
}