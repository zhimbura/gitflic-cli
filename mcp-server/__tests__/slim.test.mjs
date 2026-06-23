import { describe, it, expect } from "vitest";
import { slimResult, deny, outputMode, applyListFilters, hasFilter } from "../slim.mjs";

// A realistic raw issue (matches GitFlic's actual shape: 9-field status,
// nested users with avatar+cover).
function rawIssue(localId, status = "OPEN", labels = [], assignee = true) {
  return {
    id: `uuid-${localId}`,
    localId,
    title: `Issue ${localId}`,
    description: `body ${localId}`,
    status: { id: status, title: "Новая", hash: null, alias: null, ownerAlias: null, color: "info", hexColor: "17A2B8", icon: null, isDeleted: false },
    assignedUsers: assignee ? [{ id: "u1", username: "alice", name: "A", fullName: "Alice", avatar: "http://a", cover: "http://c" }] : [],
    labels: labels.map((t) => ({ id: "l", title: t, hexColor: "#fff", color: "x", icon: null, isDeleted: false })),
    projectAlias: "proj",
    userAlias: "bob",
    updatedAt: "u", createdAt: "c",
    updatedBy: { id: "u2", username: "carol", name: "C", fullName: "Carol", avatar: "http://a", cover: "http://c" },
  };
}
const issueList = (issues) => ({
  _embedded: { issueModelList: issues },
  page: { number: 0, size: issues.length, totalElements: issues.length, totalPages: 1 },
  _links: { self: { href: "x" } },
});

const deepKeys = (o, acc = new Set()) => {
  if (Array.isArray(o)) o.forEach((v) => deepKeys(v, acc));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { acc.add(k); deepKeys(v, acc); }
  return acc;
};

describe("outputMode", () => {
  it("defaults to slim", () => expect(outputMode({})).toBe("slim"));
  it("OUTPUT=full|raw -> full", () => {
    expect(outputMode({ GITFLIC_MCP_OUTPUT: "full" })).toBe("full");
    expect(outputMode({ GITFLIC_MCP_OUTPUT: "RAW" })).toBe("full");
  });
  it("RAW truthy -> full (1/true/yes/on)", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE"]) expect(outputMode({ GITFLIC_MCP_RAW: v })).toBe("full");
    expect(outputMode({ GITFLIC_MCP_RAW: "0" })).toBe("slim");
  });
  it("RAW wins over OUTPUT", () => expect(outputMode({ GITFLIC_MCP_RAW: "1", GITFLIC_MCP_OUTPUT: "slim" })).toBe("full"));
});

describe("deny (generic noise strip)", () => {
  it("drops cosmetic keys at any depth and inside arrays", () => {
    const out = deny({ keep: 1, avatar: "x", nested: { cover: "y", ok: 2 }, arr: [{ hexColor: "#fff", v: 3 }], _links: {} });
    expect(out).toEqual({ keep: 1, nested: { ok: 2 }, arr: [{ v: 3 }] });
  });
  it("masks secret -> secretSet and NEVER emits the raw secret", () => {
    const out = deny({ id: "w", secret: "s3cr3t" });
    expect(out).toEqual({ id: "w", secretSet: true });
    expect(JSON.stringify(out)).not.toContain("s3cr3t");
    expect(deny({ secret: "no-secret" }).secretSet).toBe(false);
    expect(deny({ secret: "" }).secretSet).toBe(false);
  });
});

describe("slimResult — issue list", () => {
  const raw = issueList([rawIssue(1, "OPEN", ["Security"]), rawIssue(2, "CLOSED", [])]);

  it("flattens envelope and projects each item", () => {
    const out = slimResult("gitflic_issue_list", raw, {}, {});
    expect(out.total).toBe(2);
    expect(out.returned).toBe(2);
    expect(out.items[0]).toEqual({
      localId: 1, id: "uuid-1", title: "Issue 1", status: "OPEN",
      labels: ["Security"], assignedUsers: ["alice"], author: "bob",
      updatedBy: "carol", createdAt: "c", updatedAt: "u", description: "body 1",
    });
  });

  it("strips ALL noise keys (no avatar/cover/_links/hexColor/_embedded anywhere)", () => {
    const out = slimResult("gitflic_issue_list", raw, {}, {});
    const keys = deepKeys(out);
    for (const noise of ["avatar", "cover", "_links", "_embedded", "hexColor", "icon", "isDeleted", "hash", "projectAlias"]) {
      expect(keys.has(noise), noise).toBe(false);
    }
  });

  it("returns the slim list shape for an empty list (no _embedded)", () => {
    const out = slimResult("gitflic_issue_list", { page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } }, {}, {});
    expect(out).toEqual({ items: [], total: 0, returned: 0 });
  });

  it("is meaningfully smaller (byte budget guard)", () => {
    const big = issueList(Array.from({ length: 20 }, (_, i) => rawIssue(i + 1, "OPEN", ["Security", "bug"])));
    const rawLen = JSON.stringify(big, null, 2).length;
    const slimLen = JSON.stringify(slimResult("gitflic_issue_list", big, {}, {}), null, 2).length;
    expect(slimLen).toBeLessThan(rawLen * 0.45);
  });
});

describe("slimResult — escape hatches", () => {
  const raw = issueList([rawIssue(1)]);
  it("per-call raw:true returns the input unchanged", () => {
    expect(slimResult("gitflic_issue_list", raw, { raw: true }, {})).toBe(raw);
  });
  it("global full mode returns the input unchanged", () => {
    expect(slimResult("gitflic_issue_list", raw, {}, { GITFLIC_MCP_RAW: "1" })).toBe(raw);
  });
  it("{raw:text} non-JSON output passes through untouched", () => {
    const t = { raw: "plain text" };
    expect(slimResult("gitflic_auth_list", t, {}, {})).toBe(t);
  });
  it("fields override narrows the projection (plus id keys)", () => {
    const out = slimResult("gitflic_issue_list", raw, { fields: ["title"] }, {});
    expect(out.items[0]).toEqual({ title: "Issue 1", id: "uuid-1", localId: 1 });
  });
});

