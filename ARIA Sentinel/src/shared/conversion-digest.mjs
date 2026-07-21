// conversion-digest — RUN-F F2: conversion at scale, honestly. Batches the RUN-E/B2 value-proof autorun
// across EVERY real matured pilot on the F1 multi-pilot console and emits ONE weekly digest: each genuinely
// ready pilot gets its auto-drafted one-page proof (real fixes, real hours, real $, real first-touch %) plus a
// STAGED conversion moment. Pure + node-safe (no DOM, no Electron, no I/O, no network) so every decision is
// unit-tested and no surface can disagree with another.
//
// 🔒 Rule 14 (honesty IS the moat): REAL-OR-EMPTY end to end.
//   - Zero real pilots => an honest empty digest. Never a demo row, never an invented pilot or number.
//   - A pilot only becomes an ASK if F1 says `matured` (a REAL stamped TTFV **and** >= 3 real fixes) AND the
//     value proof has real ROI data. Immature / maturing / zero-fix pilots produce NO ask — they are listed in
//     `notReady` with the honest reason instead of being quietly dropped.
//   - `gone-quiet` outranks money: a silent pilot is re-engaged, never asked to pay.
//   - Consent gate: no explicit `consent_to_contact` => the draft is null and the action is a consent ask.
// 🔒 Free-only + no autonomous action: EVERY emitted action is `stage-*`. This module never sends, signs,
//    charges, deploys, or contacts anyone. Ahmad's one click is the only thing that can act on a row.
// 🔒 Rule 12: the outreach body is the Ahmad-locked template, personalized ONLY at [Name] (byte-verbatim).
import { buildPilotConsole } from "./pilot-console.mjs";
import { valueProof, valueProofSummary, valueProofLine, VALUE_PROOF_EMPTY } from "./value-proof.mjs";
import { personalizeOutreach, TEMPLATE_SOURCE } from "./revenue-board.mjs";

export const CONVERSION_DIGEST_SCHEMA = "conversion-digest.v1";

/** Where a converted pilot goes. Public plans page — nothing here opens it, Ahmad's click does. */
export const PLANS_URL = "https://iisupp.net/plans";

/** Honest empty copy — rendered verbatim when no real pilot is ready. Never replaced by a fake row. */
export const CONVERSION_DIGEST_EMPTY =
  "No pilot is ready to convert yet. This digest fills in only from real matured pilots with real proof.";

/** Why a real pilot is NOT being asked. Stable strings so the render + tests agree. */
export const NOT_READY_REASONS = {
  goneQuiet: "gone-quiet — re-engage before asking for money",
  immature: "not matured yet — needs a real first value and 3 real fixes",
  maturing: "maturing — real fixes landing, not yet at the maturity bar",
  noProof: "no real ROI data yet — proof would be empty"
};

function arr(v) { return Array.isArray(v) ? v : []; }

/**
 * One pilot's auto-drafted proof one-pager. Real-or-empty: `hasProof` false means every number is null and
 * the copy is the honest empty-state — the caller must NOT render an ask from it.
 */
export function pilotProof(row, { outcomeEvents = [], hourlyRate, minutesPerFix } = {}) {
  const fixes = row && Number.isFinite(Number(row.fixCount)) ? Math.max(0, Math.trunc(Number(row.fixCount))) : 0;
  const vp = valueProof({ fixes, outcomeEvents: arr(outcomeEvents), hourlyRate, minutesPerFix });
  return {
    org: (row && row.org) || "",
    fixes: vp.fixes,
    hoursSaved: vp.hoursSaved,
    dollarsSaved: vp.dollarsSaved,
    deflectionPct: vp.deflectionPct,
    resolved: vp.resolved,
    conversations: vp.conversations,
    ttfvLabel: (row && row.ttfvLabel) || "--",
    summary: valueProofSummary(vp),
    line: valueProofLine(vp),
    hasProof: !!vp.hasRoi,
    emptyCopy: VALUE_PROOF_EMPTY
  };
}

/**
 * The staged conversion moment for a ready pilot. Consent-gated and ALWAYS staged — never sent.
 * No consent or no real contact name => `draft` is null (we do not draft into a real inbox blind).
 */
