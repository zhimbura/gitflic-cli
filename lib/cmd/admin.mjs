// gitflic admin — admin-only endpoints. Most require admin scope on the token.
// Implemented as code-only — live tests skipped unless you have admin scope.
// (runners live in runner.mjs; saml lives in saml.mjs)

import { die, printJson } from "../format.mjs";
import { http } from "../http.mjs";
import { paginatedList, buildPageQs } from "../paginate.mjs";

const enc = encodeURIComponent;

// ---------- existing legacy admin lists (not in public REST docs) ----------

async function listUsers(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path: "/admin/user",
    embeddedKey: "userList",
    flags,
  });
  if (data === null) return null;
  printJson(data);
  return data;
}

async function listProjects(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await paginatedList({
    api, token,
    path: "/admin/project",
    embeddedKey: "projectList",
    flags,
  });
  if (data === null) return null;
  printJson(data);
  return data;
}

// ---------- user management ------------------------------------------------

async function userKeyCreate(ctx, args, flags) {
  const { api, token } = ctx;
  const userAlias = args[0];
  const publicKey = flags["public-key"] || args[1];
  if (!userAlias || !publicKey || !flags.title) {
    die("usage: gitflic admin user key-create <userAlias> --public-key <key> --title <t> [--expires-at <ISO>]");
  }
  const body = { publicKey, title: flags.title };
  if (flags["expires-at"]) body.expiresAt = flags["expires-at"];
  const data = await http("POST", `${api}/admin/user/${enc(userAlias)}/key/create`, token, body);
  printJson(data);
  return data;
}

async function userKeyList(ctx, args, flags) {
  const { api, token } = ctx;
  const userAlias = args[0];
  if (!userAlias) die("usage: gitflic admin user key-list <userAlias>");
  const data = await http("GET", `${api}/admin/user/${enc(userAlias)}/key`, token);
  printJson(data);
  return data;
}

async function userCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  if (!flags.email || !flags.password || !flags.alias) {
    die("usage: gitflic admin user create --email <e> --password <p> --alias <a>");
  }
  const body = { email: flags.email, password: flags.password, alias: flags.alias };
  const data = await http("POST", `${api}/user`, token, body);
  printJson(data);
  return data;
}

async function userChangeEmail(ctx, args, flags) {
  const { api, token } = ctx;
  const userAlias = args[0];
  const email = flags.email || args[1];
  if (!userAlias || !email) die("usage: gitflic admin user change-email <userAlias> --email <e>");
  const data = await http("PUT", `${api}/admin/user/${enc(userAlias)}/change-email`, token, { email });
  printJson(data);
  return data;
}

async function userChangeUsername(ctx, args, flags) {
  const { api, token } = ctx;
  const userAlias = args[0];
  const username = flags.username || args[1];
  if (!userAlias || !username) die("usage: gitflic admin user change-username <userAlias> --username <u>");
  const data = await http("PUT", `${api}/admin/user/${enc(userAlias)}/change-username`, token, { username });
  printJson(data);
  return data;
}

async function userChangePassword(ctx, args, flags) {
  const { api, token } = ctx;
  const userAlias = args[0];
  const password = flags.password;
  const passwordConfirm = flags["password-confirm"] || flags.password;
  if (!userAlias || !password) {
    die("usage: gitflic admin user change-password <userAlias> --password <p> [--password-confirm <p>]");
  }
  const data = await http("PUT", `${api}/admin/user/${enc(userAlias)}/change-password`, token, {
    password,
    passwordConfirm,
  });
  printJson(data);
  return data;
}

async function userBan(ctx, args, flags) {
  const { api, token } = ctx;
  const userUuid = args[0];
  if (!userUuid) die("usage: gitflic admin user ban <userUuid> --reason <text>");
  const reason = flags.reason || args[1] || "";
  if (reason.length > 128) die("ban reason must be <= 128 chars");
  const data = await http("POST", `${api}/admin/user/${enc(userUuid)}/account/ban`, token, { reason });
  printJson(data);
  return data;
}

async function userUnban(ctx, args) {
  const { api, token } = ctx;
  const userUuid = args[0];
  if (!userUuid) die("usage: gitflic admin user unban <userUuid>");
  const data = await http("POST", `${api}/admin/user/${enc(userUuid)}/account/unban`, token);
  printJson(data);
  return data;
}

// ---------- push stats -----------------------------------------------------

