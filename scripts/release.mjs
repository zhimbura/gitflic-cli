#!/usr/bin/env node
// scripts/release.mjs — version bump + ship to docs/public/downloads/.
//
// We don't have S3. We don't want to. After `build.mjs` produces
// dist/gitflic-cli-X.Y.Z.tar.gz, this script:
//   1. Prompts for the new version (or reads --version X.Y.Z)
//   2. Updates package.json#version
//   3. Re-runs build.mjs
//   4. Copies the tarball into docs/public/downloads/
//   5. Rewrites docs/public/downloads/index.html so users can browse + download
//      straight from the Timeweb Apps site
//
// Usage:
//   node scripts/release.mjs --version 0.2.0
//   node scripts/release.mjs                 # interactive

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
// (no readline — we read stdin directly to avoid the
//  "unsettled top-level await" warning on Node ≥ 22)

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
// Release tarballs are served as static VitePress assets from docs/public/,
// so they land at /downloads/<file> on the built site. (The human-facing
// page lives at docs/releases/index.md → /releases/.)
const RELEASES_DIR = resolve(ROOT, "docs", "public", "downloads");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const ok = (m) => console.log(`  ${C.green("✓")} ${m}`);
const fail = (m) => {
  console.error(`  ${C.red("✗")} ${m}`);
  process.exit(1);
};

function parseArgs() {
  const args = process.argv.slice(2);
  let version = null;
  let skipBump = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version") {
      version = args[++i];
    } else if (args[i] === "--no-bump") {
      skipBump = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node scripts/release.mjs [--version X.Y.Z] [--no-bump]");
      process.exit(0);
    }
  }
  return { version, skipBump };
}

function bumpVersion(pkg, target) {
  // very small semver: MAJOR.MINOR.PATCH
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(target);
  if (!m) fail(`bad version "${target}", expected MAJOR.MINOR.PATCH`);
  pkg.version = target;
  writeFileSync(join(ROOT, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

async function promptVersion(current) {
  // Read one line from stdin synchronously. Simpler than readline and
  // doesn't leave a dangling "unsettled top-level await" warning on
  // Node ≥ 22 when the rest of the script has no other awaits.
  process.stdout.write(`  New version (current ${current}): `);
  return await new Promise((resolve) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        process.stdin.off("data", onData);
        process.stdin.pause();
        resolve(buf.slice(0, nl).trim() || current);
      }
    };
    process.stdin.on("data", onData);
    process.stdin.resume();
  });
}

