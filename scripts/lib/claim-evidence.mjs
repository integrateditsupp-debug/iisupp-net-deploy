// claim-evidence.mjs — a claim must carry its evidence, and a claim older than its class allows
// must SAY it is old rather than read as though it were measured a moment ago.
//
// WHY THIS EXISTS (RUN-AK / AK1 + AK2, 2026-08-05).
// RUN-AI found a single assertion — "12 follow-ups drafted, awaiting one click" — that had ridden
// for fourteen days with nothing behind it. RUN-AJ made that ONE class of assertion unwritable
// (staged-action-guard.mjs: a staged action must name the artefact it acts on).
//
// The shape, though, is older than the follow-ups. The program asserts many other things — test
// counts, ahead-counts, blocker states, lane states, "still green", "still refused" — and most of
// those live in prose that no test reads. Two properties were missing:
//
//   1. EVIDENCE. A number in the payload did not have to say where it came from or when it was
//      measured, so a figure copied forward from six cycles ago was indistinguishable from one read
//      out of an exit code this cycle.
//   2. AGE. Even with a timestamp, nothing rendered the age, so staleness was inferable at best.
//
// This module supplies both. Every claim is `{ value, measuredAt, source }` plus a class that sets
// how long the claim stays fresh. An unstamped claim is REFUSED (it cannot be published at all). A
// stamped-but-old claim is LABELLED stale and kept — never dropped, because a claim that quietly
// disappears is worse than one that visibly aged. Deletion hides; a stale label accuses.
//
// Pure: no I/O, no network, no clock except the `now` passed in (defaults to real time).
export const CLAIM_EVIDENCE_SCHEMA = "claim-evidence.v1";
export const SENDS = false;
export const WRITES = false;

// Failure classes. Named so a red test says WHICH dishonesty it caught, never just "invalid".
export const CLASSES = Object.freeze({
  OK: "evidence-stamped",
  NOT_AN_OBJECT: "claim-is-not-a-stamp-object",
  NO_VALUE: "claim-has-no-value",
  NO_MEASURED_AT: "claim-has-no-measuredAt",
  BAD_MEASURED_AT: "measuredAt-is-not-an-iso-instant",
  FUTURE_MEASURED_AT: "measuredAt-is-in-the-future",
  NO_SOURCE: "claim-does-not-name-its-source",
  UNKNOWN_KIND: "claim-kind-is-not-declared",
});

// How long a claim of each kind stays fresh. A test count measured last cycle is already suspect;
// a blocker state changes slowly enough that three cycles is honest. One cycle ≈ 24h in practice.
export const MAX_AGE_HOURS = Object.freeze({
  test: 24,        // suite counts / green-ness — re-read every cycle or say so
  count: 24,       // ahead-counts, queue depths, draft counts
  measurement: 24, // anything read out of an exit code or a file this cycle
  blocker: 72,     // a hard stop (credential refusal, desktop grant) moves slowly
  lane: 72,        // build-lane state
  fact: 8760,      // things that do not decay (a date something was created)
});
export const DEFAULT_KIND = "measurement";

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Convenience constructor so callers cannot forget a field by accident. */
export function stamp(value, { measuredAt, source, kind = DEFAULT_KIND, note } = {}) {
  const out = { value, measuredAt: measuredAt || new Date().toISOString(), source, kind };
  if (note) out.note = note;
  return out;
}

/**
 * Audit one claim. Returns { name, ok, class, detail }.
 * A claim is `{ value, measuredAt, source, kind? }`. Everything is required except kind,
 * which defaults to `measurement` — but an EXPLICIT kind that is not in MAX_AGE_HOURS is a
 * failure, not a silent fallback: an undeclared freshness policy is not a freshness policy.
 */
