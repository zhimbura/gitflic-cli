// gitflic settings — user settings, ssh keys, oauth apps, tokens.

import {
  color,
  die,
  printJson,
  printEmpty,
  resolveFormat,
} from "../format.mjs";
import { http } from "../http.mjs";
import { readFileSync } from "node:fs";

// ---------- ssh keys ------------------------------------------------------
// GitFlic's REST API only exposes POST /user/settings/add-ssh-key — there
// is no documented list or delete endpoint. Use the web UI for those.

async function sshAdd(ctx, args, flags) {
  const { api, token } = ctx;
  const title = flags.title || args[1];
  let publicKey = args[0];
  if (!publicKey || !title) die("usage: gitflic settings ssh add <publicKeyOrPath> --title <name> [--expires <ISO>]");
  if (publicKey.startsWith("ssh-") || publicKey.startsWith("ecdsa-")) {
    // looks like inline key
  } else {
    // treat as file path
    try {
      publicKey = readFileSync(publicKey, "utf8").trim();
    } catch (err) {
      die(`cannot read key file '${publicKey}': ${err.message}`);
    }
  }
  const body = { publicKey, title, expiresAt: flags.expires || "" };
  const data = await http("POST", `${api}/user/settings/add-ssh-key`, token, body);
  printJson(data);
  return data;
}

// ---------- oauth apps ----------------------------------------------------

function printOauth(o, format) {
  if (format === "json") return printJson(o);
  process.stdout.write(
    `${color(o.name || "?", 1)} (id: ${color(o.id?.slice(0, 8), 36)})\n` +
      `  clientId:     ${o.clientId}\n` +
      `  description:  ${o.description || "—"}\n` +
      `  homepage:     ${o.homepageUrl}\n` +
      `  callback:     ${o.authCallbackUrl}\n`,
  );
}

function printOauthList(data, format) {
  const list = data?._embedded?.oauthModelList || [];
  if (format === "json") return printJson(data);
  if (!list.length) return printEmpty("oauth apps");
  for (const o of list) printOauth(o, "pretty");
}

