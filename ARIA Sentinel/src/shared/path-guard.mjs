// 🔒 R11 — "Private pics and Vids" is OFF LIMITS (LOCKED 2026-06-20). No read · write · list · scan ·
// index · screenshot · reference. Case-insensitive glob `**/Private pics and Vids/**`. Same severity as
// no-Raymond-James. If a planned action touches this path → halt + log a SECURITY audit + surface
// "1 personal folder excluded". Pure + node-safe so every file-enum / startup-scan / heartbeat path runs
// through it. See repo CLAUDE.md header + aria-vault/02_Hippocampus/RULES.md R11.

export const PRIVATE_FOLDER_NAME = "Private pics and Vids";
// Case-insensitive; matches the folder anywhere in a path (with \ or / separators, or bare name).
export const PRIVATE_FOLDER_RE = /private\s+pics\s+and\s+vids/i;
export const R11_SURFACE = "1 personal folder excluded";

/** True if a path/string references the off-limits private folder (case-insensitive). */
export function isBlockedPath(p) {
  return PRIVATE_FOLDER_RE.test(String(p == null ? "" : p));
}

/** Throw a tagged error if the path is off-limits (callers halt + log SECURITY audit). */
export function assertSafePath(p) {
  if (isBlockedPath(p)) {
    const err = new Error("R11_BLOCKED: private folder is off limits");
    err.code = "R11_BLOCKED";
    err.surface = R11_SURFACE;
    throw err;
  }
  return p;
}

/** Split a list into {kept, blocked} by the R11 rule. `get` extracts the path from each item. */
export function filterBlocked(items, get = (x) => x) {
  const kept = [];
  const blocked = [];
  for (const it of items || []) (isBlockedPath(get(it)) ? blocked : kept).push(it);
  return { kept, blocked };
}

/** Redact any private-folder path inside a free-text string to a placeholder. */
export function redactPrivate(value) {
  return String(value == null ? "" : value)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>");
}

/** The SECURITY audit entry to log when an action is halted by R11. */
export function r11AuditEntry(method = "unknown") {
  return { event: "private-folder-blocked", rule: "R11", method, surfaced: R11_SURFACE };
}
