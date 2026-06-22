import { describe, it, expect } from "vitest";
import { TOOLS, TOOL_NAMES } from "../tools.mjs";

describe("TOOLS catalog", () => {
  it("exports an array of tools", () => {
    expect(Array.isArray(TOOLS)).toBe(true);
    expect(TOOLS.length).toBeGreaterThan(20);
  });

  it("every tool has name, description, inputSchema, handler", () => {
    for (const t of TOOLS) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe("object");
      expect(typeof t.handler).toBe("function");
    }
  });

  it("every tool name is unique", () => {
    const set = new Set();
    for (const t of TOOLS) {
      expect(set.has(t.name)).toBe(false);
      set.add(t.name);
    }
  });

  it("all tool names are namespaced with 'gitflic_'", () => {
    for (const t of TOOLS) {
      expect(t.name.startsWith("gitflic_")).toBe(true);
    }
  });

  it("TOOL_NAMES matches TOOLS", () => {
    expect(TOOL_NAMES).toEqual(TOOLS.map((t) => t.name));
  });

  it("required fields are present in properties", () => {
    for (const t of TOOLS) {
      const required = t.inputSchema.required || [];
      const props = Object.keys(t.inputSchema.properties || {});
      for (const r of required) {
        expect(props).toContain(r);
      }
    }
  });

  it("every handler returns an array (CLI argv)", () => {
    for (const t of TOOLS) {
      // Construct a minimal valid args object from the required fields.
      const args = {};
      for (const k of t.inputSchema.required || []) {
        args[k] = k === "project" ? "o/a" : k === "id" ? "42" : k === "uuid" ? "u-1" : k === "hash" ? "abc" : k === "path" ? "/p" : k === "url" ? "https://x" : k === "title" ? "T" : k === "alias" ? "a" : k === "userAlias" ? "u" : k === "role" ? "DEVELOPER" : k === "branchTemplate" ? "main" : k === "allowedToPush" ? "NO_ONE" : k === "allowedToMerge" ? "DEVELOPER" : k === "message" ? "m" : k === "commentId" ? "c" : k === "newBranch" ? "feat" : k === "name" ? "n" : k === "q" ? "q" : "x";
      }
      const out = t.handler(args);
      expect(Array.isArray(out)).toBe(true);
    }
  });
});

describe("key tools exist", () => {
  it("has high-value tools we want to keep", () => {
    const want = [
      "gitflic_auth",
      "gitflic_mr_list",
      "gitflic_mr_create",
      "gitflic_mr_edit",
      "gitflic_mr_cancel",
      "gitflic_issue_create",
      "gitflic_issue_close",
      "gitflic_issue_reopen",
      "gitflic_issue_comments_list",
      "gitflic_branch_protection_list",
      "gitflic_branch_protection_create",
      "gitflic_release_get",
      "gitflic_release_latest",
      "gitflic_release_delete",
      "gitflic_webhook_create",
      "gitflic_project_get",
      "gitflic_project_create",
      "gitflic_project_member_list",
      "gitflic_blob_get",
      "gitflic_user_me",
    ];
    for (const n of want) {
      expect(TOOL_NAMES).toContain(n);
    }
  });
});
