#!/usr/bin/env node
// gitflic MCP server — exposes the gitflic CLI as typed MCP tools.
// Stdio transport; no HTTP. For Claude Code / Cursor / any MCP host.
//
// Usage (no install — via npx):
//   GITFLIC_TOKEN="..." npx -y gitflic-cli-mcp
//
// Or from a source checkout:
//   cd mcp-server && npm install && GITFLIC_TOKEN="..." node server.mjs
//
// Then register with your MCP host, e.g. for Claude Code:
//   claude mcp add gitflic --env GITFLIC_TOKEN=... -- npx -y gitflic-cli-mcp
// or add to ~/.claude.json:
//   { "mcpServers": { "gitflic": { "command": "npx",
//                                   "args": ["-y", "gitflic-cli-mcp"],
//                                   "env": { "GITFLIC_TOKEN": "..." } } } }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { runGitflic, runGitflicJson, GitflicError } from "./runner.mjs";
import { TOOLS } from "./tools.mjs";
import { selectTools } from "./filter.mjs";
import { resolveProjectArg } from "./project-resolver.mjs";

const server = new McpServer(
  {
    name: "gitflic-cli",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Helper: turn a JSON Schema (from our TOOLS list) into a Zod object schema.
// MCP wants zod-style schemas. We support only the subset we use:
//   { type: "object", required: [...], properties: { name: { type, description, enum? } } }
function jsonSchemaToZod(schema) {
  const props = {};
  for (const [key, def] of Object.entries(schema.properties || {})) {
    let zodType;
    switch (def.type) {
      case "string":
        zodType = def.enum ? z.enum(def.enum) : z.string();
        break;
      case "number":
      case "integer":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.any());
        break;
      default:
        zodType = z.any();
    }
    if (def.description) zodType = zodType.describe(def.description);
    if (!schema.required || !schema.required.includes(key)) zodType = zodType.optional();
    props[key] = zodType;
  }
  return z.object(props);
}

// Optionally scope the tool set via env (GITFLIC_MCP_GROUPS / _READONLY /
// _TOOLS / _EXCLUDE) to keep the model's context small. Default: all tools.
const { selected, warnings } = selectTools(TOOLS, process.env);
for (const w of warnings) {
  process.stderr.write(`[gitflic-mcp] WARN: ${w}\n`);
}

// Register each selected tool.
for (const tool of selected) {
  const zodInput = jsonSchemaToZod(tool.inputSchema);
  // Per MCP 2025-06-18 spec, server.tool() in @modelcontextprotocol/sdk@1.x
  // takes annotations as the 5th positional arg. Clients like Claude Code
  // and Cursor prompt the user for confirmation when destructiveHint=true.
  const ann = tool.annotations || {};
  const annotations = {
    title: ann.title || tool.name,
    readOnlyHint: ann.readOnlyHint === true,
    destructiveHint: ann.destructiveHint !== false,  // default true (may modify state)
    idempotentHint: ann.idempotentHint === true,
    openWorldHint: ann.openWorldHint !== false,      // default true (talks to GitFlic)
  };
  server.tool(
    tool.name,
    tool.description,
    zodInput.shape,
    annotations,
    async (args) => {
      try {
        // Auto-resolve `project` from env or git remote if not provided.
        const resolvedArgs = resolveProjectArg(args || {});
        const cliArgs = tool.handler(resolvedArgs);
        // All our handlers return either an array (--format json) or
        // a list ending with --format pretty. We decide based on output
        // content (JSON parse) or just always try JSON first.
        let result;
        try {
          result = await runGitflicJson(cliArgs);
        } catch (e) {
          if (e instanceof GitflicError) {
            return {
              isError: true,
              content: [{ type: "text", text: `gitflic error: ${e.message}` }],
            };
          }
          throw e;
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `unexpected error: ${err.message || err}` }],
        };
      }
    },
  );
}

// Boot.
const transport = new StdioServerTransport();
await server.connect(transport);

// Announce to stderr (stdout is reserved for JSON-RPC).
process.stderr.write(
  `[gitflic-mcp] started; registered ${selected.length}/${TOOLS.length} tools. GITFLIC_TOKEN=${process.env.GITFLIC_TOKEN ? "set" : "MISSING"}\n`,
);
