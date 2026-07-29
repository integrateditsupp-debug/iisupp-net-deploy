// emit-axis-status-run-139.mjs — RUN 139: regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made THIS cycle, and nothing is carried forward unexamined.
// Run:  node scripts/emit-axis-status-run-139.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Re-run first-hand this cycle (node v22.22.3), not carried forward ─────────────────────────────
const tests = {
  newThisCycle: null,
  newThisCycleNote:
    "No new suite this cycle, because no new module was written. RUN-AB's finding was that further " +
    "software cannot move the two numbers that are not on track, and auto-releasing another sequence " +
    "would contradict it. This cycle spent itself on the operator's cost instead.",
  reRunGreenThisCycle: [
    { suite: "axis-status-emitter", passed: "green", failed: 0 },
    { suite: "axis-command-center", passed: "green", failed: 0 },
    { suite: "axis-voice-dock", passed: "green", failed: 0 },
    { suite: "deploy-safety-denylist", passed: "green", failed: 0 },
    { suite: "axis-auth", passed: "green", failed: 0 },
    { suite: "axis-snapshots", passed: "green", failed: 0 },
    { suite: "b4-axis-chat", passed: "green", failed: 0 },
    { suite: "ab1-moves-without-us", passed: 39, failed: 0 },
  ],
  fullRegistry:
    "NOT run to completion this cycle and NOT claimed as a clean pass. Same two sandbox-only exclusions " +
    "as RUN-U through RUN-AB (a full-repo tree-walk that exceeds the per-call wall clock, and an unlink " +
    "permissions error against the mounted filesystem). Neither was touched.",
  registryEntries: 315,
};

const program = {
  series: "CLIENT-READY",
  sequence: "RUN-AB",
  sequenceTitle: "The first number that moves without us",
  sequenceState:
    "Built and green. No RUN-AC was released, deliberately - see RUN-AB's own finding. The next build " +
    "sequence is released after a sitting is recorded, or on explicit instruction.",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 28,
  sequencesBuilt: 28,
  sequencesLanded: 0,
  note:
    "This cycle wrote no product module. It attacked the reason twenty-eight verified sequences are still " +
    "not on the shared line, which is not that the work is unfinished: landing it cost ELEVEN scripts run " +
    "in a specific order, and that price has gone unpaid for eleven cycles. It is now ONE script. " +
    "AHMAD-LAND-EVERYTHING.cmd runs the ten numbered pushes in dependency order and then the " +
    "axis-command-center-v2 merge, stops dead at the first failure, adds no authority of its own and " +
    "skips no guard - every sub-script keeps its dirty-tree refusal, its leak scan, its suite gate and " +
    "its fast-forward-only push. Reducing the operator's cost is the only lever this sandbox has, because " +
    "it cannot reach the code host.",
};

// Rule 14: what this cycle checked itself on rather than trusting the previous entry.
const correctionsThisCycle = [
  {
    what: "The cost index was NOT incremented this cycle, and that is deliberate.",
    detail:
      "It reads 29, the same as last cycle. Its two live components did not move: no new sequence was " +
      "built, so the unlanded count stayed at 28, and the last send is still dated 2026-07-28, so " +
      "days-since-mail is still 1. Incrementing a cost index simply because a cycle ran would make it a " +
      "measure of our own activity rather than of delay, which is the exact failure RUN-AB's second " +
      "column exists to prevent.",
  },
  {
    what: "Both sandbox limits were re-tested first-hand rather than carried forward from the ledger.",
    detail:
      "`git ls-remote origin main` returned `could not read Username for 'https://github.com'`. Creating " +
      "a file inside the mounted `.git` succeeds but removing it fails with `Operation not permitted`, so " +
      "no worktree can be made there either. Neither limit is assumed; both were reproduced this cycle. " +
      "No code-hosting MCP or credential is available to this sandbox - that was also checked, not assumed.",
  },
];

