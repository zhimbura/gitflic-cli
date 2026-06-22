// gitflic blob — files/blobs.

import { die, printJson, resolveFormat, urlProject } from "../format.mjs";
import { http } from "../http.mjs";

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const filePath = args[0];
  const branch = flags.branch || "master";
  if (!filePath) die("usage: gitflic blob get <filePath> [--branch <name>]");
  const qs = new URLSearchParams({ branch });
  if (flags.commit) qs.set("commit", flags.commit);
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/file/getBlob?filePath=${encodeURIComponent(filePath)}&${qs}`,
    token,
  );
  if (format === "json") return printJson(data);
  // Raw blob response is typically {content, ...}
  if (typeof data === "string") process.stdout.write(data);
  else if (data && typeof data.content === "string") process.stdout.write(data.content);
  else printJson(data);
  return data;
}

async function archive(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const branch = args[0] || flags.branch || "master";
  const qs = new URLSearchParams({ branch });
  // Returns tarball/zip binary — caller can pipe to file
  const res = await fetch(`${urlProject(api, owner, alias)}/file/getArchive?${qs}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) die(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  process.stdout.write(buf);
  void flags;
}

async function files(ctx, _args, flags) {
  // /project/{o}/{a}/files — list files (with metadata) at a path
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

export const usage = `Blob / file commands (need --project owner/alias):
  blob get <filePath> [--branch <name>] [--commit <hash>]
                                                          Get a file's content (text only — binary is base64 or skip)
  blob files [--path <dir>] [--branch <name>]             List files in repo (optionally under path)
  blob archive [branch]                                   Download repo archive (binary; pipe to file)

EXAMPLES
  gitflic blob get README.md --project tikhon/gitflic-cli-full --branch master
  gitflic blob archive master > /tmp/repo.tar.gz
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "get":
      return get(ctx, args, flags);
    case "archive":
      return archive(ctx, args, flags);
    case "files":
      return files(ctx, args, flags);
    default:
      die(`unknown blob subcommand: ${sub}. Use get | files | archive.`);
  }
}