export function auditClaim(name, claim, { now = new Date() } = {}) {
  const fail = (cls, detail) => ({ name, ok: false, class: cls, detail });
  if (!isPlainObject(claim)) {
    return fail(CLASSES.NOT_AN_OBJECT, `"${name}" is a bare ${Array.isArray(claim) ? "array" : typeof claim} — a published figure must be { value, measuredAt, source }`);
  }
  if (!("value" in claim)) return fail(CLASSES.NO_VALUE, `"${name}" carries a stamp but no value`);
  if (!claim.measuredAt) return fail(CLASSES.NO_MEASURED_AT, `"${name}" does not say when it was measured`);
  if (typeof claim.measuredAt !== "string" || !ISO_INSTANT.test(claim.measuredAt)) {
    return fail(CLASSES.BAD_MEASURED_AT, `"${name}" measuredAt ${JSON.stringify(claim.measuredAt)} is not an ISO instant`);
  }
  const measured = new Date(claim.measuredAt);
  if (Number.isNaN(measured.getTime())) {
    return fail(CLASSES.BAD_MEASURED_AT, `"${name}" measuredAt ${JSON.stringify(claim.measuredAt)} does not parse`);
  }
  // A minute of tolerance for clock skew between the emitter and whatever produced the figure.
  if (measured.getTime() - new Date(now).getTime() > 60_000) {
    return fail(CLASSES.FUTURE_MEASURED_AT, `"${name}" claims to have been measured in the future (${claim.measuredAt})`);
  }
  if (typeof claim.source !== "string" || claim.source.trim() === "") {
    return fail(CLASSES.NO_SOURCE, `"${name}" does not name where the figure came from`);
  }
  if ("kind" in claim && !(claim.kind in MAX_AGE_HOURS)) {
    return fail(CLASSES.UNKNOWN_KIND, `"${name}" declares kind "${claim.kind}", which has no freshness policy — add one to MAX_AGE_HOURS or use a declared kind`);
  }
  return { name, ok: true, class: CLASSES.OK, detail: null };
}

/** Audit a whole `claims` map. Returns { ok, audited[], failures[] }. */
export function auditClaims(claims = {}, { now = new Date() } = {}) {
  if (!isPlainObject(claims)) {
    const f = { name: "(claims)", ok: false, class: CLASSES.NOT_AN_OBJECT, detail: "claims must be an object of name → stamp" };
    return { ok: false, audited: [f], failures: [f] };
  }
  const audited = Object.entries(claims).map(([name, claim]) => auditClaim(name, claim, { now }));
  const failures = audited.filter((a) => !a.ok);
  return { ok: failures.length === 0, audited, failures };
}

/** Throwing form — this is what the emitter calls, so an unstamped figure cannot be published. */
export function requireStampedClaims(claims = {}, { now = new Date() } = {}) {
  const { ok, failures } = auditClaims(claims, { now });
  if (!ok) {
    throw new Error(
      `claim evidence REFUSED — ${failures.length} claim(s) cannot be published without evidence: ` +
      failures.map((f) => `${f.name} [${f.class}] ${f.detail}`).join("; ")
    );
  }
  return true;
}

export function ageHours(claim, now = new Date()) {
  const ms = new Date(now).getTime() - new Date(claim.measuredAt).getTime();
  return Math.max(0, ms / 3_600_000);
}

export function maxAgeHoursFor(claim) {
  return MAX_AGE_HOURS[claim?.kind || DEFAULT_KIND] ?? MAX_AGE_HOURS[DEFAULT_KIND];
}

/**
 * AK2 — make staleness VISIBLE. Returns a new claims map where every claim gains
 * `ageHours`, `maxAgeHours`, `stale`, and — when stale — a human `staleLabel`.
 * Nothing is ever removed: a dropped claim is a claim nobody can challenge.
 */
export function annotateStaleness(claims = {}, { now = new Date() } = {}) {
  const out = {};
  for (const [name, claim] of Object.entries(claims)) {
    if (!isPlainObject(claim)) { out[name] = claim; continue; }
    const age = ageHours(claim, now);
    const max = maxAgeHoursFor(claim);
    const stale = age > max;
    out[name] = {
      ...claim,
      ageHours: Math.round(age * 10) / 10,
      maxAgeHours: max,
      stale,
    };
    if (stale) {
      out[name].staleLabel =
        `STALE — measured ${Math.round(age)}h ago (${claim.kind || DEFAULT_KIND} claims go stale after ${max}h); ` +
        `carried forward unverified, not re-measured this cycle`;
    }
  }
  return out;
}

/** Every claim currently labelled stale, for a caller that wants to report the list. */
export function staleClaims(annotated = {}) {
  return Object.entries(annotated)
    .filter(([, c]) => isPlainObject(c) && c.stale)
    .map(([name, c]) => ({ name, ageHours: c.ageHours, maxAgeHours: c.maxAgeHours, source: c.source }));
}

/** One-shot: refuse unstamped, then label the stale. This is the emitter's whole contract. */
export function auditAndAnnotate(claims = {}, { now = new Date() } = {}) {
  requireStampedClaims(claims, { now });
  const annotated = annotateStaleness(claims, { now });
  return { claims: annotated, stale: staleClaims(annotated) };
}
