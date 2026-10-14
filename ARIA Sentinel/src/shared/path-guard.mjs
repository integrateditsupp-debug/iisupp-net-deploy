// 🔒 R11 — "Private pics and Vids" is OFF LIMITS (LOCKED 2026-06-20). No read · write · list · scan ·
// index · screenshot · reference. Case-insensitive glob `**/Private pics and Vids/**`. Same severity as
// no-Raymond-James. If a planned action touches this path → halt + log a SECURITY audit + surface
// "1 personal folder excluded". Pure + node-safe so every file-enum / startup-scan / heartbeat path runs
// through it. See repo CLAUDE.md header + aria-vault/02_Hippocampus/RULES.md R11.

export const PRIVATE_FOLDER_NAME = "Private pics and Vids";
// Case-insensitive; matches the folder anywhere in a path (with \ or / separators, or bare name).
export const PRIVATE_FOLDER_RE = /private\s+pics\s+and\s+vids/i;
export const R11_SURFACE = "1 personal folder excluded";

// PROD 2026-10-14 (audit M15) — the MECHANISM is a product feature ("excluded folders"); the locked default name
// above is one entry in it, never shown to a customer. An IT lead / the person can add their own folder names
// (Settings → Privacy → Excluded folders → stored as `excludedFolders` in the store); main calls
// configureExcludedFolders(list) at launch and on change. Every guard below honours the whole set.
const extraFolders = [];
const extraRes = [];
function folderRe(name) {
  const safe = String(name || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return safe ? new RegExp(safe, "i") : null;
}
/** Replace the configurable excluded-folder list (names only, 1–120 chars; the locked default is always kept). */
export function configureExcludedFolders(names = []) {
  extraFolders.length = 0; extraRes.length = 0;
  for (const n of Array.isArray(names) ? names : []) {
    const name = String(n == null ? "" : n).trim().slice(0, 120);
    if (!name || PRIVATE_FOLDER_RE.test(name) || extraFolders.includes(name)) continue;
    const re = folderRe(name);
    if (re) { extraFolders.push(name); extraRes.push(re); }
  }
  return excludedFolderCount();
}
/** How many folders are excluded right now (the locked default + the configured ones). Never the names. */
export function excludedFolderCount() { return 1 + extraFolders.length; }
/** The user-facing label for the exclusion guard — a COUNT, never the default folder's name (audit M15). */
export function excludedFoldersLabel() { const n = excludedFolderCount(); return `${n} excluded folder${n === 1 ? "" : "s"} never touched`; }
/** The configured (non-default) names, for the Settings list. */
export function configuredExcludedFolders() { return extraFolders.slice(); }

/** True if a path/string references an off-limits folder (the locked default or a configured one; case-insensitive). */
export function isBlockedPath(p) {
  const s = String(p == null ? "" : p);
  if (PRIVATE_FOLDER_RE.test(s)) return true;
  for (const re of extraRes) if (re.test(s)) return true;
  return false;
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

/** Redact any excluded-folder path inside a free-text string to a placeholder. */
export function redactPrivate(value) {
  let out = String(value == null ? "" : value)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>");
  for (const re of extraRes) {
    const r = new RegExp(`([a-z]:\\\\)?[^\\r\\n"<>|]*?${re.source}[^\\r\\n"<>|]*`, "gi");
    out = out.replace(r, "<private-folder>");
  }
  return out;
}

/** The SECURITY audit entry to log when an action is halted by R11. */
export function r11AuditEntry(method = "unknown") {
  return { event: "private-folder-blocked", rule: "R11", method, surfaced: R11_SURFACE };
}
