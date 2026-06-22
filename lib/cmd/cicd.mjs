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
  const st = p.status;
  process.stdout.write(
    `#${color(String(p.id || "?").slice(0, 12), 36)} ${color(p.ref || "?", 1)}\n` +
      `  status:    ${st?.title || st?.id || "?"} (${st?.color || "?"})\n` +
      `  created:   ${p.createdAt}\n`,
  );
}

function printPipelineList(data, format) {
  const list = data?._embedded?.pipelineList || data?._embedded?.pipelines || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("pipelines");
  for (const p of list) printPipeline(p, "pretty");
}

async function listPipelines(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/cicd/pipeline",
    embeddedKey: "pipelineList",
    flags,
  });
  printPipelineList(data, resolveFormat(flags, true));
  return data;
}

async function getPipeline(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const id = args[0];
  if (!id) die("usage: gitflic cicd pipeline <id>");
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