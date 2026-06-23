// Token-slimming layer for MCP responses (GitFlic issue #1).
//
// The MCP used to return the raw GitFlic API JSON verbatim (server.mjs did
// JSON.stringify(result)). That dumps LLM-useless noise — avatar/cover URLs,
// label hexColors, 9-field status sub-objects, full nested user objects, HAL
// `_embedded`/`_links` envelopes — costing the model a lot of tokens.
//
// This module shapes the response at the single MCP boundary. The CLI's own
// `--format json` stays byte-for-byte raw (humans/scripts depend on it) — all
// shaping lives here. Three controls, in precedence order:
//   1. per-call  `raw: true`            -> return the full, un-slimmed response
//   2. global    GITFLIC_MCP_RAW=1      -> same, for every call
//      or        GITFLIC_MCP_OUTPUT=full
//   3. default (slim): flatten envelope + project per entity + drop noise.
// Plus a per-call `fields: [...]` to narrow the projection further.
//
// Pure + testable: every function takes explicit input; only outputMode reads env.

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const truthy = (v) => v != null && TRUTHY.has(String(v).trim().toLowerCase());

// Resolve the output mode from env. RAW wins over OUTPUT if both are set.
export function outputMode(env = {}) {
  if (truthy(env.GITFLIC_MCP_RAW)) return "full";
  const o = String(env.GITFLIC_MCP_OUTPUT || "").trim().toLowerCase();
  if (o === "full" || o === "raw") return "full";
  return "slim";
}

// ---- collapse helpers --------------------------------------------------------
const userName = (u) =>
  u && typeof u === "object" ? (u.username || u.fullName || u.name || null) : u;
// status sub-object -> its machine enum scalar (OPEN / OPENED / MERGED / ...).
// Prefer .id (the stable token an LLM filters/acts on) over .title (display).
const statusId = (s) => (s && typeof s === "object" ? (s.id ?? s.title ?? null) : s);
const labelTitles = (ls) =>
  Array.isArray(ls)
    ? ls.map((l) => (l && typeof l === "object" ? (l.title ?? l.name ?? null) : l)).filter((x) => x != null)
    : ls;

// ---- generic denylist: provably-cosmetic keys, stripped at any depth ---------
// Deliberately NARROW. Addressing/meaningful keys (hash, alias, mode, isBinary)
// are NOT here — they are only collapsed inside the per-entity projectors.
const DENY = new Set([
  "avatar", "cover", "hexColor", "color", "icon",
  "_links", "_embedded", "_pagination", "avatarRadius", "createdLogo", "logoUrl",
]);
export function deny(node) {
  if (Array.isArray(node)) return node.map(deny);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (DENY.has(k)) continue;
      if (k === "secret") { out.secretSet = !!(v && v !== "no-secret"); continue; } // never leak
      out[k] = deny(v);
    }
    return out;
  }
  return node;
}

// ---- per-entity projectors (keep-sets derived from lib/cmd/*.mjs printXxx) ---
const slimCommit = (c, { full = false } = {}) => ({
  hash: c.hash,
  shortMessage: c.shortMessage ?? (c.message ? c.message.split("\n")[0] : undefined),
  ...(full && c.message ? { message: c.message } : {}), // full body only on `commit get`
  author: userName(c.user) || c.authorIdent?.name,
  authorEmail: c.authorIdent?.emailAddress,
  createdAt: c.createdAt,
  verified: !!c.verificationResult?.verified,
  ...((c.parentCommitIds || []).length > 1 ? { parents: c.parentCommitIds } : {}),
});
const slimLastCommit = (c) =>
  c ? { hash: c.hash, shortMessage: c.shortMessage, author: userName(c.user) || c.authorIdent?.name, date: c.authorIdent?.when ?? c.createdAt } : undefined;

