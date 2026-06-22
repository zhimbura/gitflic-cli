// gitflic issue — issues + comments + relations + attachments.

import {
  color,
  short,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  statusColor,
  urlProject,
} from "../format.mjs";
import { http, httpMultipart } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";
import { existsSync } from "node:fs";

const VALID_ISSUE_STATUS = ["OPEN", "IN_PROGRESS", "CLOSED", "COMPLETED"];

function printIssue(i, format) {
  if (format === "json") return printJson(i);
  const st = i.status;
  const stStr = `${statusColor(st)}${st?.title || st?.id || "?"}\x1b[0m`;
  process.stdout.write(
    `#${color(String(i.localId), 36)} ${color(i.title || "(no title)", 1)}  ${stStr}\n` +
      `  id:       ${i.id}\n` +
      `  labels:   ${(i.labels || []).map((l) => l.title).join(", ") || "—"}\n` +
      `  assigned: ${(i.assignedUsers || []).map((u) => u.username).join(", ") || "—"}\n` +
      `  created:  ${i.createdAt}\n` +
      `  updated:  ${i.updatedAt}\n`,
  );
  if (i.description) {
    process.stdout.write(`\n  ${i.description.split("\n").join("\n  ")}\n`);
  }
}

function printIssueList(data, format) {
  const list = data?._embedded?.issueModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("issues");
  for (const i of list) printIssue(i, "pretty");
}

function printNote(n, format) {
  if (format === "json") return printJson(n);
  process.stdout.write(
    `${color(n.uuid?.slice(0, 8) || "?", 36)} ${n.author?.username} @ ${n.createdAt}\n` +
      `  ${n.message}\n`,
  );
}

function printNoteList(data, format) {
  const list = data?._embedded?.IssueDiscussionList || data?._embedded?.issueDiscussionList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("comments");
  for (const n of list) printNote(n, "pretty");
}

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/issue",
    embeddedKey: "issueModelList",
    flags,
    extraQs: flags.status && VALID_ISSUE_STATUS.includes(flags.status) ? { status: flags.status } : null,
  });
  if (data === null) return null; // streamed
  printIssueList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue view <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/issue/${localId}`,
    token,
  );
  printIssue(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.title || !flags.description)
    die("usage: gitflic issue create --title T --description D [--status OPEN|IN_PROGRESS|CLOSED|COMPLETED]");
  const body = { title: flags.title, description: flags.description, assignedUsers: [] };
  if (flags.status && VALID_ISSUE_STATUS.includes(flags.status)) body.status = { id: flags.status };
  if (flags["assign-to"]) body.assignedUsers = [{ id: flags["assign-to"] }];
  if (flags["label"]) body.labels = [{ id: flags["label"] }];
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/issue`,
    token,
    body,
  );
  printIssue(data, resolveFormat(flags, false));
  return data;
}

async function edit(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue edit <localId> [--title T] [--description D] [--status OPEN|...] [--assign-to <userUuid>] [--label <labelUuid>]");
  const body = { title: flags.title || "stub", description: flags.description || "stub", assignedUsers: [] };
  if (flags.status && VALID_ISSUE_STATUS.includes(flags.status)) body.status = { id: flags.status };
  if (flags["assign-to"]) body.assignedUsers = [{ id: flags["assign-to"] }];
  if (flags["label"]) body.labels = [{ id: flags["label"] }];
  const data = await http(
    "PUT",
    `${urlProject(api, owner, alias)}/issue/${localId}/edit`,
    token,
    body,
  );
  printIssue(data, resolveFormat(flags, false));
  return data;
}

async function close(ctx, args, flags) {
  ctx.flags = { ...flags, status: "CLOSED" };
  return edit(ctx, args, { ...flags, status: "CLOSED" });
}

async function reopen(ctx, args, flags) {
  return edit(ctx, args, { ...flags, status: "OPEN" });
}

async function deleteIssue(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue delete <localId>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/issue/${localId}/delete`,
    token,
  );
  process.stdout.write(`gitflic: issue '${localId}' deleted\n`);
}

// ---- comments (issueNote) ----

async function commentsList(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue comments list <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/issue-discussion/${localId}`,
    token,
  );
  printNoteList(data, resolveFormat(flags, true));
  return data;
}

async function commentsAdd(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const message = args[1];
  if (!localId || !message) die("usage: gitflic issue comments add <localId> <text>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/issue-discussion/${localId}/create`,
    token,
    { note: message },
  );
  printJson(data);
  return data;
}

