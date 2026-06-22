// gitflic commit — commits and commit diffs.

import {
  color,
  short,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function printCommit(c, format) {
  if (format === "json") return printJson(c);
  const author = c.user?.username || c.authorIdent?.name || "?";
  process.stdout.write(
    `${color((c.hash || "").slice(0, 12), 36)} ${color(c.shortMessage || c.message?.split("\n")[0] || "?", 1)}\n` +
      `  ${author} <${c.authorIdent?.emailAddress}>  ${c.createdAt}\n` +
      (c.verificationResult?.verified ? `  ${color("GPG verified", 32)}\n` : ""),
  );
}

function printCommitList(data, format) {
  const list = data?._embedded?.commitList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("commits");
  for (const c of list) printCommit(c, "pretty");
}

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    // GitFlic's commit-list endpoint is /commits (plural). /commit (singular)
    // is the single-commit base and 404s when used as a list.
    path: "/commits",
    embeddedKey: "commitList",
    flags,
    extraQs: { branch: flags.branch },
  });
  if (data === null) return null; // streamed
  printCommitList(data, resolveFormat(flags, true));
  return data;
}

// GET /project/{o}/{a}/commits  (standard branch) and ?branch={name}
async function commits(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/commits",
    embeddedKey: "commitList",
    flags,
    extraQs: { branch: flags.branch },
  });
  if (data === null) return null; // streamed
  printCommitList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const hash = args[0];
  if (!hash) die("usage: gitflic commit get <hash>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/commit/${encodeURIComponent(hash)}`,
    token,
  );
  printCommit(data, resolveFormat(flags, false));
  return data;
}

async function files(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const hash = args[0];
  if (!hash) die("usage: gitflic commit files <hash>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/commit/${encodeURIComponent(hash)}/file`,
    token,
  );
  printJson(data);
  return data;
}

async function diff(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const commitId = args[0];
  const filePath = args[1] || flags.file;
  if (!commitId || !filePath) die("usage: gitflic commit diff <commitId> <filePath>");
  const qs = new URLSearchParams({ filePath });
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/commit/${encodeURIComponent(commitId)}/diff?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

// GET /project/{o}/{a}/commit/{commitId}/for-file?filePath={filePath}
// Returns the last commit that touched the given file.
async function forFile(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const commitId = args[0];
  const filePath = args[1] || flags.file;
  if (!commitId || !filePath) die("usage: gitflic commit for-file <commitId> <filePath>");
  const qs = new URLSearchParams({ filePath });
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/commit/${encodeURIComponent(commitId)}/for-file?${qs}`,
    token,
  );
  printCommit(data, resolveFormat(flags, false));
  return data;
}

async function compare(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const source = args[0];
  const target = args[1];
  if (!source || !target) die("usage: gitflic commit compare <sourceCommit> <targetCommit>");
  const qs = new URLSearchParams({ sourceCommitId: source, targetCommitId: target });
  if (flags["ignore-collapsed"]) qs.set("ignoreCollapsed", "true");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/commit/diff?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

// GET /project/{o}/{a}/tag/diff?sourceName=&targetName=&ignoreCollapsed=
async function tagDiff(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const source = args[0];
  const target = args[1];
  if (!source || !target) die("usage: gitflic commit tag-diff <sourceTag> <targetTag>");
  const qs = new URLSearchParams({ sourceName: source, targetName: target });
  if (flags["ignore-collapsed"]) qs.set("ignoreCollapsed", "true");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/tag/diff?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

// PUT /project/{o}/{a}/branch/cherry-pick
// body: { branch, commitHash, newBranch? }
async function cherryPick(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const commitHash = args[0];
  const branch = args[1] || flags.branch;
  if (!commitHash || !branch) {
    die("usage: gitflic commit cherry-pick <commitHash> <targetBranch> [--new-branch <name>]");
  }
  const body = { branch, commitHash };
  if (flags["new-branch"]) body.newBranch = flags["new-branch"];
  const data = await http(
    "PUT",
    `${urlProject(api, owner, alias)}/branch/cherry-pick`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `Commit commands (need --project owner/alias):
  commit list [--branch <name>] [--page N --size N]      List commits (/commit; default or --branch)
  commit commits [--branch <name>] [--page N --size N]   List commits via /commits endpoint
  commit get <hash>                                     Get one commit
  commit files <hash>                                   List files touched by commit
  commit diff <commitId> <filePath>                     Show diff for one file in commit
  commit for-file <commitId> <filePath>                 Last commit that touched a file
  commit compare <sourceCommit> <targetCommit> [--ignore-collapsed]
                                                        Compare two commits (commit/diff)
  commit tag-diff <sourceTag> <targetTag> [--ignore-collapsed]
                                                        Diff between two tags (tag/diff)
  commit cherry-pick <commitHash> <targetBranch> [--new-branch <name>]
                                                        Cherry-pick a commit (PUT branch/cherry-pick)
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "commits":
      return commits(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "files":
      return files(ctx, args, flags);
    case "diff":
      return diff(ctx, args, flags);
    case "for-file":
      return forFile(ctx, args, flags);
    case "compare":
      return compare(ctx, args, flags);
    case "tag-diff":
      return tagDiff(ctx, args, flags);
    case "cherry-pick":
      return cherryPick(ctx, args, flags);
    default:
      die(`unknown commit subcommand: ${sub}`);
  }
}
