// gitflic project — projects: CRUD, members, teams, deploy-token, archive,
// files, attachments, stars, mirror, fork, import, scripts, settings, size.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import {
  http,
  httpDownload,
  httpMultipart,
  projectIdFromOwnerAlias,
} from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

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

// Resolve owner/alias for project-scoped subcommands. `project` is a GLOBAL
// command (see lib/gitflic.mjs), so ctx.owner/ctx.alias are NOT pre-populated;
// derive them from flags.project (canonicalized to "owner/alias" by the
// dispatcher when --project / default-project / git autodetect succeeds).
function requireScope(ctx, sub) {
  let owner = ctx.owner;
  let alias = ctx.alias;
  if ((!owner || !alias) && ctx.flags && ctx.flags.project) {
    const m = String(ctx.flags.project).match(/^([^/]+)\/([^/]+)$/);
    if (m) {
      owner = m[1];
      alias = m[2];
    }
  }
  if (!owner || !alias) die(`project ${sub}: missing --project owner/alias`);
  return { owner, alias };
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
    url = `${api}/project/${encodeURIComponent(ref)}`;
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
  // DELETE /project/{projectUuid}/delete
  await http("DELETE", `${api}/project/${encodeURIComponent(cur.id)}/delete`, token);
  process.stdout.write(`gitflic: project '${cur.alias}' deleted\n`);
}

// GET /project, /project/my, /project/shared (all support q + pagination).
async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const scope = flags.scope || "public";
  const basePath =
    scope === "my" ? "/project/my"
      : scope === "shared" ? "/project/shared"
      : "/project";
  const extraQs = { q: flags.q };
  // /project/shared additionally accepts qName / qOwner.
  if (scope === "shared") {
    extraQs.qName = flags.qName || flags["q-name"];
    extraQs.qOwner = flags.qOwner || flags["q-owner"];
  }
  const data = await paginatedList({
    api, token,
    path: basePath,
    embeddedKey: "projectList",
    flags,
    extraQs,
  });
  if (data === null) return null; // streamed
  printProjectList(data, resolveFormat(flags, true));
  return data;
}

// GET /project/allowed-owners
async function allowedOwners(ctx) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/project/allowed-owners`, token);
  printJson(data);
  return data;
}

// GET /project/{projectUuid}/project-size
async function projectSize(ctx, args, flags) {
  const { api, token } = ctx;
  // Accept an explicit ref arg (owner/alias or uuid) or fall back to --project.
  let uuid = args[0];
  if (uuid && uuid.includes("/")) {
    const [o, a] = uuid.split("/");
    const proj = await projectIdFromOwnerAlias(api, token, o, a);
    uuid = proj.id;
  } else if (!uuid) {
    const { owner, alias } = requireScope(ctx, "project-size");
    const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
    uuid = proj.id;
  }
  const data = await http(
    "GET",
    `${api}/project/${encodeURIComponent(uuid)}/project-size`,
    token,
  );
  printJson(data);
  return data;
}

// ---- members (UUID-scoped per spec) -------------------------------------

async function memberList(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "member list");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  const qs = new URLSearchParams();
  if (flags.q) qs.set("q", flags.q);
  // GET /project/{projectUuid}/member?q={userName}
  const data = await http(
    "GET",
    `${api}/project/${encodeURIComponent(proj.id)}/member${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function memberInvite(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "member invite");
  const userAlias = args[0];
  if (!userAlias || !flags.role)
    die("usage: gitflic project member invite <userAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN|OWNER");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // POST /project/{projectUuid}/member/invite  body: { userAlias, role }
  const data = await http(
    "POST",
    `${api}/project/${encodeURIComponent(proj.id)}/member/invite`,
    token,
    { userAlias, role: flags.role },
  );
  printJson(data);
  return data;
}

async function memberRole(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "member role");
  const userAlias = args[0];
  if (!userAlias || !flags.role)
    die("usage: gitflic project member role <userAlias> --role <role>");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // PUT /project/{projectUuid}/member/role  body: { userAlias, role }
  const data = await http(
    "PUT",
    `${api}/project/${encodeURIComponent(proj.id)}/member/role`,
    token,
    { userAlias, role: flags.role },
  );
  printJson(data);
  return data;
}

async function memberDelete(ctx, args) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "member delete");
  const userAlias = args[0];
  if (!userAlias) die("usage: gitflic project member delete <userAlias>");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // DELETE /project/{projectUuid}/member/{userAlias}
  await http(
    "DELETE",
    `${api}/project/${encodeURIComponent(proj.id)}/member/${encodeURIComponent(userAlias)}`,
    token,
  );
  process.stdout.write(`gitflic: member '${userAlias}' removed\n`);
}

