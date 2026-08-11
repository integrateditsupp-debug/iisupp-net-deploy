// pack-answer-consistency.mjs — RUN-AX / AX1. THE PACK READ TOGETHER, NOT ONE DOCUMENT AT A TIME.
//
// RUN-AW asked two questions of each of the twenty-seven documents that leave this building: does it
// carry anything a stranger should not receive (AW1), and is what it does carry true (AW2). Both
// questions were worth asking and both are now green.
//
// But both were asked of a document IN ISOLATION. A security reviewer does not read a document. They
// read an ANSWER — the one that comes back when they send their questionnaire and their follow-up —
// and that answer is assembled from several documents at once, at speed, by a person working to a
// deadline they did not set. The failure that costs a deal is not a wrong sentence in one file. It is
// the SIG-Lite saying one thing and the CAIQ saying another about the same fact, discovered by a
// reviewer who now has to decide which of the two we meant.
//
// AV1 found seven surfaces declaring two currencies by reading them TOGETHER. This is that read,
// applied to prose.
//
// THE DISCIPLINE, stated so it cannot drift:
//
//   1. Every answer is READ out of the document that states it and carries its file, its line, and
//      the exact source text that produced the value. Nothing in this module asserts a fact about
//      the pack that it did not just read.
//
//   2. There is no code path that returns AGREED while two answers disagree. A gate that goes green
//      by not asking the question is the failure, not the fix.
//
//   3. This module NEVER PICKS which answer is right. Which RTO this company commits to, and what its
//      backup retention actually is, are decisions about what we promise a paying customer. They
//      belong to Ahmad. A conflict is reported with BOTH citations and staged. Nothing is edited to
//      make a count green (Rule 15).
//
//   4. A question answered in only ONE document is its own class — `single-source`. It is never
//      rounded up into agreement (one voice is not a consensus) and never rounded down into conflict
//      (one voice is not a contradiction). It is a third fact, counted separately, because "only the
//      CAIQ answers this" is exactly what a reviewer discovers when they ask it of the SIG.
//
//   5. Two answers in the SAME document that disagree are a conflict like any other. A reviewer
//      reading one file top to bottom is the likeliest person on earth to find it.
//
// The findings are NOT restated here as prose: a comment carrying a count goes stale the day the
// pack changes, and a stale count is a fabricated metric with a slow fuse (Rule 14). Run the module.

import fs from "node:fs";
import path from "node:path";

export const PACK_ANSWER_SCHEMA = "pack-answer-consistency/1";

export const VERDICT = Object.freeze({
  AGREED: "agreed",               // two or more documents answer, and every answer normalises to the same value
  UNDECLARED: "undeclared",       // the answers disagree and NOBODY HAS SAID SO — the only state that goes red
  DECLARED_OPEN: "declared-open", // the answers disagree, it is recorded as an open decision with a written reason
  SINGLE_SOURCE: "single-source", // exactly one document answers it; its own class, never rounded either way
  UNANSWERED: "unanswered",       // no document in the pack answers a question a reviewer asks
});

/**
 * Where a disagreement is acknowledged. AV1 proved software must not pick which currency this
 * company charges in; the same holds for what we promise about backups. But AV2 proved the opposite
 * failure is just as real: a figure nobody publishes and nobody explains is a SILENT one, and silence
 * is what lets a contradiction reach a reviewer.
 *
 * So the gate has three states rather than two. A conflict SOMEBODY HAS WRITTEN DOWN, with a reason
 * and both citations, is an open decision — reported on every run, never green-washed, and it does
 * not hold the registry red. A conflict NOBODY HAS WRITTEN DOWN is UNDECLARED and goes red, because
 * the cheapest possible moment to notice two client-facing policies disagreeing is the moment the
 * second one is written, not the moment a reviewer reads both.
 *
 * A declaration that matches nothing is STALE and also goes red: a register that rots is worse than
 * no register, because it reads as diligence.
 */
export const CONFLICT_REGISTER = "docs/PACK-ANSWER-CONFLICTS.md";

/**
 * Normalisers. Deliberately few and deliberately dumb: a normaliser clever enough to make two
 * different sentences agree is a normaliser clever enough to hide a contradiction.
 */
