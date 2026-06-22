// gitflic cicd — CI/CD pipelines, jobs, artifacts, variables and lifetime.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
  urlProject,
} from "../format.mjs";
import { http, httpDownload } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function printPipeline(p, format) {
  if (format === "json") return printJson(p);
  // GitFlic returns `status` either as an object {id, title, color}
  // (pipeline list endpoints) OR as a plain string (e.g. "FAILED" — the
  // single-pipeline payload). Handle both.
  const st = p.status;
  const statusText =
    typeof st === "string"
      ? st
      : st?.title || st?.id || "?";
  const statusColor =
    typeof st === "string"
      ? st
      : st?.color || "?";
  process.stdout.write(
    `#${color(String(p.id || "?").slice(0, 12), 36)} ${color(p.ref || "?", 1)}\n` +
      `  status:    ${statusText} (${statusColor})\n` +
      `  created:   ${p.createdAt}\n`,
  );
}

function printPipelineList(data, format) {
  // GitFlic REST returns the list under `restPipelineModelList` (Hal-style
  // collection). Older code expected `pipelineList` / `pipelines` and silently
  // printed "(no pipelines)" even when the API had rows. 0.2.0: try the real
  // key first, fall back to the old ones for forward-compat.
  const list =
    data?._embedded?.restPipelineModelList ||
    data?._embedded?.pipelineList ||
    data?._embedded?.pipelines ||
    [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("pipelines");
  for (const p of list) printPipeline(p, "pretty");
}

async function listPipelines(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/cicd/pipeline",
    // GitFlic's actual embedded key. We pass it through to paginate(); the
    // print helper also tolerates the legacy names.
    embeddedKey: "restPipelineModelList",
    flags,
  });
  if (data === null) return null; // streamed
  printPipelineList(data, resolveFormat(flags, true));
  return data;
}

async function getPipeline(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const id = args[0];
  if (!id) die("usage: gitflic cicd pipeline <id>");
  // Try the obvious path first. As of 2026-06 the GitFlic public REST does
  // NOT expose a GET endpoint for a single pipeline by id — the list
  // endpoint works, but /cicd/pipeline/{id} returns 404 even with a valid
  // token. See known-issues.md. We still hit the API so the user gets the
  // real error message; if it's 404, hint at the known issue.
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/cicd/pipeline/${id}`,
    token,
  );
  printPipeline(data, resolveFormat(flags, false));
  return data;
}

async function listJobs(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const pipelineId = args[0];
  if (!pipelineId) die("usage: gitflic cicd jobs <pipelineId>");
  const data = await paginatedList({
    api, token, owner, alias,
    path: `/cicd/pipeline/${encodeURIComponent(pipelineId)}/jobs`,
    flags,
  });
  if (data === null) return null; // streamed
  printJson(data);
  return data;
}

async function startPipeline(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const body = {};
  if (flags.ref) {
    body.refName = flags.ref;
    body.isTag = flags.tag ? "true" : "false";
  }
  // Optional per-pipeline variables: --var key=value (repeatable).
  const vars = collectVars(flags);
  if (vars.length) body.variables = vars;
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/pipeline/start`,
    token,
    body,
  );
  printJson(data);
  return data;
}

// Collect --var key=value flags (single string or array) into [{key,value}].
function collectVars(flags) {
  const raw = flags.var;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const item of list) {
    const s = String(item);
    const eq = s.indexOf("=");
    if (eq < 0) die(`--var must be key=value (got '${s}')`);
    out.push({ key: s.slice(0, eq), value: s.slice(eq + 1) });
  }
  return out;
}

// ---------- pipeline: artifacts / lifecycle -------------------------------

async function pipelineArtifacts(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd pipeline artifacts <localId>");
  const data = await paginatedList({
    api, token, owner, alias,
    path: `/cicd/pipeline/${encodeURIComponent(localId)}/artifacts`,
    flags,
  });
  if (data === null) return null; // streamed
  printJson(data);
  return data;
}

