// RUN-J J1 — DEAL-BLOCKER AUTOPSY (pure, local-only, Rule 14 real-or-empty).
// For every real opportunity that did NOT convert, this states the ACTUAL blocker taken from real
// evidence produced elsewhere in the system — the H2 objection kind, the artifact that was missing,
// the gone-quiet signal, or the H3/I1 refusal reason. It never writes "lost on price" because that is
// the comfortable guess; a blocker with no evidence is reported as UNKNOWN with the gap named.
//
// Honesty invariants (Rule 14):
//   - NO GUESSED REASONS. Every blocker carries `source` = the artifact it was read from. No artifact
//     means no reason - only an UNKNOWN with the missing evidence named.
//   - UNKNOWNS ARE COUNTED ON THE FACE OF THE REPORT. Never hidden, never redistributed.
//   - A PATTERN NEEDS N REAL CASES. Below MIN_PATTERN_CASES it says "single case - not a pattern".
//   - CONVERTED OR STILL-OPEN OPPORTUNITIES ARE NOT AUTOPSIED. Only a recorded non-conversion.
//   - Rule 15 additive: objection-ledger / close-packet / billing-handoff / revenue-truth-board stay
//     read-only inputs; nothing is renamed, wrapped away, or replaced.

export const AUTOPSY_SCHEMA = "deal-blocker-autopsy.v1";

// A pattern is only claimed once this many separate real opportunities share one blocker kind.
export const MIN_PATTERN_CASES = 3;

export const UNKNOWN_KIND = "unknown";

export const GUESS_FREE_NOTE =
  "Every reason on this report was read off a real artifact. Opportunities with no artifact are counted as unknown - they are not guessed.";

export const UNKNOWN_GAP_NOTE =
  "No recorded blocker artifact for this opportunity. To make it knowable, record one of: an objection, the artifact the buyer asked for, a gone-quiet date, or the packet/handoff refusal reason.";

export const SINGLE_CASE_NOTE = "single case - not a pattern";

export const EMPTY_NOTE =
  "No non-converted opportunity has been recorded yet - this report renders nothing rather than filler.";

export const BLOCKER_KINDS = ["refusal", "missing-artifact", "objection", "gone-quiet"];

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }
function iso(v) { if (!v) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : new Date(t).toISOString(); }

// -- 1. One opportunity, one evidenced blocker (or an honest unknown) ---------------------------------
export function blockerOf(opportunity = {}, { now = Date.now() } = {}) {
  if (!opportunity || typeof opportunity !== "object") return null;
  const id = str(opportunity.id);
  const customer = str(opportunity.customer);
  if (!id || !customer) return null;            // untraceable: not autopsied at all
  if (opportunity.converted === true) return null; // a won deal has no blocker
  if (opportunity.closed !== true) return null;    // still open: nothing lost yet

  const base = { id, customer, closedAt: iso(opportunity.closedAt) };

  // (a) A refusal from the close packet (H3) or billing handoff (I1) is the hardest evidence there is.
  const refusal = opportunity.refusal;
  // Both real refusal shapes are accepted: the close packet refuses with `rendered:false`, the billing
  // handoff refuses with `produced:false`. Neither shape is normalised away or re-worded.
  if (refusal && typeof refusal === "object" && (refusal.produced === false || refusal.rendered === false)) {
    const missing = Array.isArray(refusal.missing) ? refusal.missing.filter((m) => str(m)) : [];
    const reason = str(refusal.refusal) || str(refusal.reason) || (missing.length ? "missing real input: " + missing.join(", ") : null);
    if (reason) {
      return { ...base, kind: "refusal", reason, source: str(refusal.schema) || "refusal",
        evidence: missing.length ? missing.slice() : [reason], known: true };
    }
  }

  // (b) The buyer asked for an artifact that did not exist.
  const missingArtifact = str(opportunity.missingArtifact);
  if (missingArtifact) {
    return { ...base, kind: "missing-artifact",
      reason: "the buyer asked for " + missingArtifact + " and it did not exist",
      source: str(opportunity.missingArtifactSource) || "objection-ledger.v1",
      evidence: [missingArtifact], known: true };
  }

  // (c) A recorded objection kind from the H2 ledger.
  const objection = opportunity.objection;
  if (objection && typeof objection === "object") {
    const kind = str(objection.kind);
    const quote = str(objection.quote);
    if (kind) {
      return { ...base, kind: "objection", reason: "recorded objection: " + kind,
        source: str(objection.schema) || "objection-ledger.v1",
        evidence: quote ? [kind, quote] : [kind], known: true };
    }
  }

  // (d) They went quiet, and we have the date.
  const quietSince = iso(opportunity.quietSince);
  if (quietSince) {
    const days = Math.floor((now - Date.parse(quietSince)) / 86400000);
    return { ...base, kind: "gone-quiet",
      reason: "went quiet on " + quietSince.slice(0, 10) + " (" + days + " days with no record)",
      source: str(opportunity.quietSource) || "engagement-record",
      evidence: [quietSince], known: true, quietDays: days };
  }

  // (e) Nothing real. Say so, and name what would make it knowable.
  return { ...base, kind: UNKNOWN_KIND, reason: UNKNOWN_GAP_NOTE, source: null, evidence: [], known: false };
}

