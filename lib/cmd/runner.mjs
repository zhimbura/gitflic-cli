// gitflic runner — CI/CD runner (agent) commands.
//
// Runners are scoped: a runner can be owned by a PROJECT, a COMPANY, or the
// whole INSTANCE (admin). The CLI selects scope with --scope project|company|instance.
//
//   project  (default): /project/{owner}/{alias}/runners/...
//                        resolve owner/alias from --project owner/alias (or git origin)
//   company:            /company/{alias}/runners/...        (--company <alias>)
//   instance:           /admin/runners/...                  (admin rights required)
//
// NOTE: `runner` is in the dispatcher's GLOBAL set, so ctx has NO pre-resolved
// owner/alias. For --scope project we resolve the project ourselves from flags.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http, resolveProject } from "../http.mjs";
import { paginatedList, buildPageQs } from "../paginate.mjs";

// ---------- pretty printers -----------------------------------------------

function printRunner(r, format) {
  if (format === "json") return printJson(r);
  if (!r) return process.stdout.write("(empty)\n");
  const active = r.active ? color("active", 32) : color("inactive", 31);
  const tags = Array.isArray(r.tags?.tags)
    ? r.tags.tags
    : Array.isArray(r.tags)
      ? r.tags
      : [];
  process.stdout.write(
    `${color(r.name || "(no name)", 1)}  ${active}\n` +
      `  id:        ${r.id}\n` +
      `  owner:     ${r.ownerType || "?"}${r.ownerId !== undefined ? " #" + r.ownerId : ""}\n` +
      `  platform:  ${r.platform || "?"} / ${r.architecture || "?"}\n` +
      `  ip:        ${r.ipAddress || "?"}\n` +
      `  connected: ${r.connectedAt || "-"}\n` +
      `  tags:      ${tags.length ? tags.join(", ") : "-"}\n` +
      `  runUntagged: ${r.runUntagged}  locked: ${r.locked}  protected: ${r.protected}\n` +
      `  maxTimeout:  ${r.maxTimeoutInSec ?? "-"}s\n` +
      (r.description ? `  desc:      ${r.description}\n` : ""),
  );
}

function pickRunnerList(data) {
  const emb = data?._embedded || {};
  for (const k of Object.keys(emb)) {
    if (Array.isArray(emb[k])) return emb[k];
  }
  return [];
}

function printRunnerList(data, format) {
  if (format === "json") return printJson(data);
  const list = pickRunnerList(data);
  if (!list.length) return printEmpty("runners");
  for (const r of list) {
    const active = r.active ? color("●", 32) : color("○", 31);
    const tags = Array.isArray(r.tags?.tags)
      ? r.tags.tags
      : Array.isArray(r.tags)
        ? r.tags
        : [];
    process.stdout.write(
      `${active} ${color(r.name || "(no name)", 1)} ${color((r.id || "").slice(0, 8), 90)}\n` +
        `    ${r.ownerType || "?"} • ${r.platform || "?"}/${r.architecture || "?"} • ` +
        `${r.ipAddress || "?"}${tags.length ? " • [" + tags.join(",") + "]" : ""}\n`,
    );
  }
}

function printJobList(data, format) {
  if (format === "json") return printJson(data);
  const list = pickRunnerList(data);
  if (!list.length) return printEmpty("jobs");
  for (const j of list) {
    process.stdout.write(
      `${color("#" + (j.localId ?? "?"), 36)} ${color(j.name || "(no name)", 1)} ` +
        `[${j.status || "?"}]\n` +
        `    stage: ${j.stageName || "-"} • ref: ${j.ref || "-"} • ` +
        `pipeline: #${j.pipelineLocalId ?? "?"} • ${j.startedAt || ""}\n`,
    );
  }
}

// ---------- scope resolution ----------------------------------------------

