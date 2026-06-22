import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let writeSpy;
let exitSpy;
let stderrSpy;

beforeEach(() => {
  writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit called with ${code}`);
  });
});

afterEach(() => {
  writeSpy.mockRestore();
  stderrSpy.mockRestore();
  exitSpy.mockRestore();
});

async function importHandler() {
  // Module is stateless — no need to reset between tests.
  return await import("../cmd/completion.mjs");
}

function joinedOutput(spy) {
  return spy.mock.calls.map((c) => c[0]).join("");
}

describe("completion scripts", () => {
  it("bash: contains all top commands and global flags", async () => {
    const m = await importHandler();
    await m.handle({}, "bash", [], {});
    const out = joinedOutput(writeSpy);
    expect(out).toContain("complete -F _gitflic gitflic");
    expect(out).toContain("auth");
    expect(out).toContain("mr");
    expect(out).toContain("--project");
    expect(out).toContain("--no-color");
  });

  it("zsh: contains #compdef header and top commands", async () => {
    const m = await importHandler();
    await m.handle({}, "zsh", [], {});
    const out = joinedOutput(writeSpy);
    expect(out.startsWith("#compdef gitflic")).toBe(true);
    expect(out).toContain("'auth'");
    expect(out).toContain("'mr'");
    expect(out).toContain("--format");
  });

  it("fish: contains complete -c gitflic", async () => {
    const m = await importHandler();
    await m.handle({}, "fish", [], {});
    const out = joinedOutput(writeSpy);
    expect(out).toContain("complete -c gitflic -f -a");
    expect(out).toContain("auth");
    expect(out).toContain("mr");
  });

  it("unknown shell exits 2 with error", async () => {
    const m = await importHandler();
    await expect(m.handle({}, "powershell", [], {})).rejects.toThrow(
      /process.exit called with 2/,
    );
    expect(stderrSpy).toHaveBeenCalled();
    const err = joinedOutput(stderrSpy);
    expect(err).toContain("powershell");
  });
});
