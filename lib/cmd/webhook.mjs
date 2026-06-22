// gitflic webhook — webhooks.

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

// Valid webhook event names per webhooks.txt (events is an object {NAME: bool}).
const EVENTS = [
  "COLLABORATOR_ADD",
  "COLLABORATOR_DELETE",
  "COLLABORATOR_UPDATE",
  "ISSUE_UPDATE",
  "ISSUE_CREATE",
  "NEW_ISSUE_NOTE",
  "TAG_DELETE",
  "TAG_CREATE",
  "BRANCH_UPDATE",
  "BRANCH_DELETE",
  "BRANCH_CREATE",
  "MERGE_REQUEST_CREATE",
  "MERGE_REQUEST_UPDATE",
  "MERGE",
  "MERGE_REQUEST_CLOSE",
  "MERGE_REQUEST_CANCEL",
  "MERGE_REQUEST_ACCEPT",
  "DISCUSSION_CREATE",
  "DISCUSSION_COMMENT_CREATE",
  "PIPELINE_NEW",
  "PIPELINE_SUCCESS",
  "PIPELINE_FAIL",
  "WEBHOOK_SEND",
];

function printWebhook(w, format) {
  if (format === "json") return printJson(w);
  // events is an object {EVENT_NAME: bool} in GitFlic API
  const events = w.events && typeof w.events === "object"
    ? Object.entries(w.events).filter(([, on]) => on).map(([e]) => e)
    : [];
  process.stdout.write(
    `${color(w.id?.slice(0, 8) || "?", 36)} ${color(w.url || w.targetUrl || "?", 1)}\n` +
      `  events: ${events.join(", ") || "(none)"}\n` +
      `  secret: ${w.secret ? "set" : "—"}\n` +
      `  created: ${w.createdAt || "—"}\n`,
  );
}

function printWebhookList(data, format) {
  const list = data?._embedded?.webhookList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("webhooks");
  for (const w of list) printWebhook(w, "pretty");
}

// Build the events object from --event flags, validating against EVENTS.
function eventsFromFlags(flags) {
  const events = [flags.event].flat().filter(Boolean);
  const eventsBody = {};
  for (const e of events) {
    const up = String(e).toUpperCase();
    if (!EVENTS.includes(up)) {
      die(`unknown webhook event '${e}' (valid: ${EVENTS.join(", ")})`);
    }
    eventsBody[up] = true;
  }
  return eventsBody;
}

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/setting/webhook",
    embeddedKey: "webhookList",
    flags,
  });
  if (data === null) return null; // streamed
  printWebhookList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic webhook get <uuid>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/setting/webhook/${encodeURIComponent(uuid)}`,
    token,
  );
  printWebhook(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.url) {
    die("usage: gitflic webhook create --url <target> [--secret S] [--event E ...]");
  }
  const eventsBody = eventsFromFlags(flags);
  const body = {
    url: flags.url,
    secret: flags.secret || "no-secret",
    // Default to all events on when none specified.
    events: Object.keys(eventsBody).length
      ? eventsBody
      : Object.fromEntries(EVENTS.map((e) => [e, true])),
  };
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/setting/webhook`,
    token,
    body,
  );
  printWebhook(data, resolveFormat(flags, false));
  return data;
}

async function update(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) {
    die("usage: gitflic webhook update <uuid> [--url U] [--secret S] [--event E ...]");
  }
  // Fetch current so we can merge unspecified fields.
  const current = await http(
    "GET",
    `${urlProject(api, owner, alias)}/setting/webhook/${encodeURIComponent(uuid)}`,
    token,
  );
  const eventsBody = eventsFromFlags(flags);
  const body = {
    url: flags.url || current?.url || current?.targetUrl,
    secret: flags.secret != null ? flags.secret : (current?.secret || "no-secret"),
    events: Object.keys(eventsBody).length
      ? eventsBody
      : (current?.events && typeof current.events === "object"
          ? current.events
          : Object.fromEntries(EVENTS.map((e) => [e, true]))),
  };
  const data = await http(
    "POST",
    `${urlProject(api, owner, alias)}/setting/webhook/${encodeURIComponent(uuid)}`,
    token,
    body,
  );
  printWebhook(data, resolveFormat(flags, false));
  return data;
}

async function deleteWebhook(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic webhook delete <uuid>");
  await http(
    "POST",
    `${urlProject(api, owner, alias)}/setting/webhook/${encodeURIComponent(uuid)}/delete`,
    token,
  );
  process.stdout.write(`gitflic: webhook '${uuid}' deleted\n`);
}

export const usage = `Webhook commands (need --project owner/alias):
  webhook list                                          List webhooks
  webhook get <uuid>                                    Get one webhook
  webhook create --url U [--secret S] [--event E ...]   Create webhook (default: all events on)
  webhook update <uuid> [--url U] [--secret S] [--event E ...]
                                                          Update webhook (unset fields kept)
  webhook delete <uuid>                                 Delete webhook
  events: ${EVENTS.join(", ")}
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "get":
      return get(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "update":
    case "edit":
      return update(ctx, args, flags);
    case "delete":
      return deleteWebhook(ctx, args);
    default:
      die(`unknown webhook subcommand: ${sub}`);
  }
}
