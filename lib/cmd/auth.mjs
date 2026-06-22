// gitflic auth — login / logout / status / switch / list.
//
// Designed to match the UX of `gh auth` and `glab auth`:
//   - login validates the token against /user/me BEFORE storing it
//     (so a typo never poisons the keychain)
//   - logout supports `--as <name>` (single account) and `--all` (everything)
//   - status shows identity (alias/email), backend, active account
//   - switch / list enable multi-account setups (personal + work, cloud + self-hosted)
//
// Multi-account model (added for parity with gh/glab profiles):
//   - Default account name is "default", stored under key "token"
//   - Named accounts stored under "token:<name>" (e.g. "token:work")
//   - The "active-account" config key points at the currently-active name
//   - resolveToken() honors active-account when present
//
// Examples:
//   gitflic auth login --token xxxx
//   echo $TOKEN | gitflic auth login --stdin --as work
//   gitflic auth switch work
//   gitflic auth status
//   gitflic auth list
//   gitflic auth logout --all

import { createInterface } from "node:readline";

import { resolveApiBase, resolveToken } from "../http.mjs";
import {
  secretBackend, secretGet, secretSet, secretUnset, maskValue,
} from "../secret.mjs";
import { configGet, configSet, configDelete, configList } from "../config.mjs";
import { die } from "../format.mjs";

export const usage = `Manage authentication & active account.

USAGE
  gitflic auth <subcommand>

SUBCOMMANDS
  login  [--token <v>] [--stdin] [--as <name>] [--api-base URL]
            Validate token against /user/me, then store in OS keychain.
            Sources tried in order: --token flag, stdin, GITFLIC_TOKEN env.
            --as <name> stores under token:<name> AND marks it active.
            Default account is "default" (stored under key "token").

  logout [--as <name>] [--all]
            Remove a token from the store.
            --as <name> removes only token:<name>.
            --all removes every token:* (keychain + file fallback).
            With no flag, removes the active account's token.

  status
            Show identity (from /user/me), backend, active account, API base.
            Fails (exit 1) if the token can't reach the API.

  switch <name>
            Make <name> the active account. Refuses if no token is stored for it.

  list
            Show all known accounts with masked values; mark the active one with '*'.

EXAMPLES
  gitflic auth login --token xxxx-xxxx-xxxx
  echo $TOKEN | gitflic auth login --stdin --as work
  gitflic auth switch work
  gitflic auth status
  gitflic auth list
  gitflic auth logout --all
`;

const ACTIVE_KEY = "active-account";
const DEFAULT_ACCOUNT = "default";

// Storage key for an account's token.
export function tokenKey(account) {
  return account === DEFAULT_ACCOUNT ? "token" : `token:${account}`;
}

function activeAccount() {
  return configGet(ACTIVE_KEY) || DEFAULT_ACCOUNT;
}

async function readLoginToken(flags) {
  // Priority: --token > --stdin > GITFLIC_TOKEN env.
  if (flags.token && String(flags.token).length) return String(flags.token);
  if (flags.stdin) {
    const lines = [];
    for await (const line of createInterface({ input: process.stdin })) {
      lines.push(line);
    }
    const v = lines.join("\n").trim();
    if (!v) die("auth login: --stdin was empty");
    return v;
  }
  if (process.env.GITFLIC_TOKEN && process.env.GITFLIC_TOKEN.length) {
    return process.env.GITFLIC_TOKEN;
  }
  die("auth login: no token. Pass --token <v>, --stdin, or set GITFLIC_TOKEN.");
}