async function pipelineArtifactsDownload(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd pipeline artifacts-download <localId> [--out <path>]");
  const url = `${urlProject(api, owner, alias)}/cicd/pipeline/${encodeURIComponent(localId)}/artifacts-download`;
  const out = flags.out || `pipeline-${localId}-artifacts.zip`;
  const { path, bytes } = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: downloaded ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

async function pipelineRestart(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd pipeline restart <localId>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/pipeline/${encodeURIComponent(localId)}/restart`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: pipeline '${localId}' restarted\n`);
    return;
  }
  printJson(data);
  return data;
}

async function pipelineCancel(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd pipeline cancel <localId>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/pipeline/${encodeURIComponent(localId)}/cancel`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: pipeline '${localId}' canceled\n`);
    return;
  }
  printJson(data);
  return data;
}

async function pipelineDelete(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd pipeline delete <localId>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/cicd/pipeline/${encodeURIComponent(localId)}/delete`,
    token,
  );
  process.stdout.write(`gitflic: pipeline '${localId}' deleted\n`);
}

// ---------- job: get / artifacts / lock / lifecycle -----------------------

async function jobGet(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd job get <localId>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}`,
    token,
  );
  printJson(data);
  return data;
}

async function jobArtifacts(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd job artifacts <localId>");
  const data = await paginatedList({
    api, token, owner, alias,
    path: `/cicd/job/${encodeURIComponent(localId)}/artifacts`,
    flags,
  });
  if (data === null) return null; // streamed
  printJson(data);
  return data;
}

async function jobArtifactLock(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const artifactUuid = args[1];
  if (!localId || !artifactUuid) die("usage: gitflic cicd job artifact-lock <localId> <artifactUuid>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/${encodeURIComponent(artifactUuid)}/lock`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: artifact '${artifactUuid}' locked\n`);
    return;
  }
  printJson(data);
  return data;
}

async function jobArtifactUnlock(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const artifactUuid = args[1];
  if (!localId || !artifactUuid) die("usage: gitflic cicd job artifact-unlock <localId> <artifactUuid>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/${encodeURIComponent(artifactUuid)}/unlock`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: artifact '${artifactUuid}' unlocked\n`);
    return;
  }
  printJson(data);
  return data;
}

async function jobArtifactsDownload(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd job artifacts-download <localId> [--out <path>]");
  const url = `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/artifacts-download`;
  const out = flags.out || `job-${localId}-artifacts.zip`;
  const { path, bytes } = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: downloaded ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

async function jobArtifactDownload(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const artifactUuid = args[1];
  if (!localId || !artifactUuid) die("usage: gitflic cicd job artifact-download <localId> <artifactUuid> [--out <path>]");
  const url = `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/artifact/${encodeURIComponent(artifactUuid)}/download`;
  const out = flags.out || `job-${localId}-artifact-${artifactUuid}.bin`;
  const { path, bytes } = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: downloaded ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

async function jobRestart(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd job restart <localId>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/restart`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: job '${localId}' restarted\n`);
    return;
  }
  printJson(data);
  return data;
}

async function jobCancel(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  if (!localId) die("usage: gitflic cicd job cancel <localId>");
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/cancel`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: job '${localId}' canceled\n`);
    return;
  }
  printJson(data);
  return data;
}

async function jobDeleteArtifact(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const localId = args[0];
  const artifactUuid = args[1];
  if (!localId || !artifactUuid) die("usage: gitflic cicd job delete-artifact <localId> <artifactUuid>");
  await http(
    "DELETE",
    `${urlProject(api, owner, alias)}/cicd/job/${encodeURIComponent(localId)}/artifact/${encodeURIComponent(artifactUuid)}/delete`,
    token,
  );
  process.stdout.write(`gitflic: artifact '${artifactUuid}' deleted\n`);
}

// ---------- variables -----------------------------------------------------
// Project:  GET /project/{o}/{a}/setting/cicd/variable
// Company:  GET /company/{alias}/cicd/variable     (--scope company)
// Team:     GET /team/{alias}/cicd/variable        (--scope team)
// Admin:    GET /admin/ci-cd-variables             (--scope admin, admin-only)

