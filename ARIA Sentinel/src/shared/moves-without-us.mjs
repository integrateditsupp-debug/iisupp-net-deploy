// moves-without-us.mjs — RUN-AB AB3: WHAT WAITS ON A PERSON, AND WHAT DOES NOT.
//
// WHY (RUN-AB, 2026-07-29): this is the surface the whole program has been avoiding. Twenty-seven
// sequences of software have been built. If every open item in the business still moves only when Ahmad
// sits down for an hour, then all of that software changed nothing about the shape of the problem, and the
// correct next action is not another sequence — it is the hour.
//
// The two-column split is the cheapest possible test of that, and it is deliberately hard to pass on the
// right-hand side.
//
// Honesty invariants (Rule 14):
//   - THE RIGHT COLUMN REQUIRES A NAMED, DATED, OBSERVABLE MECHANISM. All three. An item with a mechanism
//     but no date, or a date but no way to observe it, falls to the left column with the missing piece
//     stated. "It should generate leads" is not a mechanism.
//   - SOFTWARE PROGRESS CAN NEVER PLACE AN ITEM ON THE RIGHT. Shipping, merging, testing and deploying are
//     rejected as mechanisms at the door. A test asserts every one of them fails to move an item right.
//   - AN EMPTY RIGHT COLUMN RENDERS AS AN EMPTY RIGHT COLUMN. No consolation line, no "but", no "however
//     the foundation is in place". A test greps the rendering for consolation vocabulary and fails on a hit.
//   - AN ITEM IS NEVER IN BOTH COLUMNS AND NEVER IN NEITHER.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15).

export const MOVES_WITHOUT_US_SCHEMA = "moves-without-us.v1";

export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

export const COL_HUMAN = "moves only when a human spends an hour";
export const COL_SELF = "moves on its own";

export const EMPTY_SELF_COLUMN_LINE =
  "Nothing in this program moves on its own. Every open item waits on one person sitting down.";

export const NO_CONSOLATION_NOTE =
  "That line is the whole finding. It is stated once and nothing is added to soften it, because the " +
  "value of this surface is that it is the one place the program cannot make itself look busy.";

/** Mechanisms that are rejected outright. Building is not a mechanism for anything moving on its own. */
export const REJECTED_MECHANISMS = Object.freeze([
  "shipped", "merged", "built", "tested", "deployed", "committed", "refactored",
  "documented", "staged", "designed", "planned", "sequence completed", "suite green",
  "module written", "feature added", "code exists", "it is live", "the site is up",
]);

// A defect this suite caught on first run (RUN-AB, 2026-07-29): the rejection was a plain substring
// match against the list above, so "the suite is green" — three characters away from "suite green" —
// was promoted into the second column as a real self-moving mechanism. Software progress that only has
// to be rephrased to become a business result is precisely the failure this module exists to prevent.
// The rejection is therefore a vocabulary match, not a phrase match: any mechanism whose text mentions
// our own building, testing, shipping or hosting is rejected however it is worded.
export const REJECTED_VOCABULARY = Object.freeze([
  /\bship(s|ped|ping)?\b/i, /\bmerge(s|d)?\b/i, /\bbuil[dt](s|ing)?\b/i, /\btest(s|ed|ing)?\b/i,
  /\bsuite(s)?\b/i, /\bgreen\b/i, /\bdeploy(s|ed|ment)?\b/i, /\bcommit(s|ted)?\b/i,
  /\brefactor(ed|ing)?\b/i, /\bdocument(ed|ation)?\b/i, /\bstag(e|ed|ing)\b/i,
  /\bdesign(ed)?\b/i, /\bplan(s|ned)?\b/i, /\bsequence(s)?\b/i, /\bmodule(s)?\b/i,
  /\bfeature(s)?\b/i, /\bcode\b/i, /\brepo(sitory)?\b/i, /\bbranch(es)?\b/i,
  /\bis live\b/i, /\bis up\b/i, /\buptime\b/i, /\breachable\b/i, /\bexists\b/i,
  /\bwritten\b/i, /\bcompleted?\b/i, /\bpasses\b/i, /\bversion\b/i, /\brelease(d)?\b/i,
]);

