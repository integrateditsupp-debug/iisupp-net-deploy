// term-and-exit.mjs — RUN-AZ / AZ2. THE END OF THE TERM, WALKED AS ARTEFACTS.
//
// AT and AU built the path INTO a contract: the reply, the booking, the scope, the agreement, the
// invoice. Nothing in this program has ever walked OUT of one.
//
// Every document in the pack describes a term. The MSA auto-renews unless somebody gives thirty days'
// notice. The DPA promises a customer their data back inside a window and destroyed inside another.
// Whether those windows agree with each other, whether a customer is ever TOLD any of it in a
// document they receive, and whether a renewal conversation has ever been written down — none of it
// has been checked.
//
// TWO HALVES, deliberately not merged:
//
//   THE WALK asks whether the customer is TOLD. Each stage of leaving — the term ending, the notice,
//   the renewal, the export, the deletion — is resolved against HEAD'S TREE, with AY1's third state:
//   a document that arrives and never MENTIONS what its stage promises is SILENT, not delivered. A
//   packet that counts filenames has not been read.
//
//   THE READ asks whether the numbers AGREE. Reusing AX1's machinery rather than a second copy of it,
//   because a second normaliser is a second set of bugs and the discipline is already proven: no code
//   path returns agreed while surfaces disagree, and NO CODE PATH PICKS WHICH ANSWER IS RIGHT. What
//   this company commits to at the end of a term is a decision, not a formatting choice.
//
// WHY THE TWO ARE SEPARATE: a window can be stated identically in three documents a customer never
// receives (agreed, and useless), or clearly communicated in one document and contradicted in
// another (delivered, and dangerous). Collapsing them would let either failure hide inside the other.
//
// An artefact that does not exist is DECLARED with a reason, never written to satisfy a check.
// Nothing here is sent, signed, cancelled, or renewed. This module reads.

import { execFileSync } from "node:child_process";
import { VERDICT, auditTopic, readDeclarations } from "./pack-answer-consistency.mjs";
import { headTree } from "./customer-packet.mjs";

export const TERM_EXIT_SCHEMA = "term-and-exit/1";

/**
 * Where a disagreement about the end of a term, or a missing exit artefact, is acknowledged.
 *
 * Kept apart from SUPPORT-COMMITMENT-CONFLICTS.md (what we owe a customer who is staying) and from
 * PACK-ANSWER-CONFLICTS.md (what a reviewer is told before a signature). This register is read at
 * the moment somebody is leaving, which is the moment nobody has time to reconcile three documents.
 */
export const TERM_REGISTER = "docs/TERM-EXIT-GAPS.md";

export const STAGE = Object.freeze({
  DELIVERED: "delivered",   // an artefact in HEAD carries this stage AND speaks to it
  SILENT: "silent",         // the artefact arrives and never mentions what the stage promises
  ABSENT: "absent",         // no artefact in HEAD carries this stage
  DECLARED: "declared",     // absent or silent, and recorded as an open decision with a written reason
});

/**
 * Leaving, as a customer experiences it.
 *
 * `mentions` is what the stage PROMISES, not the document's title. A file may be present, correct
 * and completely silent about the thing this stage is about — that is the state AY1 added and the
 * one a filename count can never see.
 */
