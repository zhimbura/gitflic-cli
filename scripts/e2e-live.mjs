#!/usr/bin/env node
// scripts/e2e-live.mjs — LIVE end-to-end smoke test of (almost) every MCP tool
// by driving the real `gitflic` CLI against a real GitFlic project, printing a
// ✓/✗/⚠ checklist. This is the live coverage the unit suite can't give.
//
// NOT part of `npm test` — it creates/deletes real data and needs a token.
//
// Prerequisites:
//   1. A throwaway project (default tikhon/cli-e2e-mcp), override with
//      GITFLIC_E2E_PROJECT=owner/alias
//   2. Pushed git content: a `master` with a README + a file, plus diff branches
//      `feature`, `feature2`, `feature3` (each with a small unique change) so the
//      MR create/cancel/close/merge flow has something to act on.
//   3. GITFLIC_TOKEN in the environment.
//
// Usage:
//   GITFLIC_TOKEN=… node scripts/e2e-live.mjs
//
// Notes / known non-bugs surfaced by this harness:
//   - tag get → GitFlic returns 400 for project-scoped tags (server quirk).
//   - mr discuss reply/resolve/delete need a discussion thread; a CLI comment
//     does not create one (discussionUuid comes back null), so they're skipped.
//   - auth login/logout/switch/bind/unbind mutate the local keychain/session, so
//     they're skipped here; project member invite needs a second real user.
//   - Re-runs consume the diff branches (merge removes them) — re-push fresh
//     diff branches before re-running for a clean merge result.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "..", "lib", "gitflic.mjs");
const P = process.env.GITFLIC_E2E_PROJECT || "tikhon/cli-e2e-mcp";
const [OWNER] = P.split("/");
const RID = Date.now().toString(36).slice(-4);
const results = [];
const ids = {};

function call(tool, args, opts = {}) {
  const { noProject = false, expectFail = false, note = "" } = opts;
  const argv = [CLI, ...args];
  if (!noProject) argv.push("--project", P);
  argv.push("--format", "json");
  const r = spawnSync("node", argv, { encoding: "utf8" });
  const ok = r.status === 0;
  let data = null;
  try { data = JSON.parse(r.stdout); } catch {}
  let status, detail;
  if (expectFail) {
    status = ok ? "✗" : "⚠";
    detail = ok ? "expected fail but SUCCEEDED" : "known-fail OK: " + firstLine(r.stderr || r.stdout);
  } else {
    status = ok ? "✓" : "✗";
    detail = ok ? note : "ERR: " + firstLine(r.stderr || r.stdout);
  }
  results.push({ tool, status, detail });
  return { ok, data };
}
function skip(tool, reason) { results.push({ tool, status: "⚠", detail: "SKIP: " + reason }); }
function firstLine(s) { return String(s || "").trim().split("\n")[0].slice(0, 140); }
function listOf(d) {
  if (Array.isArray(d)) return d;
  if (d && d._embedded) { const k = Object.keys(d._embedded)[0]; return d._embedded[k] || []; }
  return (d && (d.content || d.commits)) || [];
}
function pick(d, ...keys) { for (const k of keys) if (d && d[k] != null) return d[k]; return undefined; }

// ---------- READS ----------
call("gitflic_user_me", ["user", "me"], { noProject: true });
call("gitflic_user_search", ["user", "search", OWNER], { noProject: true });
call("gitflic_user_get", ["user", "get", OWNER], { noProject: true });
call("gitflic_user_projects", ["user", "projects", OWNER], { noProject: true });
call("gitflic_user_followers", ["user", "followers", OWNER], { noProject: true });
call("gitflic_auth", ["auth"], { noProject: true });
call("gitflic_auth_list", ["auth", "list"], { noProject: true });
call("gitflic_auth_bindings", ["auth", "bindings"], { noProject: true });
call("gitflic_project_get", ["project", "get", P], { noProject: true });
call("gitflic_project_resolve", ["project", "get", P], { noProject: true, note: "resolve == project get" });
call("gitflic_project_list_my", ["project", "list", "--scope", "my"], { noProject: true });
call("gitflic_project_member_list", ["project", "member", "list"]);
call("gitflic_branch_list", ["branch", "list"]);
call("gitflic_branch_default", ["branch", "default"]);
call("gitflic_branch_get", ["branch", "get", "master"]);
call("gitflic_branch_protection_list", ["branch", "protection", "list"]);
call("gitflic_tag_list", ["tag", "list"]);
call("gitflic_mr_list", ["mr", "list"]);
call("gitflic_issue_list", ["issue", "list"]);
call("gitflic_release_list", ["release", "list"]);
call("gitflic_webhook_list", ["webhook", "list"]);

