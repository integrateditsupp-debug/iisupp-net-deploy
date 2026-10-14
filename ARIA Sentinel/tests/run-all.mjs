// ARIA Sentinel test runner — RESILIENT (Task 1b, 2026-06-24).
// Every suite runs in its own try/catch; one missing file or throw can no longer hide the rest. A final
// PASS/FAIL summary lists the reds. Pass --bail to opt back into fail-fast (stop on the first red).
const TESTS = [
  // SECURITY LOCKDOWN 2026-07-01 — repo-level deploy-safety denylist (lives at repo root; runs first).
  "../../tests/deploy-safety-denylist.test.mjs",
  // RUN-BA / BA0 — the same denylist, enforced one step EARLIER. `deploy-safety-denylist` reports a
  // tracked internal path on the next arrival; this asserts the plumbing committer REFUSES it at the
  // moment of the write, which is the only moment the last commit of a cycle is ever observed.
  // Registered by hand: RUN-AW recorded that this manifest does not pick up new files, and a suite
  // running green outside the count is the same lie in a nicer shirt.
  "../../tests/plumbing-commit-denylist.test.mjs",
  // SUITE CENSUS 2026-10-08 (RUN-BW / BW1) — the guard on this array itself. `TESTS` is
  // hand-maintained, which means a suite file on disk that nobody typed here is not red, not
  // incomplete, and not counted: it is invisible. Counted for the first time this cycle: 443 suite
  // files on disk against 375 registered, and 65 of the 70 unregistered ones PASS when invoked by
  // hand — live guards running outside every count the programme has published. This suite fails
  // red unless every unregistered file carries a recorded verdict with a real reason, and unless
  // every deferred verdict is still inside its clock. Registered by hand, like the rest, because
  // a census running outside the count it takes would be the same lie in a nicer shirt.
  "../../tests/suite-registry-census.test.mjs",
  // PENDING DELIVERY AGE 2026-10-08 (RUN-BU / BU1) — the fifty-six-day class. A batch verified in
  // August was staged behind a one-click push, reported truthfully as "waiting" by every cycle after
  // it, and sat off the shared line for fifty-six days because no cycle computed HOW LONG it had been
  // waiting. This asserts the computation that was missing, and its honesty rules: landing claimed
  // only on evidence, an unreadable shelf never reported as an empty one, "cannot tell" never folded
  // into either count, and no pending age of zero standing in for "nothing pending".
  "../../tests/pending-delivery-age.test.mjs",
  // SUITE CENSUS 2026-10-08 (RUN-BV / BV1) — the harness grading itself. RUN-BU's own verification
  // read `# tests 1086 · # fail 0` on a clean clone and `# tests 1103 · # fail 0` on the same commit
  // one `npm install` later: seventeen assertions never attempted, with a clean bill of health beside
  // them, because `${total}/${total} suites green` counted only the suites we got to. This asserts
  // the separation that fixes it — a suite that loaded and failed is RED, a suite blocked by a
  // DECLARED-but-absent package is INCOMPLETE and unjudged, a suite blocked by an UNDECLARED package
  // is RED, and the word green is never printed over a denominator that quietly shrank.
  // Registered by hand, like its predecessors: a guard running outside the count it guards is the
  // same lie in a nicer shirt.
  "../../tests/suite-census.test.mjs",
  // SERVING-LAYER LOCKDOWN 2026-07-02 — live-probe logic (git-state tests can't see the serving layer).
  "../../tests/probe-deploy-safety.test.mjs",
  // CLONE PREP 2026-08-06 (salvaged from cc/axis-feed-2026-08-04, which is otherwise superseded by
  // main) — proves the verification procedure itself: a clean extract of the shared line is prepared
  // the same way every time, so a red/green result from a /tmp clone means what it claims to mean.
  "../../tests/verify-clone-prep.test.mjs",
  // SERVED-FEED HYGIENE 2026-08-05 — the AXIS feed directories are live URL space; nothing untracked
  // (emitter scratch, dotfile drafts) may sit beside the feed. Written after finding two such files.
  "../../tests/served-feed-dir-clean.test.mjs",
  // STAGED-ACTION GUARD 2026-08-05 (RUN-AJ / AJ1) — a one-click action reported as staged must name
  // the readable artefact it operates on. Written after fourteen days of "12 follow-ups drafted,
  // awaiting one click" when the bodies existed nowhere a person could open. Red against that state.
  "../../tests/staged-action-guard.test.mjs",
  // CLAIM EVIDENCE 2026-08-05 (RUN-AK / AK1+AK2) — generalises AJ1 past staged actions: every figure
  // published in the operator-internal payload carries { value, measuredAt, source } or the emitter
  // refuses the write, and a figure older than its class allows is LABELLED stale rather than
  // reading as freshly measured. Nothing is ever dropped by staleness — a vanished claim cannot be
  // challenged, an accused one can.
  "../../tests/claim-evidence.test.mjs",
  // FEED FRESHNESS 2026-08-05 (RUN-AL / AL1+AL2) — AK closed the CLAIM, this closes the CARRIER. The
  // served feed's generatedAt had no gate: a cycle that never ran left the previous feed sitting
  // there being read (and spoken by AXIS) as current state, and a half-completed write could leave
  // the two served mirrors telling different stories. Impossible stamps refuse at write time and
  // write nothing; staleness and mirror disagreement fail at READ time — where the cycle that never
  // ran actually shows up, because the gate has to fire when nobody is present to run anything.
  "../../tests/feed-freshness.test.mjs",
  // CLAIM MEASURE 2026-08-05 (RUN-AM / AM1) — AK proved a figure carries evidence; this proves the
  // evidence was not typed by the writer. The emit script stamped `measuredAt: NOW` on numbers it had
  // copied off a terminal by hand — an assertion whose evidence is the assertion. A figure this
  // environment CAN read must now be produced by the code that read it, or declared unmeasurable
  // with a reason; a hand-typed stamp for such a figure is refused by class before anything is written.
  "../../tests/claim-measure.test.mjs",
  // CLAIM FIGURES RENDER 2026-08-05 (RUN-AM / AM2) — staleness lived in a JSON file nobody opens. The
  // AXIS console now renders the age of every reading and marks the stale ones, on the Director tab
  // where the operator actually looks. Nothing is hidden by staleness; the public headline stays clean.
  "../../tests/claim-figures-render.test.mjs",
  // CUSTOMER LINK GRAPH 2026-08-05 (RUN-AN / AN1) — nineteen cycles proved the OPERATOR's numbers
  // honest and never once proved the thing a PROSPECT would meet. Walks the real link graph from the
  // customer entry points, on disk, with no network call: a route that resolves to nothing, to an
  // empty file, to a force-404 rule, or to a body that is only a login gate fails red and names its
  // file and line. Routes that genuinely cannot be decided here are UNCHECKED, never counted as pass.
  "../../tests/customer-link-graph.test.mjs",
  // STAGED ACTION RANK 2026-08-05 (RUN-AN / AN2) — AJ1 made a staged click name its artefact; this
  // makes the LIST stop pretending its items are equals. Rank + unblocks + what stays blocked are
  // required, ties and gaps fail at the list level, and the order the operator reads is asserted by
  // a test rather than by the order somebody typed the array.
  "../../tests/staged-action-rank.test.mjs",
  // FIRST SCREEN 2026-08-05 (RUN-AO / AO1) — AN1 proved the customer path RESOLVES. This asks the
  // harder question nobody in the series has asked: what the first screen SAYS. Held to Rule 17 (it
  // must promise something a reader can feel — a screen that is navigation and nothing else fails as
  // `no-claim-above-the-fold`) and Rule 14 at the same time (no guarantee/money-back/risk-free, no
  // experience claim past 15+ years, no forbidden name, no proof claim or hard metric the measured
  // feed cannot carry). Findings name the file and line; nothing is rewritten to make this pass.
  "../../tests/first-screen-audit.test.mjs",
  // CONVERSATION PATH 2026-08-05 (RUN-AO / AO2) — a resolving link graph in which no prospect can
  // reach a human is a working website and a dead business. Walks entry point → the action that
  // starts a conversation, fails on no path, on a path past two clicks, and on a path ending in a
  // form that accepts typing and delivers it nowhere. Undecidable = UNCHECKED, never a pass.
  "../../tests/conversation-path.test.mjs",
  // SURFACE CLASS 2026-08-05 (RUN-AP / AP1+AP2) — AO1 found six first screens that say only what
  // they are. Rewriting all six to make the number green would have been dishonest on two of them:
  // a terms page and a coordinated-disclosure page exist to discharge an obligation, not to sell.
  // The split is declared in code with a written argument per exempt surface, an exemption shorter
  // than an argument fails red, and the exempt count is asserted never to be folded into passed.
  // The exemption covers Rule 17 and nothing else — a Rule 14 violation still fails on an exempt page.
  "../../tests/surface-class.test.mjs",
  // LEDGER HEAD ON DISK 2026-08-05 (RUN-AP / AP4) — `o3-ledger-head` proves ONE TRUTH, THREE
  // SURFACES between three in-memory computations off one object, which cannot drift. The block a
  // human opens in PROGRESS-LEDGER.md was never read by a test, and it sat at RUN-Z 0/3 · 321/323 ·
  // 41 unpublished through roughly eight regenerations of the feed. This carries the invariant
  // across the filesystem boundary: the real file, the truth artefact it was generated from, and
  // the served feed must agree, and the history below the END marker is asserted byte-identical.
  "../../tests/ledger-head-on-disk.test.mjs",
  // RUN-BM / BM0 — which operator-internal inputs a given tree actually has. Registered directly
  // above the ledger-head suite because it is the reading that says whether THAT suite's red means
  // broken code or an input a clone was never allowed to receive. Green in both trees by design.
  "../../tests/operator-input-boundary.test.mjs",
  // UNPUBLISHED RANGE 2026-08-06 (RUN-AR / AR1) — twenty-three cycles closed with "N commits ahead
  // of the shared line" and never once priced it. A count is not a finding: the range is now read
  // out of the repository and classified BY PATH (never by the commit message), overlapping classes
  // are reported as overlapping rather than resolved to whichever one the author would have
  // preferred, and a range that could not be read is UNREADABLE — never zero.
  "../../tests/unpublished-range.test.mjs",
  // RANGE BUNDLE 2026-08-06 (RUN-AR / AR2) — the second delivery path, for a line no credential in
  // this environment can push. A verified thin bundle plus a manifest recording tip, tree and a
  // SHA-256 of the bytes. The digest exists because the first red proved `git bundle verify` PASSES
  // a 60%-truncated bundle: it reads the header, not the packfile. Certifying a half-copied backup
  // as sound would have been the most expensive false comfort in the program.
  "../../tests/range-bundle.test.mjs",
  // SANDBOX GIT BOUNDARY 2026-08-06 (RUN-AR / AR3) — the mount's `.git` refuses unlink, so its stale
  // locks are permanent and porcelain writes are blocked for the life of the environment. Recorded
  // once, with the plumbing workaround proven end-to-end against a really-blocked repository, so no
  // future cycle re-derives it. The environment's inconvenience is a CLASSIFICATION, never a red —
  // a red that means nothing trains its reader to skip the colour.
  "../../tests/sandbox-git-boundary.test.mjs",
  // CROSS-SURFACE CONSISTENCY 2026-08-06 (RUN-AS / AS1) — every public gate before this one judged
  // ONE page at a time; none ever asked whether the pages AGREE. That stopped being theoretical the
  // moment the priced range reached origin/main by a real push: the sixteen files were written weeks
  // apart by different sequences and are now served TOGETHER. A plan priced two ways, a framework
  // "certified" here and "readiness" there, or a call to action pointing where a sibling says the
  // door is not open — each names BOTH files and BOTH lines. Silence is allowed; disagreement is not.
  "../../tests/cross-surface-consistency.test.mjs",
  // PUBLISH REHEARSAL 2026-08-06 (RUN-AS / AS2) — "it will publish cleanly" was an assumption for
  // twenty-four cycles. Here the whole path is WALKED every cycle in a throwaway directory: the
  // bundle is fetched into a repository that does not have the range, the range lands, every
  // published file is compared BLOB BY BLOB against the tested tree, and the serving rules are read
  // out of THAT LANDED TREE — not the working copy — to prove none of them 404s, gates or hides a
  // file that is present and correct. The irreversible publish stays Ahmad's; this only removes the
  // excuse that nobody knows whether it would work.
  "../../tests/publish-rehearsal.test.mjs",
  // PRIMARY ACTION 2026-08-06 (RUN-AS / AS3) — the routes resolve, the pages agree, the first
  // screens lead with the reader's gain, and none of those gates ever asked what the page WANTS.
  // The invitation is extracted from the file: its words, its target, whether that target can
  // receive anything in the tree being published, and whether the ask is proportionate to a first
  // visit. It found a real one on its first run — the About page told a stranger who we are and
  // then asked them for nothing at all.
  "../../tests/primary-action.test.mjs",
  // YES-PATH 2026-08-06 (RUN-AT / AT1) — twenty-five cycles built the front of the funnel and none
  // of them asked what happens in the hour AFTER someone answers. The route from an inbound reply to
  // a first dollar is resolved against artefacts on disk — reply, booking, scope, agreement, invoice,
  // payment — and "handled manually" is refused as a resolution, because that phrase is exactly how a
  // gap hides. An artefact the shared line does not carry is UNTRACKED, never rounded up to present:
  // it found that the only agreement a client can sign lives outside git, so a clone cannot produce it.
  "../../tests/yes-path.test.mjs",
  // RETAINER PROPOSAL 2026-08-06 (RUN-AT / AT2) — the document that turns a call into a signature,
  // generated from the repository's OWN published plan table rather than typed. Every figure is
  // selected by key and carries its file and line; a number that reaches the output without a source
  // is refused by token, and rule-7 language, an experience claim past 15+ years and the forbidden
  // name are refusals rather than warnings. It generates; it sends nothing.
  "../../tests/retainer-proposal.test.mjs",
  // TIME TO FIRST DOLLAR 2026-08-06 (RUN-AT / AT3) — the distance between a yes and money, counted
  // in acts a person must perform and blanks a person must fill, never in invented hours. Manual BY
  // DESIGN (the signature, the payment authorisation) is kept apart from manual because nothing
  // carries the step; anything unreadable is UNCOUNTED with its reason rather than estimated to zero.
  "../../tests/time-to-first-dollar.test.mjs",
  // CLIENT-FACING LEAK GATE 2026-08-11 (RUN-AU / AU1) — the gate that lets a client-signable
  // agreement live in the shared line WITHOUT weakening the 2026-07-01 lockdown. Every client-facing
  // document is read for operator-internal content — credential, internal path, internal codename,
  // the forbidden name, rule-7 language, an experience claim past 15+ years, a contact detail that
  // contradicts what the company publishes — and each refusal class is proven by planting that exact
  // leak and asserting it fails BY NAME AND BY LINE. A quoted price the company publishes nowhere is
  // counted and cited as a DECISION rather than a leak, because a gate that forced working contracts
  // to be deleted to go green would be the worse failure (Rule 15).
  "../../tests/client-facing-leak.test.mjs",
  // INVOICE REHEARSAL 2026-08-11 (RUN-AU / AU2) — the path from an agreed proposal to a raised
  // invoice, walked end to end in a throwaway directory with no live API call, no key, no network
  // and no money moved. Every failure class is named and proven red against a fixture built to fail
  // that way: a figure with no source, a plan not published, a missing client, a plan with no charge
  // route, an unreadable checkout, and a currency that disagrees with the plan table. The charge
  // itself is reported UNRUN with its reason — never as a pass.
  "../../tests/invoice-rehearsal.test.mjs",
  // YES-PATH REGRESSION 2026-08-11 (RUN-AU / AU3) — tests/yes-path.test.mjs proves the WALKER is
  // correct against fixtures; this asserts a fact about THIS repository: all six steps from a reply
  // to a first dollar are carried by artefacts the shared line holds, and the suite goes red the
  // moment one falls back to untracked, unusable or missing. The detection itself is proven by
  // pointing a step at a file that does not exist.
  "../../tests/yes-path-regression.test.mjs",
  // CURRENCY CONSISTENCY 2026-08-11 (RUN-AV / AV1) — AU2's rehearsal found the plan page saying USD
  // and the inline charge path saying CAD, and staged the decision. This walks the WHOLE money path
  // instead of the two surfaces one rehearsal touched and finds seven declarations in two currencies
  // — one of them the renewal email a paying customer receives. The invariant: the audit can never
  // return "consistent" while surfaces disagree, and it never picks a direction. Until Ahmad names
  // one, the divergence is reported with every file:line; once he does, the same module enforces it.
  "../../tests/currency-consistency.test.mjs",
  // QUOTED FIGURES 2026-08-11 (RUN-AV / AV2) — AU1 could only say "this figure is not in the plan
  // table", which is also true of an insurance limit, so its gate had exactly two moves: publish or
  // delete. This adds the third honest state — DECLARED in a tracked register with a reason a person
  // wrote — and drives SILENT to zero without deleting a line of any contract (Rule 15). The register
  // cannot be used as a rubber stamp: an empty reason is refused, a declaration matching nothing is
  // stale. Found by running it: the Sentinel sales one-pager carries a SECOND price for all five
  // published plans, reported as contradictions with both citations and deliberately not declarable.
  "../../tests/quoted-figures.test.mjs",
  // SEND SHEET GATE 2026-08-11 (RUN-AV / AV3) — the twelve messages have been rank 1 for six cycles.
  // What was never priced is what pressing send COSTS: twelve separate judgement calls about rule-7
  // language, experience claims, forbidden names, unpublished figures, dead links and Rule-11 contact
  // detail. Checked by code once, driving `judgementCallsLeft` to zero. It has no transport and the
  // suite asserts that. Found by running it in a clone: the sheet is excluded from the tracked tree
  // by the deploy-safety lockdown, reported as its own class rather than moved into served URL space.
  "../../tests/send-sheet-gate.test.mjs",
  // CLAIM REGISTER 2026-08-11 (RUN-AW / AW2) — AW1 asks whether a document carries anything it should
  // not. This asks whether what it DOES carry is true. Every factual assertion in the twenty-seven
  // receivable documents — certification, audit, insurance, retention, uptime, experience — ends in
  // exactly one of four states: consistent with a published page, explicitly disclaimed by its own
  // sentence, declared in `docs/CLAIM-REGISTER.md` with a condition (forward-looking) or evidence
  // (present-tense), or REFUSED as unevidenced. Silent driven to zero without deleting a line
  // (Rule 15). Found by running it: `Founder 21+ yrs IT` in the SOC 2 self-assessment and the HIPAA
  // readiness map — above the honest ceiling, in the first two documents an auditor opens, written in
  // an abbreviation the leak gate's pattern never matched. Two defects caught against this module's
  // own logic before it shipped: a disclaimer read as an assertion, and first-match-wins handing a
  // sub-processor's certificate to this company's 2027 target.
  "../../tests/claim-register.test.mjs",
  // PROSPECT PACKET 2026-08-11 (RUN-AW / AW3) — AU1 asked whether a clone can produce the one document
  // a client signs. This asks it of the whole packet a prospect receives after a yes: the contracts,
  // the security questionnaires, the readiness maps, the eleven policies, the sales sheets and the
  // client integration guide. Assembled in a throwaway directory from HEAD'S TREE — never the working
  // copy, never the index (AU3's correction) — so a document that exists only on one machine is
  // reported UNTRACKED with its reason instead of counted as delivered. No send, no attachment, no
  // mail path, and the suite asserts that. An empty section fails: promising nothing is not delivering
  // everything. Wired to AW1 by an invariant — the gate and the packet must see the same documents.
  "../../tests/prospect-packet.test.mjs",
  // PACK ANSWER CONSISTENCY 2026-08-11 (RUN-AX / AX1) — AW read each client-facing document alone; a
  // security reviewer never does. The questionnaires, the policies and the contracts are read as ONE
  // body and every place two of them answer the same reviewer question differently is reported with
  // both citations. No code path returns agreed while answers disagree, and none picks which answer
  // is right — that is a promise to a paying customer, not a formatting choice. A disagreement
  // nobody has written down goes RED; one declared in docs/PACK-ANSWER-CONFLICTS.md with a reason
  // and a named decider is staged; a declaration that has rotted goes red too.
  "../../tests/pack-answer-consistency.test.mjs",
  // ANSWER CITATIONS 2026-08-11 (RUN-AX / AX2) — dozens of answers in the pack do not state a fact,
  // they POINT at one. Every citation is resolved against HEAD'S TREE (never the working copy, never
  // the index — AU3's correction), including SECTION citations, which a file-existence check passes
  // and a reviewer opening the document does not. An artefact that exists under another path is
  // MISDIRECTED and gets corrected; one nothing carries is a decision and must be declared in
  // docs/CITATION-GAPS.md. `documents/`-scoped citations are their own class with their reason, so
  // the lockdown is never weakened to make a number green. Redirect-table-aware on purpose.
  "../../tests/answer-citations.test.mjs",
  // ANSWER COST 2026-08-11 (RUN-AX / AX3) — AV3 priced pressing send; this prices the reviewer's
  // follow-up, in the only unit this environment can honestly measure: questions answered by
  // pointing at an artefact that exists versus questions requiring a person to compose something
  // new. NEVER hours — nobody here has timed one and an invented duration is a fabricated metric.
  // Composed-BY-DESIGN is kept apart from composed-for-want-of-an-artefact so the program is never
  // pushed toward automating the judgement that wins the deal. Wired to AX2: every composition
  // forced by a missing artefact names the declared gap it waits on.
  "../../tests/answer-cost.test.mjs",
  // CUSTOMER PACKET 2026-08-11 (RUN-AY / AY1) — AW3 assembled what a PROSPECT is promised. This is
  // the packet a PAYING customer receives: onboarding, admin and integration guides, the support
  // route, a data export, and a way to leave. Same discipline — HEAD's tree is the source, an empty
  // section fails because promising a customer nothing is not delivering everything, and a document
  // that never mentions what its section promises is SILENT rather than delivered (a packet that
  // counts filenames is a packet that has not been read).
  "../../tests/customer-packet.test.mjs",
  // SUPPORT COMMITMENTS 2026-08-11 (RUN-AY / AY2) — response times, uptime, escalation and support
  // hours read off EVERY surface that states one, as one body. Unlike a wrong currency, a missed
  // response time is breached SILENTLY, by nobody doing anything, which is why it is read by code
  // rather than remembered. No code path returns agreed while surfaces disagree and none picks which
  // is right; a disagreement is declared open with a reason and a named decider, or it goes red.
  "../../tests/support-commitments.test.mjs",
  // FIRST WEEK COST 2026-08-11 (RUN-AY / AY3) — AT3 counted the distance from yes to money and AX3
  // the cost of answering a reviewer. This prices the week AFTER the first invoice clears, in acts
  // and artefacts and never hours. Manual-BY-DESIGN stays apart from manual-for-want so the program
  // is never pushed toward automating the welcome that is the reason a customer bought from a founder.
  "../../tests/first-week-cost.test.mjs",
  // CHURN SIGNALS 2026-08-11 (RUN-AZ / AZ1) — AY2 proved the response times we PROMISE disagree.
  // This asks the prior question: if one were missed, could anything on this machine tell us? Four
  // states, because a binary would report this environment as healthier than it is — an event that
  // is received and retained by nothing is TRANSIENT, and one retained that nobody reads is its own
  // class. No health score is computed: a number derived from signals we do not have is a fabricated
  // metric with a chart on it. Wired to AY2 — a promise no signal claims must be DECLARED.
  "../../tests/churn-signals.test.mjs",
  // TERM AND EXIT 2026-08-11 (RUN-AZ / AZ2) — the first thing in this program that walks OUT of a
  // contract. Two halves kept apart: whether the customer is TOLD (AY1's SILENT state — a document
  // that arrives and never mentions its stage is not delivered) and whether the windows AGREE
  // (AX1's machinery, reused rather than re-implemented). No code path picks which answer is right.
  "../../tests/term-and-exit.test.mjs",
  // SECOND SALE COST 2026-08-11 (RUN-AZ / AZ3) — priced in acts a person must perform and artefacts
  // that must exist, never hours and never money: a figure about a sale that has not happened is a
  // forecast wearing a measurement's clothes. Resolves through AZ1 and AZ2, so a step blocked by an
  // unobservable signal or a silent exit stage names it.
  "../../tests/second-sale-cost.test.mjs",
  // SENTINEL TRIAL GATING 2026-07-02 — 30-day trial + permanent Walk-Through entitlement (Concierge buyers).
  "./walkthrough-entitlement.test.mjs",
  // SITE FINEPRINT GATE 2026-08-06 (salvaged from cc/axis-feed-2026-08-04) — the site-wide legal
  // disclaimer strip may never silently disappear from a tracked public page; a new public page that
  // ships without it fails here rather than slipping through. Walk narrowed to git-tracked files.
  "./site-fineprint-gate.test.mjs",
  "./tab-gating-post-trial.test.mjs",
  "./walkthrough-webhook-grant.test.mjs",
  "./gating-free-floor.test.mjs", // FIX 2 — free floor ⊊ paid Personal (a paid entry plan is a real upgrade)
  "./dual-license-matrix.test.mjs", // 2026-07-03 — per-state matrix (admin/pro/smb/personal/trial/expired), backbone of the test-matrix doc
  // P1 DEAD-SHELL FIX 2026-07-02 — the free/expired floor must stay a NAVIGABLE tier (never a locked shell).
  "./nav-baseline-navigable.test.mjs",
  "./renderer-no-deadshell.test.mjs",
  // P0 DEAD-SHELL FIX 2026-07-02 — renderer import graph must be browser-safe (no node:/bare specifier can
  // enter it, or the CSP blocks the load and every click dies). Catches the tab-gating→node:crypto regression.
  "./renderer-import-graph.test.mjs",
  // P1 OVERLAY 2026-07-02 — ONE box (no #companionPanel layer) + on-device tap-to-speak voice loop.
  "./overlay-onebox-voice.test.mjs",
  // FORUMS MVP 2026-07-02 — real-KB retrieval + honest abstain + store core + a11y/fabrication gates.
  "../../tests/forums-mvp.test.mjs",
  // FORUMS KNOWLEDGE COMMONS 2026-07-16 — Ahmad chose "1 AND 2": both surfaces ship. Commons a11y +
  // Rule-14 honesty (staged boards, no fabricated counts) + two-way cross-link (neither is a dead end).
  "../../tests/forums-commons.test.mjs",
  // CONCIERGE 2026-07-02 — AI Setup Walk-Through homepage card + aria.html copy + services.html listing.
  "../../tests/concierge-service.test.mjs",
  "./scenario-suite.mjs",
  "./extension.test.mjs",
  "./endpoint.test.mjs",
  "./privacy-audit.mjs",
  "./ui-shell.test.mjs",
  "./watchers.test.mjs",
  // GLOBE FALSE-POSITIVE GATE 2026-07-16 — SYSTEM.SERVICE.STOPPED must not nag about idle-normal Manual/Trigger
  // services (esp. wuauserv); Automatic-down still fires + failure evidence overrides (Rule 15 — detector kept).
  "./service-idle-normal.test.mjs",
  "./macos-watchers.test.mjs",
  "./overlay-physics.test.mjs",
  "./servicenow.test.mjs",
  "./policy-injection.test.mjs",
  "./content-leak.test.mjs",
  "./idempotency.test.mjs",
  "./kill-switch.test.mjs",
  "./recipe-execution.test.mjs",
  "./recipe-runner.test.mjs",
  "./diagnostic.test.mjs",
  "./health-score.test.mjs",
  "./tray-state.test.mjs",
  "./network-capture.test.mjs",
  "./evidence-pack.test.mjs",
  "./status-badge.test.mjs",
  "./telemetry-event.test.mjs",
  "./autonomous-guards.test.mjs",
  "./autonomous-refire.test.mjs",
  "./slack-notify.test.mjs",
  "./weekly-digest.test.mjs",
  "./audit-export.test.mjs",
  "./low-power.test.mjs",
  "./command-palette.test.mjs",
  "./roi-calc.test.mjs",
  "./license.test.mjs",
  "./c2-pilot-state.test.mjs",   // RUN-C C2 — free-pilot mechanic
  "./a1-empty-state-no-fabrication.test.mjs",   // RUN-A A1 — Rule 14 real-or-empty (no fabricated metrics)
  "./admin-console-honesty.test.mjs",   // H1 (2026-07-02) — Rule 14 real-or-empty for the admin console (no fabricated fleet)
  "./symptom-executor.test.mjs",        // F1 (2026-07-02) — matched symptom → vetted Tier-0 executor binding (resolve actually runs)
  "./integrations-tab-restore.test.mjs",// Integrations tab RESTORE (2026-07-02, Rule 15) — full tab set + every connector section
  "./density-charts-collapse.test.mjs", // Density (2026-07-02) — SLA/KPIs as live charts + heavy sections collapse by default
  "./auto-update.test.mjs",
  "./api-v1.test.mjs",
  "./patch-management.test.mjs",
  "./multi-tenant.test.mjs",
  "./pwa-manifest.test.mjs",
  "./globe-roam.test.mjs",
  "./admin-console-open.test.mjs",
  "./show-floating-globe.test.mjs",
  "./trial-gate.test.mjs",
  "./network-detect.test.mjs",
  "./mode-behavior.test.mjs",
  "./ia-tabs.test.mjs",
  "./quick-controls.test.mjs",
  "./chrome-ext-install.test.mjs",
  "./hotkeys.test.mjs",
  "./update-manifest.test.mjs",
  "./admin-publish.test.mjs",
  "./license-search.test.mjs",
  "./license-register.test.mjs",
  "./update-rollback.test.mjs",
  "./update-feedurl.test.mjs",
  "./self-heal.test.mjs",
  "./globe-anchor.test.mjs",
  "./globe-greetings.test.mjs",
  "./aria-brain-client.test.mjs",
  "./admin-build-gate.test.mjs",
  "./start-stop-aria.test.mjs",
  "./hotkeys-bind.test.mjs",
  "./live-globe-icons.test.mjs",
  // RUN 16 — full-spectrum test battery (12 dimensions).
  "./debug-battery.test.mjs",
  "./qa-battery.test.mjs",
  "./user-journey.test.mjs",
  "./security-battery.test.mjs",
  "./privacy-battery.test.mjs",
  "./scenario-battery.test.mjs",
  "./test-kb-qa.test.mjs",
  "./audit-battery.test.mjs",
  "./soc2-map.test.mjs",
  "./regulatory-map.test.mjs",
  "./legal-inventory.test.mjs",
  "./accessibility-battery.test.mjs",
  "./build-exclusion.test.mjs",
  "./audit-integrity.test.mjs",
  "./icon-pipeline.test.mjs",
  // RUN 17 — audit-tamper security banner.
  "./security-banner.test.mjs",
  "./security-banner-dismiss.test.mjs",
  // RUN 18 — enterprise verification (wiring lock + artifact-level content-blindness).
  "./run18-enterprise-wiring.test.mjs",
  "./run18-evidence-content-blind.test.mjs",
  // RUN 19 — live-app polish + premium UX.
  "./popup-clamp.test.mjs",
  "./sidebar-layout.test.mjs",
  "./kill-switch-hotkey.test.mjs",
  "./delete-triple-confirm.test.mjs",
  "./trial-end-modal.test.mjs",
  "./odd-grid.test.mjs",
  "./live-buttons.test.mjs",
  // RUN 20 — system knowledge engine + cross-platform blueprint + safe-generic Tier-0 recipes.
  "./system-context-enum.test.mjs",
  "./system-context-refresh.test.mjs",
  // D6 (2026-07-03) — real disk % used (system-volume free/size), honest fallback when unavailable.
  "./disk-usage.test.mjs",
  "./symptom-kb-parse.test.mjs",
  "./blueprint-coverage.test.mjs",
  "./tier-0-recipes-dryrun.test.mjs",
  "./diagnostic-reasoner-fuzzy.test.mjs",
  "./diagnostic-reasoner-system-aware.test.mjs",
  "./no-harm-gate.test.mjs",
  "./anomaly-surfacing.test.mjs",
  "./root-cause-correlation.test.mjs", // F4 (SENTINEL-BRAIN-AUDIT) — cross-subsystem root-cause correlation -> ONE Resolution Plan
  "./cross-platform-no-control.test.mjs",
  "./event-log-sanitize.test.mjs",
  "./registry-read-only.test.mjs",
  "./escalation-path.test.mjs",
  // RUN 21 — auto-update orchestrator + startup hook + admin capture + heartbeat.
  "./update-listener.test.mjs",
  "./update-orchestrator-states.test.mjs",
  "./update-orchestrator-time-windows.test.mjs",
  "./update-orchestrator-fullscreen-defer.test.mjs",
  "./update-rollback-killswitch.test.mjs",
  "./startup-registrar.test.mjs",
  "./startup-tamper-detection.test.mjs",
  "./startup-disable-double-confirm.test.mjs",
  "./heartbeat-payload-content-blind.test.mjs",
  "./heartbeat-endpoint.test.mjs",
  "./admin-publish-captures-event.test.mjs",
  "./admin-mandatory-checkbox.test.mjs",
  "./pause-updates-quarterly-limit.test.mjs",
  "./private-folder-never-touched.test.mjs",
  "./run-21-no-regression.test.mjs",
  // RUN 22 — dashboard + performance + SLA + compliance + quarterly reports + retention.
  "./dashboard-hero-status.test.mjs",
  "./dashboard-kpi-tiles.test.mjs",
  "./dashboard-recent-activity.test.mjs",
  "./dashboard-quick-actions.test.mjs",
  "./performance-kpis.test.mjs",
  "./performance-ai-accuracy.test.mjs",
  "./performance-hours-saved.test.mjs",
  "./performance-tab-no-regression.test.mjs",
  "./sla-tracker.test.mjs",
  "./sla-breach-credits.test.mjs",
  "./sla-tier-thresholds.test.mjs",
  "./compliance-frameworks.test.mjs",
  "./compliance-r11-enforcement.test.mjs",
  "./compliance-evidence-pack.test.mjs",
  "./report-generator-quarterly.test.mjs",
  "./report-generator-adhoc.test.mjs",
  "./report-pdf-no-pii.test.mjs",
  "./email-quarterly-delivery.test.mjs",
  "./data-retention-policy.test.mjs",
  "./data-retention-cleanup-cron.test.mjs",
  "./admin-console-fleet-perf.test.mjs",
  "./private-folder-never-touched-r22.test.mjs",
  // RUN 23 — self-service loop (process detectors · recommend-action · globe panel · countdown gate ·
  // supervisor critic · dry-run policy · quarterly cron · cowork bridge).
  "./process-detectors.test.mjs",
  "./recommend-action.test.mjs",
  "./globe-status-panel.test.mjs",
  "./action-countdown.test.mjs",
  "./supervisor-agent.test.mjs",
  "./dry-run-policy.test.mjs",
  "./quarterly-cron.test.mjs",
  "./cowork-bridge.test.mjs",
  "./run-23-r11-never-touched.test.mjs",
  "./run-23-no-regression.test.mjs",
  // RUN 23b — Tier-0 executor binding (5 vetted recipes go live, gated by the supervisor + countdown).
  "./tier-0-executor.test.mjs",
  "./tier-0-rollback.test.mjs",
  "./tier-0-supervisor-integration.test.mjs",
  "./tier-0-r11-never-touched.test.mjs",
  // RUN 23c — auto-OTA pipeline (version bump · GitHub Releases publisher · manifest · 1-click admin button).
  "./version-bump.test.mjs",
  "./publish-github-release.test.mjs",
  "./publish-manifest.test.mjs",
  "./admin-console-publish-button.test.mjs",
  "./ota-build-step7.test.mjs",
  "./r11-publish-paths.test.mjs",
  // RUN 23d — tab IA 17→9 consolidation (Dashboard/Compliance&Privacy/System/Settings merges + redirects).
  "./tab-ia-consolidation.test.mjs",
  // JULY PORT 2026-10-14 (c0a0f6b4) — the Resolution surface as sub-anchors of the Recipes tab: Fix It search/family
  // filter over the same lists + the real 30-day paginated Fix History (names kept — Rule 15; 11-tab budget kept).
  "./resolution-tab.test.mjs",
  // RUN 23e — single build + license-tier feature gating + plan picker + upsell + shouldBump hotfix.
  "./pricing-tiers.test.mjs",
  "./license-features.test.mjs",
  "./upsell.test.mjs",
  "./feature-gating.test.mjs",
  "./plan-picker.test.mjs",
  "./plans-matrix.test.mjs",
  // R-ONE N1 — site-wide pricing guard: 0 stale tier prices anywhere + pages match the single source.
  "./site-pricing-guard.test.mjs",
  // RUN 24 — auto-license funnel (webhook mint/persist/email logic) + admin licenses registry.
  "./sentinel-license-funnel.test.mjs",
  "./sentinel-licenses-api.test.mjs",
  "./admin-licenses-tab.test.mjs",
  // RUN 24 A6 — server-side license resolve (secret stays server-side) + desktop offline cache tiers.
  "./sentinel-resolve.test.mjs",
  "./desktop-license-cache.test.mjs",
  // RUN 29-A — mode-based dry-run defaults (Manual ON · Confirmed/Autonomous OFF).
  "./dryrun-defaults.test.mjs",
  // RUN 29-D — $0 content-blind crash reporter.
  "./crash-reporter.test.mjs",
  // RUN 29-C — first-run onboarding state machine (never replays after dismiss).
  "./onboarding-flow.test.mjs",
  // RUN 30-B — offline local KB matcher (cross-platform, platform bias).
  "./aria-local-kb.test.mjs",
  // RUN 31 — KB-first wiring (aria-kb-query before aria-chat; $0 retrieval).
  "./kb-first-wiring.test.mjs",
  // D1 (2026-07-03) — KB relevance floor: abstain (never return the nearest WRONG article) when no match.
  "./kb-abstain-floor.test.mjs",
  // P0 (2026-07-14) — end-user chat answer shaping: never render Internal Technician Notes / registry / keywords.
  "./chat-answer-shaping.test.mjs",
  // P3 (2026-07-14) — shared TOPICS brain v2.1 battery (root; the offline tier-3 engine synced into Sentinel).
  "../../tests/aria-brain-v2.test.mjs",
  // P0–P2 acceptance (2026-07-14) — L1–L3 IT-director scenario pack: containment-first + honesty invariants.
  "./l1-l3-director-scenarios.test.mjs",
  // D2 (2026-07-03) — Ask-ARIA usage recorded to local memory + stats (Memory/Dashboard reflect real asks).
  "./chat-stats.test.mjs",
  // JULY PORT 2026-10-14 (a7f9e111 Phase F D2) — every stored chat turn is guard-scrubbed + capped on disk at the one
  // choke point; parseSessions counts USER turns as asks. The content-blind browser-outcome ledger (local bridge
  // POST /browser-outcome · GET /browser-outcomes/fleet-packet, local-only) + its frozen fleet-packet contract.
  "./chat-activity-recording.test.mjs",
  "./browser-outcome.test.mjs",
  "./browser-outcome-fleet-contract.test.mjs",
  // RUN 32-B — 3-mode proof-of-life (Manual/Confirmed/Autonomous execution pipeline).
  "./mode-execution.test.mjs",
  // RUN 34-4 — 3-mode × 13-error matrix (every Windows error class × Manual/Confirmed/Autonomous disposition).
  "./mode-error-matrix.test.mjs",
  // RUN 34-5 — 20+ Windows-error detector sweep (every live watcher mapper, each content-blind under PII input).
  "./windows-error-sweep.test.mjs",
  // JULY PORT 2026-10-14 (ddfcac5b) — the READ-ONLY .txt file-association guard: reg query only, two manual/guide
  // recipes, the normal detection pipeline, the excluded-folder guard on every registry string, Settings as the fix.
  "./file-association-guard.test.mjs",
  // RUN 33 PIVOT — ARIA Chat in-tab (Chat sub-section of the ARIA parent tab; detached window removed).
  "./aria-chat-window-ui.test.mjs",
  // RUN 35-1 — chat scroll containment (inner log scrolls; outer tab never grows).
  "./chat-scroll-containment.test.mjs",
  // JULY PORT 2026-10-14 (cd518cea · 9f2b9bd7 · 69058206, ported from cc/security-lockdown-2026-07-01) — desktop ARIA
  // chat KB answers framed as readable cards around the P7 lead; the web entry flow (welcome + quick chips); the
  // SCRIPTED 100-call demo lab in Control Center (copy only — the runners reach nothing on the device).
  "./aria-chat-readable-answer.test.mjs",
  "./aria-chat-web-alignment.test.mjs",
  "./common-call-demo.test.mjs",
  "./common-call-demo-ui.test.mjs",
  // RUN 35-2 — aria-kb-query routing iter 7 (security families/takeover · wifi no-word · printer tightened).
  "./aria-kb-routing-iter7.test.mjs",
  // RUN 36 round-3 — routing coverage for calendar · external display · conference-room AV (top50-gaps).
  "./aria-kb-routing-round3.test.mjs",
  // Q-QA1 — web /aria classifier accuracy computed at test time + per-intent 50% floor + AD regression lock.
  "./classifier-accuracy.test.mjs",
  // Q-WEBTIER — $70/mo ARIA Web + AI Edge: env-aware config + card model + checkout wiring + matrix separation.
  "./web-tier-contract.test.mjs",
  // R-ONE N2 — implementation add-on selector → quote request (no Stripe charge).
  "./impl-addon-quote.test.mjs",
  // Q-DIR / Q-DIR+ (R3) — identity-tier directory provider: cannot-mess-up protocol + failure-injection (mock-only).
  "./directory.test.mjs",
  // Q-DIR slice 2 — live Microsoft Graph DirectoryProvider adapter (read-only; mock-fetch tested).
  "./entra-graph-client.test.mjs",
  // RUN 33 Phase 2 — ARIA tab data parsers (status / kb-stats / sessions R11 / heartbeats).
  "./aria-surfaces.test.mjs",
  // RUN 33-E — first-launch Setup wizard (state machine + wiring).
  "./setup-wizard.test.mjs",
  // RUN 34-1 — readable chat: markdown → HTML rendering.
  "./aria-markdown.test.mjs",
  // F2 2026-07-03 — bundled full KB text repairs a mid-line-truncated live excerpt (printer "Escalation Trigger").
  "./kb-fulltext.test.mjs",
  // F2 recurrence 2026-07-03 — truncation must be detected EVEN behind the client's "→ Full article:" footer.
  "./kb-answer-truncation.test.mjs",
  // RUN 34-3 — license mint never hangs (timeouts on every leg + actionable error).
  "./license-mint-timeout.test.mjs",
  // RUN 33-A — KB freshness surfaced in the top bar.
  "./kb-freshness.test.mjs",
  // TASK 3 (2026-06-24) — "Resolve it for me" enabled + gated (supervised-fix, Confirmed, never autonomous).
  "./resolve-for-me.test.mjs",
  // Q0b (2026-06-24) — aria-sentinel:// deep-link receiver (pure parser/validator).
  "./deep-link.test.mjs",
  // Q0b (2026-06-24) — web "Open with ARIA Sentinel" emitter ↔ desktop receiver URL contract.
  "./web-handoff-contract.test.mjs",
  // RUN-C C1 (2026-06-30) — funnel "zero dead ends" guard: every customer-facing internal link resolves + conversion chain intact.
  "./funnel-link-guard.test.mjs",
  // RUN-C C3 (2026-06-30) — 5-minute onboarding activation + time-to-first-value (real-or-empty, no dead step).
  "./onboarding-activation.test.mjs",
  // RUN-D D2 (2026-07-01) — pilot->paid capture engine: case study real-or-empty + consent gate + conversion moment.
  "./d2-case-study.test.mjs",
  // RUN-D D2 wiring (2026-07-01) — case-study/conversion-moment plumbed into main IPC + preload + pilot-expiry pending surface.
  "./d2-wire-conversion.test.mjs",
  // RUN-B B1 (2026-07-01) — "Was this fixed?" feedback loop -> real deflection %% (real-or-empty; feeds dashboard tile + D2 proof).
  "./resolution-outcome.test.mjs",
  // JULY PORT 2026-10-14 (af5e03ab, ported from cc/security-lockdown-2026-07-01) — the July ledger reconciled as a DIFF
  // (id dedupe · not_resolved · escalated counted-never-resolved · hours_saved from roi.mjs · hasProof); the Office File
  // Safety Net (pure planner · trainer · live service on a temp tree, opt-in + excluded-folder guard); the RDP rescue
  // decision layer (secret-free, guard-scrubbed) + the admin console's static, disabled "Grant Asset RDP Access" tab.
  "./resolution-outcome-july-reconcile.test.mjs",
  "./office-file-safety.test.mjs",
  "./office-trainer.test.mjs",
  "./office-safety-service.test.mjs",
  "./rdp-access.test.mjs",
  "./admin-rdp-access-tab.test.mjs",
  "./value-proof.test.mjs",   // RUN-B B2 — real ROI $/hours + real deflection on every surface (real-or-empty)
  // RUN-B B5 (2026-07-01) — under-globe "issue resolved | email sent | ticket ref" confirmation (real-or-empty; desktop overlay + web mirror parity).
  "./b5-globe-confirmation.test.mjs",
  "./b3-trust-posture.test.mjs",   // RUN-B B3 — honest trust/security surface (no over-claim, real-or-empty)
  "./b4-axis-chat.test.mjs",       // RUN-B B4 — AXIS chat: env-driven model + honest offline fallback (no silent Brain-busy)
  // RUN-E E1 (2026-07-02) — pilot activation -> TTFV clock: first real audit-log RUN fix stamps ttfvMinutes into pilot.json (write-once, real-or-empty "--").
  "./e1-pilot-activation-ttfv.test.mjs",
  "./e2-proof-autorun.test.mjs",
  "./e3-revenue-board.test.mjs",
  // RUN-F F1 (2026-07-21) — multi-pilot operations console: N concurrent real pilots, honest empty
  // board, real-or-empty fix/activity, maturity gate (real TTFV + 3 real fixes), staged one-clicks only.
  "./f1-pilot-console.test.mjs",
  // RUN-B B6 (2026-07-01) — regression-sweep LOCK: RUN-B modules present, gates stay registered, honesty moat live, real-or-empty + inflated Trust pages stay deleted.
  "./b6-regression-sweep.test.mjs",
  // STAGE 3 S1 (2026-07-01) — Autonomous Resolution Engine, Confirmed mode only: plan schema +
  // hash-chained journal + executor loop (supervisor/countdown/tier-0 reused UNCHANGED) +
  // 3 authored playbooks. R11 check #1 at every new layer; goalProbe declares success, never steps.
  "./plan-schema.test.mjs",
  "./plan-journal-hashchain.test.mjs",
  "./plan-supervisor-midplan-veto.test.mjs",
  "./plan-rollback-reverse-order.test.mjs",
  "./plan-goalprobe-real-or-empty.test.mjs",
  "./plan-resume-after-reboot.test.mjs",
  "./plan-autonomy-ladder.test.mjs",
  "./plan-r11-and-killswitch.test.mjs",
  // STAGE 3 (ARE) FEEDS (2026-07-17) — PLAN-LEVEL autonomous-resolution rate computed FROM the hash-chained
  // plan journal (the sellable Stage-3 number; distinct grain from the chat "was this fixed?" deflection).
  // Real-or-empty + UN-INFLATABLE: only goalProbe-proven real-change PLAN.RESOLVED counts; no-op-neutral,
  // dry-run, pre-exec abort, interrupted, and any TAMPERED "resolved" are all excluded. Pure; frozen files untouched.
  "./plan-deflection.test.mjs",
  // STAGE 3 · F1 × FEEDS JOIN (2026-07-21) — the DURABLE autonomous-resolution feed for RUN-B B1 /
  // Stage-4. plan-deflection decides which runs are honest attempts; durability-ledger decides whether
  // the fix actually HELD through the quiet monitoring window. The headline counts only the intersection,
  // so a fix that came back can never be sold as a resolution. The join may only ever move the number
  // DOWN (asserted over all 162 durability-state combinations). Pure; frozen files untouched.
  "./plan-durability-feed.test.mjs",
  // WALK-THROUGH + WEB CTA + P1 (2026-07-02) — guided step-by-step tab (guide mode changes nothing) +
  // web deep-link mode=walkthrough + "Resolve it for me" never dead-ends at Control Center.
  "./walkthrough-tab-render.test.mjs",
  "./deep-link-walkthrough-mode.test.mjs",
  "./resolve-button-routing.test.mjs",
  "./web-walkthrough-cta.test.mjs",
  // WALK-THROUGH UNDER THE GLOBE (2026-07-14) — the tab is a launcher → Start opens the guided flow under the
  // floating globe + live-opens each target; the live-open never auto-enters credentials/pays (Rule 14 boundary).
  "./walkthrough-launcher.test.mjs",
  "./walkthrough-open-live.test.mjs",
  // WALK-THROUGH V2 AUTO-RUN (2026-07-16) — ARIA auto-opens the safe (non-hard-stop) allowlisted targets + auto-
  // advances display cards, and HALTS at every input/choice/copy + sign-in/account/pay hard-stop (Rule 14 boundary).
  "./walkthrough-autorun.test.mjs",
  // P5/P6/P7 (2026-07-14) — not-yet offers next steps + a real ticket ref surfaced in-app; answer concision toggle.
  "./chat-escalation-ticket.test.mjs",
  "./answer-concision-p7.test.mjs",
  // ARIA COMPANION (2026-07-02) — globe → interactive assistant; typed step engine collecting input; honest
  // Claude AI-setup (no invented price, user-click accounts); interactive Learn lessons.
  "./companion-shell.test.mjs",
  "./step-engine-input.test.mjs",
  "./ai-setup-claude-honest.test.mjs",
  "./learn-prompts-loops.test.mjs",
  // COMPANION GLOBE-BOX + VOICE (2026-07-02) — keep the globe (small card below it, not inset:0); on-device
  // tap-to-speak (STT) + calm female narration (TTS), both guarded, muteable, $0.
  "./companion-globe-box.test.mjs",
  "./companion-voice.test.mjs",
  // HELP SURFACES (2026-07-16) — public Technical Support FAQ built from the real KB (end-user-safe,
  // FAQPage JSON-LD) + Forums Concierge (auto-answer, honest abstain, $0) + Moderator (reversible tiers,
  // never hard-deletes) + the web KB-shaper mirror kept in parity with the canonical Sentinel shaper.
  "../../tests/support-faq.test.mjs",
  "../../tests/forums-concierge.test.mjs",
  "../../tests/forums-moderation.test.mjs",
  "../../tests/kb-answer-shape-parity.test.mjs",
  "./f2-conversion-digest.test.mjs",
  "./f3-acquisition-funnel.test.mjs",
  "./g1-demand-intake.test.mjs",
  "./g2-followup-cadence.test.mjs",
  "./g3-delivery-leverage.test.mjs",
  "./h1-proof-pack.test.mjs",
  "./h2-objection-ledger.test.mjs",
  "./h3-close-packet.test.mjs",
  "./i1-billing-handoff.test.mjs",
  "./i2-renewal-readiness.test.mjs",
  "./i3-revenue-truth-board.test.mjs",
  "./j1-deal-blocker-autopsy.test.mjs",
  "./j2-delivery-capacity-truth.test.mjs",
  "./j3-weekly-truth-digest.test.mjs",
  "./k1-payment-receipt-ledger.test.mjs",
  "./k2-time-to-first-dollar.test.mjs",
  "./k3-one-page-ask.test.mjs",
  "./l1-demand-to-ask-conveyor.test.mjs", // RUN-L L1 — demand-to-ask conveyor
  "./l2-repeatability-audit.test.mjs",   // RUN-L L2 — second-customer repeatability
  "./l3-pricing-floor.test.mjs",         // RUN-L L3 — honest pricing floor
  "./m1-ask-ready-queue.test.mjs",       // RUN-M M1 — ask-ready queue, ranked by real evidence
  "./m2-send-packet.test.mjs",           // RUN-M M2 — send packet, one click from sent
  "./m3-ask-ledger.test.mjs",            // RUN-M M3 — ask ledger, paid requires a real receipt
  "./n1-account-intake.test.mjs",        // RUN-N N1 — real-input intake path, M1's gate vocabulary
  "./n2-first-packet-pass.test.mjs",     // RUN-N N2 — end-to-end pass: a packet XOR a named gap list
  "./n3-ask-dashboard.test.mjs",         // RUN-N N3 — operator ask dashboard, zero reads as zero
  // RUN-O 2026-07-28 — the operator's first hour. One current entry point, one guided walk, one
  // generated ledger head. The drift lock in o3 is the teeth: AXIS status, operator brief and ledger
  // head are rendered from ONE normalised truth, and any disagreement between them turns this suite red.
  "./o1-operator-brief.test.mjs",         // RUN-O O1 — one current script, superseded marked in place
  "./o2-first-account-walk.test.mjs",     // RUN-O O2 — nothing to packet XOR named gaps, source-annotated
  "./o3-ledger-head.test.mjs",            // RUN-O O3 — one truth, three surfaces; history untouched

  // RUN-P 2026-07-28 — the first real ask. The last metre: a rendered artefact a human can put in
  // front of a named person, one gated staging moment, and a lock that keeps "staged" from ever
  // being read as "sent" on any surface.
  "./p1-rendered-ask.test.mjs",           // RUN-P P1 — every sentence traces to a record, or it is refused by name
  "./p2-ask-staging.test.mjs",            // RUN-P P2 — human-sendable artefact + staged row; sent is impossible from inside
  "./p3-staged-vs-sent.test.mjs",         // RUN-P P3 — staged and sent are separate numbers on all three surfaces
  "./q1-candidate-record.test.mjs",       // RUN-Q Q1 — a candidate records with named provenance per field; inference is refused by name
  "./q2-candidate-fit.test.mjs",          // RUN-Q Q2 — deterministic fit score that says "not established" instead of averaging around a hole
  "./q3-candidate-bridge.test.mjs",
  // RUN-R — the first hour spent outside the building.
  "./r1-hour-plan.test.mjs",
  "./r2-conversation-outcome.test.mjs",
  "./r3-conversations-held.test.mjs",       // RUN-Q Q3 — lossless bridge into N1 intake; candidates is a fourth distinct number on all three surfaces
  // RUN-S 2026-07-28 — the sequence that exists to move conversations held from 0 to 1.
  "./s1-quick-entry.test.mjs",              // RUN-S S1 — the one-minute entry path; Q1's refusals verbatim; no tracked/serveable write path
  "./s2-honest-opening.test.mjs",           // RUN-S S2 — the shortest honest opening, refusable; every unsupportable claim class refused by name
  "./s3-first-hour-loop.test.mjs",          // RUN-S S3 — R1->S1->S2->R2 in one walk; hours spent as the sixth number beside conversations held
  // RUN-T 2026-07-28 — the sequence that exists to make an hour actually get spent.
  "./t1-name-sources.test.mjs",             // RUN-T T1 — where the first names already are; every excluded source named with its reason
  "./t2-elapsed-since.test.mjs",            // RUN-T T2 — days-since with `never` distinct from zero; software progress cannot move it
  "./t3-staged-hour.test.mjs",              // RUN-T T3 — the hour staged (never scheduled); an unwalked hour is a finding, not a rollover
  // RUN-U 2026-07-28 — the counters read the mail. Built because RUN 110-129 published asksSent: 0
  // through a 41-send week: the counters read an internal log that outbound was never written into.
  "./u1-outbound-truth.test.mjs",           // RUN-U U1/U2 — mail-sourced counters; 0 vs never vs unverified; understatement named as a Rule 14 failure
  "./v1-warm-redirect.test.mjs",            // RUN-V V1/V2/V3 — ranked warm-redirect queue (expiry first-class), refusable second message (no transport), reply-rate as the sixth number
  // RUN-AJ / AJ2 2026-08-05 — the second-touch path walked END TO END against the real records:
  // record → queue → drafts → send sheet parity → ladder drafted→sent and no further → decline is a
  // reply and is never softened. The parts were green for cycles; the path through them never ran.
  "./aj2-second-touch-path.test.mjs",
  "./w1-first-answered-reply.test.mjs",   // RUN-W W1/W2/W3 — reply capture (`no reply yet` != 0 != unverified), one-way outcome ladder, surfaces that cannot claim an unevidenced rung
  "./x1-cost-of-delay.test.mjs",            // RUN-X X1/X2/X3 — rising cost of delay (software progress cannot lower it), the hour executable cold, two named blockers byte-identical on every surface
  "./a2-routing-battery.test.mjs",           // A2 (recovered) — 6-question routing battery against the REAL KB pack: 0 confidently-wrong, >=4/6 clean hits, out-of-scope abstains, master index never answers, vertical + intent guards each proven in both directions
  "./z1-second-hour.test.mjs",              // RUN-Z Z1/Z2/Z3 — waiting interval computed from real dates (can say "nothing today"), silence held without characterising intent or moving any ladder, and a repeat that is one-way across all hours and bounded at REPEAT_MAX with retirement stated
  "./y1-spent-hour.test.mjs",               // RUN-Y Y1/Y2/Y3 — operator-entered spent hour (`not spent` != 0 != unverified), change set empty when nothing moved, executed actions consumed and never re-ranked live
  "./aa1-unopened-week.test.mjs",           // RUN-AA AA1/AA2/AA3 — a gap of any length (7/30/200/400 days) renders no judgement, no streak, no exclamation and moves no rung or cost; one cold-executable re-entry page whose change set is a real difference and renders "Nothing changed while you were away." verbatim; a weekly roll-up that states the unmoved counts FIRST, keeps `nothing recorded` distinct from `recorded, nothing done`, and admits no software progress
  "./ac1-visit-log.test.mjs",              // RUN-AC AC1/AC2 — the first passive signal: the site's own first-party hit log, read by a module that can never turn an absent or not-yet-running log into a zero, refuses any count over a window reaching back before `startedAt`, rejects the whole record if a single identity-shaped key appears, excludes our own tooling from the headline, and flips `site-visits` to measurable ONLY on a genuinely observed record — leaving every other signal refused
  "./ab1-moves-without-us.test.mjs",      // RUN-AB AB1/AB2/AB3 — the whole mail record measured (45 sent, 4 undeliverable, 11 auto-replied, 1 personal reply, the rest silent-by-absence) with `delivered` refused as unobserved at every volume and no rate computed against it; the passive surface refused as the PRIMARY dated output with every unobservable signal named and no proxy promotable; and a two-column split where software progress — however rephrased — can never place an item in "moves on its own", which today is empty
  // REPRODUCIBILITY GUARD 2026-08-05 (flywheel 120) — the registry returns 504/0 on the operator's
  // machine and 453/51 from a clean clone of the SAME commit, every difference an ENOENT against the
  // gitignored /senior-director-state/ record root. That is a legitimate design choice, but it was
  // reported for several cycles as a plain green without saying the green was not reproducible.
  // This suite forces the dependency to stay DECLARED: a new hidden reader of untracked operator
  // records turns it red. It is green in both environments, because a bare clone is not a failure.
  "./record-dependency-declared.test.mjs",
  // ABSOLUTE-SYMLINK GUARD 2026-08-05 (flywheel 120) — a real defect found on the shared line, not a
  // hypothetical: two tracked symlinks pointed at a dead build sandbox's absolute path, were broken
  // everywhere else, and sat in the publish directory. Untracked in the same cycle; this keeps the
  // class from returning through git the way the emitter keeps it out of the status feed.
  "../../tests/no-absolute-symlinks.test.mjs",
  // AXIS JARVIS FLOW 2026-08-11 (cc/axis-jarvis-2026-08-11) — the persona, the wake-word turn flow and
  // the woman's-voice ranking, plus the additive guard: every voice behaviour the v1 console shipped
  // must still be present in axis-app.js (Rule 15). Registered BY HAND, because RUN-AW recorded that
  // this manifest does not pick up new files and a suite running green while the count stands still is
  // the same lie in a nicer shirt.
  "../../tests/axis-jarvis-flow.test.mjs",
  // RUN-CV / CV2 (2026-10-09, client-ready-flywheel) — the 14 site suites RUN-CU added, caught by
  // RUN-BW's census gate the moment the two lines were reconciled. Each was READ and run standalone
  // first (all pass: function-gates 81 checks, site-status-honesty 6, site-icons-present 4,
  // agent-preflight 8, the rest 1 each) — registered after reading, not bulk-parked.
  "../../tests/agent-preflight.test.mjs",
  "../../tests/aria-chat-voice-contract.test.mjs",
  "../../tests/aria-page-honesty.test.mjs",
  "../../tests/aria-sentinel-approval.test.mjs",
  "../../tests/aria-sentinel-notify.test.mjs",
  "../../tests/aria-voice-conversation.test.mjs",
  "../../tests/aria-web-session-id.test.mjs",
  "../../tests/ceo-approval-items-override.test.mjs",
  "../../tests/function-gates.test.mjs",
  "../../tests/notify-lib.test.mjs",
  "../../tests/refresh-scheduled-agents.test.mjs",
  "../../tests/site-icons-present.test.mjs",
  "../../tests/site-status-honesty.test.mjs",
  "../../tests/user-data-purge.test.mjs",
  // STAGE-3 ARE — packets landed by Cowork run 113 (2026-07-21). Registered here because each packet's
  // run-all patch was cut against an older anchor; the suites themselves are unmodified from the packets.
  "./escalation-decision.test.mjs",
  "./plan-boot-recovery.test.mjs",
  "./multi-hypothesis.test.mjs",
  "./unbound-recipe-walkthrough.test.mjs",
  "./plan-maintenance-window.test.mjs",
  "./goal-probe-grade.test.mjs",
  // RUN-CU / CU4 (2026-10-08, cc/run-cu-2026-10-08) — setup wizard v2 (identity, contacts, autonomy level,
  // approver, reports, maintenance window), the approval-policy truth table, the in-app + remote approvals
  // flow, content-blind notifications over the declared outbound class, evidence-derived compliance,
  // the local-bridge origin policy, the macOS user-level Tier-0 catalog, the CU4 safety fixes, and the
  // on-device voice conversation loop. Registered BY HAND (this manifest never picks up new files).
  "./setup-wizard-v2.test.mjs",
  "./approval-policy.test.mjs",
  "./approvals-flow.test.mjs",
  "./notify-channels.test.mjs",
  "./notify-dispatch.test.mjs",
  "./outbound-declared.test.mjs",
  "./compliance-evidence.test.mjs",
  "./bridge-auth.test.mjs",
  "./tier-0-darwin.test.mjs",
  "./safety-fixes-cu4.test.mjs",
  "./voice-turns.test.mjs",
  "./voice-conversation-ui.test.mjs",
  // (2026-10-09, reconciliation note) the same fourteen were registered a second time by the sandbox line
  // that merged RUN-BW independently; that duplicate block was removed when both lines became this one —
  // the RUN-CV / CV2 block above is the registration of record.
  // RUN-CU small-tasks close-out (2026-10-09) — five repo-root suites, registered BY HAND after each was
  // read and run standalone: the /health rewrite (task 1); the admin-gated GET read path on the three
  // capture endpoints, proven against an in-memory Blobs store (task 2); about.html meta/h2, the
  // areaServed-vs-copy-pack contract and the data-last-verified stamps (tasks 3/4/6); the sourced
  // October-13-2026 Microsoft support-date page, every figure pinned to a cited value (task 5); the
  // loops/agents kpis/tools_allowed shape (task 7). None reads the operator record root.
  "../../tests/netlify-health-redirect.test.mjs",
  "../../tests/capture-read-path.test.mjs",
  "../../tests/site-page-metadata.test.mjs",
  "../../tests/windows-10-esu-check-page.test.mjs",
  "../../tests/loops-agents-yaml-shape.test.mjs",
  // RUN-CU / CU6 (2026-10-09) — the CEO-critical ledger parser (one module reads CEO-CRITICAL-ITEMS.md;
  // the hourly digest puts its red block first; `node scripts/ceo-critical-items.mjs` prints it for any
  // chat). Fixture-only: the suite derives the default path from STATE_DIR and never opens the record root.
  "../../tests/ceo-critical-items-ledger.test.mjs",
  // RUN-CV / CV5 (2026-10-09; placed BEFORE the RUN-BX block so the vision suites stay last) — two fixes asked for repeatedly and never done. (A22) the opportunity
  // engine's IT/MSP fit filter: "Flight Deck Lighting", "Water Supply", "Tree Inventory", "Lightning
  // Protection" and "LiDAR" are parked with a written reason, MSP work is untouched, cameras/VoIP are
  // kept but capped and labelled, a human override beats every keyword, nothing throws on a bad item;
  // the worker's entry is guarded so importing it writes no state. (A6f) kb-pull paging that survives
  // 504s: the export gains an additive `offset` (proven against an in-memory store), the puller starts
  // at 300, halves with three jittered tries, fails loudly with the last status, stops after one page on
  // a cursor-less server, and writes the same files — proven against a node:http fixture on 127.0.0.1
  // and two end-to-end runs of the real script into a scratch root. Registered BY HAND after each was
  // read and run standalone (fit filter 11 checks, paging 13 checks). Neither opens the record root.
  "../../tests/opportunity-fit-filter.test.mjs",
  "../../tests/kb-pull-paging.test.mjs",
  // RUN-BX (2026-10-09, cc/run-cv-2026-10-09) — the census's 70 `register-pending` suites, each READ and
  // run standalone from this runner's cwd on a clean extract (all 70 exit 0 here; site `--all` 142/142),
  // then probed for the one thing a standalone run cannot show: whether `await import()` into THIS
  // process lets the runner finish. Fourteen reach a `process.exit(…)` on every clean extract (thirteen
  // close with `process.exit(fail ? 1 : 0)` or its equivalent; axis-windows-traps exits 0 on the
  // no-launchers branch that `.gitignore:80 *.ps1` makes every checkout take) and kill the importer
  // with exit 0 and no census — the exact false green this file exists to refuse —
  // so they stay in tests/suite-census-ledger.json as `exempt`, each with its line number, and three
  // more are exempt for reasons the ledger states (a Windows-only floor the module's cache cannot meet,
  // a real-feed freshness assertion that would deadlock the emit script, a vault root bound at module
  // load with a write path). The 53 below are the ones that could join honestly. Registered BY HAND.
  //
  // Desktop Stage-3 brain-audit batteries (same family as the run-113 packets above) and the AXIS
  // voice-in Phase-1 scaffold: severity-weighted escalation (high→1, medium→2, low→3; content-blind;
  // the flat-3 default preserved; composes with an unchanged buildEscalationDraft), the durability
  // ledger (content-blind/R11-safe signatures, a no-op is never a fix, 72 h recurrence climbs ONE rung
  // and caps at human, 24 h quiet = durable, deflection real-or-empty, real hash-chained journal
  // ingest), the restore point (earned before step 1 and verified by OUTCOME — the sequence number must
  // rise; silent no-op and throttle degrade honestly to journal-only, no fabricated id, revert never
  // automatic, R11 > kill-switch > not-required > dry-run > throttle). The hotkey suite is the Phase-1
  // CONTRACT (Super+Space default, a fallback, the exports, and `registerHotkey` throwing /stub/); its
  // own header says it ran standalone until Phase 1 ships — when it does, that throws-/stub/ line is
  // the one that must become the real test, and this registration is what will say so.
  "./escalation-severity.test.mjs",
  "./plan-durability-ledger.test.mjs",
  "./restore-point.test.mjs",
  "../axis/voice-in/tests/hotkey.test.mjs",
  // AXIS console — hearing and speaking (the 2026-08-11/12 transcripts, pinned): the wake word as the
  // browser actually transcribes it (access/axes/acts/exes), a turn that ends on silence not on a
  // breath with the whole transcript kept, the persona never bypassed by an empty first getVoices(),
  // a pinned voice that cannot hide a later persona change, the v2 dock carrying every v1 voice
  // behaviour, the globe growing while a turn is live and the login screen forgetting the last
  // session, what AXIS SAYS kept apart from what the dock SHOWS, and "One moment." never marked as a
  // repeat.
  "../../tests/axis-voice-hearing.test.mjs",
  "../../tests/axis-turn-taking.test.mjs",
  "../../tests/axis-voice-ready.test.mjs",
  "../../tests/axis-voice-pin.test.mjs",
  "../../tests/axis-voice-dock.test.mjs",
  "../../tests/axis-globe-voice.test.mjs",
  "../../tests/axis-presence-privacy.test.mjs",
  "../../tests/axis-speech-not-screen.test.mjs",
  "../../tests/axis-transcript-fixes.test.mjs",
  // AXIS console — understanding the operator and acting for real: AXIS's own replies reach the
  // director (not only the user's turns), a correction is never answered by a document matcher, the
  // 2026-08-12 microphone transcript's four faults each pinned, open/show/pull-up navigates (and meta
  // turns bypass every local answerer; the worker-prompt evidence-rule reading is NOT TAKEN off the
  // operator machine, by host-reading.mjs), "remove these items" removes rather than recites (board
  // declines commands; cancel_followup cancels the row AND its draft), the afternoon transcript
  // replayed until it executes, Waiting Reply "Delegate" reaching the follow-up engine, the
  // approve-hop executing only rail-safe items, Cowork/Claude Code reachable from how Ahmad talks,
  // the fleet reporting to AXIS and managed through a fixed roster, and AXIS speaking up on its own
  // with the machine-control rails intact. board-remove, intent-apply and remove-scenarios each set
  // AXIS_DB_PATH=':memory:' BEFORE their first import of scripts/lib/axis-db.mjs, whose DB_PATH binds
  // at module load — keep them ahead of any suite that imports that module for real, or the three
  // would open the real sales DB instead of memory.
  "../../tests/axis-conversation-memory.test.mjs",
  "../../tests/axis-conversation-tiers.test.mjs",
  "../../tests/axis-real-conversation.test.mjs",
  "../../tests/axis-assistant-behaviors.test.mjs",
  "../../tests/axis-board-remove.test.mjs",
  "../../tests/axis-remove-scenarios.test.mjs",
  "../../tests/axis-intent-apply.test.mjs",
  "../../tests/axis-inbox.test.mjs",
  "../../tests/axis-cowork-code-routes.test.mjs",
  "../../tests/axis-fleet-manage.test.mjs",
  "../../tests/axis-proactive.test.mjs",
  // AXIS brains, cost and the fleet's honesty: the cost cascade in order (vault/KB → agents →
  // subscription → the metered API last) with the write-back gate, brain errors that say what they
  // are ("credit balance too low" is not "busy") plus $0 local answers and hands-free re-arm, the
  // out-of-credit misdiagnosis when the local worker is simply down (its launcher readings are NOT
  // TAKEN off the operator machine — `*.ps1` is gitignored — by host-reading.mjs, exactly as
  // docs/AGENT-BOOTSTRAP.md §5 describes), research that cites or admits (two publishers for a
  // [FACT], retrieval failure → a stated gap, the vault note never overwriting, secrets refused), last
  // SUCCESS never last run, the queue duty (a jammed category gets no more of itself), and every due
  // date real or "no due date". axis-queue-steward is declared in record-dependencies.json (it reads
  // the record root on purpose and reports absence as a fact).
  "../../tests/axis-brain-cascade.test.mjs",
  "../../tests/axis-brain-fallback.test.mjs",
  "../../tests/axis-worker-offline.test.mjs",
  "../../tests/axis-researcher.test.mjs",
  "../../tests/axis-job-watchdog.test.mjs",
  "../../tests/axis-queue-steward.test.mjs",
  "../../tests/axis-priorities.test.mjs",
  // AXIS console — structure and source: every browser module parses the way the RUNTIME loads it
  // (ESM, after the raw-newline incident), the page order topbar → globe → deck with ONE AXIS
  // surface, the guards guarded (a source-grep assertion can never be satisfied by the comment that
  // explains it), and the public axis-state.json counts-only with named detail behind verifyAperture
  // (declared in record-dependencies.json: it names the record root in a leak pattern).
  "../../tests/axis-esm-parse.test.mjs",
  "../../tests/axis-overview-clearance.test.mjs",
  "../../tests/axis-blind-guards.test.mjs",
  "../../tests/axis-command-center.test.mjs",
  // RUN-AX2 / RUN-SN1 (2026-10-14): the situation model every AXIS brain reads (Toronto clock, honest
  // sources, CEO-ledger ranking) and the Netlify bundling guard (heavy external modules scoped per
  // function — the 3.2 GB-of-zips ENOSPC of 2026-10-13). Both are node:assert suites with no
  // process.exit, read on this extract: exit 0 standalone and clean under the one-process import.
  "../../tests/axis-situation.test.mjs",
  "../../tests/netlify-function-externals.test.mjs",
  // RUN-SN1 / F1 (2026-10-14): the DEPLOYED Sentinel handlers under in-memory Blobs + stubbed fetch —
  // store connection (connectLambda before getStore), v2 per-customer keys + v1 still resolving,
  // revocation unified, session-report gated, Stripe webhook scoped to sentinel_* tiers, fleet
  // endpoints (heartbeat/recipes/stop-codes/manifest), notify bound to the license record.
  "../../tests/sentinel-store-and-keys.test.mjs",
  "../../tests/sentinel-resolve-and-licenses.test.mjs",
  "../../tests/sentinel-session-report.test.mjs",
  "../../tests/sentinel-stripe-webhook.test.mjs",
  "../../tests/sentinel-fleet-endpoints.test.mjs",
  "../../tests/sentinel-notify-binding-and-contracts.test.mjs",
  // RUN-SN1 / F2 (2026-10-14): the main process made true on a real machine — consent-gated live
  // fixes (Tier-2 runs when a human initiated), honest elevation (UAC, needs-admin never "healthy"),
  // PNG tray art, version from package.json, first-tick watcher baselines, startup tamper grace,
  // the spawn budget, first-launch silence, policy.json loader, self-error quiet.
  "./fresh-install-resolve.test.mjs",
  "./needs-admin-matrix.test.mjs",
  "./tray-art.test.mjs",
  "./version-sync.test.mjs",
  "./watcher-baselines.test.mjs",
  "./startup-first-run.test.mjs",
  "./spawn-budget.test.mjs",
  "./first-launch-silence.test.mjs",
  "./policy-overlay-loader.test.mjs",
  "./self-error-quiet.test.mjs",
  // RUN-SN1 / F3 (2026-10-14): the renderer made honest and finishable — buy path + prices from one
  // source, 30-day trial copy that matches the code, fix outcomes described truthfully, real-or-empty
  // KPIs, customer surfaces clean of internal wording, the 4-screen quick setup, the Home lists; the
  // Playwright first-run harness skips with a clear line where Chromium is absent.
  "./renderer-first-run.test.mjs",
  "./pricing-surface-sync.test.mjs",
  "./trial-copy-matches-code.test.mjs",
  "./fix-outcome-copy.test.mjs",
  "./customer-content-clean.test.mjs",
  "./real-or-empty-ui.test.mjs",
  "./home-lists.test.mjs",
  "./setup-flow.test.mjs",
  "./copy-claims.test.mjs",
  // RUN-SN1 / F4 (2026-10-14): the customer build is an explicit allow-list derived from the import
  // graph (business-ops modules stay in the repo, not in the asar), the Windows packager wrapper,
  // version lockstep, sales copy == pricing-tiers, the binary host declared.
  "./customer-build-allowlist.test.mjs",
  "./package-win.test.mjs",
  "./version-lockstep.test.mjs",
  "./sales-copy-prices.test.mjs",
  "./publish-binary-host.test.mjs",
  // RUN-SN1 / F4 (repo root): /downloads + /plans Sentinel copy == pricing-tiers, the checkout states.
  "../../tests/sentinel-sell-pages.test.mjs",
  // RUN-SN1 / F2 round 2: the renderer/build requests wired in main — billing-aware checkout, watcher
  // status in state, kill switch stops, manual-mode globe clickable, window fits 1366×768, reports
  // folder IPC, signed-artifact names, live-fix counting only, device/key headers.
  "./round2-main-wiring.test.mjs",
  // 2026-10-14 (cc/sentinel-prod-2026-10-14): Autonomous mode's "advise three times, then act" rule —
  // the pure escalation machine (cadence, choices, kill, freeze, restart resume), then the REAL
  // main.mjs driven on a simulated Windows machine (tests/lib/fault-lab.mjs): every catalogued fault
  // down the no-answer path, every person choice, every mode × trust level (writes
  // docs/MODE-BEHAVIOUR-MATRIX.md), and a 200-sequence seeded soak with invariants.
  "./advisory-escalation.test.mjs",
  "./fault-lab-autonomous.test.mjs",
  "./fault-lab-modes.test.mjs",
  "./fault-lab-soak.test.mjs",
  // …and its surfaces, fed main's REAL notices: the globe card (Notice n of 3 + Fix now · Not now · Never for this),
  // the Home "What I need from you" rows, the ARIA chat line, Settings → Autonomy, the content-blind bridge slice.
  "./advisory-ui.test.mjs",
  // …and the REAL-Windows lab an operator runs on a test machine (scripts/fault-lab.ps1 + scripts/fault-lab-run.mjs,
  // docs/FAULT-LAB.md): what can be proven without Windows — one catalogue, a script that cannot touch the network /
  // DNS / registry / clock / default apps / startup types, the guard read at run time, and the verdict logic.
  "./fault-lab-run.test.mjs",
  // The commercial surface, audited end to end and proven RED FIRST on fixtures: the response-time
  // promise (BE1), the price a stranger is quoted (BF1), the tier vocabulary (BF2), the amount a buyer
  // is actually charged (BI2), the document a conversation ends in (BL1), the intake nobody keeps
  // (BM1), one plan name across the card and both Schedules (BP3), and the Stripe staged-price
  // contract (env-only price ids, subscriptions for recurring tiers, site prices = pricing-tiers.mjs).
  // None picks which surface moves and none forecasts anything (Rules 14 and 15).
  "../../tests/response-time-consistency.test.mjs",
  "../../tests/price-consistency.test.mjs",
  "../../tests/tier-registry.test.mjs",
  "../../tests/chargeable-amounts.test.mjs",
  "../../tests/quote-inputs.test.mjs",
  "../../tests/quote-intake.test.mjs",
  "../../tests/plan-name-consistency.test.mjs",
  "../../tests/stripe-price-staging.test.mjs",
  // Repository hygiene gates: every asset parses before any regex suite is believed (BG0), every
  // scripts/, netlify/ and root-level script passes `node --check` (DEFECT-106), every internal-looking
  // root file or directory is force-404'd because the publish dir is `.` (run 145), no suite takes a
  // scratch directory without the probe and the printed fix is one that runs (BH2, BL3), the branch
  // reference is the one this checkout resolves to and never a cached pointer (BL2), the visit beacon
  // is incapable of carrying identity (AC2), and the "Hello ," merge bug hard-fails (#27).
  "../../tests/asset-parse-gate.test.mjs",
  "../../tests/script-syntax-gate.test.mjs",
  "../../tests/root-serving-gate.test.mjs",
  "../../tests/scratch-floor.test.mjs",
  "../../tests/scratch-substitution.test.mjs",
  "../../tests/branch-reference-consumers.test.mjs",
  "../../tests/ac2-visit-beacon.test.mjs",
  "../../tests/outreach-merge-guard.test.mjs",
  // ARIA web vision (STAGE 2 acceptance, offline, $0): the real retriever over the real KB diagnoses a
  // known screenshot, abstains on a low-confidence image, redacts PII/secrets before querying, and
  // honours the consent gate; the aria-vision-diagnose function end to end with a stubbed KB fetch.
  // 2026-10-09: the audit endpoint's cron list must equal the real config.schedule values.
  "../../tests/scheduled-tasks-audit-matches-config.test.mjs",
  // LAST on purpose: the handler suite deletes ANTHROPIC_API_KEY and ARIA_VISION_MODEL from this
  // process's env and does not put them back, so nothing may run after it.
  "../../tests/vision-diagnose.test.mjs",
  "../../tests/vision-diagnose-handler.test.mjs",
];

