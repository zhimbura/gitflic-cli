// gitflic release — releases (binary assets attached to a tag).

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

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
    path: "/release/list",
    embeddedKey: "releaseTagModelList",
    flags,
  });
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

async function create(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.title) die("usage: gitflic release create --title <text> [--description <text>] [--tag <v1.0>] [--pre-release] [--attach-archive] [--archive-format tar.gz|zip|...]");
  const body = { title: flags.title };
  if (flags.description) body.description = flags.description;
  if (flags.tag) body.tagName = flags.tag;
  if (flags["pre-release"] || flags.prerelease) body.preRelease = true;
  if (flags["attach-archive"]) {
    body.attachProjectArchive = true;
    if (flags["archive-format"]) body.projectArchiveFormat = flags["archive-format"];
  }
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
  const body = {};
  if (flags.title) body.title = flags.title;
  if (flags.description !== undefined) body.description = flags.description;
  if (flags.tag) body.tagName = flags.tag;
  if (flags["pre-release"] !== undefined) {
    body.preRelease = flags["pre-release"] === "true" || flags["pre-release"] === true;
  }
  if (!Object.keys(body).length) die("nothing to update");
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

Note: file upload/download on releases uses multipart, not implemented in this CLI.
      Use the GitFlic web UI for binary asset uploads.
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
    default:
      die(`unknown release subcommand: ${sub}`);
  }
}