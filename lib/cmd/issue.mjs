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
import { http } from "../http.mjs";

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
  const qs = new URLSearchParams();
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  if (flags.status && VALID_ISSUE_STATUS.includes(flags.status)) qs.set("status", flags.status);
  const url = `${urlProject(api, owner, alias)}/issue${qs.size ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
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

export const usage = `Issue commands:
  issue list [--page N --size N] [--status OPEN|IN_PROGRESS|CLOSED|COMPLETED]
                                                          List issues
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
    if (rSub === "list") return relationsList(ctx, args.slice(1), flags);
    die(`unknown issue relations subcommand: ${rSub}. Currently only 'list' is implemented.`);
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