// RUN-BJ / BJ1 (2026-08-12) — THE FLOOR THIS RUNNER NEVER HAD.
//
// Measured this cycle, on a tree whose code was not touched: this registry read 1047 pass / 27 fail,
// and every one of the 27 was `ENOSPC: no space left on device, mkdtemp` against the volume
// `os.tmpdir()` points at. Not one was about the code under test. The SAME tree at the SAME commit
// read 1074 pass / 0 fail with nothing changed but the directory the fixtures were handed.
//
// The remedy already existed and this runner was simply outside it. RUN-BC pinned a path, RUN-BE
// extracted `scripts/lib/scratch-dir.mjs`, and RUN-BF made the SITE runner own the floor so no suite
// had to opt in — which is why the site suite stayed green all cycle while this one flickered. The
// gap RUN-BG recorded and deferred ("35 suites call os.tmpdir() directly and bypass the probe") is
// closed here the same way, at the runner, rather than in 35 files: suites are imported INTO this
// process, so `os.tmpdir()` re-reads these variables at call time and every existing caller is
// covered without editing one of them.
//
// It sets the variables rather than asking suites to read a new one, because a remedy each caller
// has to remember only works on the callers that remembered — that is exactly why this red survived
// three cycles of fixes aimed at it.
//
// `makeScratchDir` is IMPORTED, never re-implemented: it probes write AND remove before returning,
// which matters because this environment has volumes that accept a write and refuse `unlink`, and a
// fixture that runs `git commit` needs to remove a file. If no candidate accepts a write it throws,
// and throwing is correct — a registry that measures against a volume silently dropping data would
// report a health it has not got (Rule 14).
const { makeScratchDir } = await import("../../scripts/lib/scratch-dir.mjs");
const SCRATCH = makeScratchDir("sentinel-registry-");
process.env.TMPDIR = SCRATCH;
process.env.TEMP = SCRATCH;
process.env.TMP = SCRATCH;
process.env.AXIS_SCRATCH_DIR = process.env.AXIS_SCRATCH_DIR || SCRATCH;

