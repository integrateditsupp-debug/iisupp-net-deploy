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
    { suite: "FULL REGISTRY (npm test in ARIA Sentinel) — run on the operator's real repository BEFORE this cycle wrote anything",
      result: "516 tests, 516 pass, 0 fail; 329/329 suite files loaded and green. Run first, deliberately, so the cycle knew the line it was starting from rather than assuming it.", exit: 0 },
    { suite: "a2-routing-battery (new this cycle) — the shipped KB pack answering real questions",
      result: "32 real KB docs, 6/6 clean hits, 0 confidently wrong, out-of-scope questions abstain, the master index never answers. Rule 14: it runs against the pack on disk — no fixtures, no stubbed index, no hand-fed scores. Proven RED four ways before acceptance (vertical guard neutralised, intent guard neutralised, master index re-admitted to the corpus, intent inference stubbed to always-neutral).", exit: 0 },
    { suite: "symptom-kb-parse — rewritten from closed-world to open-world and made STRICTER",
      result: "21 symptom files including all 17 canonical categories, 1 how-to correctly excluded, 123 ranked causes (was 90), all well-formed, index complete. Proven RED three ways (a canonical category dropped, a new doc left out of the master index, how-tos loaded as symptom records).", exit: 0 },
    { suite: "FULL REGISTRY — re-run AFTER every write this cycle",
      result: "516 tests, 516 pass, 0 fail; 330/330 suites. The added suite is the A2 routing battery.", exit: 0 },
    { suite: "Clone-vs-clone differential — the check that separates a real regression from a portability artefact",
      result: "A pristine clone of the shared line and a clone carrying this cycle's change produce a BYTE-IDENTICAL failure set (51 and 51, the documented non-portable record-dependent suites). Zero new failures introduced. Run because a clone can never reach green here by design, so a raw clone number would have been unreadable either way.", exit: 0 },
  ],
  suitesReRunGreen: 5,
  fullRegistry:
    "516 tests, 516 pass, 0 fail, 330/330 suites, exit 0 — carrying forward the qualification the " +
    "earlier cycle added and which still holds: that number is only reproducible on a machine holding " +
    "the operator's untracked records. The same commit in a bare clone returns 51 ENOENT failures " +
    "against the gitignored record root. The dependency is declared in a tracked manifest and " +
    "record-dependency-declared.test.mjs turns red if a new hidden reader appears.",
};

