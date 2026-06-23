import { describe, it, expect } from "vitest";
import { TOOLS } from "../tools.mjs";
import { selectTools, toolGroup, groupsOf, isReadOnly } from "../filter.mjs";

describe("toolGroup", () => {
  it("derives the group from the name prefix", () => {
    expect(toolGroup("gitflic_mr_create")).toBe("mr");
    expect(toolGroup("gitflic_branch_protection_list")).toBe("branch");
    expect(toolGroup("gitflic_project_list_my")).toBe("project");
    expect(toolGroup("gitflic_auth")).toBe("auth");
  });
});

describe("groupsOf", () => {
  it("returns the 11 catalog groups, sorted", () => {
    expect(groupsOf(TOOLS)).toEqual([
      "auth",
      "blob",
      "branch",
      "commit",
      "issue",
      "mr",
      "project",
      "release",
      "tag",
      "user",
      "webhook",
    ]);
  });
});

describe("selectTools — default", () => {
  it("registers every tool when no env is set", () => {
    const { selected, warnings } = selectTools(TOOLS, {});
    expect(selected.length).toBe(TOOLS.length);
    expect(warnings).toEqual([]);
  });

  it("treats falsey/empty values as unset", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "",
      GITFLIC_MCP_READONLY: "0",
      GITFLIC_MCP_TOOLS: "",
      GITFLIC_MCP_EXCLUDE: "",
    });
    expect(selected.length).toBe(TOOLS.length);
  });
});

describe("selectTools — GROUPS", () => {
  it("keeps only the named group", () => {
    const { selected } = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr" });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((t) => t.name.startsWith("gitflic_mr_"))).toBe(true);
  });

  it("accepts comma + whitespace separators and is case-insensitive", () => {
    const a = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr,issue" }).selected.length;
    const b = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: " MR  Issue " }).selected.length;
    const mr = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr" }).selected.length;
    const issue = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "issue" }).selected.length;
    expect(a).toBe(mr + issue);
    expect(b).toBe(a);
  });

  it("warns on an unknown group but still selects the valid ones", () => {
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "mr,nope",
    });
    expect(selected.every((t) => t.name.startsWith("gitflic_mr_"))).toBe(true);
    expect(warnings.some((w) => w.includes('"nope"'))).toBe(true);
  });

  it("warns (empty result) when no group matches", () => {
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "nope",
    });
    expect(selected.length).toBe(0);
    expect(warnings.some((w) => w.includes("0 tools"))).toBe(true);
  });
});

describe("selectTools — READONLY", () => {
  it("keeps only read-only tools", () => {
    const { selected } = selectTools(TOOLS, { GITFLIC_MCP_READONLY: "1" });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every(isReadOnly)).toBe(true);
    // It must not be the whole catalog (there are write tools too).
    expect(selected.length).toBeLessThan(TOOLS.length);
  });

  it("accepts true/yes/on as truthy", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on"]) {
      const { selected } = selectTools(TOOLS, { GITFLIC_MCP_READONLY: v });
      expect(selected.every(isReadOnly)).toBe(true);
    }
  });

  it("treats 0/false/garbage as off", () => {
    for (const v of ["0", "false", "no", "off", "nope"]) {
      const { selected } = selectTools(TOOLS, { GITFLIC_MCP_READONLY: v });
      expect(selected.length).toBe(TOOLS.length);
    }
  });

  it("composes with GROUPS (intersection)", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "mr",
      GITFLIC_MCP_READONLY: "1",
    });
    expect(selected.every((t) => t.name.startsWith("gitflic_mr_") && isReadOnly(t))).toBe(true);
    expect(selected.length).toBeGreaterThan(0);
  });
});