export const NORMALISE = Object.freeze({
  /** Durations to MINUTES, so "4 hours" and "240 min" are the same fact and "4 hours" and "4 days" are not. */
  duration(raw) {
    const m = String(raw).trim().match(/^([\d.]+)\s*(min(?:ute)?s?|hours?|hrs?|days?|weeks?)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = m[2].toLowerCase();
    const mult = unit.startsWith("min") ? 1
      : unit.startsWith("h") ? 60
      : unit.startsWith("d") ? 1440
      : 10080;
    return { value: n * mult, unit: "minutes" };
  },
  /** Retention windows to DAYS. "7 years" is 2555 days and must never quietly become "7". */
  days(raw) {
    const m = String(raw).trim().match(/^([\d.]+)\s*(days?|weeks?|months?|years?)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = m[2].toLowerCase();
    const mult = unit.startsWith("day") ? 1
      : unit.startsWith("week") ? 7
      : unit.startsWith("month") ? 30
      : 365;
    return { value: n * mult, unit: "days" };
  },
  /** A word answer, case- and punctuation-folded. Nothing else — no synonym table, on purpose. */
  token(raw) {
    const t = String(raw).trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
    return t ? { value: t, unit: "token" } : null;
  },
});

/**
 * The questions a reviewer asks that MORE THAN ONE document in the pack tries to answer.
 *
 * Kept as data so the suite can plant a drift in any single source and assert it is caught BY FILE
 * AND BY LINE, and so a topic cannot be added without somebody stating who asks it and what a
 * disagreement would cost.
 *
 * `re` must expose the value in capture group 1. A qualifier inside the pattern is how the
 * Enterprise RTO is kept apart from the SBA RTO: those are different promises to different
 * customers and comparing them against each other would invent a conflict that does not exist.
 */
export const TOPICS = [
  {
    topic: "rto-enterprise",
    question: "How quickly do you restore service for an Enterprise customer?",
    asks: "the buyer's own security reviewer, from the BCP section of every questionnaire",
    costs: "an RTO is a contractual commitment; two numbers means one of them is a promise we did not make",
    normalise: "duration",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /RTO\s+([\d.]+\s*(?:min|minutes|hours?|hrs?))\b[^|]*Enterprise/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /RTO documented\?[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*Enterprise/i },
      { file: "compliance/policies/business-continuity.md", re: /^\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*\|[^|]*\|\s*Enterprise/i },
    ],
  },
  {
    topic: "rpo-enterprise",
    question: "How much data can an Enterprise customer lose in a disaster?",
    asks: "the buyer's own security reviewer",
    costs: "an RPO is the amount of a customer's work we are willing to lose; disagreeing with ourselves here is unforgivable in a contract",
    normalise: "duration",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /RPO\s+([\d.]+\s*(?:min|minutes|hours?|hrs?))\b[^|]*Enterprise/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /RPO documented\?[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*Enterprise/i },
      { file: "compliance/policies/business-continuity.md", re: /^\|[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*\|\s*Enterprise/i },
    ],
  },
  {
    topic: "rto-sba",
    question: "How quickly do you restore service for a small-business customer?",
    asks: "an SBA-tier buyer, which is the buyer this company can actually win today",
    costs: "the tier most likely to sign is the tier least likely to have its numbers checked twice",
    normalise: "duration",
    sources: [
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /RTO documented\?[^|]*\|[^|]*\|[^;|]*;\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*SBA/i },
      { file: "compliance/policies/business-continuity.md", re: /^\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*\|[^|]*\|\s*SBA/i },
    ],
  },
  {
    topic: "rpo-sba",
    question: "How much data can a small-business customer lose in a disaster?",
    asks: "an SBA-tier buyer",
    costs: "same promise, same tier, and the cheapest possible place to be caught disagreeing with ourselves",
    normalise: "duration",
    sources: [
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /RPO documented\?[^|]*\|[^|]*\|[^;|]*;\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*SBA/i },
      { file: "compliance/policies/business-continuity.md", re: /^\|[^|]*\|[^|]*\|\s*([\d.]+\s*(?:min|minutes|hours?|hrs?))\s*\|\s*SBA/i },
    ],
  },
  {
    topic: "backup-retention",
    question: "How long do you keep backups?",
    asks: "every reviewer, and every customer who has ever asked to restore something",
    costs: "a customer told 90 days who is offered 7 has lost data we said we still had",
    normalise: "days",
    sources: [
      { file: "compliance/policies/business-continuity.md", re: /snapshots[^.]*?([\d.]+\s*-?\s*days?)\s*retention/i, rewrite: (s) => s.replace(/-/g, " ") },
      { file: "compliance/policies/data-classification.md", re: /Backup retention:\s*([\d.]+\s*days?)/i },
    ],
  },
  {
    topic: "conversation-retention",
    question: "How long do you keep a customer's conversations?",
    asks: "a privacy reviewer, and every DPA negotiation",
    costs: "this number appears in a signed data-processing agreement; a questionnaire that contradicts it contradicts a contract",
    normalise: "days",
    sources: [
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Data retention defined\?[^|]*\|[^|]*\|\s*([\d.]+\s*days?)\s*conversations/i },
      { file: "compliance/policies/data-classification.md", re: /\*\*Retention:\*\*\s*([\d.]+\s*days?)\s*for conversation records/i },
      { file: "legal/DPA-template.md", re: /\*\*Conversation records:\*\*\s*([\d.]+\s*days?)/i },
    ],
  },
  {
    topic: "log-retention",
    question: "How long do you keep logs?",
    asks: "an incident reviewer, who needs to know how far back an investigation can reach",
    costs: "a log retention shorter than the promise is an investigation that cannot be run",
    normalise: "days",
    sources: [
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Data retention defined\?[^|]*\|[^|]*\|[^;|]*;\s*([\d.]+\s*days?)\s*logs/i },
      { file: "compliance/policies/data-classification.md", re: /Retention:\*\*[^;]*;\s*([\d.]+\s*days?)\s*for logs/i },
      { file: "compliance/SIG-Lite-prefilled.md", re: /Logging & monitoring\?[^|]*\|[^|]*?([\d.]+\s*-?\s*days?)\s*retention/i, rewrite: (s) => s.replace(/-/g, " ") },
    ],
  },
  {
    topic: "transit-encryption",
    question: "What protects data in transit?",
    asks: "every reviewer, on the first page",
    costs: "the most-repeated answer in the pack is the one most likely to drift when one file is updated alone",
    normalise: "token",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /\b(TLS\s*1\.\d\+?)\s*(?:in transit|enforced)/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Data encrypted in transit\?[^|]*\|[^|]*\|\s*(TLS\s*1\.\d\+?)/i },
      { file: "compliance/SOC2-controls-self-assessment.md", re: /\b(TLS\s*1\.\d\+?)\s*enforced/i },
      { file: "compliance/policies/data-classification.md", re: /\*\*Transmission:\*\*\s*(TLS\s*1\.\d\+?)/i },
      { file: "compliance/HIPAA-readiness-map.md", re: /\b(TLS\s*1\.\d\+?)\s*enforced/i },
    ],
  },
  {
    topic: "rest-encryption",
    question: "What protects data at rest?",
    asks: "every reviewer, immediately after the previous question",
    costs: "an at-rest algorithm stated two ways reads as an at-rest algorithm nobody owns",
    normalise: "token",
    sources: [
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Data encrypted at rest\?[^|]*\|[^|]*\|\s*(AES-256(?:-[A-Z]{3})?)/i },
      { file: "compliance/policies/business-continuity.md", re: /\*\*Backup encryption:\*\*\s*(AES-256(?:-[A-Z]{3})?)/i },
      { file: "compliance/policies/data-classification.md", re: /encrypted at rest \((AES-256(?:-[A-Z]{3})?)\)/i },
    ],
  },
  {
    topic: "pentest-cadence",
    question: "How often is a penetration test performed?",
    asks: "the reviewer, and then the reviewer's insurer",
    costs: "this answer also sits inside a signed DPA, so a questionnaire that disagrees with it disagrees with a contract",
    normalise: "token",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /Penetration testing of network\?\s*\|\s*(\w+)/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /Penetration testing\?\s*\|\s*(\w+)/i },
      { file: "legal/DPA-template.md", re: /\b(Annual)\s+self-conducted penetration test/i },
    ],
  },
  {
    topic: "dr-test-cadence",
    question: "How often is the disaster-recovery plan tested?",
    asks: "the reviewer, because an untested plan is a document rather than a capability",
    costs: "restore testing is the claim a reviewer is most likely to ask for evidence of",
    normalise: "token",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /DR plan testing frequency\?\s*\|\s*(\w+)/i },
      { file: "compliance/policies/business-continuity.md", re: /\*\*Restore testing:\*\*\s*(\w+)/i },
    ],
  },
  {
    topic: "soc2-status",
    question: "Do you have a SOC 2 Type II report?",
    asks: "an enterprise reviewer, usually as a pass/fail gate before anything else is read",
    costs: "a certification status stated two ways is the fastest way to lose a reviewer's trust in the whole pack",
    normalise: "token",
    sources: [
      { file: "compliance/SIG-Lite-prefilled.md", re: /Type II audit (planned) upon/i },
      { file: "compliance/CAIQ-Lite-prefilled.md", re: /SOC 2 Type II audit (planned)/i },
    ],
  },
];