// Direct fetch — NOT via http(). We can't use http() here because it calls
// die() (which exits the process) on non-2xx responses, and we need to
// CATCH auth failures so we can refuse to store a bad token and show a
// friendly "unreachable" message in `auth status`.
async function apiWhoAmI(api, token) {
  const res = await fetch(`${api}/user/me`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) {
    let body = "";
    try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    const err = new Error(`HTTP ${res.status} ${res.statusText || ""}`.trim());
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// Tokens we know about: legacy/default "token" + every "token:<name>" the user
// has referenced (we record those in file config as `account:<name>=1` so we
// can enumerate without needing the OS keychain to support listing).
//
// Backward compat: if no `account:*` markers exist, just probe the default
// "token" key.
function knownTokenKeys() {
  const out = new Set(["token"]);
  for (const k of Object.keys(configList())) {
    if (k.startsWith("token:")) out.add(k);
  }
  return out;
}

function markAccount(account) {
  if (account === DEFAULT_ACCOUNT) return;
  configSet(`account:${account}`, "1");
}

export async function handle(ctx, sub, args, flags) {
  flags = flags || {};
  const api = (ctx && ctx.api) || resolveApiBase(flags);

  switch (sub) {
    case "login": {
      const account = flags.as || DEFAULT_ACCOUNT;
      const value = await readLoginToken(flags);
      // Validate BEFORE storing — never poison the keychain with a bad token.
      let me;
      try {
        me = await apiWhoAmI(api, value);
      } catch (e) {
        die(`auth login: token rejected (${e.message || e}). Not stored.`);
      }
      // Persist.
      const key = tokenKey(account);
      secretSet(key, value);
      markAccount(account);
      if (account !== DEFAULT_ACCOUNT) configSet(ACTIVE_KEY, account);
      else configDelete(ACTIVE_KEY); // clear stale pointer to a different account
      const backend = secretBackend().kind;
      const id = (me && (me.alias || me.username || me.id)) || "(unknown)";
      const email = me && me.email ? ` <${me.email}>` : "";
      process.stdout.write(`gitflic: logged in as ${id}${email} (account: ${account}, backend: ${backend})\n`);
      return;
    }
    case "logout": {
      if (flags.all) {
        // Wipe known token keys from both stores. We can't enumerate the
        // OS keychain, but we DO know which keys exist (legacy + account:*).
        const keys = knownTokenKeys();
        for (const k of keys) {
          try { secretUnset(k); } catch { /* ignore */ }
          try { configDelete(k); } catch { /* ignore */ }
        }
        try { configDelete(ACTIVE_KEY); } catch { /* ignore */ }
        process.stdout.write(`gitflic: all tokens cleared (${keys.size} account key(s))\n`);
        return;
      }
      const account = flags.as || activeAccount();
      const key = tokenKey(account);
      try { secretUnset(key); } catch { /* ignore */ }
      try { configDelete(key); } catch { /* ignore */ }
      if (account === activeAccount()) configDelete(ACTIVE_KEY);
      process.stdout.write(`gitflic: logged out (account: ${account})\n`);
      return;
    }
    case "switch": {
      const name = args[0];
      if (!name) die("auth switch <name>");
      if (secretGet(tokenKey(name)) === undefined) {
        die(
          `auth switch: no token stored for account '${name}'.\n` +
          `gitflic: run: gitflic auth login --as ${name}`,
        );
      }
      configSet(ACTIVE_KEY, name);
      process.stdout.write(`gitflic: switched to account '${name}'\n`);
      return;
    }
    case "list": {
      const keys = knownTokenKeys();
      const active = activeAccount();
      const rows = [];
      for (const k of [...keys].sort()) {
        const v = secretGet(k);
        if (v === undefined) continue;
        const acct = k === "token" ? DEFAULT_ACCOUNT : k.slice("token:".length);
        rows.push({ acct, value: v });
      }
      if (rows.length === 0) {
        process.stdout.write("(no accounts; run `gitflic auth login`)\n");
        return;
      }
      const w = Math.max(...rows.map((r) => r.acct.length), DEFAULT_ACCOUNT.length);
      for (const r of rows) {
        const marker = r.acct === active ? "*" : " ";
        process.stdout.write(`${marker} ${r.acct.padEnd(w)}  ${maskValue("token", r.value)}\n`);
      }
      process.stdout.write(`(active: ${active}, backend: ${secretBackend().kind})\n`);
      return;
    }
    case "status":
    case undefined: {
      const account = activeAccount();
      const backend = secretBackend().kind;
      // status needs a token. Prefer ctx.token if dispatcher already resolved it;
      // otherwise re-resolve (this will hit the active account or die).
      const token = (ctx && ctx.token) || resolveToken(flags);
      let identity = null;
      let error = null;
      try {
        identity = await apiWhoAmI(api, token);
      } catch (e) {
        error = e.message || String(e);
      }
      if (identity) {
        const id = identity.alias || identity.username || identity.id || "(unknown)";
        const email = identity.email ? ` <${identity.email}>` : "";
        process.stdout.write(
          `account:    ${account}\n` +
          `backend:    ${backend}\n` +
          `identity:   ${id}${email}\n` +
          `api:        ${api}\n`,
        );
        return;
      }
      process.stdout.write(
        `account:    ${account}\n` +
        `backend:    ${backend}\n` +
        `identity:   (unreachable — ${error})\n` +
        `api:        ${api}\n`,
      );
      process.exitCode = 1;
      return;
    }
    default:
      process.stderr.write(`gitflic auth: unknown subcommand: ${sub}. Use login | logout | status | switch | list.\n`);
      process.exit(2);
  }
}

// Exposed for tests / other modules that need the active-account pointer.
export const __test__ = { activeAccount, tokenKey, knownTokenKeys };
