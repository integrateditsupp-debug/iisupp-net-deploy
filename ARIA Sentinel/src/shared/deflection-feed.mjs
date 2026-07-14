// STAGE 3 S3 — DEFLECTION FEED (journal + durability ledger → RUN-B B1 → Stage-4 Trust Center).
// This is the number the whole proof chain hangs on, so it is the number we are strictest about:
//   • DURABLE resolutions only — a first-pass patch that came back is NOT a deflection (F1).
//   • Real-or-empty (Rule 14): no attempts → rate is `null`, never a flattering 0% or a seeded demo
//     figure. Every field here can be traced to a journal entry or a ledger record.
//   • Content-blind: only symbolic ids, hashed signatures, counts and timestamps ever leave — no
//     user text, no paths. 🔒 R11 is check #1: a blocked payload is refused, not sanitised-and-shipped.
//   • NO-OP-NEUTRAL ("already healthy") is never counted as a fix — it is reported separately.
import { isBlockedPath, R11_SURFACE } from "./path-guard.mjs";
import { deflectionMetrics } from "./durability-ledger.mjs";

export const FEED_VERSION = "deflection-feed-v1";
export const FEED_EMPTY_LINE = "No resolution attempts recorded yet — deflection appears after ARIA's first real fix.";

/** Counts straight off the plan journals. Terminal events only; nothing inferred. */
export function journalOutcomeCounts(entries = []) {
  const c = { attempts: 0, resolved: 0, alreadyHealthy: 0, escalated: 0, aborted: 0, blocked: 0 };
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.event) continue;
    if (e.event === "PLAN.APPROVED") c.attempts += 1;
    else if (e.event === "PLAN.RESOLVED") {
      if (e.extra && e.extra.noChange === true) c.alreadyHealthy += 1; // never an ARIA fix
      else c.resolved += 1;
    } else if (e.event === "PLAN.ESCALATED") c.escalated += 1;
    else if (e.event === "PLAN.ABORTED") {
      if (e.extra && (e.extra.code === "R11_BLOCKED" || e.extra.code === "PROBE_NOT_ALLOWLISTED")) c.blocked += 1;
      else c.aborted += 1;
    }
  }
  return c;
}

/**
 * Build the feed B1 / Stage-4 consume.
 * @param {{ledger:object, journalEntries?:Array, now?:number}} args
 * @returns {{ok:boolean, version:string, hasData:boolean, deflectionRate:number|null, durableResolutions:number,
 *            attempts:number, monitoring:number, recurred:number, journal:object, line:string, asOf:number, surfaced?:string}}
 */
export function buildDeflectionFeed({ ledger, journalEntries = [], now = Date.now() } = {}) {
  // 🔒 R11 — check #1, BEFORE anything is read out of the ledger or the journal.
  let blob = "";
  try { blob = JSON.stringify({ ledger, journalEntries }); } catch { blob = String(ledger); }
  if (isBlockedPath(blob)) {
    return { ok: false, version: FEED_VERSION, hasData: false, deflectionRate: null, durableResolutions: 0, attempts: 0, monitoring: 0, recurred: 0, journal: journalOutcomeCounts([]), line: "Feed withheld — R11.", asOf: Number(now), surfaced: R11_SURFACE };
  }
  const m = deflectionMetrics(ledger, now);
  const j = journalOutcomeCounts(journalEntries);
  return {
    ok: true,
    version: FEED_VERSION,
    hasData: m.hasData,
    // DURABLE only. Null (not 0) with no data — Rule 14, no vanity fallback.
    deflectionRate: m.hasData ? m.deflectionRate : null,
    durableResolutions: m.durableResolutions,
    attempts: m.attempts,
    monitoring: m.monitoring,
    recurred: m.recurred,
    journal: j,
    line: m.hasData ? m.line : FEED_EMPTY_LINE,
    asOf: Number(now)
  };
}

/**
 * The B1 / Stage-4 tile. `value` is null (renders as "—") until a durable fix actually exists.
 * Honest in BOTH directions: we do not bank a deflection the instant we claim a fix, and we do not
 * print a damning "0%" while fixes are still legitimately inside their 24h monitoring window. When
 * nothing has EARNED the number yet, the tile says what is actually happening instead of showing a
 * figure that would mislead either way.
 */
export function deflectionKpi(feed) {
  const f = feed || {};
  const live = f.ok !== false && f.hasData === true && f.deflectionRate != null;
  const pending = live && f.durableResolutions === 0 && Number(f.monitoring) > 0;
  const has = live && !pending;
  const sub = has
    ? `${f.durableResolutions} of ${f.attempts} attempts stayed fixed`
    : (pending
      ? `${f.monitoring} fix${Number(f.monitoring) === 1 ? "" : "es"} still in the 24h monitoring window — not counted until they hold.`
      : FEED_EMPTY_LINE);
  return {
    id: "deflection",
    label: "Issues resolved durably by ARIA",
    value: has ? `${Math.round(f.deflectionRate * 100)}%` : null,
    sub,
    empty: !has,
    pending
  };
}

/** Content-blind assertion — the feed refuses to ship if it cannot PROVE it carries no free text. */
export function assertContentBlind(feed) {
  const allowed = new Set(["ok", "version", "hasData", "deflectionRate", "durableResolutions", "attempts", "monitoring", "recurred", "journal", "line", "asOf", "surfaced"]);
  for (const k of Object.keys(feed || {})) if (!allowed.has(k)) return { ok: false, reason: `unexpected field "${k}"` };
  let blob = "";
  try { blob = JSON.stringify(feed || {}); } catch { return { ok: false, reason: "unserialisable" }; }
  if (isBlockedPath(blob)) return { ok: false, reason: "R11" };
  return { ok: true };
}
