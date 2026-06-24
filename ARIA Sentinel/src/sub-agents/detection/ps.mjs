// Shared PowerShell runner for ARIA Sentinel detection watchers.
//
// Content-blind contract: this module returns PARSED JSON to a watcher. The watcher
// is responsible for extracting ONLY symbolic enum values from that JSON. Raw output
// (paths, machine names, user strings) never leaves the watcher boundary.
//
// PowerShell is always spawned with the most restrictive flags the work allows:
//   -NoProfile -NonInteractive -ExecutionPolicy Restricted
// Read-only CIM/Get-* queries do not require relaxing the execution policy.
import { spawn } from "node:child_process";

const PS_FLAGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command"];
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Run a read-only PowerShell command and resolve its parsed JSON.
 * Never rejects — on any failure it resolves `null` so a watcher tick is a safe no-op.
 */
export function runPowerShellJson(command, options = {}) {
  if (process.platform !== "win32") return Promise.resolve(null);
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
      child = spawn("powershell.exe", [...PS_FLAGS, command], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      });
    } catch {
      return done(null);
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // Killing a finished process is fine.
      }
      done(null);
    }, timeoutMs);
    timer.unref?.();

    let out = "";
    let size = 0;
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        // Defensive: a watcher query should never return a megabyte. Truncate hard.
        try {
          child.kill();
        } catch {
          // ignore
        }
        return;
      }
      out += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(timer);
      done(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      done(parseJsonSafe(out));
    });
  });
}

export function parseJsonSafe(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/** PowerShell `ConvertTo-Json` returns a bare object for a single row and an array for many. */
export function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