export function conversionMoment(record = {}, proof = {}) {
  const consent = record && record.consent_to_contact === true;
  const name = String((record && record.contact_name) || "").trim();
  const draft = consent && name ? personalizeOutreach(name) : null;
  return {
    consent,
    hasContact: !!name,
    plansUrl: PLANS_URL,
    templateSource: TEMPLATE_SOURCE,
    draft,                                   // verbatim locked template, [Name] only — or null
    proofLine: proof && proof.line ? proof.line : "--",
    action: !consent ? "stage-consent-request"
      : !name ? "stage-contact-capture"
      : "stage-conversion-ask",
    sent: false                              // structural: this module can never flip this true
  };
}

/**
 * Build the weekly conversion-at-scale digest.
 * @param {Array<object>} records real pilot.v1 records (any count, including none).
 * @param {{now?:number, auditByPilot?:object, outcomesByPilot?:object, hourlyRate?:number, minutesPerFix?:number}} args
 * @returns {{schema:string, empty:boolean, generatedAt:string, ready:Array, notReady:Array, counts:object, emptyCopy:string}}
 */
export function buildConversionDigest(records, {
  now = Date.now(), auditByPilot = {}, outcomesByPilot = {}, hourlyRate, minutesPerFix
} = {}) {
  const board = buildPilotConsole(records, { now, auditByPilot });
  const byKey = new Map();
  for (const rec of arr(records)) {
    if (!rec || typeof rec !== "object") continue;
    byKey.set(String(rec.device_id || rec.org || ""), rec);
  }

  const ready = [];
  const notReady = [];
  for (const row of board.rows) {
    const record = byKey.get(row.key) || {};
    const proof = pilotProof(row, {
      outcomeEvents: outcomesByPilot[row.key],
      hourlyRate,
      minutesPerFix
    });

    // gone-quiet outranks the ask — a silent pilot is re-engaged, never billed at.
    if (row.flags.includes("gone-quiet")) {
      notReady.push({ key: row.key, org: row.org, maturity: row.maturity, reason: NOT_READY_REASONS.goneQuiet, action: "stage-reengage-draft" });
      continue;
    }
    if (row.maturity !== "matured") {
      notReady.push({
        key: row.key, org: row.org, maturity: row.maturity,
        reason: row.maturity === "maturing" ? NOT_READY_REASONS.maturing : NOT_READY_REASONS.immature,
        action: row.nextOneClick
      });
      continue;
    }
    if (!proof.hasProof) {
      notReady.push({ key: row.key, org: row.org, maturity: row.maturity, reason: NOT_READY_REASONS.noProof, action: "stage-progress-checkin" });
      continue;
    }
    ready.push({ key: row.key, org: row.org, maturity: row.maturity, ttfvLabel: row.ttfvLabel, proof, moment: conversionMoment(record, proof) });
  }

  // Biggest honest proof first — deterministic for render + test.
  ready.sort((a, b) => (Number(b.proof.dollarsSaved) || 0) - (Number(a.proof.dollarsSaved) || 0));

  return {
    schema: CONVERSION_DIGEST_SCHEMA,
    empty: ready.length === 0,
    generatedAt: new Date(now).toISOString(),
    ready,
    notReady,
    counts: {
      pilots: board.rows.length,
      ready: ready.length,
      notReady: notReady.length,
      consentBlocked: ready.filter((r) => !r.moment.consent).length
    },
    emptyCopy: CONVERSION_DIGEST_EMPTY
  };
}

/** Local-only markdown render of the digest. No ask appears for anything in `notReady`. */
export function conversionDigestMarkdown(digest) {
  const d = digest && typeof digest === "object" ? digest : { ready: [], notReady: [], counts: {} };
  const out = [`# Ready to convert — ${d.generatedAt || ""}`.trim(), ""];
  if (!arr(d.ready).length) {
    out.push(CONVERSION_DIGEST_EMPTY, "");
  } else {
    for (const r of d.ready) {
      out.push(`## ${r.org || r.key}`);
      out.push(`- Proof: ${r.proof.summary}`);
      out.push(`- Time to first value: ${r.ttfvLabel}`);
      out.push(`- Next (staged, not sent): ${r.moment.action}`);
      out.push("");
    }
  }
  if (arr(d.notReady).length) {
    out.push("## Not asked (honest reasons)", "");
    for (const n of d.notReady) out.push(`- ${n.org || n.key}: ${n.reason} -> ${n.action}`);
    out.push("");
  }
  return out.join("\n");
}
