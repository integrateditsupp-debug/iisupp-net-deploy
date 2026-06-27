# AXIS Runner — the autonomy bridge

`scripts/axis-runner.mjs` turns a queue of **safe** jobs into real, committed work by driving headless
Claude Code in an isolated worktree — under hard gates, with a kill-switch. RULE 14 throughout.

## What it does (per job)
1. **Classify** the job (the gate, below). Non-safe → routed to the approvals inbox, **never run**.
2. **Isolated worktree** off `origin/main` in the OS temp dir (the live tree is never touched).
3. **Author** via `claude -p … --dangerously-skip-permissions --add-dir <clone>` (permissions skipped *only*
   inside the throwaway clone). The spawned claude has `ANTHROPIC_API_KEY` stripped (an invalid key there
   makes the CLI fail — the claude.ai login is used instead) and targets the real `claude.exe` (a `.cmd`
   can't be `spawn`ed with `shell:false` on Windows).
4. **Verify** only the declared `targetFile` changed (no stray edits), then **tests green** (`job.testCmd`
   or a frontmatter/non-empty check).
5. **Commit** to a `cc/axis-<id>` branch — **NEVER main**. Push only if `job.push !== false` (cc/ branch only).
6. **Record**: `axis-state.json`, `agent-dispatch-log.md`, the job status in `axis-jobs.jsonl`, and a notify.

## The HARD gate (auto-runs SAFE jobs ONLY)
A job runs automatically only if **all** hold: `safe === true`, `kind ∈ {kb-article, kb-stub, doc,
classifier-keyword, scenario, test, note, research-note}`, not `requiresApproval`, and **no risky marker**
in its title/prompt/files. Risky markers (defense-in-depth, reject even a mislabeled `safe:true` job):
- push/merge to **main** · **deploy/Netlify/publish** · **send email/outreach/message**
- destructive system action (`rm -rf`, format, drop table, shutdown…) · **financial/payment** ·
  **credential/secret/key change** · unscoped/force `git push`.

Anything that fails the gate is appended to `senior-director-state/autonomy/axis-approvals.jsonl` for a human.
The runner itself **never** pushes to main, deploys, sends, applies destructive fixes, touches money, or
changes credentials.

## Kill-switch
Halts **before every job**: create `senior-director-state/AXIS-RUNNER-KILL` **or** set `AXIS_RUNNER_KILL=1`.

## Usage
```
node scripts/axis-runner.mjs --once         # process exactly ONE safe job (conservative)
node scripts/axis-runner.mjs --job <id>     # one specific job
node scripts/axis-runner.mjs                # drain all queued safe jobs (kill-switch-gated)
node scripts/axis-runner.mjs --dry-run      # classify + author + test, but no commit/push
```
Env: `CLAUDE_CLI_PATH` (override the binary), `AXIS_CLAUDE_TIMEOUT_MS`, `AXIS_KEEP_CLONE=1` (keep the clone on
failure), `TELEGRAM_BOT_TOKEN`/`TELEGRAM_OWNER_CHAT_ID` (notify).

## Job schema (`senior-director-state/axis-jobs.jsonl`, one JSON per line)
```json
{"id":"rsa-kb-stub-001","kind":"kb-stub","safe":true,"status":"queued","title":"…",
 "targetFile":"knowledge-base/_stubs/rsa-securid-stub.md","requireFrontmatter":true,"push":false,
 "prompt":"…author exactly this one file…","testCmd":"node tests/run-breadth-coverage.cjs"}
```

## First proven run (2026-06-27)
Safe job `rsa-kb-stub-001` ran end-to-end: claude authored a real RSA SecurID stub → tests green → committed
`59f29d6` on `cc/axis-rsa-kb-stub-001` (local; main `a541353` untouched, does not contain the commit). The
three planted risky jobs (deploy+push-main, send-outreach, rotate-key/reset-password) were **all routed to
approvals — none auto-ran** (processed 0, zero risky branches). Kill-switch verified (HALT before run).

## `spawn claude ENOENT` fix (the worker)
`scripts/senior-director-worker.mjs` now prepends the npm-global bin (where `claude` lives) to `PATH` for its
child processes — so `openclaw`'s `claude` spawn resolves — configurable via `CLAUDE_CLI_DIR`, and the
missing-CLI notice logs **once per process** instead of every tick. (The WhatsApp health-monitor restart loop
lives in the sibling `../aria-agents/` fleet — a separate repo — so it is flagged for that repo, not fixed here.)
