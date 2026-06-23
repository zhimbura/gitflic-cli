// gitflic release — releases (binary assets attached to a tag).

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http, httpMultipart, httpDownload } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";
import { existsSync } from "node:fs";

function printRelease(r, format) {
  if (format === "json") return printJson(r);
  const tag = r.preRelease ? color("[pre]", 33) : color("[release]", 32);
  process.stdout.write(
    `${color(r.tagName, 1)} ${tag}  ${color(r.title || "(no title)", 1)}\n` +
      `  id:          ${r.id}\n` +
      `  description: ${(r.description || "").split("\n")[0].slice(0, 100)}\n` +
      `  commit:      ${r.commitId?.slice(0, 12)}\n` +
      `  created:     ${r.createdAt}\n` +
      `  updated:     ${r.updatedAt}\n` +
      `  files:       ${(r.attachmentFiles || []).length}\n`,
  );
}

function printReleaseList(data, format) {
  const list = data?._embedded?.releaseTagModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("releases");
  for (const r of list) printRelease(r, "pretty");
}

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    // GitFlic's release-list endpoint is /release (not /release/list, which 404s).
    path: "/release",
    embeddedKey: "releaseTagModelList",
    flags,
  });
  if (data === null) return null; // streamed
  printReleaseList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic release get <uuid>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/release/${uuid}`,
    token,
  );
  printRelease(data, resolveFormat(flags, false));
  return data;
}

async function latest(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/release/latest`,
    token,
  );
  printRelease(data, resolveFormat(flags, false));
  return data;
}

// Build the POST /release body from flags.
// NOTE: GitFlic requires `preRelease` to be present (non-null) — omitting it
// makes the server throw 500 NPE (or 422 when a description is sent). So we
// ALWAYS send it; default false unless --pre-release is passed.
export function buildCreateBody(flags) {
  const body = { title: flags.title };
  if (flags.description) body.description = flags.description;
  if (flags.tag) body.tagName = flags.tag;
  body.preRelease = Boolean(flags["pre-release"] || flags.prerelease);
  if (flags["attach-archive"]) {
    body.attachProjectArchive = true;
    if (flags["archive-format"]) body.projectArchiveFormat = flags["archive-format"];
  }
  return body;
}

// Build the PUT /release/{uuid} body by merging requested changes onto the
// current release. GitFlic's PUT requires the FULL object (title/description/
// tagName/preRelease all non-null) — a partial body 500s — so we merge instead
// of sending only the changed fields.
export function buildEditBody(flags, current) {
  return {
    title: flags.title !== undefined ? flags.title : current.title,
    description:
      flags.description !== undefined ? flags.description : current.description,
    tagName: flags.tag !== undefined ? flags.tag : current.tagName,
    preRelease:
      flags["pre-release"] !== undefined
        ? flags["pre-release"] === "true" || flags["pre-release"] === true
        : current.preRelease,
  };
}

async function create(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.title) die("usage: gitflic release create --title <text> [--description <text>] [--tag <v1.0>] [--pre-release] [--attach-archive] [--archive-format tar.gz|zip|...]");
  const body = buildCreateBody(flags);
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/release`,
    token,
    body,
  );
  printRelease(data, resolveFormat(flags, false));
  return data;
}

async function edit(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic release edit <uuid> [--title T] [--description D] [--tag v1.0] [--pre-release true|false]");
  const changed =
    flags.title !== undefined ||
    flags.description !== undefined ||
    flags.tag !== undefined ||
    flags["pre-release"] !== undefined;
  if (!changed) die("nothing to update");
  // GitFlic's release PUT requires the FULL object (title/description/tagName/
  // preRelease all non-null) — a partial body 500s. Fetch the current release
  // and merge the requested changes onto it so we don't drop fields.
  const current = await http(
    "GET",
    `${urlProject(api, owner, alias)}/release/${uuid}`,
    token,
  );
  const body = buildEditBody(flags, current);
  const data = await http(
    "PUT",
    `${urlProject(api, owner, alias)}/release/${uuid}`,
    token,
    body,
  );
  printRelease(data, resolveFormat(flags, false));
  return data;
}

async function deleteRelease(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic release delete <uuid>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/release/${uuid}`,
    token,
  );
  process.stdout.write(`gitflic: release '${uuid}' deleted\n`);
}

// POST /release/{releaseUuid}/file — multipart upload (field key: "files").
async function uploadFile(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  const filePath = args[1];
  if (!uuid || !filePath)
    die("usage: gitflic release upload <releaseUuid> <file> [--name N]");
  if (!existsSync(filePath)) die(`file not found: ${filePath}`);
  const url = `${urlProject(api, owner, alias)}/release/${uuid}/file`;
  const data = await httpMultipart(url, token, {
    fileFields: [{ name: "files", path: filePath, filename: flags.name }],
    retries: 2,
    retryDelay: 500,
  });
  printJson(data);
  return data;
}

// GET /release/{releaseUuid}/file/{fileUuid} — download an attached file.
async function downloadFile(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  const fileUuid = args[1];
  if (!uuid || !fileUuid)
    die("usage: gitflic release download <releaseUuid> <fileUuid> [--out path]");
  const out = flags.out || fileUuid;
  const url = `${urlProject(api, owner, alias)}/release/${uuid}/file/${encodeURIComponent(fileUuid)}`;
  const res = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: saved ${res.bytes} bytes to ${res.path}\n`);
  return res;
}

// DELETE /release/{releaseUuid}/file — body is a JSON array of file UUIDs.
async function deleteFile(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  const fileUuid = args[1];
  if (!uuid || !fileUuid)
    die("usage: gitflic release delete-file <releaseUuid> <fileUuid>");
  const url = `${urlProject(api, owner, alias)}/release/${uuid}/file`;
  await http("DELETE", url, token, [fileUuid]);
  process.stdout.write(`gitflic: file '${fileUuid}' deleted from release '${uuid}'\n`);
}

export const usage = `Release commands:
  release list [--page N --size N] [--all]              List releases (--all auto-paginates)
  release get <uuid>                                    Get one release
  release latest                                        Get the most recent release
  release create --title <text> [--description D] [--tag vN[.N[.N]]] [--pre-release]
              [--attach-archive] [--archive-format tar|zip|tar.gz|...]
                                                          Create release
  release edit <uuid> [--title T] [--description D] [--tag vN] [--pre-release true|false]
                                                          Edit release metadata (no file edits via API in this CLI)
  release delete <uuid>                                 Delete release
  release upload <releaseUuid> <file> [--name N]         Upload a file to a release (multipart, field "files")
  release download <releaseUuid> <fileUuid> [--out path] Download an attached file (defaults to <fileUuid>)
  release delete-file <releaseUuid> <fileUuid>           Delete an attached file from a release
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "latest":
      return latest(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "edit":
      return edit(ctx, args, flags);
    case "delete":
      return deleteRelease(ctx, args);
    case "upload":
      return uploadFile(ctx, args, flags);
    case "download":
      return downloadFile(ctx, args, flags);
    case "delete-file":
      return deleteFile(ctx, args);
    case "asset": {
      // Back-compat: previous `release asset upload` mapped to the file endpoint.
      const aSub = args[0];
      const aArgs = args.slice(1);
      if (aSub === "upload") return uploadFile(ctx, aArgs, flags);
      die(`unknown release asset subcommand: ${aSub}. Use 'release upload' instead.`);
    }
    default:
      die(`unknown release subcommand: ${sub}`);
  }
}