export const EXIT_WALK = [
  {
    id: "X-01",
    stage: "The customer is told, in a document they receive, how long their term runs.",
    files: ["legal/MSA-template.md"],
    mentions: /initial term|term of this agreement|continues for the period/i,
  },
  {
    id: "X-02",
    stage: "The customer is told what happens on the day the term ends if nobody does anything.",
    files: ["legal/MSA-template.md"],
    mentions: /auto-?renew|renews for successive|automatically renew/i,
  },
  {
    id: "X-03",
    stage: "The customer is told how much notice stops the renewal, and in what form.",
    files: ["legal/MSA-template.md"],
    mentions: /written notice of non-?renewal|notice.{0,40}before the end/i,
  },
  {
    id: "X-04",
    stage: "The customer is told how to get their data out, and for how long they can.",
    files: ["legal/MSA-template.md", "legal/DPA-template.md"],
    mentions: /export is available for|returned \(export\)|delete or return all Personal Data/i,
  },
  {
    id: "X-05",
    stage: "The customer is told when their data is destroyed after they leave.",
    files: ["legal/DPA-template.md", "legal/MSA-template.md"],
    mentions: /hard delete|delete existing copies|purge/i,
  },
  {
    id: "X-06",
    stage: "The customer is told what a renewal conversation is: what is discussed and what can change.",
    // Named and unresolved on purpose. If this is absent it must be DECLARED, not written into
    // existence by whoever is closing a check.
    files: ["legal/MSA-template.md", "plans/index.html"],
    mentions: /renewal (?:terms|conversation|review)|price (?:change|increase) at renewal/i,
  },
  {
    id: "X-07",
    stage: "The customer who is mid-pilot is told the pilot creates no automatic renewal.",
    files: ["legal/Pilot-Agreement-TEMPLATE.md"],
    mentions: /no automatic renewal/i,
  },
];

/**
 * The numbers the end of a term turns on, and every document that states one.
 *
 * `re` must expose the value in capture group 1. Read from HEAD by AX1's reader, so a value that
 * only exists in the working copy is not a value a customer can be handed.
 */
export const TERM_TOPICS = [
  {
    topic: "non-renewal-notice",
    question: "How much notice does a customer have to give to stop a renewal?",
    asks: "by the customer who has decided not to continue, usually later than they meant to",
    normalise: "days",
    sources: [
      {
        file: "legal/MSA-template.md",
        re: /written notice of non-renewal at least (\d+\s*days?) before/i,
      },
      {
        file: "legal/MSA-template.md",
        re: /terminate this Agreement upon (\d+\s*days?)' written notice if the other materially breaches/i,
      },
    ],
  },
  {
    topic: "data-export-window",
    question: "How long after leaving can a customer still get their data out?",
    asks: "by the customer who left, then discovered they needed something",
    normalise: "days",
    sources: [
      {
        file: "legal/MSA-template.md",
        re: /Customer Data export is available for (\d+\s*days?) post-termination/i,
      },
      {
        file: "legal/DPA-template.md",
        re: /Personal Data returned \(export\) within (\d+\s*days?)/i,
      },
    ],
  },
  {
    topic: "hard-delete-window",
    question: "When is a departed customer's data actually destroyed?",
    asks: "by the customer's own privacy officer, and by every regulator behind them",
    normalise: "days",
    sources: [
      {
        file: "legal/MSA-template.md",
        re: /Hard delete of Customer Data within (\d+\s*days?)/i,
      },
      {
        file: "legal/DPA-template.md",
        re: /hard delete within (\d+\s*days?) from termination/i,
      },
    ],
  },
];