async function commentsEdit(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const commentId = args[1];
  const message = args[2];
  if (!localId || !commentId || !message)
    die("usage: gitflic issue comments edit <localId> <commentId> <new text>");
  const data = await http(
    "PUT",
    `${urlProject(api, owner, alias)}/issue-discussion/${localId}/${commentId}/edit`,
    token,
    { note: message },
  );
  printJson(data);
  return data;
}

async function commentsDelete(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const commentId = args[1];
  if (!localId || !commentId) die("usage: gitflic issue comments delete <localId> <commentId>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/issue-discussion/${localId}/${commentId}/delete`,
    token,
  );
  process.stdout.write(`gitflic: comment '${commentId}' deleted\n`);
}

// ---- relations ----

const VALID_RELATION_TYPES = [
  "HIERARCHY_FORWARD", "HIERARCHY_REVERSE",
  "AFFECTS_REVERSE", "AFFECTS_FORWARD",
  "DUPLICATE_FORWARD", "DUPLICATE_REVERSE",
  "SHARED_PARAMETER_REFERENCED_BY_FORWARD", "SHARED_PARAMETER_REFERENCED_BY_REVERSE",
  "RELATED",
  "DEPENDENCY_FORWARD", "DEPENDENCY_REVERSE",
  "TESTED_BY_FORWARD", "TESTED_BY_REVERSE",
  "SHARED_STEP_REFERENCED_BY_FORWARD", "SHARED_STEP_REFERENCED_BY_REVERSE",
];

async function relationsList(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue relations list <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/issue/${localId}/issue-relations`,
    token,
  );
  printJson(data);
  return data;
}

async function relationsCreate(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const targetIssueUuid = args[1] || flags["target"];
  const relationType = args[2] || flags["type"];
  if (!localId || !targetIssueUuid || !relationType)
    die(
      "usage: gitflic issue relations create <localId> <targetIssueUuid> <relationType>\n" +
        `  relationType one of: ${VALID_RELATION_TYPES.join(", ")}`,
    );
  if (!VALID_RELATION_TYPES.includes(relationType))
    die(`invalid relationType '${relationType}'. One of: ${VALID_RELATION_TYPES.join(", ")}`);
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/issue/${localId}/create-issue-relation`,
    token,
    { targetIssueUuid, relationType },
  );
  printJson(data);
  return data;
}

async function relationsDelete(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const targetIssueUuid = args[1];
  if (!localId || !targetIssueUuid)
    die("usage: gitflic issue relations delete <localId> <targetIssueUuid>");
  const qs = new URLSearchParams({ targetIssueUuid });
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/issue/${localId}/delete-issue-relation?${qs}`,
    token,
  );
  process.stdout.write(`gitflic: relation to '${targetIssueUuid}' removed from issue '${localId}'\n`);
}

// ---- files (attachments via project upload) ----

async function filesList(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic issue files list <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/issue/${localId}/files`,
    token,
  );
  printJson(data);
  return data;
}