// Returns { scope, base } where base is the absolute URL prefix up to ".../runners".
//   project:  ${api}/project/{owner}/{alias}/runners
//   company:  ${api}/company/{alias}/runners
//   instance: ${api}/admin/runners
function resolveScope(ctx, flags) {
  const { api } = ctx;
  let scope = flags.scope;
  if (!scope) {
    if (flags.company) scope = "company";
    else if (flags.instance || flags.admin) scope = "instance";
    else scope = "project";
  }
  if (scope === "company") {
    const alias = flags.company || flags.team;
    if (!alias) die("--scope company requires --company <alias>");
    return { scope, base: `${api}/company/${encodeURIComponent(alias)}/runners` };
  }
  if (scope === "instance" || scope === "admin") {
    return { scope: "instance", base: `${api}/admin/runners` };
  }
  if (scope !== "project") die(`--scope must be project | company | instance (got "${scope}")`);
  // project scope: resolve owner/alias ourselves (runner is a GLOBAL command).
  const { owner, alias } = resolveProject(flags);
  flags.project = `${owner}/${alias}`;
  return {
    scope,
    base: `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}/runners`,
  };
}

// Edit body builder, shared by all scopes (admin.txt / runner.txt schema).
function buildEditBody(flags) {
  const body = {};
  if (flags.name !== undefined) body.name = flags.name;
  if (flags.description !== undefined) body.description = flags.description;
  if (flags.active !== undefined)
    body.isActive = flags.active === "true" || flags.active === true;
  if (flags["max-timeout"] !== undefined)
    body.maxTimeoutInSec = Number(flags["max-timeout"]);
  if (flags.ip !== undefined) body.ipAddress = flags.ip;
  if (flags.tags !== undefined) {
    body.tags = String(flags.tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (flags["run-untagged"] !== undefined)
    body.runUntagged = flags["run-untagged"] === "true" || flags["run-untagged"] === true;
  if (flags.locked !== undefined)
    body.isLocked = flags.locked === "true" || flags.locked === true;
  if (flags.protected !== undefined)
    body.isProtected = flags.protected === "true" || flags.protected === true;
  return body;
}

// ---------- handlers ------------------------------------------------------

async function list(ctx, _args, flags) {
  const { token } = ctx;
  const { scope, base } = resolveScope(ctx, flags);
  // /admin/runners is paginated; project/company list also accept page/size.
  // We page on the absolute base via buildPageQs (paginatedList only supports
  // project-scoped relative paths, so use http directly here for all scopes).
  if (flags.all) {
    // Walk pages manually against the absolute base.
    let page = 1;
    const size = Number(flags.size) || 20;
    const items = [];
    let last = null;
    for (let i = 0; i < 200; i++) {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      const data = await http("GET", `${base}?${qs}`, token);
      last = data;
      const chunk = pickRunnerList(data);
      items.push(...chunk);
      const p = data?.page || null;
      if (chunk.length < size) break;
      if (p && typeof p.totalPages === "number" && page >= p.totalPages) break;
      if (chunk.length === 0) break;
      page++;
    }
    const embKey = Object.keys(last?._embedded || { runnerModelList: 1 })[0] || "runnerModelList";
    const out = {
      ...(last || {}),
      _embedded: { ...(last?._embedded || {}), [embKey]: items },
    };
    printRunnerList(out, resolveFormat(flags, true));
    return out;
  }
  const qs = buildPageQs(flags);
  const url = `${base}${qs.size ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
  printRunnerList(data, resolveFormat(flags, true));
  void scope;
  return data;
}

async function get(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic runner get <uuid> [--scope project|company|instance]");
  const { base } = resolveScope(ctx, flags);
  const data = await http("GET", `${base}/${encodeURIComponent(uuid)}`, token);
  printRunner(data, resolveFormat(flags, false));
  return data;
}

async function jobs(ctx, args, flags) {
  const { token } = ctx;
  const { base } = resolveScope(ctx, flags);
  const uuid = args[0];
  // <uuid>/jobs for a single runner, all/jobs for every runner in scope.
  const seg = uuid ? `${encodeURIComponent(uuid)}/jobs` : "all/jobs";
  const qs = new URLSearchParams();
  if (flags.status) qs.set("jobStatus", flags.status);
  const url = `${base}/${seg}${qs.toString() ? "?" + qs : ""}`;
  const data = await http("GET", url, token);
  printJobList(data, resolveFormat(flags, true));
  return data;
}

async function registrationInfo(ctx, _args, flags) {
  const { token } = ctx;
  const { base } = resolveScope(ctx, flags);
  const data = await http("GET", `${base}/registration-info`, token);
  printJson(data);
  return data;
}

async function resetToken(ctx, _args, flags) {
  const { token } = ctx;
  const { scope, base } = resolveScope(ctx, flags);
  if (scope !== "instance")
    die("runner reset-token is instance-only (use --scope instance; admin rights required)");
  const data = await http("POST", `${base}/reset-registration-token`, token);
  printJson(data);
  return data;
}

async function shutdown(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic runner shutdown <uuid> [--scope project|company|instance]");
  const { base } = resolveScope(ctx, flags);
  const data = await http("POST", `${base}/${encodeURIComponent(uuid)}/shutdown`, token);
  if (data === null) process.stdout.write(`gitflic: runner '${uuid}' shutdown requested\n`);
  else printJson(data);
  return data;
}

async function edit(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid)
    die(
      "usage: gitflic runner edit <uuid> [--name X] [--description X] [--active true|false] " +
        "[--max-timeout N] [--ip X] [--tags a,b,c] [--run-untagged true|false] " +
        "[--locked true|false] [--protected true|false] [--scope ...]",
    );
  const { base } = resolveScope(ctx, flags);
  const body = buildEditBody(flags);
  if (!Object.keys(body).length)
    die("no fields to update; pass --name / --description / --active / --max-timeout / --tags / etc.");
  const data = await http("POST", `${base}/${encodeURIComponent(uuid)}/edit`, token, body);
  printRunner(data, resolveFormat(flags, false));
  return data;
}

async function deleteRunner(ctx, args, flags) {
  const { token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic runner delete <uuid> [--scope project|company|instance]");
  const { base } = resolveScope(ctx, flags);
  await http("DELETE", `${base}/${encodeURIComponent(uuid)}`, token);
  process.stdout.write(`gitflic: runner '${uuid}' deleted\n`);
}

// ---------- exports -------------------------------------------------------

export const usage = `Runner commands (CI/CD agents). Scope with --scope project|company|instance:
  --scope project (default)   project runners (resolve --project owner/alias or git origin)
  --scope company --company <alias>   company runners
  --scope instance            service-wide runners via /admin/runners (admin rights)

  runner list [--page N --size N] [--all]              List runners in scope
  runner get <uuid>                                    Show one runner
  runner jobs [<uuid>] [--status <jobStatus>]          Jobs for one runner, or all runners in scope
  runner registration-info                             Get registration URL + token for the scope
  runner reset-token                                   Reset instance registration token (--scope instance only, admin)
  runner shutdown <uuid>                               Shut down a runner
  runner edit <uuid> [--name X] [--description X] [--active true|false]
             [--max-timeout N] [--ip X] [--tags a,b,c] [--run-untagged true|false]
             [--locked true|false] [--protected true|false]
                                                       Edit a runner (body: name/description/isActive/
                                                       maxTimeoutInSec/ipAddress/tags/runUntagged/isLocked/isProtected)
  runner delete <uuid>                                 Delete a runner
  (instance scope also supports --scope instance for: list/get/jobs/shutdown/edit/delete + reset-token)
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "jobs":
      return jobs(ctx, args, flags);
    case "registration-info":
    case "reg-info":
      return registrationInfo(ctx, args, flags);
    case "reset-token":
    case "reset-registration-token":
      return resetToken(ctx, args, flags);
    case "shutdown":
      return shutdown(ctx, args, flags);
    case "edit":
      return edit(ctx, args, flags);
    case "delete":
    case "rm":
      return deleteRunner(ctx, args, flags);
    default:
      die(`unknown runner subcommand: ${sub}. Use list | get | jobs | registration-info | reset-token | shutdown | edit | delete.`);
  }
}
