import { it as test, vi, afterEach } from "vitest";

import assert from "node:assert/strict";
import { buildPageQs, fetchAllPages, paginatedList } from "../paginate.mjs";
import { handle as mr } from "../cmd/mr.mjs";
import { handle as projects } from "../cmd/project.mjs";
import { TOOLS } from "../../mcp-server/tools.mjs";
import { slimResult } from "../../mcp-server/slim.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const context = { api: "https://example.invalid", token: "test-token", owner: "team", alias: "repo", flags: {} };
const version = { sourceBranch: { hash: "source" }, targetBranch: { hash: "target" } };
const blob = {
  id: "diff-identity", filePath: "new name.cs", oldPath: "old name.cs", newPath: "new name.cs",
  addedLinesCount: 2, removedLinesCount: 1, isCollapsed: true, lines: [],
};
const page = (items, number, size, total, key = "rows") => ({
  _embedded: { [key]: items },
  page: { number, size, totalElements: total, totalPages: Math.ceil(total / size) },
});
function mockHttp(handler) {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    calls.push(new URL(url));
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify(await handler(new URL(url))), {
      status: 200, headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

test("all pages respect a smaller server page size", async () => {
  const calls = [];
  const result = await fetchAllPages({
    embeddedKey: "rows", pageSize: 20,
    fetchPage: async n => {
      calls.push(n);
      return page(Array.from({ length: n === 2 ? 9 : 10 }, (_, i) => n * 10 + i), n, 10, 29);
    },
  });
  assert.deepEqual(calls, [0, 1, 2]);
  assert.equal(result.items.length, 29);
  assert.equal(result.complete, true);
  assert.equal(result.nextPage, null);
});
test("empty collection may omit HAL envelope", async () => {
  const result = await fetchAllPages({
    embeddedKey: "rows", fetchPage: async () => ({ page: { number: 0, totalElements: 0, totalPages: 0 } }),
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.complete, true);
});
test("pagination cap explicitly reports an incomplete result", async () => {
  const result = await fetchAllPages({
    embeddedKey: "rows", maxPages: 1, fetchPage: async n => page([n], n, 1, 2),
  });
  assert.equal(result.complete, false);
  assert.equal(result.nextPage, 1);
});
test("repeated pages and changing collection totals fail", async () => {
  await assert.rejects(fetchAllPages({
    embeddedKey: "rows", fetchPage: async n => page(["same"], n, 1, 3),
  }), /repeated/);
  await assert.rejects(fetchAllPages({
    embeddedKey: "rows", fetchPage: async n => page([n], n, 1, n === 0 ? 3 : 4),
  }), /changed/);
});
test("invalid paging arguments fail before making a request", () => {
  for (const flags of [{ page: -1 }, { size: 0 }, { page: 0.5 }, { size: "bad" }]) {
    assert.throws(() => buildPageQs(flags));
  }
});
test("single page retains completeness and next-page metadata", async () => {
  const calls = mockHttp(url => {
    assert.equal(url.searchParams.get("page"), "1");
    assert.equal(url.searchParams.get("size"), "1");
    return page(["second"], 1, 1, 3);
  });
  const result = await paginatedList({
    ...context, path: "/rows", embeddedKey: "rows", flags: { page: 1, size: 1 },
  });
  assert.equal(calls.length, 1);
  assert.equal(result._pagination.complete, false);
  assert.equal(result._pagination.nextPage, 2);
});
test("MR diff collects flat pages and expands exact renamed-file diff", async () => {
  mockHttp(url => {
    if (url.pathname.endsWith("/589")) return version;
    if (url.pathname.endsWith("/changes")) {
      const n = Number(url.searchParams.get("page"));
      return { commitBlobs: [n === 0 ? { ...blob, id: "binary", isBinary: true } : blob],
        page: { number: n, size: 1, totalElements: 2, totalPages: 2 } };
    }
    assert.equal(url.pathname, "/project/team/repo/branch/compare/file");
    assert.equal(url.searchParams.get("filePath"), "new name.cs");
    assert.equal(url.searchParams.get("baseHash"), "target");
    assert.equal(url.searchParams.get("compareHash"), "source");
    return { ...blob, isCollapsed: false, headers: ["header"], lines: [{ addLineNumber: 2, op: "add" }] };
  });
  const result = await mr(context, "diff", ["589"], { size: 1, format: "json" });
  assert.equal(result.commitBlobs.length, 2);
  assert.equal(result.totalAddedLines, 4);
  assert.equal(result.totalRemovedLines, 2);
  assert.equal(result._diff.complete, true);
  assert.equal(result.commitBlobs[1].oldPath, "old name.cs");
  assert.equal(result.commitBlobs[1].lines.length, 1);
});
test("MR diff rejects file identity mismatch and commit drift", async () => {
  let mrReads = 0;
  mockHttp(url => {
    if (url.pathname.endsWith("/589")) return ++mrReads === 1 ? version : { ...version, sourceBranch: { hash: "changed" } };
    if (url.pathname.endsWith("/changes")) return {
      commitBlobs: [blob], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 },
    };
    return { ...blob, id: "wrong" };
  });
  await assert.rejects(mr(context, "diff", ["589"], { format: "json" }), /diff changed/);
  mrReads = 0;
  await assert.rejects(mr(context, "diff", ["589"], { format: "json", "no-expand": true }), /commits changed/);
});
test("all discussions include replies and slim mode preserves anchors", async () => {
  mockHttp(url => {
    const n = Number(url.searchParams.get("page"));
    return page([{ rootNote: { uuid: String(n), rawMessage: "body", message: "body",
      oldPath: "a", newPath: "b", oldLine: 3, newLine: 4 },
      replies: [{ uuid: "reply-" + n, message: "reply" }] }], n, 1, 3, "restDiscussionModelList");
  });
  const result = await mr(context, "discuss", ["list", "589"], { size: 1, format: "json" });
  const slim = slimResult("gitflic_mr_discuss_list", result, {}, {});
  assert.equal(slim.returned, 3);
  assert.equal(slim.pagination.complete, true);
  assert.equal(slim.items[2].newLine, 4);
  assert.equal(slim.items[2].oldPath, "a");
  assert.equal(slim.items[2].replies[0].uuid, "reply-2");
});
test("shared project discovery filters by team owner", async () => {
  mockHttp(url => {
    assert.equal(url.pathname, "/project/shared");
    assert.equal(url.searchParams.get("qOwner"), "team");
    return page([{ id: "p", alias: "repo", owner: { alias: "team", type: "TEAM" } }], 0, 20, 1, "projectList");
  });
  const result = await projects(context, "list", [], { scope: "shared", "q-owner": "team", all: true, format: "json" });
  assert.equal(slimResult("gitflic_project_list", result, {}, {}).items[0].ownerType, "TEAM");
});
test("MCP forwards paging options, explicit false, and team scope", () => {
  for (const name of ["gitflic_project_list", "gitflic_project_list_my", "gitflic_mr_diff", "gitflic_mr_discuss_list"]) {
    const tool = TOOLS.find(t => t.name === name);
    for (const field of ["page", "size", "all"]) assert.ok(tool.inputSchema.properties[field]);
    const single = tool.handler({ id: "589", project: "team/repo", q: "test", all: false, page: 1, size: 2 });
    assert.ok(!single.includes("--all"));
    assert.ok(single.includes("--no-all"));
    assert.equal(single[single.indexOf("--page") + 1], "1");
    assert.ok(tool.handler({ id: "589", project: "team/repo" }).includes("--all"));
  }
  const tool = TOOLS.find(t => t.name === "gitflic_project_list");
  assert.ok(tool.handler({ owner: "team" }).includes("--q-owner"));
  assert.throws(() => tool.handler({ scope: "my", owner: "team" }));
});
test("slim diff retains completeness metadata", () => {
  const result = slimResult("gitflic_mr_diff", {
    commitBlobs: [], page: { totalElements: 0 },
    _pagination: { complete: true, nextPage: null }, _diff: { complete: true },
  }, {}, {});
  assert.equal(result._pagination.complete, true);
  assert.equal(result._diff.complete, true);
});
test("streamed pages are emitted without retaining all rows", async () => {
  const emitted = [];
  const result = await fetchAllPages({
    embeddedKey: "rows",
    fetchPage: async n => page([n], n, 1, 3),
    onPage: rows => emitted.push(...rows),
  });
  assert.deepEqual(emitted, [0, 1, 2]);
  assert.deepEqual(result.items, []);
  assert.equal(result.complete, true);
});

test("streamed MR diff expands files before emitting NDJSON", async () => {
  vi.stubEnv("GITFLIC_STREAM", "1");
  const writes = [];
  vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
    writes.push(chunk);
    return true;
  });
  mockHttp(url => {
    if (url.pathname.endsWith("/589")) return version;
    if (url.pathname.endsWith("/changes")) return {
      commitBlobs: [blob], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 },
    };
    return { ...blob, isCollapsed: false, lines: [{ op: "add", addLineNumber: 2 }] };
  });
  const result = await mr(context, "diff", ["589"], { format: "json" });
  assert.equal(result, null);
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0]).lines.length, 1);
});

test("streamed discussions do not append a second JSON document", async () => {
  const writes = [];
  vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
    writes.push(chunk);
    return true;
  });
  mockHttp(() => page([{ rootNote: { uuid: "one" }, replies: [] }], 0, 1, 1, "restDiscussionModelList"));
  const result = await mr(context, "discuss", ["list", "589"], { stream: true, format: "json" });
  assert.equal(result, null);
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0]).rootNote.uuid, "one");
});
