#!/usr/bin/env node
// scripts/annotate-mcp-tools.mjs
//
// One-shot script to inject `annotations` field into every entry in
// `mcp-server/tools.mjs`. Classifies each tool by name suffix.
//
// MCP annotations (per MCP 2025-06-18 spec):
//   readOnlyHint:      tool does NOT modify state (pure reads)
//   destructiveHint:   tool MAY modify/delete state
//   idempotentHint:    same input → same effect (safe to retry)
//   openWorldHint:     tool interacts with external systems (true for ALL gitflic tools)
//
// Clients like Claude Code / Cursor prompt the user for confirmation
// when destructiveHint=true.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TOOLS_PATH = fileURLToPath(
  new URL("../mcp-server/tools.mjs", import.meta.url),
);

// Tools whose name ENDS WITH one of these suffixes are pure reads.
const READONLY_SUFFIXES = [
  "_list",
  "_view",
  "_get",
  "_files",
  "_diff",
  "_compare",
  "_default",
  "_latest",
  "_me",
  "_search",
  "_projects",
  "_followers",
  "_following",
  "_members",
  "_bindings",
  "_info",
  "_path",
  "completion_bash", // both completion_* shell outputs are read-only text generation
  "completion_zsh",
  "completion_fish",
  "_repos",
  "_jobs",
  "_by-commit",
  "_archive",          // reading project archive to stdout
  "_archive_",         // any future archive variants
  "_attachments_",     // NOT (we don't have this)
  "_relations_list",
  "_rules_list",       // alias/branch/tag/environment protection list variants
  "_revoke_",
  "_resolve",
];

// Tools whose name ENDS WITH one of these are idempotent (safe to retry).
const IDEMPOTENT_SUFFIXES = [
  "_close",
  "_cancel",
  "_resolve",
  "_unbind",
  "_delete",
  "_edit",
  "_create",
  "_bind",
  "_set",
  "_unset",
  "_switch",
  "_clear",
  "_role",
  "_change-email",
  "_change-username",
  "_change-password",
  "completion_bash",
  "completion_zsh",
  "completion_fish",
  "_upload",     // multipart upload — re-uploading same file = same outcome (idempotent at API level)
  "_start",      // cicd pipeline start — same commit = same pipeline ID
  "_cherry-pick",
  "_import",
  "_mirror",
  "_fork",
];

// Tools whose name STARTS WITH one of these prefixes are read-only
// (overrides anything else; explicit prefixes > suffix heuristics).
const READONLY_PREFIXES = [
  "gitflic_user_",
  "gitflic_company_",
  "gitflic_runner_",
  "gitflic_admin_",
  "gitflic_saml_",
  "gitflic_registry_",
];

// Tools that are destructive but local-only (write to local config/secret store).
// They modify state but NOT the GitFlic server.
const LOCAL_DESTRUCTIVE_SUFFIXES = [
  "_login",
  "_logout",
  "_list",   // alias list (no — local read); conflict with above — handled below
];

function classify(toolName) {
  const ann = {
    readOnlyHint: false,
    destructiveHint: true,    // default: assume may be destructive
    idempotentHint: false,
    openWorldHint: true,      // all gitflic tools talk to GitFlic
    title: humanize(toolName),
  };

  // Local-only auth tools (don't hit GitFlic server, but DO modify local state).
  const LOCAL_ONLY = ["gitflic_auth_login", "gitflic_auth_logout",
                      "gitflic_auth_list", "gitflic_auth_switch",
                      "gitflic_auth_bind", "gitflic_auth_unbind",
                      "gitflic_auth_bindings", "gitflic_cache_clear",
                      "gitflic_alias_set", "gitflic_alias_unset",
                      "gitflic_alias_clear"];
  if (LOCAL_ONLY.includes(toolName)) {
    ann.openWorldHint = false;
  }

  // Read-only overrides
  if (READONLY_PREFIXES.some((p) => toolName.startsWith(p))) {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }
  if (toolName === "gitflic_project_resolve") {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }
  if (toolName === "gitflic_auth" || toolName === "gitflic_auth_list" ||
      toolName === "gitflic_auth_bindings") {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }
  if (toolName === "gitflic_cache_path" || toolName === "gitflic_cache_info") {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }
  if (toolName === "gitflic_alias_list" || toolName === "gitflic_alias_get" ||
      toolName === "gitflic_alias_path") {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }
  if (READONLY_SUFFIXES.some((s) => toolName.endsWith(s) || toolName === s)) {
    ann.readOnlyHint = true;
    ann.destructiveHint = false;
  }

  // Idempotent
  if (IDEMPOTENT_SUFFIXES.some((s) => toolName.endsWith(s))) {
    ann.idempotentHint = true;
  }
  if (toolName === "gitflic_auth_switch" ||
      toolName === "gitflic_auth_bind" || toolName === "gitflic_auth_unbind") {
    ann.idempotentHint = true;
  }
  if (toolName === "gitflic_auth_logout") {
    // logout of an already-cleared token is a no-op → idempotent.
    ann.idempotentHint = true;
  }
  if (toolName === "gitflic_alias_set") {
    // setting same value twice = same state → idempotent.
    ann.idempotentHint = true;
  }

  return ann;
}

