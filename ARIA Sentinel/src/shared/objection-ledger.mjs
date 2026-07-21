// RUN-H H2 — OBJECTION LEDGER, ANSWERED ONLY FROM REAL MATERIAL (pure, local-only, Rule 14).
// Maps the objections we have ACTUALLY recorded to an honest answer and the exact in-repo artifact
// that backs it. An objection with no backing artifact is shown as OPEN with the gap named - it is
// never answered with confident copy we cannot support.
//
// Honesty invariants (Rule 14):
//   - AN ANSWER REQUIRES AN ARTIFACT. Every answered objection cites an artifact path, and that path
//     must be confirmed to exist by the caller-supplied `artifactExists` predicate. Unconfirmed =>
//     status OPEN, answer withheld, gap named. We never ship an answer whose evidence we cannot show.
//   - RECORDED OBJECTIONS ONLY. The ledger reflects objections that were really raised (each carrying
//     the source and the date it was raised). Nothing is invented to look thorough.
//   - NO SPIN. An OPEN objection is printed as plainly as an answered one, with the missing artifact
//     named so it can be built. Gaps are the point of the ledger, not an embarrassment to hide.
//   - Nothing executes: no network, no spawn, no filesystem reach (static-scan locked in the test).
//     The module does not read the disk itself - existence is supplied, so the module stays pure.
//   - Rule 15 additive: no existing console, board, or surface is modified.

export const OBJECTION_LEDGER_SCHEMA = "objection-ledger.v1";

export const LEDGER_EMPTY =
  "No objections have actually been recorded yet - honestly empty. This ledger lists only objections a real prospect really raised, with the date and where it was raised. Nothing is pre-filled to look prepared.";

export const OPEN_PREFIX = "OPEN - no backing artifact yet:";

/** The canonical objection kinds we know how to answer, each bound to the artifact that must back it. */
export const ANSWER_MAP = {
  price: {
    answer:
      "We publish the plan and price; there is no custom quote games. Compare it against what the pilot actually delivered for you - the numbers in your proof pack are your own records.",
    artifactKind: "published plan + this customer's proof pack",
  },
  "switching-risk": {
    answer:
      "The pilot runs alongside what you have. Nothing is cut over until you have seen real resolved tickets in your own system, and the pack lists every one by id.",
    artifactKind: "pilot scope doc + proof pack",
  },
  "lock-in": {
    answer:
      "Your data and your ticket history stay yours and are exportable. The exit path is written down before you start, not negotiated later.",
    artifactKind: "data export / exit policy doc",
  },
  "already-have-someone": {
    answer:
      "Then we do not replace them - we take the repeatable first-line volume that is eating their hours, and the delivery-leverage numbers show whether that actually happened.",
    artifactKind: "delivery-leverage board output",
  },
  "security-compliance": {
    answer:
      "Consent gating, redaction, and an audit trail are built into the product, not promised in a slide. The controls are in the repo and testable.",
    artifactKind: "security/consent + audit modules and their tests",
  },
};

// -- 1. Normalize a recorded objection ----------------------------------------------------------------
export function normalizeObjection(raw = {}) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "malformed objection record" };
  const kind = String(raw.kind || "").trim().toLowerCase();
  if (!kind) return { ok: false, reason: "no objection kind - cannot be answered blind" };
  if (!Object.prototype.hasOwnProperty.call(ANSWER_MAP, kind)) {
    return { ok: false, reason: 'unknown objection kind "' + kind + '" - listed as unhandled rather than guessed at' };
  }
  const source = typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : null;
  const raisedAt = raw.raisedAt && !Number.isNaN(Date.parse(raw.raisedAt)) ? new Date(Date.parse(raw.raisedAt)).toISOString() : null;
  if (!source || !raisedAt) {
    return { ok: false, reason: "no real source + date - an objection nobody actually raised is not recorded" };
  }
  return {
    ok: true,
    value: {
      kind,
      source,
      raisedAt,
      artifact: typeof raw.artifact === "string" && raw.artifact.trim() ? raw.artifact.trim() : null,
      quote: typeof raw.quote === "string" && raw.quote.trim() ? raw.quote.trim() : null,
    },
  };
}

// -- 2. Resolve one objection against real artifacts ---------------------------------------------------
export function resolveObjection(objection, artifactExists) {
  const spec = ANSWER_MAP[objection.kind];
  const exists = typeof artifactExists === "function" ? artifactExists(objection.artifact) === true : false;
  if (!objection.artifact) {
    return {
      ...objection,
      status: "open",
      answer: null,
      gap: OPEN_PREFIX + " no artifact was cited for this objection. Needed: " + spec.artifactKind + ".",
    };
  }
  if (!exists) {
    return {
      ...objection,
      status: "open",
      answer: null,
      gap: OPEN_PREFIX + ' the cited artifact "' + objection.artifact + '" does not exist in the repo. Needed: ' + spec.artifactKind + ".",
    };
  }
  return { ...objection, status: "answered", answer: spec.answer, gap: null };
}

// -- 3. The ledger -------------------------------------------------------------------------------------
export function buildObjectionLedger(input = {}, { now = Date.now(), artifactExists = null } = {}) {
  const list = Array.isArray(input) ? input : (input && Array.isArray(input.objections) ? input.objections : []);
  const entries = [];
  const excluded = [];
  for (const raw of list) {
    const n = normalizeObjection(raw);
    if (!n.ok) {
      excluded.push({ kind: (raw && raw.kind) || "(missing kind)", reason: n.reason });
      continue;
    }
    entries.push(resolveObjection(n.value, artifactExists));
  }
  entries.sort((a, b) => Date.parse(a.raisedAt) - Date.parse(b.raisedAt));
  const answered = entries.filter((e) => e.status === "answered");
  const open = entries.filter((e) => e.status === "open");
  return {
    schema: OBJECTION_LEDGER_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    entries,
    answeredCount: answered.length,
    openCount: open.length,
    excluded,
    empty: entries.length === 0,
    emptyCopy: entries.length === 0 ? LEDGER_EMPTY : null,
  };
}

// -- 4. Markdown - gaps printed as plainly as wins ------------------------------------------------------
export function objectionLedgerMarkdown(ledger) {
  if (!ledger || ledger.schema !== OBJECTION_LEDGER_SCHEMA) return LEDGER_EMPTY;
  const out = ["# Objection ledger", ""];
  if (ledger.empty) {
    out.push(ledger.emptyCopy || LEDGER_EMPTY);
    return out.join("\n");
  }
  out.push("Answered: " + ledger.answeredCount + " · Open (no backing artifact): " + ledger.openCount + ".");
  out.push("");
  out.push("| Objection | Raised | Status | Answer or gap | Artifact |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const e of ledger.entries) {
    const body = e.status === "answered" ? e.answer : e.gap;
    out.push("| " + e.kind + " | " + e.source + " " + e.raisedAt + " | " + e.status + " | " + body + " | " + (e.artifact || "-") + " |");
  }
  if (ledger.excluded.length) {
    out.push("");
    out.push("Not recorded (stated, not silently dropped): " + ledger.excluded.map((x) => x.kind + " - " + x.reason).join("; ") + ".");
  }
  return out.join("\n");
}
