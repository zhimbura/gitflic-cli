import { describe, it, expect } from "vitest";
import { buildProtectionEditBody } from "../cmd/branch.mjs";
import { buildOauthEditBody } from "../cmd/settings.mjs";

// Same data-loss class as the issue-edit bug: GitFlic PUT replaces the whole
// object, so a partial edit must merge onto the current entity, not send only
// the changed fields.

describe("buildProtectionEditBody — merge, don't clobber", () => {
  const cur = {
    branchTemplate: "main",
    allowedToPush: "MAINTAINER",
    allowedToMerge: "DEVELOPER",
    allowForcePush: false,
    codeOwnerApprovalRequired: true,
    autoMergeByDefault: false,
  };

  it("editing one field preserves all the others", () => {
    const body = buildProtectionEditBody(cur, { "auto-merge": "true" });
    expect(body).toEqual({
      branchTemplate: "main",
      allowedToPush: "MAINTAINER",
      allowedToMerge: "DEVELOPER",
      allowForcePush: false,
      codeOwnerApprovalRequired: true,
      autoMergeByDefault: true, // only this changed
    });
  });

  it("overrides allowedToPush when passed, keeps branchTemplate", () => {
    const body = buildProtectionEditBody(cur, { "allowed-to-push": "NO_ONE" });
    expect(body.allowedToPush).toBe("NO_ONE");
    expect(body.branchTemplate).toBe("main"); // not wiped
    expect(body.codeOwnerApprovalRequired).toBe(true);
  });

  it("boolean flags accept true/false strings", () => {
    expect(buildProtectionEditBody(cur, { "code-owner-approval": "false" }).codeOwnerApprovalRequired).toBe(false);
    expect(buildProtectionEditBody(cur, { force: true }).allowForcePush).toBe(true);
  });
});

describe("buildOauthEditBody — merge, don't clobber", () => {
  const cur = {
    name: "My App",
    description: "An app",
    homepageUrl: "https://app.example",
    authCallbackUrl: "https://app.example/cb",
    standalone: true,
  };

  it("editing only the homepage preserves name/description/callback/standalone", () => {
    const body = buildOauthEditBody(cur, { homepage: "https://new.example" });
    expect(body).toEqual({
      name: "My App",
      description: "An app",
      homepageUrl: "https://new.example",
      authCallbackUrl: "https://app.example/cb",
      standalone: true,
    });
  });

  it("name is no longer mandatory — preserved from current when omitted", () => {
    expect(buildOauthEditBody(cur, { description: "changed" }).name).toBe("My App");
  });
});
