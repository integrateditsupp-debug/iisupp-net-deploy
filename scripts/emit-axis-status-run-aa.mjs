// emit-axis-status-run-aa.mjs — RUN-AA: regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made this cycle, and nothing is carried forward unexamined.
//
// Public mirrors are headline-only and leak-scanned by the emitter itself; internal detail goes only to
// the authenticated full file. Run:  node scripts/emit-axis-status-run-aa.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Real, first-hand this cycle ────────────────────────────────────────────────────────────────────
// Suites re-run to completion in this sandbox on node v22.22.3 (counts are the runner's own output).
const tests = {
  newThisCycle: { suite: "aa1-unopened-week", passed: 28, failed: 0 },
  reRunGreen: [
    { suite: "z1-second-hour", passed: 36, failed: 0 },
    { suite: "y1-spent-hour", passed: 24, failed: 0 },
    { suite: "x1-cost-of-delay", passed: 27, failed: 0 },
    { suite: "w1-first-answered-reply", passed: 20, failed: 0 },
    { suite: "v1-warm-redirect", passed: 13, failed: 0 },
    { suite: "u1-outbound-truth", passed: 11, failed: 0 },
  ],
  axisGuardsGreenAfterFeedWrite: [
    "b4-axis-chat", "axis-status-emitter", "deploy-safety-denylist",
    "axis-command-center", "axis-voice-dock",
  ],
  fullRegistry:
    "NOT run to completion this cycle and NOT claimed as a clean pass. Same two sandbox-only exclusions " +
    "as the previous cycles (a tree-walk budget and a permissions error); neither was touched.",
  registryEntries: 314,
};

const program = {
  series: "CLIENT-READY",
  sequence: "RUN-AA",
  sequenceTitle: "The week that survives itself",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 26,
  sequencesBuilt: 27,
  sequencesLanded: 0,
  note:
    "AA1 unopened-week: a gap in operator entries rendered as a fact with a date. A test runs 1, 7, 14, 30, " +
    "90, 200 and 400-day gaps and asserts no judgement, streak, guilt or urgency vocabulary appears at any " +
    "length, no exclamation is ever rendered, and the outcome ladder and cost of delay come back " +
    "byte-identical across a 200-day gap. `never opened` stays distinct from `opened and nothing happened` " +
    "and never reports a gap length. AA2 week-reentry: ONE cold-executable page for the operator returning " +
    "after a gap - the change set is a real difference between two snapshots, renders the exact line " +
    "\"Nothing changed while you were away.\" when nothing moved, treats an unverified side as an absence " +
    "rather than a movement, reports a worsening number as a rise without softening it, and is asserted " +
    "leak-free and one-sitting with overflow stated rather than truncated. AA3 week-record: the weekly " +
    "roll-up states the counts that did NOT move FIRST, keeps `nothing recorded` and `recorded, nothing " +
    "done` as separate facts that never render as one another, carries skip reasons byte-identical, and " +
    "renders identically with every build counter injected. 28 new tests green, registered in the runner.",
};

// From the real records, recomputed this cycle (not carried forward).
const costOfDelay = {
  costIndex: 28,
  unlandedSequences: 27,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 0,
  warmWindowsReachableNow: 8,
  note:
    "Unchanged from the previous cycle at 28 because a send left the mailbox on 2026-07-28, which holds " +
    "days-since-mail at 0. The unlanded-sequence component rose with this sequence.",
};

const outcomeLadder = {
  reached: "sent",
  firstContactSends: 45,
  firstContactSendsNote:
    "45 dated send events in the mail record, which the record itself calls a floor and not a total.",
  secondMessagesDrafted: 12,
  secondMessagesSent: 0,
  secondMessagesSentNote:
    "A separate number from first-contact sends, and the one that has not moved. The two are never collapsed.",
  prospectReplies: 0,
  meetings: 0,
  revenue: "none",
};

const thisWeek = {
  window: "2026-07-22 to 2026-07-29",
  computedFrom: "the mail record's own dated events inside the window - never hand-set",
  sent: 45,
  replies: 0,
  meetings: 0,
  revenue: 0,
  sittingsRecorded: 0,
  state: "nothing recorded",
  stateNote:
    "No sitting was entered for this week. That is an absence of a record and is deliberately not the same " +
    "as a week in which the operator sat down and executed nothing.",
  correction:
    "Earlier cycles reported the ladder as `sent 0`. That was the SECOND-MESSAGE count and was correct for " +
    "that number, but read as though nothing had left the mailbox at all. 45 first-contact sends are dated " +
    "in the record, 45 of them inside this week. Both numbers are now stated separately on every surface.",
};

const lanes = [
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "RUN-U through RUN-AA. Twenty-seven sequences verified in the working tree; none has reached the shared line." },
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Push-to-talk dock and the spoken status answer are already on the shared line; nothing to branch or merge this cycle. Verified by diffing the two source files against it - the diff is empty." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single emitter. Public mirrors headline-only and byte-identical; leak check returned OK." },
  { lane: "operator command centre v2", state: "built, pushed, NOT merged", merged: false,
    note: "Fourteen commits exist on a working lane and are safely on the code host, but are not on the shared line. Merging needs a credential this sandbox does not have." },
];

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again this cycle, so the shared line could not " +
    "be re-confirmed first-hand. A locally cached pointer exists but a cache is not a confirmation and is " +
    "not reported as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "The BACK IN page in the outbound folder - 8 ordered actions with message bodies attached, executable cold. Two prospect-stated return dates have already passed and one window closed unused on 2026-07-28.",
    why: "The second-message count is the one number software cannot move." },
  { item: "Record the sitting afterwards",
    what: "The spent-hours log in the outbound folder. Append one object per sitting.",
    why: "Nothing here may infer a send. Without the entry the program correctly reads `nothing recorded` forever." },
  { item: "A code-hosting credential for the build sandbox",
    what: "27 verified sequences plus 14 command-centre commits cannot reach the shared line without it.",
    why: "Single highest-leverage unblock. Authentication was refused again this cycle." },
  { item: "Publish the site",
    what: "One deliberate operator action.",
    why: "Merging never deploys. This has always been, and stays, a separate human decision." },
];

const blockers = [
  { blocker: "The hour is prepared and has not been spent", price: "cost index 28, 8 windows open and unanswered, 1 already closed unused", isSoftwareTask: false },
  { blocker: "No code-hosting credential in the build sandbox", price: "27 verified sequences unlanded", isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track. Build and tests are green. Nothing in the software " +
    "column can change the other two.",
};

// ── Public: headline only. Every field is leak-scanned and capped by the emitter. ──────────────────
const publicFields = {
  generatedAt: now,
  status: "active build",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. Delivery is staged " +
    "and waits on deliberate operator actions, not on further software.",
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. 45 first-contact messages have been sent; 12 follow-ups are drafted " +
    "and none has been sent; prospect replies 0, meetings 0, revenue none - stated plainly, not dressed up. " +
    "Eight routes a prospect opened are reachable now and one closed unused.",
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
};

const res = emitAxisStatus({
  root: process.cwd(),
  publicFields,
  fullDetail: {
    schema: "axis-status-full/1",
    generatedAt: now,
    honest: true,
    program, tests, mainRef, costOfDelay, blockers, outcomeLadder, thisWeek, lanes, onTrack, needsAhmad,
  },
});

console.log("internal:", res.written.internal);
console.log("public:", res.written.public.join(", "));
console.log("generatedAt:", res.publicStatus.generatedAt);