const bail = process.argv.includes("--bail");
const results = [];
for (const spec of TESTS) {
  try {
    await import(spec);
    results.push({ spec, ok: true });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    // RUN-BV: the ERROR OBJECT is kept, not only its message. `err.code` is what tells a missing
    // package apart from a module that threw while evaluating, and stringifying first threw it away.
    results.push({ spec, ok: false, err: msg, error: err });
    if (bail) { console.error(`✗ ${spec}\n${(err && err.stack) || err}`); process.exit(1); }
  }
}

const loadReds = results.filter((r) => !r.ok);

// 2026-07-28 (Cowork run 126) — THE HARNESS COULD HIDE A RED, AND DID.
//
// `await import(spec)` resolves when a module finishes EVALUATING. A node:test file only REGISTERS
// its tests during evaluation; the assertions run afterwards, on a later turn of the event loop, and
// a failure surfaces by setting `process.exitCode` — it never throws back into this try/catch. So the
// old summary printed "N/N suites green" BEFORE a single assertion had run, and two genuinely failing
// suites were reported as green in the same breath. That is exactly the fabricated-metric class
// Rule 14 forbids, produced by our own test harness.
//
// The summary is therefore deferred to `beforeExit`, which fires only once the event loop has
// drained — i.e. after every registered test has actually run and recorded its verdict. The count is
// folded together with `process.exitCode` so an assertion failure can never again be summarised away.
// Load failures are still reported separately, because "did not load" and "loaded and failed" are
// different facts and collapsing them would hide which one happened.
// RUN-BV 2026-10-08 — THE DENOMINATOR COULD SHRINK WITHOUT SAYING SO, AND DID.
//
// The block above fixed a harness that reported green before its assertions ran. It left a second,
// quieter version of the same lie: `${total}/${total} suites green`, where `total` is however many
// suites we got to. That expression can only ever print N/N — it asserts nothing. This cycle a clean
// clone of the shared line reported `# tests 1086 · # fail 0` because two suites could not load
// (`@netlify/blobs`, a package THE ROOT MANIFEST ALREADY DECLARES, simply was not installed). One
// npm install later the identical tree on the identical commit reported `# tests 1103 · # fail 0`.
// Seventeen assertions were never attempted, `# fail 0` was true both times, and the only trace of
// the difference was two lines of stderr near the top of a forty-second log.
//
// So the verdict now comes from `scripts/lib/suite-census.mjs`, which holds two facts apart that
// were being collapsed:
//
//   * a suite that LOADED and failed  -> RED. The source is wrong.
//   * a suite that could not load because a DECLARED package is absent -> INCOMPLETE. Unjudged.
//
// Both exit non-zero. Neither is ever called green. INCOMPLETE names the package, the manifest that
// declares it, and the install command, so an operator is not sent hunting for a defect that is not
// there — and a suite whose missing package NO manifest declares stays RED, because something
// importing what nothing installs is a real defect.
//
// `registered` is TESTS.length — what we were asked to run — and is kept separate from what we
// achieved, so the printed fraction can actually be wrong and therefore actually means something.

