// support-commitments.mjs — RUN-AY / AY2. WHAT WE PROMISED TO DO, AND HOW FAST.
//
// AV1 found seven surfaces declaring two currencies by reading them TOGETHER rather than one at a
// time. AX1 did the same read across the reviewer's questions and found two client-facing policies
// disagreeing about backup retention.
//
// Neither of them looked at the commitments that bind AFTER the money moves: how fast we answer, how
// available the service is, what hours a human is reachable, and where a customer escalates when the
// first route does not work. Those are the promises a PAYING customer measures us against, and they
// have never been read as one body.
//
// Why this class is more dangerous than a currency:
//
//   A WRONG CURRENCY IS BREACHED LOUDLY. Somebody's card is charged in the wrong denomination and a
//   human notices within the hour.
//
//   A MISSED RESPONSE TIME IS BREACHED SILENTLY — BY NOBODY DOING ANYTHING. If the contract says
//   fifteen minutes and the questionnaire says an hour, the breach happens at minute sixteen and the
//   only person who knows is the customer, who is already having a bad day. There is no event to
//   catch, no error to log. The failure is an absence.
//
// The discipline is AX1's, deliberately unchanged, because it is the discipline that makes the
// answer worth anything:
//
//   1. Every commitment is READ out of the surface that states it and carries its file, its line and
//      the exact source text. Nothing here asserts a promise it did not just read.
//
//   2. NO CODE PATH RETURNS `agreed` WHILE SURFACES DISAGREE. A gate that goes green by not asking
//      the question is the failure, not the fix.
//
//   3. THIS MODULE NEVER PICKS WHICH COMMITMENT IS RIGHT. Whether P1 is fifteen minutes or an hour is
//      a decision about what this company owes a paying customer, and it is Ahmad's. A disagreement is
//      reported with EVERY citation and staged. Nothing is edited to make a count green (Rule 15).
//
//   4. A commitment stated in exactly ONE place is `single-source` — its own class. Never rounded up
//      into agreement (one voice is not a consensus) and never rounded down into conflict (one voice
//      is not a contradiction). "Only the incident policy says this" is exactly what a customer
//      discovers when they go looking for it in the contract they signed.
//
//   5. A TIERED commitment is never compared against an UNQUALIFIED one as though they were the same
//      promise — they are compared as what they are: a promise made to a specific tier, and a promise
//      made to everybody. Where an unqualified statement contradicts the tier table, that IS the
//      finding, because the customer reading the unqualified one has no idea a table exists.
//
// The findings are not restated here as prose. A comment carrying a count goes stale the day a
// surface changes, and a stale count is a fabricated metric with a slow fuse (Rule 14). Run it.

import fs from "node:fs";
import path from "node:path";
import { NORMALISE, VERDICT, readDeclarations } from "./pack-answer-consistency.mjs";

export const SUPPORT_COMMITMENT_SCHEMA = "support-commitments/1";

/**
 * Where a disagreement about a support commitment is acknowledged.
 *
 * Kept SEPARATE from the AX1 pack register on purpose. AX1's register is about what a pack of
 * documents says to a reviewer BEFORE a signature. This one is about what this company owes a
 * customer who is already paying, and the decider reads a different list at a different moment.
 * Merging them would bury a live contractual obligation in a due-diligence backlog.
 */
export const SUPPORT_REGISTER = "docs/SUPPORT-COMMITMENT-CONFLICTS.md";

/**
 * Every support and availability commitment this company makes, and every surface that states one.
 *
 * `tier` marks a commitment as scoped to a named plan. An UNQUALIFIED source inside a tiered topic
 * is the interesting case and is marked `unqualified: true` — it is compared, and a mismatch is a
 * real conflict, because the reader of an unqualified sentence does not know a tier table exists.
 *
 * `re` must expose the value in capture group 1.
 */