/** Vocabulary the rendering may never contain when the right column is empty. */
export const CONSOLATION_PATTERNS = Object.freeze([
  /\bbut\b/i, /\bhowever\b/i, /\bat least\b/i, /\bfoundation\b/i, /\bgroundwork\b/i,
  /\bpositioned\b/i, /\bready to\b/i, /\bpoised\b/i, /\bonce .* lands\b/i, /\bwill soon\b/i,
  /\bin place for\b/i, /\bsets us up\b/i, /\bthe good news\b/i, /!/,
]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isDate = (v) => isStr(v) && Number.isFinite(Date.parse(v));

/**
 * Classify one item. Returns the column plus the evidence, or the reason it could not go right.
 * An item goes right ONLY with a mechanism that is named, dated, observable, and not a rejected one.
 */
export function classifyItem(item) {
  const handle = isStr(item?.handle) ? item.handle : "unverified";
  const label = isStr(item?.label) ? item.label : "unverified";
  const m = item?.mechanism;

  const missing = [];
  const name = isStr(m?.name) ? m.name.trim() : null;
  const observedAt = isDate(m?.observedAt) ? m.observedAt : null;
  const observable = m?.observable === true && isStr(m?.observableVia);

  if (!name) missing.push("no named mechanism");
  if (!observedAt) missing.push("no date on which it was observed");
  if (!observable) missing.push("no stated way to observe it");

  let rejected = null;
  if (name) {
    rejected = REJECTED_MECHANISMS.find((r) => name.toLowerCase().includes(r.toLowerCase())) || null;
    if (!rejected) {
      const hit = REJECTED_VOCABULARY.find((re) => re.test(name));
      if (hit) rejected = (name.match(hit) || [hit.source])[0];
    }
  }
  if (rejected) missing.push(`mechanism is software progress ("${rejected}"), which never moves an item to the second column`);

  if (missing.length === 0) {
    return Object.freeze({
      handle, label, column: COL_SELF,
      evidence: Object.freeze({ name, observedAt, observableVia: m.observableVia }),
      missing: Object.freeze([]),
    });
  }
  return Object.freeze({
    handle, label, column: COL_HUMAN,
    evidence: null,
    missing: Object.freeze(missing),
  });
}

/** Split every item into exactly two columns. */
export function splitItems(items, { now } = {}) {
  const list = Array.isArray(items) ? items : [];
  const classified = list.map(classifyItem);
  const human = classified.filter((c) => c.column === COL_HUMAN);
  const self = classified.filter((c) => c.column === COL_SELF);

  return Object.freeze({
    schema: MOVES_WITHOUT_US_SCHEMA,
    at: isStr(now) ? now : "unverified",
    total: classified.length,
    human: Object.freeze(human),
    self: Object.freeze(self),
    selfIsEmpty: self.length === 0,
    rejectedMechanisms: REJECTED_MECHANISMS,
  });
}

/** Render the two columns. When the right column is empty it says so and stops. */
export function renderSplit(s) {
  const lines = [];
  lines.push("WHAT WAITS ON A PERSON, AND WHAT DOES NOT");
  lines.push("");
  lines.push(`${s.total} open item(s) as at ${String(s.at).slice(0, 10)}.`);
  lines.push("");
  lines.push(`${COL_HUMAN.toUpperCase()} — ${s.human.length}`);
  if (s.human.length === 0) {
    lines.push("  none");
  } else {
    for (const c of s.human) {
      lines.push(`  ${c.handle}: ${c.label}`);
      for (const r of c.missing) lines.push(`    ${r}`);
    }
  }
  lines.push("");
  lines.push(`${COL_SELF.toUpperCase()} — ${s.self.length}`);
  if (s.selfIsEmpty) {
    lines.push(`  ${EMPTY_SELF_COLUMN_LINE}`);
    lines.push("");
    lines.push(NO_CONSOLATION_NOTE);
    return lines.join("\n");
  }
  for (const c of s.self) {
    lines.push(`  ${c.handle}: ${c.label}`);
    lines.push(`    mechanism: ${c.evidence.name}`);
    lines.push(`    observed:  ${String(c.evidence.observedAt).slice(0, 10)} via ${c.evidence.observableVia}`);
  }
  return lines.join("\n");
}
