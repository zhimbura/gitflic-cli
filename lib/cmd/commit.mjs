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
    path: "/commit",
    embeddedKey: "commitList",
    flags,
    extraQs: { branch: flags.branch },
  });
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

async function cherryPick(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const commitId = args[0];
  const branch = args[1] || flags.branch;
  if (!commitId || !branch) die("usage: gitflic commit cherry-pick <commitId> <targetBranch>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/commit/${encodeURIComponent(commitId)}/cherry-pick`,
    token,
    { branchName: branch },
  );
  printJson(data);
  return data;
}

export const usage = `Commit commands (need --project owner/alias):
  commit list [--branch <name>] [--page N --size N]      List commits (default branch or --branch)
  commit get <hash>                                     Get one commit
  commit files <hash>                                   List files touched by commit
  commit diff <commitId> <filePath>                     Show diff for one file in commit
  commit compare <sourceCommit> <targetCommit>          Compare two commits
  commit cherry-pick <commitId> <targetBranch>          Cherry-pick a commit onto a branch
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "files":
      return files(ctx, args, flags);
    case "diff":
      return diff(ctx, args, flags);
    case "compare":
      return compare(ctx, args, flags);
    case "cherry-pick":
      return cherryPick(ctx, args, flags);
    default:
      die(`unknown commit subcommand: ${sub}`);
  }
}