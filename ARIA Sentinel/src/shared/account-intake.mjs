// account-intake.mjs — RUN-N N1: THE REAL-INPUT INTAKE PATH
//
// WHY (RUN-N, 2026-07-28): M1 refuses to name an ask-ready account, and it is RIGHT to refuse —
// there is no real demand record with real engagement minutes and an earned proof pack behind it.
// Thirteen sequences of machinery, zero asks sent, zero dollars received. The gap is no longer
// engineering: it is that no ONE real account has ever been recorded end to end. N1 is that path.
//
// It is a recording surface, not a generator. Every field is either entered by a human WITH a
// source, or it stays empty. Nothing is defaulted, inferred, backdated, or rounded into existence.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EVERY FACT CARRIES A SOURCE. A value without `source` is refused and named, never accepted
//     "just this once". An unsourced number is exactly the fabricated metric Rule 14 forbids.
//   - NOTHING IS BACKDATED OR INFERRED. A timestamp must parse and must not be in the future
//     relative to the observed clock. A missing timestamp stays missing; it is never "about then".
//   - MISSING FIELDS ARE NAMED IN M1'S OWN GATE VOCABULARY. GATES/GATE_KEYS are IMPORTED from
//     ask-ready-queue.mjs, never re-declared here, so the two can never drift apart.
//   - AN EMPTY INTAKE IS A VALID STATE and says so plainly. Zero recorded accounts reads as zero.
//   - Rule 15 additive: M1/M2/M3, the L1 conveyor, the H1 pack and the L3 floor are untouched
//     read-only collaborators. N1 only produces input for them.
//   - Nothing sends, signs, prices externally, charges, or reaches the network/filesystem.
//   - Vault Rule 11 / privacy: this module never persists anything. Real names and addresses live
//     in the operator's own untracked state and CRM, never in a tracked or serveable path.

import { GATES, GATE_KEYS } from "./ask-ready-queue.mjs";

export const ACCOUNT_INTAKE_SCHEMA = "account-intake.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const EMPTY_STATEMENT =
  "0 real accounts recorded — honestly empty. The intake is OPEN, not fake: one real account, entered by a human with a source for every fact, is all that is missing.";

export const PRIVACY_NOTE =
  "LOCAL ONLY. Real names, emails and companies stay in the operator's untracked state and CRM — never in a tracked or serveable path (vault Rule 11).";

export const NO_BACKDATE_NOTE =
  "Timestamps are recorded as observed. Nothing is inferred, nothing is backdated, a future timestamp is refused.";

// Re-exported so a caller never has to reach past N1 for the vocabulary, and so a drift between
// N1's language and M1's gates would break the test rather than mislead a human.
export { GATES, GATE_KEYS };

const KIND_TO_GATE = {
  demand: "demand",
  engagement: "engagement",
  evidence: "evidence",
  priced: "priced",
};

function gateMissingText(key) {
  const g = GATES.find((x) => x.key === key);
  return g ? g.missing : "unknown gate";
}

