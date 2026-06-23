import { describe, it, expect } from "vitest";
import { buildIssueEditBody } from "../cmd/issue.mjs";

// Regression: `issue close`/`reopen` (and partial `edit`) used to send
// title/description as "stub", wiping them because GitFlic's PUT replaces the
// whole issue. buildIssueEditBody must merge onto the current issue.
const current = {
  title: "Real title",
  description: "Real description",
  status: { id: "OPEN", title: "Новая" },
  assignedUsers: [{ id: "u1", username: "alice" }],
  labels: [{ id: "l1", title: "Security" }],
};

describe("buildIssueEditBody — merge, don't clobber", () => {
  it("close (status only) preserves title/description/assignees/labels", () => {
    const body = buildIssueEditBody(current, { status: "CLOSED" });
    expect(body.title).toBe("Real title");
    expect(body.description).toBe("Real description");
    expect(body.status).toEqual({ id: "CLOSED" });
    expect(body.assignedUsers).toEqual([{ id: "u1" }]);
    expect(body.labels).toEqual([{ id: "l1" }]);
  });

  it("never emits the old 'stub' sentinel", () => {
    const body = buildIssueEditBody(current, { status: "CLOSED" });
    expect(JSON.stringify(body)).not.toContain("stub");
  });

  it("partial edit changes only what's passed", () => {
    const body = buildIssueEditBody(current, { title: "New title" });
    expect(body.title).toBe("New title");
    expect(body.description).toBe("Real description"); // preserved
    expect(body.status).toEqual({ id: "OPEN" }); // preserved from current
  });

  it("--assign-to / --label override; otherwise current is kept", () => {
    const reassigned = buildIssueEditBody(current, { "assign-to": "u2" });
    expect(reassigned.assignedUsers).toEqual([{ id: "u2" }]);
    const relabeled = buildIssueEditBody(current, { label: "l2" });
    expect(relabeled.labels).toEqual([{ id: "l2" }]);
  });

  it("ignores an invalid status, falling back to the current one", () => {
    const body = buildIssueEditBody(current, { status: "BOGUS" });
    expect(body.status).toEqual({ id: "OPEN" });
  });

  it("handles a current issue with no assignees/labels", () => {
    const body = buildIssueEditBody({ title: "T", description: "D", status: { id: "OPEN" } }, { status: "COMPLETED" });
    expect(body.assignedUsers).toEqual([]);
    expect(body.labels).toBeUndefined();
    expect(body.status).toEqual({ id: "COMPLETED" });
  });
});
