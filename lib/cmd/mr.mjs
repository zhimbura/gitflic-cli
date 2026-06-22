// gitflic mr — merge request commands.

import {
  color,
  short,
  die,
  resolveFormat,
  statusColor,
  printJson,
  printEmpty,
  urlProject,
} from "../format.mjs";
import {
  currentBranch,
  http,
  projectIdFromOwnerAlias,
} from "../http.mjs";

// ---------- pretty printers -----------------------------------------------

function printMrList(data, format) {
  const list = data?._embedded?.mergeRequestModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("merge requests");
  for (const mr of list) {
    const st = mr.status;
    const title = color(mr.title || "(no title)", 1);
    const lid = color("#" + mr.localId, 36);
    const from = mr.sourceBranch?.alias || mr.sourceBranch?.id || "?";
    const to = mr.targetBranch?.alias || mr.targetBranch?.id || "?";
    const author = mr.createdBy?.username || "?";
    const stStr = color(
      st?.title || st?.id || "?",
      statusColor(st) === "\x1b[0m" ? 0 : 0,
    ).replace("\x1b[0m", "").replace(/\x1b\[\d+m/g, "");
    // Use raw ANSI only:
    const ansiStatus = `${statusColor(st)}${st?.title || st?.id || "?"}\x1b[0m`;
    process.stdout.write(
      `${lid} ${title}  ${ansiStatus}\n` +
        `    ${author} • ${from} → ${to} • ${mr.createdAt || ""}\n` +
        (mr.description ? `    ${short(mr.description, 100)}\n` : ""),
    );
    void stStr; // silence unused
  }
}

function printMr(mr, format) {
  if (format === "json") return printJson(mr);
  if (!mr) {
    process.stdout.write("(empty)\n");
    return;
  }
  const url = mr.projectAlias
    ? `https://gitflic.ru/project/${mr.projectAlias}/merge-request/${mr.localId}`
    : "";
  process.stdout.write(
    `${color("#" + mr.localId, 36)} ${color(mr.title || "(no title)", 1)}\n` +
      `  id:        ${mr.id}\n` +
      `  status:    ${mr.status?.title || mr.status?.id} (${mr.status?.color || "?"})\n` +
      `  author:    ${mr.createdBy?.fullName || mr.createdBy?.username} (@${mr.createdBy?.username})\n` +
      `  source:    ${mr.sourceBranch?.alias || mr.sourceBranch?.id}\n` +
      `  target:    ${mr.targetBranch?.alias || mr.targetBranch?.id}\n` +
      `  canMerge:  ${mr.canMerge}  hasConflicts: ${mr.hasConflicts}\n` +
      `  created:   ${mr.createdAt}\n` +
      `  updated:   ${mr.updatedAt}\n` +
      `  url:       ${url}\n`,
  );
  if (mr.description) {
    process.stdout.write(`\n  ${mr.description.split("\n").join("\n  ")}\n`);
  }
}

function printChanges(data, format) {
  if (format === "json") return printJson(data);
  const blobs = data?.commitBlobs || [];
  process.stdout.write(
    `+${data?.totalAddedLines ?? "?"} -${data?.totalRemovedLines ?? "?"}  ` +
      `(${blobs.length} file${blobs.length === 1 ? "" : "s"})\n\n`,
  );
  for (const b of blobs) {
    const tag =
      b.changeType === "ADD"
        ? color("ADD", 32)
        : b.changeType === "DELETE"
          ? color("DEL", 31)
          : b.changeType === "MODIFY"
            ? color("MOD", 33)
            : b.changeType;
    process.stdout.write(
      `${tag}  ${b.newPath || b.oldPath}  (+${b.addedLinesCount}/-${b.removedLinesCount})\n`,
    );
    if (Array.isArray(b.headers)) {
      for (const h of b.headers) process.stdout.write(`    ${color(h, 90)}\n`);
    }
    if (Array.isArray(b.lines)) {
      for (const ln of b.lines) {
        const op =
          ln.op === "add"
            ? color("+", 32)
            : ln.op === "remove"
              ? color("-", 31)
              : " ";
        process.stdout.write(`    ${op} ${color(ln.body || "", 90)}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

function printDiscussions(data, format) {
  const list = data?._embedded?.restDiscussionModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("discussions");
  for (const d of list) {
    const root = d.rootNote || d;
    const tag = root.resolved ? color("[resolved]", 32) : color("[open]", 33);
    process.stdout.write(
      `${tag} ${color((root.uuid || "").slice(0, 8), 90)} ${root.author?.username}: ${short(root.message, 80)}\n`,
    );
    for (const r of d.replies || []) {
      process.stdout.write(`    ↳ ${r.author?.username}: ${short(r.message, 80)}\n`);
    }
  }
}

// ---------- API wrappers ---------------------------------------------------

async function apiListMr(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const qs = new URLSearchParams();
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  const url = `${urlProject(api, owner, alias)}/merge-request/list${qs.size ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
  printMrList(data, resolveFormat(flags, true));
  return data;
}

async function apiGetMr(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic mr view <localId>");
  const mr = await http("GET", `${urlProject(api, owner, alias)}/merge-request/${localId}`, token);
  printMr(mr, resolveFormat(ctx.flags, false));
  return mr;
}

async function apiDiffMr(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic mr diff <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/changes`,
    token,
  );
  printChanges(data, resolveFormat(flags, true));
  return data;
}

async function apiCreateMr(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.title) die("gitflic mr create requires --title");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  const projectId = proj.id;
  const targetBranch = flags.to || proj.defaultBranch || "master";
  const sourceBranch = flags.from || currentBranch();
  if (sourceBranch === targetBranch) {
    die(`source and target are the same (${sourceBranch}); pass --from or --to`);
  }
  const body = {
    title: flags.title,
    description: flags.description || "",
    sourceBranch: { id: sourceBranch },
    targetBranch: { id: targetBranch },
    sourceProject: { id: projectId },
    targetProject: { id: projectId },
  };
  if (flags.squash) body.squashCommit = true;
  if (flags.removeBranch !== false) body.removeSourceBranch = true;
  const mr = await http("POST", `${urlProject(api, owner, alias)}/merge-request`, token, body);
  printMr(mr, resolveFormat(flags, false));
  return mr;
}

async function apiEditMr(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic mr edit <localId>");
  const cur = await http(
    "GET",
    `${urlProject(api, owner, alias)}/merge-request/${localId}`,
    token,
  );
  const body = {
    id: cur.id,
    title: flags.title || cur.title,
    description: flags.description !== undefined ? flags.description : cur.description,
    targetBranch: { id: flags.to || cur.targetBranch?.id },
    sourceProject: { id: cur.sourceProject?.id },
    targetProject: { id: cur.targetProject?.id },
  };
  if (flags.squash) body.squashCommit = true;
  if (flags.removeBranch === false) body.removeSourceBranch = false;
  const mr = await http("PUT", `${urlProject(api, owner, alias)}/merge-request`, token, body);
  printMr(mr, resolveFormat(flags, false));
  return mr;
}

async function apiActionMr(ctx, args, action, body) {
  const { api, token, owner, alias, flags } = ctx;
  const localId = args[0];
  if (!localId) die(`usage: gitflic mr ${action} <localId>`);
  const raw = await http(
    "POST",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/${action}`,
    token,
    body,
  );
  // approve wraps in {approved, mergeRequestModel}; others return bare MR
  const wrapped = raw && typeof raw === "object" && raw.mergeRequestModel;
  const mr = wrapped ? raw.mergeRequestModel : raw;
  if (wrapped && raw.approved !== undefined) {
    process.stderr.write(`gitflic: ${action} ok (approved by you: ${raw.approved})\n`);
  }
  printMr(mr, resolveFormat(flags, false));
  return raw;
}

async function apiCommentMr(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const text = args[1];
  if (!localId || !text) die("usage: gitflic mr comment <localId> <text>");
  const inlineKeys = ["new-line", "old-line", "new-path", "old-path"];
  const inlineSet = inlineKeys.filter((k) => flags[k] !== undefined);
  let body;
  if (inlineSet.length === 0) {
    body = { message: text };
  } else {
    if (inlineSet.length !== inlineKeys.length) {
      die(
        `inline comment requires all of --new-line --old-line --new-path --old-path ` +
          `(got only: ${inlineSet.map((k) => "--" + k).join(" ")})`,
      );
    }
    body = {
      message: text,
      newLine: Number(flags["new-line"]),
      oldLine: Number(flags["old-line"]),
      newPath: flags["new-path"],
      oldPath: flags["old-path"],
    };
  }
  const res = await http(
    "POST",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/create`,
    token,
    body,
  );
  printJson(res);
  return res;
}

async function apiListDiscussions(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic mr discuss list <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions`,
    token,
  );
  printDiscussions(data, resolveFormat(flags, true));
  return data;
}

async function apiReplyDiscussion(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const uuid = args[1];
  const text = args[2];
  if (!localId || !uuid || !text)
    die("usage: gitflic mr discuss reply <localId> <discussionUuid> <text>");
  const res = await http(
    "POST",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/reply`,
    token,
    { discussionUuid: uuid, message: text },
  );
  printJson(res);
  return res;
}

async function apiResolveDiscussion(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const uuid = args[1];
  if (!localId || !uuid) die("usage: gitflic mr discuss resolve <localId> <discussionUuid>");
  const res = await http(
    "POST",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/resolve/${uuid}`,
    token,
  );
  printJson(res);
  return res;
}

async function apiDeleteDiscussion(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const uuid = args[1];
  if (!localId || !uuid) die("usage: gitflic mr discuss delete <localId> <discussionUuid>");
  const res = await http(
    "POST",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/delete/${uuid}`,
    token,
  );
  printJson(res);
  return res;
}

// ---------- exports -------------------------------------------------------

export const usage = `MR commands (need --project owner/alias or git auto-detect):
  mr list [--page N --size N]                           List merge requests
  mr view <localId>                                     Show one MR
  mr diff <localId>                                     Show file-level diff for an MR
  mr by-commit <commitHash> [--status OPENED|MERGED|CLOSED|CANCELED|FAILED]
                                                        Find MR(s) containing a commit
  mr create --title <text> [--description <text>] [--from <b>] [--to <b>] [--squash] [--no-remove-branch]
                                                        Create MR (auto: current branch -> default)
  mr edit <localId> [--title <text>] [--description <text>] [--to <branch>] [--squash] [--no-remove-branch]
                                                        Edit MR (source branch can't change)
  mr approve <localId>                                  Toggle approve (POST /{id}/approve)
  mr merge <localId> [--message <text>] [--squash-message <text>]
                                                        Merge MR
  mr close <localId>                                    Close MR
  mr cancel <localId>                                   Cancel MR
  mr comment <localId> <text> [--new-path P --new-line N --old-path P --old-line N]
                                                        Add comment (general or inline-anchored)
  mr discuss list <localId>                             List discussions on MR
  mr discuss reply <localId> <discussionUuid> <text>    Reply to a discussion
  mr discuss resolve <localId> <discussionUuid>         Resolve a discussion
  mr discuss delete <localId> <discussionUuid>          Delete a discussion
  (project-level approval rules & merge-request settings live under \`project settings\` — see \`gitflic project help\`)
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return apiListMr(ctx, args, flags);
    case "view":
      return apiGetMr(ctx, args, flags);
    case "diff":
      return apiDiffMr(ctx, args, flags);
    case "by-commit": {
      const { api, token, owner, alias } = ctx;
      const hash = args[0];
      if (!hash) die("usage: gitflic mr by-commit <commitHash> [--status ...]");
      const qs = new URLSearchParams({ commit: hash });
      if (flags.status) qs.set("status", flags.status);
      const data = await http(
        "GET",
        `${urlProject(api, owner, alias)}/merge-request/commit?${qs}`,
        token,
      );
      printMrList(data, resolveFormat(flags, true));
      return data;
    }
    case "create":
      return apiCreateMr(ctx, args, flags);
    case "edit":
      return apiEditMr(ctx, args, flags);
    case "approve":
      return apiActionMr(ctx, args, "approve");
    case "merge":
    case "close":
    case "cancel": {
      let body;
      if (sub === "merge") {
        body = {};
        if (flags.message) body.commitMessage = flags.message;
        if (flags["squash-message"]) body.squashCommitMessage = flags["squash-message"];
      }
      return apiActionMr(ctx, args, sub, body);
    }
    case "comment":
      return apiCommentMr(ctx, args, flags);
    case "discuss": {
      const dSub = args[0];
      const dArgs = args.slice(1);
      switch (dSub) {
        case "list":
          return apiListDiscussions(ctx, dArgs, flags);
        case "reply":
          return apiReplyDiscussion(ctx, dArgs);
        case "resolve":
          return apiResolveDiscussion(ctx, dArgs);
        case "delete":
          return apiDeleteDiscussion(ctx, dArgs);
        default:
          die(`unknown mr discuss subcommand: ${dSub}. Use list | reply | resolve | delete.`);
      }
    }
    default:
      die(`unknown mr subcommand: ${sub}`);
  }
}