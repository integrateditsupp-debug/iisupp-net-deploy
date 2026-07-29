// emit-axis-status-run-142.mjs — regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made THIS cycle, and nothing is carried forward unexamined.
// Run:  node scripts/emit-axis-status-run-142.mjs
//
// This cycle's contribution is not a new feature. It is a correction: the previous three cycles
// reported the test runner as producing "no completion summary", which reads as a harness defect. It
// is not one. The cause was found and is stated below.
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Verified FIRST-HAND this cycle (node v22.22.3), each on its own exit code ──────────────────────
// Every suite below was executed individually and its process exit code read. No suite's verdict is
// inferred from another suite, from a registry summary, or from a previous cycle's report.
const tests = {
  reRunGreenThisCycle: [
    { suite: "b4-axis-chat", result: "20 passed, 0 failed", exit: 0 },
    { suite: "ab1-moves-without-us", result: "green", exit: 0 },
    { suite: "aa1-unopened-week", result: "green", exit: 0 },
    { suite: "axis-status-emitter", result: "green", exit: 0 },
    { suite: "axis-voice-dock", result: "green", exit: 0 },
    { suite: "axis-auth", result: "green", exit: 0 },
    { suite: "axis-snapshots", result: "green", exit: 0 },
    { suite: "axis-command-center", result: "green", exit: 0 },
    { suite: "axis-module-graph", result: "green", exit: 0 },
    { suite: "axis-criticality", result: "green", exit: 0 },
    { suite: "axis-intent-apply", result: "green", exit: 0 },
    { suite: "axis-inbox", result: "green", exit: 0 },
    { suite: "deploy-safety-denylist", result: "green", exit: 0 },
    { suite: "outreach-merge-guard", result: "green", exit: 0 },
    { suite: "sentry-b1-b2", result: "green", exit: 0 },
    { suite: "forums-mvp", result: "green", exit: 0 },
    { suite: "forums-commons", result: "green", exit: 0 },
    { suite: "concierge-service", result: "green", exit: 0 },
  ],
  suitesReRunGreen: 18,
  registryEntries: 325,
  registryEntriesNote:
    "Counted by PARSING the runner's TESTS array, not by grepping lines, and every one of the 325 " +
    "entries was resolved against the filesystem: 0 missing files. The previous cycle reported 315 " +
    "from a line count. 325 is the parsed figure and supersedes it.",
  fullRegistry:
    "NOT run to completion this cycle and NOT claimed as a clean pass. The reason is now known and is " +
    "recorded under the correction below.",
};

// ── A THREE-CYCLE MISREADING, CORRECTED (Rule 14) ──────────────────────────────────────────────────
const correctionsThisCycle = [
  {
    what:
      "The test runner has been reported for three cycles as running to 326 lines and then ending " +
      "WITHOUT printing its completion summary — which reads as a defect in the harness, and is not one.",
    detail:
      "The runner's summary is deferred to `beforeExit` so it can never print a green count ahead of the " +
      "assertions. That design is correct and intact. What actually happened is that the build sandbox " +
      "terminates every background process when the shell call that started it returns, and the full " +
      "registry takes longer than one call's wall clock. The run is KILLED mid-flight; it does not " +
      "finish and decline to summarise. Reproduced deliberately this cycle: a second run under a " +
      "shorter call died at 85 lines instead of 326 — a different, call-length-dependent cut-off, which " +
      "is the signature of an external kill rather than of a runner that reached its end. " +
      "Consequence: this environment cannot certify the full registry, and no cycle should imply the " +
      "harness is at fault for that. Individual suites run to completion and are certifiable, which is " +
      "why 18 were re-run on their own exit codes above.",
  },
  {
    what:
      "A liveness check reported the run as STILL RUNNING when the process was already dead.",
    detail:
      "`pgrep -f run-all.mjs` was matching the checking command's OWN argument string, which contained " +
      "that text. It returned a match with no test process alive. Any future liveness claim in this " +
      "environment has to exclude self-matches or it is not evidence.",
  },
  {
    what:
      "The mounted filesystem refuses unlink in the WORKING TREE, not only inside the repository's " +
      "internal directory. Previous cycles recorded the narrower version of this fact.",
    detail:
      "Verified first-hand both places this cycle: a file can be created and overwritten, and cannot be " +
      "removed (`Operation not permitted`). This is why no merge, checkout or commit is attempted from " +
      "this sandbox: all three take a lock file they must then remove, and a lock that cannot be " +
      "released would strand the operator's live repository. Two zero-byte probe files were left behind " +
      "and are disclosed below rather than quietly omitted. The probe has now been run on three " +
      "consecutive cycles and must not be run again — the answer is known.",
  },
];

const probeResidue = {
  filesLeftBehind: 2,
  detail:
    "Two zero-byte files created by this cycle's permissions probe could not be removed by the sandbox " +
    "that made them. Both are inert — one sits in the repository's internal directory, which ignores " +
    "unknown files, and one at the tree root. Both are deletable from the operator's own machine at any " +
    "time. Recorded here because a file this cycle created and cannot clean up is this cycle's to declare.",
  doNotRepeat: true,
};