function nonEmptyString(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function sourced(v) {
  return !!(v && typeof v === "object" && nonEmptyString(v.source, 2));
}

// A timestamp is real only if it parses AND is not in the future against the observed clock.
function realTime(v, now) {
  if (typeof v !== "string" || !v.trim()) return { ok: false, why: "missing" };
  const t = Date.parse(v);
  if (Number.isNaN(t)) return { ok: false, why: "unparseable" };
  if (t > now) return { ok: false, why: "in the future — never recorded ahead of the clock" };
  return { ok: true, t };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * input: {
 *   account: {
 *     key,                                  // stable identity for this account
 *     demandSignal: { id, kind, source, firstSeenAt, email|domain|company, ... },
 *     engagements: [ { id, at, durationMinutes, source } ],
 *     costBasis: { sourceId, monthlyOperatorCostCad, monthlyAvailableMinutes },
 *     quoteCad?, quoteSource?                // optional at intake; M1 gate 4 needs it later
 *   }
 * }
 * Every sub-record is validated independently. A record that fails is EXCLUDED and named —
 * never silently repaired, never partially accepted.
 */
export function buildAccountIntake(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: ACCOUNT_INTAKE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    privacyNote: PRIVACY_NOTE,
    noBackdateNote: NO_BACKDATE_NOTE,
  };

  const src = input && typeof input === "object" ? input : {};
  const accounts = Array.isArray(src.accounts)
    ? src.accounts
    : (src.account && typeof src.account === "object" ? [src.account] : []);

  if (accounts.length === 0) {
    return {
      ...base,
      empty: true,
      statement: EMPTY_STATEMENT,
      records: [],
      excluded: [],
      counts: { total: 0, recorded: 0, complete: 0, incomplete: 0, excluded: 0 },
    };
  }

  const records = [];
  const excluded = [];

  for (const a of accounts) {
    if (!a || typeof a !== "object" || !nonEmptyString(a.key, 1)) {
      excluded.push({ key: (a && a.key) || "(missing key)", why: "no account key — an unidentified account cannot be recorded honestly" });
      continue;
    }

    const key = a.key.trim();
    const problems = [];
    const missingGates = [];

    // --- gate 1 input: the demand signal -------------------------------------------------------
    let demandSignal = null;
    const ds = a.demandSignal;
    if (!ds || typeof ds !== "object") {
      missingGates.push("demand");
    } else if (!nonEmptyString(ds.id)) {
      problems.push({ field: "demandSignal.id", why: "no signal id" });
      missingGates.push("demand");
    } else if (!nonEmptyString(ds.source, 2)) {
      problems.push({ field: "demandSignal.source", why: "no source — an unsourced signal is not a lead" });
      missingGates.push("demand");
    } else {
      const seen = realTime(ds.firstSeenAt, now);
      if (!seen.ok) {
        problems.push({ field: "demandSignal.firstSeenAt", why: `timestamp ${seen.why}` });
        missingGates.push("demand");
      } else {
        demandSignal = {
          id: ds.id.trim(),
          kind: nonEmptyString(ds.kind) ? ds.kind.trim() : null,
          source: ds.source.trim(),
          firstSeenAt: new Date(seen.t).toISOString(),
          email: nonEmptyString(ds.email) ? ds.email.trim() : null,
          domain: nonEmptyString(ds.domain) ? ds.domain.trim() : null,
          company: nonEmptyString(ds.company) ? ds.company.trim() : null,
        };
        if (!demandSignal.email && !demandSignal.domain && !demandSignal.company) {
          problems.push({ field: "demandSignal.identity", why: "no email, domain or company — cannot be deduped honestly" });
          missingGates.push("demand");
          demandSignal = null;
        }
      }
    }

    // --- gate 2 input: real engagement events --------------------------------------------------
    const engagements = [];
    const rawEngagements = Array.isArray(a.engagements) ? a.engagements : [];
    for (const e of rawEngagements) {
      if (!e || typeof e !== "object" || !nonEmptyString(e.id)) {
        problems.push({ field: "engagements[].id", why: "engagement with no id — excluded, never counted" });
        continue;
      }
      const at = realTime(e.at, now);
      if (!at.ok) {
        problems.push({ field: `engagements[${e.id}].at`, why: `timestamp ${at.why} — excluded, never backdated` });
        continue;
      }
      if (!sourced(e)) {
        problems.push({ field: `engagements[${e.id}].source`, why: "no source for this event — excluded rather than assumed" });
        continue;
      }
      const mins = Number(e.durationMinutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        problems.push({ field: `engagements[${e.id}].durationMinutes`, why: "no real observed duration — minutes are never estimated" });
        continue;
      }
      engagements.push({
        id: e.id.trim(),
        at: new Date(at.t).toISOString(),
        durationMinutes: round2(mins),
        source: e.source.trim(),
      });
    }
    engagements.sort((x, y) => Date.parse(x.at) - Date.parse(y.at) || x.id.localeCompare(y.id));
    if (engagements.length === 0) missingGates.push("engagement");

    // --- gate 3 input: the evidence base is the engagements above ------------------------------
    // N1 does not build the H1 pack — earning it is H1's job on these records. N1 only reports
    // whether there is anything real for it to be earned FROM.
    const evidenceBase = engagements.length;
    if (evidenceBase === 0) missingGates.push("evidence");

    // --- gate 4 input: the recorded operator cost basis + optional quote ------------------------
    let costBasis = null;
    const cb = a.costBasis;
    if (!cb || typeof cb !== "object") {
      missingGates.push("priced");
    } else {
      const cost = Number(cb.monthlyOperatorCostCad);
      const avail = Number(cb.monthlyAvailableMinutes);
      if (!nonEmptyString(cb.sourceId, 2)) {
        problems.push({ field: "costBasis.sourceId", why: "no source for the cost basis — a floor built on an unsourced cost is a fabricated floor" });
        missingGates.push("priced");
      } else if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(avail) || avail <= 0) {
        problems.push({ field: "costBasis", why: "cost and available minutes must both be real positive observed numbers" });
        missingGates.push("priced");
      } else {
        costBasis = {
          sourceId: cb.sourceId.trim(),
          monthlyOperatorCostCad: round2(cost),
          monthlyAvailableMinutes: round2(avail),
        };
      }
    }

    let quoteCad = null;
    const q = Number(a.quoteCad);
    if (a.quoteCad !== undefined && a.quoteCad !== null && a.quoteCad !== "") {
      if (!Number.isFinite(q) || q <= 0) {
        problems.push({ field: "quoteCad", why: "quote is not a real positive number" });
        if (!missingGates.includes("priced")) missingGates.push("priced");
      } else if (!nonEmptyString(a.quoteSource, 2)) {
        problems.push({ field: "quoteSource", why: "no source for the quote — an unsourced price cannot be defended to a buyer" });
        if (!missingGates.includes("priced")) missingGates.push("priced");
      } else {
        quoteCad = round2(q);
      }
    } else if (!missingGates.includes("priced")) {
      missingGates.push("priced");
    }

    // Deterministic gate order, deduped — same vocabulary M1 uses, in M1's order.
    const missing = GATE_KEYS.filter((k) => missingGates.includes(KIND_TO_GATE[k] || k));
    const complete = missing.length === 0;

    records.push({
      key,
      complete,
      missing,
      missingText: missing.map(gateMissingText),
      demandSignal,
      engagements,
      engagementMinutes: round2(engagements.reduce((s, e) => s + e.durationMinutes, 0)),
      evidenceBase,
      costBasis,
      quoteCad,
      quoteSource: quoteCad === null ? null : String(a.quoteSource).trim(),
      problems,
    });
  }

  records.sort((a, b) => (Number(b.complete) - Number(a.complete)) || a.key.localeCompare(b.key));

  const completeCount = records.filter((r) => r.complete).length;
  const statement = records.length === 0
    ? EMPTY_STATEMENT
    : `${records.length} account(s) recorded from real, sourced input. ${completeCount} carry every field M1's four gates need; ${records.length - completeCount} name exactly what is still missing.`;

  return {
    ...base,
    empty: records.length === 0,
    statement,
    records,
    excluded,
    counts: {
      total: accounts.length,
      recorded: records.length,
      complete: completeCount,
      incomplete: records.length - completeCount,
      excluded: excluded.length,
    },
  };
}