// ---- teams (UUID-scoped per spec) ---------------------------------------

async function teamInvite(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "team invite");
  const teamAlias = args[0];
  if (!teamAlias || !flags.role)
    die("usage: gitflic project team invite <teamAlias> --role GUEST|REPORTER|DEVELOPER|ADMIN");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // POST /project/{projectUuid}/member/team/invite  body: { teamAlias, maxRole }
  const data = await http(
    "POST",
    `${api}/project/${encodeURIComponent(proj.id)}/member/team/invite`,
    token,
    { teamAlias, maxRole: flags.role },
  );
  printJson(data);
  return data;
}

async function teamRole(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "team role");
  const teamAlias = args[0];
  if (!teamAlias || !flags.role)
    die("usage: gitflic project team role <teamAlias> --role <role>");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // PUT /project/{projectUuid}/member/team/role  body: { teamAlias, maxRole }
  const data = await http(
    "PUT",
    `${api}/project/${encodeURIComponent(proj.id)}/member/team/role`,
    token,
    { teamAlias, maxRole: flags.role },
  );
  printJson(data);
  return data;
}

async function teamDelete(ctx, args) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "team delete");
  const teamAlias = args[0];
  if (!teamAlias) die("usage: gitflic project team delete <teamAlias>");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  // DELETE /project/{projectUuid}/member/team/{teamAlias}
  await http(
    "DELETE",
    `${api}/project/${encodeURIComponent(proj.id)}/member/team/${encodeURIComponent(teamAlias)}`,
    token,
  );
  process.stdout.write(`gitflic: team '${teamAlias}' removed\n`);
}

// ---- archive / files / followers / stars / forked -----------------------

// GET /project/{owner}/{alias}/file/getArchive?branch={branch}
async function archive(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "archive");
  const branch = args[0] || flags.branch || "master";
  const qs = new URLSearchParams({ branch });
  const dest = flags.out || flags.output || `${alias}-${branch}.tar.gz`;
  const { path, bytes } = await httpDownload(
    `${urlProject(api, owner, alias)}/file/getArchive?${qs}`,
    token,
    dest,
  );
  process.stdout.write(`gitflic: saved ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

// GET /project/{owner}/{alias}/files?filepath=&branch=
async function files(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "files");
  const qs = new URLSearchParams();
  if (flags.path || flags.filepath) qs.set("filepath", flags.filepath || flags.path);
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
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "followers");
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/followers",
    embeddedKey: "userList",
    flags,
  });
  if (data === null) return null;
  printJson(data);
  return data;
}

async function stars(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "stars");
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/stars",
    embeddedKey: "userList",
    flags,
  });
  if (data === null) return null;
  printJson(data);
  return data;
}

// GET /project/{owner}/{alias}/forked — list forks of a project.
async function forked(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "forked");
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/forked",
    embeddedKey: "projectList",
    flags,
  });
  if (data === null) return null;
  printProjectList(data, resolveFormat(flags, true));
  return data;
}

// ---- fork / mirror / import / manual-update -----------------------------

// POST /project/{owner}/{alias}/create-fork
async function createFork(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "fork");
  const cur = await projectIdFromOwnerAlias(api, token, owner, alias);
  const body = {
    title: flags.title || cur.title || flags.alias || cur.alias,
    isPrivate: flags.private ? true : flags.public ? false : cur.private,
    alias: flags["new-alias"] || flags.alias || cur.alias,
    ownerAlias: flags["owner-alias"] || (await defaultOwner(ctx)),
    ownerAliasType: flags["owner-alias-type"] || "USER",
    language: flags.language || cur.language || "Markdown",
  };
  if (flags.description) body.description = flags.description;
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/create-fork`,
    token,
    body,
  );
  printProject(data, resolveFormat(flags, false));
  return data;
}

// POST /project/create-mirror — creates a brand new mirror project.
async function createMirror(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.url || !flags.alias)
    die("usage: gitflic project create-mirror --url <git-url> --alias A [--title T] [--type PULL|PUSH] [--private] [--owner-alias U] [--login L] [--token-secret T] [--ref-spec S]...");
  const body = {
    title: flags.title || flags.alias,
    isPrivate: flags.private ? true : false,
    alias: flags.alias,
    ownerAlias: flags["owner-alias"] || (await defaultOwner(ctx)),
    ownerAliasType: flags["owner-alias-type"] || "USER",
    language: flags.language || "Markdown",
    gitSource: flags.url,
    mirrorType: flags.type || "PULL",
  };
  if (flags.description) body.description = flags.description;
  if (flags.login) body.login = flags.login;
  if (flags["token-secret"]) body.token = flags["token-secret"];
  if (flags["ref-spec"]) body.refSpecs = [flags["ref-spec"]].flat().filter(Boolean);
  const data = await http("POST", `${api}/project/create-mirror`, token, body);
  printProject(data, resolveFormat(flags, false));
  return data;
}

