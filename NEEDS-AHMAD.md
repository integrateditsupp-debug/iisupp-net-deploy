# NEEDS AHMAD — the whole list, in order

> **UPDATED 2026-08-06, flywheel cycle 135 — this block supersedes the dated notes below it.**
>
> **1. SEND THE TWELVE SECOND MESSAGES. ~20 minutes. Still rank 1, still the only item on this
> list that can turn a zero into a one.** Sheet: `senior-director-state/outbound/SEND-SHEET-2026-08-05.md`.
> Sent 0. Meetings 0. Revenue none. No software here can send.
>
> **2. PUBLISH THE LINE — and as of this cycle the publish is REHEARSED, not hoped for.** Local
> `main` is ahead of the shared line by a handful of commits ahead of the shared line. The whole path was walked this
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
