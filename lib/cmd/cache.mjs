// gitflic cache — inspect or clear the local project-UUID cache.

import { cachePath, cacheClear, CACHE_DEFAULT_TTL_MS } from "../cache.mjs";

export const usage = `Cache commands:
  cache path                                        Print the path to the cache file
  cache clear                                       Remove the cache file
  cache info                                        Show cache file stats (size, default TTL)
`;

export async function handle(ctx, sub, _args, _flags) {
  switch (sub) {
    case "path":
      process.stdout.write(`${cachePath()}\n`);
      return;
    case "clear":
      cacheClear();
      process.stdout.write(`gitflic: cache cleared (was ${cachePath()})\n`);
      return;
    case "info":
    case undefined: {
      const p = cachePath();
      process.stdout.write(
        `path:   ${p}\n` +
          `ttl:    ${CACHE_DEFAULT_TTL_MS / 1000}s (default)\n` +
          `disable: GITFLIC_NO_CACHE=1\n`,
      );
      return;
    }
    default:
      process.stderr.write(`unknown cache subcommand: ${sub}. Use path | clear | info.\n`);
      process.exit(2);
  }
}
