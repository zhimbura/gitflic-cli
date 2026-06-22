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
  },
  {
    name: "gitflic_project_edit",
    description: "Edit project metadata (title, description, default branch, visibility).",
    inputSchema: {
      type: "object",
      required: ["project"],
      properties: {
        project: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        isPrivate: { type: "boolean" },
        language: { type: "string" },
        defaultBranch: { type: "string" },
      },
    },
    handler: (a) => {
      const args = ["project", "edit", a.project, "--format", "json"];
      if (a.title) args.push("--title", a.title);
      if (a.description !== undefined) args.push("--description", a.description);
      if (a.isPrivate !== undefined) args.push(a.isPrivate ? "--private" : "--public");
      if (a.language) args.push("--language", a.language);
      if (a.defaultBranch) args.push("--default-branch", a.defaultBranch);
      return args;
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
      const args = ["blob", "files", "--project", a.project, "--format", "json"];
      if (a.path) args.push("--path", a.path);
      if (a.branch) args.push("--branch", a.branch);
      return args;
    },
  },
  {
    name: "gitflic_blob_archive",
    description: "Download a repo archive (tarball). Returns JSON metadata; use shell to stream the body.",
    inputSchema: {
      type: "object",
      required: ["project", "branch"],
      properties: { project: { type: "string" }, branch: { type: "string" } },
    },
    handler: (a) => ["blob", "archive", a.branch, "--project", a.project, "--format", "json"],
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
  },
];

// Build the JSON Schema for ListTools request, just to help debugging.
export const TOOL_NAMES = TOOLS.map((t) => t.name);