/** Read a file's lines once. Unreadable is reported, never guessed. */
function readLines(root, rel) {
  const abs = path.join(root, rel);
  try {
    return { ok: true, lines: fs.readFileSync(abs, "utf8").split(/\r?\n/) };
  } catch (err) {
    return { ok: false, lines: [], error: String(err && err.message).slice(0, 160) };
  }
}

/**
 * Every answer this pack gives to one question, with its citation.
 *
 * ALL matching lines in a source are collected, not the first — two answers inside one document that
 * disagree is a conflict like any other, and stopping at the first match is precisely how that hides.
 */
export function answersFor(topic, { root = process.cwd(), cache = new Map() } = {}) {
  const norm = NORMALISE[topic.normalise];
  if (typeof norm !== "function") {
    throw new Error(`pack-answer-consistency: topic "${topic.topic}" names an unknown normaliser "${topic.normalise}"`);
  }
  const out = [];
  const unreadable = [];

  for (const src of topic.sources) {
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
      out.push({
        file: src.file,
        line: i + 1,
        raw,
        matched: m[1],
        // The whole line, trimmed, so a reader never has to trust the regex to know what was read.
        source: line.trim().slice(0, 220),
        normalised: normalised ? normalised.value : null,
        unit: normalised ? normalised.unit : null,
        // A value that matched the pattern and would not normalise is reported, never dropped: a
        // silently discarded answer is an answer that cannot conflict with anything.
        unnormalisable: normalised === null,
      });
    });
  }
  return { answers: out, unreadable };
}

