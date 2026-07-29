// emit-axis-status-run-ab.mjs — RUN-AB: regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made this cycle, and nothing is carried forward unexamined.
// Run:  node scripts/emit-axis-status-run-ab.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Real, first-hand this cycle (node v22.22.3) ────────────────────────────────────────────────────
const tests = {
  newThisCycle: { suite: "ab1-moves-without-us", passed: 39, failed: 0 },
  reRunGreenOnTheMERGEDTree: [
    { suite: "b4-axis-chat", passed: "green", failed: 0 },
    { suite: "axis-command-center", passed: "green", failed: 0 },
    { suite: "axis-status-emitter", passed: "green", failed: 0 },
    { suite: "axis-voice-dock", passed: "green", failed: 0 },
    { suite: "deploy-safety-denylist", passed: "green", failed: 0 },
    { suite: "outreach-merge-guard", passed: "green", failed: 0 },
    { suite: "sentry-b1-b2", passed: "green", failed: 0 },
  ],
  fullRegistry:
    "NOT run to completion this cycle and NOT claimed as a clean pass. Same two sandbox-only exclusions " +
    "as the previous cycles (a full-repo tree-walk that exceeds the per-call wall clock, and an unlink " +
    "permissions error against the mounted filesystem). Neither was touched.",
  registryEntries: 315,
};

const program = {
  series: "CLIENT-READY",
  sequence: "RUN-AB",
  sequenceTitle: "The first number that moves without us",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 27,
  sequencesBuilt: 28,
  sequencesLanded: 0,
  note:
    "AB1 passive-outcomes: the WHOLE mail record measured end to end rather than the 3-day window the " +
    "counters were reading - 45 sent, 4 undeliverable, 11 auto-replied, 1 personal reply, 29 silent. " +
    "`delivered` is refused as `unobserved` at every volume (0, 1, 45, 1000) because this mailbox has no " +
    "delivery receipts, and no rate is ever computed against it; a test asserts the refusal cannot be " +
    "removed. Silence is labelled as derived-by-absence everywhere it appears. AB2 passive-surface: seven " +
    "passive signals named individually, every one marked `not measurable here` with the specific free " +
    "unblock stated; the refusal is the PRIMARY dated output rather than a footnote, and fifteen forbidden " +
    "proxies - deploys, builds, uptime, suite counts - cannot be promoted into a passive signal. AB3 " +
    "moves-without-us: a two-column split where the right column requires a named, dated, observable " +
    "mechanism, and software progress can never earn it. 39 new tests green, registered in the runner.",
};

// A DEFECT THIS CYCLE'S OWN TESTS CAUGHT AND KILLED (Rule 14).
const correctionsThisCycle = [
  {
    what: "AB3 promoted software progress into the `moves on its own` column when it was rephrased.",
    detail:
      "The rejection was a plain substring match, so \"the suite is green\" - three characters away from " +
      "the listed \"suite green\" - was accepted as a real self-moving mechanism. The rejection is now a " +
      "vocabulary match of 30 patterns and a test asserts nine separate rephrasings all still fail. " +
      "Caught by the suite on first run, fixed rather than relaxed.",
  },
  {
    what: "Prospect replies have been reported as 0. The mail record contains 1.",
    detail:
      "One personal reply is dated 2026-07-22 in the outbound record, with the disposition `declined` " +
      "(not looking for an MSP, asked to be kept on file). The 0 that has been published is the count of " +
      "replies to the SECOND message, which is correct for that number. Both are now stated separately. " +
      "A decline is a reply and the funnel does not get to drop an answer because the answer was no.",
  },
];

const costOfDelay = {
  costIndex: 29,
  unlandedSequences: 28,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 1,
  warmWindowsReachableNow: 8,
  note:
    "Rose by one from 28. The unlanded-sequence component rose with this sequence; days-since-mail moved " +
    "from 0 to 1 because the last send is dated 2026-07-28 and nothing has left the mailbox since.",
};

const outcomeLadder = {
  reached: "replied",
  firstContactSends: 45,
  firstContactSendsNote:
    "45 dated send events in the mail record, which the record itself calls a floor and not a total.",
  undeliverable: 4,
  autoReplies: 11,
  personalReplies: 1,
  personalRepliesNote:
    "One, dated 2026-07-22, disposition `declined`. Previously published as 0 - see the correction. A " +
    "decline is a reply; it is not a meeting and it is not revenue.",
  secondMessagesDrafted: 12,
  secondMessagesSent: 0,
  secondMessagesSentNote:
    "A separate number from first-contact sends, and the one that has not moved.",
  delivered: "unobserved",
  deliveredNote:
    "Not a zero and not a number. This mailbox has no delivery receipts, so a message that did not bounce " +
    "is known only not to have bounced. Reporting 41 delivered would be a fabricated metric.",
  meetings: 0,
  revenue: "none",
};

