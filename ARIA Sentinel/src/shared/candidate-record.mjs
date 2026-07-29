// candidate-record.mjs — RUN-Q Q1: THE CANDIDATE RECORD.
//
// WHY (RUN-Q, 2026-07-28): RUN-P finished the software. The chain renders an ask, stages it for a
// human, and refuses to do either for a fixture — all correct. The consequence is that the whole
// revenue machine is idle for want of ONE asserted, real, named account. Today "find a buyer" is a
// feeling, not a process: there is nowhere to put a candidate, no rule for what makes one worth an
// hour, and no way to see the list is empty without it looking like failure rather than an accurate
// reading. Q1 is the place to put one.
//
// It is a RECORDING surface, not a generator. It cannot find, scrape, enrich, guess or buy a name.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EVERY FIELD CARRIES ITS OWN NAMED PROVENANCE. Where the name came from, where the address came
//     from, why they are believed to have the problem — each stated separately. A field without a
//     source is REFUSED BY NAME, never stored "provisionally".
//   - NO FIELD MAY BE INFERRED FROM ANOTHER. A provenance that admits inference ("guessed", "same
//     pattern as", "from the domain") is refused by name. An inferred contact address is a
//     fabrication wearing a field's clothes — the most tempting lie in this system, refused hardest.
//   - A SCRAPED NAME IS NOT A LEAD. `enteredBy` must name a human. There is no automated path in.
//   - ZERO CANDIDATES IS AN HONEST, NON-APOLOGETIC STATE and says exactly what a first entry needs.
//   - PURE + LOCAL. No fs, no net, no spawn, no env, no persistence. This module writes nothing
//     anywhere; the caller holds the record in untracked operator state (vault Rule 11).
//   - Rule 15 additive: nothing existing is replaced. N1/M1/M2/M3/P1/P2 are untouched.

export const CANDIDATE_RECORD_SCHEMA = "candidate-record.v1";

// Belt-and-braces, asserted by the test. None of these can flip true anywhere in this module.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// This module cannot reach anything. Stated as constants so a test asserts rather than trusts.
export const PERSISTS = false;
export const HAS_TRANSPORT = false;
export const TRACKED = false;
export const SERVEABLE = false;

export const PRIVACY_NOTE =
  "LOCAL ONLY. A candidate's real name, address and company live in the operator's own untracked " +
  "state and CRM - never in a tracked path, never in a serveable path, never in a vault note " +
  "(vault Rule 11). This module holds nothing and writes nothing.";

export const NO_AUTOMATION_NOTE =
  "Entered by a human, one at a time. There is no import, no scrape, no enrichment and no purchase " +
  "path into this record - by design, and free-only besides.";

// The empty state. An accurate reading, not a failure, and it refuses to apologise for itself.
export const EMPTY_STATEMENT =
  "0 candidates recorded - honestly empty. This is an accurate reading, not a failure: no one has " +
  "yet been written down. A first entry needs three things a human already knows or can find out in " +
  "an hour: a name, a contact address with its own separate source, and one sentence on why they " +
  "are believed to have the problem we solve.";

// The things a first entry needs, named once so the empty state, the refusals and every surface
// speak the same vocabulary and cannot drift apart.
export const REQUIRED_FIELDS = Object.freeze([
  Object.freeze({
    key: "name",
    label: "Name",
    asks: "The person or organisation someone could actually approach.",
    missing: "no name - a candidate no one can name is not a candidate",
  }),
  Object.freeze({
    key: "contact",
    label: "Contact address",
    asks: "A real address, observed somewhere real, with its own separate source.",
    missing: "no contact address - and one may never be constructed from the name or the domain",
  }),
  Object.freeze({
    key: "problemBasis",
    label: "Why they are believed to have the problem",
    asks: "One sentence, and the thing that was actually seen or heard behind it.",
    missing: "no stated basis - 'they look like a fit' is a feeling, not a record",
  }),
]);

export const REQUIRED_KEYS = Object.freeze(REQUIRED_FIELDS.map((f) => f.key));

// Language that ADMITS the value was produced rather than observed. Any of these in a provenance is
// an inference confessing itself, and it is refused by name rather than accepted and flagged.
export const INFERENCE_MARKERS = Object.freeze([
  "guess", "guessed", "inferred", "infer", "assumed", "assumption", "derived",
  "pattern", "same format", "same as", "constructed", "generated", "likely",
  "probably", "typical", "standard format", "usual format", "best guess",
  "extrapolat", "estimated from", "based on the domain", "from the domain",
]);

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function norm(v) {
  return typeof v === "string" ? v.trim() : "";
}

function labelOf(key) {
  const f = REQUIRED_FIELDS.find((x) => x.key === key);
  return f ? f.label : key;
}

function missingOf(key) {
  const f = REQUIRED_FIELDS.find((x) => x.key === key);
  return f ? f.missing : `no ${key}`;
}

/** A provenance is real only if a human wrote a specific sentence about where the value came from. */
function sourceProblem(key, field) {
  if (!field || typeof field !== "object") return `${labelOf(key)}: ${missingOf(key)}`;
  if (!nonEmpty(field.value)) return `${labelOf(key)}: ${missingOf(key)}`;
  if (!nonEmpty(field.source, 8)) {
    return `${labelOf(key)}: refused - the value is present but its provenance is not stated. ` +
      "Say where it came from in a sentence, or leave the field empty.";
  }
  const s = norm(field.source).toLowerCase();
  const marker = INFERENCE_MARKERS.find((m) => s.includes(m));
  if (marker) {
    return `${labelOf(key)}: refused - the stated provenance admits inference ("${marker}"). ` +
      "An inferred value is a fabrication with a source line attached; it is never stored " +
      "provisionally. Observe it somewhere real or leave it empty.";
  }
  return null;
}

