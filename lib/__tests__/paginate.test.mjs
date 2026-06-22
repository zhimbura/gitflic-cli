import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../http.mjs", () => ({
  http: vi.fn(),
}));

import { http } from "../http.mjs";
import { buildPageQs, fetchAllPages, paginatedList } from "../paginate.mjs";

function page(num, items, totalElements, totalPages) {
  return {
    _embedded: { X: items },
    page: { number: num, size: items.length, totalElements, totalPages },
  };
}

beforeEach(() => {
  http.mockReset();
});

describe("buildPageQs", () => {
  it("empty flags -> empty qs", () => {
    const qs = buildPageQs({});
    expect(qs.toString()).toBe("");
  });

  it("--page N adds page", () => {
    const qs = buildPageQs({ page: 3 });
    expect(qs.get("page")).toBe("3");
  });

  it("--size N adds size", () => {
    const qs = buildPageQs({ size: 50 });
    expect(qs.get("size")).toBe("50");
  });

  it("merges extraQs skipping undefined/null", () => {
    const qs = buildPageQs({ page: 2 }, { withExtra: { status: "OPEN", q: null, label: undefined } });
    expect(qs.get("status")).toBe("OPEN");
    expect(qs.has("q")).toBe(false);
    expect(qs.has("label")).toBe(false);
  });
});

describe("fetchAllPages", () => {
  it("stops when a page returns fewer items than pageSize", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(1, ["a", "b", "c"], null, null))
      .mockResolvedValueOnce(page(2, ["d"], null, null)); // 1 < 3 -> stop
    const r = await fetchAllPages({ fetchPage, embeddedKey: "X", pageSize: 3 });
    expect(r.items).toEqual(["a", "b", "c", "d"]);
    expect(r.pages).toBe(2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops at totalPages from server meta", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(1, ["a", "b"], 4, 2))
      .mockResolvedValueOnce(page(2, ["c", "d"], 4, 2));
    const r = await fetchAllPages({ fetchPage, embeddedKey: "X", pageSize: 2 });
    expect(r.items).toEqual(["a", "b", "c", "d"]);
    expect(r.pages).toBe(2);
    expect(r.totalElements).toBe(4);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("caps at maxPages to prevent infinite loops", async () => {
    // Always returns a full page so neither stop condition fires.
    const fetchPage = vi.fn(async (n) => page(n, ["x", "y", "z"], null, null));
    const r = await fetchAllPages({ fetchPage, embeddedKey: "X", pageSize: 3, maxPages: 5 });
    expect(fetchPage).toHaveBeenCalledTimes(5);
    expect(r.pages).toBe(5);
    expect(r.items).toHaveLength(15);
  });

  it("handles empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(page(1, [], 0, 0));
    const r = await fetchAllPages({ fetchPage, embeddedKey: "X", pageSize: 10 });
    expect(r.items).toEqual([]);
    expect(r.pages).toBe(1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe("paginatedList — single page (default)", () => {
  it("calls http with --page/--size as query and returns the response", async () => {
    http.mockResolvedValue({ _embedded: { X: [1, 2] } });
    const r = await paginatedList({
      api: "https://x.test",
      token: "tok",
      owner: "me",
      alias: "proj",
      path: "/list",
      embeddedKey: "X",
      flags: { page: 2, size: 5 },
    });
    expect(r).toEqual({ _embedded: { X: [1, 2] } });
    expect(http).toHaveBeenCalledTimes(1);
    const [method, url] = http.mock.calls[0];
    expect(method).toBe("GET");
    expect(url).toContain("page=2");
    expect(url).toContain("size=5");
    expect(url).toContain("/project/me/proj/list");
  });

  it("merges extraQs", async () => {
    http.mockResolvedValue({ _embedded: { X: [] } });
    await paginatedList({
      api: "https://x.test",
      token: "tok",
      owner: "o",
      alias: "a",
      path: "/list",
      embeddedKey: "X",
      flags: {},
      extraQs: { status: "OPEN", q: null },
    });
    const url = http.mock.calls[0][1];
    expect(url).toContain("status=OPEN");
    expect(url).not.toContain("q=");
  });
});

describe("paginatedList — --all", () => {
  it("fetches all pages and re-shapes the response", async () => {
    http
      .mockResolvedValueOnce(page(1, ["a", "b"], 4, 2))
      .mockResolvedValueOnce(page(2, ["c", "d"], 4, 2));

    const r = await paginatedList({
      api: "https://x.test",
      token: "tok",
      owner: "o",
      alias: "a",
      path: "/list",
      embeddedKey: "X",
      flags: { all: true, size: 2 },
    });

    expect(http).toHaveBeenCalledTimes(2);
    expect(r._embedded.X).toEqual(["a", "b", "c", "d"]);
    expect(r.page.totalElements).toBe(4);
    expect(r.page.totalPages).toBe(2);
    expect(r.page.size).toBe(4);
    expect(r._pagination).toEqual({ pages: 2, pageSize: 2, requestedAll: true });
  });

  it("ignores flags.page when --all is set (always starts at 1)", async () => {
    http.mockResolvedValue(page(1, ["x"], 1, 1));
    await paginatedList({
      api: "https://x.test",
      token: "tok",
      owner: "o",
      alias: "a",
      path: "/list",
      embeddedKey: "X",
      flags: { all: true, page: 7 },
    });
    expect(http.mock.calls[0][1]).toContain("page=1");
  });

  it("uses default page size of 20 when --size is not given", async () => {
    http.mockResolvedValue(page(1, [], 0, 0));
    await paginatedList({
      api: "https://x.test",
      token: "tok",
      owner: "o",
      alias: "a",
      path: "/list",
      embeddedKey: "X",
      flags: { all: true },
    });
    expect(http.mock.calls[0][1]).toContain("size=20");
  });
});