function headBytes(root, rel) {
  try {
    return execFileSync("git", ["show", `HEAD:${rel}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    return null;
  }
}

/** One stage of leaving, resolved against the tree a clone receives. */
export function walkStage(stage, { root = process.cwd(), tree = null, declarations = new Map() } = {}) {
  const head = tree || headTree({ root });
  const present = (stage.files || []).filter((f) => head.files.has(f));
  const missing = (stage.files || []).filter((f) => !head.files.has(f));

  let state;
  let why = null;
  let spokenBy = [];

  if (!head.readable) {
    state = STAGE.ABSENT;
    why = `HEAD's tree could not be read: ${head.error}`;
  } else if (present.length === 0) {
    state = STAGE.ABSENT;
    why = `nothing in the shared line carries this stage: ${missing.join(", ")} absent`;
  } else {
    spokenBy = present.filter((f) => {
      const src = headBytes(root, f);
      return src !== null && stage.mentions.test(src);
    });
    if (spokenBy.length === 0) {
      state = STAGE.SILENT;
      why =
        `${present.join(", ")} arrives and never says anything about this stage — a packet that ` +
        "counts filenames has not been read";
    } else {
      state = STAGE.DELIVERED;
    }
  }

  const declaration = state === STAGE.DELIVERED ? null : declarations.get(stage.id) || null;
  return {
    id: stage.id,
    stage: stage.stage,
    state: declaration ? STAGE.DECLARED : state,
    rawState: state,
    why,
    present,
    missing,
    spokenBy,
    declaration,
  };
}

export function auditTermAndExit({
  root = process.cwd(),
  walk = EXIT_WALK,
  topics = TERM_TOPICS,
  registerFile = TERM_REGISTER,
} = {}) {
  const head = headTree({ root });
  const reg = readDeclarations({ root, file: registerFile });
  const stages = walk.map((s) => walkStage(s, { root, tree: head, declarations: reg.declarations }));

  const cache = new Map();
  const read = topics.map((t) => auditTopic(t, { root, cache, declarations: reg.declarations }));

  const undeclaredStages = stages.filter((s) => s.rawState !== STAGE.DELIVERED && !s.declaration);
  const declaredStages = stages.filter((s) => s.declaration);
  const undeclaredConflicts = read.filter((r) => r.verdict === VERDICT.UNDECLARED);

  // A declaration is stale if the thing it declares is now fine. Both halves are checked, because a
  // register that only rots on one side rots.
  const stillOpen = new Set([
    ...stages.filter((s) => s.rawState !== STAGE.DELIVERED).map((s) => s.id),
    ...read.filter((r) => r.disagrees).map((r) => r.topic),
  ]);
  const stale = [...reg.declarations.values()].filter((d) => !stillOpen.has(d.topic)).map((d) => d.topic);

  const n = (st) => stages.filter((s) => s.state === st).length;

  return {
    schema: TERM_EXIT_SCHEMA,
    walked: "the end of a term as a customer experiences it, and the numbers it turns on",
    sent: false,
    signed: false,
    cancelled: false,
    renewed: false,
    headReadable: head.readable,
    stages,
    topics: read,
    summary: {
      stagesTotal: stages.length,
      delivered: n(STAGE.DELIVERED),
      silent: stages.filter((s) => s.rawState === STAGE.SILENT).length,
      absent: stages.filter((s) => s.rawState === STAGE.ABSENT).length,
      declaredStages: declaredStages.length,
      undeclaredStages: undeclaredStages.map((s) => s.id),
      topicsTotal: read.length,
      agreed: read.filter((r) => r.verdict === VERDICT.AGREED).length,
      conflicts: read.filter((r) => r.disagrees).length,
      declaredConflicts: read.filter((r) => r.verdict === VERDICT.DECLARED_OPEN).length,
      singleSource: read.filter((r) => r.verdict === VERDICT.SINGLE_SOURCE).length,
      unanswered: read.filter((r) => r.verdict === VERDICT.UNANSWERED).length,
      undeclaredConflicts: undeclaredConflicts.map((r) => r.topic),
      staleDeclarations: stale,
      refusedDeclarations: reg.refused,
      // A silent or absent stage nobody has written down, a disagreement nobody has written down, a
      // rotted declaration, or a rubber-stamp reason. A DECLARED gap does not fail: software may not
      // decide what this company commits to at the end of a term, and a gate that stays red on a
      // decision only teaches people to ignore red.
      ok:
        head.readable &&
        undeclaredStages.length === 0 &&
        undeclaredConflicts.length === 0 &&
        stale.length === 0 &&
        reg.refused.length === 0,
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so the end of the term is unwalked rather than assumed";
  return (
    `${s.delivered} of ${s.stagesTotal} exit stages are carried by a document that speaks to them ` +
    `(${s.silent} silent, ${s.absent} absent, ${s.declaredStages} declared); ` +
    `${s.agreed} of ${s.topicsTotal} term windows agree across the documents that state them, ` +
    `${s.conflicts} disagree, ${s.undeclaredConflicts.length} of those undeclared`
  );
}

export default {
  auditTermAndExit,
  walkStage,
  statementFor,
  EXIT_WALK,
  TERM_TOPICS,
  STAGE,
  TERM_REGISTER,
  TERM_EXIT_SCHEMA,
};
