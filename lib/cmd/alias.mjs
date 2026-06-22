// gitflic alias — set/get/list per-user config keys (e.g. default-project).
//
// Sensitive keys (token, *password*, *secret*, *api[-_]key*, *private[-_]key*)
// are routed through the OS secret store (lib/secret.mjs) which prefers
// macOS Keychain → Linux libsecret → encrypted file with chmod 0600.
// Non-sensitive keys stay in the JSON config file.
//
// Examples:
//   gitflic alias set default-project tikhon/wave
//   gitflic alias set token xxxx-xxxx-xxxx           # → keychain or chmod 0600 file
//   gitflic alias get default-project
//   gitflic alias get token --reveal                  # print full token (careful!)
//   gitflic alias unset token
//   gitflic alias list
//   gitflic alias path

import {
  configGet, configSet, configDelete, configList, configPath, configClear,
} from "../config.mjs";
import {
  isSensitiveKey, maskValue, secretBackend, secretGet, secretSet, secretUnset,
} from "../secret.mjs";
import { printJson } from "../format.mjs";

export const usage = `User-level config (persistent key/value store):
  alias list                          List all keys (sensitive values are masked)
  alias get <key> [--reveal]          Print one value (sensitive values masked unless --reveal)
  alias set <key> <value>             Set a key (sensitive keys → OS keychain when available)
  alias unset <key>                   Delete a key (also removes from keychain)
  alias path                          Print the config file path
  alias clear                         Remove the whole config file (NOT the keychain)

Known keys:
  default-project                    Used when --project is not given and git auto-detect fails
  api-base                           Default API base URL (overridable by --api-base)
  token                              Access token (stored in OS keychain if available, else chmod 0600 file)

Secret store:
  gitflic reads/writes 'token' (and any '*password*', '*secret*', '*api-key*',
  '*private-key*' key) via the OS keychain on macOS (\`security\`) and Linux
  (\`secret-tool\`), falling back to the config file with chmod 0600.
  Disable with GITFLIC_NO_SECRET_STORE=1 (you'll have to use GITFLIC_TOKEN env var).
`;

// Where a key actually lives, given current backend.
//   secret store if sensitive + backend available
//   file otherwise
function storeFor(key) {
  if (isSensitiveKey(key)) return "secret";
  return "file";
}

function maybeDeleteFromOther(key) {
  // When the user moves a key from one store to another, clean up the old home.
  // BUT: when the secret backend is `file`, both stores share the same file —
  // we'd immediately erase what we just wrote. Only clean up when we're
  // actually using a different backend (keychain).
  if (secretBackend().kind === "file") return;
  if (isSensitiveKey(key)) {
    try { configDelete(key); } catch { /* wasn't there */ }
  } else {
    try { secretUnset(key); } catch { /* wasn't there */ }
  }
}

function fmtValue(key, value) {
  if (typeof value === "string") return maskValue(key, value);
  return maskValue(key, JSON.stringify(value));
}

export async function handle(_ctx, sub, args, flags) {
  const reveal = !!flags.reveal;

  switch (sub) {
    case "list": {
      // Gather from both stores; mask sensitive values either way.
      const file = configList();
      const sensitivePresent = isSensitiveKey("token") && !!secretGet("token");
      const keys = new Set([...Object.keys(file), ...(sensitivePresent ? ["token"] : [])]);
      if (keys.size === 0) {
        process.stdout.write(`(no keys set; try \`gitflic alias set default-project owner/alias\` or \`gitflic alias set token <token>\`)\n`);
        return;
      }
      for (const k of [...keys].sort()) {
        const v = k === "token" && sensitivePresent
          ? secretGet("token")
          : file[k];
        process.stdout.write(`${k} = ${fmtValue(k, v)}\n`);
      }
      // Show backend info so the user knows where secrets live.
      const b = secretBackend();
      if (sensitivePresent) {
        process.stdout.write(`(token backend: ${b.kind}${b.platform ? ` / ${b.platform}` : ""})\n`);
      }
      return;
    }
    case "get": {
      const k = args[0];
      if (!k) {
        process.stderr.write("gitflic: alias get <key>\n");
        process.exit(2);
      }
      let v;
      if (isSensitiveKey(k)) {
        v = secretGet(k);
        if (v === undefined) v = configGet(k); // try file as legacy fallback
      } else {
        v = configGet(k);
      }
      if (v === undefined) {
        process.stderr.write(`gitflic: alias: key not set: ${k}\n`);
        process.exit(1);
      }
      if (isSensitiveKey(k) && !reveal) {
        process.stdout.write(`${maskValue(k, v)}\n`);
        process.stderr.write(`(masked — pass --reveal to print the full value)\n`);
        return;
      }
      if (typeof v === "string") process.stdout.write(v + "\n");
      else printJson(v);
      return;
    }
    case "set": {
      const k = args[0];
      const v = args[1];
      if (!k || v === undefined) {
        process.stderr.write("gitflic: alias set <key> <value>\n");
        process.exit(2);
      }
      if (storeFor(k) === "secret") {
        secretSet(k, v);
        maybeDeleteFromOther(k);
      } else {
        configSet(k, v);
      }
      const stored = storeFor(k) === "secret" ? secretBackend().kind : "file";
      process.stdout.write(`gitflic: alias ${k} set (backend: ${stored})\n`);
      return;
    }
    case "unset":
    case "delete": {
      const k = args[0];
      if (!k) {
        process.stderr.write("gitflic: alias unset <key>\n");
        process.exit(2);
      }
      // Always try both stores — cheap and idempotent.
      try { secretUnset(k); } catch { /* ignore */ }
      try { configDelete(k); } catch { /* ignore */ }
      process.stdout.write(`gitflic: alias ${k} removed\n`);
      return;
    }
    case "path":
      process.stdout.write(`${configPath()}\n`);
      return;
    case "clear":
      configClear();
      process.stdout.write(`gitflic: config cleared (was ${configPath()}) — keychain entries untouched\n`);
      return;
    case "info":
    case undefined: {
      const all = configList();
      const b = secretBackend();
      const tokenPresent = !!secretGet("token");
      process.stdout.write(
        `path:        ${configPath()}\n` +
          `keys:        ${Object.keys(all).length}\n` +
          `secret store: ${b.kind}${b.platform ? ` / ${b.platform}` : ""} (${b.available ? "available" : "unavailable"})\n` +
          `token:       ${tokenPresent ? "set" : "unset"}\n` +
          `disable cfg: GITFLIC_NO_CONFIG=1\n` +
          `disable sec: GITFLIC_NO_SECRET_STORE=1\n`,
      );
      return;
    }
    default:
      process.stderr.write(`gitflic: alias: unknown subcommand: ${sub}. Use list | get | set | unset | path | clear.\n`);
      process.exit(2);
  }
}