describe("slimResult — client-side list filtering (problem #1)", () => {
  const raw = issueList([
    rawIssue(1, "OPEN", ["Security"]),
    rawIssue(2, "OPEN", ["bug"], false),
    rawIssue(3, "CLOSED", ["Security"]),
  ]);
  it("filters by label (case-insensitive) and reports matched vs total", () => {
    const out = slimResult("gitflic_issue_list", raw, { label: "security" }, {});
    expect(out.items.map((i) => i.localId)).toEqual([1, 3]);
    expect(out.total).toBe(3);
    expect(out.matched).toBe(2);
    expect(out.returned).toBe(2);
  });
  it("filters by status, assignee, q; sorts; limits", () => {
    expect(slimResult("gitflic_issue_list", raw, { status: "OPEN" }, {}).items.map((i) => i.localId)).toEqual([1, 2]);
    expect(slimResult("gitflic_issue_list", raw, { assignee: "alice" }, {}).matched).toBe(2); // #1 and #3 assigned
    expect(slimResult("gitflic_issue_list", raw, { q: "body 2" }, {}).items.map((i) => i.localId)).toEqual([2]);
    expect(slimResult("gitflic_issue_list", raw, { sort: "-localId" }, {}).items.map((i) => i.localId)).toEqual([3, 2, 1]);
    expect(slimResult("gitflic_issue_list", raw, { limit: 1 }, {}).items.length).toBe(1);
  });
  it("status filter is case-insensitive", () => {
    expect(slimResult("gitflic_issue_list", raw, { status: "open" }, {}).items.map((i) => i.localId)).toEqual([1, 2]);
  });
  it("ignores a non-numeric or negative limit instead of emptying the list", () => {
    expect(slimResult("gitflic_issue_list", raw, { limit: "abc" }, {}).returned).toBe(3);
    expect(slimResult("gitflic_issue_list", raw, { limit: -1 }, {}).returned).toBe(3);
  });
  it("q matches user fields (username/fullName) — user_search regression", () => {
    const users = {
      _embedded: { userList: [
        { id: "1", username: "tikhon", fullName: "Тихон Устинов", avatar: "x" },
        { id: "2", username: "someone-else", fullName: "Other", avatar: "y" },
      ] },
      page: { totalElements: 2 },
    };
    const out = slimResult("gitflic_user_search", users, { q: "tikhon" }, {});
    expect(out.items.map((u) => u.username)).toEqual(["tikhon"]);
    expect(out.matched).toBe(1);
  });

  it("hasFilter detects only real filter args", () => {
    expect(hasFilter({ label: "x" })).toBe(true);
    expect(hasFilter({ project: "o/a", page: 1 })).toBe(false);
  });
});

describe("slimResult — webhook secret handling", () => {
  const rawWebhook = { id: "w1", url: "http://h", secret: "s3cr3t-123", events: { MERGE: true, PUSH: false }, _links: {} };
  it("webhook_get masks the secret (secretSet) and collapses events", () => {
    const out = slimResult("gitflic_webhook_get", rawWebhook, {}, {});
    expect(out.secretSet).toBe(true);
    expect(out.events).toEqual(["MERGE"]);
    expect(JSON.stringify(out)).not.toContain("s3cr3t-123");
  });
  it("reveal tool returns the real secret (approval-gated tool)", () => {
    const out = slimResult("gitflic_webhook_reveal_secret", rawWebhook, {}, {});
    expect(out).toEqual({ id: "w1", url: "http://h", secret: "s3cr3t-123" });
  });
  it("raw:true does NOT leak the secret (masked even on the escape hatch)", () => {
    const out = slimResult("gitflic_webhook_get", rawWebhook, { raw: true }, {});
    expect(JSON.stringify(out)).not.toContain("s3cr3t-123");
    expect(out.secretSet).toBe(true);
    expect(out.url).toBe("http://h"); // full fidelity otherwise
  });
  it("global full mode does NOT leak the secret either", () => {
    const out = slimResult("gitflic_webhook_get", rawWebhook, {}, { GITFLIC_MCP_RAW: "1" });
    expect(JSON.stringify(out)).not.toContain("s3cr3t-123");
    expect(out.secretSet).toBe(true);
  });
});

describe("slimResult — diff/blob bodies are light-stripped, not projected", () => {
  it("unmapped diff payload keeps the body, drops _links only", () => {
    const diff = { totalAddedLines: 3, commitBlobs: [{ newPath: "a.js", _links: {}, lines: [{ op: "ADD", body: "x = 1", newLine: 2 }] }] };
    const out = slimResult("gitflic_mr_diff", diff, {}, {});
    expect(out.totalAddedLines).toBe(3);
    expect(out.commitBlobs[0].newPath).toBe("a.js");
    expect(out.commitBlobs[0].lines[0].body).toBe("x = 1"); // body preserved
    expect(deepKeys(out).has("_links")).toBe(false);
  });
});

describe("applyListFilters — name glob", () => {
  it("matches branch globs like release/*", () => {
    const items = [{ name: "main" }, { name: "release/1.0" }, { name: "release/2.0" }];
    expect(applyListFilters(items, { name: "release/*" }).map((b) => b.name)).toEqual(["release/1.0", "release/2.0"]);
  });
});
