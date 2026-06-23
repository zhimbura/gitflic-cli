// gitflic blob — repository files/blobs (content, download, recursive tree, size).

import { basename } from "node:path";
import { die, printJson, resolveFormat, urlProject } from "../format.mjs";
import { httpText, httpDownload, http, projectIdFromOwnerAlias } from "../http.mjs";

// ---------- helpers --------------------------------------------------------

// The blob endpoints are commitHash-based. Resolve a commit from the flags:
//   --commit/--commitHash → use directly
//   --branch/--branchName → that branch's head commit
//   (neither)             → the project's default branch head commit
// Lets `blob get <file>` work without forcing the caller to know a hash.
export async function resolveCommitHash(ctx, flags) {
  if (flags.commit || flags.commitHash) return flags.commit || flags.commitHash;
  const { api, token, owner, alias } = ctx;
  let branch = flags.branch || flags.branchName;
  if (!branch) {
    const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
    branch = proj.defaultBranch || "master";
  }
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/branch?name=${encodeURIComponent(branch)}`,
    token,
  );
  const b = data?._embedded?.branchList?.[0] || data;
  const hash = b?.lastCommit?.hash || b?.commit?.hash || b?.hash;
  if (!hash) die(`could not resolve a commit for branch '${branch}'`);
  return hash;
}

// ---------- subcommands ----------------------------------------------------

// GET /project/{o}/{a}/blob?commitHash=&file=  — RAW text content (Accept */* or 406).
async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const file = args[0] || flags.file;
  if (!file) {
    die("usage: gitflic blob get <file> [--commit <hash> | --branch <name>]  (default: default branch)");
  }
  const commit = await resolveCommitHash(ctx, flags);
  const qs = new URLSearchParams({ commitHash: commit, file });
  const text = await httpText(
    "GET",
    `${urlProject(api, owner, alias)}/blob?${qs}`,
    token,
  );
  if (resolveFormat(flags, false) === "json") return printJson({ file, commitHash: commit, content: text });
  process.stdout.write(text);
  return text;
}

// GET /project/{o}/{a}/blob/download?commitHash=&file=  — binary -> file.
async function download(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const file = args[0] || flags.file;
  if (!file) {
    die("usage: gitflic blob download <file> [--commit <hash> | --branch <name>] [--out <path>]");
  }
  const commit = await resolveCommitHash(ctx, flags);
  const out = flags.out || basename(file);
  const qs = new URLSearchParams({ commitHash: commit, file });
  const { path, bytes } = await httpDownload(
    `${urlProject(api, owner, alias)}/blob/download?${qs}`,
    token,
    out,
  );
  if (resolveFormat(flags, false) === "json") return printJson({ path, bytes });
  process.stderr.write(`gitflic: wrote ${bytes} bytes to ${path}\n`);
  return { path, bytes };
}

// GET /project/{o}/{a}/blob/recursive?commitHash=&directory=&depth=  — file tree (json).
async function recursive(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const commit = await resolveCommitHash(ctx, flags);
  const qs = new URLSearchParams({ commitHash: commit });
  const directory = flags.directory !== undefined ? flags.directory : args[0];
  if (directory !== undefined && directory !== "") qs.set("directory", directory);
  if (flags.depth !== undefined) qs.set("depth", String(flags.depth));
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/blob/recursive?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

// GET /project/{projectUuid}/file-size?filepath=&branchName=  — size in bytes.
async function fileSize(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const filepath = args[0] || flags.filepath || flags.path;
  const branch = flags.branch || flags.branchName;
  if (!filepath || !branch) {
    die("usage: gitflic blob file-size <filepath> --branch <name>");
  }
  const proj = await projectIdFromOwnerAlias(api, token, owner, alias);
  const qs = new URLSearchParams({ filepath, branchName: branch });
  const data = await http(
    "GET",
    `${api}/project/${encodeURIComponent(proj.id)}/file-size?${qs}`,
    token,
  );
  printJson(data);
  return data;
}

// ---------- exports --------------------------------------------------------

export const usage = `Blob / file commands (need --project owner/alias or git auto-detect):
  blob get <file> --commit <hash>                        Get a file's text content (raw)
  blob download <file> --commit <hash> [--out <path>]    Download a file's bytes (binary-safe) to disk
  blob recursive --commit <hash> [--directory <dir>] [--depth N]
                                                          List files (json) from a dir down to depth (max 10)
  blob file-size <filepath> --branch <name>              Get a file's size in bytes (resolves project UUID)

EXAMPLES
  gitflic blob get README.md --commit master --project tikhon/gitflic-cli
  gitflic blob download logo.png --commit master --out /tmp/logo.png
  gitflic blob recursive --commit master --directory src --depth 3
  gitflic blob file-size README.md --branch master
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "get":
      return get(ctx, args, flags);
    case "download":
      return download(ctx, args, flags);
    case "recursive":
    case "tree":
      return recursive(ctx, args, flags);
    case "file-size":
    case "size":
      return fileSize(ctx, args, flags);
    default:
      die(`unknown blob subcommand: ${sub}. Use get | download | recursive | file-size.`);
  }
}
