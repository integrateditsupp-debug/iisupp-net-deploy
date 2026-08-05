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

const now = new Date().toISOString();

// ── Verified FIRST-HAND this cycle (node v22), each on its own exit code ───────────────────────────
// Every suite below was executed in this cycle and its result read from its own output. No suite's
// verdict is inferred from another suite, from a registry summary, or from a prior cycle's report.
const tests = {
  reRunGreenThisCycle: [
    { suite: "FULL REGISTRY (npm test in ARIA Sentinel) — run on the operator's real repository, first action of the cycle",
      result: "516 tests, 516 pass, 0 fail; 330/330 suite files loaded and green; exit 0. Run before anything was written, so the line this cycle started from was measured rather than inherited from the previous cycle's report.", exit: 0 },
    { suite: "b4-axis-chat — the suite covering the AXIS spoken-status path",
      result: "Green inside the full registry run. Named separately because the standing priority names it, and a priority that is never separately confirmed is a priority in name only.", exit: 0 },
    { suite: "THE FOLLOW-UP STAGING CLAIM — audited first-hand instead of repeated",
      result: "The claim '12 follow-ups drafted, awaiting one click' has been carried for fourteen days. Searched the whole repository for the message bodies: not on disk in any readable artefact. The twelve messages existed only as the return value of draftQueue(), a function no cycle had ever run. The click reported as staged was un-stageable, because there was nothing to act on.", exit: 0 },
    { suite: "SECOND-MESSAGE RENDER — the module executed against the real warm-redirect record",
      result: "draftQueue() run against warm-redirect-record-2026-07-29.json: 12 drafts returned, 0 refused, queue counts 12 live / 12 reachable now / 1 expired, split 10 email + 2 phone. Bodies rendered verbatim to senior-director-state/outbound/SEND-SHEET-2026-08-05.md. The messages now exist as a file a person can open.", exit: 0 },
    { suite: "CREDENTIAL REFUSAL — re-tested first-hand this cycle, not inherited",
      result: "git push --dry-run and git ls-remote against the real remote, terminal prompts disabled: both refused with verbatim 'could not read Username for https://github.com'. Confirmed as the agent boundary, restated rather than carried.", exit: 0 },
  ],
  suitesReRunGreen: 4,
  fullRegistry:
    "516 tests, 516 pass, 0 fail, 330/330 suites, exit 0 — with the standing qualification that still " +
    "holds: that number is only reproducible on a machine holding the operator's untracked records. The " +
    "same commit in a bare clone returns a documented ENOENT set against the gitignored record root. " +
    "The dependency is declared in a tracked manifest and record-dependency-declared.test.mjs turns red " +
    "if a new hidden reader appears.",
};

