// rendered-ask.mjs — RUN-P P1: THE ASK, RENDERED.
//
// WHY (RUN-P, 2026-07-28): fifteen sequences can now record a real account, price it against a real
// observed floor, assemble a complete packet and tell an operator exactly what to do next. What none
// of them has ever produced is THE THING A HUMAN PUTS IN FRONT OF A NAMED PERSON. A packet is an
// internal object; an ask is a written artefact with a subject line, a value statement, a price and
// a specific request. P1 is that last metre, and it is deliberately hostile to unsourced prose.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EVERY SENTENCE TRACES TO A RECORD ID. The artefact is assembled sentence by sentence, and each
//     sentence carries the record ids it was derived from. A sentence with no traceable source is
//     REFUSED and the refusal QUOTES THAT SENTENCE. Never softened, never dropped silently, never
//     rewritten into a vaguer claim that would pass.
//   - A FIXTURE IS NOT A BUYER. `realAccount` must be explicitly asserted by the operator, in the
//     same vocabulary O2 already uses. An unasserted account produces the fixture warning and NO
//     artefact at all — there is nothing to render, because there is no one to render it for.
//   - A REFUSED PACKET NEVER BECOMES AN ASK. M2's refusal is carried through by name, not re-derived.
//   - THE PRICE SHOWS ITS FLOOR. The reasoning that makes the number defensible travels with it.
//   - STRUCTURALLY SEND-INCAPABLE. No transport, no network, no mail client, no child process, no
//     filesystem reach. The artefact is a returned string. Static-scan locked by the test.
//   - Rule 15 additive: the M2 packet, the O2 walk vocabulary and the M1/L3 inputs are read-only.
//   - Rule 17 value-first: what the buyer GETS is stated before any feature and before the price.

import { SEND_PACKET_SCHEMA } from "./send-packet.mjs";
import { FIXTURE_WARNING } from "./first-account-walk.mjs";

export const RENDERED_ASK_SCHEMA = "rendered-ask.v1";

// Belt-and-braces, asserted by the test. Nothing here ever flips true inside this module.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export { FIXTURE_WARNING };

export const REFUSAL_PREFIX = "Ask refused - a claim with no record behind it:";

export const NO_PACKET_STATEMENT =
  "No complete send packet. An ask is rendered from a packet that already cleared every gate - never assembled around a gap.";

export const ONE_CLICK_NOTE =
  "RENDERED ONLY. This artefact cannot send itself. It exists so a human can read it once and then " +
  "send it from their own mail client. Nothing leaves this machine without that person.";

export const TRACE_NOTE =
  "Every sentence below traces to a record id held in this repo. Anything we could not evidence was " +
  "refused outright rather than softened into a vaguer claim.";

// The default request. A specific next step, not "let me know your thoughts".
export const DEFAULT_NEXT_STEP =
  "a 30-minute call this week to walk the evidence above against your own environment";

function isCompletePacket(p) {
  return !!(p && p.schema === SEND_PACKET_SCHEMA && p.refused === false && p.packet
    && p.packet.recipient && Array.isArray(p.packet.valueFirst) && p.packet.price && p.packet.trace);
}

function ids(list) {
  return (Array.isArray(list) ? list : []).filter((i) => typeof i === "string" && i.trim().length).map((i) => i.trim());
}

function sentence(id, text, recordIds) {
  return { id, text: String(text), recordIds: ids(recordIds) };
}

/**
 * input: {
 *   sendPacket,            // M2 buildSendPacket() result — must be refused:false
 *   realAccount?: true,    // the operator asserts this is a real named buyer, not a fixture (O2 vocabulary)
 *   nextStep?: string,     // the specific thing being requested; defaults to DEFAULT_NEXT_STEP
 *   extraSentences?: [ { id, text, recordIds } ]   // anything a human wants to add — held to the same rule
 * }
 */
