// honest-opening.mjs — RUN-S S2: THE THING WE ACTUALLY SAY.
//
// WHY (RUN-S, 2026-07-28): the second thing standing between zero conversations and one is that
// there has never been an honest sentence to open with. The default failure mode of every sales tool
// ever built is to fill that gap by GENERATING one — and a generated opening is a fabrication wearing
// a script's clothes. It reads fine, it converts, and every word of it is unearned.
//
// S2 therefore builds the SHORTEST opening it can from recorded facts alone, and REFUSES where the
// facts are absent. A missing basis produces no opening at all and says so plainly.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - BUILT ONLY FROM WHAT Q1 RECORDED, with the candidate's own stated problem basis at the centre.
//     Where the basis was heard in a real conversation (R2), it is quoted and attributed.
//   - REFUSABLE BY DESIGN. No basis, no opening. The module names the missing field rather than
//     reaching for a plausible substitute.
//   - EVERY UNSUPPORTABLE CLAIM CLASS IS REFUSED BY NAME AND QUOTED BACK: invented savings, invented
//     customer counts, "companies like yours", certifications we do not hold, guarantee language,
//     and inflated experience (Ahmad is 15+ years, never 21+).
//   - IT IS A SCRIPT FOR A HUMAN TO SAY, NOT A TEMPLATE FOR A MACHINE TO SEND. No transport, no
//     scheduler, and no merge fields — a merge token is the seam a sender is later bolted onto.
//   - PURE. No fs, no net, no spawn, no env — static-scanned.
//   - Rule 15 additive: nothing existing is replaced.

import { CANDIDATE_RECORD_SCHEMA } from "./candidate-record.mjs";
import { momentumSafe } from "./program-truth.mjs";

export const HONEST_OPENING_SCHEMA = "honest-opening.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const HAS_TRANSPORT = false;
export const HAS_SCHEDULER = false;
export const MACHINE_CONSUMABLE = false;
export const HAS_MERGE_FIELDS = false;
export const GENERATES = false;

export const FOR_HUMAN_TO_SAY_NOTE =
  "This is a sentence for a person to say out loud, in their own voice, and to abandon the moment " +
  "the other person says something more interesting. It is not a template, it has no merge fields, " +
  "and nothing in this module can send it.";

export const NO_BASIS_REFUSAL =
  "No opening. This candidate has no recorded problem basis, and an opening invented without one is " +
  "a fabrication with a friendly tone. Go and find out one real thing about why they might have the " +
  "problem, record it with its source, then come back.";

/**
 * The claim classes a human must never be handed. Each is refused BY NAME and the matched phrase is
 * quoted back, so the person editing sees exactly which words were about to be unearned.
 */
export const UNSUPPORTABLE_CLAIMS = Object.freeze([
  Object.freeze({
    key: "invented-savings",
    label: "Invented savings or ROI",
    why: "we have never measured a dollar or an hour saved for anyone",
    markers: Object.freeze(["save you", "savings of", "cut your costs", "reduce your costs by",
      "% cheaper", "roi of", "pays for itself", "save up to", "cost reduction of"]),
  }),
  Object.freeze({
    key: "invented-customers",
    label: "Invented customers or social proof",
    why: "the customer count is zero and a zero may not be dressed as a crowd",
    markers: Object.freeze(["companies like yours", "businesses like yours", "our clients",
      "our customers", "hundreds of", "thousands of", "trusted by", "join the", "others in your industry",
      "most of our"]),
  }),
  Object.freeze({
    key: "invented-credential",
    label: "A certification or partnership we do not hold",
    why: "only certifications actually held may ever be named",
    markers: Object.freeze(["certified partner", "gold partner", "authorised partner",
      "authorized partner", "accredited", "iso 27001", "soc 2", "official partner"]),
  }),
  Object.freeze({
    key: "guarantee",
    label: "Guarantee language",
    why: "nothing is guaranteed and no money-back promise exists to stand behind",
    markers: Object.freeze(["guarantee", "guaranteed", "risk-free", "risk free", "money-back",
      "money back", "no obligation refund", "promise you"]),
  }),
  Object.freeze({
    key: "inflated-experience",
    label: "Inflated experience",
    why: "the honest figure is 15+ years and it is never rounded up",
    markers: Object.freeze(["21+ years", "21 years", "20+ years", "25 years", "two decades",
      "decades of experience"]),
  }),
  Object.freeze({
    key: "manufactured-urgency",
    label: "Manufactured urgency",
    why: "there is no deadline, no expiring offer and no queue",
    markers: Object.freeze(["limited time", "expires", "only a few spots", "act now",
      "before the end of", "last chance"]),
  }),
]);

export const CLAIM_KEYS = Object.freeze(UNSUPPORTABLE_CLAIMS.map((c) => c.key));

function norm(v) {
  return typeof v === "string" ? v.trim() : "";
}

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

/**
 * Scan any text for unsupportable claims. Returns [] when clean, otherwise one entry per class hit,
 * each quoting the matched phrase verbatim.
 */