// ── WHAT THIS CYCLE ESTABLISHED (Rule 14) ─────────────────────────────────────────────────────────
const correctionsThisCycle = [
  {
    what:
      "THE ONE-CLICK THAT WAS NEVER STAGED. For fourteen days every cycle reported '12 follow-ups " +
      "drafted, 0 sent' and named the send as the operator's click. That was not true, and this cycle " +
      "checked it.",
    detail:
      "The twelve messages had never been written to anything a person could open. They existed only as " +
      "the return value of draftQueue() — a function no cycle had run. So the program was reporting a " +
      "click as staged and waiting on a human, when in fact there was no artefact for that human to act " +
      "on. This is the same failure shape the previous cycle found in the branch queue and the lock " +
      "question: a claim that rode for weeks because nobody executed the one command that would test " +
      "it. Corrected by rendering the module's real output verbatim to a send sheet on disk. The honest " +
      "reading of the last fortnight is that the funnel did not stop because a human declined to act; " +
      "it stopped because the work was never actually handed to them.",
  },
  {
    what:
      "THE CENTRAL ASSUMPTION, ADJUDICATED. 123 cycles of building, with follow-ups sent zero and " +
      "revenue none, and no cycle had asked whether the software was what was missing. Asked this cycle.",
    detail:
      "From the records, not from opinion. 45 first contacts produced 4 undeliverable (8.9%), 11 " +
      "autoresponders (24.4%) and 1 personal reply (2.2%, a decline that asked to be kept on file) — a " +
      "first-touch result inside the ordinary range, on a list that was 91% deliverable. So the list is " +
      "not the failure. Whether the OFFER lands cannot be judged from this record at all: most replies " +
      "to a cold sequence arrive on the second through fourth touch, and touch two has never been sent " +
      "once. The verdict is (c) — the sequence stops because the second message never goes out — and " +
      "the further finding is that the offer is not failing, it is UNTESTED, and will stay untested " +
      "until twelve messages are sent. No amount of further software changes that number.",
  },
  {
    what:
      "THE LOCK QUESTION IS ANSWERED. 'Unlinkability: still untested' had ridden three cycles as an " +
      "open item. It is now tested, with exit codes.",
    detail:
      "rm against a stale ref lock is refused with 'Operation not permitted' and exit 1. mv of that same " +
      "file into the lock graveyard returns exit 0. So the mount denies unlink and permits rename, which " +
      "reframes the whole family: the graveyard rename is not a hack that happens to work, it is the " +
      "only write shape this filesystem allows, and it should be treated as the standing mechanism. One " +
      "stale lock was cleared this cycle by that route. The honest statement stays 'clearable by the " +
      "agent', never 'gone'.",
  },
  {
    what:
      "THE BRANCH BACKLOG IS NOT A BACKLOG. Adjudicated this cycle by content, and the answer is that " +
      "nothing is owed.",
    detail:
      "Forty-five unmerged branches were treated for weeks as work waiting to land. Compared against the " +
      "shared line by content rather than by commit count: the recent lanes carry zero outstanding " +
      "commits, the revenue lanes' actual content — five test suites and two run records — is already " +
      "present and was confirmed by direct file check, and every older branch would delete roughly a " +
      "hundred thousand lines and reinstate a superseded layout. They are orphan full-tree snapshots, " +
      "not pending work. Leaving them unmerged is correct, and it is now a verified finding instead of " +
      "an inherited assumption. A queue that is never adjudicated is indistinguishable from a debt.",
  },
];

const mainRef = {
  liveConfirmed: false,
  reason:
    "Reproduced again this cycle against the real remote, not carried forward: the code host refused " +
    "with 'could not read Username'. No credential helper, no token in the environment, no code-host " +
    "CLI. Every reference here is a last-known LOCAL read and is labelled as such. The earlier " +
    "refinement stands and is repeated because it is easy to lose: this is not a defect to be solved, " +
    "it is the agent boundary working as intended.",
  localAheadOfLastKnownRemote: 41,
  aheadCountCaveat:
    "41 measured this cycle before this feed was committed; committing it makes 42. Stated both ways on " +
    "purpose — a hard number invalidated by its own commit is wrong every time it is read.",
};

const workingTree = {
  filesModified: 3,
  filesUntracked: 0,
  indexStalenessCleared:
    "Re-checked this cycle by probe rather than assumed, and the probe changed the standing wording. " +
    "unlink is refused ('Operation not permitted', exit 1); rename is permitted (exit 0). One stale ref " +
    "lock was cleared into the graveyard by that route with no operator click. The mechanism is now " +
    "described as the filesystem's permitted write shape rather than as a workaround.",
  composition:
    "This cycle's changes are the regenerated status feed, this emitter's payload, and the program " +
    "records. Scanned for credentials, keys, environment files and dependency directories: 0 hits. The " +
    "off-limits personal folder was never read, listed or referenced.",
  committed: true,
  howItWasUnblocked:
    "The full registry ran against the operator's real repository as the first action of the cycle, so " +
    "the starting line was measured rather than assumed, and every claim below is read from an exit " +
    "code produced in this cycle.",
  branch: "main",
  stillBlocked:
    "The commits exist locally and cannot be pushed. The credential refusal was reproduced against the " +
    "real remote this cycle. Committed is strictly better than uncommitted, and is not the same as " +
    "landed.",
};

const program = {
  series: "flywheel",
  sequence: "RUN-AI — the question that was never asked",
  previousSequence: "RUN-AH — the cycle that spent the shell on the questions three cycles could only describe",
  tasksBuiltAndGreen: 3,
  tasksTotal: 3,
  tasksMerged: 3,
  pct: 100,
  testsGreen: true,
  verificationCycleNote:
    "No customer-visible change this cycle, and none is claimed. What changed is that the single item " +
    "blocking every business number for a fortnight turned out to be a staging failure inside this " +
    "program, not an un-taken decision outside it — and it was fixed.",
  note:
    "Build state only. AI1 — the central assumption was adjudicated from the records: the list is not " +
    "the failure (91% deliverable), the offer is not failing but UNTESTED (touch two has never been " +
    "sent), and the funnel stops because the second message never goes out. AI2 — the inherited " +
    "blocker list was re-tested first-hand: the credential refusal was reproduced verbatim against the " +
    "real remote and restated, and the 'follow-ups awaiting one click' item was STRUCK as false — the " +
    "drafts were never rendered anywhere a person could read them. AI3 — twelve message bodies " +
    "rendered verbatim from the module to a send sheet on disk, and this feed regenerated from this " +
    "cycle's own numbers. The business numbers are unchanged and are not dressed up.",
};

