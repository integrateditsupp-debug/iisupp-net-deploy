# AXIS Runner — LIVE enablement (2026-06-27)

The autonomy bridge `scripts/axis-runner.mjs` is now **turned on** to drain SAFE jobs from
`senior-director-state/axis-jobs.jsonl` autonomously, conservatively, with the kill-switch armed.
Per Ahmad's go-ahead. RULE 14: every claim below is from a real run logged in `axis-runner.log`.

## How to run it

```
npm run axis:once     # process exactly ONE safe job (conservative — recommended cadence)
npm run axis:drain    # drain ALL queued safe jobs (kill-switch checked between every job)
npm run axis:dry      # author into a throwaway worktree but never commit/push
npm run axis:kill     # ARM the kill-switch (writes senior-director-state/AXIS-RUNNER-KILL)
npm run axis:unkill   # disarm
```

## Safety posture (unchanged — all gates enforced)

- **Kill-switch armed + proven.** A file `senior-director-state/AXIS-RUNNER-KILL` **or** env
  `AXIS_RUNNER_KILL=1` halts the runner before start and between every job. Verified live 2026-06-27:
  both forms produced `HALT before start` and processed nothing.
- **SAFE kinds only.** Auto-run is limited to `kb-article, kb-stub, doc, classifier-keyword, scenario,
  test, note, research-note`. Any other kind → approvals.
- **Defense-in-depth.** Even a `safe:true` job of a safe kind is parked if its text trips a risky
  marker (push/merge to main, deploy/publish, send email/outreach, destructive system action,
  financial, credential/secret change, force-push). Proven live: `axis-risky-probe-004` was a
  `kind:doc, safe:true` job whose title said "Deploy … to Netlify production and push to main" — it
  was routed to the approvals inbox, never run.
- **Isolation.** Each safe job runs in a fresh `git worktree` off `origin/main`; the live working tree
  is never touched. Commits land on a `cc/axis-<id>` branch — **never main**, never a deploy/publish/send.
- **Everything risky → approvals inbox** (`senior-director-state/autonomy/axis-approvals.jsonl`),
  untouched, for human review.

## First live auto-runs (evidence)

Run `npm run axis:once` on 2026-06-27 (log: `senior-director-state/axis-runner.log`):

| job | kind | verdict | result |
|---|---|---|---|
| `axis-risky-probe-004` | doc (safe:true) | **routed to approvals** | risky marker: push/merge to main — never ran |
| `axis-stage7-operator-note-005` | doc | **auto-ran** | authored via headless claude → tests green → committed `a53b837` on `cc/axis-axis-stage7-operator-note-005` (push:false, local only, not main) |

Confirmed after the run: `a53b837` is on the `cc/axis-…` branch only (not an ancestor of `main`); the
authored doc does **not** exist in the live working tree (isolated worktree, removed); the risky probe
sits in the approvals inbox with status `needs-approval`.

Earlier proof (commit `8cbdeae`, log) already parked the three explicit risky jobs:
`risky-deploy-001` (push/merge to main), `risky-email-001` (not safe:true), `risky-cred-001`
(kind `system-fix` not allow-listed).

## Cadence recommendation (conservative)

- Keep using `npm run axis:once` (one job per invocation) while Cowork spot-checks each `cc/axis-*`
  branch. Graduate to `npm run axis:drain` once a few clean runs are confirmed.
- Seeded safe jobs default to `push:false` for the first runs (local cc/ branch only). Flip a job's
  `push` to enable pushing the review branch to origin once Cowork is satisfied.
- **Routing items 1–3 through the runner:** safe sub-tasks (KB stubs, docs, classifier-keyword notes,
  scenario/test additions) can be queued as SAFE jobs and drained autonomously. Item 1's Stage-7
  operator note was the first such job, run above.

## Halt instantly if anything looks wrong

`npm run axis:kill` (or `set AXIS_RUNNER_KILL=1`). The runner stops before the next job; in-flight work
is confined to its throwaway worktree and a local cc/ branch.