// Resolve the scope alias for company/team-scoped CI/CD endpoints.
// Mirrors environment.mjs: --team/--company take an explicit alias (or fall
// back to ctx.alias), else --scope team|company uses ctx.alias.
function resolveScope(ctx, flags) {
  let level;
  let alias;
  if (flags.team) {
    level = "team";
    alias = flags.team === true ? ctx.alias : flags.team;
  } else if (flags.company) {
    level = "company";
    alias = flags.company === true ? ctx.alias : flags.company;
  } else if (flags.scope === "team" || flags.scope === "company") {
    level = flags.scope;
    alias = ctx.alias;
  } else {
    return null;
  }
  if (!alias)
    die("provide a scope alias via --team <alias> / --company <alias> (or --project owner/alias --scope team|company)");
  return { level, alias };
}

async function variables(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  // Admin instance-wide variables.
  if (flags.scope === "admin" || flags.admin) {
    const data = await http("GET", `${api}/admin/ci-cd-variables`, token);
    printJson(data);
    return data;
  }
  // Company / team-scoped.
  const sc = resolveScope(ctx, flags);
  if (sc) {
    const data = await http("GET", `${api}/${sc.level}/${encodeURIComponent(sc.alias)}/cicd/variable`, token);
    printJson(data);
    return data;
  }
  // Default: project-scoped.
  const data = await http("GET", `${urlProject(api, owner, alias)}/setting/cicd/variable`, token);
  printJson(data);
  return data;
}

// ---------- pipeline lifetime (company/team) ------------------------------
// GET   /company|team/{alias}/cicd/pipeline-lifetime
// PATCH /company|team/{alias}/cicd/pipeline-lifetime/edit
// POST  /company|team/{alias}/cicd/apply-settings-to-projects

function requireScope(ctx, flags) {
  const sc = resolveScope(ctx, flags);
  if (!sc) die("pipeline-lifetime is company/team-scoped: pass --team <alias> / --company <alias> (or --project owner/alias --scope team|company)");
  return sc;
}

async function lifetimeGet(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = requireScope(ctx, flags);
  const data = await http("GET", `${api}/${level}/${encodeURIComponent(alias)}/cicd/pipeline-lifetime`, token);
  printJson(data);
  return data;
}

async function lifetimeEdit(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = requireScope(ctx, flags);
  const body = {};
  // Lifetime value (days/seconds depending on instance) — pass through whatever
  // the user supplies. Common field name is `pipelineLifetime`.
  const lifetime = flags.lifetime ?? flags["pipeline-lifetime"];
  if (lifetime !== undefined) body.pipelineLifetime = lifetime;
  if (flags.enabled !== undefined) body.enabled = flags.enabled === "true" || flags.enabled === true;
  if (!Object.keys(body).length) die("no fields to update; pass --lifetime <value> and/or --enabled true|false");
  const data = await http(
    "PATCH",
    `${api}/${level}/${encodeURIComponent(alias)}/cicd/pipeline-lifetime/edit`,
    token,
    body,
  );
  printJson(data);
  return data;
}

async function lifetimeApply(ctx, _args, flags) {
  const { api, token } = ctx;
  const { level, alias } = requireScope(ctx, flags);
  const data = await http(
    "POST",
    `${api}/${level}/${encodeURIComponent(alias)}/cicd/apply-settings-to-projects`,
    token,
    {},
  );
  if (data === null) {
    process.stdout.write(`gitflic: CI/CD settings applied to ${level} '${alias}' projects\n`);
    return;
  }
  printJson(data);
  return data;
}

