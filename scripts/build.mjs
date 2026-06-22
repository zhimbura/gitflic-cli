#!/usr/bin/env node
// scripts/build.mjs — full local build for gitflic-cli.
//
// Why: GitFlic doesn't ship shared runners for public SaaS, and we don't
// want to pay for a VPS. So we build locally: syntax-check every .mjs,
// run vitest, then bundle a portable tarball under dist/ that can be
// served straight from the Timeweb Apps docs site (no S3 needed).
//
// Usage:
//   node scripts/build.mjs            # full build
//   node scripts/build.mjs --no-test  # skip tests (faster iteration)
//   node scripts/build.mjs --no-bundle
//
// Exit codes:
//   0  success
//   1  any check failed

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createWriteStream } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

const args = new Set(process.argv.slice(2));
const SKIP_TEST = args.has("--no-test");
const SKIP_BUNDLE = args.has("--no-bundle");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const step = (n, msg) => console.log(`\n${C.bold(`[${n}/4]`)} ${msg}`);
const ok = (msg) => console.log(`  ${C.green("✓")} ${msg}`);
const warn = (msg) => console.log(`  ${C.yellow("!")} ${msg}`);
const fail = (msg) => {
  console.error(`  ${C.red("✗")} ${msg}`);
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    cwd: ROOT,
    ...opts,
  });
  if (r.status !== 0) {
    fail(`${cmd} ${cmdArgs.join(" ")} exited with ${r.status}`);
  }
}

function walkMjs(roots) {
  const out = [];
  for (const root of roots) {
    const abs = resolve(ROOT, root);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile() && abs.endsWith(".mjs")) {
      out.push(abs);
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          out.push(...walkMjs([join(root, entry.name)]));
        } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
          out.push(resolve(abs, entry.name));
        }
      }
    }
  }
  return out;
}

// ---- 1. lint -------------------------------------------------------------
step(1, "Syntax check (.mjs) + JSON validity");
const mjsFiles = walkMjs([
  "lib/gitflic.mjs",
  "lib",
  "lib/cmd",
  "mcp-server",
  "scripts",
]);
for (const f of mjsFiles) {
  try {
    execFileSync("node", ["--check", f], { stdio: "pipe" });
  } catch (e) {
    fail(`syntax error in ${relative(ROOT, f)}: ${e.stderr?.toString().trim()}`);
  }
}
ok(`${mjsFiles.length} .mjs files clean`);

// package.json is JSON; vitest.config.mjs is ESM (already syntax-checked above)
for (const j of ["package.json"]) {
  try {
    JSON.parse(readFileSync(join(ROOT, j), "utf8"));
  } catch (e) {
    fail(`${j} invalid JSON: ${e.message}`);
  }
  ok(`${j} valid`);
}
if (existsSync(join(ROOT, "package-lock.json"))) {
  try {
    JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
  } catch (e) {
    fail(`package-lock.json invalid: ${e.message}`);
  }
  ok("package-lock.json valid");
}

for (const s of ["install.sh", "uninstall.sh"]) {
  const p = join(ROOT, s);
  if (!existsSync(p)) continue;
  const r = spawnSync("bash", ["-n", p], { stdio: "pipe" });
  if (r.status !== 0) fail(`${s} bash parse error`);
  ok(`${s} parses`);
}

// ---- 2. test -------------------------------------------------------------
if (SKIP_TEST) {
  step(2, "Tests (skipped — --no-test)");
  warn("tests skipped");
} else {
  step(2, "vitest");
  run("npm", ["test"]);
  ok("vitest run passed");
}

// ---- 3. bundle -----------------------------------------------------------
if (SKIP_BUNDLE) {
  step(3, "Bundle (skipped — --no-bundle)");
  warn("tarball skipped");
} else {
  step(3, "Bundle portable tarball");
  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const version = pkg.version;
  const stageDir = join(DIST, `gitflic-cli-${version}`);
  mkdirSync(stageDir, { recursive: true });

  // What to ship: anything you need to run the CLI from a checkout.
  // No node_modules — zero-dep, only uses global fetch.
  // Tests are intentionally excluded (we ship source, not our test harness).
  const include = [
    "bin",
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "install.sh",
    "install.ps1",
    "uninstall.sh",
    "uninstall.ps1",
  ];

  // Walk lib/ but skip __tests__/ subdir.
  const libStaging = join(stageDir, "lib");
  mkdirSync(libStaging, { recursive: true });
  for (const entry of readdirSync(join(ROOT, "lib"), { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const src = join(ROOT, "lib", entry.name);
    const dest = join(libStaging, entry.name);
    spawnSync("cp", ["-R", src, dest], { stdio: "inherit" });
  }
  for (const item of include) {
    const src = join(ROOT, item);
    if (!existsSync(src)) continue;
    const dest = join(stageDir, item);
    mkdirSync(dirname(dest), { recursive: true });
    spawnSync("cp", ["-R", src, dest], { stdio: "inherit" });
  }
  ok(`staged ${include.filter((x) => existsSync(join(ROOT, x))).length} entries`);

  const tarPath = join(DIST, `gitflic-cli-${version}.tar`);
  const gzPath = `${tarPath}.gz`;
  const tar = spawnSync("tar", ["-cf", tarPath, "-C", DIST, `gitflic-cli-${version}`], {
    stdio: "inherit",
  });
  if (tar.status !== 0) fail("tar failed");
  // gzip in one shot
  const gz = spawnSync("gzip", ["-f", tarPath], { stdio: "inherit" });
  if (gz.status !== 0) fail("gzip failed");

  const size = statSync(gzPath).size;
  const sizeKb = (size / 1024).toFixed(1);
  ok(`tarball: dist/gitflic-cli-${version}.tar.gz (${sizeKb} KB)`);

  // Cleanup staging dir
  rmSync(stageDir, { recursive: true, force: true });
}

// ---- 4. summary ----------------------------------------------------------
step(4, "Summary");
console.log(`  ${C.cyan("Version:")}      ${JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version}`);
console.log(`  ${C.cyan("Node target:")}  ${JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).engines.node}`);
if (!SKIP_BUNDLE) {
  console.log(`  ${C.cyan("Artifact:")}     dist/gitflic-cli-${JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version}.tar.gz`);
}
console.log(`\n${C.green(C.bold("Build OK."))} Next: \`node scripts/release.mjs\` to ship to docs/releases/`);
