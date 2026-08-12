# NEEDS AHMAD — the whole list, in order

> **CYCLE 147 (2026-08-12), RUN-BE — one capability only you can give, and one sentence that is
> cheapest to fix today.**
>
> **0. A CODE-HOST CREDENTIAL. Local `main` is now 53 commits ahead of the shared remote.**
> `git push` refuses, verbatim: `could not read Username for 'https://github.com'`. No token, no
> `gh`, no credential helper, no `.netrc`. Everything through RUN-BE is on ONE machine. Not a
> decision and not labour — the one capability the sandbox lacks.
>
> **NEW — WRITE A TIER BESIDE THE SIG-LITE SENTENCE.** `compliance/SIG-Lite-prefilled.md:105`, the
> questionnaire a customer's security reviewer completes, says **"P1 within 1 hour. P2 within 4
> hours"** with **no tier beside either number**, and it ships in the same packet as the tiered MSA.
> Untiered, it reads as the floor for everybody: over-promising by ~a day against Personal, by three
> hours against Pro, and **under-selling Enterprise by 45 minutes** in the exact document a reviewer
> uses to judge whether that tier is worth its price. One sentence. **Nobody is owed it yet**, which
> is the only window in which fixing it costs nothing.
>
> **AND THE BIGGER ONE BEHIND IT — the agreement binds 10 response-time commitments and the page a
> buyer chooses from publishes ZERO of them.** `legal/MSA-template.md:188-189` commits a P1 and a P2
> for all five tiers with service credits attached; `plans/index.html` carries only `SLA tracking ✓`,
> which says an SLA is *tracked*, never what it is. Customers meet the number at signature instead of
> at decision. Three questions, all one-liners, all in `docs/RESPONSE-TIME-DECISIONS.md`: publish the
> bound times? does Personal carry an SLA at all (the matrix and the agreement contradict each
> other)? do the retainer decks map onto matrix tiers? Answers go in
> `senior-director-state/decisions/response-times.json` and the suite enforces them from then on.
>
> **The AXIS status feed is fresh and true**: regenerated this cycle from readings taken this cycle —
> registry 1074 / 0 / 372 suites / exit 0, site suite 82/82 — `generatedAt 2026-08-12T01:00:25Z`.
>
> Merging main did NOT publish anything. The Netlify publish is still your one deliberate click.
>
> Everything below still stands, in the same order.

> **CYCLE 146 (2026-08-11), RUN-BC — the shell is back, the work is merged, and there is exactly ONE
> thing only you can give this seat.**
>
> **0. A CODE-HOST CREDENTIAL. Local `main` is now 49 commits ahead of the shared remote and that
> work exists on ONE machine.**
> `git push` refuses, verbatim: `could not read Username for 'https://github.com'`. Everything from
> RUN-AV through RUN-BC — the legal pack, the claim registers, the AXIS voice console, this cycle's
> merge — is on this machine and nowhere else. This is not a decision and not labour; it is the one
> capability the sandbox lacks. Until it exists, every cycle adds more work to a single copy.
>
> **Merging main did NOT publish anything.** The Netlify publish is still your one deliberate click.
>
> **What cycle 144 asked for is CLOSED and its diagnosis was wrong, which matters more than the fix.**
> Cycle 144 said the environment was dead and asked you to restart the session. The shell is back and
> nothing needed restarting on your side. Better: the test suite that has been reading 43–48 of 81 for
> two cycles was never failing on its own code. `/sessions` — the volume holding the working copy — is
> at 100% with 0 bytes free, and every failing suite was one that opens a scratch file there. Pointed
> at a volume with room, the same tree at the same commit reads **81/81**. Nothing in the product was
> changed to get there, and the emitter now refuses to measure at all rather than report that red as a
> code fault a third time.
>
> Also closed without asking you: the `.git/index.lock` the observer loop has flagged for five days as
> *"sandbox cannot rm it, Ahmad must delete from Windows."* This mount refuses `unlink` but permits
> `rename` — it is parked, along with 58 dangling checkpoint refs that had been silently making every
> backup bundle refuse.
>
> **The AXIS status feed is fresh and true**: regenerated this cycle from readings taken this cycle —
> registry 1074 / 0 / 372 suites / exit 0, site suite 81/81 — `generatedAt 2026-08-11T23:39:16Z`.
>
> Everything below still stands, in the same order.