const costOfDelay = {
  costIndex: 29,
  unlandedSequences: 28,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 1,
  warmWindowsReachableNow: 8,
  note:
    "Unchanged from last cycle at 29. Neither live component moved. See the correction - a cost index " +
    "that rises because a cycle ran is measuring us, not the delay.",
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
    "One, dated 2026-07-22, disposition `declined`. A decline is a reply; it is not a meeting and it is " +
    "not revenue.",
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
  movedThisCycle: false,
  movedThisCycleNote: "No rung moved. Nothing left the mailbox and nothing arrived in it.",
};

const passiveSurface = {
  signalsNamed: 7,
  signalsMeasurable: 0,
  finding:
    "No passive signal is measurable today. That is a refusal, not a zero - no record reachable without " +
    "payment carries site traffic.",
  nearestFreeUnblock:
    "Two of the seven are close and free: a distinguishable subject line would make a form submission " +
    "tellable apart from ordinary mail, and one extra event kind (an arrival with no prior send against " +
    "the same handle) would make unsolicited inbound countable inside a record already read every cycle.",
};

const movesWithoutUs = {
  itemsAssessed: 7,
  moveOnTheirOwn: 0,
  finding:
    "Nothing in this program moves on its own. Every open item waits on one person sitting down. This " +
    "cycle did not change that finding and does not claim to - it made the sitting cheaper, not optional.",
};

const lanes = [
  { lane: "landing the built work", state: "eleven clicks reduced to one", merged: false,
    note: "AHMAD-LAND-EVERYTHING.cmd: ten numbered pushes in dependency order, then the axis-command-center-v2 merge. Stops at the first failure and names the resume point. No guard removed, no authority added." },
  { lane: "operator command centre v2", state: "merge verified green, unpushed", merged: "local",
    note: "The 14-commit axis-command-center-v2 line merges into the shared-line tip with zero conflicts, 80 files, and seven guard suites green ON THE MERGED TREE. Verified last cycle in a clean-room clone; the sandbox still has no code-host credential, re-tested this cycle." },
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "RUN-U through RUN-AB. Twenty-eight sequences verified in the working tree; none has reached the shared line." },
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Push-to-talk dock and the spoken status answer are already on the shared line; the diff of both source files against it is empty. Re-verified first-hand this cycle, not carried forward. Fourth cycle with the same finding." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single emitter. Public mirrors headline-only and leak-scanned. Seven AXIS guard suites re-run green after the write." },
];

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again this cycle - reproduced first-hand, not " +
    "carried forward. The locally cached pointer reads 40fa4aa4; a cache is not a confirmation and is not " +
    "reported as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "senior-director-state/outbound/BACK-IN-2026-07-29.md - 8 ordered actions with message bodies attached, executable cold. Two prospect-stated return dates have already passed and one window closed unused on 2026-07-28.",
    why: "0 of 7 open items move without it. Nothing else on this list changes a business number." },
  { item: "Land everything - now ONE click",
    what: "_staged-cc-runs/AHMAD-LAND-EVERYTHING.cmd. Twenty-eight sequences plus the verified command-centre merge, in dependency order, with every sub-script's own guards intact. It re-runs the suite on your machine and refuses to push if red.",
    why: "It was eleven scripts in a required order for eleven cycles and none of them ran. The price was the problem." },
  { item: "A code-hosting credential for the build sandbox",
    what: "Without it, nothing this program builds can reach the shared line on its own, ever.",
    why: "Single highest-leverage unblock. Authentication was refused again this cycle." },
  { item: "Publish the site",
    what: "One deliberate operator action in Netlify.",
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
    "Landing and conversion both read NOT on track. Build and tests are green. This cycle attacked landing " +
    "from the only side available to it - the operator's cost - and cannot claim landing until a script " +
    "actually runs. Conversion is untouched and stays untouched until an hour is spent.",
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
    "drafted, 0 sent. Meetings 0, revenue none. No passive signal is measurable. Nothing here moves " +
    "without a person spending an hour - this cycle made that hour cheaper, not optional.",
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