function humanize(name) {
  // gitflic_mr_create → "MR create"
  const stripped = name.replace(/^gitflic_/, "");
  return stripped
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const src = readFileSync(TOOLS_PATH, "utf8");

// Match each tool object. Heuristic regex: from "  {\n    name:" to the
// matching closing "  }" of the entry. Since the file is well-structured,
// we can match the boundary by counting braces.
function injectAnnotations(srcText) {
  const out = [];
  let i = 0;
  let n = 0;
  let skipped = 0;

  while (i < srcText.length) {
    // Find next tool entry start: "  {" followed by "\n    name:" on next line
    const m = srcText.slice(i).match(/\n  \{\n    name: "([^"]+)",/);
    if (!m) break;
    const name = m[1];
    const start = i + m.index + 1; // start of "  {"
    // Find the matching closing "  }" — count braces from start.
    let depth = 0;
    let j = start;
    let inStr = false;
    let strCh = "";
    while (j < srcText.length) {
      const c = srcText[j];
      if (inStr) {
        if (c === "\\") { j += 2; continue; }
        if (c === strCh) inStr = false;
      } else {
        if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; }
        else if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      j++;
    }
    // j is now just past the closing "}".
    let entry = srcText.slice(start, j);
    // Append the rest of srcText up to start to output.
    out.push(srcText.slice(i, start));

    // Only inject if not already has annotations.
    if (!/"annotations"\s*:/.test(entry)) {
      const ann = classify(name);
      const annStr =
        `    annotations: {\n` +
        `      title: "${ann.title}",\n` +
        `      readOnlyHint: ${ann.readOnlyHint},\n` +
        `      destructiveHint: ${ann.destructiveHint},\n` +
        `      idempotentHint: ${ann.idempotentHint},\n` +
        `      openWorldHint: ${ann.openWorldHint},\n` +
        `    },\n`;
      // Insert annotations right before the closing "  }" of this entry.
      // The closing "}" is the last char of `entry`. We insert before it
      // by appending annStr right after the last ",\n" (which exists before
      // the "  }" in well-formed entries).
      const lastComma = entry.lastIndexOf(",\n");
      if (lastComma !== -1) {
        entry = entry.slice(0, lastComma) + ",\n" + annStr.replace(/,\n$/, "") +
          entry.slice(lastComma);
      } else {
        // No trailing comma (probably has trailing "}" only). Insert annStr
        // before the final "}".
        const lastBrace = entry.lastIndexOf("}");
        entry = entry.slice(0, lastBrace) + annStr + entry.slice(lastBrace);
      }
      n++;
    } else {
      skipped++;
    }
    out.push(entry);
    i = j;
  }
  out.push(srcText.slice(i));
  return { text: out.join(""), processed: n, skipped };
}

const { text, processed, skipped } = injectAnnotations(src);
writeFileSync(TOOLS_PATH, text);

console.log(`✓ injected annotations into ${processed} tools`);
console.log(`  skipped (already had annotations): ${skipped}`);
console.log(`  total tools in file: ${processed + skipped}`);