/** One question, read across the whole pack. */
export function auditTopic(topic, opts = {}) {
  const { answers, unreadable } = answersFor(topic, opts);
  const values = answers.filter((a) => !a.unnormalisable);
  const distinct = [...new Set(values.map((a) => String(a.normalised)))];
  const files = [...new Set(answers.map((a) => a.file))];

  const disagrees = distinct.length > 1 || answers.some((a) => a.unnormalisable);
  const declaration = disagrees ? (opts.declarations || new Map()).get(topic.topic) || null : null;

  let verdict;
  if (answers.length === 0) verdict = VERDICT.UNANSWERED;
  else if (disagrees) verdict = declaration ? VERDICT.DECLARED_OPEN : VERDICT.UNDECLARED;
  else if (answers.length === 1) verdict = VERDICT.SINGLE_SOURCE;
  else verdict = VERDICT.AGREED;

  return {
    topic: topic.topic,
    question: topic.question,
    asks: topic.asks,
    costs: topic.costs,
    unit: values[0] ? values[0].unit : null,
    verdict,
    // Every citation, always — a conflict a reader cannot look up is a rumour.
    answers,
    distinctValues: distinct,
    filesAnswering: files,
    unreadableSources: unreadable,
    disagrees,
    declaration,
    // Named, never implied: this module has no code path that resolves a disagreement. It can only
    // report one, and refuse to let one stay silent.
    resolvedHere: false,
  };
}

/**
 * Read the conflict register. A declaration must name the topic, carry a reason A PERSON WROTE, and
 * say who decides. An empty reason, or a reason that only restates the question, is REFUSED — that
 * is how a register becomes a rubber stamp.
 */
export function readDeclarations({ root = process.cwd(), file = CONFLICT_REGISTER } = {}) {
  const out = new Map();
  const refused = [];
  let lines;
  try {
    lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  } catch {
    return { present: false, declarations: out, refused };
  }
  lines.forEach((line, i) => {
    if (!line.trim().startsWith("|")) return;
    const cells = line.split("|").map((c) => c.trim());
    // | topic | state | reason | who decides |
    if (cells.length < 6) return;
    const [, topic, state, reason, who] = cells;
    if (!topic || /^-+$/.test(topic) || topic.toLowerCase() === "topic") return;
    const reasonWords = reason.split(/\s+/).filter(Boolean);
    if (!reason || reasonWords.length < 6) {
      refused.push({ topic, line: i + 1, why: "a declaration with no reason, or a reason too short to be one, is a rubber stamp" });
      return;
    }
    if (reason.toLowerCase().includes(topic.toLowerCase()) && reasonWords.length < 12) {
      refused.push({ topic, line: i + 1, why: "a reason that only restates the topic explains nothing" });
      return;
    }
    if (!who) {
      refused.push({ topic, line: i + 1, why: "a declaration that does not say who decides is not staged, it is parked" });
      return;
    }
    out.set(topic, { topic, state, reason, whoDecides: who, file, line: i + 1 });
  });
  return { present: true, declarations: out, refused };
}

