import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `die()` would call process.exit; redirect it to throwing so tests can assert.
vi.mock("../format.mjs", () => ({
  die: (msg) => {
    const e = new Error(msg);
    e.name = "DieError";
    throw e;
  },
}));

import {
  httpWithRetry,
  RETRYABLE_STATUS,
  defaultRetryOptions,
} from "../http.mjs";

// Helper: build a fake Response.
function fakeRes(status, body = null, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 429 ? "Too Many Requests" : "Err",
    headers: {
      get: (k) => (k.toLowerCase() === "retry-after" ? headers["retry-after"] ?? null : null),
    },
    text: async () => (body == null ? "" : typeof body === "string" ? body : JSON.stringify(body)),
  };
}

// Helper: build a fetch mock with a queue of responses.
function mockFetch(responses) {
  let i = 0;
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    return r;
  });
  return { fn, calls };
}

describe("RETRYABLE_STATUS", () => {
  it("includes 429/502/503/504", () => {
    expect(RETRYABLE_STATUS.has(429)).toBe(true);
    expect(RETRYABLE_STATUS.has(502)).toBe(true);
    expect(RETRYABLE_STATUS.has(503)).toBe(true);
    expect(RETRYABLE_STATUS.has(504)).toBe(true);
  });
  it("excludes 4xx and non-retryable 5xx", () => {
    expect(RETRYABLE_STATUS.has(400)).toBe(false);
    expect(RETRYABLE_STATUS.has(401)).toBe(false);
    expect(RETRYABLE_STATUS.has(404)).toBe(false);
    expect(RETRYABLE_STATUS.has(500)).toBe(false);
  });
});

describe("httpWithRetry — success", () => {
  it("returns body on first try, no retries", async () => {
    const { fn, calls } = mockFetch([fakeRes(200, { ok: true })]);
    const onRetry = vi.fn();
    const r = await httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      onRetry,
      retryDelay: 1,
    });
    expect(r).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("sends Authorization + Accept headers and JSON body when provided", async () => {
    const { fn, calls } = mockFetch([fakeRes(200, { ok: true })]);
    await httpWithRetry("POST", "https://x.test/u", "tok", { a: 1 }, {
      fetchImpl: fn,
      retryDelay: 1,
    });
    expect(calls[0].init.headers.Authorization).toBe("token tok");
    expect(calls[0].init.headers.Accept).toBe("application/json");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.body).toBe('{"a":1}');
  });
});

describe("httpWithRetry — retry on 429/503", () => {
  it("retries on 429 then succeeds, calls onRetry between attempts", async () => {
    const { fn, calls } = mockFetch([
      fakeRes(429, { message: "rate limited" }),
      fakeRes(200, { ok: true }),
    ]);
    const onRetry = vi.fn();
    const r = await httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      onRetry,
      retryDelay: 1,
      retries: 3,
    });
    expect(r).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({
      status: 429,
      reason: "throttled",
      method: "GET",
    });
  });

  it("retries on 503", async () => {
    const { fn, calls } = mockFetch([fakeRes(503), fakeRes(200, {})]);
    await httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      retryDelay: 1,
    });
    expect(calls).toHaveLength(2);
  });

  it("retries on 502 and 504", async () => {
    for (const status of [502, 504]) {
      const { fn, calls } = mockFetch([fakeRes(status), fakeRes(200, {})]);
      await httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
      });
      expect(calls).toHaveLength(2);
    }
  });
});

describe("httpWithRetry — no retry on non-retryable statuses", () => {
  it("does NOT retry 400, 401, 404, 422, 500", async () => {
    for (const status of [400, 401, 404, 422, 500]) {
      const { fn, calls } = mockFetch([fakeRes(status, { message: "boom" })]);
      await expect(
        httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
          fetchImpl: fn,
          retryDelay: 1,
          retries: 5,
        }),
      ).rejects.toThrow(/HTTP 400|401|404|422|500/);
      expect(calls).toHaveLength(1);
    }
  });
});

describe("httpWithRetry — error text from GitFlic error bodies", () => {
  const failWith = (status, body) =>
    httpWithRetry("POST", "https://x.test/u", "tok", {}, {
      fetchImpl: mockFetch([fakeRes(status, body)]).fn,
      retryDelay: 1,
    });

  // Real shape of a 404 from POST …/merge-request/1/discussions/create on a fork MR.
  it("names the exception when type/title/detail are untranslated i18n keys", async () => {
    await expect(
      failWith(404, {
        type: "com.gitflic.core.exception.BranchNotFoundException.type",
        title: "com.gitflic.core.exception.BranchNotFoundException.title",
        status: 404,
        detail: "com.gitflic.core.exception.BranchNotFoundException.detail",
      }),
    ).rejects.toThrow(/HTTP 404 .* — BranchNotFoundException\n/);
  });

  it("lists the invalid fields of a 422 validation error", async () => {
    await expect(
      failWith(422, {
        type: "org.springframework.web.bind.MethodArgumentNotValidException.type",
        title: "Ошибка валидации",
        status: 422,
        errors: [{ field: "message", message: "Поле не может быть пустым" }],
      }),
    ).rejects.toThrow(/Ошибка валидации \(message: Поле не может быть пустым\)/);
  });

  it("keeps preferring message, then error", async () => {
    await expect(failWith(400, { message: "boom", title: "ignored" })).rejects.toThrow(/— boom\n/);
    await expect(failWith(405, { error: "Method Not Allowed", path: "/x" })).rejects.toThrow(/— Method Not Allowed\n/);
  });

  it("falls back to the status text for an empty body", async () => {
    await expect(failWith(500, null)).rejects.toThrow(/HTTP 500 Err — Err\n/);
  });
});