export const COMMITMENTS = [
  {
    id: "p1-response-enterprise",
    commitment: "How fast do we respond to a P1 for an Enterprise customer?",
    who: "the customer with production down, watching the clock",
    costs:
      "a P1 response time is the single most quoted number in an IT services contract; two numbers " +
      "means one of them is a promise nobody in this company agreed to make",
    normalise: "duration",
    tier: "Enterprise",
    sources: [
      {
        file: "legal/MSA-template.md",
        re: /^\|\s*P1 response time\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hr|hrs|hours?))\s*\|/i,
      },
      {
        // Unqualified: the questionnaire states one P1 window with no tier beside it. Whoever reads
        // this line is not told a tier table exists.
        file: "compliance/SIG-Lite-prefilled.md",
        re: /P1 within ([\d.]+\s*(?:min|minutes|hour|hours|hr|hrs))\b/i,
        unqualified: true,
      },
    ],
  },
  {
    id: "p2-response-enterprise",
    commitment: "How fast do we respond to a P2 for an Enterprise customer?",
    who: "the customer whose problem is serious but survivable",
    costs: "the same contractual exposure as P1, one tier down, and no less binding",
    normalise: "duration",
    tier: "Enterprise",
    sources: [
      {
        file: "legal/MSA-template.md",
        re: /^\|\s*P2 response time\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hr|hrs|hours?))\s*\|/i,
      },
      {
        file: "compliance/SIG-Lite-prefilled.md",
        re: /P2 within ([\d.]+\s*(?:min|minutes|hour|hours|hr|hrs))\b/i,
        unqualified: true,
      },
    ],
  },
  {
    id: "breach-notification-window",
    commitment: "How long after a confirmed breach does a customer hear from us?",
    who: "every customer, and every regulator behind them",
    costs:
      "this window is written into GDPR and PIPEDA and into our own DPA; a document that states it " +
      "differently is a document that will be produced in an enforcement conversation",
    normalise: "duration",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /Breach notification within ([\d.]+\s*hours?)/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Customer notification SLA\?\s*\|\s*([\d.]+\s*hours?)/i },
      { file: "compliance/policies/incident-response.md", re: /Notify affected customers within ([\d.]+\s*hours?)/i },
    ],
  },
  {
    id: "status-page-update",
    commitment: "How fast does the status page reflect a confirmed incident?",
    who: "every customer at once, without having to ask",
    costs:
      "a status page that lags the incident is worse than no status page: it actively tells customers " +
      "nothing is wrong while something is",
    normalise: "duration",
    sources: [
      { file: "compliance/policies/incident-response.md", re: /[Ss]tatus page update within ([\d.]+\s*minutes?)/ },
      { file: "compliance/policies/incident-response.md", re: /[Uu]pdated within ([\d.]+\s*minutes?) of confirmed incident/ },
    ],
  },
  {
    id: "incident-customer-email",
    commitment: "How fast does an affected customer get an email during an incident?",
    who: "the customer who is affected but has not yet noticed",
    costs: "the difference between a customer hearing it from us and hearing it from their own users",
    normalise: "duration",
    sources: [
      { file: "compliance/policies/incident-response.md", re: /Email to all affected customers within ([\d.]+\s*hours?)/i },
    ],
  },
  {
    id: "post-incident-review",
    commitment: "How long after an incident does the customer get the post-incident review?",
    who: "the customer deciding whether to renew after something went wrong",
    costs: "the review is the artefact that turns an outage into a reason to stay; a missed window is a second failure",
    normalise: "days",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /Yes within ([\d.]+\s*business days?)/i, rewrite: (v) => v.replace(/business\s+/i, "") },
      { file: "compliance/policies/incident-response.md", re: /Within ([\d.]+\s*business days?) of incident resolution/i, rewrite: (v) => v.replace(/business\s+/i, "") },
    ],
  },
  {
    id: "uptime-enterprise",
    commitment: "What availability does an Enterprise customer get?",
    who: "the buyer's procurement team, and later their finance team calculating a service credit",
    costs: "an uptime figure drives a service credit; disagreeing with ourselves here is a disagreement about money",
    normalise: "token",
    tier: "Enterprise",
    sources: [
      { file: "legal/MSA-template.md", re: /^\|\s*Uptime guarantee\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*(9[\d.]+%)\s*\|/i },
    ],
  },
  {
    id: "maintenance-window",
    commitment: "When do we take the service down for scheduled maintenance?",
    who: "the customer planning their own week around ours",
    costs: "a maintenance window nobody agreed to is an outage with paperwork",
    normalise: "token",
    sources: [
      { file: "legal/MSA-template.md", re: /^\|\s*Scheduled maintenance window\s*\|\s*([^|]+?)\s*\|/i },
    ],
  },
  {
    id: "24x7-reporting",
    commitment: "Who can reach a human at 3am?",
    who: "the customer whose incident does not respect business hours",
    costs:
      "24/7 is the commitment most often assumed and least often written down; a customer who assumed " +
      "it and did not buy it finds out during their worst hour",
    normalise: "token",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /24\/7 incident reporting\?\s*\|\s*(Yes[^.|]*)/i },
    ],
  },
  {
    id: "escalation-route",
    commitment: "Where does a customer escalate when the first route does not answer?",
    who: "the customer who has already waited",
    costs: "an escalation path that exists in one document and nowhere else is an escalation path nobody will find",
    normalise: "token",
    sources: [
      { file: "legal/DPA-template.md", re: /WhatsApp \(647\) 581-3182 for (urgent escalation)/i },
    ],
  },
];