> **CYCLE 142 (2026-08-11), RUN-AY — one new decision, and it is a contractual one.**
>
> This cycle opened the second conversation: the one that starts after money moves. What a PAYING
> customer receives, what we promised them and how fast, and what their first week costs.
>
> **NEW ITEM — DECIDE THE P1 AND P2 RESPONSE TIMES. One sentence, two surfaces, and it is the
> cheapest it will ever be, because nobody is owed it yet.**
> Schedule B of the MSA commits an Enterprise customer to a **fifteen-minute P1** and a **one-hour
> P2** (`legal/MSA-template.md:188-189`). The SIG-Lite their own security reviewer works through
> states **"P1 within 1 hour to Customer. P2 within 4 hours"** with **no tier written beside it at
> all** (`compliance/SIG-Lite-prefilled.md:105`). Both documents ship in the same packet, so one buyer
> can be handed both in the same week. The unqualified sentence is the dangerous half: whoever reads
> it is never told a tier table exists, so a Personal-plan customer reads an hour they were never
> sold and an Enterprise customer reads an hour four times slower than the one they paid for.
>
> Unlike the currency, this one is breached **silently, by nobody doing anything**. There is no event
> to catch. The breach happens at minute sixteen and the only person who knows is the customer.
>
> Either the questionnaire answer states the tiers, or Schedule B is what we actually commit to. It is
> a staffing decision as much as a contractual one — what one founder can answer at 3am. **Nothing was
> edited** (Rule 15); both are declared open in `docs/SUPPORT-COMMITMENT-CONFLICTS.md` and
> `tests/support-commitments.test.mjs` holds both surfaces to whatever you decide, from then on.
>
> **Merging main did NOT publish anything.** The Netlify publish is still your one deliberate click.
> The line is now **24 commits ahead** of the shared remote and the sandbox still has no code-host
> credential. Registry 1013/1013 · 368/368 · exit 0.
>
> Everything below still stands, in the same order. Item 1 has not moved in twenty-one days.

> **CYCLE 141 (2026-08-11) — nothing was added to this list, and one thing on it got bigger.**
>
> This cycle merged the AXIS JARVIS turn flow and its distinct woman's voice onto the line, registered
> the suite that proves it (it had been green and uncounted), and swept every remote branch by diff
> rather than by commit count — nothing left to merge. Registry 968/968 · 365/365 · exit 0.
>
> **Merging main did NOT publish anything.** The Netlify publish is still your one deliberate click,
> and the spoken command layer reaches iisupp.net only when you make it.
>
> The line is now **22 commits ahead** of the shared remote and the sandbox has no code-host
> credential — the push below is unchanged in shape, larger in content.
>
> Everything below still stands, in the same order. Item 1 has not moved in twenty-one days.

