// quote-inputs.mjs — RUN-BL / BL1. THE DOCUMENT A CONVERSATION ENDS IN.
//
// Carried unchanged from BG, BH, BI and BK. It has outlived four cycles because every one of them
// found something upstream of it: the price a stranger is quoted (BF), the promise a buyer cannot
// see (BE), the tier vocabulary (BI), the amount a buyer is actually charged (BK). All of those are
// now readable from code. What was never traced is the thing they all lead to.
//
// THE SHAPE OF THE PROBLEM, read first-hand this cycle rather than assumed:
//
//   Six buttons on `index.html` say "Request Custom Quote". Every one of them ends in a `mailto:`
//   that asks a stranger for four facts — users/devices, locations, current stack, timeline — and
//   drops the reply into an inbox. That is where the sale sequence stops having artefacts.
//
//   There IS a proposal generator: `retainer-proposal.mjs`, and it is a good one — every figure in
//   its output is selected by key out of the published plan table and carries the file and line it
//   came from. But it is priced off `plans/index.html`, whose keys are `personal`, `pro`,
//   `small-business`, `mid-size` and `enterprise`. The six quote buttons are on `index.html`, on
//   retainer decks whose tiers have no key in that table at all. Asked for a quote against the card
//   a buyer actually clicked, the generator refuses with `unknown-plan` — correctly, because
//   inventing a figure would be the worse answer.
//
//   So the artefact exists and the surface exists and they are wired to different price lists. That
//   is a far more useful finding than "nothing produces a quote", and it is only visible if you
//   RUN the generator against the surface instead of reading both and assuming they meet.
//
// WHAT THIS MODULE DOES. It takes every input a quote needs and says, for each one, either the
// artefact that carries it — with a citation a reader can open — or the name of what is missing.
// It does not write a quote. Writing one would mean inventing the figure, and the figure is the one
// input that is a person's by design.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. PERSON-BY-DESIGN AND FOR-WANT ARE DIFFERENT CLASSES AND NEVER MERGE. Scoping the work and
//      naming the number are a founder's steps; they are not gaps, and reporting them as gaps would
//      bury the real ones under work nobody should automate. A gap is an input that a person is NOT
//      required for and that nothing in this tree produces.
//
//   2. NEVER HOURS. This company sells a flat retainer. An input expressed as an hours figure is
//      REFUSED at trace time, not filtered later — the moment a quote's inputs contain hours, the
//      quote is a different product and the trace has stopped describing this business.
//
//   3. NO FIGURE IS TYPED HERE. Every amount is read at run time out of the module that already
//      owns it — `chargeable-amounts` for what a buyer is charged, `tier-registry` for which tier a
//      card is, `retainer-proposal` for the published plan table. This file contains no dollar
//      literal, and a suite asserts that by reading this source. A figure retyped into a second
//      place is a figure that will disagree with the first one within a month.
//
//   4. A PROVIDER THAT CANNOT BE READ IS UNREADABLE, NEVER ABSENT AND NEVER CLEAN. "I could not
//      check" and "there is nothing there" are different facts and only one of them is a finding.
//
//   5. IT SENDS NOTHING, WRITES NOTHING, AND DECIDES NOTHING. Whether the deck tiers should be added
//      to the plan table, or the generator taught to read the decks, is a decision about what this
//      company sells. The trace states the gap and the options; the direction is Ahmad's.

import fs from "node:fs";
import path from "node:path";

import { readCharges, CLASS as CHARGE_CLASS, CHARGE_SURFACES } from "./chargeable-amounts.mjs";
import { readPricingSources, generateRetainerProposal, REQUIRED_SECTIONS, REFUSALS, PRICING_FILE } from "./retainer-proposal.mjs";
import { TIERS, tiersOfLine } from "./tier-registry.mjs";

export const QUOTE_INPUT_SCHEMA = "quote-inputs/1";
export const SENDS = false;

/** Who the fact belongs to. Not "who types it" — who is the only possible source of the truth. */
export const ORIGIN = Object.freeze({
  TREE: "TREE",       // readable from this repository, so a clone receives it
  BUYER: "BUYER",     // only the buyer knows it; the tree can only ask, capture and carry it
  FOUNDER: "FOUNDER", // only Ahmad decides it — scoping the work, naming the number
});