/** Read a file's lines once. Unreadable is reported, never guessed. */
function readLines(root, rel) {
  try {
    return { ok: true, lines: fs.readFileSync(path.join(root, rel), "utf8").split(/\r?\n/) };
  } catch (err) {
    return { ok: false, lines: [], error: String(err && err.message).slice(0, 160) };
  }
}

/**
 * Every statement of one commitment, with its citation.
 *
 * ALL matching lines in a source are collected, never the first — two statements inside one document
 * that disagree is a conflict like any other, and stopping at the first match is exactly how that
 * hides. AW recorded the same failure in a different module and it cost a client-facing figure.
 */
export function statementsFor(commitment, { root = process.cwd(), cache = new Map() } = {}) {
  const norm = NORMALISE[commitment.normalise];
  if (typeof norm !== "function") {
    throw new Error(`support-commitments: "${commitment.id}" names an unknown normaliser "${commitment.normalise}"`);
  }
  const found = [];
  const unreadable = [];

  for (const src of commitment.sources) {
    if (!cache.has(src.file)) cache.set(src.file, readLines(root, src.file));
    const file = cache.get(src.file);
    if (!file.ok) {
      unreadable.push({ file: src.file, error: file.error });
      continue;
    }
    file.lines.forEach((line, i) => {
      const m = line.match(src.re);
      if (!m || m[1] === undefined) return;
      const raw = src.rewrite ? src.rewrite(m[1]) : m[1];
      const normalised = norm(raw);
      found.push({
        file: src.file,
        line: i + 1,
        raw,
        matched: m[1],
        source: line.trim().slice(0, 220),
        // Carried through to the report: a promise made to everybody and a promise made to the
        // Enterprise tier are different promises, and the reader must be able to see which is which.
        unqualified: Boolean(src.unqualified),
        normalised: normalised ? normalised.value : null,
        unit: normalised ? normalised.unit : null,
        // A value that matched and would not normalise is reported, never dropped: a silently
        // discarded statement is a statement that cannot conflict with anything.
        unnormalisable: normalised === null,
      });
    });
  }
  return { found, unreadable };
}

/** One commitment, read across every surface that states it. */
export function auditCommitment(commitment, opts = {}) {
  const { found, unreadable } = statementsFor(commitment, opts);
  const values = found.filter((s) => !s.unnormalisable);
  const distinct = [...new Set(values.map((s) => String(s.normalised)))];

  const disagrees = distinct.length > 1 || found.some((s) => s.unnormalisable);
  const declaration = disagrees ? (opts.declarations || new Map()).get(commitment.id) || null : null;

  let verdict;
  if (found.length === 0) verdict = VERDICT.UNANSWERED;
  else if (disagrees) verdict = declaration ? VERDICT.DECLARED_OPEN : VERDICT.UNDECLARED;
  else if (found.length === 1) verdict = VERDICT.SINGLE_SOURCE;
  else verdict = VERDICT.AGREED;

  // Reported separately from the verdict, because it is a different fact: a tiered promise and an
  // unqualified one disagreeing is not a typo, it is two audiences being told different things.
  const tierMismatch =
    Boolean(commitment.tier) &&
    disagrees &&
    found.some((s) => s.unqualified) &&
    found.some((s) => !s.unqualified);

  return {
    id: commitment.id,
    commitment: commitment.commitment,
    who: commitment.who,
    costs: commitment.costs,
    tier: commitment.tier || null,
    unit: values[0] ? values[0].unit : null,
    verdict,
    statements: found,
    distinctValues: distinct,
    surfaces: [...new Set(found.map((s) => s.file))],
    unreadableSources: unreadable,
    disagrees,
    tierMismatch,
    declaration,
    // Named, never implied. This module has no code path that resolves a disagreement; it can only
    // report one and refuse to let it stay silent.
    resolvedHere: false,
  };
}

