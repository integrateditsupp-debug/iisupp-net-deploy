// emit-axis-status-run-140.mjs — RUN 140: regenerate the AXIS status feed from REAL sources.
//
// Standing obligation on every flywheel cycle: `generatedAt` is now, every number below comes from a
// record or a first-hand check made THIS cycle, and nothing is carried forward unexamined.
// Run:  node scripts/emit-axis-status-run-140.mjs
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";

const now = new Date().toISOString();

// ── Re-run first-hand this cycle (node v22.22.3), not carried forward ─────────────────────────────
const tests = {
  newThisCycle: { suite: "vision-handoff", passed: 29, failed: 0 },
  newThisCycleNote:
    "Not written this cycle — written by CC on cc/stage-2-vision-handoff-2026-07-29 and VERIFIED this " +
    "cycle by Cowork, which is the review CC was explicitly blocked on. Run from a clean clone of the " +
    "branch tip, not from the working tree.",
  reRunGreenThisCycle: [
    { suite: "vision:test (full 10-suite vision gate, exit 0)", passed: "green", failed: 0 },
    { suite: "vision-handoff", passed: 29, failed: 0 },
    { suite: "forums-mvp", passed: "green", failed: 0 },
    { suite: "forums-commons", passed: "green", failed: 0 },
    { suite: "concierge-service", passed: "green", failed: 0 },
    { suite: "forums-moderation", passed: "green", failed: 0 },
    { suite: "support-faq", passed: "green", failed: 0 },
  ],
  fullRegistry:
    "NOT run to completion this cycle and NOT claimed as a clean pass. Same sandbox-only exclusions as " +
    "RUN-U through RUN-AC. `deploy-safety-denylist` additionally cannot run against the reviewed branch " +
    "because it needs a real `.git` and the branch is not checked out in the mount — disclosed, not " +
    "silently skipped.",
  registryEntries: 315,
};

const program = {
  series: "CLIENT-READY",
  sequence: "STAGE-2 VISION (parallel lane) — REVIEW",
  sequenceTitle: "The honest abstain now actually reaches a human",
  sequenceState:
    "CC built it and asked Cowork to clear it before any merge. Cowork cleared it this cycle. Clearing " +
    "is Cowork's job and is not a hold; landing it is still gated on a code-host credential this sandbox " +
    "does not have.",
  tasksBuilt: 3,
  tasksTotal: 3,
  tasksMerged: 0,
  pct: 0,
  exitCriteriaMet: true,
  sequencesCompleted: 29,
  sequencesBuilt: 29,
  sequencesLanded: 0,
  note:
    "This cycle did not write a product module and did not auto-release a new sequence — RUN-AB's finding " +
    "that further software cannot move the two off-track numbers still stands. It spent itself on the one " +
    "piece of real work that was genuinely unblocked and genuinely waiting: the Stage-2 handoff branch had " +
    "been sitting READY FOR REVIEW with a written request for Cowork's clearance. Reviewing it is Cowork's " +
    "job under R15, so it got reviewed rather than left to sit for a twelfth cycle.",
};

// Rule 14: what this cycle checked itself on rather than trusting the previous entry.
const correctionsThisCycle = [
  {
    what: "A code-hosting MCP was searched for AGAIN this cycle and again does not exist.",
    detail:
      "The session advertises a connecting `github` server, which is the single highest-leverage unblock " +
      "on the needs-Ahmad list, so it was searched rather than assumed absent. The search returned no " +
      "repository, branch, commit or push tool. The credential gap is unchanged and is not narrowing.",
  },
  {
    what: "Both sandbox limits were reproduced first-hand, not carried forward.",
    detail:
      "`git ls-remote origin main` returned `could not read Username for 'https://github.com'`. Creating a " +
      "file inside the mounted `.git` succeeds but removing it fails with `Operation not permitted`. This " +
      "is why no merge is attempted in the mount: a git merge takes `.git/index.lock` and must then " +
      "unlink it, and an unlink that cannot fail-safe would leave a stale lock in Ahmad's live repository.",
  },
  {
    what: "The write-probe file could not be cleaned up, and that is disclosed rather than omitted.",
    detail:
      "`.git/_cowork_write_probe_139` was created by the permissions probe and cannot be unlinked. It was " +
      "truncated to 0 bytes. Git ignores unknown files in `.git/`, so it is inert and affects no operation, " +
      "but it is a file this cycle left behind and saying nothing about it would be a Rule-14 failure. " +
      "It can be removed from Windows at any time.",
  },
  {
    what: "The live click-through CC asked for was NOT performed, and the clearance says so.",
    detail:
      "CC's review request named two browser behaviours. Both are covered by executed assertions " +
      "(prefilled composer, and a ticket reference that must come from the endpoint), and the static " +
      "review confirmed the mechanism, but assertions are not a browser. The clearance is recorded as " +
      "code-and-suite verified, with the click-through named as outstanding.",
  },
];

