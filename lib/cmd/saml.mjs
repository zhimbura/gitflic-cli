// gitflic saml — SAML SSO endpoints. Code-only — requires admin token.

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";

async function list(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/saml`, token);
  printJson(data);
  return data;
}

export const usage = `SAML SSO commands (admin only — code-only):
  saml list                                              List SAML SSO configurations

Configure SAML providers via the GitFlic admin panel web UI.
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case undefined:
    case "list":
      return list(ctx, args, flags);
    default:
      die(`unknown saml subcommand: ${sub}`);
  }
}