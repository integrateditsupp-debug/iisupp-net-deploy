// RUN 22 §5 — data-retention policy enforcement (hot/warm/cold + permanent delete). Pure + node-safe.
// Cleanup runs daily at 02:00 ET local (wired in main). Never deletes legal-hold items; never touches
// 🔒 R11 ("Private pics and Vids") — those paths are excluded from every traversal.
import { isBlockedPath } from "../shared/path-guard.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NEVER = Infinity;

// permanentDeleteDays from the packet's retention table (SOC 2 / PIPEDA / HIPAA floors).
export const RETENTION_POLICY = {
  auditLog: { hotDays: 30, warmDays: 365, coldDays: 2555, deleteAfterDays: 2555 },   // 7y floor
  heartbeats: { hotDays: 7, warmDays: 30, coldDays: 90, deleteAfterDays: 90 },
  diagnosticEvents: { hotDays: 30, warmDays: 90, coldDays: 365, deleteAfterDays: 365 },
  recipeLogs: { hotDays: 30, warmDays: 90, deleteAfterDays: 90 },
  csat: { deleteAfterDays: NEVER },           // trending data — never deleted
  kbHitLogs: { hotDays: 30, warmDays: 90, deleteAfterDays: 90 },
  updateHistory: { deleteAfterDays: NEVER },  // compliance audit — never deleted
  snapshots: { keepLatest: 5, deleteAfterDays: 30 },
  quarterlyReports: { deleteAfterDays: NEVER },
  licenseUsage: { deleteAfterDays: NEVER }    // billing audit — never deleted
};

export function cutoffMs(klass) {
  const p = RETENTION_POLICY[klass];
  if (!p || p.deleteAfterDays === NEVER || p.deleteAfterDays == null) return NEVER;
  return p.deleteAfterDays * DAY;
}

/** Is an item past its retention cutoff and eligible for permanent delete? */
export function dueForDeletion(klass, ageMs, { legalHold = false } = {}) {
  if (legalHold) return false;          // legal-hold overrides everything
  const cut = cutoffMs(klass);
  if (cut === NEVER) return false;       // never-delete classes
  return Number(ageMs) > cut;
}

/**
 * Plan a cleanup pass over stored items. Each item: { class, ts, legalHold?, path? }. R11-excluded paths
 * are NEVER traversed (dropped from the plan entirely). Snapshots also honor keepLatest.
 * @returns {{ delete:[], keep:[], excludedR11:number }}
 */
export function planCleanup(items = [], now = Date.now()) {
  const del = [], keep = [];
  let excludedR11 = 0;
  // Snapshot keepLatest: protect the most recent N regardless of age.
  const snaps = (items || []).filter((i) => i.class === "snapshots" && !isBlockedPath(i.path))
    .sort((a, b) => (Date.parse(b.ts) || b.ts || 0) - (Date.parse(a.ts) || a.ts || 0));
  const protectedSnaps = new Set(snaps.slice(0, RETENTION_POLICY.snapshots.keepLatest).map((s) => s.id ?? s.ts));

  for (const it of items || []) {
    if (isBlockedPath(it.path)) { excludedR11 += 1; continue; } // 🔒 R11 — never traverse/delete
    const age = now - (typeof it.ts === "number" ? it.ts : Date.parse(it.ts) || now);
    if (it.class === "snapshots" && protectedSnaps.has(it.id ?? it.ts)) { keep.push(it); continue; }
    (dueForDeletion(it.class, age, { legalHold: it.legalHold }) ? del : keep).push(it);
  }
  return { delete: del, keep, excludedR11 };
}

/** Next cleanup run: the upcoming 02:00 local time. */
export function nextCleanupAt(now = Date.now()) {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 2, 0, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export function retentionSummary() {
  return Object.entries(RETENTION_POLICY).map(([klass, p]) => ({
    class: klass,
    deleteAfterDays: p.deleteAfterDays === NEVER || p.deleteAfterDays == null ? "never" : p.deleteAfterDays
  }));
}
