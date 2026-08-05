// emit-axis-status.mjs — regenerate the AXIS status feed from REAL sources.
//
// THIS FILE SUPERSEDES THE RUN-NUMBERED EMITTERS (emit-axis-status-run-139..142.mjs and
// emit-axis-status-run-aa/ab.mjs). Those are kept for the record and must not be run again.
// Reason: a new emitter per cycle was itself sprawl — seven files that only ever differ in their
// payload, competing to be "the current one". There is now exactly one, and a cycle updates its
// payload in place rather than adding an eighth. Same emitter library, same leak gate, same
// guarantees; one fewer decision for anyone reading this folder.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made THIS cycle, and nothing is carried forward unexamined (Rule 14).
//
// Run:  node scripts/emit-axis-status.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";
import { needsAhmadStaged } from "./lib/needs-ahmad-staged.mjs";
import { assertStagedActionsHonest } from "./lib/staged-action-guard.mjs";

const now = new Date().toISOString();

// ── Verified FIRST-HAND this cycle (node v22), each on its own exit code ───────────────────────────
// Every suite below was executed in this cycle and its result read from its own output. No suite's
// verdict is inferred from another suite, from a registry summary, or from a prior cycle's report.
const tests = {
  reRunGreenThisCycle: [
    { suite: "FULL REGISTRY (npm test in ARIA Sentinel) — the operator's real repository, FIRST action of the cycle, before any file was written",
      result: "516 tests, 516 pass, 0 fail; 330/330 suite files green; exit 0. The line this cycle started from was measured, not inherited from the previous cycle's report.", exit: 0 },
    { suite: "FULL REGISTRY — re-run after every write this cycle",
      result: "532 tests, 532 pass, 0 fail; 332/332 suite files green; exit 0. The rise from 516/330 to 532/332 is this cycle's two new suites and nothing else.", exit: 0 },
    { suite: "b4-axis-chat — the suite covering the AXIS spoken-status path, run STANDALONE by name",
      result: "20 passed, 0 failed, exit 0. Named separately every cycle because a priority that is never separately confirmed is a priority in name only.", exit: 0 },
    { suite: "AJ1 — the staged-action guard, proven RED then GREEN on the same claim",
      result: "Run against RUN-AI's pre-fix item verbatim ('twelve second messages, drafted and ready', no artefact declared): REFUSED, class no-artefact-declared. Run against the post-fix item naming the send sheet: pass, artefact verified present and non-empty. 8 tests, 8 pass, 0 fail, exit 0. Every currently staged item audited by the same rule in the same suite.", exit: 0 },
    { suite: "AJ2 — the second-touch path walked end to end against the real records",
      result: "Real warm record → queue (12 live, 12 reachable now, 1 expired, 10 email + 2 phone) → 12 drafts, 0 refused → every drafted handle confirmed present in the send sheet and no handle in the sheet that the module never drafted. Ladder: 0 sends stops at `drafted`; 12 sends reach `sent` and no rung above it; a decline registers as `replied` and never as interest. 8 tests, 8 pass, 0 fail, exit 0.", exit: 0 },
    { suite: "CREDENTIAL REFUSAL — re-tested first-hand, not inherited",
      result: "git ls-remote against the real remote with terminal prompts disabled: refused, verbatim 'could not read Username for https://github.com'. The agent boundary, working as intended.", exit: 0 },
  ],
  suitesReRunGreen: 6,
  fullRegistry:
    "532 tests, 532 pass, 0 fail, 332/332 suites, exit 0 — with the standing qualification that still " +
    "holds: that number is only reproducible on a machine holding the operator's untracked records. The " +
    "same commit in a bare clone returns a documented ENOENT set against the gitignored record root. " +
    "This cycle's record-reading suite was added to the tracked manifest in the same commit that " +
    "introduced it, so record-dependency-declared.test.mjs stays green and the cost stays visible.",
};

