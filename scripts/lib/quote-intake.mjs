// quote-intake.mjs — RUN-BM / BM1. THE INTAKE NOBODY KEEPS.
//
// WHAT BL FOUND, and why this exists. Six buttons on `index.html` say "Request Custom Quote".
// Every one of them ends in a `mailto:` that asks a stranger for four facts — users/devices,
// locations, current stack, timeline — and drops the reply into an inbox. `quote-inputs.mjs`
// traced fifteen inputs a quote needs and reported those four as ASKED_NOT_CAPTURED: the tree
// asks the question and owns no shape for the answer. So the second person to touch that deal
// starts from prose in somebody's mail client, and the trace that would price the work has no
// input to read.
//
// THIS MODULE IS THE SHAPE THE ANSWER LANDS IN. It is not a mailbox connection and not a form.
// It takes the text of a reply and returns a record a clone receives: for each field a buyer was
// actually asked for, either the answer they gave, with the line it came from, or the fact that
// they did not give one.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. THE FIELDS ARE DISCOVERED, NEVER TYPED. The schema comes from `readQuoteAsk()` — the same
//      reader `quote-inputs` already uses — so it is parsed out of the page a buyer actually sees.
//      No field list is written in this file. If the mailto body gains a fifth question tomorrow,
//      this module gains a fifth field on the next run and every reply taken before it reports
//      that field ABSENT. A list retyped here would agree with the page for about a month.
//
//   2. NEVER A SECOND IMPLEMENTATION. The ask is read through `quote-inputs.readQuoteAsk`, not by
//      a private copy of its regexes. Two readers of one surface disagree eventually, and the day
//      they disagree neither one is trustworthy.
//
//   3. AN ABSENT ANSWER IS ABSENT — NEVER DEFAULTED, NEVER INFERRED, NEVER ZERO. A buyer who did
//      not say how many devices they have has not said "0" and has not said "unknown". There is
//      no placeholder value anywhere in this file. A default here would travel silently into a
//      quote, which is the exact class of fabrication Rule 14 exists to refuse.
//
//   4. TWO KINDS OF ABSENCE, KEPT APART. A field the reply never mentions and a field the reply
//      names and leaves blank are different facts about a conversation — the second one means the
//      buyer read the question and skipped it, which is worth knowing before the call. They share
//      a state and never share a reason.
//
//   5. IT SENDS NOTHING AND READS NO MAILBOX. It opens no socket, holds no address, and writes no
//      file. It is handed text by a caller. A suite at the bottom of the test file proves it by
//      reading this source.
//
//   6. AN UNREADABLE SURFACE IS UNREADABLE, NEVER EMPTY. If the page carrying the ask cannot be
//      read, this module refuses and says so. It never falls back to a field list of its own,
//      because a fallback list is exactly the drift discipline 1 exists to prevent.

import { readQuoteAsk, QUOTE_SURFACES } from "./quote-inputs.mjs";

export const INTAKE_SCHEMA = "quote-intake/1";

/** It has no address and no socket. Both are asserted by a suite that reads this file. */
export const SENDS = false;
export const READS_MAILBOX = false;

/** What is known about one field of one reply. */
export const STATE = Object.freeze({
  ANSWERED: "ANSWERED", // the buyer gave a value, and it is carried verbatim
  ABSENT: "ABSENT",     // the buyer gave none — never a default, never a guess
});

/** Why a field is absent. Discipline 4: these never merge. */
export const ABSENCE = Object.freeze({
  NOT_MENTIONED: "NOT_MENTIONED", // the reply never names the field at all
  LEFT_BLANK: "LEFT_BLANK",       // the reply names the field and gives nothing after it
});

/** What the reply as a whole amounts to. */
export const VERDICT = Object.freeze({
  COMPLETE: "COMPLETE",     // every field a buyer was asked for carries an answer
  PARTIAL: "PARTIAL",       // some answered, some not
  EMPTY: "EMPTY",           // nothing was answered
  UNREADABLE: "UNREADABLE", // the ask could not be read, so no verdict about a reply is honest
});

export const REFUSAL = Object.freeze({
  NO_ASK: "no-readable-ask",       // the surface carries no ask this module could discover
  NOT_TEXT: "reply-is-not-text",   // handed something that is not a reply body
  FIELD_COLLISION: "field-collision", // two asked fields reduce to one id; the record would lose one
});

const idOf = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A label as it may appear in a reply: any spacing around the slashes, any case. */
const labelPattern = (label) =>
  label.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");

/**
 * The shape of the ask, discovered from the surface.
 *
 * Deliberately returns the SAME ids `quote-inputs` builds for its `buyer.*` inputs, so a record
 * produced here can be matched against the trace without a translation table between them.
 *
 * @returns {{ok:boolean, schema:string, fields:Array<{id,label,file,line}>, buttons:number,
 *            refusal:string|null, reason:string|null}}
 */
