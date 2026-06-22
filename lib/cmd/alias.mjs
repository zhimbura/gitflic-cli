// gitflic alias — set/get/list per-user config keys (e.g. default-project).
//
// Examples:
//   gitflic alias set default-project tikhon/wave
//   gitflic alias get default-project
//   gitflic alias unset default-project
//   gitflic alias list
//   gitflic alias path

import {
  configGet, configSet, configDelete, configList, configPath, configClear,
} from "../config.mjs";
import { printJson } from "../format.mjs";

export const usage = `User-level config (persistent key/value store):
  alias list                          List all keys with values
  alias get <key>                     Print one value
  alias set <key> <value>             Set a key
  alias unset <key>                   Delete a key
  alias path                          Print the config file path
  alias clear                         Remove the whole config file

Known keys:
  default-project                    Used when --project is not given and git auto-detect fails
  api-base                           Default API base URL (overridable by --api-base)
`;

export async function handle(_ctx, sub, args, _flags) {
  switch (sub) {
    case "list": {
      const all = configList();
      if (Object.keys(all).length === 0) {
        process.stdout.write("(no keys set; run \`gitflic alias set default-project owner/alias\`)\n");
      } else {
        for (const [k, v] of Object.entries(all)) {
          process.stdout.write(`${k} = ${typeof v === "string" ? v : JSON.stringify(v)}\n`);
        }
      }
      return;
    }
    case "get": {
      const k = args[0];
      if (!k) {
        process.stderr.write("gitflic: alias get <key>\n");
        process.exit(2);
      }
      const v = configGet(k);
      if (v === undefined) {
        process.stderr.write(`gitflic: alias: key not set: ${k}\n`);
        process.exit(1);
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
      configSet(k, v);
      process.stdout.write(`gitflic: alias ${k} = ${v}\n`);
      return;
    }
    case "unset":
    case "delete": {
      const k = args[0];
      if (!k) {
        process.stderr.write("gitflic: alias unset <key>\n");
        process.exit(2);
      }
      configDelete(k);
      process.stdout.write(`gitflic: alias ${k} removed\n`);
      return;
    }
    case "path":
      process.stdout.write(`${configPath()}\n`);
      return;
    case "clear":
      configClear();
      process.stdout.write(`gitflic: config cleared (was ${configPath()})\n`);
      return;
    case "info":
    case undefined: {
      const all = configList();
      process.stdout.write(
        `path:     ${configPath()}\n` +
          `keys:     ${Object.keys(all).length}\n` +
          `disable:  GITFLIC_NO_CONFIG=1\n`,
      );
      return;
    }
    default:
      process.stderr.write(`gitflic: alias: unknown subcommand: ${sub}. Use list | get | set | unset | path | clear.\n`);
      process.exit(2);
  }
}
