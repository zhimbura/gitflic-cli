import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";
import { resolveProjectArg } from "../project-resolver.mjs";

function mockGit({ remoteUrl = null, status = 0 } = {}) {
  spawnSync.mockImplementation((_cmd, args) => {
    if (args[0] === "config" && args[1] === "--get" && args[2] === "remote.origin.url") {
      return {
        status,
        stdout: remoteUrl ?? "",
        stderr: "",
      };
    }
    return { status: 1, stdout: "", stderr: "not mocked" };
  });
}

describe("resolveProjectArg", () => {
  let prevEnv;

  beforeEach(() => {
    prevEnv = process.env.GITFLIC_PROJECT;
    delete process.env.GITFLIC_PROJECT;
    spawnSync.mockReset();
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.GITFLIC_PROJECT;
    else process.env.GITFLIC_PROJECT = prevEnv;
  });

  it("returns args unchanged when project is already set", () => {
    expect(resolveProjectArg({ project: "owner/alias" })).toEqual({
      project: "owner/alias",
    });
  });

  it("ignores empty-string project", () => {
    expect(resolveProjectArg({ project: "" })).toEqual({ project: "" });
    // (handler/CI side is expected to reject this; we don't auto-fallback)
  });

  it("uses GITFLIC_PROJECT env when project is missing", () => {
    process.env.GITFLIC_PROJECT = "fromenv/proj";
    expect(resolveProjectArg({})).toEqual({ project: "fromenv/proj" });
  });

  it("prefers args.project over env", () => {
    process.env.GITFLIC_PROJECT = "fromenv/proj";
    expect(resolveProjectArg({ project: "fromargs/proj" })).toEqual({
      project: "fromargs/proj",
    });
  });

  it("falls back to git remote (ssh form)", () => {
    mockGit({ remoteUrl: "git@gitflic.ru:owner/alias.git" });
    expect(resolveProjectArg({})).toEqual({ project: "owner/alias" });
  });

  it("falls back to git remote (ssh:// form)", () => {
    mockGit({ remoteUrl: "ssh://git@gitflic.ru:22/owner/alias.git" });
    expect(resolveProjectArg({})).toEqual({ project: "owner/alias" });
  });

  it("falls back to git remote (https form)", () => {
    mockGit({ remoteUrl: "https://gitflic.ru/owner/alias.git" });
    expect(resolveProjectArg({})).toEqual({ project: "owner/alias" });
  });

  it("falls back to git remote (self-hosted, generic path)", () => {
    mockGit({ remoteUrl: "https://git.example.com/owner/alias.git" });
    expect(resolveProjectArg({})).toEqual({ project: "owner/alias" });
  });

  it("returns args unchanged if no env and no usable remote", () => {
    mockGit({ remoteUrl: null, status: 1 });
    expect(resolveProjectArg({})).toEqual({});
  });

  it("preserves other args fields when auto-resolving", () => {
    process.env.GITFLIC_PROJECT = "from/env";
    expect(resolveProjectArg({ page: 2, size: 10 })).toEqual({
      page: 2,
      size: 10,
      project: "from/env",
    });
  });
});