function readReleasesIndex() {
  const p = join(RELEASES_DIR, "index.html");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

function listExistingReleases() {
  if (!existsSync(RELEASES_DIR)) return [];
  return readdirSync(RELEASES_DIR)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((f) => f.replace(/^gitflic-cli-/, "").replace(/\.tar\.gz$/, ""))
    .sort()
    .reverse();
}

function renderReleasesPage(versions) {
  // Standalone HTML page (NOT routed through Docsify — we want raw downloads).
  // Lists each release as a downloadable link.
  const rows = versions
    .map(
      (v) => `      <li>
        <a href="gitflic-cli-${v}.tar.gz" download>gitflic-cli-${v}.tar.gz</a>
        <span class="meta">— bundled at release time</span>
      </li>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Скачать gitflic-cli — релизы (tar.gz)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Скачать gitflic-cli — портативные tar.gz-сборки CLI для GitFlic. Без внешних зависимостей: распакуй, запусти install.sh и используй gitflic. Все версии релизов." />
  <link rel="canonical" href="https://cli-gitflic.ru/downloads/" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Скачать gitflic-cli — релизы" />
  <meta property="og:description" content="Портативные tar.gz-сборки CLI для GitFlic. Без внешних зависимостей — распакуй и запусти install.sh." />
  <meta property="og:url" content="https://cli-gitflic.ru/downloads/" />
  <meta property="og:image" content="https://cli-gitflic.ru/og.png" />
  <link rel="icon" type="image/svg+xml" href="../_media/icon.svg" />
  <style>
    :root { --theme: #e8423a; --fg: #1a1a1a; --muted: #6c757d; --bg: #fff; --border: #e6e6e6; }
    @media (prefers-color-scheme: dark) {
      :root { --fg: #e8e8e8; --muted: #9aa0a6; --bg: #0f1115; --border: #2a2d33; }
    }
    body { font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: var(--fg); background: var(--bg); }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    .lede { color: var(--muted); margin: 0 0 28px; }
    a { color: var(--theme); text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; }
    .meta { color: var(--muted); font-size: 0.9em; margin-left: 8px; }
    .back { display: inline-block; margin-bottom: 18px; }
    code { background: rgba(0,0,0,0.05); padding: 1px 6px; border-radius: 3px; font-size: 0.9em; }
  </style>
  <!-- Yandex.Metrika (counter id must match YANDEX_METRIKA_ID in docs/.vitepress/config.mjs) -->
  <script type="text/javascript">
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=110346937","ym");
    ym(110346937,"init",{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});
  </script>
  <noscript><div><img src="https://mc.yandex.ru/watch/110346937" style="position:absolute;left:-9999px" alt="" /></div></noscript>
</head>
<body>
  <a class="back" href="../">← на главную документацию</a>
  <h1>Релизы gitflic-cli</h1>
  <p class="lede">
    Каждый релиз — это портативный tar.gz с <code>bin/</code>, <code>lib/</code>, <code>package.json</code>, инсталляторами.
    Без внешних зависимостей: распакуй → <code>bash install.sh</code> → используй <code>gitflic</code>.
  </p>
  <ul>
${rows}
  </ul>
  <p class="lede" style="margin-top:32px;font-size:0.9em">
    Артефакты собираются локально (<code>scripts/build.mjs</code>) и публикуются на этом же сайте
    через Timeweb Apps. Никакого S3, никакого CI-раннера. Подробнее — в <a href="../development.html">разделе разработки</a>.
  </p>
</body>
</html>
`;
}

const { version: cliVersion, skipBump } = parseArgs();
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
let target = cliVersion;

// Only prompt for a version if --version wasn't passed AND we're not in --no-bump mode.
if (!target && !skipBump) {
  target = await promptVersion(pkg.version);
}

if (target && !/^\d+\.\d+\.\d+$/.test(target)) {
  fail(`bad version "${target}", expected MAJOR.MINOR.PATCH`);
}

console.log(`\n${C.bold("→")} Releasing ${C.cyan(target)} ${skipBump ? "(no version bump)" : ""}`);

if (!skipBump && target !== pkg.version) {
  bumpVersion(pkg, target);
  ok(`bumped package.json → ${target}`);
}

// Re-read pkg.version (in case --no-bump was used)
const finalVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

// ---- Run build ----
console.log(`\n${C.bold("→")} Building...`);
const build = spawnSync("node", [join(ROOT, "scripts", "build.mjs")], {
  stdio: "inherit",
  cwd: ROOT,
});
if (build.status !== 0) fail(`build.mjs exited ${build.status}`);
ok("build complete");

// ---- Ship artifact to docs/public/downloads/ ----
mkdirSync(RELEASES_DIR, { recursive: true });
const tarball = join(DIST, `gitflic-cli-${finalVersion}.tar.gz`);
if (!existsSync(tarball)) fail(`expected tarball at ${tarball}`);
copyFileSync(tarball, join(RELEASES_DIR, `gitflic-cli-${finalVersion}.tar.gz`));
ok(`copied to docs/public/downloads/gitflic-cli-${finalVersion}.tar.gz`);

// ---- Render index.html ----
const versions = listExistingReleases();
writeFileSync(join(RELEASES_DIR, "index.html"), renderReleasesPage(versions));
ok(`rendered docs/public/downloads/index.html (${versions.length} release${versions.length === 1 ? "" : "s"})`);

// ---- Don't clean dist/ — useful for the dev to inspect ----
console.log(`\n${C.green(C.bold("Release ready."))}`);
console.log(`  Commit when ready: ${C.cyan("git add . && git commit -m 'release: v" + finalVersion + "'")}`);
console.log(`  Then run \`npm run docs:publish\` to build + push the site (incl. /downloads/) to the mirror.`);
