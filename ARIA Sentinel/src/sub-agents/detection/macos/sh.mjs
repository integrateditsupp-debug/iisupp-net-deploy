// Shared shell runner for ARIA Sentinel macOS detection watchers — the darwin twin of ps.mjs.
//
// Content-blind contract: this returns RAW TEXT to a watcher. The watcher extracts ONLY symbolic
// enum values from that text; raw output (paths, hostnames, app names, user strings) never leaves
// the watcher boundary.
//
// Hard platform guard: if we are not on macOS this resolves null immediately and spawns NOTHING,
// so a Windows build can never invoke `df`, `top`, `log`, `scutil` or `ping`.
import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Run a read-only macOS command and resolve its stdout text.
 * Never rejects — on any failure it resolves null so a watcher tick is a safe no-op.
 * @param {string} file  binary name (df, top, log, scutil, ping)
 * @param {string[]} args positional args (no shell string interpolation)
 */
export function runShell(file, args = [], options = {}) {
  if (process.platform !== "darwin") return Promise.resolve(null);
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn(file, args, { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return done(null);
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* killing a finished process is fine */ }
      done(null);
    }, timeoutMs);
    timer.unref?.();

    let out = "";
    let size = 0;
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        // Defensive: a watcher query should never return a megabyte. Truncate hard.
        try { child.kill(); } catch { /* ignore */ }
        return;
      }
      out += chunk.toString("utf8");
    });
    child.on("error", () => { clearTimeout(timer); done(null); });
    child.on("close", () => { clearTimeout(timer); done(out); });
  });
}

/** Parse newline-delimited JSON (what `log show --style ndjson` emits), dropping bad lines. */
export function parseNdjson(text) {
  const rows = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed || trimmed === "[" || trimmed === "]") continue;
    try { rows.push(JSON.parse(trimmed)); } catch { /* skip non-JSON noise */ }
  }
  return rows;
}