/** Every support commitment, read as one body. */
export function auditSupportCommitments({
  root = process.cwd(), commitments = COMMITMENTS, registerFile = SUPPORT_REGISTER,
} = {}) {
  const cache = new Map();
  const reg = readDeclarations({ root, file: registerFile });
  const results = commitments.map((c) => auditCommitment(c, { root, cache, declarations: reg.declarations }));

  const undeclared = results.filter((r) => r.verdict === VERDICT.UNDECLARED);
  const declaredOpen = results.filter((r) => r.verdict === VERDICT.DECLARED_OPEN);
  const conflicts = results.filter((r) => r.disagrees);
  const singleSource = results.filter((r) => r.verdict === VERDICT.SINGLE_SOURCE);
  const unstated = results.filter((r) => r.verdict === VERDICT.UNANSWERED);
  const agreed = results.filter((r) => r.verdict === VERDICT.AGREED);

  // A declaration pointing at a commitment that no longer disagrees is STALE and goes red. A
  // register that rots reads as diligence and is worse than no register.
  const disagreeing = new Set(conflicts.map((r) => r.id));
  const stale = [...reg.declarations.values()].filter((d) => !disagreeing.has(d.topic));

  return {
    schema: SUPPORT_COMMITMENT_SCHEMA,
    read: "the contract, the questionnaires, the incident policy and the DPA as ONE body",
    breachMode: "silently, by nobody doing anything — which is why this is read by code and not by memory",
    commitments: results,
    summary: {
      commitments: results.length,
      agreed: agreed.length,
      conflicts: conflicts.length,
      undeclared: undeclared.length,
      declaredOpen: declaredOpen.length,
      singleSource: singleSource.length,
      unstated: unstated.length,
      tierMismatches: results.filter((r) => r.tierMismatch).length,
      surfaces: [...new Set(results.flatMap((r) => r.surfaces))].length,
      staleDeclarations: stale.length,
      refusedDeclarations: reg.refused.length,
      // A commitment this company states NOWHERE, a disagreement NOBODY has written down, a rotted
      // declaration, or a rubber-stamp reason — each is its own failure and none is smoothed away.
      // Single-source is counted and reported and does NOT fail: one surface stating a commitment is
      // a fact about coverage, not a contradiction. A DECLARED disagreement does not fail either —
      // software may not pick which promise this company makes, and a gate that stays red on a
      // decision only teaches people to ignore red.
      ok:
        undeclared.length === 0 &&
        unstated.length === 0 &&
        stale.length === 0 &&
        reg.refused.length === 0 &&
        results.every((r) => r.unreadableSources.length === 0),
    },
    register: { file: registerFile, present: reg.present, refused: reg.refused, stale },
    conflicts,
    decisionsStaged: conflicts.map((c) => ({
      commitment: c.commitment,
      values: c.distinctValues,
      tierMismatch: c.tierMismatch,
      citations: c.statements.map((s) => `${s.file}:${s.line} — ${s.matched}${s.unqualified ? " (no tier stated)" : ""}`),
      declared: Boolean(c.declaration),
      whoDecides: c.declaration
        ? c.declaration.whoDecides
        : "Ahmad — this is what we owe a paying customer, not a formatting choice",
    })),
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (s.ok) {
    return (
      `${s.agreed} of ${s.commitments} support and availability commitments are stated the same way by ` +
      `every surface that states them, across ${s.surfaces} surfaces; ${s.singleSource} stated in one ` +
      `place only, ${s.declaredOpen} disagreement(s) recorded as open decisions and 0 silent`
    );
  }
  const first = result.conflicts.slice(0, 2).map((c) => `${c.id} (${c.distinctValues.join(" vs ")})`);
  return (
    `${s.undeclared} undeclared, ${s.declaredOpen} declared-open, ${s.unstated} stated nowhere, ` +
    `${s.staleDeclarations} stale, ${s.refusedDeclarations} refused — ${first.join(", ")}` +
    `${s.conflicts > 2 ? ` and ${s.conflicts - 2} more` : ""}`
  );
}

export default {
  auditSupportCommitments, auditCommitment, statementsFor, statementFor,
  COMMITMENTS, SUPPORT_REGISTER, SUPPORT_COMMITMENT_SCHEMA,
};
