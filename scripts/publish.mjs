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

// Guard: the MCP spawns the gitflic-cli binary it depends on, so the two must
// ship as the exact pair that was tested together — the dep MUST pin, not range.
//
// A caret range looks harmless and is the trap: `^0.3.3` admits 0.3.3 itself, so
// an npx cache already holding 0.3.3 *satisfies* the range and npm never
// re-resolves it. The CLI fix then never reaches the user, however many versions
// you publish. This shipped for real: users on gitflic-cli-mcp@0.4.1 kept running
// the cached gitflic-cli@0.3.3, whose `issue edit` clobbers title/description
// with the literal "stub" — a bug fixed back in 0.3.4.
//
// Asking "does the range admit the current CLI?" is the wrong question (^0.3.3
// admits 0.3.5 just fine). The only safe answer is an exact pin.
const depRange = (mcpPkg.dependencies || {})["gitflic-cli"];
if (depRange !== VERSION) {
  die(
    `mcp-server depends on gitflic-cli "${depRange}", but it must pin exactly "${VERSION}".\n` +
      `  A range (^ ~ >=) lets a cached older CLI satisfy it, so npx never upgrades\n` +
      `  and users stay stranded on a stale CLI. Set "gitflic-cli": "${VERSION}" in\n` +
      `  mcp-server/package.json and bump the MCP version.`,
  );
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