const P = {
  issue: (i) => ({
    localId: i.localId, id: i.id, title: i.title,
    status: statusId(i.status),
    labels: labelTitles(i.labels) ?? [],
    assignedUsers: (i.assignedUsers || []).map(userName).filter(Boolean),
    author: i.userAlias ?? userName(i.createdBy),
    ...(i.updatedBy ? { updatedBy: userName(i.updatedBy) } : {}),
    createdAt: i.createdAt, updatedAt: i.updatedAt,
    ...(i.description != null ? { description: i.description } : {}),
  }),
  note: (n) => ({
    uuid: n.uuid, message: n.message, author: userName(n.author),
    createdAt: n.createdAt, ...(n.updatedAt ? { updatedAt: n.updatedAt } : {}),
  }),
  mr: (m) => ({
    localId: m.localId, id: m.id, title: m.title,
    status: statusId(m.status),
    author: userName(m.createdBy) || userName(m.author),
    sourceBranch: m.sourceBranch?.alias || m.sourceBranch?.id || m.sourceBranch,
    targetBranch: m.targetBranch?.alias || m.targetBranch?.id || m.targetBranch,
    ...(m.canMerge !== undefined ? { canMerge: m.canMerge } : {}),
    ...(m.hasConflicts !== undefined ? { hasConflicts: m.hasConflicts } : {}),
    createdAt: m.createdAt, ...(m.updatedAt ? { updatedAt: m.updatedAt } : {}),
    ...(m.projectAlias ? { projectAlias: m.projectAlias } : {}),
    ...(m.description != null ? { description: m.description } : {}),
  }),
  discussion: (d) => ({
    uuid: d.rootNote?.uuid ?? d.uuid,
    resolved: d.rootNote?.resolved ?? d.resolved,
    author: userName(d.rootNote?.author ?? d.author),
    message: d.rootNote?.message ?? d.message,
    createdAt: d.rootNote?.createdAt ?? d.createdAt,
    ...(Array.isArray(d.replies)
      ? { replies: d.replies.map((r) => ({ uuid: r.uuid, author: userName(r.author), message: r.message })) }
      : {}),
  }),
  commit: (c) => slimCommit(c, { full: false }),
  commitFull: (c) => slimCommit(c, { full: true }),
  release: (r) => ({
    id: r.id, tagName: r.tagName, title: r.title,
    commitId: r.commitId, preRelease: r.preRelease,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    filesCount: (r.attachmentFiles || []).length,
    ...(r.description != null ? { description: r.description } : {}),
  }),
  branch: (b) => ({ name: b.name, default: b.default, work: b.work, merged: b.merged, lastCommit: slimLastCommit(b.lastCommit) }),
  tag: (t) => ({
    name: t.name, lightWeight: t.lightWeight, commitId: t.commitId, shortMessage: t.shortMessage,
    tagger: t.personIdent ? `${t.personIdent.name} <${t.personIdent.emailAddress}>` : undefined,
    date: t.personIdent?.when,
  }),
  user: (u) => ({ id: u.id, username: u.username, fullName: u.fullName, ...(u.email ? { email: u.email } : {}) }),
  project: (p) => ({
    id: p.id, alias: p.alias, title: p.title,
    owner: p.owner?.alias || userName(p.owner) || p.owner,
    ...(p.defaultBranch ? { defaultBranch: p.defaultBranch } : {}),
    private: p.private,
    ...(p.language ? { language: p.language } : {}),
    ...(p.description ? { description: String(p.description).split("\n")[0] } : {}),
    ...(p.httpTransportUrl ? { httpTransportUrl: p.httpTransportUrl } : {}),
  }),
  member: (m) => ({ user: userName(m.user) ?? m.userAlias, role: m.role }),
  webhook: (w) => ({
    id: w.id, url: w.url || w.targetUrl,
    events: Object.entries(w.events || {}).filter(([, on]) => on).map(([n]) => n),
    secretSet: !!(w.secret && w.secret !== "no-secret"),
    createdAt: w.createdAt,
  }),
};

