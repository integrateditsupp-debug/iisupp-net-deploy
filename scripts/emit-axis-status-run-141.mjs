// emit-axis-status-run-141.mjs — RUN 141: regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made THIS cycle, and nothing is carried forward unexamined.
// Run:  node scripts/emit-axis-status-run-141.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Re-run first-hand this cycle (node v22.22.3), not carried forward ─────────────────────────────
const tests = {
  newThisCycle: { suite: "none — no product module was written this cycle", passed: 0, failed: 0 },
  newThisCycleNote:
    "This cycle wrote no new test because it wrote no new product module. RUN-AB's finding — that more " +
    "software cannot move the two off-track numbers — still stands, and manufacturing a sequence to have " +
    "something to report would be the exact failure that finding was written to catch.",
  reRunGreenThisCycle: [
    { suite: "b4-axis-chat", passed: 20, failed: 0 },
    { suite: "axis-status-emitter", passed: "6/6 groups", failed: 0 },
    { suite: "axis-voice-dock", passed: "6/6 groups", failed: 0 },
    { suite: "axis-auth", passed: 10, failed: 0 },
    { suite: "axis-snapshots", passed: 9, failed: 0 },
    { suite: "axis-command-center", passed: "green", failed: 0 },
  ],
  fullRegistry:
    "ARIA Sentinel `npm test` WAS started this cycle and produced 326 lines with no failing assertion " +
    "observed in any of them — but the runner did not print a completion summary before the process " +
    "ended, so this is NOT claimed as a clean full-registry pass. Every suite line that did print, " +
    "printed as passed. The six AXIS suites above were therefore re-run individually and are claimed on " +
    "their own exit codes, not on the registry's.",
  registryEntries: 315,
};

const program = {
  series: "CLIENT-READY",
  sequence: "RUN-AB (built) — flywheel maintenance cycle",
  sequenceTitle: "The one-click was missing the thing the last cycle cleared",
  sequenceState:
    "No new sequence was released. This cycle audited the artefact that every other cycle's output " +
    "depends on — the single script Ahmad is asked to click — and found it did not include the merge " +
    "the previous cycle had reviewed and cleared.",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 29,
  sequencesBuilt: 29,
  sequencesLanded: 0,
  note:
    "Thirty cycles of output all funnel through one artefact: AHMAD-LAND-EVERYTHING.cmd. This cycle " +
    "checked that artefact against the staging directory for the first time. All twelve referenced " +
    "sub-scripts exist. A thirteenth staged script — the Stage-2 handoff merge that RUN 140 reviewed and " +
    "cleared — was NOT referenced by the wrapper at all, so the one click would have landed everything " +
    "except the one thing the previous cycle's entire effort produced. It is now step 13.",
};

// Rule 14: what this cycle checked itself on rather than trusting the previous entry.
const correctionsThisCycle = [
  {
    what: "THE ONE-CLICK DID NOT INCLUDE THE MERGE THE PREVIOUS CYCLE CLEARED.",
    detail:
      "RUN 140 reviewed `cc/stage-2-vision-handoff-2026-07-29`, cleared it, and staged " +
      "`AHMAD-MERGE-STAGE2-HANDOFF.cmd`. It then listed that script on the needs-Ahmad list as a " +
      "SEPARATE click, while also telling Ahmad that AHMAD-LAND-EVERYTHING.cmd was 'one click instead of " +
      "eleven'. Both statements were true and together they were misleading: the wrapper enumerates its " +
      "steps by hand and nothing had added the new one. Found by auditing all twelve referenced paths " +
      "against the staging directory rather than trusting the wrapper's own header. Now thirteen steps.",
  },
  {
    what: "The AXIS voice + spoken-status work was re-verified as ALREADY on the shared line.",
    detail:
      "`aperture-learning.html` and `assets/aperture-learning.js` are byte-identical to origin/main — a " +
      "diff against origin/main for those two paths returns nothing — and both sides carry the same 8 " +
      "speech-API references. There was no voice branch to build or merge this cycle. Sixth cycle with " +
      "the same finding, re-checked rather than assumed.",
  },
  {
    what: "Both sandbox limits were reproduced first-hand again, not carried forward.",
    detail:
      "`git ls-remote origin main` and `git push --dry-run` both returned `could not read Username for " +
      "'https://github.com'`. Creating a file inside the mounted `.git` succeeds; removing it fails with " +
      "`Operation not permitted`. This is why no merge is attempted in the mount: a git merge takes " +
      "`.git/index.lock` and must then unlink it, and an unlink that cannot fail-safe would strand a lock " +
      "in Ahmad's live repository.",
  },
  {
    what: "This cycle left a file behind inside `.git` and is disclosing it rather than omitting it.",
    detail:
      "`.git/_probe_140` was created by the permissions probe and cannot be unlinked. It was truncated to " +
      "0 bytes. Git ignores unknown files in `.git/`, so it is inert and affects no operation — but it is " +
      "a file this cycle left behind, and the previous cycle left `.git/_cowork_write_probe_139` the same " +
      "way. Both are removable from Windows at any time. The probe should not be repeated a third time.",
  },
];

