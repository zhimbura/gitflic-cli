import { describe, it, expect, vi, beforeEach } from "vitest";

// We mock fetch and FormData to assert the wire format.
const FormDataMock = vi.fn(function () {
  this.entries = [];
  this.append = (k, v, name) => this.entries.push({ k, v, name });
});
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => Buffer.from("hello world")),
}));

import { readFileSync } from "node:fs";

beforeEach(() => {
  FormDataMock.mockClear();
  readFileSync.mockClear();
  // Install a global FormData stub
  globalThis.FormData = FormDataMock;
});

import { httpMultipart } from "../http.mjs";

describe("httpMultipart", () => {
  it("builds FormData and POSTs", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => JSON.stringify({ id: "x" }),
    }));
    globalThis.fetch = fetchSpy;

    await httpMultipart("https://x.test/upload", "tok", {
      fileFields: [{ name: "file", path: "/tmp/a.txt" }],
      textFields: { description: "hi" },
      retries: 0,
    });

    expect(FormDataMock).toHaveBeenCalled();
    const form = FormDataMock.mock.results[0].value;
    expect(form.entries).toEqual([
      { k: "description", v: "hi", name: undefined },
      { k: "file", v: expect.anything(), name: "a.txt" },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://x.test/upload");
    expect(init.method).toBe("POST");
    // Should NOT set Content-Type manually — fetch sets the boundary itself.
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it("uses default filename from path", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => "{}",
    }));
    await httpMultipart("https://x.test/u", "tok", {
      fileFields: [{ name: "x", path: "/var/folders/foo/bar.zip" }],
      retries: 0,
    });
    const form = FormDataMock.mock.results[0].value;
    expect(form.entries[0].name).toBe("bar.zip");
  });

  it("respects custom filename", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => "{}",
    }));
    await httpMultipart("https://x.test/u", "tok", {
      fileFields: [{ name: "x", path: "/tmp/a", filename: "renamed.bin" }],
      retries: 0,
    });
    const form = FormDataMock.mock.results[0].value;
    expect(form.entries[0].name).toBe("renamed.bin");
  });

  it("skips undefined text fields", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => "{}",
    }));
    await httpMultipart("https://x.test/u", "tok", {
      textFields: { a: "x", b: undefined, c: null },
      retries: 0,
    });
    const form = FormDataMock.mock.results[0].value;
    expect(form.entries.map((e) => e.k)).toEqual(["a"]);
  });

  it("retries on 429 via httpWithRetry pipeline", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: { get: () => null },
        text: async () => JSON.stringify({ message: "slow down" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => null },
        text: async () => JSON.stringify({ id: "ok" }),
      });
    const r = await httpMultipart("https://x.test/u", "tok", {
      fileFields: [{ name: "file", path: "/tmp/a" }],
      retries: 2,
      retryDelay: 1,
    });
    expect(r).toEqual({ id: "ok" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