export function intakeSchema({ root = process.cwd(), surfaces = QUOTE_SURFACES } = {}) {
  const ask = readQuoteAsk({ root, surfaces });
  if (!ask.ok) {
    return {
      ok: false, schema: INTAKE_SCHEMA, fields: [], buttons: ask.buttons || 0,
      refusal: REFUSAL.NO_ASK,
      // The reader's own words are carried through rather than re-worded: it knows whether the
      // surface was missing or merely unparseable, and those are different findings.
      reason: ask.reason,
    };
  }

  const fields = [];
  const seen = new Map();
  for (const f of ask.fields) {
    const id = idOf(f.label);
    if (seen.has(id)) {
      return {
        ok: false, schema: INTAKE_SCHEMA, fields: [], buttons: ask.buttons,
        refusal: REFUSAL.FIELD_COLLISION,
        reason: `two fields on the surface reduce to the same id "${id}" — ` +
                `"${seen.get(id)}" and "${f.label}"; a record keyed this way would silently drop one answer`,
      };
    }
    seen.set(id, f.label);
    fields.push({ id, label: f.label, file: f.file, line: f.line });
  }

  return { ok: true, schema: INTAKE_SCHEMA, fields, buttons: ask.buttons, refusal: null, reason: null };
}

/**
 * Read one reply against the fields a buyer was actually asked for.
 *
 * @param {string} reply  the body of the reply, as text. Nothing is fetched; the caller supplies it.
 * @param {{root?:string, surfaces?:any, schema?:object}} opts
 *        `schema` may be passed to avoid re-reading the surface; it must be an `intakeSchema()` result.
 * @returns {{ok:boolean, schema:string, verdict:string, answered:number, asked:number,
 *            fields:Array<object>, unclaimed:Array<{line:number,text:string}>,
 *            refusal:string|null, reason:string|null}}
 */
export function receiveIntake(reply, { root = process.cwd(), surfaces = QUOTE_SURFACES, schema } = {}) {
  const shape = schema || intakeSchema({ root, surfaces });
  if (!shape.ok) {
    return {
      ok: false, schema: INTAKE_SCHEMA, verdict: VERDICT.UNREADABLE, answered: 0, asked: 0,
      fields: [], unclaimed: [], refusal: shape.refusal, reason: shape.reason,
    };
  }
  if (typeof reply !== "string") {
    return {
      ok: false, schema: INTAKE_SCHEMA, verdict: VERDICT.UNREADABLE, answered: 0,
      asked: shape.fields.length, fields: [], unclaimed: [],
      refusal: REFUSAL.NOT_TEXT,
      reason: `a reply body must be text; received ${reply === null ? "null" : typeof reply}`,
    };
  }

  const lines = reply.split(/\r?\n/);

  // Which line, if any, names each field. Matched on the LABEL from the page, so a field the page
  // adds later is looked for in replies written before it existed — and correctly found absent.
  const matchers = shape.fields.map((f) => ({
    field: f,
    re: new RegExp(`^\\s*(?:[-*•]\\s*)?${labelPattern(f.label)}\\s*[:–—-]\\s*(.*)$`, "i"),
  }));

  const claimed = new Set();
  const out = [];

  for (const { field, re } of matchers) {
    let hit = null;
    for (let i = 0; i < lines.length; i += 1) {
      const m = re.exec(lines[i]);
      if (m) { hit = { index: i, rest: m[1] }; break; }
    }

    if (!hit) {
      out.push({
        ...field, state: STATE.ABSENT, value: null, absence: ABSENCE.NOT_MENTIONED, at: null,
        statement: `${field.label} was asked at ${field.file}:${field.line} and this reply does not mention it`,
      });
      continue;
    }

    claimed.add(hit.index);
    let value = hit.rest.trim();

    // An answer written on the line BELOW the question is still an answer. Continuation stops at a
    // blank line or at any line that names another asked field — never at a guess about prose.
    if (!value) {
      const parts = [];
      for (let j = hit.index + 1; j < lines.length; j += 1) {
        const line = lines[j];
        if (!line.trim()) break;
        if (matchers.some((m) => m.re.test(line))) break;
        parts.push(line.trim());
        claimed.add(j);
      }
      value = parts.join(" ").trim();
    }

    if (!value) {
      out.push({
        ...field, state: STATE.ABSENT, value: null, absence: ABSENCE.LEFT_BLANK, at: hit.index + 1,
        statement: `${field.label} is named at reply line ${hit.index + 1} and left blank — the buyer read the question and gave nothing`,
      });
      continue;
    }

    out.push({
      ...field, state: STATE.ANSWERED, value, absence: null, at: hit.index + 1,
      statement: `${field.label} answered at reply line ${hit.index + 1}`,
    });
  }

  // Everything the buyer wrote that no asked field claimed. Carried, never parsed: it is often the
  // most useful sentence in the mail, and this module has no business deciding what it means.
  const unclaimed = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (claimed.has(i)) continue;
    const text = lines[i].trim();
    if (text) unclaimed.push({ line: i + 1, text });
  }

  const answered = out.filter((f) => f.state === STATE.ANSWERED).length;
  const verdict = answered === 0 ? VERDICT.EMPTY
    : answered === out.length ? VERDICT.COMPLETE
    : VERDICT.PARTIAL;

  return {
    ok: true, schema: INTAKE_SCHEMA, verdict, answered, asked: out.length,
    fields: out, unclaimed, refusal: null, reason: null,
  };
}

/** One reader-facing line per field. No totals dressed up as progress. */
export function statementFor(record) {
  if (!record.ok) return `intake REFUSED (${record.refusal}) — ${record.reason}`;
  const head = `${record.verdict} — ${record.answered} of ${record.asked} asked facts answered`;
  return [head, ...record.fields.map((f) => `  · ${f.statement}`)].join("\n");
}

export default { intakeSchema, receiveIntake, statementFor, STATE, ABSENCE, VERDICT, REFUSAL, INTAKE_SCHEMA, SENDS, READS_MAILBOX };