// tool name -> { list?: projector } for *_list/*_search, { single?: projector } otherwise.
// Tools absent here (diff/blob/compare, auth, deletes) fall through to deny() only —
// diff/blob bodies ARE the answer, so they must be light-stripped, never projected.
export const SHAPE = {
  gitflic_issue_list: { list: P.issue }, gitflic_issue_view: { single: P.issue },
  gitflic_issue_create: { single: P.issue }, gitflic_issue_edit: { single: P.issue },
  gitflic_issue_close: { single: P.issue }, gitflic_issue_reopen: { single: P.issue },
  gitflic_issue_comments_list: { list: P.note },
  gitflic_mr_list: { list: P.mr }, gitflic_mr_by_commit: { list: P.mr },
  gitflic_mr_view: { single: P.mr }, gitflic_mr_create: { single: P.mr },
  gitflic_mr_edit: { single: P.mr }, gitflic_mr_approve: { single: P.mr },
  gitflic_mr_merge: { single: P.mr }, gitflic_mr_close: { single: P.mr }, gitflic_mr_cancel: { single: P.mr },
  gitflic_mr_discuss_list: { list: P.discussion },
  gitflic_commit_list: { list: P.commit }, gitflic_commit_get: { single: P.commitFull },
  gitflic_release_list: { list: P.release }, gitflic_release_get: { single: P.release },
  gitflic_release_latest: { single: P.release }, gitflic_release_create: { single: P.release }, gitflic_release_edit: { single: P.release },
  gitflic_branch_list: { list: P.branch }, gitflic_branch_get: { single: P.branch }, gitflic_branch_default: { single: P.branch },
  gitflic_tag_list: { list: P.tag }, gitflic_tag_get: { single: P.tag },
  gitflic_user_search: { list: P.user }, gitflic_user_followers: { list: P.user },
  gitflic_user_me: { single: P.user }, gitflic_auth: { single: P.user }, gitflic_user_get: { single: P.user },
  gitflic_user_projects: { list: P.project },
  gitflic_project_list_my: { list: P.project },
  gitflic_project_get: { single: P.project }, gitflic_project_create: { single: P.project }, gitflic_project_edit: { single: P.project },
  gitflic_project_member_list: { list: P.member },
  gitflic_webhook_list: { list: P.webhook }, gitflic_webhook_get: { single: P.webhook }, gitflic_webhook_create: { single: P.webhook },
};

// ---- `fields` projection override -------------------------------------------
const ID_KEYS = ["id", "localId", "uuid", "hash", "commitId", "name", "alias"];
function pickFields(item, fields) {
  if (!item || typeof item !== "object") return item;
  const out = {};
  for (const k of new Set([...fields, ...ID_KEYS])) if (k in item) out[k] = item[k];
  return out;
}

// ---- HAL envelope flatten ----------------------------------------------------
function listOf(data) {
  const emb = data && data._embedded;
  if (!emb || typeof emb !== "object") return null;
  const key = Object.keys(emb).find((k) => Array.isArray(emb[k]));
  if (!key) return null;
  return { items: emb[key], total: data.page?.totalElements };
}