{
  const r = call("gitflic_commit_list", ["commit", "list"]);
  ids.masterHash = pick(listOf(r.data)[0] || {}, "hash", "id", "sha");
  const rf = spawnSync("node", [CLI, "commit", "list", "--branch", "feature", "--project", P, "--format", "json"], { encoding: "utf8" });
  try { ids.featureHash = pick(listOf(JSON.parse(rf.stdout))[0] || {}, "hash", "id", "sha"); } catch {}
}
call("gitflic_commit_get", ["commit", "get", ids.masterHash || "x"]);
call("gitflic_commit_files", ["commit", "files", ids.masterHash || "x"]);
call("gitflic_commit_compare", ["commit", "compare", ids.masterHash || "x", ids.featureHash || "y"]);
call("gitflic_blob_get", ["blob", "get", "README.md"], { note: "default branch" });
call("gitflic_blob_files", ["blob", "recursive"], { note: "→ blob recursive" });

// ---------- BRANCH ----------
call("gitflic_branch_create", ["branch", "create", "e2e-" + RID, "--from", "master"]);
call("gitflic_branch_delete", ["branch", "delete", "e2e-" + RID]);

// ---------- TAG ----------
const TAG = "e2e-tag-" + RID;
call("gitflic_tag_create", ["tag", "create", TAG, "--commit", ids.masterHash || "x", "--message", "e2e tag"]);
call("gitflic_tag_get", ["tag", "get", TAG], { expectFail: true, note: "project-scoped tag get → 400 (known GitFlic quirk)" });

// ---------- PROJECT edit ----------
call("gitflic_project_edit", ["project", "edit", P, "--description", "E2E edited " + RID], { noProject: true });

// ---------- BRANCH PROTECTION ----------
{
  const r = call("gitflic_branch_protection_create", ["branch", "protection", "create", "--branch-template", "rel-" + RID + "/*", "--allowed-to-push", "NO_ONE", "--allowed-to-merge", "DEVELOPER"]);
  ids.bp = pick(r.data, "id", "uuid");
  call("gitflic_branch_protection_get", ["branch", "protection", "get", ids.bp || "x"]);
  call("gitflic_branch_protection_edit", ["branch", "protection", "edit", ids.bp || "x", "--allowed-to-push", "DEVELOPER"]);
  call("gitflic_branch_protection_delete", ["branch", "protection", "delete", ids.bp || "x"]);
}

// ---------- MR lifecycle (description is REQUIRED) ----------
{
  const r = call("gitflic_mr_create", ["mr", "create", "--title", "E2E MR1 " + RID, "--description", "body", "--from", "feature", "--to", "master"]);
  ids.mr1 = pick(r.data, "localId", "id");
  call("gitflic_mr_view", ["mr", "view", String(ids.mr1)]);
  call("gitflic_mr_diff", ["mr", "diff", String(ids.mr1)]);
  call("gitflic_mr_by_commit", ["mr", "by-commit", ids.featureHash || "x"]);
  call("gitflic_mr_comment", ["mr", "comment", String(ids.mr1), "E2E comment"]);
  const d = call("gitflic_mr_discuss_list", ["mr", "discuss", "list", String(ids.mr1)]);
  ids.disc = pick(listOf(d.data)[0] || {}, "id", "uuid");
  if (ids.disc) {
    call("gitflic_mr_discuss_reply", ["mr", "discuss", "reply", String(ids.mr1), ids.disc, "E2E reply"]);
    call("gitflic_mr_discuss_resolve", ["mr", "discuss", "resolve", String(ids.mr1), ids.disc]);
    call("gitflic_mr_discuss_delete", ["mr", "discuss", "delete", String(ids.mr1), ids.disc]);
  } else {
    for (const t of ["reply", "resolve", "delete"]) skip("gitflic_mr_discuss_" + t, "no discussion thread (a CLI comment doesn't create one)");
  }
  call("gitflic_mr_approve", ["mr", "approve", String(ids.mr1)]);
  call("gitflic_mr_edit", ["mr", "edit", String(ids.mr1), "--title", "E2E MR1 edited"]);
  call("gitflic_mr_cancel", ["mr", "cancel", String(ids.mr1)]);

  const r2 = call("gitflic_mr_create", ["mr", "create", "--title", "E2E MR2 " + RID, "--description", "body", "--from", "feature2", "--to", "master"], { note: "(for close)" });
  call("gitflic_mr_close", ["mr", "close", String(pick(r2.data, "localId", "id"))]);

  const r3 = call("gitflic_mr_create", ["mr", "create", "--title", "E2E MR3 " + RID, "--description", "body", "--from", "feature3", "--to", "master"], { note: "(for merge — needs a fresh diff branch)" });
  call("gitflic_mr_merge", ["mr", "merge", String(pick(r3.data, "localId", "id"))]);
}