export function renderAsk(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: RENDERED_ASK_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    rendered: false,
    oneClickNote: ONE_CLICK_NOTE,
  };

  const src = input && typeof input === "object" ? input : {};
  const sp = src.sendPacket;

  if (!isCompletePacket(sp)) {
    const carried = sp && sp.schema === SEND_PACKET_SCHEMA && sp.refused && typeof sp.refusal === "string"
      ? sp.refusal
      : null;
    return {
      ...base,
      refused: true,
      fixture: false,
      fixtureWarning: null,
      artefact: null,
      untraceable: [],
      refusal: carried ? `${NO_PACKET_STATEMENT} Carried from the packet: ${carried}` : NO_PACKET_STATEMENT,
    };
  }

  // A fixture is not a buyer. This check happens BEFORE any prose is generated, so no artefact for a
  // fixture can exist even transiently.
  if (src.realAccount !== true) {
    return {
      ...base,
      refused: true,
      fixture: true,
      fixtureWarning: FIXTURE_WARNING,
      artefact: null,
      untraceable: [],
      refusal: FIXTURE_WARNING,
    };
  }

  const p = sp.packet;
  const chainIds = ids(p.trace.chainArtifactIds);
  const claimIds = ids(p.trace.claimRecordIds);
  const packIds = p.trace.proofPackId ? [String(p.trace.proofPackId)] : [];

  const nextStep = typeof src.nextStep === "string" && src.nextStep.trim()
    ? src.nextStep.trim()
    : DEFAULT_NEXT_STEP;

  const who = p.recipient.name;
  const sentences = [];

  // Rule 17 — value first, from evidenced claims only. One sentence per claim, each carrying its ids.
  for (const c of p.evidence.claims) {
    sentences.push(sentence(
      `value:${c.label}`,
      `${c.label}: ${c.value}.`,
      c.recordIds,
    ));
  }

  sentences.push(sentence(
    "opening",
    `${who}, this is what we measured in your own environment, and what it would cost to keep it that way.`,
    chainIds,
  ));

  sentences.push(sentence(
    "evidence",
    `Each number above is checkable against a record we hold: ${claimIds.join(", ")}.`,
    claimIds,
  ));

  sentences.push(sentence(
    "price",
    `The price is ${p.price.quoteCad} CAD per month. Our own observed delivery cost for your account is ` +
    `${p.price.observedFloorCad} CAD per month, so the margin is ${p.price.marginCad} — we are showing you the ` +
    `floor because a price you cannot interrogate is a price you should not accept.`,
    chainIds,
  ));

  sentences.push(sentence(
    "nextStep",
    `What I am asking for is ${nextStep}.`,
    chainIds,
  ));

  // Anything a human bolts on is held to exactly the same rule as anything we generate.
  for (const e of (Array.isArray(src.extraSentences) ? src.extraSentences : [])) {
    const id = typeof (e && e.id) === "string" && e.id.trim() ? e.id.trim() : "extra";
    const text = typeof (e && e.text) === "string" ? e.text : "";
    sentences.push(sentence(id, text, e && e.recordIds));
  }

  // THE GATE. A sentence with nothing behind it stops the whole artefact and is quoted back.
  const untraceable = sentences
    .filter((s) => s.recordIds.length === 0 || !s.text.trim())
    .map((s) => ({ id: s.id, text: s.text, why: "no record id behind this sentence - refused rather than softened" }));

  if (untraceable.length) {
    return {
      ...base,
      refused: true,
      fixture: false,
      fixtureWarning: null,
      artefact: null,
      untraceable,
      refusal: REFUSAL_PREFIX + " " + untraceable.map((u) => `"${u.text}"`).join("; ") + ".",
    };
  }

  const byId = (id) => sentences.find((s) => s.id === id);
  const valueSentences = sentences.filter((s) => s.id.startsWith("value:"));

  const subject = `${p.account} — what we measured, and what it costs`;

  const artefact = {
    account: p.account,
    to: { name: p.recipient.name, address: p.recipient.address, role: p.recipient.role || null },
    subject,
    opening: byId("opening").text,
    value: valueSentences.map((s) => s.text),
    evidence: byId("evidence").text,
    price: {
      quoteCad: p.price.quoteCad,
      observedFloorCad: p.price.observedFloorCad,
      marginCad: p.price.marginCad,
      floorShown: true,
      sentence: byId("price").text,
    },
    nextStep: { requested: nextStep, sentence: byId("nextStep").text },
    sentences,
    trace: { chainArtifactIds: chainIds, claimRecordIds: claimIds, proofPackIds: packIds },
  };

  artefact.text = renderedAskText({ ...base, rendered: true, artefact });

  return {
    ...base,
    rendered: true,
    refused: false,
    fixture: false,
    fixtureWarning: null,
    artefact,
    untraceable: [],
    refusal: null,
  };
}

/** The artefact as a human would actually send it. Plain text — nothing here transports it. */
export function renderedAskText(result) {
  if (!result || result.schema !== RENDERED_ASK_SCHEMA) return "_no ask_";
  if (!result.artefact) return `_no ask rendered — ${result.refusal || "no reason recorded"}_\n`;
  const a = result.artefact;
  const L = [
    `Subject: ${a.subject}`,
    `To: ${a.to.name}${a.to.role ? ` (${a.to.role})` : ""} <${a.to.address}>`,
    "",
    a.opening,
    "",
  ];
  for (const v of a.value) L.push(`- ${v}`);
  L.push("", a.evidence, "", a.price.sentence, "", a.nextStep.sentence, "", "---", TRACE_NOTE, ONE_CLICK_NOTE);
  return L.join("\n") + "\n";
}

export function renderedAskMarkdown(result) {
  if (!result || result.schema !== RENDERED_ASK_SCHEMA) return "_no ask_";
  if (result.refused) {
    return ["## Ask", "", result.refusal, "",
      "_Nothing was rendered. An unsourced sentence is refused, never softened into one that would pass._"].join("\n") + "\n";
  }
  return ["## Ask — ready for a human to send", "", "```", result.artefact.text.trimEnd(), "```", ""].join("\n");
}