async function pushStatsAll(ctx, _args, flags) {
  const { api, token } = ctx;
  const qs = buildPageQs(flags);
  const data = await http("GET", `${api}/user/push-stats/all${qs.size ? "?" + qs : ""}`, token);
  printJson(data);
  return data;
}

async function pushStatsSpecified(ctx, args, flags) {
  const { api, token } = ctx;
  const uuids = (flags.uuids ? String(flags.uuids).split(",") : args).map((s) => s.trim()).filter(Boolean);
  if (!uuids.length) {
    die("usage: gitflic admin push-stats specified <uuid> [<uuid>...]  (or --uuids a,b,c)");
  }
  const data = await http("GET", `${api}/user/push-stats/specified-users`, token, { userUuids: uuids });
  printJson(data);
  return data;
}

// ---------- settings -------------------------------------------------------

async function settingsGet(ctx, _args, flags) {
  const { api, token } = ctx;
  const data = await http("GET", `${api}/admin/settings`, token);
  printJson(data);
  return data;
}

function bool(v) {
  if (v === undefined) return undefined;
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return Boolean(v);
}
function num(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}
function list(v) {
  if (v === undefined) return undefined;
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

// Each settings group maps to one POST /admin/settings/<endpoint> with a body
// built from flags. group = subcommand name; build = (flags) => body.
const SETTINGS_GROUPS = {
  registration: {
    endpoint: "registration",
    build: (f) => ({
      disableLdapAuth: bool(f["disable-ldap-auth"]),
      disableSamlAuth: bool(f["disable-saml-auth"]),
      disableOidcAuth: bool(f["disable-oidc-auth"]),
      disableMailAuth: bool(f["disable-mail-auth"]),
    }),
    help: "--disable-ldap-auth --disable-saml-auth --disable-oidc-auth --disable-mail-auth (bool)",
  },
  download: {
    endpoint: "download",
    build: (f) => ({ fileDownload: bool(f["file-download"]) }),
    help: "--file-download <bool>",
  },
  pull: {
    endpoint: "pull",
    build: (f) => ({ pullRepoFromAnonUser: bool(f["pull-repo-from-anon-user"]) }),
    help: "--pull-repo-from-anon-user <bool>",
  },
  "download-release": {
    endpoint: "download-release",
    build: (f) => ({ downloadFromAnonUserEnable: bool(f["download-from-anon-user-enable"]) }),
    help: "--download-from-anon-user-enable <bool>",
  },
  "auto-confirm": {
    endpoint: "auto-confirm",
    build: (f) => ({ autoConfirm: bool(f["auto-confirm"]) }),
    help: "--auto-confirm <bool>",
  },
  "email-validation": {
    endpoint: "email-validation",
    build: (f) => ({ enableEmailValidation: bool(f["enable-email-validation"]) }),
    help: "--enable-email-validation <bool>",
  },
  "domain-validation": {
    endpoint: "domain-validation",
    build: (f) => ({
      enableDomainValidation: bool(f["enable-domain-validation"]),
      enableWhiteList: bool(f["enable-white-list"]),
      blackListDomains: list(f["black-list-domains"]),
      whiteListDomains: list(f["white-list-domains"]),
    }),
    help: "--enable-domain-validation <bool> --enable-white-list <bool> --black-list-domains a,b --white-list-domains a,b",
  },
  "api-limit": {
    endpoint: "api-limit",
    build: (f) => ({
      disableApiLimit: bool(f["disable-api-limit"]),
      userApiCountLimit: num(f["user-api-count-limit"]),
    }),
    help: "--disable-api-limit <bool> --user-api-count-limit <n>",
  },
  "ssh-port": {
    endpoint: "ssh-port",
    build: (f) => ({
      enableCustomSshPort: bool(f["enable-custom-ssh-port"]),
      sshPort: num(f["ssh-port"]),
    }),
    help: "--enable-custom-ssh-port <bool> --ssh-port <n>",
  },
  "anonymous-global-registry-access": {
    endpoint: "anonymous-global-registry-access",
    build: (f) => ({ anonymousGlobalRegistryAccess: bool(f["anonymous-global-registry-access"]) }),
    help: "--anonymous-global-registry-access <bool>",
  },
  "public-repository-auto-permission": {
    endpoint: "public-repository-auto-permission",
    build: (f) => ({ enabled: bool(f.enabled) }),
    help: "--enabled <bool>",
  },
  "mirror-update-lag": {
    endpoint: "mirror-update-lag",
    build: (f) => ({ projectUpdateLag: num(f["project-update-lag"]) }),
    help: "--project-update-lag <n>",
  },
  "session-max-inactive-interval": {
    endpoint: "session-max-inactive-interval",
    build: (f) => ({ sessionMaxInactiveIntervalMinutes: num(f["session-max-inactive-interval-minutes"]) }),
    help: "--session-max-inactive-interval-minutes <n>",
  },
  "mirror-update-interval": {
    endpoint: "mirror-update-interval",
    build: (f) => ({
      pushMirrorUpdateIntervalMinutes: num(f["push-mirror-update-interval-minutes"]),
      pullMirrorUpdateIntervalMinutes: num(f["pull-mirror-update-interval-minutes"]),
    }),
    help: "--push-mirror-update-interval-minutes <n> --pull-mirror-update-interval-minutes <n>",
  },
  "create-permissions": {
    endpoint: "create-permissions",
    build: (f) => ({
      enableCreateProject: bool(f["enable-create-project"]),
      enableCreateTeam: bool(f["enable-create-team"]),
      enableCreateCompany: bool(f["enable-create-company"]),
    }),
    help: "--enable-create-project <bool> --enable-create-team <bool> --enable-create-company <bool>",
  },
  "login-page": {
    endpoint: "login-page",
    build: (f) => ({
      loginPageUrl: f["login-page-url"],
      isEnableBasic: bool(f["is-enable-basic"]),
      isEnableLdap: bool(f["is-enable-ldap"]),
      isEnableSaml: bool(f["is-enable-saml"]),
      isEnableOidc: bool(f["is-enable-oidc"]),
    }),
    help: "--login-page-url BASIC|SAML|LDAP|OIDC --is-enable-basic <bool> --is-enable-ldap <bool> --is-enable-saml <bool> --is-enable-oidc <bool>",
  },
  "lock-account": {
    endpoint: "lock-account",
    build: (f) => ({
      lockUser: bool(f["lock-user"]),
      maxAttempts: num(f["max-attempts"]),
      timeToLockUser: num(f["time-to-lock-user"]),
      timeToCountFailUserLoginAttempts: num(f["time-to-count-fail-user-login-attempts"]),
    }),
    help: "--lock-user <bool> --max-attempts <n> --time-to-lock-user <n> --time-to-count-fail-user-login-attempts <n>",
  },
  "archive-password": {
    endpoint: "archive-password",
    build: (f) => ({
      enableArchiveUserPasswords: bool(f["enable-archive-user-passwords"]),
      maxUserArchivedPasswords: num(f["max-user-archived-passwords"]),
    }),
    help: "--enable-archive-user-passwords <bool> --max-user-archived-passwords <n>",
  },
};

function pruneUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function settingsSet(ctx, args, flags) {
  const { api, token } = ctx;
  const group = args[0];
  if (!group || !SETTINGS_GROUPS[group]) {
    const names = Object.keys(SETTINGS_GROUPS).join(" | ");
    die(`usage: gitflic admin settings set <group> [flags]\n  groups: ${names}`);
  }
  const spec = SETTINGS_GROUPS[group];
  const body = pruneUndefined(spec.build(flags));
  if (!Object.keys(body).length) {
    die(`gitflic admin settings set ${group}: nothing to set. Fields: ${spec.help}`);
  }
  const data = await http("POST", `${api}/admin/settings/${spec.endpoint}`, token, body);
  printJson(data);
  return data;
}

// ---------- LDAP -----------------------------------------------------------

async function ldapImport(ctx, args) {
  const { api, token } = ctx;
  const ldapUuid = args[0];
  if (!ldapUuid) die("usage: gitflic admin ldap import <ldapUuid>");
  const data = await http("POST", `${api}/admin/ldap/${enc(ldapUuid)}/users/import`, token);
  printJson(data);
  return data;
}

// ---------- usage ----------------------------------------------------------

export const usage = `Admin commands (ALL require admin scope on the token — 403/404 for normal users; code-only, not live-tested):
  admin user list [--page N --size N] [--all]            List ALL users (legacy; not in public REST docs, may 404)
  admin project list [--page N --size N] [--all]         List ALL projects (legacy; not in public REST docs, may 404)
  admin user create --email <e> --password <p> --alias <a>
                                                        Create a user (POST /user)
  admin user key-create <userAlias> --public-key <key> --title <t> [--expires-at <ISO>]
                                                        Add SSH key to a user
  admin user key-list <userAlias>                       List a user's SSH keys
  admin user change-email <userAlias> --email <e>        Change a user's email
  admin user change-username <userAlias> --username <u>  Change a user's username
  admin user change-password <userAlias> --password <p> [--password-confirm <p>]
                                                        Change a user's password
  admin user ban <userUuid> --reason <text>             Ban a user (reason <= 128 chars)
  admin user unban <userUuid>                           Unban a user
  admin push-stats all [--page N --size N]               Push stats for all users
  admin push-stats specified <uuid>... | --uuids a,b,c   Push stats for specified users
  admin settings get                                    Show service settings object
  admin settings set <group> [flags]                    Update a settings group (POST /admin/settings/<group>):
    registration   --disable-ldap-auth --disable-saml-auth --disable-oidc-auth --disable-mail-auth
    download       --file-download <bool>
    pull           --pull-repo-from-anon-user <bool>
    download-release  --download-from-anon-user-enable <bool>
    auto-confirm   --auto-confirm <bool>
    email-validation  --enable-email-validation <bool>
    domain-validation --enable-domain-validation <bool> --enable-white-list <bool> --black-list-domains a,b --white-list-domains a,b
    api-limit      --disable-api-limit <bool> --user-api-count-limit <n>
    ssh-port       --enable-custom-ssh-port <bool> --ssh-port <n>
    anonymous-global-registry-access  --anonymous-global-registry-access <bool>
    public-repository-auto-permission --enabled <bool>
    mirror-update-lag  --project-update-lag <n>
    session-max-inactive-interval  --session-max-inactive-interval-minutes <n>
    mirror-update-interval  --push-mirror-update-interval-minutes <n> --pull-mirror-update-interval-minutes <n>
    create-permissions  --enable-create-project <bool> --enable-create-team <bool> --enable-create-company <bool>
    login-page     --login-page-url BASIC|SAML|LDAP|OIDC --is-enable-basic --is-enable-ldap --is-enable-saml --is-enable-oidc
    lock-account   --lock-user <bool> --max-attempts <n> --time-to-lock-user <n> --time-to-count-fail-user-login-attempts <n>
    archive-password  --enable-archive-user-passwords <bool> --max-user-archived-passwords <n>
  admin ldap import <ldapUuid>                          Trigger LDAP user sync
  (runners → 'gitflic runner'; SAML → 'gitflic saml')
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "user":
      return dispatchUser(ctx, args[0], args.slice(1), flags);
    case "project":
      return dispatchProject(ctx, args[0], args.slice(1), flags);
    case "push-stats":
      return dispatchPushStats(ctx, args[0], args.slice(1), flags);
    case "settings":
      return dispatchSettings(ctx, args[0], args.slice(1), flags);
    case "ldap":
      return dispatchLdap(ctx, args[0], args.slice(1), flags);
    default:
      die(`unknown admin subcommand: ${sub}`);
  }
}

function dispatchUser(ctx, sub, args, flags) {
  switch (sub) {
    case "list":
      return listUsers(ctx, args, flags);
    case "create":
      return userCreate(ctx, args, flags);
    case "key-create":
      return userKeyCreate(ctx, args, flags);
    case "key-list":
      return userKeyList(ctx, args, flags);
    case "change-email":
      return userChangeEmail(ctx, args, flags);
    case "change-username":
      return userChangeUsername(ctx, args, flags);
    case "change-password":
      return userChangePassword(ctx, args, flags);
    case "ban":
      return userBan(ctx, args, flags);
    case "unban":
      return userUnban(ctx, args, flags);
    default:
      die(`unknown admin user subcommand: ${sub}`);
  }
}

function dispatchProject(ctx, sub, args, flags) {
  switch (sub) {
    case "list":
      return listProjects(ctx, args, flags);
    default:
      die(`unknown admin project subcommand: ${sub}`);
  }
}

function dispatchPushStats(ctx, sub, args, flags) {
  switch (sub) {
    case "all":
      return pushStatsAll(ctx, args, flags);
    case "specified":
      return pushStatsSpecified(ctx, args, flags);
    default:
      die(`unknown admin push-stats subcommand: ${sub}. Use all | specified.`);
  }
}

function dispatchSettings(ctx, sub, args, flags) {
  switch (sub) {
    case "get":
      return settingsGet(ctx, args, flags);
    case "set":
      return settingsSet(ctx, args, flags);
    default:
      die(`unknown admin settings subcommand: ${sub}. Use get | set.`);
  }
}

function dispatchLdap(ctx, sub, args, flags) {
  switch (sub) {
    case "import":
      return ldapImport(ctx, args, flags);
    default:
      die(`unknown admin ldap subcommand: ${sub}. Use import.`);
  }
}