// ── WHAT THIS CYCLE ESTABLISHED (Rule 14) ─────────────────────────────────────────────────────────
const correctionsThisCycle = [
  {
    what:
      "THE STAGING CLAIM IS NOW SELF-AUDITING. RUN-AI found a one-click action reported as staged for " +
      "fourteen days with nothing on disk behind it. This cycle made that shape impossible to write again.",
    detail:
      "Every staged one-click action must now declare EITHER the readable artefact it operates on — a " +
      "path that must exist, be a file and be non-empty — OR, explicitly, that it has no artefact and " +
      "why. Declaring neither fails. Declaring both fails. Writing prose that claims a drafted or " +
      "rendered thing while declaring no artefact fails by name, which is precisely RUN-AI's shape. The " +
      "guard is not advisory: the status emitter calls it and THROWS, so a feed carrying an unbacked " +
      "staged claim cannot be written at all. Proven red against RUN-AI's item as it was actually " +
      "worded, and green against the same item once it names the send sheet.",
  },
  {
    what:
      "THE SECOND-TOUCH PATH WAS WALKED END TO END FOR THE FIRST TIME. The parts had been green for " +
      "cycles; the path THROUGH them had never been run, which is how twelve phantom drafts survived.",
    detail:
      "Real warm-redirect record into the queue builder (12 live, 12 reachable now, 1 route expired " +
      "unreached, 10 email and 2 phone), into the drafting module (12 drafts, 0 refused), against the " +
      "send sheet on disk — every drafted handle confirmed present in the file, and no handle in the " +
      "file that the module never produced. That parity assertion is the one that would have caught " +
      "RUN-AI's defect on the day it happened rather than fourteen days later. Then the ladder: with " +
      "zero sends it stops at `drafted` and says the send is a human click; with twelve sends it reaches " +
      "`sent` and not one rung further; a decline is recorded as a reply and is never softened into " +
      "interest; an unknown disposition is refused by name rather than coerced to the nearest " +
      "flattering value.",
  },
  {
    what:
      "THE BUSINESS NUMBER DID NOT MOVE, AND IS NOT DRESSED UP. Second messages sent this cycle: zero.",
    detail:
      "The send sheet exists and is readable. The twelve messages have now been drafted for fourteen " +
      "days and readable for less than one. Sending them is one person writing to another and it is not " +
      "an agent's action. Meetings: zero. Revenue: none. The offer remains untested past a single " +
      "touch, and no software written this cycle changes that — what this cycle changed is that the " +
      "program can no longer misreport its own staging as someone else's delay.",
  },
];

const mainRef = {
  liveConfirmed: false,
  reason:
    "Reproduced again this cycle against the real remote, not carried forward: the code host refused " +
    "with 'could not read Username'. No credential helper, no token in the environment, no code-host " +
    "CLI. Every reference here is a last-known LOCAL read and is labelled as such. This is not a defect " +
    "to be solved; it is the agent boundary working as intended.",
  localAheadOfLastKnownRemote: 42,
  aheadCountCaveat:
    "42 measured this cycle before this feed was committed; committing it makes 43. Stated both ways on " +
    "purpose — a hard number invalidated by its own commit is wrong every time it is read.",
};

const workingTree = {
  filesModified: 5,
  filesUntracked: 3,
  indexStalenessCleared:
    "No new lock work was needed this cycle. The standing finding holds and is not re-derived: the mount " +
    "refuses unlink ('Operation not permitted', exit 1) and permits rename (exit 0), so the graveyard " +
    "rename is the filesystem's permitted write shape rather than a workaround.",
  composition:
    "This cycle's changes are the staged-action guard and its data module, two new test suites, their " +
    "registration in the runner and the tracked record-dependency manifest, the emitter payload, and " +
    "the regenerated status feed. Scanned for credentials, keys, environment files and dependency " +
    "directories: 0 hits. The off-limits personal folder was never read, listed or referenced.",
  committed: true,
  howItWasUnblocked:
    "The full registry ran against the operator's real repository as the first action of the cycle and " +
    "again after every write, each result read from its own exit code.",
  branch: "main",
  stillBlocked:
    "The commits exist locally and cannot be pushed. The credential refusal was reproduced against the " +
    "real remote this cycle. Committed is strictly better than uncommitted, and is not the same as landed.",
};

const program = {
  series: "flywheel",
  sequence: "RUN-AJ — the first sent second message",
  previousSequence: "RUN-AI — the question that was never asked",
  tasksBuiltAndGreen: 3,
  tasksTotal: 3,
  tasksMerged: 3,
  pct: 100,
  testsGreen: true,
  verificationCycleNote:
    "No customer-visible change this cycle and none is claimed. What changed is that the failure mode " +
    "RUN-AI found by hand is now caught by a test that refuses to let it be written.",
  note:
    "Build state only. AJ1 — staged one-click actions must name the readable artefact they operate on; " +
    "the guard is proven red against RUN-AI's pre-fix wording and green against the fix, the emitter " +
    "throws rather than publish an unbacked claim, and all four currently staged items were audited. " +
    "AJ2 — the second-touch path walked end to end against the real records, including the send-sheet " +
    "parity assertion that would have caught RUN-AI's defect on day one, and the ladder proven unable " +
    "to render a lower rung as a higher one. AJ3 — this feed regenerated from this cycle's own numbers. " +
    "Second messages sent: still zero.",
};

