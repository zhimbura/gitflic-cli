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
  htmlUnescape,
} from "../format.mjs";
import {
  currentBranch,
  http,
  projectIdFromOwnerAlias,
} from "../http.mjs";
import { paginatedList, buildPageQs } from "../paginate.mjs";
import { runMrTui } from "../tui.mjs";

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
      for (const h of b.headers) process.stdout.write(`    ${color(htmlUnescape(h), 90)}\n`);
    }
    if (Array.isArray(b.lines)) {
      for (const ln of b.lines) {
        const op =
          ln.op === "add"
            ? color("+", 32)
            : ln.op === "remove"
              ? color("-", 31)
              : " ";
        process.stdout.write(`    ${op} ${color(htmlUnescape(ln.body || ""), 90)}\n`);
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
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/merge-request/list",
    embeddedKey: "mergeRequestModelList",
    flags,
  });
  if (data === null) return null; // streamed
  if (flags.tui) {
    const list = data?._embedded?.mergeRequestModelList || [];
    return await runMrTui(list, { header: `merge requests — ${owner}/${alias}` });
  }
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
  // GitFlic rejects an empty MR description with HTTP 422 (error.field.empty),
  // so require it rather than sending "" and failing cryptically.
  if (typeof flags.description !== "string" || flags.description === "")
    die("gitflic mr create requires a non-empty --description <text> (GitFlic rejects empty MR descriptions)");
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  const projectId = proj.id;
  const targetBranch = flags.to || proj.defaultBranch || "master";
  const sourceBranch = flags.from || currentBranch();
  if (sourceBranch === targetBranch) {
    die(`source and target are the same (${sourceBranch}); pass --from or --to`);
  }
  const body = {
    title: flags.title,
    description: flags.description,
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

async function apiGetDiscussion(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const uuid = args[1];
  if (!localId || !uuid)
    die("usage: gitflic mr discuss get <localId> <discussionUuid>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/${encodeURIComponent(uuid)}`,
    token,
  );
  printJson(data);
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
  // GitFlic uses the DELETE method here — POST returns 405 (verified live).
  const res = await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/merge-request/${localId}/discussions/delete/${uuid}`,
    token,
  );
  printJson(res);
  return res;
}

// ---------- company/team-scoped MR settings -------------------------------
//
// These commands target company/team-level merge-request settings and build an
// absolute `${api}/{company|team}/{alias}/merge-request/...` URL, IGNORING
// ctx.owner/alias (the project context). Scope is selected via
// --scope company|team (alias from --project owner/alias) or --company/--team <alias>.
// NOTE: mr is project-scoped in the dispatcher, so a resolvable project context
// is still required to reach these commands (same wart as environment/tag-protection).

// Resolve company/team scope. Returns { level, alias } or die()s — these
// settings have NO project-scoped equivalent, so a scope is mandatory.
function resolveMrScope(ctx, flags) {
  let level;
  let alias;
  if (flags.company) {
    level = "company";
    alias = flags.company === true ? ctx.alias : flags.company;
  } else if (flags.team) {
    level = "team";
    alias = flags.team === true ? ctx.alias : flags.team;
  } else if (flags.scope === "company" || flags.scope === "team") {
    level = flags.scope;
    alias = ctx.alias;
  } else {
    die("merge-request settings are company/team-scoped: pass --company <alias> / --team <alias> (or --scope company|team with --project owner/alias)");
  }
  if (!alias)
    die("provide a scope alias via --company <alias> / --team <alias> (or --project owner/alias with --scope company|team)");
  return { level, alias };
}

// Base URL for a company/team merge-request settings endpoint.
function mrScopeBase(ctx, flags) {
  const scope = resolveMrScope(ctx, flags);
  return `${ctx.api}/${scope.level}/${encodeURIComponent(scope.alias)}/merge-request`;
}

// ----- approval rules -----

async function apiApprovalRuleList(ctx, _args, flags) {
  const { token } = ctx;
  const qs = buildPageQs(flags).toString();
  const url = `${mrScopeBase(ctx, flags)}/approval/rule${qs ? `?${qs}` : ""}`;
  const data = await http("GET", url, token);
  printJson(data);
  return data;
}

async function apiApprovalRuleGet(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic mr approval rule get <uuid> --company/--team <alias>");
  const data = await http(
    "GET",
    `${mrScopeBase(ctx, flags)}/approval/rule/${encodeURIComponent(uuid)}`,
    token,
  );
  printJson(data);
  return data;
}

// Build an approval-rule body from flags.
// Fields (per mergeRequest.txt): name, targetBranch, minimalApprovals,
// allowedApprovers (array of usernames), uuid (for edit).
function approvalRuleBody(flags, { withUuid } = {}) {
  const body = {};
  if (withUuid) {
    const uuid = flags.uuid || flags.id;
    if (!uuid) die("edit requires --uuid <approvalRuleUuid>");
    body.uuid = uuid;
  }
  if (flags.name !== undefined) body.name = flags.name;
  if (flags["target-branch"] !== undefined || flags.target !== undefined)
    body.targetBranch = flags["target-branch"] !== undefined ? flags["target-branch"] : flags.target;
  if (flags["minimal-approvals"] !== undefined || flags.min !== undefined) {
    const v = flags["minimal-approvals"] !== undefined ? flags["minimal-approvals"] : flags.min;
    body.minimalApprovals = Number(v);
  }
  if (flags.approvers !== undefined) {
    body.allowedApprovers = String(flags.approvers)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((username) => ({ username }));
  }
  return body;
}

async function apiApprovalRuleCreate(ctx, _args, flags) {
  const { token } = ctx;
  const body = approvalRuleBody(flags, {});
  if (!body.name || !body.targetBranch)
    die("usage: gitflic mr approval rule create --company/--team <alias> --name <text> --target-branch <branch> [--minimal-approvals N] [--approvers user1,user2]");
  const data = await http("POST", `${mrScopeBase(ctx, flags)}/approval/rule/create`, token, body);
  printJson(data);
  return data;
}

async function apiApprovalRuleEdit(ctx, _args, flags) {
  const { token } = ctx;
  const body = approvalRuleBody(flags, { withUuid: true });
  const data = await http("PATCH", `${mrScopeBase(ctx, flags)}/approval/rule/edit`, token, body);
  printJson(data);
  return data;
}

async function apiApprovalRuleDelete(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic mr approval rule delete <uuid> --company/--team <alias>");
  await http(
    "DELETE",
    `${mrScopeBase(ctx, flags)}/approval/rule/${encodeURIComponent(uuid)}`,
    token,
  );
  process.stdout.write(`gitflic: approval rule '${uuid}' deleted\n`);
}

// ----- approval configuration -----

async function apiApprovalConfigGet(ctx, _args, flags) {
  const { token } = ctx;
  const data = await http("GET", `${mrScopeBase(ctx, flags)}/approval/configuration`, token);
  printJson(data);
  return data;
}

async function apiApprovalConfigEdit(ctx, _args, flags) {
  const { token } = ctx;
  // Pass through known toggles; fall back to --json for full control.
  let body;
  if (flags.json !== undefined) {
    try {
      body = JSON.parse(flags.json);
    } catch (e) {
      die(`--json is not valid JSON: ${e.message}`);
    }
  } else {
    body = {};
    const bools = {
      "reset-approvals-on-push": "resetApprovalsOnPush",
      "require-all-discussions-resolved": "requireAllDiscussionsResolved",
      "author-can-approve": "authorCanApprove",
    };
    for (const [flag, key] of Object.entries(bools)) {
      if (flags[flag] !== undefined)
        body[key] = flags[flag] === "true" || flags[flag] === true;
    }
    if (flags["minimal-approvals"] !== undefined)
      body.minimalApprovals = Number(flags["minimal-approvals"]);
    if (!Object.keys(body).length)
      die("nothing to edit; pass toggles (--reset-approvals-on-push / --require-all-discussions-resolved / --author-can-approve / --minimal-approvals N) or --json '<obj>'");
  }
  const data = await http("PATCH", `${mrScopeBase(ctx, flags)}/approval/configuration/edit`, token, body);
  printJson(data);
  return data;
}

// ----- squash / method-type / template settings -----
// endpoints.json lists the read + /edit endpoints both as GET; the /edit
// variants accept a body to update the setting. We honor that (GET + body)
// and let --json override the body for full control.

async function apiSettingGet(ctx, segment, flags) {
  const { token } = ctx;
  const data = await http("GET", `${mrScopeBase(ctx, flags)}/${segment}`, token);
  printJson(data);
  return data;
}

async function apiSettingEdit(ctx, segment, flags, buildBody) {
  const { token } = ctx;
  let body;
  if (flags.json !== undefined) {
    try {
      body = JSON.parse(flags.json);
    } catch (e) {
      die(`--json is not valid JSON: ${e.message}`);
    }
  } else {
    body = buildBody(flags);
  }
  const data = await http("GET", `${mrScopeBase(ctx, flags)}/${segment}/edit`, token, body);
  printJson(data);
  return data;
}

// ----- apply-settings-to-projects -----

async function apiApplySettings(ctx, _args, flags) {
  const { token } = ctx;
  const scope = resolveMrScope(ctx, flags);
  const data = await http(
    "POST",
    `${ctx.api}/${scope.level}/${encodeURIComponent(scope.alias)}/merge-request/apply-settings-to-projects`,
    token,
  );
  if (data) printJson(data);
  else process.stdout.write(`gitflic: ${scope.level} '${scope.alias}' merge-request settings applied to projects\n`);
  return data;
}

// Dispatch the `mr approval ...` subtree.
async function handleApproval(ctx, args, flags) {
  const aSub = args[0];
  const aArgs = args.slice(1);
  switch (aSub) {
    case "rule": {
      const rSub = aArgs[0];
      const rArgs = aArgs.slice(1);
      switch (rSub) {
        case "list":
        case undefined:
          return apiApprovalRuleList(ctx, rArgs, flags);
        case "get":
          return apiApprovalRuleGet(ctx, rArgs, flags);
        case "create":
          return apiApprovalRuleCreate(ctx, rArgs, flags);
        case "edit":
          return apiApprovalRuleEdit(ctx, rArgs, flags);
        case "delete":
          return apiApprovalRuleDelete(ctx, rArgs, flags);
        default:
          die(`unknown mr approval rule subcommand: ${rSub}. Use list | get | create | edit | delete.`);
      }
      break;
    }
    case "configuration":
    case "config": {
      const cSub = aArgs[0];
      switch (cSub) {
        case "get":
        case undefined:
          return apiApprovalConfigGet(ctx, aArgs.slice(1), flags);
        case "edit":
          return apiApprovalConfigEdit(ctx, aArgs.slice(1), flags);
        default:
          die(`unknown mr approval configuration subcommand: ${cSub}. Use get | edit.`);
      }
      break;
    }
    default:
      die(`unknown mr approval subcommand: ${aSub}. Use rule | configuration.`);
  }
}

// Dispatch the `mr settings ...` subtree (squash / method-type / template).
async function handleSettings(ctx, args, flags) {
  const sSub = args[0];
  switch (sSub) {
    case "squash":
      return apiSettingGet(ctx, "merge-request-squash", flags);
    case "squash-edit":
      return apiSettingEdit(ctx, "merge-request-squash", flags, (f) => {
        if (f.enabled === undefined && f.value === undefined)
          die("squash-edit: pass --enabled true|false (or --json '<obj>')");
        const v = f.enabled !== undefined ? f.enabled : f.value;
        return { squashCommit: v === "true" || v === true };
      });
    case "method-type":
      return apiSettingGet(ctx, "merge-request-method-type", flags);
    case "method-type-edit":
      return apiSettingEdit(ctx, "merge-request-method-type", flags, (f) => {
        if (f.type === undefined && f.value === undefined)
          die("method-type-edit: pass --type <MERGE_METHOD> (or --json '<obj>')");
        return { methodType: f.type !== undefined ? f.type : f.value };
      });
    case "template":
      return apiSettingGet(ctx, "merge-request-template", flags);
    case "template-edit":
      return apiSettingEdit(ctx, "merge-request-template", flags, (f) => {
        if (f.template === undefined && f.value === undefined)
          die("template-edit: pass --template <text> (or --json '<obj>')");
        return { template: f.template !== undefined ? f.template : f.value };
      });
    default:
      die(`unknown mr settings subcommand: ${sSub}. Use squash | squash-edit | method-type | method-type-edit | template | template-edit.`);
  }
}

// ---------- exports -------------------------------------------------------

export const usage = `MR commands (need --project owner/alias or git auto-detect):
  mr list [--page N --size N] [--all] [--tui] [--stream]
                                                          List merge requests (--tui = interactive, --stream = NDJSON)
  mr view <localId>                                     Show one MR
  mr diff <localId>                                     Show file-level diff for an MR
  mr by-commit <commitHash> [--status OPENED|MERGED|CLOSED|CANCELED|FAILED]
                                                        Find MR(s) containing a commit
  mr create --title <text> --description <text> [--from <b>] [--to <b>] [--squash] [--no-remove-branch]
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
  mr discuss get <localId> <discussionUuid>             Show one discussion thread
  mr discuss reply <localId> <discussionUuid> <text>    Reply to a discussion
  mr discuss resolve <localId> <discussionUuid>         Resolve a discussion
  mr discuss delete <localId> <discussionUuid>          Delete a discussion

  Company/team merge-request settings (need --company <alias> | --team <alias>,
  or --scope company|team with --project owner/alias; a resolvable project context is still required):
  mr approval rule list [--page N --size N]             List approval rules
  mr approval rule get <uuid>                           Get one approval rule
  mr approval rule create --name <text> --target-branch <branch> [--minimal-approvals N] [--approvers u1,u2]
                                                        Create approval rule
  mr approval rule edit --uuid <uuid> [--name --target-branch --minimal-approvals --approvers]
                                                        Edit approval rule (PATCH .../approval/rule/edit)
  mr approval rule delete <uuid>                        Delete approval rule
  mr approval configuration get                         Get approval configuration
  mr approval configuration edit [--minimal-approvals N --reset-approvals-on-push true|false
                                 --require-all-discussions-resolved true|false --author-can-approve true|false | --json '<obj>']
                                                        Edit approval configuration (PATCH .../approval/configuration/edit)
  mr settings squash                                    Get squash setting
  mr settings squash-edit --enabled true|false          Edit squash setting
  mr settings method-type                               Get merge-method setting
  mr settings method-type-edit --type <METHOD>          Edit merge-method setting
  mr settings template                                  Get MR description template
  mr settings template-edit --template <text>           Edit MR description template
                                                        (settings edits also accept --json '<obj>' for full body control)
  mr apply-settings                                     Apply company/team MR settings to its projects
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
        case "get":
          return apiGetDiscussion(ctx, dArgs, flags);
        case "reply":
          return apiReplyDiscussion(ctx, dArgs);
        case "resolve":
          return apiResolveDiscussion(ctx, dArgs);
        case "delete":
          return apiDeleteDiscussion(ctx, dArgs);
        default:
          die(`unknown mr discuss subcommand: ${dSub}. Use list | get | reply | resolve | delete.`);
      }
    }
    case "approval":
      return handleApproval(ctx, args, flags);
    case "settings":
      return handleSettings(ctx, args, flags);
    case "apply-settings":
    case "apply-settings-to-projects":
      return apiApplySettings(ctx, args, flags);
    default:
      die(`unknown mr subcommand: ${sub}`);
  }
}