/** The whole pack, read together. */
export function auditPack({ root = process.cwd(), topics = TOPICS, registerFile = CONFLICT_REGISTER } = {}) {
  const cache = new Map();
  const reg = readDeclarations({ root, file: registerFile });
  const results = topics.map((t) => auditTopic(t, { root, cache, declarations: reg.declarations }));

  const undeclared = results.filter((r) => r.verdict === VERDICT.UNDECLARED);
  const declaredOpen = results.filter((r) => r.verdict === VERDICT.DECLARED_OPEN);
  const conflicts = results.filter((r) => r.disagrees);
  const singleSource = results.filter((r) => r.verdict === VERDICT.SINGLE_SOURCE);
  const unanswered = results.filter((r) => r.verdict === VERDICT.UNANSWERED);
  const agreed = results.filter((r) => r.verdict === VERDICT.AGREED);

  // A declaration pointing at a topic that no longer disagrees is STALE. Kept as its own failure so
  // the register cannot quietly rot into a list of things that used to be true.
  const disagreeingTopics = new Set(conflicts.map((r) => r.topic));
  const stale = [...reg.declarations.values()].filter((d) => !disagreeingTopics.has(d.topic));

  return {
    schema: PACK_ANSWER_SCHEMA,
    read: "the questionnaires, the policies and the contracts as ONE body",
    topics: results,
    summary: {
      questions: results.length,
      agreed: agreed.length,
      conflicts: conflicts.length,
      singleSource: singleSource.length,
      unanswered: unanswered.length,
      documents: [...new Set(results.flatMap((r) => r.filesAnswering))].length,
      conflicts: conflicts.length,
      undeclared: undeclared.length,
      declaredOpen: declaredOpen.length,
      staleDeclarations: stale.length,
      refusedDeclarations: reg.refused.length,
      // A reviewer question this pack answers nowhere, a disagreement NOBODY has written down, a
      // declaration that has rotted, or a rubber-stamp reason — each is its own failure and none of
      // them is smoothed into ok. Single-source is counted and reported and does NOT fail: one
      // document answering a question is a fact about coverage, not a contradiction. A DECLARED
      // disagreement does not fail either — software may not pick which promise this company makes,
      // and a gate that stays red on a decision only teaches people to ignore red.
      ok: undeclared.length === 0 && unanswered.length === 0 && stale.length === 0 &&
        reg.refused.length === 0 && results.every((r) => r.unreadableSources.length === 0),
    },
    register: { file: registerFile, present: reg.present, refused: reg.refused, stale },
    conflicts,
    decisionsStaged: conflicts.map((c) => ({
      question: c.question,
      values: c.distinctValues,
      citations: c.answers.map((a) => `${a.file}:${a.line} — ${a.matched}`),
      declared: Boolean(c.declaration),
      whoDecides: c.declaration ? c.declaration.whoDecides : "Ahmad — this is a promise to a paying customer, not a formatting choice",
    })),
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (s.ok) {
    return `${s.agreed} of ${s.questions} reviewer questions are answered the same way by every document that answers them, across ${s.documents} documents; ${s.singleSource} answered by one document only, ${s.declaredOpen} disagreement(s) recorded as open decisions and 0 silent`;
  }
  const first = result.conflicts.slice(0, 2).map((c) => `${c.topic} (${c.distinctValues.join(" vs ")})`);
  return `${s.undeclared} undeclared, ${s.declaredOpen} declared-open, ${s.staleDeclarations} stale, ${s.refusedDeclarations} refused — ${first.join(", ")}${s.conflicts > 2 ? ` and ${s.conflicts - 2} more` : ""}`;
}

export default { auditPack, auditTopic, answersFor, readDeclarations, statementFor, TOPICS, NORMALISE, VERDICT, CONFLICT_REGISTER, PACK_ANSWER_SCHEMA };