/** The single record for one key, or null. Never a nearest match. */
export function intakeRecord(intake, key) {
  if (!intake || intake.schema !== ACCOUNT_INTAKE_SCHEMA) return null;
  return (intake.records || []).find((r) => r.key === key) || null;
}

/**
 * What is still missing for THIS account to clear M1's four gates, in M1's own words.
 * Returns [] only when the record is complete. An unknown key is honestly "no record".
 */
export function missingForAskReady(intake, key) {
  const rec = intakeRecord(intake, key);
  if (!rec) {
    return [{ gate: "demand", text: gateMissingText("demand"), note: "no intake record for this account at all" }];
  }
  return rec.missing.map((g) => ({ gate: g, text: gateMissingText(g), note: null }));
}

export function accountIntakeMarkdown(intake) {
  if (!intake || intake.schema !== ACCOUNT_INTAKE_SCHEMA) return "_no intake_";
  const lines = ["## Account intake (real input only)", "", intake.statement, ""];
  if (intake.empty) {
    lines.push("_" + PRIVACY_NOTE + "_", "");
    return lines.join("\n");
  }
  for (const r of intake.records) {
    lines.push(`### ${r.key} — ${r.complete ? "all four gates have real input" : "incomplete"}`);
    lines.push(`- engagements: ${r.engagements.length} (${r.engagementMinutes} observed minutes)`);
    lines.push(`- quote: ${r.quoteCad === null ? "_none recorded_" : r.quoteCad + " CAD"}`);
    if (!r.complete) for (const m of r.missingText) lines.push(`- MISSING: ${m}`);
    for (const p of r.problems) lines.push(`- excluded: ${p.field} — ${p.why}`);
    lines.push("");
  }
  lines.push("_" + PRIVACY_NOTE + "_");
  lines.push("_" + NO_BACKDATE_NOTE + "_");
  return lines.join("\n");
}