/**
 * No field may be inferred from another. If one field's provenance quotes another field of the SAME
 * record - "derived from the name", "the company domain" - the record is refused and the pair is
 * named, so a human sees exactly which two fields were about to be laundered into each other.
 */
function crossFieldProblem(key, field, all) {
  const s = norm(field && field.source).toLowerCase();
  if (!s) return null;
  for (const other of REQUIRED_KEYS) {
    if (other === key) continue;
    const otherVal = norm(all[other] && all[other].value).toLowerCase();
    if (otherVal.length >= 4 && s.includes(otherVal)) {
      return `${labelOf(key)}: refused - its provenance quotes the ${labelOf(other)} field of this ` +
        "same record. One recorded fact may not stand as the source of another.";
    }
  }
  return null;
}

/**
 * Record one candidate.
 *
 * input: {
 *   key,                                   // stable local handle, e.g. "cand-001" (vault Rule 11)
 *   enteredBy,                             // a named human - there is no automated path in
 *   name:         { value, source },
 *   contact:      { value, source },
 *   problemBasis: { value, source },
 *   notes?                                 // free text, never a substitute for a provenance
 * }
 *
 * Returns the record, or a refusal naming EVERY failing field (never just the first - a human who
 * fixes one field and is then told about a second has been made to work twice).
 * It returns; it never writes. Writing is the caller's job, into untracked operator state.
 */
export function recordCandidate(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const base = {
    schema: CANDIDATE_RECORD_SCHEMA,
    recordedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    persists: PERSISTS,
    tracked: TRACKED,
    serveable: SERVEABLE,
    privacyNote: PRIVACY_NOTE,
  };

  const fields = {};
  for (const k of REQUIRED_KEYS) fields[k] = src[k] && typeof src[k] === "object" ? src[k] : null;

  const refusals = [];

  if (!nonEmpty(src.key, 2)) {
    refusals.push(
      'Local handle: refused - a candidate needs a stable local handle (e.g. "cand-001"). ' +
      "Real names are the operator's business, not the record's identity (vault Rule 11).");
  }
  if (!nonEmpty(src.enteredBy, 2)) {
    refusals.push(`Entered by: refused - name the human who entered this. ${NO_AUTOMATION_NOTE}`);
  }

  for (const k of REQUIRED_KEYS) {
    const p = sourceProblem(k, fields[k]);
    if (p) { refusals.push(p); continue; }
    const x = crossFieldProblem(k, fields[k], fields);
    if (x) refusals.push(x);
  }

  if (refusals.length) {
    return {
      ...base,
      recorded: false,
      refused: true,
      candidate: null,
      refusedFields: refusals.slice(),
      refusal: `Candidate refused - ${refusals.length} field(s) cannot be recorded as stated. ` +
        "Nothing was kept, not even the parts that passed.",
    };
  }

  const candidate = {
    key: norm(src.key),
    enteredBy: norm(src.enteredBy),
    recordedAt: base.recordedAt,
    // Value and provenance travel together, always, so no consumer can read one without the other.
    name: { value: norm(fields.name.value), source: norm(fields.name.source) },
    contact: { value: norm(fields.contact.value), source: norm(fields.contact.source) },
    problemBasis: { value: norm(fields.problemBasis.value), source: norm(fields.problemBasis.source) },
    notes: nonEmpty(src.notes) ? norm(src.notes) : null,
    // A candidate is NOT an account and NOT a lead in any pipeline sense. Q3 carries it to N1;
    // only a human ever asserts the account is real.
    realAccount: false,
    asked: false,
    sent: SENT,
  };

  return { ...base, recorded: true, refused: false, candidate, refusedFields: [], refusal: null };
}

/**
 * The list. Zero renders as zero, in plain words, with what a first entry needs.
 * Order is the order they were entered - Q2 does the ranking, and only from recorded facts.
 */
export function buildCandidateList(candidates = [], { now = Date.now() } = {}) {
  const list = Array.isArray(candidates)
    ? candidates.filter((c) => c && c.key && c.name && c.contact && c.problemBasis)
    : [];
  return {
    schema: CANDIDATE_RECORD_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    persists: PERSISTS,
    tracked: TRACKED,
    serveable: SERVEABLE,
    count: list.length,
    candidates: list,
    empty: list.length === 0,
    statement: list.length === 0
      ? EMPTY_STATEMENT
      : `${list.length} candidate(s) recorded. A recorded candidate is a name someone can approach - ` +
        "it is not an ask, not a customer and not revenue.",
    privacyNote: PRIVACY_NOTE,
    requiredFields: REQUIRED_FIELDS,
  };
}

export function candidateListMarkdown(list) {
  if (!list || list.schema !== CANDIDATE_RECORD_SCHEMA) return "_no candidate list_\n";
  const out = ["## Candidates", "", list.statement, ""];
  if (list.empty) {
    out.push("A first entry needs:", "");
    for (const f of REQUIRED_FIELDS) out.push(`- **${f.label}** - ${f.asks}`);
    out.push("", `_${PRIVACY_NOTE}_`, "");
    return out.join("\n");
  }
  for (const c of list.candidates) {
    out.push(`- **${c.key}** - recorded by ${c.enteredBy}. Basis: ${c.problemBasis.value}`);
  }
  out.push("", `_${PRIVACY_NOTE}_`, "");
  return out.join("\n");
}