// POST /project/{owner}/{alias}/to-push-mirror — convert project to PUSH mirror.
async function toPushMirror(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "to-push-mirror");
  if (!flags.source)
    die("usage: gitflic project to-push-mirror --source <git-url> [--login L] [--token-secret T] [--control-string owner/alias]");
  const body = {
    source: flags.source,
    controlString: flags["control-string"] || `${owner}/${alias}`,
  };
  if (flags.login) body.login = flags.login;
  if (flags["token-secret"]) body.token = flags["token-secret"];
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/to-push-mirror`,
    token,
    body,
  );
  printJson(data);
  return data;
}

// POST /project/{owner}/{alias}/manual-update — trigger a mirror sync.
async function manualUpdate(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "manual-update");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/manual-update`,
    token,
  );
  printJson(data);
  return data;
}

// POST /project/import-base
async function importBase(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.url || !flags["new-alias"])
    die("usage: gitflic project import --url <git-url> --new-alias <alias> [--title T] [--private] [--login L] [--token-secret T]");
  const body = {
    title: flags.title || flags["new-alias"],
    isPrivate: flags.private ? "true" : "false",
    alias: flags["new-alias"],
    ownerAlias: flags["owner-alias"] || (await defaultOwner(ctx)),
    ownerAliasType: flags["owner-alias-type"] || "USER",
    language: flags.language || "Markdown",
    gitSource: flags.url,
  };
  if (flags.login) body.login = flags.login;
  if (flags["token-secret"]) body.token = flags["token-secret"];
  if (flags.description) body.description = flags.description;
  const data = await http("POST", `${api}/project/import-base`, token, body);
  printProject(data, resolveFormat(flags, false));
  return data;
}

// ---- settings / scripts -------------------------------------------------

// PUT /project/{owner}/{alias}/setting/change-setting
async function changeSetting(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "change-setting");
  const body = {};
  if (flags.title !== undefined) body.title = flags.title;
  if (flags.description !== undefined) body.description = flags.description;
  if (flags.language !== undefined) body.language = flags.language;
  if (flags.topics !== undefined)
    body.topics = String(flags.topics).split(",").map((t) => t.trim()).filter(Boolean);
  if (!Object.keys(body).length)
    die("usage: gitflic project change-setting [--title T] [--description D] [--language L] [--topics a,b,c]");
  const data = await http(
    "PUT",
    `${urlProject(api, owner, alias)}/setting/change-setting`,
    token,
    body,
  );
  printProject(data, resolveFormat(flags, false));
  return data;
}

// POST /project/{owner}/{alias}/script/{scriptUuid}
async function runScript(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "run-script");
  const scriptUuid = args[0] || flags.script;
  if (!scriptUuid)
    die("usage: gitflic project run-script <scriptUuid>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/script/${encodeURIComponent(scriptUuid)}`,
    token,
  );
  printJson(data);
  return data;
}

// ---- file attachments ---------------------------------------------------

// GET /project/{owner}/{alias}/upload-files — list attached files.
async function uploadFiles(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "upload-files");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/upload-files`,
    token,
  );
  printJson(data);
  return data;
}

// POST /project/{owner}/{alias}/upload — multipart attachment upload.
async function upload(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "upload");
  const filePath = args[0] || flags.file;
  if (!filePath) die("usage: gitflic project upload <file> (multipart attachment, max 10MB)");
  const data = await httpMultipart(`${urlProject(api, owner, alias)}/upload`, token, {
    fileFields: [{ name: "attachment", path: filePath }],
  });
  printJson(data);
  return data;
}

// DELETE /project/{owner}/{alias}/delete-file?uploadFileUuid={uuid}
async function deleteFile(ctx, args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "delete-file");
  const uuid = args[0] || flags["file-uuid"] || flags.uuid;
  if (!uuid) die("usage: gitflic project delete-file <uploadFileUuid>");
  const qs = new URLSearchParams({ uploadFileUuid: uuid });
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/delete-file?${qs}`,
    token,
  );
  process.stdout.write(`gitflic: attachment '${uuid}' removed\n`);
}

// ---- deploy-token -------------------------------------------------------