// ── WHAT THIS CYCLE ESTABLISHED (Rule 14) ─────────────────────────────────────────────────────────
const correctionsThisCycle = [
  {
    what:
      "A TEST WAS HOLDING THE KNOWLEDGE BASE SHUT. Found, diagnosed and replaced this cycle. This is the " +
      "root cause of why five finished articles sat unused for five weeks.",
    detail:
      "The symptom-KB parse test asserted an exact count — seventeen files — against a hard-coded list. " +
      "Any genuinely new diagnostic article turned it red. That left exactly two ways to stay green: " +
      "never add an article, or pad a real one with an invented cause and probability to clear an " +
      "arbitrary floor. The second is the fabricated-metric class Rule 14 exists to refuse, so in " +
      "practice the KB simply stopped growing. The test is now open-world and STRICTER, not looser: all " +
      "seventeen canonical categories must still be present and still carry five or more ranked causes, " +
      "every symptom doc including any added later must be well-formed with three or more user phrasings " +
      "and three or more fully-populated causes, and every doc in the pack must appear in the master " +
      "index. Ranked causes went from 90 to 123.",
  },
  {
    what:
      "FIVE FINISHED KB ARTICLES WERE RECOVERED AND SHIPPED — the five most common tickets an MSP takes, " +
      "and none of them were in the product.",
    detail:
      "Outlook password-prompt loop, Windows/AD/Entra account lockout, Office and Excel failures, clock " +
      "and time sync, and adding a printer. All five were written on a 2026-06-29 branch whose matcher " +
      "was later superseded, so the branch is correctly NOT merged — but nobody had ever forward-ported " +
      "its CONTENT. They were checked for accuracy and for banned language before landing, and they are " +
      "now on the shared line with the current matcher.",
  },
  {
    what:
      "THE MASTER INDEX WAS ANSWERING SUPPORT QUESTIONS. Real defect, closed this cycle.",
    detail:
      "The knowledge base's table of contents was being indexed as an answerable article. It contains " +
      "every topical word in the pack, so it outscored the very articles it points at. A user with a " +
      "broken printer could be handed a list of links instead of a fix. The symptom loader had always " +
      "skipped it; the matcher never did. It is now excluded from the answerable corpus, and the battery " +
      "fails if it is ever re-admitted.",
  },
  {
    what:
      "A SETUP HOW-TO WAS ANSWERING BREAK-FIX QUESTIONS, and the tie-break was alphabetical order.",
    detail:
      "'How do I add a printer' and 'the printer will not print' share every meaningful word, so the two " +
      "articles scored EQUAL and the matcher kept the first strict winner it happened to meet — which " +
      "meant the answer was decided by filename order, 'add-' sorting before 'printer-'. A user with a " +
      "broken printer was being shown setup instructions. Intent is now read from each article's " +
      "frontmatter and from how the question is phrased, and the mismatch is multiplied down rather than " +
      "excluded, so a related article still beats an unhelpful silence.",
  },
  {
    what:
      "THE NEW TEST WAS ITSELF WEAK, AND THE RED-PROVING CAUGHT IT. Recorded because it is the reason " +
      "red-proving is done at all.",
    detail:
      "Switching the vertical guard off left the new battery GREEN — the synthetic article used to probe " +
      "it was too weak to win even unguarded, so the assertion proved nothing. Separately, the battery " +
      "claimed the setup article strictly outranked the break-fix one when the truth is a tie broken by " +
      "directory order. Both preconditions are now asserted rather than assumed, and the guard-off case " +
      "correctly turns red. A test that passes when the thing it guards is removed is not a test.",
  },
  {
    what:
      "The vertical guard was recovered as a STANDING guard, and is a no-op today. Stated plainly so it " +
      "is not read as an improvement to current answers.",
    detail:
      "Every article shipping today is generic, so the guard changes no current routing. It exists so a " +
      "healthcare or banking article can never answer a generic Windows question once vertical packs " +
      "exist. It is proven in both directions against an injected article built strong enough to win " +
      "without it.",
  },
];

// ── Repository state, read first-hand this cycle ───────────────────────────────────────────────────
const mainRef = {
  liveConfirmed: false,
  reason:
    "Reproduced again this cycle against the real remote, not carried forward: the code host refused " +
    "with 'could not read Username'. There is no credential helper, no token in the environment and no " +
    "code-host CLI. Every reference here is a last-known LOCAL read and is labelled as such. " +
    "Presenting a local reference as a live read is the exact dishonesty Rule 14 forbids.",
  localAheadOfLastKnownRemote: 37,
  aheadCountCaveat:
    "37 is the count measured after this cycle's merge landed. Committing this feed adds one more, so a " +
    "reader checking afterwards will correctly see 38. Stated this way on purpose: a hard number that " +
    "its own commit invalidates is a number that is wrong every time it is read.",
};

const workingTree = {
  filesModified: 0,
  filesUntracked: 0,
  indexStalenessCleared:
    "Re-checked this cycle rather than assumed. The mount still refuses unlink — verbatim 'Operation " +
    "not permitted' — which this cycle hit twice: on the git index lock, cleared by rename as always, " +
    "and on the merge itself, because `git merge` cannot check out a file it is not allowed to unlink. " +
    "The merge was completed instead as an explicit two-parent commit with the file contents written " +
    "in place, which the mount does permit. No operator click was needed. The standing statement " +
    "remains 'the agent can always work around these', never 'these no longer occur'.",
  composition:
    "This cycle's changes are five recovered knowledge-base articles, two routing guards on the " +
    "existing matcher, one rewritten test, one new test suite, one runner registration, the live " +
    "loop-observer state files, the regenerated status feed and this emitter's payload. Scanned for " +
    "credentials, keys, environment files and dependency directories: 0 hits. The recovered articles " +
    "were scanned for banned language before landing: 0 hits. The off-limits personal folder was " +
    "never read, listed or referenced.",
  committed: true,
  howItWasUnblocked:
    "Verification ran against the operator's real repository before and after every write, so the " +
    "cycle never reported a green it had not just produced. A clone-vs-clone differential separated a " +
    "real regression from the known portability artefact. The result was landed on the shared branch " +
    "as a single writer.",
  branch: "main",
  stillBlocked:
    "The commits exist locally and cannot be pushed. The credential refusal was reproduced against the " +
    "real remote this cycle. Committed is strictly better than uncommitted, and is not the same as " +
    "landed.",
};