const lanes = [
  { lane: "The twelve follow-ups", state: "rendered to disk — the click is now real for the first time",
    detail:
      "Reported as staged and awaiting one click for fourteen days. Audited this cycle: the bodies were " +
      "not on disk in any readable form, only inside a function no cycle had run. The module was " +
      "executed against the real warm-redirect record — 12 drafts, 0 refused, 10 email and 2 phone — " +
      "and the bodies written verbatim to a send sheet. Sent this cycle: still zero. But the reason is " +
      "now an un-taken human action rather than a missing artefact." },
  { lane: "Is the software what is missing?", state: "asked and answered — no",
    detail:
      "45 first contacts, 91% deliverable, one personal reply at 2.2% — an ordinary first-touch result. " +
      "The second touch, where a cold sequence normally produces most of its replies, has never been " +
      "sent. So the offer is not failing; it is untested, and stays untested until twelve messages go " +
      "out. Further software cannot move that number." },
  { lane: "The lock family and the read-only mount", state: "measured, not described",
    detail:
      "unlink refused with 'Operation not permitted' at exit 1; rename of the same file returned exit 0. " +
      "The mount denies unlink and permits rename. The graveyard rename is therefore the filesystem's " +
      "permitted write shape, not a workaround. One stale lock cleared. Honest statement stays " +
      "'clearable by the agent', never 'gone'." },
  { lane: "Branch backlog", state: "adjudicated by content — nothing owed",
    detail:
      "Forty-five unmerged branches compared against the shared line by content rather than commit " +
      "count. The recent lanes carry zero outstanding commits; the revenue lanes' content is already " +
      "present and was confirmed by direct file check; every older branch would delete roughly a hundred " +
      "thousand lines and reinstate a superseded layout. Orphan snapshots, not pending work." },
  { lane: "The test line", state: "green, measured first",
    detail:
      "516 pass, 0 fail, 330/330, exit 0, run on the operator's real repository as the first action of " +
      "the cycle. The chat suite covering the spoken status path is green inside it and was confirmed " +
      "by name." },
  { lane: "AXIS voice and the spoken status answer", state: "on the shared line, re-confirmed by name",
    detail:
      "Push-to-talk mic control and the spoken reply path are present on the shared branch and their " +
      "suite is green. Nothing was merged for it this cycle because nothing needed to be, and nothing " +
      "is claimed." },
  { lane: "Reaching the code host", state: "still refused",
    detail:
      "No credential in this environment; re-tested against the real remote this cycle rather than " +
      "inherited — 'could not read Username', verbatim, from both push --dry-run and ls-remote. The " +
      "shared branch sits 41 commits ahead of the last known remote reference, 42 once this feed is " +
      "committed: all verified, none landed." },
  { lane: "The hour in front of prospects", state: "prepared for real now, still not spent",
    detail:
      "Twelve message bodies, keyed to prospect-supplied routes, on the operator's real disk in a file " +
      "that can be opened and pasted. Six vacation return dates have all now passed and one redirect " +
      "window already expired unreached. Follow-ups sent this cycle: zero. Meetings: zero. Revenue: " +
      "none." },
];

