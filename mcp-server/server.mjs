// gitflic MCP server — exposes the gitflic CLI as typed MCP tools.
// Stdio transport; no HTTP. For Claude Code / Cursor / any MCP host.
//
// Usage:
//   cd mcp-server && npm install
//   export GITFLIC_TOKEN="..." 
//   node server.mjs
//
// Then register with your MCP host, e.g. for Claude Code add to
// ~/.claude/mcp_servers.json:
//   { "mcpServers": { "gitflic": { "command": "node",
//                                   "args": ["/path/to/gitflic-cli/mcp-server/server.mjs"],
//                                   "env": { "GITFLIC_TOKEN": "..." } } } }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { runGitflic, runGitflicJson, GitflicError } from "./runner.mjs";
import { TOOLS } from "./tools.mjs";
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

// Register each tool from TOOLS.
for (const tool of TOOLS) {
  const zodInput = jsonSchemaToZod(tool.inputSchema);
  server.tool(
    tool.name,
    tool.description,
    zodInput.shape,
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
  `[gitflic-mcp] started; registered ${TOOLS.length} tools. GITFLIC_TOKEN=${process.env.GITFLIC_TOKEN ? "set" : "MISSING"}\n`,
);
