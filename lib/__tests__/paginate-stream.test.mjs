import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../http.mjs", () => ({
  http: vi.fn(),
}));

import { http } from "../http.mjs";
import { paginatedList } from "../paginate.mjs";

function page(num, items, totalElements, totalPages) {
  return {
    _embedded: { X: items },
    page: { number: num, size: items.length, totalElements, totalPages },
  };
}

let writeSpy;

beforeEach(() => {
  http.mockReset();
  writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

import { afterEach } from "vitest";
afterEach(() => {
  writeSpy.mockRestore();
});

describe("paginatedList — stream", () => {
  it("emits NDJSON and returns null with --stream", async () => {
    http
      .mockResolvedValueOnce(page(0, [{ id: 1 }, { id: 2 }], 4, 2))
      .mockResolvedValueOnce(page(1, [{ id: 3 }, { id: 4 }], 4, 2));
    const r = await paginatedList({
      api: "https://x.test", token: "t", owner: "o", alias: "a",
      path: "/list", embeddedKey: "X", flags: { stream: true, size: 2 },
    });
    expect(r).toBeNull();
    const out = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toBe('{"id":1}\n{"id":2}\n{"id":3}\n{"id":4}\n');
  });

  it("respects GITFLIC_STREAM=1 env", async () => {
    const prev = process.env.GITFLIC_STREAM;
    try {
      process.env.GITFLIC_STREAM = "1";
      http.mockResolvedValueOnce(page(0, [{ x: 1 }], 1, 1));
      const r = await paginatedList({
        api: "https://x.test", token: "t", owner: "o", alias: "a",
        path: "/list", embeddedKey: "X", flags: {},
      });
      expect(r).toBeNull();
      const out = writeSpy.mock.calls.map((c) => c[0]).join("");
      expect(out).toBe('{"x":1}\n');
    } finally {
      if (prev === undefined) delete process.env.GITFLIC_STREAM;
      else process.env.GITFLIC_STREAM = prev;
    }
  });

  it("without --stream returns a single page object (no stdout write)", async () => {
    http.mockResolvedValueOnce(page(0, [{ id: 1 }], 1, 1));
    const r = await paginatedList({
      api: "https://x.test", token: "t", owner: "o", alias: "a",
      path: "/list", embeddedKey: "X", flags: {},
    });
    expect(r).not.toBeNull();
    expect(r._embedded.X).toEqual([{ id: 1 }]);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("stream with --all walks multiple pages and writes once per item", async () => {
    http
      .mockResolvedValueOnce(page(0, [{ id: 1 }], 3, 3))
      .mockResolvedValueOnce(page(1, [{ id: 2 }], 3, 3))
      .mockResolvedValueOnce(page(2, [{ id: 3 }], 3, 3));
    const r = await paginatedList({
      api: "https://x.test", token: "t", owner: "o", alias: "a",
      path: "/list", embeddedKey: "X", flags: { stream: true, all: true, size: 1 },
    });
    expect(r).toBeNull();
    const out = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toBe('{"id":1}\n{"id":2}\n{"id":3}\n');
    expect(http).toHaveBeenCalledTimes(3);
  });
});
