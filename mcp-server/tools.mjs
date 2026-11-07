// Tool definitions for the GitFlic MCP server.
// Every tool is a thin wrapper around the gitflic CLI — see lib/cmd/*.mjs.

export const TOOLS = [
  // ===== meta ============================================================
  {
    name: "gitflic_auth",
    description:
      "Check authentication: returns the current authenticated user (id, username, email, fullName). Use this first to verify the token works.",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["auth"],
    annotations: {
      title: "Auth",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  // ===== auth: multi-account + per-project bindings =====================
  {
    name: "gitflic_auth_login",
    description:
      "Validate a GitFlic API token against /user/me, then store it in the OS keychain (macOS Keychain / Linux libsecret) or chmod-0600 file. Refuses to store an invalid token. Use --as <name> to store under a named account; --stdin to read the token from stdin.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "API token (else read from stdin if stdin=true)" },
        stdin: { type: "boolean", description: "Read token from stdin" },
        as: { type: "string", description: "Named account (e.g. 'work', 'personal')" },
        apiBase: { type: "string", description: "Override API base (for self-hosted)" },
      },
    },
    handler: (a) => {
      const args = ["auth", "login"];
      if (a.token) args.push("--token", a.token);
      if (a.stdin) args.push("--stdin");
      if (a.as) args.push("--as", a.as);
      if (a.apiBase) args.push("--api-base", a.apiBase);
      return args;
    },
    annotations: {
      title: "Auth Login",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_logout",
    description:
      "Remove a stored token. Default removes the active account. Pass --as <name> to remove a specific named account. Pass --all to remove every token (and all per-project bindings).",
    inputSchema: {
      type: "object",
      properties: {
        as: { type: "string", description: "Remove only token:<name>" },
        all: { type: "boolean", description: "Remove every account + binding" },
      },
    },
    handler: (a) => {
      const args = ["auth", "logout"];
      if (a.as) args.push("--as", a.as);
      if (a.all) args.push("--all");
      return args;
    },
    annotations: {
      title: "Auth Logout",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_list",
    description:
      "List all known accounts (default + named) with masked token values. Marks the active account with '*'. Use before switching or binding to confirm available identities.",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["auth", "list"],
    annotations: {
      title: "Auth List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_switch",
    description:
      "Make <name> the active account. Subsequent tool calls without a per-project binding resolve to this account's token. Refuses if no token is stored for the named account.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Account name to activate" },
      },
    },
    handler: (a) => ["auth", "switch", a.name],
    annotations: {
      title: "Auth Switch",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_bind",
    description:
      "Bind <project> (owner/alias) to <account>. All subsequent commands scoped to that project resolve to <account>'s token, overriding the active account. Refuses if <account> has no token stored. Use to route different repos to different identities (work vs personal).",
    inputSchema: {
      type: "object",
      required: ["project", "account"],
      properties: {
        project: { type: "string", description: "owner/alias, e.g. 'FerdBur/wave'" },
        account: { type: "string", description: "account name (must already exist via auth_login --as)" },
      },
    },
    handler: (a) => ["auth", "bind", a.project, a.account],
    annotations: {
      title: "Auth Bind",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_unbind",
    description: "Remove the binding for <project>. Falls back to active-account token resolution for that project afterwards.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string", description: "owner/alias to unbind" },
      },
    },
    handler: (a) => ["auth", "unbind", a.project],
    annotations: {
      title: "Auth Unbind",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_auth_bindings",
    description: "List all current project → account bindings. Sorted alphabetically by project.",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["auth", "bindings"],
    annotations: {
      title: "Auth Bindings",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "gitflic_project_resolve",
    description:
      "Resolve a project owner/alias to its UUID + defaultBranch. Cached locally; needed before most other calls.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string", description: "owner/alias, e.g. 'tikhon/wave'" },
      },
    },
    handler: (args) => ["project", "get", args.project],
    annotations: {
      title: "Project Resolve",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== merge requests ===================================================
  {
    name: "gitflic_mr_list",
    description: "List merge requests in a project. Returns array with localId, title, status, author, source/target branches.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        page: { type: "number", description: "0-based page index" },
        size: { type: "number", description: "Page size, default 10" },
      },
    },
    handler: (a) => ["mr", "list", "--project", a.project, "--format", "json", a.page !== undefined ? ["--page", String(a.page)] : [], a.size !== undefined ? ["--size", String(a.size)] : []].flat(),
    annotations: {
      title: "Mr List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_view",
    description: "Get one merge request by its localId. Returns full MR object including description, status, conflicts, canMerge.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: {
        project: { type: "string" },
        id: { type: "string", description: "localId (e.g. '42')" },
      },
    },
    handler: (a) => ["mr", "view", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr View",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_diff",
    description: "Get the file-level diff for a merge request (hunks + per-line annotations).",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["mr", "diff", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Diff",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_create",
    description:
      "Create a new merge request. `description` is required (GitFlic rejects empty MR descriptions). If `from` is omitted, uses current git branch; if `to` is omitted, uses project default branch.",
    inputSchema: {
      type: "object",
      required: ["project", "title", "description"],
      properties: {
        project: { type: "string" },
        title: { type: "string" },
        description: { type: "string", description: "Markdown body" },
        from: { type: "string", description: "Source branch (default: current git branch)" },
        to: { type: "string", description: "Target branch (default: project default branch)" },
        squash: { type: "boolean", description: "Squash commits on merge" },
        removeBranch: { type: "boolean", description: "Remove source branch on merge (default true)" },
      },
    },
    handler: (a) => {
      const args = ["mr", "create", "--project", a.project, "--title", a.title, "--format", "json"];
      if (a.description) args.push("--description", a.description);
      if (a.from) args.push("--from", a.from);
      if (a.to) args.push("--to", a.to);
      if (a.squash) args.push("--squash");
      if (a.removeBranch === false) args.push("--no-remove-branch");
      return args;
    },
    annotations: {
      title: "Mr Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_approve",
    description: "Toggle approve on a merge request (calling twice removes the approval).",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["mr", "approve", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Approve",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_merge",
    description: "Merge a merge request. May fail with MergeCheckException if branch protection requires more approvals.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: {
        project: { type: "string" },
        id: { type: "string" },
        message: { type: "string", description: "Merge commit message" },
        squashMessage: { type: "string", description: "Squash commit message (if squash enabled)" },
      },
    },
    handler: (a) => {
      const args = ["mr", "merge", a.id, "--project", a.project, "--format", "json"];
      if (a.message) args.push("--message", a.message);
      if (a.squashMessage) args.push("--squash-message", a.squashMessage);
      return args;
    },
    annotations: {
      title: "Mr Merge",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_close",
    description: "Close a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["mr", "close", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Close",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_comment",
    description: "Add a comment to a merge request. For inline-anchored comments, pass new_path/new_line and old_path/old_line.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "message"],
      properties: {
        project: { type: "string" },
        id: { type: "string" },
        message: { type: "string" },
        newPath: { type: "string" },
        newLine: { type: "number" },
        oldPath: { type: "string" },
        oldLine: { type: "number" },
      },
    },
    handler: (a) => {
      const args = ["mr", "comment", a.id, a.message, "--project", a.project, "--format", "json"];
      if (a.newPath) args.push("--new-path", a.newPath);
      if (a.newLine !== undefined) args.push("--new-line", String(a.newLine));
      if (a.oldPath) args.push("--old-path", a.oldPath);
      if (a.oldLine !== undefined) args.push("--old-line", String(a.oldLine));
      return args;
    },
    annotations: {
      title: "Mr Comment",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_discuss_list",
    description: "List discussions (with replies) on a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["mr", "discuss", "list", a.id, "--project", a.project],
    annotations: {
      title: "Mr Discuss List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_discuss_reply",
    description: "Reply to a discussion thread on a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "discussionUuid", "message"],
      properties: {
        project: { type: "string" },
        id: { type: "string" },
        discussionUuid: { type: "string" },
        message: { type: "string" },
      },
    },
    handler: (a) => ["mr", "discuss", "reply", a.id, a.discussionUuid, a.message, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Discuss Reply",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_discuss_resolve",
    description: "Resolve a discussion thread on a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "discussionUuid"],
      properties: {
        project: { type: "string" },
        id: { type: "string" },
        discussionUuid: { type: "string" },
      },
    },
    handler: (a) => ["mr", "discuss", "resolve", a.id, a.discussionUuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Discuss Resolve",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== issues ===========================================================
  {
    name: "gitflic_issue_list",
    description: "List issues. Filter by --status if needed.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "CLOSED", "COMPLETED"] },
        page: { type: "number" },
        size: { type: "number" },
      },
    },
    handler: (a) => {
      const args = ["issue", "list", "--project", a.project, "--format", "json"];
      if (a.status) args.push("--status", a.status);
      if (a.page !== undefined) args.push("--page", String(a.page));
      if (a.size !== undefined) args.push("--size", String(a.size));
      return args;
    },
    annotations: {
      title: "Issue List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_view",
    description: "Get one issue by localId.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "view", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue View",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_create",
    description: "Create a new issue.",
    inputSchema: {
      type: "object",
      required: ["project", "title", "description"],
      properties: {
        project: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "CLOSED", "COMPLETED"], description: "default: OPEN" },
      },
    },
    handler: (a) => {
      const args = ["issue", "create", "--project", a.project, "--title", a.title, "--description", a.description, "--format", "json"];
      if (a.status) args.push("--status", a.status);
      return args;
    },
    annotations: {
      title: "Issue Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_close",
    description: "Close an issue (shortcut: edit with --status CLOSED).",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "close", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Close",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_comment",
    description: "Add a comment to an issue.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "message"],
      properties: { project: { type: "string" }, id: { type: "string" }, message: { type: "string" } },
    },
    handler: (a) => ["issue", "comments", "add", a.id, a.message, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Comment",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== branches / tags / releases ======================================
  {
    name: "gitflic_branch_list",
    description: "List branches in a project.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["branch", "list", "--project", a.project],
    annotations: {
      title: "Branch List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_create",
    description: "Create a new branch from an existing one.",
    inputSchema: {
      type: "object",
      required: ["project", "newBranch"],
      properties: {
        project: { type: "string" },
        newBranch: { type: "string" },
        from: { type: "string", description: "Origin branch (default: master)" },
      },
    },
    handler: (a) => {
      const args = ["branch", "create", a.newBranch, "--project", a.project, "--format", "json"];
      if (a.from) args.push("--from", a.from);
      return args;
    },
    annotations: {
      title: "Branch Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_delete",
    description: "Delete a branch.",
    inputSchema: {
      type: "object",
      required: ["project", "name"],
      properties: { project: { type: "string" }, name: { type: "string" } },
    },
    handler: (a) => ["branch", "delete", a.name, "--project", a.project],
    annotations: {
      title: "Branch Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_tag_list",
    description: "List tags.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["tag", "list", "--project", a.project],
    annotations: {
      title: "Tag List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_tag_create",
    description: "Create a new tag (lightweight or annotated).",
    inputSchema: {
      type: "object",
      required: ["project", "name"],
      properties: {
        project: { type: "string" },
        name: { type: "string" },
        branch: { type: "string", description: "Branch to tag (default: master)" },
        commit: { type: "string", description: "Commit hash to tag (overrides --branch)" },
        message: { type: "string", description: "Annotation message" },
      },
    },
    handler: (a) => {
      const args = ["tag", "create", a.name, "--project", a.project, "--format", "json"];
      if (a.commit) args.push("--commit", a.commit);
      else if (a.branch) args.push("--branch", a.branch);
      if (a.message) args.push("--message", a.message);
      return args;
    },
    annotations: {
      title: "Tag Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_release_list",
    description: "List releases.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["release", "list", "--project", a.project],
    annotations: {
      title: "Release List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_release_create",
    description: "Create a new release.",
    inputSchema: {
      type: "object",
      required: ["project", "title"],
      properties: {
        project: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        tag: { type: "string", description: "Tag name (e.g. v1.0.0)" },
        preRelease: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["release", "create", "--project", a.project, "--title", a.title, "--format", "json"];
      if (a.description) args.push("--description", a.description);
      if (a.tag) args.push("--tag", a.tag);
      if (a.preRelease) args.push("--pre-release");
      return args;
    },
    annotations: {
      title: "Release Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== commit / user ====================================================
  {
    name: "gitflic_commit_list",
    description: "List commits (default branch or --branch).",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        branch: { type: "string" },
      },
    },
    handler: (a) => {
      const args = ["commit", "list", "--project", a.project];
      if (a.branch) args.push("--branch", a.branch);
      return args;
    },
    annotations: {
      title: "Commit List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_user_me",
    description: "Get the current authenticated user (id, username, email, name, fullName).",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["user", "me", "--format", "json"],
    annotations: {
      title: "User Me",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_user_search",
    description: "Search users by username substring.",
    inputSchema: {
      type: "object",
      required: ["q"],
      properties: { q: { type: "string" } },
    },
    handler: (a) => ["user", "search", "--q", a.q, "--format", "json"],
    annotations: {
      title: "User Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== project admin ====================================================
  {
    name: "gitflic_project_list",
    description: "List accessible projects, including team projects. Defaults to scope shared; filter by owner alias.",
    inputSchema: { type: "object", properties: {
      scope: { type: "string", enum: ["public", "my", "shared"], description: "Default shared includes projects you participate in." },
      owner: { type: "string", description: "Owner alias, such as a team alias; used with scope shared." },
      q: { type: "string", description: "Project name filter." },
    } },
    handler: a => {
      const scope = a.scope || "shared";
      if (a.owner && scope !== "shared") throw new Error("owner filter requires scope shared");
      const argv = ["project", "list", "--scope", scope];
      if (a.owner) argv.push("--q-owner", a.owner);
      if (a.q) argv.push("--q", a.q);
      return argv;
    },
    annotations: { title: "Project List", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "gitflic_project_list_my",
    description: "List projects owned by the current user. Use gitflic_project_list with scope shared for team and member projects.",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["project", "list", "--scope", "my"],
    annotations: {
      title: "Project List My",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_webhook_list",
    description: "List webhooks for a project.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["webhook", "list", "--project", a.project],
    annotations: {
      title: "Webhook List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_protection_list",
    description: "List branch protection rules.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["branch", "protection", "list", "--project", a.project],
    annotations: {
      title: "Branch Protection List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== MR: edits / cancel / by-commit / discuss delete ==================
  {
    name: "gitflic_mr_edit",
    description: "Edit MR title/description/target. Source branch cannot change.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: {
        project: { type: "string" }, id: { type: "string" },
        title: { type: "string" }, description: { type: "string" },
        to: { type: "string" }, squash: { type: "boolean" },
        removeBranch: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["mr", "edit", a.id, "--project", a.project, "--format", "json"];
      if (a.title) args.push("--title", a.title);
      if (a.description !== undefined) args.push("--description", a.description);
      if (a.to) args.push("--to", a.to);
      if (a.squash) args.push("--squash");
      if (a.removeBranch === false) args.push("--no-remove-branch");
      return args;
    },
    annotations: {
      title: "Mr Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_cancel",
    description: "Cancel a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["mr", "cancel", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Cancel",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_by_commit",
    description: "Find MR(s) containing a specific commit hash. Optionally filter by status.",
    inputSchema: {
      type: "object",
      required: ["project", "hash"],
      properties: {
        project: { type: "string" },
        hash: { type: "string" },
        status: { type: "string", enum: ["OPENED", "MERGED", "CLOSED", "CANCELED", "FAILED"] },
      },
    },
    handler: (a) => {
      const args = ["mr", "by-commit", a.hash, "--project", a.project, "--format", "json"];
      if (a.status) args.push("--status", a.status);
      return args;
    },
    annotations: {
      title: "Mr By Commit",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_mr_discuss_delete",
    description: "Delete a discussion thread on a merge request.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "discussionUuid"],
      properties: { project: { type: "string" }, id: { type: "string" }, discussionUuid: { type: "string" } },
    },
    handler: (a) => ["mr", "discuss", "delete", a.id, a.discussionUuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Mr Discuss Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== Issue: edit / reopen / delete / comments / relations ============
  {
    name: "gitflic_issue_edit",
    description: "Edit an issue's title, description, status, assignee, or labels.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: {
        project: { type: "string" }, id: { type: "string" },
        title: { type: "string" }, description: { type: "string" },
        status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "CLOSED", "COMPLETED"] },
        assignTo: { type: "string", description: "user uuid" },
        label: { type: "string", description: "label uuid" },
      },
    },
    handler: (a) => {
      const args = ["issue", "edit", a.id, "--project", a.project, "--format", "json"];
      if (a.title) args.push("--title", a.title);
      if (a.description !== undefined) args.push("--description", a.description);
      if (a.status) args.push("--status", a.status);
      if (a.assignTo) args.push("--assign-to", a.assignTo);
      if (a.label) args.push("--label", a.label);
      return args;
    },
    annotations: {
      title: "Issue Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_reopen",
    description: "Reopen a closed issue.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "reopen", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Reopen",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_delete",
    description: "Delete an issue. Irreversible.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "delete", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_comments_list",
    description: "List comments on an issue.",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "comments", "list", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Comments List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_comments_edit",
    description: "Edit an existing issue comment.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "commentId", "message"],
      properties: {
        project: { type: "string" }, id: { type: "string" },
        commentId: { type: "string" }, message: { type: "string" },
      },
    },
    handler: (a) => ["issue", "comments", "edit", a.id, a.commentId, a.message, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Comments Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_comments_delete",
    description: "Delete an issue comment.",
    inputSchema: {
      type: "object",
      required: ["project", "id", "commentId"],
      properties: { project: { type: "string" }, id: { type: "string" }, commentId: { type: "string" } },
    },
    handler: (a) => ["issue", "comments", "delete", a.id, a.commentId, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Comments Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_issue_relations_list",
    description: "List issue relations (linked/related/blocks).",
    inputSchema: {
      type: "object",
      required: ["project", "id"],
      properties: { project: { type: "string" }, id: { type: "string" } },
    },
    handler: (a) => ["issue", "relations", "list", a.id, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Issue Relations List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== Branch: get / default / compare / protection CRUD ==============
  {
    name: "gitflic_branch_get",
    description: "Get a single branch by name.",
    inputSchema: {
      type: "object",
      required: ["project", "name"],
      properties: { project: { type: "string" }, name: { type: "string" } },
    },
    handler: (a) => ["branch", "get", a.name, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Branch Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_default",
    description: "Get the project's default branch.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["branch", "default", "--project", a.project, "--format", "json"],
    annotations: {
      title: "Branch Default",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_protection_get",
    description: "Get a branch-protection rule by uuid.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["branch", "protection", "get", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Branch Protection Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_protection_create",
    description: "Create a branch-protection rule.",
    inputSchema: {
      type: "object",
      required: ["project", "branchTemplate", "allowedToPush", "allowedToMerge"],
      properties: {
        project: { type: "string" },
        branchTemplate: { type: "string", description: "Branch pattern (e.g. master, release/*)" },
        allowedToPush: { type: "string", enum: ["NO_ONE", "DEVELOPER", "ADMINS"] },
        allowedToMerge: { type: "string", enum: ["NO_ONE", "DEVELOPER", "ADMINS"] },
        allowForcePush: { type: "boolean" },
        codeOwnerApproval: { type: "boolean" },
        autoMerge: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["branch", "protection", "create", "--project", a.project,
        "--branch-template", a.branchTemplate,
        "--allowed-to-push", a.allowedToPush,
        "--allowed-to-merge", a.allowedToMerge,
        "--format", "json"];
      if (a.allowForcePush) args.push("--allow-force-push");
      if (a.codeOwnerApproval) args.push("--code-owner-approval");
      if (a.autoMerge) args.push("--auto-merge");
      return args;
    },
    annotations: {
      title: "Branch Protection Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_protection_edit",
    description: "Edit a branch-protection rule.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: {
        project: { type: "string" }, uuid: { type: "string" },
        allowedToPush: { type: "string", enum: ["NO_ONE", "DEVELOPER", "ADMINS"] },
        allowedToMerge: { type: "string", enum: ["NO_ONE", "DEVELOPER", "ADMINS"] },
        allowForcePush: { type: "boolean" },
        codeOwnerApproval: { type: "boolean" },
        autoMerge: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["branch", "protection", "edit", a.uuid, "--project", a.project, "--format", "json"];
      if (a.allowedToPush) args.push("--allowed-to-push", a.allowedToPush);
      if (a.allowedToMerge) args.push("--allowed-to-merge", a.allowedToMerge);
      if (a.allowForcePush !== undefined) args.push("--allow-force-push", String(a.allowForcePush));
      if (a.codeOwnerApproval !== undefined) args.push("--code-owner-approval", String(a.codeOwnerApproval));
      if (a.autoMerge !== undefined) args.push("--auto-merge", String(a.autoMerge));
      return args;
    },
    annotations: {
      title: "Branch Protection Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_branch_protection_delete",
    description: "Delete a branch-protection rule.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["branch", "protection", "delete", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Branch Protection Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== Tag: get / protection CRUD ======================================
  {
    name: "gitflic_tag_get",
    description: "Get a tag by name. NOTE: GitFlic returns 400 for project-scoped tag get; prefer tag list.",
    inputSchema: {
      type: "object",
      required: ["project", "name"],
      properties: { project: { type: "string" }, name: { type: "string" } },
    },
    handler: (a) => ["tag", "get", a.name, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Tag Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== Release: get / latest / edit / delete ============================
  {
    name: "gitflic_release_get",
    description: "Get one release by uuid.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["release", "get", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Release Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_release_latest",
    description: "Get the most recent release.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["release", "latest", "--project", a.project, "--format", "json"],
    annotations: {
      title: "Release Latest",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_release_edit",
    description: "Edit release metadata.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: {
        project: { type: "string" }, uuid: { type: "string" },
        title: { type: "string" }, description: { type: "string" },
        tag: { type: "string" }, preRelease: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["release", "edit", a.uuid, "--project", a.project, "--format", "json"];
      if (a.title) args.push("--title", a.title);
      if (a.description !== undefined) args.push("--description", a.description);
      if (a.tag) args.push("--tag", a.tag);
      if (a.preRelease !== undefined) args.push("--pre-release", String(a.preRelease));
      return args;
    },
    annotations: {
      title: "Release Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_release_delete",
    description: "Delete a release.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["release", "delete", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Release Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== Commit: get / files / compare ===================================
  {
    name: "gitflic_commit_get",
    description: "Get one commit by hash.",
    inputSchema: {
      type: "object",
      required: ["project", "hash"],
      properties: { project: { type: "string" }, hash: { type: "string" } },
    },
    handler: (a) => ["commit", "get", a.hash, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Commit Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_commit_files",
    description: "List files touched by a commit.",
    inputSchema: {
      type: "object",
      required: ["project", "hash"],
      properties: { project: { type: "string" }, hash: { type: "string" } },
    },
    handler: (a) => ["commit", "files", a.hash, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Commit Files",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_commit_compare",
    description: "Compare two commits.",
    inputSchema: {
      type: "object",
      required: ["project", "source", "target"],
      properties: { project: { type: "string" }, source: { type: "string" }, target: { type: "string" } },
    },
    handler: (a) => ["commit", "compare", a.source, a.target, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Commit Compare",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== Webhook: get / create / delete ==================================
  {
    name: "gitflic_webhook_get",
    description: "Get one webhook by uuid.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["webhook", "get", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Webhook Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_webhook_create",
    description: "Create a webhook. Pass one or more event names.",
    inputSchema: {
      type: "object",
      required: ["project", "url"],
      properties: {
        project: { type: "string" },
        url: { type: "string" },
        event: { type: "string", description: "Event name (e.g. PUSH). Pass array for multiple." },
        active: { type: "boolean" },
      },
    },
    handler: (a) => {
      const args = ["webhook", "create", "--url", a.url, "--project", a.project, "--format", "json"];
      if (a.event) {
        const evs = Array.isArray(a.event) ? a.event : [a.event];
        for (const e of evs) args.push("--event", e);
      }
      if (a.active !== undefined) args.push("--active", String(a.active));
      return args;
    },
    annotations: {
      title: "Webhook Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_webhook_delete",
    description: "Delete a webhook by uuid.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["webhook", "delete", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Webhook Delete",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_webhook_reveal_secret",
    description:
      "Reveal the raw signing secret of a webhook. SENSITIVE: by default the MCP masks secrets (returns secretSet:true/false). This tool returns the actual secret value and is marked destructive so the MCP host prompts for approval before it runs. Use only when the user explicitly needs the secret value.",
    inputSchema: {
      type: "object",
      required: ["project", "uuid"],
      properties: { project: { type: "string" }, uuid: { type: "string" } },
    },
    handler: (a) => ["webhook", "get", a.uuid, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Webhook Reveal Secret",
      readOnlyHint: false, // not read-only on purpose: triggers the host approval prompt
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ===== Project: get / create / edit / member list =====================
  {
    name: "gitflic_project_get",
    description: "Resolve an owner/alias to its UUID + metadata.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["project", "get", a.project, "--format", "json"],
    annotations: {
      title: "Project Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_project_create",
    description: "Create a new project.",
    inputSchema: {
      type: "object",
      required: ["title", "alias"],
      properties: {
        title: { type: "string" },
        alias: { type: "string" },
        isPrivate: { type: "boolean" },
        language: { type: "string" },
        description: { type: "string" },
        ownerAlias: { type: "string" },
        ownerAliasType: { type: "string", enum: ["USER", "TEAM", "COMPANY"] },
      },
    },
    handler: (a) => {
      const args = ["project", "create", "--title", a.title, "--alias", a.alias, "--format", "json"];
      if (a.isPrivate) args.push("--private");
      if (a.language) args.push("--language", a.language);
      if (a.description) args.push("--description", a.description);
      if (a.ownerAlias) args.push("--owner-alias", a.ownerAlias);
      if (a.ownerAliasType) args.push("--owner-alias-type", a.ownerAliasType);
      return args;
    },
    annotations: {
      title: "Project Create",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_project_edit",
    description: "Edit project title, description, or language (via change-setting). Visibility and default branch are not editable over the REST API.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        language: { type: "string" },
      },
    },
    handler: (a) => {
      const args = ["project", "edit", a.project, "--format", "json"];
      if (a.title) args.push("--title", a.title);
      if (a.description !== undefined) args.push("--description", a.description);
      if (a.language) args.push("--language", a.language);
      return args;
    },
    annotations: {
      title: "Project Edit",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_project_member_list",
    description: "List project members.",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: { project: { type: "string" } },
    },
    handler: (a) => ["project", "member", "list", "--project", a.project, "--format", "json"],
    annotations: {
      title: "Project Member List",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_project_member_invite",
    description: "Invite a user to a project with a role.",
    inputSchema: {
      type: "object",
      required: ["project", "userAlias", "role"],
      properties: {
        project: { type: "string" },
        userAlias: { type: "string" },
        role: { type: "string", enum: ["GUEST", "REPORTER", "DEVELOPER", "MAINTAINER", "OWNER"] },
      },
    },
    handler: (a) => ["project", "member", "invite", a.userAlias, "--role", a.role, "--project", a.project, "--format", "json"],
    annotations: {
      title: "Project Member Invite",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== Blob / file: get / files / archive =============================
  {
    name: "gitflic_blob_get",
    description: "Get a file's text content. Binary files are base64-encoded by the server.",
    inputSchema: {
      type: "object",
      required: ["project", "path"],
      properties: {
        project: { type: "string" },
        path: { type: "string", description: "File path inside the repo, e.g. 'README.md'" },
        branch: { type: "string" },
        commit: { type: "string" },
      },
    },
    handler: (a) => {
      const args = ["blob", "get", a.path, "--project", a.project, "--format", "json"];
      if (a.branch) args.push("--branch", a.branch);
      if (a.commit) args.push("--commit", a.commit);
      return args;
    },
    annotations: {
      title: "Blob Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_blob_files",
    description: "List files in the repo (optionally under a sub-path).",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        path: { type: "string", description: "Sub-path, e.g. 'lib/cmd'" },
        branch: { type: "string" },
      },
    },
    handler: (a) => {
      const args = ["blob", "recursive", "--project", a.project, "--format", "json"];
      if (a.path) args.push("--directory", a.path);
      if (a.branch) args.push("--branch", a.branch);
      return args;
    },
    annotations: {
      title: "Blob Files",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ===== User: get / projects / followers =================================
  {
    name: "gitflic_user_get",
    description: "Get a user by alias.",
    inputSchema: {
      type: "object",
      required: ["alias"],
      properties: { alias: { type: "string" } },
    },
    handler: (a) => ["user", "get", a.alias, "--format", "json"],
    annotations: {
      title: "User Get",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_user_projects",
    description: "List public projects of a user.",
    inputSchema: {
      type: "object",
      required: ["alias"],
      properties: { alias: { type: "string" } },
    },
    handler: (a) => ["user", "projects", a.alias, "--format", "json"],
    annotations: {
      title: "User Projects",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "gitflic_user_followers",
    description: "List a user's followers.",
    inputSchema: {
      type: "object",
      required: ["alias"],
      properties: { alias: { type: "string" } },
    },
    handler: (a) => ["user", "followers", a.alias, "--format", "json"],
    annotations: {
      title: "User Followers",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];

// ===== issue #1: token-slimming support (applied uniformly, post-definition) =
// Kept here (not inline on every tool) so the surface is one DRY block.
//
//  - `raw`    : per-call escape hatch on EVERY tool — returns the full,
//               un-slimmed GitFlic response for that call (the slim layer in
//               slim.mjs honors it). Complements GITFLIC_MCP_RAW (global).
//  - `fields` : on read/list tools — narrow the response to the named
//               top-level fields (plus id keys).
//  - filter/sort/limit args on list tools — consumed client-side by slim.mjs
//               (GitFlic has almost no server-side list filters). When any is
//               present, the handler also appends `--all` so the filter sees
//               the whole set, not just page 0.
const STR = (description) => ({ type: "string", description });
const NUM = (description) => ({ type: "number", description });
const BOOL = (description) => ({ type: "boolean", description });

// Per-list-tool filter args (name -> JSON-schema prop).
const FILTER_PROPS = {
  gitflic_issue_list: {
    label: STR("Keep only issues with a label whose title contains this (case-insensitive)."),
    assignee: STR("Keep only issues assigned to this username."),
    q: STR("Free-text filter over title + description."),
    sort: STR("Sort by a field; prefix '-' for descending (e.g. '-createdAt')."),
    limit: NUM("Return at most N issues after filtering/sorting."),
  },
  gitflic_mr_list: {
    status: STR("Filter by status (OPENED|MERGED|CLOSED|CANCELED|FAILED)."),
    author: STR("Keep only MRs by this author username."),
    targetBranch: STR("Keep only MRs targeting a branch matching this."),
    sourceBranch: STR("Keep only MRs from a source branch matching this."),
    q: STR("Free-text filter over title + description."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N."),
  },
  gitflic_commit_list: {
    author: STR("Keep only commits by this author."),
    q: STR("Free-text filter over the commit message."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N (e.g. last 10 commits)."),
  },
  gitflic_release_list: {
    preRelease: BOOL("true = only pre-releases, false = only stable."),
    tag: STR("Keep only releases whose tagName contains this."),
    q: STR("Free-text filter over title + description."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N (e.g. last 3 releases)."),
  },
  gitflic_branch_list: {
    name: STR("Glob/substring filter on branch name (e.g. 'release/*')."),
    merged: BOOL("true = only merged branches, false = only unmerged."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N."),
  },
  gitflic_tag_list: {
    name: STR("Glob/substring filter on tag name (e.g. 'v1.*')."),
    lightWeight: BOOL("true = only lightweight tags, false = only annotated."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N."),
  },
  gitflic_webhook_list: {
    event: STR("Keep only webhooks subscribed to this event (e.g. MERGE)."),
    limit: NUM("Return at most N."),
  },
  gitflic_project_list: {
    language: STR("Project language."), private: BOOL("Filter visibility."),
    sort: STR("Sort field."), limit: NUM("Return at most N matched projects."),
  },
  gitflic_project_list_my: {
    q: STR("Name/text filter (forwarded to GitFlic server-side, plus client match)."),
    language: STR("Keep only projects in this language."),
    private: BOOL("true = only private, false = only public."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N."),
  },
  gitflic_user_projects: {
    language: STR("Keep only projects in this language."),
    private: BOOL("true = only private, false = only public."),
    q: STR("Name/text filter."),
    sort: STR("Sort field; prefix '-' for descending."),
    limit: NUM("Return at most N."),
  },
  gitflic_user_followers: {
    q: STR("Username substring filter."),
    limit: NUM("Return at most N."),
  },
};
const LIST_TOOLS = new Set(Object.keys(FILTER_PROPS));
// Args whose presence means "fetch everything, then filter client-side".
const ALL_TRIGGER = [
  "label", "assignee", "author", "status", "targetBranch", "sourceBranch", "q",
  "name", "tag", "event", "language", "merged", "preRelease", "private", "lightWeight", "sort", "limit",
];
const needsAll = (a = {}) => ALL_TRIGGER.some((k) => a[k] !== undefined && a[k] !== "" && a[k] !== null);

for (const t of TOOLS) {
  const props = t.inputSchema.properties || (t.inputSchema.properties = {});
  if (!props.raw) {
    props.raw = BOOL(
      "Return the full, un-slimmed GitFlic response for THIS call (no token compression). Use when the default slim view dropped a field you need.",
    );
  }
  if ((t.annotations?.readOnlyHint || LIST_TOOLS.has(t.name)) && !props.fields) {
    props.fields = { type: "array", description: "Return only these top-level fields (plus id keys), narrowing the response further." };
  }
  const fp = FILTER_PROPS[t.name];
  if (fp) {
    for (const [k, schema] of Object.entries(fp)) if (!props[k]) props[k] = schema;
    const orig = t.handler;
    t.handler = (a = {}) => {
      const argv = orig(a);
      // project_list_my: GitFlic supports server-side ?q= for project listings.
      if (t.name === "gitflic_project_list_my" && a.q && !argv.includes("--q")) argv.push("--q", String(a.q));
      if (needsAll(a) && a.all !== false && a.page === undefined && !argv.includes("--all")) argv.push("--all");
      return argv;
    };
  }
}

// These collections support explicit paging and complete retrieval.
// Default to all pages unless a page is explicitly selected.
for (const tool of TOOLS.filter(t => [
  "gitflic_project_list", "gitflic_project_list_my",
  "gitflic_mr_diff", "gitflic_mr_discuss_list",
].includes(t.name))) {
  Object.assign(tool.inputSchema.properties, {
    page: { type: "integer", description: "Zero-based page index; selects one page unless all is true." },
    size: { type: "integer", description: "Requested page size; server limits are respected." },
    all: { type: "boolean", description: "Fetch all pages. Defaults to true when page is omitted." },
  });
  if (tool.name === "gitflic_mr_diff") {
    tool.inputSchema.properties.expand = { type: "boolean", description: "Expand collapsed text diffs; defaults to true." };
  }
  const original = tool.handler;
  tool.handler = (args = {}) => {
    const argv = original(args);
    if (args.page !== undefined) argv.push("--page", String(args.page));
    if (args.size !== undefined) argv.push("--size", String(args.size));
    if (args.all === false) {
      const index = argv.indexOf("--all");
      if (index >= 0) argv.splice(index, 1);
      argv.push("--no-all");
    } else if ((args.all === true || args.page === undefined) && !argv.includes("--all")) {
      argv.push("--all");
    }
    if (args.expand === false) argv.push("--no-expand");
    return argv;
  };
}

// Build the JSON Schema for ListTools request, just to help debugging.
export const TOOL_NAMES = TOOLS.map((t) => t.name);
