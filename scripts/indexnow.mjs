#!/usr/bin/env node
// Notify IndexNow (Bing, Yandex, Seznam, Naver, Yep) about site URLs.
// Run AFTER the docs are published: `npm run docs:indexnow` (all sitemap URLs)
// or `node scripts/indexnow.mjs <url> [<url> ...]` (specific URLs).
// The key file docs/public/<key>.txt must be reachable at https://cli-gitflic.ru/<key>.txt.
import { readdirSync, readFileSync } from "node:fs";

const HOST = "cli-gitflic.ru";
const keyFile = readdirSync("docs/public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("IndexNow key file docs/public/<32 hex>.txt not found");
const key = keyFile.replace(".txt", "");
if (readFileSync(`docs/public/${keyFile}`, "utf8").trim() !== key) throw new Error("key file content must equal its name");

let urlList = process.argv.slice(2);
if (!urlList.length) {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});
console.log(`IndexNow: ${urlList.length} URLs -> HTTP ${res.status}`);
if (res.status >= 300) process.exit(1);
