// gitflic saml — SAML SSO endpoints under /admin/saml. Admin only (code-only).

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";
import { buildPageQs } from "../paginate.mjs";

// Build the create/edit request body from flags. Used by both create and edit.
function samlBody(flags) {
  const body = {};
  if (flags.name !== undefined) body.name = flags.name;
  if (flags["idp-metadata-url"] !== undefined)
    body.idpMetadataUrl = flags["idp-metadata-url"];
  if (flags["idp-issuer"] !== undefined) body.idpIssuer = flags["idp-issuer"];
  if (flags["idp-initiated-sso-url"] !== undefined)
    body.idpInitiatedSsoUrl = flags["idp-initiated-sso-url"];
  if (flags.cert !== undefined) body.cert = flags.cert;
  return body;
}

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const qs = buildPageQs(flags);
  const url = `${api}/admin/saml${qs.toString() ? `?${qs}` : ""}`;
  const data = await http("GET", url, token);
  printJson(data);
  return data;
}

async function create(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.name) die("gitflic saml create requires --name");
  const data = await http("POST", `${api}/admin/saml`, token, samlBody(flags));
  printJson(data);
  return data;
}

async function edit(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic saml edit <samlUuid> [--name ... --cert ...]");
  const data = await http(
    "PUT",
    `${api}/admin/saml/${encodeURIComponent(uuid)}`,
    token,
    samlBody(flags),
  );
  printJson(data);
  return data;
}

async function changeStatus(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid)
    die("usage: gitflic saml change-status <samlUuid> --enabled true|false");
  if (flags.enabled === undefined)
    die("gitflic saml change-status requires --enabled true|false");
  const isEnabled = flags.enabled === true || String(flags.enabled) === "true";
  const qs = new URLSearchParams({ isEnabled: String(isEnabled) });
  // NOTE: spec shows NO slash before "change-status" — replicate exactly.
  const url = `${api}/admin/saml/${encodeURIComponent(uuid)}change-status/?${qs}`;
  const data = await http("PUT", url, token);
  printJson(data);
  return data;
}

export const usage = `SAML SSO commands (admin only — code-only, not live-tested):
  saml list [--page N --size N]                          List SAML connections (GET /admin/saml)
  saml create --name <n> [--idp-metadata-url <u>] [--idp-issuer <s>]
              [--idp-initiated-sso-url <u>] [--cert <pem>]
                                                        Create SAML connection (POST /admin/saml)
  saml edit <samlUuid> [--name <n>] [--idp-metadata-url <u>] [--idp-issuer <s>]
            [--idp-initiated-sso-url <u>] [--cert <pem>]
                                                        Edit SAML connection (PUT /admin/saml/{uuid})
  saml change-status <samlUuid> --enabled true|false    Enable/disable connection (PUT /admin/saml/{uuid}change-status)
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    case "create":
      return create(ctx, args, flags);
    case "edit":
      return edit(ctx, args, flags);
    case "change-status":
      return changeStatus(ctx, args, flags);
    default:
      die(`unknown saml subcommand: ${sub}`);
  }
}