describe("httpWithRetry — Retry-After", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("honors Retry-After as integer seconds", async () => {
    const { fn } = mockFetch([
      fakeRes(429, null, { "retry-after": "2" }),
      fakeRes(200, {}),
    ]);
    const start = Date.now();
    const p = httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      retryDelay: 1,
    });
    // First call fires immediately.
    await Promise.resolve();
    // Advance 2s to satisfy Retry-After.
    await vi.advanceTimersByTimeAsync(2000);
    const r = await p;
    expect(r).toEqual({});
  });

  it("honors Retry-After as HTTP-date", async () => {
    const future = new Date(Date.now() + 1500).toUTCString();
    const { fn } = mockFetch([
      fakeRes(503, null, { "retry-after": future }),
      fakeRes(200, {}),
    ]);
    const p = httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      retryDelay: 1,
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
    const r = await p;
    expect(r).toEqual({});
  });
});

describe("httpWithRetry — retry exhaustion", () => {
  it("dies after retries are exhausted on 429", async () => {
    const { fn, calls } = mockFetch([
      fakeRes(429),
      fakeRes(429),
      fakeRes(429),
      fakeRes(429),
    ]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
        retries: 3,
      }),
    ).rejects.toThrow(/HTTP 429/);
    // retries=3 -> 4 total attempts
    expect(calls).toHaveLength(4);
  });

  it("retries=0 means a single attempt (no retry)", async () => {
    const { fn, calls } = mockFetch([fakeRes(429)]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
        retries: 0,
      }),
    ).rejects.toThrow(/HTTP 429/);
    expect(calls).toHaveLength(1);
  });

  it("enabled=false disables retry even with retries>0", async () => {
    const { fn, calls } = mockFetch([fakeRes(503)]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
        retries: 5,
        enabled: false,
      }),
    ).rejects.toThrow(/HTTP 503/);
    expect(calls).toHaveLength(1);
  });
});

describe("httpWithRetry — network errors", () => {
  it("retries on network error then succeeds", async () => {
    const { fn, calls } = mockFetch([
      new Error("ECONNRESET"),
      fakeRes(200, { ok: true }),
    ]);
    const onRetry = vi.fn();
    const r = await httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
      fetchImpl: fn,
      onRetry,
      retryDelay: 1,
      retries: 3,
    });
    expect(r).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "network" }),
    );
  });

  it("dies after network error retries are exhausted", async () => {
    const { fn, calls } = mockFetch([
      new Error("EAI_AGAIN"),
      new Error("EAI_AGAIN"),
      new Error("EAI_AGAIN"),
      new Error("EAI_AGAIN"),
    ]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
        retries: 3,
      }),
    ).rejects.toThrow(/network error after 4 attempt/);
    expect(calls).toHaveLength(4);
  });
});

describe("httpWithRetry — error detail extraction", () => {
  it("includes JSON .message in the die error", async () => {
    const { fn } = mockFetch([fakeRes(404, { message: "Project not found" })]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
      }),
    ).rejects.toThrow(/Project not found/);
  });

  it("falls back to statusText when body is not JSON", async () => {
    const { fn } = mockFetch([fakeRes(500, "plain text body")]);
    await expect(
      httpWithRetry("GET", "https://x.test/u", "tok", undefined, {
        fetchImpl: fn,
        retryDelay: 1,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});

describe("defaultRetryOptions", () => {
  it("reads GITFLIC_HTTP_RETRIES and GITFLIC_HTTP_RETRY_DELAY", () => {
    const prevR = process.env.GITFLIC_HTTP_RETRIES;
    const prevD = process.env.GITFLIC_HTTP_RETRY_DELAY;
    const prevE = process.env.GITFLIC_NO_RETRY;
    try {
      process.env.GITFLIC_HTTP_RETRIES = "5";
      process.env.GITFLIC_HTTP_RETRY_DELAY = "250";
      delete process.env.GITFLIC_NO_RETRY;
      const o = defaultRetryOptions();
      expect(o.retries).toBe(5);
      expect(o.retryDelay).toBe(250);
      expect(o.enabled).toBe(true);
    } finally {
      if (prevR === undefined) delete process.env.GITFLIC_HTTP_RETRIES;
      else process.env.GITFLIC_HTTP_RETRIES = prevR;
      if (prevD === undefined) delete process.env.GITFLIC_HTTP_RETRY_DELAY;
      else process.env.GITFLIC_HTTP_RETRY_DELAY = prevD;
      if (prevE === undefined) delete process.env.GITFLIC_NO_RETRY;
      else process.env.GITFLIC_NO_RETRY = prevE;
    }
  });

  it("GITFLIC_NO_RETRY=1 disables", () => {
    const prev = process.env.GITFLIC_NO_RETRY;
    try {
      process.env.GITFLIC_NO_RETRY = "1";
      expect(defaultRetryOptions().enabled).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.GITFLIC_NO_RETRY;
      else process.env.GITFLIC_NO_RETRY = prev;
    }
  });
});