// Imported in the same dynamic style the rest of this file uses — the suite list above must stay the
// first thing a reader meets, so nothing is hoisted to the top of the file.
const fs = await import("node:fs").then((m) => m.default);
const path = await import("node:path").then((m) => m.default);
const { fileURLToPath } = await import("node:url");
const { takeCensus, censusReport } = await import("../../scripts/lib/suite-census.mjs");

/** package name -> the manifest (repo-relative) that declares it. Read once, from the real tree. */
function declaredPackagesFrom(repoRoot, manifestPaths) {
  const declared = {};
  for (const rel of manifestPaths) {
    const abs = path.join(repoRoot, rel);
    try {
      const pkg = JSON.parse(fs.readFileSync(abs, "utf8"));
      const names = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      for (const name of names) if (!(name in declared)) declared[name] = rel;
    } catch {
      // An unreadable manifest declares nothing we can prove. Every package then classifies as a
      // defect rather than as an environment gap — the safe direction: it over-reports red, never green.
    }
  }
  return declared;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DECLARED_PACKAGES = declaredPackagesFrom(REPO_ROOT, ["package.json", "ARIA Sentinel/package.json"]);

let summarised = false;
process.on("beforeExit", () => {
  if (summarised) return;
  summarised = true;
  const assertionsFailed = process.exitCode !== undefined && process.exitCode !== 0;
  const census = takeCensus({
    registered: TESTS.length,
    loadFailures: loadReds.map((r) => ({ spec: r.spec, err: r.error !== undefined ? r.error : r.err })),
    assertionsFailed,
    declaredPackages: DECLARED_PACKAGES,
  });
  const report = censusReport(census).join("\n");
  if (census.verdict === "green") {
    console.log("\n" + report);
    console.log("ARIA Sentinel test suite passed.");
  } else {
    console.error("\n" + report);
  }
  process.exitCode = census.exitCode;
});
if (bail && loadReds.length) process.exit(1);