describe("selectTools — TOOLS allowlist", () => {
  it("selects exactly the named tools", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_TOOLS: "gitflic_auth,gitflic_mr_list",
    });
    expect(selected.map((t) => t.name).sort()).toEqual([
      "gitflic_auth",
      "gitflic_mr_list",
    ]);
  });

  it("overrides GROUPS and warns", () => {
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_TOOLS: "gitflic_auth",
      GITFLIC_MCP_GROUPS: "mr",
    });
    expect(selected.map((t) => t.name)).toEqual(["gitflic_auth"]);
    expect(warnings.some((w) => w.includes("GITFLIC_MCP_GROUPS is ignored"))).toBe(true);
  });

  it("warns on unknown tool names", () => {
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_TOOLS: "gitflic_auth,gitflic_nope",
    });
    expect(selected.map((t) => t.name)).toEqual(["gitflic_auth"]);
    expect(warnings.some((w) => w.includes('"gitflic_nope"'))).toBe(true);
  });
});

describe("selectTools — EXCLUDE", () => {
  it("drops named tools last (always wins)", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "mr",
      GITFLIC_MCP_EXCLUDE: "gitflic_mr_merge,gitflic_mr_close",
    });
    const names = selected.map((t) => t.name);
    expect(names).not.toContain("gitflic_mr_merge");
    expect(names).not.toContain("gitflic_mr_close");
    expect(names).toContain("gitflic_mr_list");
  });

  it("warns on unknown excluded names", () => {
    const { warnings } = selectTools(TOOLS, { GITFLIC_MCP_EXCLUDE: "gitflic_nope" });
    expect(warnings.some((w) => w.includes('"gitflic_nope"'))).toBe(true);
  });
});

describe("selectTools — interactions & safety", () => {
  it("READONLY drops a write tool even when explicitly allowlisted (cannot leak a write)", () => {
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_TOOLS: "gitflic_mr_merge",
      GITFLIC_MCP_READONLY: "1",
    });
    expect(selected).toEqual([]);
    expect(warnings.some((w) => w.includes("READONLY removed"))).toBe(true);
  });

  it("READONLY composes with EXCLUDE", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_READONLY: "1",
      GITFLIC_MCP_EXCLUDE: "gitflic_mr_list",
    });
    expect(selected.every(isReadOnly)).toBe(true);
    expect(selected.map((t) => t.name)).not.toContain("gitflic_mr_list");
    expect(selected.map((t) => t.name)).toContain("gitflic_mr_view");
  });

  it("matches TOOLS case-insensitively", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_TOOLS: "GITFLIC_MR_LIST,Gitflic_Auth",
    });
    expect(selected.map((t) => t.name).sort()).toEqual([
      "gitflic_auth",
      "gitflic_mr_list",
    ]);
  });

  it("matches EXCLUDE case-insensitively (a mis-cased exclude still removes the tool)", () => {
    const { selected } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "mr",
      GITFLIC_MCP_EXCLUDE: "GITFLIC_MR_MERGE",
    });
    expect(selected.map((t) => t.name)).not.toContain("gitflic_mr_merge");
  });

  it("dedupes repeated groups and tool names", () => {
    const g = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr,mr" });
    const gOnce = selectTools(TOOLS, { GITFLIC_MCP_GROUPS: "mr" });
    expect(g.selected.length).toBe(gOnce.selected.length);
    const t = selectTools(TOOLS, { GITFLIC_MCP_TOOLS: "gitflic_auth,gitflic_auth" });
    expect(t.selected.map((x) => x.name)).toEqual(["gitflic_auth"]);
  });

  it("warns and stays OFF on an unrecognized READONLY value", () => {
    const { selected, warnings } = selectTools(TOOLS, { GITFLIC_MCP_READONLY: "enabled" });
    expect(selected.length).toBe(TOOLS.length);
    expect(warnings.some((w) => w.includes("not a recognized boolean"))).toBe(true);
  });

  it("warns when EXCLUDE empties the set", () => {
    const onlyAuthReads = TOOLS.filter(
      (t) => t.name.startsWith("gitflic_auth") && isReadOnly(t),
    ).map((t) => t.name);
    const { selected, warnings } = selectTools(TOOLS, {
      GITFLIC_MCP_GROUPS: "auth",
      GITFLIC_MCP_READONLY: "1",
      GITFLIC_MCP_EXCLUDE: onlyAuthReads.join(","),
    });
    expect(selected.length).toBe(0);
    expect(warnings.some((w) => w.includes("0 tools"))).toBe(true);
  });
});
