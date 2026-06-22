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
  },
  {
    name: "gitflic_mr_create",
    description:
      "Create a new merge request. If --from is omitted, uses current git branch. If --to is omitted, uses project default branch.",
    inputSchema: {
      type: "object",
      required: ["project", "title"],
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
  },
  {
    name: "gitflic_user_me",
    description: "Get the current authenticated user (id, username, email, name, fullName).",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["user", "me", "--format", "json"],
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
  },

  // ===== project admin ====================================================
  {
    name: "gitflic_project_list_my",
    description: "List projects where the current user is owner/member.",
    inputSchema: { type: "object", properties: {} },
    handler: () => ["project", "list", "--scope", "my"],
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
  },
];

// Build the JSON Schema for ListTools request, just to help debugging.
export const TOOL_NAMES = TOOLS.map((t) => t.name);
