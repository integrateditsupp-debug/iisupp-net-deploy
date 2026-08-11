// answer-cost.mjs — RUN-AX / AX3. WHAT ANSWERING A REVIEWER ACTUALLY COSTS.
//
// AV3 priced pressing send: twelve messages, twelve judgement calls about rule-7 language and
// unpublished figures and the forbidden name, driven to zero by a gate with no transport. Six cycles
// had said "twelve drafted, one click" without ever pricing the click.
//
// The reviewer's follow-up is the same shape and has never been priced. The questionnaire goes back,
// and then the real conversation starts: "can you send us the policy behind B.1", "what is your
// breach notification window", "who are your sub-processors", "show us the restore test". Every one
// of those is either a POINT — the artefact exists, it is attached, the thread moves on — or it is a
// COMPOSITION, where a person sits down and writes something that did not exist an hour ago.
//
// THE UNIT, and why it is not hours:
//
//   Nobody in this environment has ever timed one of these. An hour figure would be invented, and an
//   invented duration is a fabricated metric under Rule 14 no matter how reasonable it sounds. What
//   CAN be counted honestly is what the answer requires: an artefact that exists and can be pointed
//   at, or a person composing prose. So that is the unit — POINTS and COMPOSITIONS.
//
//   COMPOSED-BY-DESIGN is kept apart from COMPOSED-FOR-WANT-OF-AN-ARTEFACT, exactly as AT3 kept
//   manual-by-design apart from manual-for-want-of-one. "Why should we trust a one-person company"
//   is a founder answering in his own voice in front of a buyer, and it SHOULD be. Counting it as a
//   defect would push this program toward automating the judgement that wins the deal. Only the
//   second kind is a gap worth closing.
//
//   A question whose cost cannot be read is UNCOUNTED with its reason. It is never rounded into
//   either bucket, because a cost silently assigned is a cost nobody will check.
//
// Wired to AX2: the artefacts a question would point at are resolved against HEAD's tree by the same
// module that resolves the pack's citations, and a question blocked by a missing artefact names the
// AX2 gap it is blocked by. Gate and cost cannot drift apart.

import { headTree, readGapDeclarations, CITATION_GAPS } from "./answer-citations.mjs";

export const ANSWER_COST_SCHEMA = "answer-cost/1";

export const COST = Object.freeze({
  POINT: "pointable",                       // an artefact exists in the shared line and answers it
  COMPOSED_BY_DESIGN: "composed-by-design", // a person must answer this, and should
  COMPOSED_FOR_WANT: "composed-for-want",   // a person must answer this ONLY because an artefact is missing
  UNCOUNTED: "uncounted",                   // the cost could not be read — reported, never assigned
});

/**
 * The follow-up. These are the questions a reviewer sends AFTER the questionnaire comes back, which
 * is the moment this module exists to price. Each names the artefact that would answer it by
 * pointing, or declares that a person must compose the answer and WHY that is right.
 *
 * Kept as data so a question cannot be added without somebody stating what would answer it, and so
 * the suite can remove an artefact from the tree and assert the cost moves BY NAME.
 */