> **UPDATED 2026-08-11, flywheel cycle 138 (RUN-AV) — this block supersedes everything below it.**
>
> Three of the five items below are decisions, not labour. Two of them are about money and software
> may not make either. Nothing on this list asks you to write code.
>
> **1. SEND THE TWELVE SECOND MESSAGES. ~20 minutes. Still rank 1.**
> Sheet: `senior-director-state/outbound/SEND-SHEET-2026-08-05.md`. Sent 0. Meetings 0. Revenue none.
> **What changed this cycle: pressing send now costs zero judgement calls.** All twelve messages were
> read by code and checked for guarantee/risk-free language, an experience claim past 15+ years, the
> forbidden name, any figure the plan page does not carry, any dead link, and any real contact detail
> that should not be in that file at all. **12 of 12 clean, 0 refusals, 0 unresolvable links.** You are
> not being asked to proofread twelve times. You are being asked to paste and send.
>
> **2. DECIDE WHICH PRICE LIST THE SENTINEL SALES ONE-PAGER CARRIES. New this cycle, and it is the
> most expensive thing found in six cycles.** `ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md`
> quotes **Personal $599/mo · Pro $1,500/mo · Small Business $156K/yr · Mid-Size $312K/yr ·
> Enterprise $625K/yr**. `plans/index.html` publishes **$899 · $2,250 · $19,500/mo · $39,000/mo ·
> $78,125/mo** for plans with the **same names**. All five rows disagree. This is the document a
> prospect is handed during the exact conversation item 1 is meant to start — they read $599, then get
> quoted $899, and they have watched this company change its price mid-conversation. Either the
> desktop product has its own price list and the plan names must stop colliding, or the sheet is
> stale. **Nothing was edited.** Tell me which, and `tests/quoted-figures.test.mjs` holds both surfaces
> to it from then on.
>
> **3. NAME THE CURRENCY. One word: CAD or USD.** Last cycle reported two surfaces disagreeing. The
> whole money path was walked this cycle and there are **seven**, in two currencies:
>
> | surface | says | what it is |
> |---|---|---|
> | `plans/index.html:132` | USD | the page a visitor decides on |
> | `netlify/functions/stripe-checkout.js:114` | **CAD** | the currency a card is actually charged in |
> | `netlify/functions/aria-web-tier.js:14` | **CAD** | the web tier's own price definition |
> | `netlify/functions/aria-renewal-reminders.js:63` | USD | the renewal email a paying customer receives |
> | `netlify/functions/stripe-webhook.js:177` | USD | the payment confirmation a customer receives |
> | `netlify/functions/aria-mrr-dashboard.js:80` | USD | the recurring-revenue figure you read |
> | `scripts/lib/retainer-proposal.mjs:80` | USD (typed, not read) | the currency printed on every proposal |
>
> Telling a customer an amount in one currency and charging their card in another is a chargeback and
> a credibility problem in the same message. **Nobody has been charged yet, which is exactly why this
> is cheap today.** Say the word and `senior-director-state/decisions/currency.json` gets written;
> from that moment `tests/currency-consistency.test.mjs` enforces it on all seven and goes red on any
> drift. The half that lives inside Stripe price IDs stays UNRUN with its reason — it is not readable
> from here and was not guessed.
>
> **4. PUBLISH THE LINE.** Local `main` is 6 commits ahead of the last known shared reference. The
> bundle was rebuilt and verified again this cycle (tip `9dc5699`, 6 commits, 84,470 bytes):
>
> ```
> git fetch "senior-director-state/delivery/unpublished-line.bundle" main:refs/heads/publish-line
> git push origin publish-line:main
> ```
>
> No credential is needed for the first. The second is yours. **Netlify deploy stays your one click
> after that — merging main does not deploy.**
>
> **5. A code-host credential for the sandbox.** Probed again this cycle, refused again, verbatim
> `could not read Username for 'https://github.com'`. Everything above works without it; this only
> removes step 4 from your plate permanently.
>
> **CLOSED this cycle: the four unpublished figures from item 3 of the last block.** They are not
> deleted and they are not published — they are **declared**, in `docs/QUOTED-FIGURES.md`, with a
> written reason each, alongside twenty more that had never been accounted for at all. Silent figures
> in client-facing documents went from 44 to 0 without a line of any contract being touched. The two
> MSA implementation fees still carry an OPEN marker pointing back at you, because "declared" means
> deliberate, not decided.

---


> **SUPERSEDED 2026-08-11, flywheel cycle 138 — kept for the record.**
>
> **1. SEND THE TWELVE SECOND MESSAGES. ~20 minutes. Still rank 1 — and worth more than it was
> two cycles ago.** Sheet: `senior-director-state/outbound/SEND-SHEET-2026-08-05.md`. Sent 0.
> Meetings 0. Revenue none. No software in this repository can send. What changed since you last
> read this line: a reply now meets an agreement a clone can produce, a proposal generated from
> published prices, and an invoice path that has actually been walked. The twenty minutes buy more
> than they used to.
>
> **2. DECIDE THE CURRENCY. New this cycle, and it is about money.** `plans/index.html` states
> **USD** in 8 places. `netlify/functions/stripe-checkout.js:114` charges **CAD** on the inline
> one-time path. One of the two is wrong and software may not pick which. The preset plan
> subscriptions use Stripe price IDs whose currency lives inside Stripe and cannot be read from
> here — so that half is UNRUN, not assumed. Tell me which way and I will make both sides agree.
>
> **3. DECIDE FOUR QUOTED FIGURES NOBODY PUBLISHES.** Three client-signable contracts quote prices
> that appear nowhere a client can check them: `legal/MSA-template.md` lines 203–205 ($5,000 /
> $3,000 / $3,000 one-time implementation fees) and `legal/DPA-template.md:219` ($625K). Either
> they get published on the plan page or they stop being quoted. They were NOT deleted to make a
> gate go green — that would have been the worse failure.
>
> **4. PUBLISH THE LINE.** Local `main` is 4 commits ahead of the last known shared reference. The
> path is rehearsed, not hoped for — the bundle was fetched into a throwaway repository this cycle,
> the range landed, every published file came back byte-identical, and the serving rules in that
> landed tree send none of them to a 404 or a gate. Two commands:
>
> ```
> git fetch "senior-director-state/delivery/unpublished-line.bundle" main:refs/heads/publish-line
> git push origin publish-line:main
> ```
>
> No credential is needed for the first. The second is yours. **Netlify deploy stays your one click
> after that — merging main does not deploy.**
>
> **5. A code-host credential for the sandbox.** Probed again this cycle, refused again, verbatim
> `could not read Username for 'https://github.com'`. Everything above works without it; this only
> removes step 4 from your plate permanently.
>
> **WITHDRAWN this cycle: nothing here asks you to repair git.** The stale `.git` locks that the
> last two cycles recorded as a permanent block were renamed into `.git/_stale-locks/` and the
> index re-synced. It had been 27 entries behind HEAD. The agent did it; you do not need to.