const passiveSurface = {
  signalsNamed: 7,
  signalsMeasurable: 0,
  finding:
    "No passive signal is measurable today. Nothing on the live site is currently producing a number this " +
    "program can read. That is a refusal, not a zero - the site has not been measured, because no record " +
    "reachable without payment carries site traffic.",
  nearestFreeUnblock:
    "Two of the seven are close and free: a distinguishable subject line would make a form submission " +
    "tellable apart from ordinary mail, and one extra event kind (an arrival with no prior send against " +
    "the same handle) would make unsolicited inbound countable inside a record already read every cycle.",
};

const movesWithoutUs = {
  itemsAssessed: 7,
  moveOnTheirOwn: 0,
  finding:
    "Nothing in this program moves on its own. Every open item waits on one person sitting down. The two " +
    "items that claimed a mechanism - the site being up, the suite being green - are software progress and " +
    "were rejected. The entire remaining gap is one person writing to another.",
};

const lanes = [
  { lane: "operator command centre v2", state: "MERGED INTO main LOCALLY, verified green, unpushed", merged: "local",
    note: "The 14-commit axis-command-center-v2 line was merged into the shared-line tip in a clean-room clone this cycle. Zero conflicts. Seven guard suites re-run green ON THE MERGED TREE. The push is one staged click; the sandbox has no code-host credential." },
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "RUN-U through RUN-AB. Twenty-eight sequences verified in the working tree; none has reached the shared line." },
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Push-to-talk dock and the spoken status answer are already on the shared line; the diff of both source files against it is empty. Re-verified first-hand, not carried forward." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single emitter. Public mirrors headline-only and leak-scanned." },
];

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again this cycle, so the shared line could not " +
    "be re-confirmed over the network. The locally cached pointer reads 40fa4aa4 and the merge this cycle " +
    "was computed against it; a cache is not a confirmation and is not reported as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "The BACK IN page in the outbound folder - 8 ordered actions with message bodies attached, executable cold. Two prospect-stated return dates have already passed and one window closed unused on 2026-07-28.",
    why: "AB3's finding, in one line: nothing else in this program can move without it." },
  { item: "Land the merged command-centre line",
    what: "One staged script. The merge is already computed and verified green; the script re-runs the suite on your machine and refuses to push if red.",
    why: "14 commits of command-centre work are on a side lane and not on the shared line." },
  { item: "A code-hosting credential for the build sandbox",
    what: "28 verified sequences plus the merged command-centre line cannot reach the shared line without it.",
    why: "Single highest-leverage unblock. Authentication was refused again this cycle." },
  { item: "Publish the site",
    what: "One deliberate operator action.",
    why: "Merging never deploys. This has always been, and stays, a separate human decision." },
];

const blockers = [
  { blocker: "The hour is prepared and has not been spent", price: "cost index 29, 8 windows open and unanswered, 1 already closed unused", isSoftwareTask: false },
  { blocker: "No code-hosting credential in the build sandbox", price: "28 verified sequences plus a verified merge, all unlanded", isSoftwareTask: false },
  { blocker: "No passive signal is measurable", price: "the site cannot produce a number, so no item can ever enter the second column from it", isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track. Build and tests are green. RUN-AB's finding is that " +
    "nothing in the software column can change the other two - the remaining gap is one person writing to " +
    "another, and the correct next action is the hour rather than another sequence.",
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
    "ARIA / AXIS is in active build. 45 first-contact messages sent: 4 undeliverable, 11 autoresponders, " +
    "1 personal reply declining. Delivery is unobserved and is not reported as a number. 12 follow-ups " +
    "drafted, 0 sent. Meetings 0, revenue none. No passive signal is measurable, and nothing here moves " +
    "without a person spending an hour.",
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
    program, tests, correctionsThisCycle, mainRef, costOfDelay, blockers,
    outcomeLadder, passiveSurface, movesWithoutUs, lanes, onTrack, needsAhmad,
  },
});

console.log("internal:", res.written.internal);
console.log("public:", res.written.public.join(", "));
console.log("generatedAt:", res.publicStatus.generatedAt);