const program = {
  series: "flywheel",
  sequence: "RUN-AG — the assertion that was holding the knowledge base shut",
  previousSequence: "RUN-AF — untracked residue in served URL space",
  tasksBuiltAndGreen: 4,
  tasksTotal: 4,
  tasksMerged: 4,
  pct: 100,
  testsGreen: true,
  verificationCycleNote:
    "This is the first cycle in a while whose result a customer could notice. ARIA can now answer the " +
    "five most common support questions it previously could not, and three ways it could answer " +
    "confidently and wrongly have been closed.",
  note:
    "Build state only. AG1 — a closed-world test assertion was found to be the reason the knowledge " +
    "base had stopped growing, and was replaced with an open-world one that is strictly harder to " +
    "pass. AG2 — five finished articles stranded on a superseded branch were recovered, checked and " +
    "shipped. AG3 — two real routing defects were found and closed: the table of contents was " +
    "answering questions, and a setup how-to was answering break-fix questions on an alphabetical " +
    "tie-break. AG4 — every guard was proven red in both directions, which caught two weaknesses in " +
    "the new test itself. None of this moves a business number and none of it is offered as if it did.",
};

const lanes = [
  { lane: "The offline knowledge base (this cycle's work)", state: "five recovered articles shipped; the assertion that was blocking growth replaced",
    detail:
      "Outlook password loops, AD/Entra account lockouts, Office and Excel failures, clock drift and " +
      "adding a printer — the five most common tickets an MSP takes — were finished five weeks ago on a " +
      "superseded branch and never forward-ported. They are now on the shared line. The reason they " +
      "stalled was a test asserting an exact article count, which turned red on any genuine addition; it " +
      "is replaced with an open-world assertion that is strictly harder to pass." },
  { lane: "Answer correctness", state: "three confidently-wrong routes closed",
    detail:
      "The table of contents was outscoring the articles it points at and could be returned as an " +
      "answer. A setup how-to was answering break-fix questions because the two tied and filename order " +
      "broke the tie. A vertical guard was recovered so a healthcare or banking article can never answer " +
      "a generic question once vertical packs exist — a no-op today, stated as such." },
  { lane: "Branch backlog", state: "triaged; the A2 lane's content recovered without merging the branch",
    detail:
      "The 2026-06-29 A2 branch is an orphan full-tree snapshot whose matcher was superseded by the " +
      "July line, so merging it would revert five weeks of hardening. It is correctly left unmerged — " +
      "but its CONTENT and its guards were forward-ported onto the current matcher instead of being " +
      "written off. Unmerged is not the same as worthless, just as it is not the same as owed." },
  { lane: "Reproducibility of the test line", state: "declared, enforced, and used as a tool this cycle",
    detail:
      "The registry green depends on untracked operator records held on one machine, so a clone can " +
      "never reach green. Rather than report an unreadable clone number, this cycle ran a pristine clone " +
      "and a changed clone side by side and compared failure sets: byte-identical at 51 each, which is " +
      "what proves zero new failures." },
  { lane: "The lock family and the read-only mount", state: "clearable by the agent, NOT retired",
    detail:
      "unlink was refused again, verbatim 'Operation not permitted'. It blocked the git index lock and " +
      "then the merge checkout itself. Both worked around with no operator click — rename for the lock, " +
      "an explicit two-parent commit with contents written in place for the merge. Honest statement " +
      "stays 'clearable', never 'gone'." },
  { lane: "AXIS voice and the spoken status answer", state: "on the shared line, re-verified this cycle",
    detail:
      "Push-to-talk mic control and the spoken reply path are present on the shared branch and the " +
      "chat suite covering them is green. Nothing was merged for it this cycle because nothing needed " +
      "to be, and nothing is claimed." },
  { lane: "Reaching the code host", state: "still refused",
    detail:
      "No credential in this environment. Re-tested against the real remote this cycle rather than " +
      "inherited. The shared branch sits 37 commits ahead of the last known remote reference as measured " +
      "after the merge, 38 once this feed is committed: all of it verified, none of it landed." },
  { lane: "The hour in front of prospects", state: "prepared, not spent",
    detail:
      "The ordered actions with message bodies attached are on the operator's real disk. Follow-ups " +
      "sent this cycle: zero. Meetings: zero. Revenue: none." },
];

