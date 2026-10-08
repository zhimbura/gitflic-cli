import { describe, it, expect } from "vitest";
import { __test__ } from "../tui.mjs";

const { formatMrRow } = __test__;

describe("formatMrRow", () => {
  it("formats a complete MR object", () => {
    const row = formatMrRow({
      localId: 42,
      status: { id: "OPENED" },
      sourceBranch: { alias: "feat/x" },
      targetBranch: { alias: "main" },
      title: "Add feature",
    }, 100);
    expect(row).toContain("42");
    expect(row).toContain("OPENED");
    expect(row).toContain("feat/x");
    expect(row).toContain("main");
    expect(row).toContain("Add feature");
    expect(row).toContain("→");
  });

  it("shows branch names, not the commit hash GitFlic puts in alias", () => {
    const row = formatMrRow({
      localId: 1,
      status: { id: "OPENED" },
      sourceBranch: { id: "windows_config_store", alias: "83958910f4cc32eabe0e9309c573fe973b367b7a" },
      targetBranch: { id: "main", alias: "ba415efa4b569c1f09c2ddaf8caa884e1874372d" },
      title: "t",
    }, 100);
    expect(row).toContain("windows_config_store");
    expect(row).toContain("main");
    expect(row).not.toContain("83958910");
  });

  it("handles missing fields", () => {
    const row = formatMrRow({}, 100);
    expect(row).toContain("?");
    expect(row).toContain("→");
  });

  it("truncates long titles to width", () => {
    const row = formatMrRow({
      localId: 1,
      status: { id: "OPEN" },
      title: "A".repeat(200),
    }, 80);
    // title should be truncated — overall line is short
    expect(row.length).toBeLessThan(200);
  });

  it("pads short titles/branches to alignment", () => {
    const row = formatMrRow({
      localId: 1,
      status: { id: "X" },
      sourceBranch: { alias: "a" },
      targetBranch: { alias: "b" },
      title: "t",
    }, 100);
    // Should have multiple consecutive spaces from padding
    expect(row).toMatch(/a +→ +b/);
  });
});