export const FOLLOW_UP = [
  { id: "Q-01", asks: "Send us the access control policy referenced in your questionnaire.", points: ["compliance/policies/access-control.md"] },
  { id: "Q-02", asks: "Send us your encryption policy.", points: ["compliance/policies/encryption.md"] },
  { id: "Q-03", asks: "Send us your incident response policy and your notification timeline.", points: ["compliance/policies/incident-response.md"] },
  { id: "Q-04", asks: "Send us your business continuity and DR plan.", points: ["compliance/policies/business-continuity.md"] },
  { id: "Q-05", asks: "Send us your data classification and retention schedule.", points: ["compliance/policies/data-classification.md"] },
  { id: "Q-06", asks: "Send us your vendor / sub-processor management policy.", points: ["compliance/policies/vendor-management.md"] },
  { id: "Q-07", asks: "Send us your vulnerability management policy and patch SLAs.", points: ["compliance/policies/vulnerability-management.md"] },
  { id: "Q-08", asks: "Send us your change management policy.", points: ["compliance/policies/change-management.md"] },
  { id: "Q-09", asks: "Send us your acceptable use policy.", points: ["compliance/policies/acceptable-use.md"] },
  { id: "Q-10", asks: "Send us your password / authentication policy.", points: ["compliance/policies/password.md"] },
  { id: "Q-11", asks: "Send us your physical security policy or your provider attestations.", points: ["compliance/policies/physical-security.md"] },
  { id: "Q-12", asks: "Send us your risk management policy.", points: ["compliance/policies/risk-management.md"] },
  { id: "Q-13", asks: "We need a DPA. Send us your template.", points: ["legal/DPA-template.md"] },
  { id: "Q-14", asks: "We handle PHI. Send us your BAA.", points: ["legal/BAA-template.md"] },
  { id: "Q-15", asks: "Send us your MSA.", points: ["legal/MSA-template.md"] },
  { id: "Q-16", asks: "Send us the pilot agreement we would actually sign.", points: ["legal/Pilot-Agreement-TEMPLATE.md"] },
  { id: "Q-17", asks: "Send us your SOC 2 evidence or your self-assessment.", points: ["compliance/SOC2-controls-self-assessment.md"] },
  { id: "Q-18", asks: "Send us your ISO 27001 statement of applicability.", points: ["compliance/ISO-27001-SoA.md"] },
  { id: "Q-19", asks: "We are in healthcare — send your HIPAA readiness map.", points: ["compliance/HIPAA-readiness-map.md"] },
  { id: "Q-20", asks: "We are in the EU — send your EU AI Act position.", points: ["compliance/EU-AI-Act-readiness-map.md"] },
  { id: "Q-21", asks: "Send your NIST AI RMF mapping.", points: ["compliance/NIST-AI-RMF-readiness-map.md"] },
  { id: "Q-22", asks: "How do you handle AI-generated content provenance?", points: ["compliance/C2PA-content-provenance-policy.md"] },
  { id: "Q-23", asks: "Send us the completed CAIQ.", points: ["compliance/CAIQ-Lite-prefilled.md"] },
  { id: "Q-24", asks: "Send us the completed SIG.", points: ["compliance/SIG-Lite-prefilled.md"] },

  // Blocked ONLY by a missing artefact. Each names the AX2 gap it waits on, so closing the gap moves
  // this number and nothing else has to be remembered.
  { id: "Q-25", asks: "Send us your risk register.", points: ["governance/risk-register.md"] },
  { id: "Q-26", asks: "Send us your asset inventory.", points: ["compliance/asset-inventory.md"] },
  { id: "Q-27", asks: "Send us evidence of your most recent restore test.", points: ["governance/dr-test-log.md"] },
  { id: "Q-28", asks: "Send us your incident history for the last 24 months.", points: ["governance/incident-history.md"] },
  { id: "Q-29", asks: "Send us your open vulnerability tracker.", points: ["governance/vulnerability-tracker.md"] },

  // Composed BY DESIGN. A person answers these, and a program that tried to automate them would be
  // automating the part of the sale that is actually the sale.
  {
    id: "Q-30",
    asks: "You are a one-person company. What happens to our service if you are unavailable?",
    byDesign: "key-person risk is answered by a founder making a commitment in his own voice; a generated paragraph here reads exactly as evasive as it would be",
  },
  {
    id: "Q-31",
    asks: "Your SOC 2 is a self-assessment. Why should that be enough for us?",
    byDesign: "this is a negotiation about risk appetite with a specific buyer, and the honest answer differs by buyer; a canned answer to it is a canned answer to the only question that matters",
  },
  {
    id: "Q-32",
    asks: "Can you meet our contract terms on liability and indemnity?",
    byDesign: "a commitment about money and legal exposure — Ahmad's decision every time, never a template's",
  },
  {
    id: "Q-33",
    asks: "Confirm your cyber liability cover and limits.",
    byDesign: "the pack states the cover is in procurement; the answer to a reviewer asking for it today is a factual statement about a commercial decision in progress, and only Ahmad knows where that stands",
  },
];