// POST /project/{owner}/{alias}/setting/deploy-token/create
async function deployTokenCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  const { owner, alias } = requireScope(ctx, "deploy-token create");
  if (!flags.name && !flags.title)
    die("usage: gitflic project deploy-token create --name <name> [--scope REPOSITORY_READ|REPOSITORY_WRITE]... [--expires <ISO>]");
  const scopes = [flags.scope].flat().filter(Boolean);
  const body = {
    title: flags.name || flags.title,
    scopes: scopes.length ? scopes : ["REPOSITORY_READ"],
  };
  if (flags.expires) body.expiresAt = flags.expires;
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/setting/deploy-token/create`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `Project commands:

  CRUD & discovery:
    project list [--scope public|my|shared] [--q <query>]
                 [--q-name N] [--q-owner O] [--page N] [--size N] [--all]
                                                        List/search projects (public|my|shared)
    project get <owner/alias> OR <uuid>                  Get project (alias or UUID)
    project create --title T --alias <alias> [--private|--public]
                          [--language L] [--description D]
                          [--owner-alias U] [--owner-alias-type USER|TEAM|COMPANY]
                                                        Create project
    project edit <owner/alias> [--title T] [--description D] [--private|--public] [--language L] [--default-branch B]
                                                        Edit project (PUT /project)
    project change-setting [--title T] [--description D] [--language L] [--topics a,b,c]
                                                        Update project settings (--project)
    project delete <owner/alias>                         Delete project
    project allowed-owners                               List owners you can create projects under
    project project-size [<owner/alias>|<uuid>]          Storage size breakdown (defaults to --project)

  Members & teams (need --project owner/alias):
    project member list [--q name]                       List project members
    project member invite <userAlias> --role <role>      Add user (GUEST|REPORTER|DEVELOPER|ADMIN|OWNER)
    project member role <userAlias> --role <role>        Change member role
    project member delete <userAlias>                    Remove member
    project team invite <teamAlias> --role <role>        Add team (GUEST|REPORTER|DEVELOPER|ADMIN)
    project team role <teamAlias> --role <role>          Change team role
    project team delete <teamAlias>                      Remove team

  Archive / files / attachments / social (need --project):
    project archive [branch] [--out FILE]                Download repo archive (tar.gz)
    project files [--path P] [--branch B]                List files in repo tree
    project upload-files                                 List attached files
    project upload <file>                                Attach a file (multipart, max 10MB)
    project delete-file <uploadFileUuid>                 Delete an attachment
    project followers [--page N]                         List followers
    project stars [--page N]                             List stargazers
    project forked [--page N]                            List forks of this project

  Fork / mirror / import (need --project unless noted):
    project fork [--new-alias A] [--owner-alias U] [--private|--public]
                                                        Fork project (POST .../create-fork)
    project create-mirror --url <git-url> --alias A [--type PULL|PUSH] [--private]
                          [--owner-alias U] [--login L] [--token-secret T] [--ref-spec S]
                                                        Create new mirror project (no --project)
    project to-push-mirror --source <git-url> [--login L] [--token-secret T] [--control-string o/a]
                                                        Convert project to PUSH mirror
    project manual-update                                Trigger a mirror sync
    project import --url <git-url> --new-alias A [--title T] [--private] [--login L] [--token-secret T]
                                                        Import external repo (no --project)

  Scripts & deploy tokens (need --project):
    project run-script <scriptUuid>                      Run a project script
    project deploy-token create --name N [--scope ...] [--expires ISO]
                                                        Create deploy token (for git push)
`;

export async function handle(ctx, sub, args, flags) {
  if (sub === "member") return dispatchMember(ctx, args[0], args.slice(1), flags);
  if (sub === "team") return dispatchTeam(ctx, args[0], args.slice(1), flags);
  if (sub === "deploy-token") return dispatchDeployToken(ctx, args[0], args.slice(1), flags);

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
    case "change-setting":
      return changeSetting(ctx, args, flags);
    case "delete":
      return deleteProject(ctx, args);
    case "allowed-owners":
      return allowedOwners(ctx, args, flags);
    case "project-size":
      return projectSize(ctx, args, flags);
    case "archive":
      return archive(ctx, args, flags);
    case "files":
      return files(ctx, args, flags);
    case "upload-files":
      return uploadFiles(ctx, args, flags);
    case "upload":
      return upload(ctx, args, flags);
    case "delete-file":
      return deleteFile(ctx, args, flags);
    case "followers":
      return followers(ctx, args, flags);
    case "stars":
      return stars(ctx, args, flags);
    case "forked":
      return forked(ctx, args, flags);
    case "fork":
      return createFork(ctx, args, flags);
    case "create-mirror":
    case "mirror":
      return createMirror(ctx, args, flags);
    case "to-push-mirror":
      return toPushMirror(ctx, args, flags);
    case "manual-update":
      return manualUpdate(ctx, args, flags);
    case "import":
      return importBase(ctx, args, flags);
    case "run-script":
      return runScript(ctx, args, flags);
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
    case "role":
      return teamRole(ctx, args, flags);
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
