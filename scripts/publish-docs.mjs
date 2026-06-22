#!/usr/bin/env node
// scripts/publish-docs.mjs — build the VitePress docs and publish the static
// output to the GitHub docs mirror, which Timeweb serves statically.
//
//   main repo (docs/ VitePress source)
//        │  npm run docs:build
//        ▼
//   docs/.vitepress/dist  ──push──▶  github.com/zhimbura/gitflic-cli-docs (main)
//                                          │ served statically
//                                          ▼
//                                      Timeweb Apps
//
// The mirror's root IS the built site (no build step on the mirror), so each
// deploy replaces its contents with a fresh build (gh-pages style).
//
// Usage:
//   npm run docs:publish                 # build + publish
//   npm run docs:publish -- --no-build   # publish existing dist as-is
//   GFC_DOCS_MIRROR=git@github.com:owner/repo.git npm run docs:publish

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = join(ROOT, "docs", ".vitepress", "dist");
const MIRROR =
  process.env.GFC_DOCS_MIRROR || "git@github.com:zhimbura/gitflic-cli-docs.git";
const BRANCH = process.env.GFC_DOCS_BRANCH || "main";
const SSH = { env: { ...process.env, GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=accept-new" } };

const C = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, c: (s) => `\x1b[36m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };
const ok = (m) => console.log(`  ${C.g("✓")} ${m}`);
const die = (m) => { console.error(`  ${C.r("✗")} ${m}`); process.exit(1); };
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts });

const skipBuild = process.argv.includes("--no-build");

console.log(`\n${C.b("→")} Publishing docs to ${C.c(MIRROR)} (${BRANCH})\n`);

// 1. Build
if (!skipBuild) {
  console.log("[1/4] vitepress build");
  try {
    execSync("npm run docs:build", { cwd: ROOT, stdio: "inherit" });
  } catch {
    die("docs build failed");
  }
  ok("built docs/.vitepress/dist");
} else {
  console.log("[1/4] skip build (--no-build)");
}
if (!existsSync(join(DIST, "index.html"))) die(`no built site at ${DIST} (run without --no-build)`);

// 2. Clone the mirror
console.log("[2/4] clone mirror");
const work = mkdtempSync(join(tmpdir(), "gfc-docs-"));
try {
  run(`git clone --quiet --depth 1 --branch ${BRANCH} ${MIRROR} ${work}`, SSH);
} catch {
  // branch may not exist yet — clone default and create it
  run(`git clone --quiet --depth 1 ${MIRROR} ${work}`, SSH);
}
const before = (() => { try { return run("git rev-parse --short HEAD", { cwd: work }).trim(); } catch { return "(empty)"; } })();
ok(`cloned @ ${before}`);

// 3. Replace contents with the fresh build
console.log("[3/4] stage built site");
// remove everything tracked except .git
for (const entry of readdirSync(work)) {
  if (entry === ".git") continue;
  rmSync(join(work, entry), { recursive: true, force: true });
}
cpSync(DIST, work, { recursive: true });
writeFileSync(join(work, ".nojekyll"), ""); // GH Pages: keep _media/ etc.
run("git add -A", { cwd: work });
const changed = run("git status --porcelain", { cwd: work }).trim();
if (!changed) { ok("no changes — mirror already up to date"); rmSync(work, { recursive: true, force: true }); process.exit(0); }

// 4. Commit + push
console.log("[4/4] commit + push");
let srcRev = "unknown";
try { srcRev = run("git rev-parse --short HEAD", { cwd: ROOT }).trim(); } catch {}
const msg = `deploy: publish VitePress build (gitflic-cli @ ${srcRev})`;
run(`git -c user.name="gitflic-cli docs" -c user.email="noreply@gitflic.ru" commit -q -m ${JSON.stringify(msg)}`, { cwd: work });
const after = run("git rev-parse --short HEAD", { cwd: work }).trim();
run(`git push origin HEAD:${BRANCH}`, { cwd: work, ...SSH });
ok(`pushed ${before}..${after} → ${BRANCH}`);
rmSync(work, { recursive: true, force: true });

console.log(`\n${C.g(C.b("Docs published."))} Timeweb serves the mirror's root.\n`);