export function unsupportableClaimsIn(text) {
  const t = norm(text).toLowerCase();
  if (!t) return [];
  const hits = [];
  for (const c of UNSUPPORTABLE_CLAIMS) {
    const marker = c.markers.find((m) => t.includes(m));
    if (marker) {
      hits.push({
        key: c.key,
        label: c.label,
        matched: marker,
        refusal: `${c.label}: refused - "${marker}" cannot be said, because ${c.why}.`,
      });
    }
  }
  return hits;
}

/** A merge token is the seam a sender is later bolted onto. There must not be one. */
export function mergeTokensIn(text) {
  const t = norm(text);
  if (!t) return [];
  const found = t.match(/\{\{[^}]*\}\}|\$\{[^}]*\}|%%[A-Za-z_]+%%|\[\[[A-Za-z_ ]+\]\]/g);
  return found ? found.slice() : [];
}

/**
 * Build the opening for ONE recorded candidate.
 *
 * candidate: a Q1 candidate ({ key, name, contact, problemBasis, ... }).
 * options.heardInConversation: an R2 outcome the basis came from, if any — it upgrades the opening
 *   from "we believe" to a direct attribution, because a conversation is the strongest provenance
 *   the program has.
 *
 * Returns { opening, refused, refusal, ... }. It returns text; it never sends it.
 */
export function buildOpening(candidate = null, { heardFrom = null, now = Date.now() } = {}) {
  const base = {
    schema: HONEST_OPENING_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    generates: GENERATES,
    forHumanToSay: true,
    forHumanToSayNote: FOR_HUMAN_TO_SAY_NOTE,
    hasTransport: HAS_TRANSPORT,
    hasScheduler: HAS_SCHEDULER,
    machineConsumable: MACHINE_CONSUMABLE,
    hasMergeFields: HAS_MERGE_FIELDS,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    candidateKey: candidate && candidate.key ? norm(candidate.key) : null,
  };

  const basisValue = candidate && candidate.problemBasis ? norm(candidate.problemBasis.value) : "";
  const basisSource = candidate && candidate.problemBasis ? norm(candidate.problemBasis.source) : "";

  if (!nonEmpty(basisValue) || !nonEmpty(basisSource, 8)) {
    return {
      ...base,
      opening: null,
      refused: true,
      refusal: NO_BASIS_REFUSAL,
      claimsRefused: [],
      basis: null,
      attributed: false,
    };
  }

  // The basis is quoted, not paraphrased — a paraphrase is where the drift starts.
  const attributed = !!heardFrom && nonEmpty(norm(heardFrom));
  const line = attributed
    ? `You told ${norm(heardFrom)} that ${basisValue}. I think that is a problem we can take off your desk - can I ask you two questions about it?`
    : `I understand that ${basisValue}. I may have that wrong - is it still true, and is it costing you anything worth fixing?`;

  // Our own output is held to the same gate as anything a human might paste in.
  const selfCheck = unsupportableClaimsIn(line);
  if (selfCheck.length) {
    return {
      ...base,
      opening: null,
      refused: true,
      refusal: `Opening refused by its own guard - ${selfCheck.map((h) => h.refusal).join(" ")}`,
      claimsRefused: selfCheck,
      basis: { value: basisValue, source: basisSource },
      attributed,
    };
  }

  return {
    ...base,
    opening: line,
    refused: false,
    refusal: null,
    claimsRefused: [],
    basis: { value: basisValue, source: basisSource },
    attributed,
    // Two sentences at most. Length is a feature: a long opening is a monologue, and a monologue is
    // how a conversation fails to start.
    sentenceCount: line.split(/[.?!]\s+/).filter(Boolean).length,
    mergeTokens: mergeTokensIn(line),
    provenanceLine: `Everything said above comes from one recorded fact: ${basisSource}.`,
  };
}

/**
 * Check any human-edited opening before it is said. The human may rewrite freely — they may not
 * rewrite an unearned claim into it.
 */
export function reviewOpening(text, { now = Date.now() } = {}) {
  const t = norm(text);
  const claims = unsupportableClaimsIn(t);
  const tokens = mergeTokensIn(t);
  const problems = [
    ...claims.map((c) => c.refusal),
    ...(tokens.length
      ? [`Merge field: refused - ${tokens.join(", ")}. A merge token is the seam a sender gets bolted onto; a human saying a sentence does not need one.`]
      : []),
    ...(momentumSafe(t) ? [] : ["Momentum language: refused - nothing about this position is in motion, and the opening may not imply it is."]),
  ];
  return {
    schema: HONEST_OPENING_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    reviewed: true,
    ok: problems.length === 0 && nonEmpty(t),
    empty: !nonEmpty(t),
    problems,
    claimsRefused: claims,
    mergeTokens: tokens,
    sent: SENT,
  };
}

export function openingMarkdown(opening) {
  if (!opening || opening.schema !== HONEST_OPENING_SCHEMA) return "_no opening_\n";
  if (opening.refused) return ["### What to say", "", opening.refusal, ""].join("\n");
  return [
    "### What to say",
    "",
    `> ${opening.opening}`,
    "",
    `_${opening.provenanceLine}_`,
    "",
    `_${opening.forHumanToSayNote}_`,
    "",
  ].join("\n");
}