const program = {
  series: "CLIENT-READY",
  sequence: "RUN-AB",
  sequenceTitle: "The first number that moves without us",
  sequenceState:
    "Built, tested and CLOSED. Its own exit condition says the correct next action is not another " +
    "sequence — so no RUN-AC was auto-released this cycle either, for the second cycle running. That is " +
    "the sequence's finding being honoured, not an idle cycle.",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 28,
  sequencesBuilt: 28,
  sequencesLanded: 0,
  note:
    "AB1 measures the whole mail record rather than a 3-day window and refuses `delivered` as unobserved " +
    "at every volume. AB2 names seven passive signals and marks all seven not measurable, as the primary " +
    "dated output. AB3 splits every open item into what needs a human hour and what does not, and its " +
    "second column is empty. All three re-verified green this cycle on their own exit code.",
};

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again. Reproduced on two separate operations " +
    "this cycle, not carried forward from the last one. The locally cached pointer is unchanged since " +
    "the previous cycle, and a cache is not a confirmation and is not reported as one.",
};

const costOfDelay = {
  costIndex: 29,
  unlandedSequences: 28,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 1,
  warmWindowsReachableNow: 8,
  note:
    "HELD at 29 for the fourth consecutive cycle. Nothing left the mailbox, no window closed, and no new " +
    "sequence was built, so no component of the index moved. An index that rose because a cycle audited " +
    "its own tooling would be measuring us rather than the delay.",
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
    "is known only not to have bounced.",
  meetings: 0,
  revenue: "none",
  movedThisCycle: false,
};

const lanes = [
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Re-verified first-hand this cycle rather than carried: the push-to-talk dock and the spoken status answer are present on the shared line, and the diff of both source files against it is empty. The voice work this cycle was asked to build is already landed." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single sanctioned emitter. Public mirrors headline-only and leak-scanned." },
  { lane: "operator command centre v2", state: "merged locally, verified green, unpushed", merged: "local",
    note: "Unchanged this cycle. No write was made to the operator's repository from this sandbox, by design." },
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "28 sequences verified in the working tree; none has reached the shared line." },
  { lane: "test certification", state: "corrected this cycle", merged: false,
    note: "18 suites certified individually on their own exit codes. The full registry of 325 cannot be certified from this environment, and the reason is now stated as an environment limit rather than implied to be a harness defect." },
];

const passiveSurface = {
  signalsNamed: 7,
  signalsMeasurable: 0,
  finding:
    "Unchanged. No passive signal is measurable today — a refusal, not a zero.",
};

const movesWithoutUs = {
  itemsAssessed: 7,
  moveOnTheirOwn: 0,
  finding:
    "Unchanged, and re-verified green. Nothing in this program moves on its own. This cycle produced a " +
    "true correction and a regenerated feed; neither is a business number, and neither is offered as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "The BACK IN page in the outbound folder — 8 ordered actions with message bodies attached, executable cold.",
    why: "Still the only item on this list that can move a business number. Two stated return dates have passed and one window closed unused." },
  { item: "A code-hosting credential for the build sandbox",
    what: "28 verified sequences plus a verified local merge cannot reach the shared line without it.",
    why: "Highest-leverage unblock. Authentication was refused again this cycle, on two separate operations." },
  { item: "Land the merged command-centre line",
    what: "One staged script that re-runs the suite on the operator's machine and refuses to push if red.",
    why: "The merge is computed and verified; only the push is missing." },
  { item: "Publish the site",
    what: "One deliberate operator action.",
    why: "Merging never deploys. This stays a separate human decision." },
  { item: "Delete two zero-byte probe files",
    what: "Both disclosed above. Inert, and removable in seconds from the operator's own machine.",
    why: "This cycle created them and could not clean them up. It says so rather than omitting it." },
];

const blockers = [
  { blocker: "The hour is prepared and has not been spent", price: "cost index 29, 8 windows open and unanswered, 1 already closed unused", isSoftwareTask: false },
  { blocker: "No code-hosting credential in the build sandbox", price: "28 verified sequences plus a verified merge, all unlanded", isSoftwareTask: false },
  { blocker: "The build sandbox cannot remove a file", price: "no merge, checkout or commit can be attempted from it safely — landing is a staged operator click by necessity, not by preference", isSoftwareTask: false },
  { blocker: "The full test registry cannot be certified from this environment", price: "325 suites; 18 certified individually per cycle instead", isSoftwareTask: true },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track, unchanged. This cycle did not move the business " +
    "scoreboard and does not claim to. What it did was stop three cycles of reporting an environment " +
    "limit as a defect in our own harness, and make the status feed true as of its own timestamp.",
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
    program, tests, correctionsThisCycle, probeResidue, mainRef, costOfDelay, blockers,
    outcomeLadder, passiveSurface, movesWithoutUs, lanes, onTrack, needsAhmad,
  },
});

console.log("internal:", res.written.internal);
console.log("public:", res.written.public.join(", "));
console.log("generatedAt:", res.publicStatus.generatedAt);