/**
 * Price the follow-up. Nothing is sent, nothing is attached, no mail path is touched — this answers
 * a question about cost, it does not answer a reviewer.
 */
export function priceFollowUp({ root = process.cwd(), questions = FOLLOW_UP, gapsFile = CITATION_GAPS } = {}) {
  const head = headTree({ root });
  const gaps = readGapDeclarations({ root, file: gapsFile });

  const priced = questions.map((q) => {
    if (q.byDesign) {
      return {
        ...q, cost: COST.COMPOSED_BY_DESIGN, missing: [], blockedByGap: null,
        why: q.byDesign,
      };
    }
    if (!head.readable) {
      return {
        ...q, cost: COST.UNCOUNTED, missing: [], blockedByGap: null,
        why: `HEAD's tree could not be read, so whether this can be answered by pointing is unknown: ${head.error}`,
      };
    }
    const missing = (q.points || []).filter((f) => !head.files.has(f));
    if (missing.length === 0) {
      return { ...q, cost: COST.POINT, missing: [], blockedByGap: null, why: null };
    }
    const gap = missing.map((f) => gaps.declarations.get(f)).find(Boolean) || null;
    return {
      ...q,
      cost: COST.COMPOSED_FOR_WANT,
      missing,
      // Named, so closing the AX2 gap and moving this number are visibly the same act.
      blockedByGap: gap ? { artefact: gap.artefact, file: gap.file, line: gap.line, whoDecides: gap.whoDecides } : null,
      why:
        `a person must compose this answer only because ${missing.join(", ")} is not in the shared ` +
        `line — the question itself is a pointing question`,
    };
  });

  const n = (c) => priced.filter((p) => p.cost === c).length;
  const forWant = priced.filter((p) => p.cost === COST.COMPOSED_FOR_WANT);

  return {
    schema: ANSWER_COST_SCHEMA,
    unit: "questions answerable by pointing at an artefact that exists, versus questions requiring a person to compose something new — never hours, because nobody here has timed one",
    headReadable: head.readable,
    sent: false,
    attached: false,
    mailPathTouched: false,
    questions: priced,
    summary: {
      total: priced.length,
      pointable: n(COST.POINT),
      composedByDesign: n(COST.COMPOSED_BY_DESIGN),
      composedForWant: forWant.length,
      uncounted: n(COST.UNCOUNTED),
      // Every gap must be one somebody has already written down under AX2. A composition forced by
      // an artefact nobody has acknowledged is the failure; a composition forced by a KNOWN gap is a
      // cost, reported and carried until the decision is made.
      forWantUndeclared: forWant.filter((p) => !p.blockedByGap).length,
      ok: head.readable && n(COST.UNCOUNTED) === 0 && forWant.every((p) => p.blockedByGap),
    },
    // What closing the AX2 gaps would buy, stated in this module's own unit rather than asserted.
    ifGapsClosed: {
      pointable: n(COST.POINT) + forWant.length,
      composed: n(COST.COMPOSED_BY_DESIGN),
      note: "composed-by-design does not move, and should not: those are the answers a founder gives",
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so the cost of answering a reviewer is uncounted rather than assumed";
  return (
    `${s.pointable} of ${s.total} reviewer follow-up questions are answered by pointing at an artefact ` +
    `that a clone receives; ${s.composedByDesign} need a person by design; ${s.composedForWant} need a ` +
    `person only because an artefact is missing, all ${s.composedForWant} traced to a declared gap; ` +
    `${s.uncounted} uncounted`
  );
}

export default { priceFollowUp, statementFor, FOLLOW_UP, COST, ANSWER_COST_SCHEMA };