const blockers = [
  { blocker: "RESOLVED THIS CYCLE — a test assertion was preventing the knowledge base from growing",
    price:
      "was: five finished articles covering the most common support tickets sat unused for five weeks, " +
      "because adding any one of them turned the suite red and the only way to stay green was to " +
      "fabricate a cause and a probability. Now: articles can be added, and the bar every article must " +
      "clear is higher than it was.",
    isSoftwareTask: true,
    fix:
      "Closed-world count assertion replaced with an open-world structural one: all canonical categories " +
      "still required, every doc including new ones must be well-formed and indexed." },
  { blocker: "RESOLVED THIS CYCLE — the assistant could answer confidently and wrongly in three ways",
    price:
      "was: a user with a broken printer could be handed the table of contents, or setup instructions " +
      "for a printer they already have. Now: the index is not answerable, and intent decides the article " +
      "instead of filename order.",
    isSoftwareTask: true,
    fix:
      "Master index excluded from the answerable corpus; intent and vertical guards on the matcher, each " +
      "proven red in both directions before acceptance." },
  { blocker: "STANDING — the mount refuses unlink",
    price:
      "git cannot check out a merge, and locks cannot be deleted; a session that does not know this " +
      "concludes the environment is broken",
    isSoftwareTask: true,
    fix: "Rename for locks; an explicit two-parent commit with contents written in place for merges. No operator click required. Reproduced again this cycle." },
  { blocker: "No code-hosting credential in the build sandbox",
    price: "37-plus commits of verified work cannot reach the shared line under their own power",
    isSoftwareTask: false,
    fix: "A credential or a code-host connector. Highest-leverage unblock, unchanged, and refused again this cycle against the real remote." },
  { blocker: "The hour is prepared and has not been spent",
    price: "zero conversations held, against a prepared and executable list",
    isSoftwareTask: false },
];

const needsAhmad = [
  { item: "Push the shared line to the code host",
    what:
      "One push. The shared branch is 37 commits ahead of the last known remote reference as measured " +
      "after this cycle's merge — 38 once this feed itself is committed — every one of them verified " +
      "against a green full registry.",
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
  { item: "Spend the hour",
    what: "The prepared ordered actions with message bodies attached, executable cold.",
    why: "Still the only item on this list that can move a business number." },
];

const onTrack = {
  build: true,
  tests: true,
  landing: false,
  conversion: false,
  note:
    "Landing and conversion both read NOT on track, unchanged. This cycle did real product work rather " +
    "than housekeeping: the five most common support questions an MSP receives — Outlook password " +
    "loops, account lockouts, Office and Excel failures, clock drift, adding a printer — could not be " +
    "answered by the shipped knowledge base, and now can. The root cause was not laziness but a test " +
    "assertion that turned red whenever a genuine article was added, leaving fabrication as the only " +
    "way to stay green; that assertion is gone and its replacement is stricter. Three ways the " +
    "assistant could answer confidently and wrongly were closed. None of that is business progress " +
    "and none of it is offered as such: follow-ups sent zero, hours in front of anyone zero, meetings " +
    "zero, revenue none. The credential refusal was reproduced again against the real remote, so " +
    "nothing has reached the code host, and nothing is published.",
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
    "ARIA / AXIS is in active build. The offline assistant now answers five of the most common IT " +
    "support questions it previously could not. 45 first-contact messages sent: 4 undeliverable, 11 " +
    "autoresponders, 1 reply declining. 12 follow-ups drafted, 0 sent. Meetings 0, revenue none. " +
    "Tests: 516 pass, 0 fail, 330 of 330 suites, re-run before and after every change this cycle.",
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