async function fileLink(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const fileUuid = args[1];
  if (!localId || !fileUuid)
    die("usage: gitflic issue files link <localId> <uploadFileUuid>");
  const qs = new URLSearchParams({ uploadFileUuid: fileUuid });
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/issue/${localId}/link-file?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

async function fileUnlink(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const fileUuid = args[1];
  if (!localId || !fileUuid)
    die("usage: gitflic issue files unlink <localId> <uploadFileUuid>");
  const qs = new URLSearchParams({ uploadFileUuid: fileUuid });
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/issue/${localId}/delete-file-relation?${qs}`,
    token,
  );
  process.stdout.write(`gitflic: file '${fileUuid}' unlinked (and deleted) from issue '${localId}'\n`);
}

// Convenience: upload a file to the project, then link it to the issue.
async function attach(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const filePath = args[1];
  if (!localId || !filePath)
    die("usage: gitflic issue attach <localId> <filePath> [--name N]");
  if (!existsSync(filePath)) die(`file not found: ${filePath}`);
  // 1) upload to the project (multipart field name is "attachment" per spec)
  const uploaded = await httpMultipart(
    `${urlProject(api, owner, alias)}/upload`,
    token,
    {
      fileFields: [{ name: "attachment", path: filePath, filename: flags.name }],
      retries: 2,
      retryDelay: 500,
    },
  );
  const fileUuid = uploaded?.uploadFileUuid;
  if (!fileUuid) {
    process.stderr.write("gitflic: upload did not return uploadFileUuid; raw response below\n");
    printJson(uploaded);
    return uploaded;
  }
  // 2) link it to the issue
  const qs = new URLSearchParams({ uploadFileUuid: fileUuid });
  const linked = await http(
    "POST",
    `${urlProject(api, owner, alias)}/issue/${localId}/link-file?${qs}`,
    token,
  );
  process.stderr.write(`gitflic: uploaded ${fileUuid} and linked to issue ${localId}\n`);
  printJson(linked);
  return linked;
}

async function attachmentUpload(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const filePath = args[1];
  if (!localId || !filePath)
    die("usage: gitflic issue attachment upload <localId> <filePath> [--name N]");
  if (!existsSync(filePath)) die(`file not found: ${filePath}`);
  // NOTE: GitFlic REST endpoint shape is a best-guess; verify against
  // https://docs.gitflic.ru/latest/api/ if this 404s.
  const url = `${urlProject(api, owner, alias)}/issue/${localId}/attachment`;
  const data = await httpMultipart(url, token, {
    fileFields: [{ name: "file", path: filePath, filename: flags.name }],
    retries: 2,
    retryDelay: 500,
  });
  printJson(data);
  return data;
}

export const usage = `Issue commands:
  issue list [--page N --size N] [--status OPEN|IN_PROGRESS|CLOSED|COMPLETED] [--all]
                                                          List issues (--all auto-paginates)
  issue view <localId>                                   Get one issue
  issue create --title T --description D [--status ...] [--assign-to <userUuid>] [--label <labelUuid>]
                                                          Create issue
  issue edit <localId> [--title T] [--description D] [--status ...] [--assign-to <userUuid>] [--label <labelUuid>]
                                                          Edit issue
  issue close <localId>                                  Shortcut: edit with --status CLOSED
  issue reopen <localId>                                 Shortcut: edit with --status OPEN
  issue delete <localId>                                 Delete issue
  issue comments list <localId>                         List comments
  issue comments add <localId> <text>                    Add comment
  issue comments edit <localId> <noteUuid> <new text>    Edit comment
  issue comments delete <localId> <noteUuid>             Delete comment
  issue relations list <localId>                         List issue relations
  issue relations create <localId> <targetIssueUuid> <relationType>
                                                          Create a relation (RELATED, AFFECTS_FORWARD, DEPENDENCY_FORWARD, ...)
  issue relations delete <localId> <targetIssueUuid>     Delete a relation
  issue files list <localId>                              List files attached to an issue
  issue files link <localId> <uploadFileUuid>            Link an already-uploaded project file to an issue
  issue files unlink <localId> <uploadFileUuid>          Unlink (and delete) a file from an issue
  issue attach <localId> <filePath> [--name N]           Upload file to project, then link it to the issue
  issue attachment upload <localId> <filePath> [--name N] (legacy/best-guess endpoint; prefer 'issue attach')
`;

export async function handle(ctx, sub, args, flags) {
  if (sub === "comments") {
    const cSub = args[0];
    const cArgs = args.slice(1);
    switch (cSub) {
      case "list":
        return commentsList(ctx, cArgs, flags);
      case "add":
        return commentsAdd(ctx, cArgs);
      case "edit":
        return commentsEdit(ctx, cArgs);
      case "delete":
        return commentsDelete(ctx, cArgs);
      default:
        die(`unknown issue comments subcommand: ${cSub}. Use list | add | edit | delete.`);
    }
  }
  if (sub === "relations") {
    const rSub = args[0];
    const rArgs = args.slice(1);
    switch (rSub) {
      case "list":
        return relationsList(ctx, rArgs, flags);
      case "create":
        return relationsCreate(ctx, rArgs, flags);
      case "delete":
        return relationsDelete(ctx, rArgs);
      default:
        die(`unknown issue relations subcommand: ${rSub}. Use list | create | delete.`);
    }
  }
  if (sub === "files") {
    const fSub = args[0];
    const fArgs = args.slice(1);
    switch (fSub) {
      case "list":
        return filesList(ctx, fArgs, flags);
      case "link":
        return fileLink(ctx, fArgs);
      case "unlink":
        return fileUnlink(ctx, fArgs);
      default:
        die(`unknown issue files subcommand: ${fSub}. Use list | link | unlink.`);
    }
  }
  if (sub === "attach") {
    return attach(ctx, args, flags);
  }
  if (sub === "attachment") {
    const aSub = args[0];
    if (aSub === "upload") return attachmentUpload(ctx, args.slice(1), flags);
    die(`unknown issue attachment subcommand: ${aSub}. Currently only 'upload' is implemented.`);
  }
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "view":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "edit":
      return edit(ctx, args, flags);
    case "close":
      return close(ctx, args, flags);
    case "reopen":
      return reopen(ctx, args, flags);
    case "delete":
      return deleteIssue(ctx, args);
    default:
      die(`unknown issue subcommand: ${sub}`);
  }
}