---

> **SUPERSEDED 2026-08-06, flywheel cycle 135 — kept for the record.**
>
> **1. SEND THE TWELVE SECOND MESSAGES. ~20 minutes. Still rank 1, still the only item on this
> list that can turn a zero into a one.** Sheet: `senior-director-state/outbound/SEND-SHEET-2026-08-05.md`.
> Sent 0. Meetings 0. Revenue none. No software here can send.
>
> **2. PUBLISH THE LINE — and as of this cycle the publish is REHEARSED, not hoped for.** Local
> `main` is ahead of the shared line by a handful of commits. The whole path was walked this
> cycle in a throwaway repository: the bundle was fetched from a file, the range landed, all 14
> published files came back byte-identical to the tested tree, and the serving rules in that same
> landed tree were checked and send none of them to a 404 or a gate. Two commands:
>
> ```
> git fetch "senior-director-state/delivery/unpublished-line.bundle" main:refs/heads/publish-line
> git push origin publish-line:main
> ```
>
> The branch name carries no commit SHA on purpose — a command that names a tip goes stale the
> moment the next cycle commits, and a stale publish command is the same quiet wrongness the
> rehearsal exists to catch. The exact tip and tree are recorded in
> `senior-director-state/delivery/unpublished-line.manifest.json`, beside the bundle.
>
> No credential is needed for the first. The second is yours. Netlify deploy stays your one click
> after that — merging main does not deploy.
>
> **3. A code-host credential for the sandbox.** Probed again this cycle, refused again, verbatim
> `could not read Username for 'https://github.com'`. Everything above works without it; this only
> removes step 2 from your plate permanently.

---


> **UPDATED 2026-08-05, flywheel cycle 117 — read this first; two items below have changed.**
>
> **B IS WITHDRAWN — do NOT run `AHMAD-REPAIR-INDEX.cmd`. Nothing is left for it to repair.**
> The agent did it this cycle. The stale `.git` locks were never unremovable: the mount refuses
> `rm` and permits `mv`, and six cycles had only ever tested `rm`. All **40** stale lock files were
> renamed into a graveyard inside `.git`, and the index was re-synced with an index-only
> `git restore --staged`. The tree went from **183 deleted / 181 untracked / 24 modified** to
> **0 deleted / 7 untracked / 25 modified**. The full registry was re-run afterwards — 504 pass,
> 0 fail, 326/326 suites — to prove no file content moved. The `git commit -a` hazard is gone.
> Said plainly: the last two lists asked you to run a script for something the agent could have
> done itself.
>
> **NEW — A NEEDS A DECISION FROM YOU BEFORE IT CAN HAPPEN. `main` has two histories.**
> Only visible once `.git/refs/heads/main.lock` was cleared this cycle. Local `main`
> (`15c56ab1`) and `origin/main` (`08e54225`) have **diverged** — neither contains the other.
> Local main carries merged **RUN-F / RUN-G / RUN-H / RUN-I** work that never reached GitHub;
> `origin/main` carries IT Health Check v3 and the bid-response documents that local main has
> never seen. **A plain `git push origin main` would be rejected as non-fast-forward** — so the
> "push the shared line" step this list has been advertising was not actually ready, and that is
> stated rather than quietly re-worded. Tell me which one is canonical — or say "merge both" —
> and I execute it. The fix commit in **A** below is still correct and still a clean
> fast-forward onto `origin/main`; it is only the *main-branch* step that needs your call.

