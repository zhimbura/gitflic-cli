#!/usr/bin/env node
// scripts/publish.mjs — publish gitflic-cli + gitflic-cli-mcp to npm and keep
// the Homebrew formula's `url` + `sha256` in sync with the published tarball.
//
// Usage:
//   node scripts/publish.mjs --dry-run        validate both packages, publish nothing
//   node scripts/publish.mjs --bump-formula   recompute the formula sha256 (no publish)
//   node scripts/publish.mjs                   real publish (needs `npm login`) + formula bump
//
// Why a script: the MCP package depends on `gitflic-cli`, so the CLI MUST be
// published first. The Homebrew formula must carry the exact sha256 of the npm
// tarball — and `npm pack` produces the byte-identical tarball the registry
// serves, so we can compute it locally without waiting for registry propagation.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const MCP = join(ROOT, "mcp-server");
const FORMULA = join(ROOT, "packaging", "homebrew", "Formula", "gitflic.rb");

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
const ONLY_FORMULA = args.has("--bump-formula");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const mcpPkg = JSON.parse(readFileSync(join(MCP, "package.json"), "utf8"));
const VERSION = pkg.version;
const TARBALL_URL = `https://registry.npmjs.org/gitflic-cli/-/gitflic-cli-${VERSION}.tgz`;

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

function run(cmd, cmdArgs, cwd = ROOT, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd, ...opts });
  if (r.status !== 0) die(`${cmd} ${cmdArgs.join(" ")} exited ${r.status}`);
  return r;
}

// Pack the CLI locally and return the sha256 of the produced tarball.
// This is byte-identical to what `npm publish` uploads and the registry serves.
function packAndHashCli() {
  const out = mkdtempSync(join(tmpdir(), "gfc-pack-"));
  try {
    const r = spawnSync("npm", ["pack", "--pack-destination", out], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    });
    if (r.status !== 0) die("npm pack (gitflic-cli) failed");
    const tgz = readdirSync(out).find((f) => f.endsWith(".tgz"));
    if (!tgz) die("npm pack produced no .tgz");
    const buf = readFileSync(join(out, tgz));
    return createHash("sha256").update(buf).digest("hex");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

function bumpFormula(sha) {
  let txt = readFileSync(FORMULA, "utf8");
  txt = txt.replace(/^\s*url ".*"$/m, `  url "${TARBALL_URL}"`);
  txt = txt.replace(/^\s*sha256 ".*"$/m, `  sha256 "${sha}"`);
  writeFileSync(FORMULA, txt);
  ok(`formula → url gitflic-cli-${VERSION}.tgz, sha256 ${sha.slice(0, 12)}…`);
}

console.log(`\n${C.b("→")} gitflic-cli ${C.c(VERSION)} + gitflic-cli-mcp ${C.c(JSON.parse(readFileSync(join(MCP, "package.json"), "utf8")).version)}\n`);

if (ONLY_FORMULA) {
  console.log("[bump-formula] npm pack + sha256");
  bumpFormula(packAndHashCli());
  console.log(`\n${C.g(C.b("Formula updated."))} Copy Formula/gitflic.rb into your tap repo and push.\n`);
  process.exit(0);
}

if (DRY) {
  console.log("[1/2] npm pack --dry-run (gitflic-cli)");
  run("npm", ["pack", "--dry-run"], ROOT);
  console.log("\n[2/2] npm pack --dry-run (gitflic-cli-mcp)");
  run("npm", ["pack", "--dry-run"], MCP);
  console.log(`\n${C.g(C.b("Dry run OK."))} To publish for real:`);
  console.log(`  ${C.c("npm login")}`);
  console.log(`  ${C.c("node scripts/publish.mjs")}\n`);
  process.exit(0);
}

// Real publish. CLI first (MCP depends on it), then MCP, then sync the formula.
console.log("[1/3] publish gitflic-cli");
run("npm", ["publish"], ROOT);
ok("gitflic-cli published");

console.log("\n[2/3] publish gitflic-cli-mcp");
run("npm", ["publish"], MCP);
ok("gitflic-cli-mcp published");

console.log("\n[3/3] sync Homebrew formula");
bumpFormula(packAndHashCli());

console.log(`\n${C.g(C.b("Published."))} Next:`);
console.log(`  • Copy ${C.c("packaging/homebrew/Formula/gitflic.rb")} into your tap repo and push.`);
console.log(`  • Verify: ${C.c("npx -y gitflic-cli@" + VERSION + " help")}\n`);
