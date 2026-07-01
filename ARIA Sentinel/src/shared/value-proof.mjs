// value-proof — RUN-B B2: the buyer's value proof in ONE real-or-empty place. Composes the audited ROI math
// (roi.mjs) with the real deflection % (resolution-outcome.mjs, RUN-B B1) so EVERY surface — the dashboard,
// Settings -> About, the session-end report, and the weekly/quarterly digests — shows the SAME real numbers:
// "ARIA fixed N issues, saved ~H hours = $D, and resolved P% first-touch." Pure + node-safe (no DOM, no
// Electron, no I/O; the main process owns the store, this module owns every decision so it is unit-tested).
//
// 🔒 Rule 14 (honesty IS the moat): REAL-OR-EMPTY throughout. hoursSaved / dollarsSaved are null until at
// least one REAL fix exists (never "$0 saved" dressed up as a win); deflectionPct is null until a real
// "was this fixed?" outcome exists (B1). Nothing here invents a flattering default. `fixes` is the SAME
// audit-log RUN count the pilot->paid proof (D2) already uses, so no surface can disagree with another.
import { computeRoi, roiSummary, DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX } from "./roi.mjs";
import { deflectionStats } from "./resolution-outcome.mjs";

export { DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX };

// Honest empty-state copy shown wherever there is not yet a single real fix or outcome.
export const VALUE_PROOF_EMPTY = "No resolved incidents yet — ROI and deflection appear after ARIA's first real fix.";

/**
 * The single value-proof block every surface renders.
 * @param {{fixes:number, outcomeEvents:Array, hourlyRate?:number, minutesPerFix?:number}} input
 *   fixes         REAL audit-log RUN count (resolved fixes) — same signal the D2 pilot proof uses.
 *   outcomeEvents REAL "was this fixed?" outcome events (B1).
 * Real-or-empty: no fixes => hoursSaved/dollarsSaved null; no outcomes => deflection/resolved/conversations null.
 */
export function valueProof({ fixes = 0, outcomeEvents = [], hourlyRate, minutesPerFix } = {}) {
  const n = Math.max(0, Math.floor(Number(fixes) || 0));
  const roi = computeRoi({ fixes: n, hourlyRate, minutesPerFix });
  const hasRoi = n > 0;
  const st = deflectionStats(Array.isArray(outcomeEvents) ? outcomeEvents : []);
  const hasDeflection = st.conversations > 0;
  return {
    fixes: n,
    hasRoi,
    hourlyRate: roi.hourlyRate,
    minutesPerFix: roi.minutesPerFix,
    hoursSaved: hasRoi ? roi.hoursSaved : null,          // null (empty-state) until a real fix — never 0-as-a-win
    dollarsSaved: hasRoi ? roi.dollarsSaved : null,
    conversations: hasDeflection ? st.conversations : null,
    resolved: hasDeflection ? st.resolved : null,
    deflectionPct: st.deflectionPct,                     // already real-or-null in B1 (null until a real outcome)
    hasDeflection,
    hasData: hasRoi || hasDeflection
  };
}

/**
 * Compact KPI bag for the report / email / digest builders. Every field is real-or-null so a surface can
 * render "--" for a missing one WITHOUT ever inventing a number. `incidents`/`autoPct`/`uptime7d` etc. are
 * merged in by the caller (they come from other real sources); this only owns the ROI + deflection fields.
 */
export function valueProofKpis(vp = {}) {
  const v = vp && typeof vp === "object" ? vp : {};
  return {
    fixes: Number.isFinite(v.fixes) ? v.fixes : 0,
    hoursSaved: v.hoursSaved == null ? null : v.hoursSaved,
    dollarsSaved: v.dollarsSaved == null ? null : v.dollarsSaved,
    deflectionPct: v.deflectionPct == null ? null : v.deflectionPct,
    resolved: v.resolved == null ? null : v.resolved,
    conversations: v.conversations == null ? null : v.conversations
  };
}

/** One-line human summary. Real when there is data; the honest empty-state otherwise. */
export function valueProofSummary(vp = {}) {
  if (!vp || !vp.hasData) return VALUE_PROOF_EMPTY;
  const parts = [];
  if (vp.hasRoi && vp.dollarsSaved != null) {
    parts.push(`ARIA has fixed ${vp.fixes} issue${vp.fixes === 1 ? "" : "s"}, saving ~${vp.hoursSaved} hour${vp.hoursSaved === 1 ? "" : "s"} @ $${vp.hourlyRate}/hr = $${Number(vp.dollarsSaved).toLocaleString("en-US")}`);
  }
  if (vp.hasDeflection && vp.deflectionPct != null) {
    parts.push(`${vp.deflectionPct}% resolved first-touch (${vp.resolved}/${vp.conversations})`);
  }
  return parts.join(" · ") + ".";
}

/** Tight "$D saved · ~Hh · P% first-touch" line for narrow surfaces (report footer, About). Real-or-empty. */
export function valueProofLine(vp = {}) {
  if (!vp || !vp.hasData) return "--";
  const bits = [];
  if (vp.dollarsSaved != null) bits.push(`$${Number(vp.dollarsSaved).toLocaleString("en-US")} saved`);
  if (vp.hoursSaved != null) bits.push(`~${vp.hoursSaved}h`);
  if (vp.deflectionPct != null) bits.push(`${vp.deflectionPct}% first-touch`);
  return bits.length ? bits.join(" · ") : "--";
}

// Re-export the audited one-liner so the About panel can fall back to the pure ROI sentence when it wants
// ROI only (no deflection). Kept here so callers import a single value-proof surface.
export { roiSummary };