async function oauthList(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/user/settings/oauth`, token);
  printOauthList(data, resolveFormat(flags, true));
  return data;
}

async function oauthGet(ctx, args, flags) {
  const { api, token } = ctx;
  const id = args[0];
  if (!id) die("usage: gitflic settings oauth get <id>");
  const data = await http("GET", `${api}/user/settings/oauth/${id}`, token);
  printOauth(data, resolveFormat(flags, false));
  return data;
}

async function oauthCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.name) die("usage: gitflic settings oauth create --name <name> --homepage <url> --callback <url> [--description D] [--standalone]");
  const body = {
    name: flags.name,
    description: flags.description || "",
    homepageUrl: flags.homepage,
    authCallbackUrl: flags.callback,
    standalone: !!flags.standalone,
  };
  const data = await http("POST", `${api}/user/settings/oauth`, token, body);
  printOauth(data, resolveFormat(flags, false));
  return data;
}

async function oauthEdit(ctx, args, flags) {
  const { api, token } = ctx;
  const id = args[0];
  if (!id || !flags.name)
    die("usage: gitflic settings oauth edit <id> --name N [--homepage URL] [--callback URL] [--description D] [--standalone]");
  const body = {
    name: flags.name,
    description: flags.description || "",
    homepageUrl: flags.homepage,
    authCallbackUrl: flags.callback,
    standalone: !!flags.standalone,
  };
  const data = await http("PUT", `${api}/user/settings/oauth/${encodeURIComponent(id)}`, token, body);
  printOauth(data, resolveFormat(flags, false));
  return data;
}

async function oauthDelete(ctx, args) {
  const { api, token } = ctx;
  const id = args[0];
  if (!id) die("usage: gitflic settings oauth delete <id>");
  await http("DELETE", `${api}/user/settings/oauth/${encodeURIComponent(id)}`, token);
  process.stdout.write(`gitflic: oauth app '${id}' deleted\n`);
}

// ---------- access-token (API token) -------------------------------------
// scopes: USER_READ, USER_WRITE, PROJECT_READ, PROJECT_WRITE, PROJECT_EDIT,
// TEAM_READ, TEAM_WRITE, COMPANY_READ, COMPANY_WRITE, READ_REGISTRY, WRITE_REGISTRY

async function accessTokenCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.name)
    die("usage: gitflic settings access-token create --name N [--scope USER_READ ...] [--expires <ISO>]");
  const scopes = [flags.scope].flat().filter(Boolean);
  const body = {
    name: flags.name,
    scopes: scopes.length ? scopes : ["USER_READ"],
  };
  if (flags.expires) body.expiresAt = flags.expires;
  const data = await http("POST", `${api}/user/settings/access-token/create`, token, body);
  printJson(data);
  return data;
}

// ---------- transport-token (git push cred) ------------------------------

async function transportTokenCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.name) die("usage: gitflic settings transport-token create --name <name> [--scope READ_REGISTRY] [--scope WRITE_REGISTRY]");
  const scopes = [flags.scope].flat().filter(Boolean);
  const body = { name: flags.name, scopes: scopes.length ? scopes : ["READ_REGISTRY", "WRITE_REGISTRY"] };
  const data = await http("POST", `${api}/user/settings/transport-token/create`, token, body);
  printJson(data);
  return data;
}

// ---------- profile changes ----------------------------------------------

async function changeEmail(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.email) die("usage: gitflic settings change-email --email <addr>");
  const data = await http("PUT", `${api}/user/change-email`, token, { email: flags.email });
  printJson(data);
  return data;
}

async function changeUsername(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.username) die("usage: gitflic settings change-username --username <new>");
  const data = await http("PUT", `${api}/user/change-username`, token, { username: flags.username });
  printJson(data);
  return data;
}

async function changePassword(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags["old-password"] || !flags.password)
    die("usage: gitflic settings change-password --old-password <old> --password <new> --password-confirm <new>");
  const body = {
    oldPassword: flags["old-password"],
    password: flags.password,
    passwordConfirm: flags["password-confirm"] || flags.password,
  };
  const data = await http("PUT", `${api}/user/change-password`, token, body);
  printJson(data);
  return data;
}

export const usage = `Settings commands (no project needed):

  SSH keys:
    settings ssh add <publicKeyOrPath> --title N [--expires <ISO>]
                                                     Add SSH key (reads file if path)
                                                     (List/delete SSH keys is not exposed via REST — use the GitFlic web UI)

  OAuth apps:
    settings oauth list                            List your OAuth apps
    settings oauth get <id>                        Get OAuth app
    settings oauth create --name N --homepage URL --callback URL [--description D] [--standalone]
                                                     Create OAuth app
    settings oauth edit <id> --name N [--homepage URL] [--callback URL] [--description D] [--standalone]
                                                     Edit OAuth app
    settings oauth delete <id>                     Delete OAuth app

  Tokens:
    settings transport-token create --name N [--scope READ_REGISTRY] [--scope WRITE_REGISTRY]
                                                     Create transport token (used as git password)
                                                     (NOTE: GitFlic does not accept transport-token for HTTPS git push — use SSH key)

    settings access-token create --name N [--scope S]... [--expires <ISO>]
                                                     Create API access token. Repeat --scope per right
                                                     (USER_READ, USER_WRITE, PROJECT_READ, PROJECT_WRITE,
                                                      PROJECT_EDIT, TEAM_READ, TEAM_WRITE, COMPANY_READ,
                                                      COMPANY_WRITE, READ_REGISTRY, WRITE_REGISTRY)
                                                     (CAVEAT: known-issues report this endpoint may require
                                                      HTTP Basic Auth; if it 401/403s, create via web UI.)

  Profile changes:
    settings change-email --email <addr>            Change email
    settings change-username --username <new>       Change username (irreversible!)
    settings change-password --old-password <old> --password <new> [--password-confirm <new>]
                                                     Change password
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "ssh":
      return dispatchSsh(ctx, args[0], args.slice(1), flags);
    case "oauth":
      return dispatchOauth(ctx, args[0], args.slice(1), flags);
    case "transport-token":
      return dispatchTransportToken(ctx, args[0], args.slice(1), flags);
    case "change-email":
      return changeEmail(ctx, args, flags);
    case "change-username":
      return changeUsername(ctx, args, flags);
    case "change-password":
      return changePassword(ctx, args, flags);
    case "access-token":
      return dispatchAccessToken(ctx, args[0], args.slice(1), flags);
    default:
      die(`unknown settings subcommand: ${sub}`);
  }
}

function dispatchSsh(ctx, sub, args, flags) {
  switch (sub) {
    case "add":
    case undefined:
      return sshAdd(ctx, args, flags);
    default:
      die(`unknown settings ssh subcommand: ${sub}`);
  }
}
function dispatchOauth(ctx, sub, args, flags) {
  switch (sub) {
    case "list":
    case undefined:
      return oauthList(ctx, args, flags);
    case "get":
      return oauthGet(ctx, args, flags);
    case "create":
      return oauthCreate(ctx, args, flags);
    case "edit":
      return oauthEdit(ctx, args, flags);
    case "delete":
      return oauthDelete(ctx, args);
    default:
      die(`unknown settings oauth subcommand: ${sub}`);
  }
}
function dispatchTransportToken(ctx, sub, args, flags) {
  switch (sub) {
    case "create":
      return transportTokenCreate(ctx, args, flags);
    default:
      die(`unknown settings transport-token subcommand: ${sub || "<missing>"}`);
  }
}
function dispatchAccessToken(ctx, sub, args, flags) {
  switch (sub) {
    case "create":
      return accessTokenCreate(ctx, args, flags);
    default:
      die(`unknown settings access-token subcommand: ${sub || "<missing>"}`);
  }
}