const costOfDelay = {
  costIndex: 29,
  unlandedSequences: 29,
  warmWindowsClosed: 1,
  daysSinceMailLeft: 1,
  warmWindowsReachableNow: 8,
  note:
    "Held at 29 for the second cycle. The unlanded count rose 28 → 29 because a twenty-ninth verified " +
    "sequence now exists, but days-since-mail is unchanged at 1 and no window closed, so the index itself " +
    "is not advanced on the strength of our own output. A cost index that rises because we built more is " +
    "measuring us, not the delay.",
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
  { lane: "Stage-2 vision handoff (CC parallel lane)", state: "REVIEWED AND CLEARED by Cowork", merged: false,
    note: "Tip 9c41d663 on parent 7df3716f — both match CC's claim exactly. Full 10-suite vision gate exit 0. vision-handoff 29/29. Five named regression suites re-run green. Server lib has no fetch, no URL, no mail transport. No ticket is claimed without an id returned by the endpoint. The draft never enters the URL. Cleared for merge; landing still needs a credential." },
  { lane: "landing the built work", state: "one click, unrun", merged: false,
    note: "AHMAD-LAND-EVERYTHING.cmd — twelve steps in dependency order, stops at the first failure. Unchanged this cycle and still unrun." },
  { lane: "operator command centre v2", state: "merge verified green, unpushed", merged: "local",
    note: "The 14-commit axis-command-center-v2 line merges into the shared-line tip with zero conflicts. Verified in an earlier cycle's clean-room clone; not re-verified this cycle and not re-claimed as if it were." },
  { lane: "outreach truth + operator hour", state: "built and green", merged: false,
    note: "RUN-U through RUN-AB. Verified in the working tree; none has reached the shared line." },
  { lane: "AXIS command centre + voice", state: "on the shared line", merged: true,
    note: "Push-to-talk dock and the spoken status answer are on the shared line — the source carries 8 speech-API references at commit 4ee1b883. Re-verified first-hand this cycle. Fifth cycle with the same finding." },
  { lane: "AXIS status feed", state: "regenerated this cycle", merged: false,
    note: "Emitted through the single emitter. Public mirror headline-only and leak-scanned." },
];

const mainRef = {
  value: "unconfirmed",
  why:
    "The code host refused authentication from this sandbox again this cycle — reproduced first-hand, not " +
    "carried forward. The locally cached pointer reads 40fa4aa4; a cache is not a confirmation and is not " +
    "reported as one.",
};

const needsAhmad = [
  { item: "Spend the hour",
    what: "senior-director-state/outbound/BACK-IN-2026-07-29.md — 8 ordered actions with message bodies attached, executable cold. Two prospect-stated return dates have already passed and one window closed unused on 2026-07-28.",
    why: "0 of 7 open items move without it. Nothing else on this list changes a business number." },
  { item: "Land everything — ONE click",
    what: "_staged-cc-runs/AHMAD-LAND-EVERYTHING.cmd. Twenty-eight sequences plus the verified command-centre merge, with every sub-script's own guards intact.",
    why: "It was eleven scripts in a required order for eleven cycles and none of them ran. The price was the problem; the price is now one click." },
  { item: "Merge the cleared Stage-2 handoff",
    what: "_staged-cc-runs/stage-2-handoff-review-2026-07-29/AHMAD-MERGE-STAGE2-HANDOFF.cmd. Cowork's review is done — this is the merge it unblocks.",
    why: "CC asked for clearance before merge. Clearance is given. The branch is otherwise finished work sitting still." },
  { item: "A code-hosting credential for the build sandbox",
    what: "Without it, nothing this program builds can reach the shared line on its own, ever. Searched for an MCP alternative again this cycle; none exists.",
    why: "Single highest-leverage unblock. Authentication was refused again this cycle." },
  { item: "Publish the site",
    what: "One deliberate operator action in Netlify.",
    why: "Merging never deploys. This has always been, and stays, a separate human decision." },
];

const blockers = [
  { blocker: "The hour is prepared and has not been spent", price: "cost index 29, 8 windows open and unanswered, 1 already closed unused", isSoftwareTask: false },
  { blocker: "No code-hosting credential in the build sandbox", price: "29 verified sequences plus a verified merge, all unlanded", isSoftwareTask: false },
  { blocker: "No passive signal is measurable", price: "the site cannot produce a number, so no item can ever enter the second column from it", isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track. Build and tests are green. This cycle cleared a branch " +
    "that was waiting on Cowork, which is real progress on the review lane and zero progress on landing — " +
    "a cleared branch that cannot be pushed is still not on the shared line. Conversion is untouched and " +
    "stays untouched until an hour is spent.",
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
    "Meetings 0, revenue none. When ARIA cannot answer honestly, the handoff to a person is now built and " +
    "tested end to end. Nothing here moves without a person spending an hour.",
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