// ---------- ISSUE lifecycle ----------
{
  const r = call("gitflic_issue_create", ["issue", "create", "--title", "E2E issue " + RID, "--description", "issue body"]);
  ids.issue = pick(r.data, "localId", "id");
  call("gitflic_issue_view", ["issue", "view", String(ids.issue)]);
  call("gitflic_issue_edit", ["issue", "edit", String(ids.issue), "--title", "E2E issue edited"]);
  call("gitflic_issue_comment", ["issue", "comments", "add", String(ids.issue), "E2E issue comment"]);
  const c = call("gitflic_issue_comments_list", ["issue", "comments", "list", String(ids.issue)]);
  ids.comment = pick(listOf(c.data)[0] || {}, "id", "uuid");
  if (ids.comment) {
    call("gitflic_issue_comments_edit", ["issue", "comments", "edit", String(ids.issue), String(ids.comment), "edited"]);
    call("gitflic_issue_comments_delete", ["issue", "comments", "delete", String(ids.issue), String(ids.comment)]);
  } else {
    skip("gitflic_issue_comments_edit", "no comment id");
    skip("gitflic_issue_comments_delete", "no comment id");
  }
  call("gitflic_issue_relations_list", ["issue", "relations", "list", String(ids.issue)]);
  call("gitflic_issue_close", ["issue", "close", String(ids.issue)]);
  call("gitflic_issue_reopen", ["issue", "reopen", String(ids.issue)]);
  call("gitflic_issue_delete", ["issue", "delete", String(ids.issue)]);
}

// ---------- RELEASE lifecycle ----------
{
  const r = call("gitflic_release_create", ["release", "create", "--title", "E2E rel " + RID, "--description", "notes", "--tag", TAG]);
  ids.rel = pick(r.data, "id", "uuid");
  call("gitflic_release_get", ["release", "get", ids.rel || "x"]);
  call("gitflic_release_latest", ["release", "latest"]);
  call("gitflic_release_edit", ["release", "edit", ids.rel || "x", "--description", "edited notes"]);
  call("gitflic_release_delete", ["release", "delete", ids.rel || "x"]);
}

// ---------- WEBHOOK lifecycle ----------
{
  const r = call("gitflic_webhook_create", ["webhook", "create", "--url", "https://example.com/e2e", "--event", "ISSUE_CREATE"]);
  ids.wh = pick(r.data, "id", "uuid");
  call("gitflic_webhook_get", ["webhook", "get", ids.wh || "x"]);
  call("gitflic_webhook_delete", ["webhook", "delete", ids.wh || "x"]);
}

// ---------- done / skipped ----------
results.unshift({ tool: "gitflic_project_create", status: "⚠", detail: "SKIP: create the e2e project once at setup (not re-created per run)" });
for (const t of ["login", "logout", "switch", "bind", "unbind"])
  skip("gitflic_auth_" + t, "mutates local keychain/session — unsafe in live run");
skip("gitflic_project_member_invite", "needs a real second user");

// ---------- REPORT ----------
const ok = results.filter((r) => r.status === "✓").length;
const fail = results.filter((r) => r.status === "✗").length;
const sk = results.filter((r) => r.status === "⚠").length;
console.log("\n# E2E live checklist — " + P + "\n");
console.log(`✓ ${ok}  ·  ✗ ${fail}  ·  ⚠ ${sk}  (всего ${results.length})\n`);
for (const r of results) console.log(`- [${r.status}] \`${r.tool}\`${r.detail ? " — " + r.detail : ""}`);
process.exitCode = fail > 0 ? 1 : 0;
