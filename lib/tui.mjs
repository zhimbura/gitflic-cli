// Minimal TUI mode for list browsing. Used by `gitflic mr list --tui`.
//
// Keys:  j/Down  = next        k/Up   = previous
//        g       = first row   G      = last row
//        q/Esc   = quit
//        Enter   = print selected localId to stdout (so callers can pipe
//                  | xargs -I{} gitflic mr view {} --project ...)

import process from "node:process";
import { branchName } from "./format.mjs";

const ESC = "\x1b";
const CLEAR = `${ESC}[2J${ESC}[H`; // clear screen, cursor home
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const REVERSE = `${ESC}[7m`;

function formatMrRow(mr, width) {
  const id = String(mr.localId ?? "?").padStart(4);
  const status = String(mr.status?.id ?? "?").padEnd(10).slice(0, 10);
  const from = String(branchName(mr.sourceBranch) ?? "?").padEnd(20).slice(0, 20);
  const to = String(branchName(mr.targetBranch) ?? "?").padEnd(20).slice(0, 20);
  const title = String(mr.title ?? "").slice(0, Math.max(10, width - 60));
  return `${id}  ${status}  ${from} → ${to}  ${title}`;
}

export function runMrTui(items, { header = "merge requests" } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("gitflic: tui requires a TTY. Falling back to plain list.\n");
    return null;
  }
  if (!items.length) {
    process.stdout.write("(empty list)\n");
    return null;
  }
  let row = 0;
  let offset = 0;
  const height = process.stdout.rows || 24;
  const width = process.stdout.columns || 100;
  const pageSize = Math.max(1, height - 3); // leave room for header + footer

  function render() {
    let out = CLEAR + HIDE_CURSOR;
    out += `${BOLD}${header}  (${items.length} total)  — j/k to move, q to quit${RESET}\n`;
    out += `${"─".repeat(Math.min(width, 100))}\n`;
    const visible = items.slice(offset, offset + pageSize);
    visible.forEach((mr, i) => {
      const line = formatMrRow(mr, width);
      if (offset + i === row) {
        out += `${REVERSE}${line}${RESET}\n`;
      } else {
        out += `${line}\n`;
      }
    });
    // Footer
    out += `\n${BOLD}[${row + 1}/${items.length}]${RESET}`;
    process.stdout.write(out);
  }

  function cleanupAndExit() {
    process.stdout.write(SHOW_CURSOR + CLEAR);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeAllListeners("data");
    // Print the selected localId so the caller can pipe to `gitflic mr view`.
    if (row >= 0 && row < items.length) {
      process.stdout.write(String(items[row].localId ?? "") + "\n");
    }
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    const key = chunk.toString();
    if (key === "q" || key === ESC || key === "\x03") {
      cleanupAndExit();
      return;
    }
    if (key === "j" || key === "\x1b[B" || key === "\x1bOB") {
      if (row < items.length - 1) {
        row++;
        if (row >= offset + pageSize) offset = row - pageSize + 1;
      }
    } else if (key === "k" || key === "\x1b[A" || key === "\x1bOA") {
      if (row > 0) {
        row--;
        if (row < offset) offset = row;
      }
    } else if (key === "g") {
      row = 0;
      offset = 0;
    } else if (key === "G") {
      row = items.length - 1;
      offset = Math.max(0, items.length - pageSize);
    } else if (key === "\r" || key === "\n") {
      cleanupAndExit();
      return;
    }
    render();
  });

  render();

  // Return a promise that resolves when the user quits.
  return new Promise((resolve) => {
    process.stdin.once("data", () => {}); // ensure emitter
    const origExitListeners = process.listeners("exit");
    process.once("exit", () => resolve(null));
  });
}

// Exposed for tests
export const __test__ = { formatMrRow };
