// RUN-F F1 — MULTI-PILOT OPERATIONS CONSOLE (pure, local, free).
//
// Extends the E1 single-pilot TTFV state to N concurrent REAL pilots. One console rows every live
// pilot with: real TTFV clock, maturity, last-activity, real fix count, health flags, and the exact
// next ONE-CLICK action Ahmad can take.
//
// 🔒 Rule 14 (real-or-empty): a row can ONLY come from a real recorded pilot record. Zero real
// pilots => an honest EMPTY board (rows: [], empty: true) — never a demo-filled fake. Fix counts
// come from real audit RUN entries at/after that pilot's start; a missing/invalid signal is null
// or 0, never a guess. No metric is ever synthesized.
// 🔒 Additive only (Rule 15): reads pilot.v1 records + the existing transparency/audit log shape.
//    Nothing here renames, removes, or rewrites any existing surface or field.
// 🔒 No external send / sign / pay / deploy. Every action this module emits is a STAGED one-click
//    label for Ahmad — this module never performs an action.

import { firstFixAtFromAudit, ttfvMinutes, ttfvLabel } from "./pilot-state.mjs";

export const PILOT_MATURED_FIXES = 3;          // matured = TTFV stamped AND >= 3 real fixes
export const STALLED_CLOCK_HOURS = 48;         // started, still no first value after 48h
export const GONE_QUIET_DAYS = 7;              // no real activity for 7+ days
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

const ms = (v) => {
  const t = typeof v === "number" ? v : Date.parse(String(v == null ? "" : v));
  return Number.isFinite(t) ? t : null;
};

/** Real fixes for one pilot: audit RUN entries at/after that pilot's start. Real-or-empty. */
export function pilotFixCount(entries, { startedAt } = {}) {
  const started = ms(startedAt);
  if (started == null || !Array.isArray(entries)) return 0;
  let n = 0;
  for (const e of entries) {
    if (!e || e.tag !== "RUN") continue;
    const t = ms(e.ts);
    if (t == null || t < started) continue;
    n += 1;
  }
  return n;
}

/** Newest real activity timestamp (epoch-ms) for a pilot, or null. Never guesses. */
export function pilotLastActivityAt(entries, { startedAt } = {}) {
  const started = ms(startedAt);
  if (started == null || !Array.isArray(entries)) return null;
  let latest = null;
  for (const e of entries) {
    if (!e) continue;
    const t = ms(e.ts);
    if (t == null || t < started) continue;
    if (latest == null || t > latest) latest = t;
  }
  return latest;
}

/**
 * Honest maturity. matured requires BOTH a real stamped TTFV and >= PILOT_MATURED_FIXES real fixes,
 * because only a matured pilot may ever be offered a conversion ask (F2).
 * @returns {"immature"|"maturing"|"matured"}
 */
export function pilotMaturity(record, { fixCount = 0 } = {}) {
  const n = Number.isFinite(Number(fixCount)) ? Math.max(0, Math.trunc(Number(fixCount))) : 0;
  const stamped = ttfvMinutes(record) != null;
  if (stamped && n >= PILOT_MATURED_FIXES) return "matured";
  if (n >= 1) return "maturing";
  return "immature";
}

/** Health flags Ahmad acts on. Empty array = healthy. Order is stable for test/render. */
export function pilotHealthFlags(record, { fixCount = 0, lastActivityAt = null, now = Date.now() } = {}) {
  const flags = [];
  const started = record ? ms(record.started_at) : null;
  if (started == null) return flags;                       // not a real started pilot => no invented flags
  const stamped = ttfvMinutes(record) != null;
  if (!stamped) {
    flags.push("no-first-value");
    if (now - started >= STALLED_CLOCK_HOURS * HOUR_MS) flags.push("stalled-clock");
  }
  const last = ms(lastActivityAt);
  const since = last == null ? started : last;
  if (now - since >= GONE_QUIET_DAYS * DAY_MS) flags.push("gone-quiet");
  void fixCount;
  return flags;
}

/**
 * The exact next STAGED one-click for a row. Never sends; the label names what Ahmad's single click
 * would do. gone-quiet takes precedence — a silent pilot gets re-engaged before it is asked to pay.
 */
export function pilotNextOneClick({ maturity = "immature", flags = [] } = {}) {
  const f = Array.isArray(flags) ? flags : [];
  if (f.includes("gone-quiet")) return "stage-reengage-draft";
  if (f.includes("stalled-clock")) return "stage-first-value-assist";
  if (maturity === "matured") return "stage-conversion-proof";
  if (maturity === "maturing") return "stage-progress-checkin";
  return "stage-activation-nudge";
}

/**
 * Build the multi-pilot console.
 * @param {Array<object>} records real pilot.v1 records (any count, including none).
 * @param {{now?:number, auditByPilot?:Record<string,Array>, audit?:Array}} args
 *        auditByPilot maps a pilot key (device_id, else org) -> that pilot's real audit entries.
 * @returns {{empty:boolean, rows:Array, counts:object, generatedAt:string}}
 */
export function buildPilotConsole(records, { now = Date.now(), auditByPilot = {}, audit = null } = {}) {
  const list = Array.isArray(records) ? records : [];
  const rows = [];
  for (const rec of list) {
    if (!rec || typeof rec !== "object") continue;
    const started = ms(rec.started_at);
    if (started == null) continue;                          // real-or-empty: unstarted => not a row
    const key = String(rec.device_id || rec.org || "");
    const entries = Array.isArray(auditByPilot[key]) ? auditByPilot[key]
      : (list.length === 1 && Array.isArray(audit) ? audit : []);
    const fixCount = pilotFixCount(entries, { startedAt: rec.started_at });
    const lastActivityAt = pilotLastActivityAt(entries, { startedAt: rec.started_at });
    const maturity = pilotMaturity(rec, { fixCount });
    const flags = pilotHealthFlags(rec, { fixCount, lastActivityAt, now });
    rows.push({
      key,
      org: rec.org || "",
      size: rec.size || "",
      startedAt: new Date(started).toISOString(),
      ttfvMinutes: ttfvMinutes(rec),
      ttfvLabel: ttfvLabel(rec),
      fixCount,
      lastActivityAt: lastActivityAt == null ? null : new Date(lastActivityAt).toISOString(),
      maturity,
      flags,
      nextOneClick: pilotNextOneClick({ maturity, flags })
    });
  }
  // Newest pilots first — stable, deterministic for render + test.
  rows.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const counts = {
    total: rows.length,
    matured: rows.filter((r) => r.maturity === "matured").length,
    maturing: rows.filter((r) => r.maturity === "maturing").length,
    immature: rows.filter((r) => r.maturity === "immature").length,
    needsAttention: rows.filter((r) => r.flags.length > 0).length
  };
  return {
    empty: rows.length === 0,
    rows,
    counts,
    generatedAt: new Date(now).toISOString()
  };
}

/** Honest empty-board copy — shown verbatim when there are zero real pilots (never a fake row). */
export function pilotConsoleEmptyCopy() {
  return "No live pilots yet. This board fills in only from real activated pilots.";
}
