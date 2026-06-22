#!/usr/bin/env node
// Zero-dep local dev server for the Docsify site under docs/.
//
// Docsify itself is CDN-loaded — we don't need docsify-cli or any build
// step. This script just serves the static files in docs/ on a local
// port so you can preview in a browser.
//
// Usage:
//   node scripts/serve-docs.mjs             # default :3000
//   PORT=8080 node scripts/serve-docs.mjs   # custom port
//   npm run docs:dev                        # via package.json script

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DOCS_ROOT = resolve(__dirname, "..", "docs");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(root, urlPath) {
  // Strip query string, decode, normalize.
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const full = resolve(join(root, decoded));
  // Path traversal guard: must stay inside root.
  if (!full.startsWith(root)) return null;
  return full;
}

const server = createServer((req, res) => {
  let urlPath = req.url || "/";
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = safeJoin(DOCS_ROOT, urlPath);
  if (!filePath) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    // Docsify handles SPA routing — serve index.html for unknown paths
    // that look like routes (have no extension).
    if (!extname(filePath)) {
      const indexPath = join(DOCS_ROOT, "index.html");
      if (existsSync(indexPath)) {
        const body = readFileSync(indexPath);
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" });
        res.end(body);
        return;
      }
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`404 not found: ${urlPath}`);
    return;
  }

  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    // Try dir/index.html
    const idx = join(filePath, "index.html");
    if (existsSync(idx)) {
      const body = readFileSync(idx);
      res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end("directory listing disabled");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const body = readFileSync(filePath);
  // Docsify files are tiny — no need for streaming.
  // Disable cache during dev so edits show up on refresh.
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": body.length,
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  res.end(body);
});

server.listen(PORT, HOST, () => {
  console.log(`\ngitflic-cli docs dev server`);
  console.log(`  → http://${HOST}:${PORT}/`);
  console.log(`  serving from ${DOCS_ROOT}`);
  console.log(`  (Ctrl+C to stop)\n`);
});

// Graceful shutdown on Ctrl+C / SIGTERM.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n[${sig}] shutting down…`);
    server.close(() => process.exit(0));
    // Force-exit after 2s if connections hang.
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
