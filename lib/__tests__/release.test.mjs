import { describe, it, expect } from "vitest";
import { buildCreateBody, buildEditBody } from "../cmd/release.mjs";

describe("buildCreateBody", () => {
  it("ALWAYS includes preRelease (default false) — GitFlic 500s without it", () => {
    const body = buildCreateBody({ title: "x" });
    expect(body).toHaveProperty("preRelease", false);
    expect(body.title).toBe("x");
  });

  it("sets preRelease:true with --pre-release", () => {
    expect(buildCreateBody({ title: "x", "pre-release": true }).preRelease).toBe(true);
  });

  it("maps description and --tag → tagName", () => {
    const body = buildCreateBody({ title: "T", description: "D", tag: "v1.0" });
    expect(body).toEqual({ title: "T", description: "D", tagName: "v1.0", preRelease: false });
  });

  it("handles --attach-archive + --archive-format", () => {
    const body = buildCreateBody({ title: "T", "attach-archive": true, "archive-format": "zip" });
    expect(body.attachProjectArchive).toBe(true);
    expect(body.projectArchiveFormat).toBe("zip");
  });
});

describe("buildEditBody", () => {
  const current = { title: "old", description: "d", tagName: "v1", preRelease: true };

  it("merges changes onto current, preserving untouched fields (incl. preRelease)", () => {
    const body = buildEditBody({ title: "new" }, current);
    expect(body).toEqual({ title: "new", description: "d", tagName: "v1", preRelease: true });
  });

  it("with no flags re-sends the current full object (PUT requires all fields)", () => {
    expect(buildEditBody({}, current)).toEqual({
      title: "old",
      description: "d",
      tagName: "v1",
      preRelease: true,
    });
  });

  it("overrides preRelease when --pre-release is given", () => {
    expect(buildEditBody({ "pre-release": "false" }, current).preRelease).toBe(false);
    expect(buildEditBody({ "pre-release": "true" }, { ...current, preRelease: false }).preRelease).toBe(true);
  });

  it("allows clearing description to empty string explicitly", () => {
    expect(buildEditBody({ description: "" }, current).description).toBe("");
  });
});