// -- 2. The autopsy ------------------------------------------------------------------------------------
export function buildAutopsy(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const opportunities = Array.isArray(src.opportunities) ? src.opportunities : [];

  const blockers = opportunities.map((o) => blockerOf(o, { now })).filter(Boolean);
  const known = blockers.filter((b) => b.known);
  const unknown = blockers.filter((b) => !b.known);

  const byKind = {};
  for (const b of known) { if (!byKind[b.kind]) byKind[b.kind] = []; byKind[b.kind].push(b.id); }

  const patterns = [];
  for (const kind of Object.keys(byKind).sort()) {
    const ids = byKind[kind];
    patterns.push({
      kind, cases: ids.length, opportunityIds: ids.slice(),
      isPattern: ids.length >= MIN_PATTERN_CASES,
      claim: ids.length >= MIN_PATTERN_CASES
        ? kind + " blocked " + ids.length + " real opportunities - that is a pattern"
        : ids.length + " case" + (ids.length === 1 ? "" : "s") + " of " + kind + " - " + SINGLE_CASE_NOTE,
    });
  }

  return {
    schema: AUTOPSY_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    autopsied: blockers.length,
    knownCount: known.length,
    unknownCount: unknown.length,
    blockers, unknown, patterns,
    empty: blockers.length === 0,
    minPatternCases: MIN_PATTERN_CASES,
    note: GUESS_FREE_NOTE,
  };
}

// -- 3. Read it in ten seconds --------------------------------------------------------------------------
export function autopsyMarkdown(report) {
  if (!report || report.schema !== AUTOPSY_SCHEMA) return "No deal-blocker autopsy.";
  const out = [];
  out.push("# Deal-blocker autopsy");
  out.push("");
  if (report.empty) {
    out.push(EMPTY_NOTE);
    out.push("");
    out.push("_" + report.note + "_");
    return out.join("\n");
  }
  out.push(report.autopsied + " non-converted opportunities: " + report.knownCount +
    " with a real recorded blocker, " + report.unknownCount + " unknown.");
  out.push("");
  out.push("## Blockers");
  for (const b of report.blockers) {
    if (!b.known) continue;
    out.push("- " + b.customer + " (" + b.id + "): " + b.reason + " - source: " + b.source);
  }
  if (report.knownCount === 0) out.push("None recorded.");

  out.push("");
  out.push("## Unknown - " + report.unknownCount);
  if (report.unknownCount === 0) out.push("None.");
  else for (const b of report.unknown) out.push("- " + b.customer + " (" + b.id + "): " + b.reason);

  out.push("");
  out.push("## Patterns");
  if (report.patterns.length === 0) out.push("None.");
  else for (const p of report.patterns) out.push("- " + p.claim + " [" + p.opportunityIds.join(", ") + "]");

  out.push("");
  out.push("_" + report.note + "_");
  return out.join("\n");
}
