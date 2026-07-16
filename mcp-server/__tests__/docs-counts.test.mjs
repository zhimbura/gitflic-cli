// The tool counts quoted in prose drift silently. The 77th tool (
// gitflic_webhook_reveal_secret) landed in 0.4.0, but mcp-server/README.md still
// advertised "76 типизированных тулзов" and "69 тулзов" for NO_DESTRUCTIVE two
// releases later — nothing failed, it just quietly lied to readers.
//
// So: derive every number from TOOLS and assert the docs match. A stale count is
// now a red test, not something a human has to notice while grepping.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../tools.mjs";
import { isReadOnly, isDestructive } from "../filter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const TOTAL = TOOLS.length;
const READ = TOOLS.filter(isReadOnly).length;
const WRITE = TOTAL - READ;
const NO_DESTRUCTIVE = TOTAL - TOOLS.filter(isDestructive).length;
const MR_ISSUE = TOOLS.filter((t) => /^gitflic_(mr|issue)_/.test(t.name)).length;

// Docs that quote counts in prose. CHANGELOG is deliberately excluded — its
// numbers are historical fact at the time of each release and must NOT be
// rewritten when the tool set grows.
const DOCS = ["mcp-server/README.md", "docs/mcp-server.md", "README.md"];

describe("docs quote the real tool counts", () => {
  // The catch-all: any "<number> тулз…" in prose must be a number we can justify.
  // Whitelisting the derived values (rather than pinning each sentence) keeps the
  // test from breaking every time someone rewords a paragraph.
  const LEGIT = new Set([TOTAL, READ, WRITE, NO_DESTRUCTIVE, MR_ISSUE]);

  // Three shapes actually occur in these docs, and a naive /\d+\s+тулз/ misses two
  // of them — both were among the counts that really did go stale:
  //   "77 тулзов"                  → bare
  //   "77 типизированных тулзов"   → adjective in between
  //   "27 тулзов вместо 77"        → the count trails the noun
  const COUNT_PATTERNS = [/(\d+)\s+(?:\p{L}+\s+)?тулз/giu, /вместо\s+(\d+)/giu];

  for (const doc of DOCS) {
    it(`${doc} quotes no stale count`, () => {
      const text = read(doc);
      const found = COUNT_PATTERNS.flatMap((re) => [...text.matchAll(re)].map((m) => Number(m[1])));
      const stale = [...new Set(found)].filter((n) => !LEGIT.has(n));
      expect(
        stale,
        `${doc} mentions ${stale.join(", ")} тулзов, but the real numbers are: ` +
          `total=${TOTAL}, read=${READ}, write=${WRITE}, ` +
          `no-destructive=${NO_DESTRUCTIVE}, mr+issue=${MR_ISSUE}`,
      ).toEqual([]);
    });
  }

  it("mcp-server/README.md states the current total up front", () => {
    expect(read("mcp-server/README.md")).toContain(`**${TOTAL} типизированных тулзов**`);
  });

  it("the R/W split matches the annotations", () => {
    expect(read("mcp-server/README.md")).toContain(`**${READ} read / ${WRITE} write**`);
  });

  it("the per-group table matches the registry", () => {
    // `| auth | 8 | 3 / 5 |` — one row per group, counted from the tool names.
    const table = read("docs/mcp-server.md");
    const groups = {};
    for (const t of TOOLS) {
      const g = t.name.replace(/^gitflic_/, "").split("_")[0];
      groups[g] ??= { n: 0, r: 0 };
      groups[g].n++;
      if (isReadOnly(t)) groups[g].r++;
    }
    for (const [g, { n, r }] of Object.entries(groups)) {
      const row = new RegExp(`\\|\\s*\`${g}\`\\s*\\|\\s*${n}\\s*\\|\\s*${r}\\s*/\\s*${n - r}\\s*\\|`);
      expect(row.test(table), `docs/mcp-server.md row for \`${g}\` should be | ${n} | ${r} / ${n - r} |`).toBe(true);
    }
  });
});
