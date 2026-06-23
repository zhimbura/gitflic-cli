#!/usr/bin/env node
// scripts/publish.mjs — publish gitflic-cli + gitflic-cli-mcp to npm.
//
// Usage:
//   node scripts/publish.mjs --dry-run        validate both packages, publish nothing
//   node scripts/publish.mjs                   real publish (needs `npm login`)
//
// The MCP package depends on `gitflic-cli`, so the CLI MUST be published first.
//
// 2FA note: npm's browser web-login is one-shot per `npm publish` invocation, so
// these two back-to-back publishes can trip it (the 2nd runs unauthenticated and
// fails with a misleading E404). If that happens, publish the packages separately:
//   npm publish              # gitflic-cli (root)
//   npm publish ./mcp-server # gitflic-cli-mcp

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const MCP = join(ROOT, "mcp-server");

const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  c: (s) => `\x1b[36m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};
const ok = (m) => console.log(`  ${C.g("✓")} ${m}`);
const die = (m) => { console.error(`  ${C.r("✗")} ${m}`); process.exit(1); };

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const mcpPkg = JSON.parse(readFileSync(join(MCP, "package.json"), "utf8"));
const VERSION = pkg.version;

// Guard: the MCP package depends on gitflic-cli; if its range no longer admits
// the CLI version, `npx gitflic-cli-mcp` could resolve a stale CLI. Catch it here.
function cliSatisfies(cliVer, range) {
  const b = /^([~^]?)(\d+)\.(\d+)\.(\d+)/.exec((range || "").trim());
  const c = /^(\d+)\.(\d+)\.(\d+)/.exec(cliVer || "");
  if (!b || !c) return null; // unknown format → can't judge
  const op = b[1];
  const [bMaj, bMin, bPat] = [+b[2], +b[3], +b[4]];
  const [maj, min, pat] = [+c[1], +c[2], +c[3]];
  const gte =
    maj > bMaj || (maj === bMaj && (min > bMin || (min === bMin && pat >= bPat)));
  if (!gte) return false;
  if (op === "^") return bMaj === 0 ? maj === 0 && min === bMin : maj === bMaj;
  if (op === "~") return maj === bMaj && min === bMin;
  return maj === bMaj && min === bMin && pat === bPat; // exact
}

const depRange = (mcpPkg.dependencies || {})["gitflic-cli"];
const satisfies = cliSatisfies(VERSION, depRange);
if (satisfies === false) {
  die(
    `version mismatch: mcp-server depends on gitflic-cli "${depRange}" but the ` +
      `CLI is ${VERSION}. Update "gitflic-cli" in mcp-server/package.json.`,
  );
} else if (satisfies === null && depRange) {
  console.log(`  ${C.r("!")} could not check gitflic-cli range "${depRange}" vs ${VERSION} — verify by hand`);
}

function run(cmd, cmdArgs, cwd = ROOT) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd });
  if (r.status !== 0) die(`${cmd} ${cmdArgs.join(" ")} exited ${r.status}`);
  return r;
}

console.log(`\n${C.b("→")} gitflic-cli ${C.c(VERSION)} + gitflic-cli-mcp ${C.c(mcpPkg.version)}\n`);

if (DRY) {
  console.log("[1/2] npm pack --dry-run (gitflic-cli)");
  run("npm", ["pack", "--dry-run"], ROOT);
  console.log("\n[2/2] npm pack --dry-run (gitflic-cli-mcp)");
  run("npm", ["pack", "--dry-run"], MCP);
  console.log(`\n${C.g(C.b("Dry run OK."))} To publish for real:`);
  console.log(`  ${C.c("npm login")}`);
  console.log(`  ${C.c("node scripts/publish.mjs")}`);
  console.log(`  (if the 2FA browser-login fails on the 2nd package, publish separately:`);
  console.log(`   ${C.c("npm publish")} then ${C.c("npm publish ./mcp-server")})\n`);
  process.exit(0);
}

// Real publish. CLI first (MCP depends on it), then MCP.
console.log("[1/2] publish gitflic-cli");
run("npm", ["publish"], ROOT);
ok("gitflic-cli published");

console.log("\n[2/2] publish gitflic-cli-mcp");
run("npm", ["publish"], MCP);
ok("gitflic-cli-mcp published");

console.log(`\n${C.g(C.b("Published."))} Verify: ${C.c("npx -y gitflic-cli@" + VERSION + " help")}\n`);