export const usage = `CI/CD commands (project-scoped need --project owner/alias):
  cicd pipeline list [--all]                             List pipelines
  cicd pipeline <id>                                     Get pipeline (public REST: 404, see known-issues)
  cicd pipeline start [--ref <branch|tag>] [--tag]       Trigger a pipeline
                                  [--var key=value ...]   Per-pipeline variables (repeatable)
  cicd pipeline artifacts <localId> [--all]             List pipeline artifacts
  cicd pipeline artifacts-download <localId> [--out P]  Download pipeline artifacts archive
  cicd pipeline restart <localId>                        Restart a pipeline
  cicd pipeline cancel <localId>                         Cancel a pipeline
  cicd pipeline delete <localId>                         Delete a pipeline
  cicd jobs <pipelineId> [--all]                        List jobs in a pipeline
  cicd job get <localId>                                 Get one job
  cicd job artifacts <localId> [--all]                  List job artifacts
  cicd job artifact-lock <localId> <artifactUuid>        Lock a job artifact
  cicd job artifact-unlock <localId> <artifactUuid>      Unlock a job artifact
  cicd job artifacts-download <localId> [--out P]       Download all job artifacts
  cicd job artifact-download <localId> <uuid> [--out P] Download one artifact
  cicd job restart <localId>                             Restart a job
  cicd job cancel <localId>                              Cancel a job
  cicd job delete-artifact <localId> <artifactUuid>      Delete a job artifact
  cicd variable                                          List CI/CD variables (project, default)
       [--scope company|team --team/--company <alias>]   company/team-scoped variables
       [--scope admin]                                   instance variables (admin-only)
  cicd pipeline-lifetime get                             Get pipeline lifetime (company/team-scoped)
       (requires --team/--company <alias> or --scope)
  cicd pipeline-lifetime edit [--lifetime V] [--enabled true|false]
  cicd pipeline-lifetime apply-settings-to-projects     Apply lifetime to all scope projects
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "pipeline":
      return dispatchPipeline(ctx, args[0], args.slice(1), flags);
    case "jobs":
      return listJobs(ctx, args, flags);
    case "job":
      return dispatchJob(ctx, args[0], args.slice(1), flags);
    case "variable":
    case "variables":
      return variables(ctx, args, flags);
    case "pipeline-lifetime":
      return dispatchLifetime(ctx, args[0], args.slice(1), flags);
    default:
      die(`unknown cicd subcommand: ${sub}`);
  }
}

function dispatchPipeline(ctx, sub, args, flags) {
  switch (sub) {
    case "list":
    case undefined:
      return listPipelines(ctx, args, flags);
    case "start":
      return startPipeline(ctx, args, flags);
    case "artifacts":
      return pipelineArtifacts(ctx, args, flags);
    case "artifacts-download":
      return pipelineArtifactsDownload(ctx, args, flags);
    case "restart":
      return pipelineRestart(ctx, args, flags);
    case "cancel":
      return pipelineCancel(ctx, args, flags);
    case "delete":
      return pipelineDelete(ctx, args);
    default:
      return getPipeline(ctx, [sub, ...args], flags);
  }
}

function dispatchJob(ctx, sub, args, flags) {
  switch (sub) {
    case "get":
      return jobGet(ctx, args, flags);
    case "artifacts":
      return jobArtifacts(ctx, args, flags);
    case "artifact-lock":
      return jobArtifactLock(ctx, args);
    case "artifact-unlock":
      return jobArtifactUnlock(ctx, args);
    case "artifacts-download":
      return jobArtifactsDownload(ctx, args, flags);
    case "artifact-download":
      return jobArtifactDownload(ctx, args, flags);
    case "restart":
      return jobRestart(ctx, args);
    case "cancel":
      return jobCancel(ctx, args);
    case "delete-artifact":
      return jobDeleteArtifact(ctx, args);
    case undefined:
      die("usage: gitflic cicd job <get|artifacts|artifact-lock|artifact-unlock|artifacts-download|artifact-download|restart|cancel|delete-artifact> ...");
      return;
    default:
      // Treat a bare localId as `job get <localId>`.
      return jobGet(ctx, [sub, ...args], flags);
  }
}

function dispatchLifetime(ctx, sub, args, flags) {
  switch (sub) {
    case "get":
    case undefined:
      return lifetimeGet(ctx, args, flags);
    case "edit":
      return lifetimeEdit(ctx, args, flags);
    case "apply-settings-to-projects":
    case "apply":
      return lifetimeApply(ctx, args, flags);
    default:
      die(`unknown cicd pipeline-lifetime subcommand: ${sub}`);
  }
}
