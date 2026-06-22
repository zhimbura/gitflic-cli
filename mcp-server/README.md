# gitflic-cli MCP server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that wraps the `gitflic` CLI and exposes ~30 GitFlic REST endpoints as **typed tools** for AI agents (Claude Code, Cursor, etc.).

## What's inside

- `server.mjs` — MCP stdio server, registers every tool, dispatches to the CLI.
- `tools.mjs` — Tool definitions (name, description, JSON schema, CLI arg builder).
- `runner.mjs` — `child_process` wrapper that spawns `../bin/gitflic` and parses JSON.
- `package.json` — `@modelcontextprotocol/sdk` only.

The MCP server is a **thin layer** — every tool maps 1-to-1 to a CLI sub-command. Anything you can do with `gitflic …` you can do from an MCP host.

## Install

```bash
cd mcp-server
npm install
```

Requires Node 18+ and a built `gitflic` binary at `../bin/gitflic` (the parent project builds it on first run — no build step needed, it's plain ESM).

## Configure token

The server reads `GITFLIC_TOKEN` from the parent process environment, exactly like the CLI:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

For self-hosted GitFlic, also `export GITFLIC_API_BASE=https://git.example.com`.

## Register with your MCP host

### Claude Code (`~/.claude/mcp_servers.json`)

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "node",
      "args": ["/absolute/path/to/gitflic-cli/mcp-server/server.mjs"],
      "env": { "GITFLIC_TOKEN": "xxxxxxxx" }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Same shape. Restart the host.

## Tools exposed (30)

| Tool | Maps to |
|---|---|
| `gitflic_auth` | `gitflic auth` |
| `gitflic_project_resolve` | `gitflic project get` |
| `gitflic_mr_list` / `view` / `diff` | `gitflic mr list/view/diff` |
| `gitflic_mr_create` | `gitflic mr create` (auto from→to) |
| `gitflic_mr_approve` / `merge` / `close` | `gitflic mr approve/merge/close` |
| `gitflic_mr_comment` (general + inline-anchored) | `gitflic mr comment` |
| `gitflic_mr_discuss_list` / `reply` / `resolve` | `gitflic mr discuss …` |
| `gitflic_issue_list` / `view` / `create` / `close` / `comment` | `gitflic issue …` |
| `gitflic_branch_list` / `create` / `delete` | `gitflic branch …` |
| `gitflic_tag_list` / `create` | `gitflic tag …` |
| `gitflic_release_list` / `create` | `gitflic release …` |
| `gitflic_commit_list` | `gitflic commit list` |
| `gitflic_user_me` / `gitflic_user_search` | `gitflic user …` |
| `gitflic_project_list_my` | `gitflic project list --scope my` |
| `gitflic_webhook_list` | `gitflic webhook list` |
| `gitflic_branch_protection_list` | `gitflic branch protection list` |

Anything not exposed here is still available via `gitflic …` directly — agents can shell out if they need a less-common endpoint.

## How it works

```
[Claude Code / Cursor]
        │   JSON-RPC over stdio
        ▼
  mcp-server/server.mjs
        │   zod-validated tool call
        ▼
  mcp-server/runner.mjs   ── spawn ──►  ../bin/gitflic mr create --title "…" --format json
        │
        ▼
  parsed JSON response
```

Every tool's handler returns `["gitflic", "subcommand", "--flag", "value", …, "--format", "json"]`. The runner enforces that `--format json` is appended, then parses and returns structured data.

On non-zero exit (e.g. HTTP 422, 403, 404), the tool returns `isError: true` with the gitflic error message as text content — agents see the failure and can recover.

## Extend

Add a tool by appending to `TOOLS` in `tools.mjs`:

```js
{
  name: "gitflic_release_delete",
  description: "Delete a release by uuid.",
  inputSchema: {
    type: "object",
    required: ["project", "uuid"],
    properties: { project: { type: "string" }, uuid: { type: "string" } },
  },
  handler: (a) => ["release", "delete", a.uuid, "--project", a.project, "--format", "json"],
}
```

No registration code — the loop in `server.mjs` picks it up automatically.

## License

MIT (same as parent project).
