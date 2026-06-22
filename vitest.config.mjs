import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests live next to the code they cover.
    include: ["lib/**/*.test.mjs", "mcp-server/**/*.test.mjs"],
    // Node built-in test environment; the CLI talks to real fetch.
    environment: "node",
    // Reasonable timeout for tests that mock retries.
    testTimeout: 10000,
  },
});