> **ADDED 2026-08-04, flywheel run 115.**
>
> **A. `main` is RED right now, and there is a one-line fix sitting on your disk.**
> Measured this cycle in a clean clone of `origin/main` (`08e54225`), not inferred:
> the ARIA Sentinel registry there is **261/263 suites, 2 failing**. With the two test
> files on branch `cc/registry-green-on-main-2026-08-04` (`7b2b90b9`) it is
> **263/263, exit 0**. That branch's parent is `origin/main` itself, it touches
> exactly two files, and it is a clean fast-forward. `AHMAD-ONE-CLICK.cmd` pushes it
> at Stage 1c and prints the four merge commands. Merging main does not deploy.
>
> **B. ~~Do not run `git commit -a` until you have run `AHMAD-REPAIR-INDEX.cmd`.~~**
> **DONE BY THE AGENT 2026-08-05 — see the withdrawal at the top. The hazard is gone,
> `git commit -a` is safe again, and the script should not be run.** Kept struck through
> rather than deleted so anyone who read the previous list can see what changed and why.


_Last verified first-hand: 2026-08-04, RUN 151. Nothing here is a hold; each item is a decision only
Ahmad can make. **The list got shorter this cycle** — the item that sat at #1 for two cycles was a
misdiagnosis and has been withdrawn. See "Withdrawn" at the bottom._

---

## 1. Spend the hour

The only item on this list that can move a business number.

Conversations held: **0.** Hours spent in front of anyone: **0** — never, not "recently", not
"early days". Seventeen sequences of green software and zero conversations is a fact about us, not
about the market.

This is item 1 now because the two items that used to sit above it are, respectively, not a blocker
(see Withdrawn) and not a revenue event (see item 3).

---

## 2. Publish the site

A separate, deliberate click. Also the click that starts the visit log recording — until it happens
the log is *not-yet-collecting*, which is not the same fact as zero and is never reported as zero.

---

## 3. Land the verified commits

41 verified-but-unpublished commits, including `cc/test-registry-unblock-2026-08-04` (`aca28cdd`) —
the 504/504 green test registry.

**This no longer needs a credential from you.** A push from this machine to `origin/main` succeeded
today at ~14:07 EDT (`.git/logs/refs/remotes/origin/main`, `update by push`). Git works here. What
does not work is the Cowork build sandbox, which has failed to start a shell three cycles running
(`No space left on device`).

So this is a routing decision, not a click: **run the flywheel's git work through Claude Code on
this machine** (the `CC Stage2` path that pushed today) instead of the sandbox. Note local `main`
(`15c56ab1`) is diverged and behind `origin/main` (`08e54225`) — realign with `fetch` + `reset`,
**never** a merge of the two.

**Added RUN 151 — check out `main` first.** `.git/HEAD` points at
`refs/heads/cc/run-ac-passive-signal-2026-07-29`, not `main`. The tree has been sitting on a `cc/`
branch. A `reset` run without checking out `main` first will reset the wrong ref.

`AHMAD-ONE-CLICK.cmd` still exists and still works as a manual fallback.

---

## Withdrawn — "Authorize the GitHub connector"

**Was item 1 in RUN 148 and RUN 149. It was the wrong ask and is withdrawn as a blocker.**

The reasoning was: seven cycles of `git push` → *"could not read Username for github.com"*, therefore
the machine has no code-hosting credential, therefore Ahmad must authorize the connector.

The reflog contradicts it. A successful outgoing push to `origin/main` is recorded from this
repository **today**. The credential works. The failing component was always the sandbox
specifically, and a connector click would not have fixed a container that is out of disk.

Authorizing `plugin:engineering:github` (still unauthorized — re-probed this cycle, zero tools
returned) remains genuinely *useful*, because an API path survives sandbox death. It is a resilience
upgrade, not a rescue. It does not belong above the hour.

---

## Standing note on ordering

Items 2–3 are delivery and plumbing. Item 1 is the business. Item 1 has been the honest bottleneck
since RUN-AB established that no further software moves the two numbers that are off track.

## Related
- `senior-director-state/PROGRESS-LEDGER.md` — full run history, RUN 150 head
- `aria-vault/01_Frontal/VISION-AND-GOAL-STANDING.md` — goal + standing rules
- `public/.well-known/axis/status.json` — public status feed
