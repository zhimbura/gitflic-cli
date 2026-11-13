# GitFlic MCP server (gitflic-cli-mcp) — stdio transport.
# Build:  docker build -t gitflic-cli-mcp .
# Run:    docker run -i --rm -e GITFLIC_TOKEN=xxxx gitflic-cli-mcp
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# CLI sources: the MCP server spawns `lib/gitflic.mjs` (source-checkout fallback in runner.mjs).
COPY package.json ./package.json
COPY lib ./lib

# MCP server and its runtime dependencies.
COPY mcp-server/package.json ./mcp-server/
RUN cd mcp-server && npm install --omit=dev --no-audit --no-fund
COPY mcp-server ./mcp-server

USER node
WORKDIR /app/mcp-server

# GITFLIC_TOKEN is optional at start-up; tools that call the API need it.
ENTRYPOINT ["node", "server.mjs"]