const costOfDelay = {
  costIndex: 29,
  unlandedSequences: 29,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 1,
  warmWindowsReachableNow: 8,
  note:
    "Held at 29 for the third consecutive cycle. Nothing left the mailbox, no window closed, and no new " +
    "verified sequence was added, so there is nothing to move it in either direction. An index that rose " +
    "because we audited a script would be measuring us, not the delay.",
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
    "No passive signal is measurable today. That is a refusal, not a zero — no record reachable without " +
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
    "cycle did not change that finding and does not claim to.",
};

const lanes = [
  { lane: "the one click itself", state: "AUDITED AND CORRECTED this cycle", merged: false,
    note: "All twelve referenced sub-scripts verified present on disk. A thirteenth staged, cleared script was missing from the wrapper entirely and has been added as step 13. The wrapper adds no authority and skips no sub-script guard; the dirty-tree refusal at the merge steps is unchanged and still deliberate." },
  { lane: "Stage-2 vision handoff (CC parallel lane)", state: "reviewed and cleared, now inside the one click", merged: false,
    note: "Cleared by RUN 140 at tip 9c41d663. Previously a separate click that the wrapper did not know about; now step 13, still tip-pinned by its own script." },
  { lane: "landing the built work", state: "one click, unrun", merged: false,
    note: "AHMAD-LAND-EVERYTHING.cmd — now thirteen steps in dependency order, stops at the first failure, never deploys." },
  { lane: "operator command centre v2", state: "merge verified green, unpushed", merged: "local",
    note: "The 14-commit axis-command-center-v2 line merges into the shared-line tip with zero conflicts. Verified in an earlier cycle's clean-room clone; not re-verified this cycle and not re-claimed as if it were." },
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "RUN-U through RUN-AB. Verified in the working tree; none has reached the shared line." },
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Push-to-talk dock and the spoken status answer are on the shared line. Re-verified first-hand this cycle: the two source files are byte-identical to origin/main and axis-voice-dock is 6/6 green. Sixth cycle with the same finding." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single emitter. Public mirror headline-only and leak-scanned." },
];

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again this cycle — reproduced first-hand on " +
    "both `ls-remote` and a dry-run push, not carried forward. The locally cached pointer reads 40fa4aa4; " +
    "a cache is not a confirmation and is not reported as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "senior-director-state/outbound/BACK-IN-2026-07-29.md — 8 ordered actions with message bodies attached, executable cold. Two prospect-stated return dates have already passed and one window closed unused on 2026-07-28.",
    why: "0 of 7 open items move without it. Nothing else on this list changes a business number." },
  { item: "Land everything — ONE click, now thirteen steps",
    what: "_staged-cc-runs/AHMAD-LAND-EVERYTHING.cmd. Twenty-nine sequences, the command-centre merge, and — as of this cycle — the cleared Stage-2 handoff merge, with every sub-script's own guards intact.",
    why: "Until this cycle the wrapper silently omitted the Stage-2 merge, so the one click would have landed everything except the previous cycle's entire output. It no longer does." },
  { item: "A code-hosting credential for the build sandbox",
    what: "Without it, nothing this program builds can reach the shared line on its own, ever. Authentication was refused again this cycle on two separate git operations.",
    why: "Single highest-leverage unblock. It is the reason twenty-nine verified sequences sit off the shared line." },
  { item: "Publish the site",
    what: "One deliberate operator action in Netlify.",
    why: "Merging never deploys. This has always been, and stays, a separate human decision." },
];

const blockers = [
  { blocker: "The hour is prepared and has not been spent", price: "cost index 29, 8 windows open and unanswered, 1 already closed unused", isSoftwareTask: false },
  { blocker: "No code-hosting credential in the build sandbox", price: "29 verified sequences plus two verified merges, all unlanded", isSoftwareTask: false },
  { blocker: "No passive signal is measurable", price: "the site cannot produce a number, so no item can ever enter the second column from it", isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track. Build and tests are green — six AXIS suites re-run " +
    "individually this cycle on their own exit codes. This cycle repaired the artefact that all landing " +
    "depends on, which is real progress on the landing lane's correctness and zero progress on landing " +
    "itself: a correct script that has not been run has landed nothing. Conversion is untouched and stays " +
    "untouched until an hour is spent.",
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
    "1 personal reply declining. Delivery is unobserved, not a number. 12 follow-ups drafted, 0 sent. " +
    "Meetings 0, revenue none. Spoken status answers come from this feed. Nothing here moves without a " +
    "person spending an hour.",
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
