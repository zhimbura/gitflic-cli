// Runner — thin wrapper that spawns the gitflic CLI and returns parsed JSON or text.

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to the parent bin/gitflic
const CLI_BIN = resolve(__dirname, "..", "bin", "gitflic");

/**
 * Run a gitflic command and return {stdout, stderr, code}.
 */
export function runGitflic(args, { env = {}, cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(CLI_BIN, args, {
      env: { ...process.env, ...env },
      cwd,
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", rejectP);
    proc.on("close", (code) => resolveP({ stdout, stderr, code: code ?? 1 }));
  });
}

/**
 * Run a gitflic command and parse JSON. Falls back to {raw: text} if not JSON.
 * Throws if exit code != 0.
 */
export async function runGitflicJson(args, opts = {}) {
  const r = await runGitflic([...args, "--format", "json"], opts);
  if (r.code !== 0) {
    throw new GitflicError(r.stderr.trim() || r.stdout.trim(), r.code);
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { raw: r.stdout };
  }
}

/**
 * Run a gitflic command expecting pretty text output. Returns trimmed stdout.
 * Throws if exit code != 0.
 */
export async function runGitflicText(args, opts = {}) {
  const r = await runGitflic([...args, "--format", "pretty"], opts);
  if (r.code !== 0) {
    throw new GitflicError(r.stderr.trim() || r.stdout.trim(), r.code);
  }
  return r.stdout;
}

export class GitflicError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "GitflicError";
  }
}