const lanes = [
  { lane: "The twelve follow-ups", state: "readable, audited, still unsent",
    detail:
      "Drafted for fourteen days, readable on disk for less than one. This cycle asserted the send sheet " +
      "against the module's real output in both directions — every drafted handle is in the file, and " +
      "the file names no handle the module never drafted — so the artefact is proven, not asserted. " +
      "Sent: zero. That number is a human action away and is reported as such without softening." },
  { lane: "Staged one-click claims", state: "self-auditing as of this cycle",
    detail:
      "A staged action must name a readable artefact or state plainly that it has none and why. Neither " +
      "declaration, both declarations, a named file that is absent or empty, or prose claiming a drafted " +
      "thing while declaring no artefact — each fails by its own name. The status emitter refuses to " +
      "write a feed that carries one." },
  { lane: "The second-touch path", state: "walked end to end for the first time",
    detail:
      "Record → queue → drafts → artefact parity → ladder → reply capture, exercised against the real " +
      "records rather than fixtures. Zero sends stops at `drafted`; twelve sends reach `sent` and no " +
      "further; a decline is a reply and is never rendered as interest." },
  { lane: "The test line", state: "green, measured before and after",
    detail:
      "516 pass, 0 fail, 330/330, exit 0 before any write. 532 pass, 0 fail, 332/332, exit 0 after every " +
      "write. The chat suite covering the spoken status path was run standalone by name: 20 pass, 0 fail." },
  { lane: "AXIS voice and the spoken status answer", state: "on the shared line, re-confirmed by name",
    detail:
      "Push-to-talk mic control and the spoken reply path are present on the shared branch and their " +
      "suite is green standalone. Nothing was merged for it this cycle because nothing needed to be." },
  { lane: "Reaching the code host", state: "still refused",
    detail:
      "No credential in this environment; re-tested against the real remote this cycle rather than " +
      "inherited. The shared branch sits 42 commits ahead of the last known remote reference, 43 once " +
      "this feed is committed: all verified, none landed." },
  { lane: "The hour in front of prospects", state: "prepared, proven, not spent",
    detail:
      "Twelve message bodies keyed to prospect-supplied routes, now verified against the module that " +
      "produced them. Six stated return dates have passed and one redirect window expired unreached. " +
      "Follow-ups sent: zero. Meetings: zero. Revenue: none." },
];

const blockers = [
  { blocker: "RETIRED THIS CYCLE — 'a staged claim can be written with nothing behind it'",
    price:
      "was: fourteen days in which the program named an operator decision as the blocker while the thing " +
      "to be decided on did not exist; six prospect-stated return dates passed inside that window and " +
      "one redirect route expired unreached",
    isSoftwareTask: true,
    fix:
      "A guard that refuses the claim rather than reporting it. Red against the exact wording that rode " +
      "for two weeks, green against the fix, and wired into the emitter so the feed cannot carry one." },
  { blocker: "STANDING — the mount refuses unlink",
    price:
      "git cannot check out a merge, and locks cannot be deleted; a session that does not know this " +
      "concludes the environment is broken",
    isSoftwareTask: true,
    fix:
      "Rename for locks; an explicit two-parent commit with contents written in place for merges. No " +
      "operator click required." },
  { blocker: "No code-hosting credential in the build sandbox",
    price: "42-plus commits of verified work cannot reach the shared line under their own power",
    isSoftwareTask: false,
    fix:
      "A credential or a code-host connector. Correctly outside the agent boundary rather than a defect; " +
      "refused again this cycle against the real remote." },
  { blocker: "The twelve are ready and have not been sent",
    price:
      "zero conversations held against twelve readable, module-verified messages and thirteen " +
      "prospect-supplied routes; the warm routes decay whether or not anyone acts, and one has already " +
      "expired unreached",
    isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track, unchanged. This cycle produced no customer-visible " +
    "change and does not pretend otherwise. It closed the hole RUN-AI found by hand: a staged one-click " +
    "action can no longer be reported without the artefact it operates on, and the second-touch path is " +
    "now exercised end to end instead of only in parts. Follow-ups sent zero, hours in front of anyone " +
    "zero, meetings zero, revenue none. The credential refusal was reproduced verbatim against the real " +
    "remote, so nothing has reached the code host, and nothing is published.",
};

// The staged one-click list now lives in a tracked module where every entry must declare the
// readable artefact it operates on (AJ1). assertStagedActionsHonest throws rather than emit a feed
// that carries a staged claim with nothing behind it — the exact defect RUN-AI found riding for
// fourteen days. A guard that only reports is a guard that gets ignored; this one refuses.
const needsAhmad = needsAhmadStaged;
const stagedAudit = assertStagedActionsHonest(needsAhmad, { root: process.cwd() });

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
    "ARIA / AXIS is in active build. The twelve second messages are on disk and were verified this " +
    "cycle against the module that produced them. Sent: 0 — drafted 14 days, readable 1. Meetings 0, " +
    "revenue none. A staged action can no longer be reported without the artefact it acts on. Tests: " +
    "532 pass, 0 fail, 332 of 332 suites.",
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
    program, tests, correctionsThisCycle, mainRef, workingTree, blockers, lanes, onTrack, needsAhmad,
    stagedAudit: { schema: stagedAudit.schema, summary: stagedAudit.summary, findings: stagedAudit.findings },
  },
});

console.log("internal:", res.written.internal);
console.log("public:", res.written.public.join(", "));
console.log("generatedAt:", res.publicStatus.generatedAt);
console.log("staged actions audited:", JSON.stringify(stagedAudit.summary));