// ---- client-side list filters (run on RAW items, BEFORE projection) ----------
// GitFlic exposes almost no server-side list filters, so the slim layer filters
// the (auto-paginated) full set. Must read RAW items so labels[].title /
// assignedUsers[].username / branch.alias are still present to match on.
const ci = (s) => String(s ?? "").toLowerCase();
const globToRe = (g) =>
  new RegExp("^" + String(g).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
const branchName = (b) => (b && typeof b === "object" ? (b.alias || b.id) : b);

export const FILTER_KEYS = [
  "label", "assignee", "author", "status", "q", "name", "tag", "event",
  "targetBranch", "sourceBranch", "language", "merged", "preRelease", "private", "lightWeight", "sort", "limit",
];
export const hasFilter = (args = {}) =>
  FILTER_KEYS.some((k) => args[k] !== undefined && args[k] !== "" && args[k] !== null);

export function applyListFilters(items, args = {}) {
  let out = items;
  if (args.label) out = out.filter((i) => (labelTitles(i.labels) || []).some((t) => ci(t).includes(ci(args.label))));
  if (args.assignee) out = out.filter((i) => (i.assignedUsers || []).some((u) => ci(userName(u)) === ci(args.assignee)));
  if (args.author) out = out.filter((i) => ci(userName(i.createdBy) || userName(i.user) || i.userAlias || i.authorIdent?.name).includes(ci(args.author)));
  if (args.status) out = out.filter((i) => ci(statusId(i.status)) === ci(args.status));
  if (args.targetBranch) out = out.filter((i) => ci(branchName(i.targetBranch)).includes(ci(args.targetBranch)));
  if (args.sourceBranch) out = out.filter((i) => ci(branchName(i.sourceBranch)).includes(ci(args.sourceBranch)));
  if (args.tag) out = out.filter((i) => ci(i.tagName).includes(ci(args.tag)));
  if (args.language) out = out.filter((i) => ci(i.language) === ci(args.language));
  if (args.event) out = out.filter((i) => i.events && i.events[String(args.event).toUpperCase()] === true);
  if (args.merged !== undefined) out = out.filter((i) => !!i.merged === !!args.merged);
  if (args.preRelease !== undefined) out = out.filter((i) => !!i.preRelease === !!args.preRelease);
  if (args.private !== undefined) out = out.filter((i) => !!i.private === !!args.private);
  if (args.lightWeight !== undefined) out = out.filter((i) => !!i.lightWeight === !!args.lightWeight);
  if (args.name) { const re = globToRe(args.name); out = out.filter((i) => re.test(i.name ?? "") || ci(i.name).includes(ci(args.name))); }
  if (args.q) {
    const q = ci(args.q);
    // Haystack spans every entity's free-text/identity fields so `q` works for
    // issues/MRs (title+description), commits (messages), users (username/
    // fullName/name), projects (title/alias) and releases (tagName). Missing
    // fields collapse to "" — harmless. (Bug fix: user_search used to drop all
    // server results because the haystack lacked username/fullName.)
    out = out.filter((i) =>
      `${i.title ?? ""} ${i.description ?? ""} ${i.shortMessage ?? ""} ${i.message ?? ""} ${i.username ?? ""} ${i.fullName ?? ""} ${i.name ?? ""} ${i.alias ?? ""} ${i.tagName ?? ""}`
        .toLowerCase()
        .includes(q));
  }
  if (args.sort) {
    const desc = String(args.sort)[0] === "-";
    const k = String(args.sort).replace(/^-/, "");
    out = [...out].sort((a, b) => { const av = a[k], bv = b[k]; return (av > bv ? 1 : av < bv ? -1 : 0) * (desc ? -1 : 1); });
  }
  if (args.limit !== undefined) { const n = Number(args.limit); if (Number.isFinite(n) && n >= 0) out = out.slice(0, n); }
  return out;
}

// Mask every `secret` key (-> secretSet:bool) at any depth, preserving the rest
// byte-for-byte. Returns the SAME reference when no secret is present, so the
// raw/full path stays a true identity passthrough for secret-free payloads.
// This is the guard that keeps `raw:true` / GITFLIC_MCP_RAW from becoming an
// unprompted secret-exfiltration path — the approval-gated reveal tool is the
// ONLY exit for a real secret value.
export function maskSecrets(node) {
  if (Array.isArray(node)) {
    let changed = false;
    const out = node.map((v) => { const m = maskSecrets(v); if (m !== v) changed = true; return m; });
    return changed ? out : node;
  }
  if (node && typeof node === "object") {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "secret") { out.secretSet = !!(v && v !== "no-secret"); changed = true; continue; }
      const m = maskSecrets(v);
      if (m !== v) changed = true;
      out[k] = m;
    }
    return changed ? out : node;
  }
  return node;
}

// ---- entry point -------------------------------------------------------------
export function slimResult(toolName, result, args = {}, env = process.env) {
  // The approval-gated reveal tool is the ONLY path to a real secret value.
  if (toolName === "gitflic_webhook_reveal_secret") {
    if (result == null || typeof result !== "object") return result;
    return { id: result.id, url: result.url || result.targetUrl, secret: result.secret ?? null };
  }
  // Escape hatches: full fidelity for the LLM — EXCEPT secrets stay masked, so
  // raw/full never becomes an unprompted secret leak (per-call raw, or global
  // GITFLIC_MCP_RAW=1 / GITFLIC_MCP_OUTPUT=full).
  if ((args && args.raw === true) || outputMode(env) === "full") return maskSecrets(result);
  if (result == null || typeof result !== "object") return result;
  if (result.raw != null && Object.keys(result).length === 1) return result; // {raw:text}

  const fields = Array.isArray(args.fields) && args.fields.length ? args.fields : null;
  const shape = SHAPE[toolName] || {};
  // Treat known list tools as lists even when GitFlic omits `_embedded` on a
  // zero-result response, so the {items,total,returned} contract is consistent.
  let lst = listOf(result);
  if (!lst && shape.list && result.page) lst = { items: [], total: result.page.totalElements };

  if (lst) {
    let items = Array.isArray(lst.items) ? lst.items : [];
    if (hasFilter(args)) items = applyListFilters(items, args);
    const matched = items.length;
    const project = fields ? (it) => pickFields(it, fields) : (shape.list || ((x) => x));
    const slimmed = items.map((it) => deny(project(it))); // deny() = final cosmetic+secret sweep
    const res = { items: slimmed, ...(lst.total != null ? { total: lst.total } : {}), returned: slimmed.length };
    if (lst.total != null && matched !== lst.total) res.matched = matched;
    return res;
  }

  if (fields) return deny(pickFields(result, fields));
  if (shape.single) return deny(shape.single(result));
  return deny(result); // unmapped single entity -> light strip only
}
