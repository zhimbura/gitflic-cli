// gitflic cicd — CI/CD pipelines and jobs.

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
  // Same story as getPipeline: GitFlic's public REST returns 404 here.
  // Web UI uses an internal endpoint we don't have access to from a token.
  // Kept the HTTP call so users see the real error if GitFlic ships it.
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/cicd/pipeline/${pipelineId}/jobs`,
    token,
  );
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
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/cicd/pipeline/start`,
    token,
    body,
  );
  printJson(data);
  return data;
}

export const usage = `CI/CD commands (need --project owner/alias):
  cicd pipeline list                                     List pipelines
  cicd pipeline <id>                                     Get pipeline
  cicd pipeline start [--ref <branch|tag>] [--tag]        Trigger a pipeline
  cicd jobs <pipelineId>                                 List jobs in a pipeline
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "pipeline":
      return dispatchPipeline(ctx, args[0], args.slice(1), flags);
    case "jobs":
      return listJobs(ctx, args, flags);
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
    default:
      return getPipeline(ctx, [sub, ...args], flags);
  }
}