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

async function list(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  const data = await paginatedList({
    api, token, owner, alias,
    path: "/setting/webhook",
    embeddedKey: "webhookList",
    flags,
  });
  printWebhookList(data, resolveFormat(flags, true));
  return data;
}

async function get(ctx, args, flags) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic webhook get <uuid>");
  const data = await http(
    "GET",
    `${urlProject(api, owner, alias)}/setting/webhook/${uuid}`,
    token,
  );
  printWebhook(data, resolveFormat(flags, false));
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token, owner, alias } = ctx;
  if (!flags.url) die("usage: gitflic webhook create --url <target> [--secret S] [--event push|pull-request|...]");
  const events = [flags.event].flat().filter(Boolean);
  const eventsBody = {};
  for (const e of events) eventsBody[e] = true;
  const body = {
    url: flags.url,
    secret: flags.secret || "no-secret",
    events: Object.keys(eventsBody).length ? eventsBody : { PUSH: true },
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

async function deleteWebhook(ctx, args) {
  const { api, token, owner, alias } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic webhook delete <uuid>");
  await http(
    "POST",
    `${urlProject(api, owner, alias)}/setting/webhook/${uuid}/delete`,
    token,
  );
  process.stdout.write(`gitflic: webhook '${uuid}' deleted\n`);
}

export const usage = `Webhook commands (need --project owner/alias):
  webhook list                                          List webhooks
  webhook get <uuid>                                    Get one webhook
  webhook create --url U [--event E] [--event E] [--active true|false]
                                                          Create webhook (default events: push)
  webhook delete <uuid>                                 Delete webhook
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
    case "delete":
      return deleteWebhook(ctx, args);
    default:
      die(`unknown webhook subcommand: ${sub}`);
  }
}