export const STATE = Object.freeze({
  CARRIED: "CARRIED",                       // an artefact in this tree produces it, with a citation
  BY_DESIGN: "BY_DESIGN",                   // a person supplies it and should — not a gap
  ASKED_NOT_CAPTURED: "ASKED_NOT_CAPTURED", // a surface asks for it; nothing in the tree receives the answer
  FOR_WANT: "FOR_WANT",                     // nothing produces it and no person is required — the finding
  UNREADABLE: "UNREADABLE",                 // the provider could not be read; never counted clean
});

export const VERDICT = Object.freeze({
  READY_FOR_A_PERSON: "READY_FOR_A_PERSON", // every for-want gap closed; only person-steps remain
  INCOMPLETE: "INCOMPLETE",                 // at least one for-want gap
  UNREADABLE: "UNREADABLE",                 // something could not be read; no verdict is honest yet
});

/** The surface the quote buttons live on. Declared, never discovered (the BK discipline). */
export const QUOTE_SURFACES = CHARGE_SURFACES;

/** The mailto that a "Request Custom Quote" click ends in, and the fields it asks a stranger for. */
const MAILTO_RE = /mailto:[^'"]*?Custom%20Quote%20Request|encodeURIComponent\('Custom Quote Request/;
const ASK_FIELD_RE = /-\s*([A-Z][A-Za-z /]+):\\n/g;

/** Hours in any of the shapes a proposal actually uses them. Discipline 2. */
const HOURS_RE = /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\bper[- ]hour\b|\bhourly\s+rate\b/i;

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Read the ask itself out of the surface: which fields a buyer is asked for when they click.
 * Parsed from the page, never typed here — if the mailto body changes, the trace changes with it.
 *
 * @returns {{ok:boolean, fields:Array<{label:string,file:string,line:number}>, buttons:number, reason:string|null}}
 */
export function readQuoteAsk({ root = process.cwd(), surfaces = QUOTE_SURFACES } = {}) {
  const fields = [];
  const seen = new Set();
  let buttons = 0;
  let anySurface = false;

  for (const s of surfaces) {
    const abs = path.join(root, s.file);
    if (!fs.existsSync(abs)) continue;
    anySurface = true;
    const text = fs.readFileSync(abs, "utf8");

    // The buttons: a quote option is one that declares itself a quote, never one guessed at by name.
    for (const charge of readCharges({ root, surfaces: [s] }).charges || []) {
      if (charge.class === CHARGE_CLASS.QUOTE) buttons += 1;
    }

    const at = text.search(MAILTO_RE);
    if (at === -1) continue;
    const window = text.slice(at, at + 1200);
    let m;
    while ((m = ASK_FIELD_RE.exec(window)) !== null) {
      const label = m[1].trim();
      if (seen.has(label)) continue;
      seen.add(label);
      fields.push({ label, file: s.file, line: lineOf(text, at) });
    }
    ASK_FIELD_RE.lastIndex = 0;
  }

  if (!anySurface) return { ok: false, fields: [], buttons: 0, reason: "no declared quote surface exists in this checkout" };
  if (!fields.length) return { ok: false, fields: [], buttons, reason: "the quote surface carries no readable mailto ask — the fields a buyer is asked for could not be read, which is not the same fact as there being none" };
  return { ok: true, fields, buttons, reason: null };
}

/**
 * The providers. Each answers ONE question: does this tree carry this input, and where is that
 * written down. Every one returns a citation or a named absence — never a bare boolean.
 */
const PROVIDERS = Object.freeze({

  /** The band printed on the card the buyer clicked. */
  publishedBand({ root }) {
    const read = readCharges({ root });
    if (!read.charges) return { state: STATE.UNREADABLE, detail: "the charge surfaces could not be read" };
    const banded = read.charges.filter((c) => c.class === CHARGE_CLASS.LOWER_BOUND || c.class === CHARGE_CLASS.IN_BAND);
    if (!banded.length) return { state: STATE.FOR_WANT, missing: "a published band on any card carrying a quote button", detail: "no card publishes a band a quote could be anchored to" };
    return {
      state: STATE.CARRIED,
      by: "scripts/lib/chargeable-amounts.mjs · readCharges()",
      cite: banded.map((c) => `${c.file}:${c.line}`).slice(0, 6),
      // The option NAMES are carried into the detail deliberately: the hours guard inspects what the
      // trace reports, so a card that starts pricing by the hour has to pass through it. A guard
      // that can only see text this module wrote itself is a guard against its own author.
      detail: `${banded.length} chargeable amount(s) sit on a band published on the same card — ${banded.map((c) => c.name).join("; ")}`,
    };
  },

  /** The deposit a retainer starts with. Read, with BK's finding attached rather than restated. */
  deposit({ root }) {
    const read = readCharges({ root });
    if (!read.charges) return { state: STATE.UNREADABLE, detail: "the charge surfaces could not be read" };
    const deposits = read.charges.filter((c) => c.class === CHARGE_CLASS.DEPOSIT_UNPUBLISHED || c.class === CHARGE_CLASS.DEPOSIT_PUBLISHED);
    if (!deposits.length) return { state: STATE.FOR_WANT, missing: "a deposit figure for any deck", detail: "no deck declares a deposit" };
    const unpublished = deposits.filter((c) => c.class === CHARGE_CLASS.DEPOSIT_UNPUBLISHED);
    return {
      state: STATE.CARRIED,
      by: "scripts/lib/chargeable-amounts.mjs · readCharges()",
      cite: deposits.map((c) => `${c.file}:${c.line}`),
      detail: `${deposits.length} deposit(s) readable from code; ${unpublished.length} of them appear on no card a buyer reads — the open decision recorded in docs/CHARGEABLE-AMOUNT-DECISIONS.md, carried here rather than re-argued`,
    };
  },

  /** Which tier the card is, in words that mean the same thing on every surface. */
  tierIdentity() {
    if (!TIERS.length) return { state: STATE.UNREADABLE, detail: "the tier registry is empty" };
    const lines = [...new Set(TIERS.map((t) => t.line))];
    return {
      state: STATE.CARRIED,
      by: "scripts/lib/tier-registry.mjs · TIERS",
      cite: lines.map((l) => `${l}: ${tiersOfLine(l).map((t) => t.id).join(", ")}`),
      detail: `${TIERS.length} tier(s) across ${lines.length} line(s), each with its aliases declared`,
    };
  },

  /** The sections a client's lawyer looks for. */
  documentSections() {
    if (!REQUIRED_SECTIONS.length) return { state: STATE.UNREADABLE, detail: "the proposal declares no required sections" };
    return {
      state: STATE.CARRIED,
      by: "scripts/lib/retainer-proposal.mjs · REQUIRED_SECTIONS",
      cite: REQUIRED_SECTIONS.slice(),
      detail: "the renderer produces every one of them or refuses with missing-section",
    };
  },

  /**
   * THE ONE THAT MATTERS. Can the generator we have produce a document for the card the buyer
   * clicked? Answered by RUNNING it against every deck tier, not by reading both files and assuming.
   */
  generatorForThisSurface({ root }) {
    const priced = readPricingSources({ root });
    if (!priced.ok) return { state: STATE.UNREADABLE, detail: `the published plan table could not be read: ${priced.reason}` };

    // Only the tiers a quote button actually sits on. Checking every tier in the registry would
    // report cards nobody asked a quote from — a bigger number and a worse finding.
    const read = readCharges({ root });
    if (!read.charges) return { state: STATE.UNREADABLE, detail: "the charge surfaces could not be read, so the cards carrying quote buttons are unknown" };
    const groups = [...new Set(read.charges.filter((c) => c.class === CHARGE_CLASS.QUOTE).map((c) => c.group).filter(Boolean))];
    if (!groups.length) return { state: STATE.FOR_WANT, missing: "a quote button on any card", detail: "no card offers a quote, so there is no conversation for a document to end" };

    // Cards this checkout can place, and cards it cannot. The unplaceable ones are a finding in
    // their own right (`tier.card-identity` below) and are deliberately NOT allowed to swallow this
    // one: reporting the whole trace unreadable because three private-engagement decks are absent
    // from the registry would hide the generator gap under a smaller, different problem.
    const byLabel = new Map(TIERS.map((t) => [t.label, t]));
    const identified = groups.filter((g) => byLabel.has(g));
    const unidentified = groups.filter((g) => !byLabel.has(g));
    if (!identified.length) {
      return { state: STATE.UNREADABLE,
        detail: `all ${groups.length} card(s) carrying a quote button match no tier in the registry (${unidentified.join("; ")}) — nothing here can be placed, and a card that cannot be identified cannot be reported clean` };
    }

    const publishedKeys = priced.figures.map((f) => f.key);
    const deckTiers = identified.map((g) => byLabel.get(g));
    const unreachable = [];
    for (const tier of deckTiers) {
      const res = generateRetainerProposal({ root, client: "a buyer who clicked the card", planKey: tier.id, sources: priced });
      if (!res.ok && res.refusals.some((r) => r.class === REFUSALS.UNKNOWN_PLAN)) unreachable.push(tier.id);
    }

    const aside = unidentified.length
      ? ` (${unidentified.length} further card(s) carrying a quote button are absent from the tier registry and are reported separately, never folded in: ${unidentified.join("; ")})`
      : "";

    if (!unreachable.length) {
      return {
        state: STATE.CARRIED,
        by: "scripts/lib/retainer-proposal.mjs · generateRetainerProposal()",
        cite: publishedKeys.map((k) => `${PRICING_FILE} · ${k}`),
        detail: `every identified tier a quote button sits on resolves to a published plan the generator can price${aside}`,
      };
    }
    return {
      state: STATE.FOR_WANT,
      missing:
        `a price key on the retainer decks that ${PRICING_FILE} publishes — the generator prices off ` +
        `${publishedKeys.join(", ")}, and ${unreachable.length} of the ${groups.length} tier(s) carrying a ` +
        `quote button (${unreachable.join(", ")}) match none of them, so the only quote generator in this ` +
        "tree refuses the exact cards the \"Request Custom Quote\" buttons sit on",
      by: "scripts/lib/retainer-proposal.mjs · generateRetainerProposal() — run against each deck tier this cycle, not inferred",
      cite: [`${PRICING_FILE} · keys: ${publishedKeys.join(", ")}`, "scripts/lib/tier-registry.mjs · TIERS"],
      detail:
        "two honest ways to close it, and the choice is a decision about what is sold rather than a " +
        `defect to patch: publish the deck tiers in ${PRICING_FILE} so they carry a traceable figure, ` +
        "or teach the generator to read a band off the deck and render a RANGE with the scoping call " +
        "named as the step that resolves it. Inventing a single figure for a bespoke scope is the one " +
        "option that is not available.",
    };
  },

  /**
   * Can every card that offers a quote be NAMED? A quote for a card whose tier this tree cannot
   * identify has no vocabulary behind it — nothing to check its wording, its band or its response
   * time against. Kept separate from the generator question on purpose (BK's discipline 3): two
   * different failures reported as one hides whichever is smaller.
   */
  cardIdentity({ root }) {
    const read = readCharges({ root });
    if (!read.charges) return { state: STATE.UNREADABLE, detail: "the charge surfaces could not be read" };
    const groups = [...new Set(read.charges.filter((c) => c.class === CHARGE_CLASS.QUOTE).map((c) => c.group).filter(Boolean))];
    if (!groups.length) return { state: STATE.FOR_WANT, missing: "a quote button on any card", detail: "no card offers a quote" };
    const known = new Set(TIERS.map((t) => t.label));
    const absent = groups.filter((g) => !known.has(g));
    if (!absent.length) {
      return { state: STATE.CARRIED, by: "scripts/lib/tier-registry.mjs · TIERS",
        cite: groups.slice(), detail: `all ${groups.length} card(s) offering a quote resolve to a declared tier` };
    }
    return {
      state: STATE.FOR_WANT,
      missing: `a tier-registry entry for ${absent.length} card(s) that offer a quote and are named nowhere in the registry: ${absent.join("; ")}`,
      by: "scripts/lib/tier-registry.mjs · TIERS — compared against the cards read from the surface this cycle",
      cite: groups.slice(),
      detail: "a quote for a card this tree cannot name has nothing to check its wording, its band or its " +
        "response time against — the vocabulary work BI did for the retainer line, not yet done for these",
    };
  },

  /** A decision file that exists is carried; one that does not is named. */
  decisionDoc(file, what) {
    return ({ root }) => {
      const abs = path.join(root, file);
      if (!fs.existsSync(abs)) return { state: STATE.FOR_WANT, missing: `${file} — ${what}`, detail: `${what} is not written down anywhere a clone receives` };
      const body = fs.readFileSync(abs, "utf8");
      return {
        state: STATE.CARRIED,
        by: file,
        cite: [`${file} (${body.split("\n").length} lines)`],
        detail: `${what} is written down and travels with the repository`,
      };
    };
  },
});

/**
 * Every input a quote needs. The list is DECLARED — a trace that discovers its own inputs cannot
 * tell an input that vanished from an input it stopped looking for.
 *
 * `origin` is who the fact belongs to. `state` is decided by the provider at run time, except for
 * FOUNDER-origin inputs, which are BY_DESIGN by definition and are never reported as gaps.
 */
export const INPUTS = Object.freeze([
  Object.freeze({
    id: "scope.of-work", origin: ORIGIN.FOUNDER,
    what: "what is in and out of this engagement",
    why: "a scope written by software is a scope nobody has agreed to; this is the conversation the band promises",
  }),
  Object.freeze({
    id: "price.figure-for-this-scope", origin: ORIGIN.FOUNDER,
    what: "the number this quote ends in",
    why: "the band is published and traceable; which point inside it this buyer is quoted is a commercial judgement and stays one",
  }),
  Object.freeze({
    id: "client.identity", origin: ORIGIN.BUYER, capturedBy: "scripts/lib/retainer-proposal.mjs · generateRetainerProposal({ client })",
    what: "who the document is addressed to",
    why: "the generator refuses a proposal addressed to nobody, which is the right refusal",
  }),
  Object.freeze({ id: "price.published-band", origin: ORIGIN.TREE, provider: "publishedBand", what: "the band printed on the card the buyer clicked" }),
  Object.freeze({ id: "price.deposit", origin: ORIGIN.TREE, provider: "deposit", what: "the deposit a retainer starts with" }),
  Object.freeze({ id: "tier.identity", origin: ORIGIN.TREE, provider: "tierIdentity", what: "which tier this is, in words that match every other surface" }),
  Object.freeze({ id: "tier.card-identity", origin: ORIGIN.TREE, provider: "cardIdentity", what: "a registry entry for every card that offers a quote" }),
  Object.freeze({ id: "document.sections", origin: ORIGIN.TREE, provider: "documentSections", what: "scope, exclusions, term, notice, what you own at the end, price" }),
  Object.freeze({ id: "document.generator-for-this-surface", origin: ORIGIN.TREE, provider: "generatorForThisSurface", what: "an artefact that renders the document for the card the buyer clicked" }),
  Object.freeze({ id: "terms.response-times", origin: ORIGIN.TREE, provider: "responseTimes", what: "what response time this engagement commits to" }),
  Object.freeze({ id: "terms.retention", origin: ORIGIN.TREE, provider: "retention", what: "how long we keep what we hold" }),
]);

const RESOLVERS = {
  ...PROVIDERS,
  responseTimes: PROVIDERS.decisionDoc("docs/RESPONSE-TIME-DECISIONS.md", "the response times this company commits to"),
  retention: PROVIDERS.decisionDoc("docs/RETENTION-DECISIONS.md", "the retention terms this company commits to"),
};

/**
 * THE TRACE. Every input, its state, and either a citation or a named absence.
 *
 * @returns {{schema:string, verdict:string, ask:object, inputs:Array, summary:object, refusals:Array}}
 */
export function traceQuoteInputs({ root = process.cwd(), surfaces = QUOTE_SURFACES } = {}) {
  const refusals = [];
  const ask = readQuoteAsk({ root, surfaces });
  const inputs = [];

  // The four facts the mailto asks a stranger for become inputs in their own right — read off the
  // page, so this list cannot drift from what a buyer is actually asked.
  for (const field of ask.fields) {
    inputs.push({
      id: `buyer.${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      origin: ORIGIN.BUYER,
      what: `${field.label}, as asked by the quote button's mailto`,
      state: STATE.ASKED_NOT_CAPTURED,
      cite: [`${field.file}:${field.line}`],
      missing:
        "an intake artefact that receives the reply — the answer arrives as an email body and nothing " +
        "in this tree parses, stores or carries it, so the second person to touch this deal starts from prose",
      statement: `${field.label} is ASKED at ${field.file}:${field.line} and captured by nothing`,
    });
  }

  for (const input of INPUTS) {
    if (input.origin === ORIGIN.FOUNDER) {
      inputs.push({
        ...input, state: STATE.BY_DESIGN, cite: [], missing: null,
        statement: `${input.id} is a person's step by design — ${input.why}`,
      });
      continue;
    }
    if (input.origin === ORIGIN.BUYER) {
      inputs.push({
        ...input, state: STATE.BY_DESIGN, cite: input.capturedBy ? [input.capturedBy] : [], missing: null,
        statement: `${input.id} comes from the buyer and lands in ${input.capturedBy || "no named artefact"}`,
      });
      continue;
    }

    const resolve = RESOLVERS[input.provider];
    if (typeof resolve !== "function") {
      inputs.push({ ...input, state: STATE.UNREADABLE, cite: [], missing: null, statement: `${input.id} declares a provider (${input.provider}) that does not exist` });
      continue;
    }
    let got;
    try { got = resolve({ root }); }
    catch (err) { got = { state: STATE.UNREADABLE, detail: `the provider threw: ${String(err.message || err).split("\n")[0]}` }; }

    inputs.push({
      ...input,
      state: got.state,
      by: got.by || null,
      cite: got.cite || [],
      missing: got.missing || null,
      detail: got.detail || null,
      statement: got.state === STATE.CARRIED
        ? `${input.id} is carried by ${got.by} — ${got.detail}`
        : got.state === STATE.FOR_WANT
          ? `${input.id} is MISSING: ${got.missing}`
          : `${input.id} is ${got.state}: ${got.detail || "no detail"}`,
    });
  }

  // Discipline 2, enforced rather than remembered.
  for (const i of inputs) {
    const text = [i.what, i.statement, i.detail, i.missing].filter(Boolean).join(" ");
    if (HOURS_RE.test(text)) {
      refusals.push({ input: i.id, why: "an input expressed in hours — this company sells a flat retainer, and a quote whose inputs are hours is a quote for a different product" });
    }
  }

  const count = (s) => inputs.filter((i) => i.state === s).length;
  const summary = {
    total: inputs.length,
    carried: count(STATE.CARRIED),
    byDesign: count(STATE.BY_DESIGN),
    askedNotCaptured: count(STATE.ASKED_NOT_CAPTURED),
    forWant: count(STATE.FOR_WANT),
    unreadable: count(STATE.UNREADABLE),
    quoteButtons: ask.buttons,
  };

  const verdict = refusals.length || summary.unreadable ? VERDICT.UNREADABLE
    : (summary.forWant || summary.askedNotCaptured) ? VERDICT.INCOMPLETE
      : VERDICT.READY_FOR_A_PERSON;

  return { schema: QUOTE_INPUT_SCHEMA, sends: SENDS, verdict, ask, inputs, summary, refusals };
}

/** The sentence a human should read instead of the object. Generated, never typed. */
export function statementFor(result) {
  const s = result.summary;
  if (result.verdict === VERDICT.UNREADABLE) {
    const why = result.refusals.length ? result.refusals.map((r) => `${r.input}: ${r.why}`).join("; ") : "a provider could not be read";
    return `The quote trace is UNREADABLE and no verdict is honest yet — ${why}.`;
  }
  const gaps = result.inputs.filter((i) => i.state === STATE.FOR_WANT).map((i) => i.id);
  const head = `${s.quoteButtons} quote button(s); ${s.total} input(s) traced — ${s.carried} carried by an artefact, ` +
    `${s.byDesign} a person's step by design, ${s.askedNotCaptured} asked of the buyer and captured by nothing, ${s.forWant} missing for want of an artefact.`;
  if (result.verdict === VERDICT.READY_FOR_A_PERSON) {
    return `${head} Nothing is missing that software should supply: what remains is scoping the work and naming the number, which are Ahmad's.`;
  }
  return `${head} Named, not counted: ${gaps.join(", ") || "none"}.`;
}

export default {
  traceQuoteInputs, readQuoteAsk, statementFor, INPUTS, ORIGIN, STATE, VERDICT,
  QUOTE_SURFACES, QUOTE_INPUT_SCHEMA, SENDS,
};