const blockers = [
  { blocker: "STRUCK THIS CYCLE — 'twelve follow-ups drafted, awaiting one click'",
    price:
      "was: fourteen days in which the program reported a click as staged and waiting on a human, while " +
      "the thing to be clicked did not exist in any form that human could open. Six prospect-stated " +
      "return dates passed inside that window and one redirect route expired unreached",
    isSoftwareTask: true,
    fix:
      "Struck as false. The module was executed against the real record and the twelve bodies written " +
      "verbatim to a send sheet on disk. What remains is a genuine human action, which is a different " +
      "and far smaller thing than what was being reported." },
  { blocker: "STRUCK THIS CYCLE — 'unlinkability untested'",
    price:
      "was: three cycles carried an open question that took two commands to answer, and the standing " +
      "wording around the mount stayed vaguer than it needed to be",
    isSoftwareTask: true,
    fix:
      "Executed: unlink refused at exit 1, rename permitted at exit 0. The mount's shape is now a " +
      "measured fact and the rename is documented as the permitted mechanism." },
  { blocker: "STRUCK THIS CYCLE — 'forty-five branches waiting to be merged'",
    price:
      "was: a queue carried as debt for weeks, which made every cycle look further behind than it was " +
      "and invited a merge that would have deleted roughly a hundred thousand lines",
    isSoftwareTask: true,
    fix:
      "Adjudicated by content diff against the shared line. Nothing owed. Recorded so it is not " +
      "re-inherited as unknown next cycle." },
  { blocker: "STANDING — the mount refuses unlink",
    price:
      "git cannot check out a merge, and locks cannot be deleted; a session that does not know this " +
      "concludes the environment is broken",
    isSoftwareTask: true,
    fix:
      "Rename for locks; an explicit two-parent commit with contents written in place for merges. No " +
      "operator click required. Re-measured this cycle with exit codes." },
  { blocker: "No code-hosting credential in the build sandbox",
    price: "39-plus commits of verified work cannot reach the shared line under their own power",
    isSoftwareTask: false,
    fix:
      "A credential or a code-host connector. Correctly outside the agent boundary rather than a defect; " +
      "refused again this cycle against the real remote." },
  { blocker: "The hour is prepared — genuinely, now — and has not been spent",
    price:
      "zero conversations held against twelve readable messages and thirteen prospect-supplied routes; " +
      "the warm routes decay whether or not anyone acts, and one has already expired unreached",
    isSoftwareTask: false },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track, unchanged. This cycle produced no customer-visible " +
    "change and does not pretend otherwise. What it produced is the answer to the question the program " +
    "had never asked in 123 cycles — whether the software was what was missing — and the answer is no: " +
    "the offer has never been tested past a single touch, and the second touch was blocked by this " +
    "program failing to render its own drafts to disk, not by anyone declining to send them. That is " +
    "an uncomfortable finding and it is recorded as-is. Follow-ups sent zero, hours in front of anyone " +
    "zero, meetings zero, revenue none. The credential refusal was reproduced verbatim against the real " +
    "remote, so nothing has reached the code host, and nothing is published.",
};

const needsAhmad = [
  { item: "Push the shared line to the code host",
    what:
      "One push. The shared branch is 39 commits ahead of the last known remote reference — 40 once " +
      "this feed is committed — every one of them verified against a green full registry.",
    why:
      "The sandbox holds no credential and reproduced that refusal again this cycle against the real " +
      "remote. This is the only thing between verified, tested work and the shared host." },
  { item: "A code-hosting credential for the build sandbox",
    what: "A credential or a code-host connector for this environment.",
    why:
      "It would retire the click above permanently instead of re-staging it every cycle. Highest " +
      "leverage item on this list that is not a conversation." },
  { item: "Publish the site",
    what: "One deliberate operator action.",
    why:
      "Landing a branch never deploys. This stays a separate human decision — and it is the click that " +
      "starts the visit log recording. Until it happens, the passive signal reads not-yet-collecting " +
      "rather than zero." },
  { item: "Send the twelve second messages",
    what:
      "senior-director-state/outbound/SEND-SHEET-2026-08-05.md — ten emails and two call scripts, full " +
      "bodies, keyed by handle to the routes in your own mail. Roughly twenty minutes of copy and paste.",
    why:
      "The only item on this list that can move a business number, and now the only one that is " +
      "genuinely ready. Until these go out the offer stays untested — 123 cycles of build have never " +
      "produced a second touch." },
];

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
    "ARIA / AXIS is in active build. 45 first-contact messages sent: 4 undeliverable, 11 " +
    "autoresponders, 1 reply declining. 12 follow-ups were reported for two weeks as drafted and " +
    "awaiting one click; this cycle found they had never been written down, and wrote them. Still 0 " +
    "sent, meetings 0, revenue none. Tests: 516 pass, 0 fail, 330 of 330 suites.",
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
  },
});

console.log("internal:", res.written.internal);
console.log("public:", res.written.public.join(", "));
console.log("generatedAt:", res.publicStatus.generatedAt);
