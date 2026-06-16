# LOOPS ENGINEERING — IIS / ARIA operating system

**Author:** Cowork (Sonnet)  ·  **Created:** 2026-06-13  ·  **For:** Codex + every Cowork session + every ARIA agent
**Drop in repo at:** `docs/LOOPS_SPEC.md` (covered by netlify.toml `/docs/*` 404 redirect — internal-only)
**Mirror:** `outputs/codex-collab/LOOPS_SPEC.md`

---

## 0 · Source of the concept

Ahmad uploaded a TikTok clip of **Claude Code's founder** (Boris Cherny / Claude Code team) explaining how they design agents. The core message — distilled from the captions ("WE'RE DESIGNING AGENTS", "loops", "agents", "prompting", "shouldn't sleep", "runs") plus the public Anthropic talks Boris has given on the same topic:

> The right unit of agentic work is not a one-shot prompt. It's a **loop**.
> A loop has a goal. It reads context, takes an action, observes the result, decides whether the goal is met, and either returns or iterates.
> Agents shouldn't sleep — they should sit in a loop, doing useful work, until either the goal is achieved, a budget is exhausted, or a human says stop.
> The most powerful pattern is **loops that spawn other loops** — recursive decomposition where a big-goal outer loop calls smaller-goal inner loops, each scoped tighter than its parent.

Ahmad's direction:
> "loop engineer should be our focus, /loops /goal /loops that prompt other loops"
> "Both you and claude understand who i am and how I do things — now times that by 100 and let us move really fast so we are several steps always ahead of the market and industry."

This file is the formalization of that operating system. Codex and Cowork (and every ARIA agent) build to it from now on.

---

## 1 · What a Loop is (the canonical contract)

Every loop is a YAML/JSON record + an executable runner. The record has these fields:

```yaml
id: gov-tender-hunter           # unique short slug
title: "Gov tender hunter"      # human-readable
goal: |                         # MEASURABLE end-state — not "do good work"
  Email Ahmad up to 5 fresh MERX/CanadaBuys/Ontario IT tenders per day,
  HOT-flagged if score >= 60, dedup'd against /backups/seen.json.
  Stop conditions: 30 days inactive, or owner kill-switch.
owner: codex                    # who runs it (codex | cowork | aria | human)
cadence: "0 13 * * *"           # cron — daily 09:00 ET
budget:
  cost_usd_per_run: 0           # $0 lockdown
  time_seconds_max: 60          # wall-clock
  llm_tokens_max: 0             # spend lockdown
inputs:                         # what the loop reads
  - https://canadabuys.canada.ca/opendata/pub/newTenderNotice-...csv
  - /backups/lead-radar/seen.json
outputs:                        # what the loop writes
  - aria_brain_pack/bits/learn-trend-{slug}.json   (review_status: pending)
  - docs/REVIEW_QUEUE.md (one row per hot match)
  - email to ahmad.wasee@iisupp.net via Resend
tools_allowed:                  # explicit allow-list — anything not listed is blocked
  - fetch
  - filesystem.write
  - email.resend
constraints:                    # which locked rules this loop must obey
  - "$0 spend"
  - "Garry Tan filter on every artifact emitted"
  - "human review gate before live publish"
  - "HARD RULE: aperture login + ARIA chat must not be touched"
spawns:                         # nested loops this loop can trigger
  - id: tender-enrich
    when: "match.score >= 60"
  - id: tender-cover-letter
    when: "match.score >= 75 AND owner_approved == true"
verification:                   # how the loop knows it succeeded
  - "seen.json was updated"
  - "REVIEW_QUEUE.md has new row OR run report says 'no fresh matches'"
  - "no error in the audit log"
on_failure:                     # what to do when verification fails
  - log to docs/LOOPS_LEDGER.md
  - retry max 2 times
  - escalate to human via Telegram if 3rd failure in 24h
metadata:
  created: 2026-06-13
  version: 1
  source: LOOPS_SPEC.md §1
```

### Required-field rules (loops without these are rejected by the runner)

1. **goal** must be testable in one sentence. "Improve ARIA" is rejected. "Add at least 1 bit with review_status:pending to aria_brain_pack/bits/ matching the seed query each day" is accepted.
2. **budget** must include all three caps. A loop with no cost cap is treated as cost_usd_per_run=0.
3. **constraints** must explicitly cite the locked rules from `COLLAB_BRIEF.md §2`.
4. **verification** must be machine-checkable, not "looks good."
5. **on_failure** must include an escalation path. Silent failure is not allowed.

---

## 2 · The two slash-commands

### `/goal <one-line>` — set or read the operator's top-level goal

The operator (Ahmad) has one top-level goal at a time. Loops align to it.

- `/goal` — print current goal
- `/goal Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts` — set new goal
- Stored in `docs/CURRENT_GOAL.md` (single-line, with timestamp + history at bottom)
- Every loop's `goal:` must trace back to this top-level via a `serves:` field on the loop or a one-line comment

### `/loops <command>` — manage the loop registry

| Subcommand | Effect |
|------------|--------|
| `/loops` | list all loops with status (`running` / `idle` / `paused` / `failing`) |
| `/loops show <id>` | print the loop's YAML record + last 3 run results |
| `/loops add <yaml-path>` | register a new loop from a YAML/JSON file |
| `/loops run <id>` | trigger one immediate run outside cadence |
| `/loops pause <id>` | stop further cron runs (in-flight runs finish) |
| `/loops resume <id>` | re-enable cron |
| `/loops kill <id>` | force stop running iteration (last resort) |
| `/loops graph` | render the spawns-tree of every loop (ASCII + writes Mermaid to `docs/loops-graph.mmd`) |
| `/loops ledger` | print last 50 ledger entries (run history, success/fail rate, cost) |
| `/loops budget` | print today's spend across all loops vs cap |

Registry lives at `loops/registry.json` in repo root. Each loop YAML at `loops/{id}.yaml`.

---

## 3 · Loops that prompt other loops (the multiplier)

The whole point. A loop's `spawns:` list can name other loops + a `when:` condition. When the parent loop emits a result satisfying the `when:` expression, the child loop fires with the parent's output as input.

### Example — 3-deep tender pipeline

```
gov-tender-hunter        (daily cron, scans CanadaBuys + Ontario + MERX)
  └─ when: match.score >= 60
     tender-enrich       (fetches solicitation PDF, pulls evaluation criteria, fit-scores against IIS capabilities)
       └─ when: enriched.iis_fit >= 80
          tender-cover-letter   (drafts a tailored cover letter + proposes a price band, queues to docs/REVIEW_QUEUE.md)
            └─ when: ahmad_approved == true
               tender-submit-prep  (validates required attachments, builds the submission packet, NEVER submits — flags Ahmad to click Send)
```

Each child loop has its own goal, budget, tools, verification, on-failure — independent of the parent. Children cannot escalate budgets beyond their parent's cap (recursive budget descent).

### Spawn safety rules

1. **Max depth: 4.** A loop's spawn chain can't be more than 4 deep without explicit Ahmad approval. Prevents runaway recursion.
2. **Budget descent.** Child's `cost_usd_per_run` ≤ parent's. No exceptions.
3. **Stop-token propagation.** If the parent is paused/killed, all in-flight children also pause/kill within 30 seconds.
4. **Cycle detection.** The registry rejects any spawn graph with a cycle on `/loops add`.
5. **Human-review gate is inheritable.** If a parent is gated, every descendant is gated.

---

## 4 · Loop classes (seed taxonomy — copy + adapt)

| Class | Purpose | Cadence example | $0 viable? |
|-------|---------|----------------|-----------|
| **Hunter** | Pulls new external data, dedups, scores | daily / hourly | yes (CSV/RSS feeds) |
| **Enricher** | Adds context to a record (capabilities match, KB lookup) | event-driven via spawn | yes (deterministic lookups) |
| **Drafter** | Produces a deliverable (email, doc, KB bit, code patch) | event-driven via spawn | yes (templates); LLM Phase 2 |
| **Verifier** | Tests an artifact (smoke test, link check, accessibility audit) | post-deploy + nightly | yes |
| **Observer** | Watches a system, reports drift (Codex Playbook is one) | every 5–60 min | yes |
| **Ledger** | Aggregates results, computes KPIs, writes to `docs/LOOPS_LEDGER.md` | nightly | yes |
| **Gatekeeper** | Enforces a locked constraint (e.g. spend cap, HARD RULE check) | continuous | yes |
| **Demo** | Runs a 10-min trial of an ARIA capability and reports outcome | on-demand | yes for free tier; Phase 2 paid |

Every new loop fits one of these classes. If it doesn't fit, you're probably trying to write a script — that's fine, just don't call it a loop.

---

## 5 · How Loops plug into the existing IIS infrastructure

| Existing thing | Loop integration |
|----------------|------------------|
| `netlify/functions/aria-lead-radar.mjs` | Already a Hunter loop in spirit. Refactor to YAML loop record at `loops/lead-radar.yaml`. Cron stays in netlify.toml. |
| Codex's autonomous learning loop generating `aria_brain_pack/bits/learn-*.json` | Wrap as `loops/aria-self-learn.yaml` with explicit goal, budget, verification (currently runs without a registry entry — formalize it) |
| `docs/change-log.md` + `docs/REVIEW_QUEUE.md` | Both consumed/appended by loops. Define schema for REVIEW_QUEUE rows (already implicit — make it explicit) |
| ARIA chat at iisupp.net/aria | Each user session is a short-lived loop scoped to one conversation. Goal: solve user's problem within Garry Tan filter. Budget: 10-min trial. |
| Codex Playbook observer | Already an Observer loop. Move config into `loops/codex-observer.yaml`. |
| `outputs/HANDOFF.md` | A session-bridge artifact. Loops should write their own handoff entries into a `loops/{id}/HANDOFF.md` so the next iteration / agent picks up cleanly. |

---

## 6 · Multi-agent execution — who runs which loops

### Codex runs (lives in the repo, has CLI + git + netlify)
- All loops that write to the repo (bits, KB articles, HTML, netlify functions)
- All loops cron-scheduled via `netlify.toml`
- The learning bits loop (already running)
- `/loops graph`, `/loops ledger`, `/loops budget` commands as Node scripts in `loops/cli/`

### Cowork runs (lives in chat sessions, has scheduled-tasks MCP + memory)
- Loops scoped to one user session (ARIA chat, demo gateways)
- Loops that talk to external tools without writing the repo (LinkedIn drives, lead research, capability statement drafts)
- The Observer loops watching Codex's work (Codex Playbook)
- Memory-management loops

### Joint (either can run)
- Goal-alignment loop — once a day, both agents read `docs/CURRENT_GOAL.md` and confirm their queues serve it
- Review-queue tender — both can append; only Ahmad approves
- COLLAB_BRIEF maintainer — append-only updates to §11

### Handoff protocol when a loop crosses agents
The parent writes a packet to `loops/{id}/handoff-{ts}.json`:
```json
{
  "from": "cowork",
  "to": "codex",
  "spawn_loop": "tender-cover-letter",
  "context": { ...inputs... },
  "deadline": "2026-06-14T17:00:00Z",
  "human_review_required": false
}
```
The receiving agent's next session picks it up from `loops/INBOX/`.

---

## 7 · Locked rules every loop inherits

All these come from `COLLAB_BRIEF.md §2`. Loops cannot escape these.

1. **$0 spend default.** Any loop with a positive `cost_usd_per_run` requires explicit Ahmad approval before first run.
2. **HARD RULE.** No loop may modify `/aperture-learning.html`, `aperture.html`, or `aria.html`'s core chat handler without a passing smoke test verifying login + chat still respond.
3. **Visual stability.** No loop may change CSS, fonts, or layout on iisupp.net without queueing to REVIEW_QUEUE.
4. **Manual Netlify publish.** Deploy loops can only push to GitHub. Publishing is a human click.
5. **Standing mission.** Every Hunter loop must consider whether its output serves the lead-hunting mission.
6. **Ethical design rules.** Drafters that emit user-facing copy must be reviewed.
7. **Human review gate.** Any artifact tagged `risk: legal | financial | health | public-facing` must hit REVIEW_QUEUE before shipping.
8. **Garry Tan filter** on every ARIA-touching artifact.

The Gatekeeper class of loops is responsible for enforcing these on the other classes.

---

## 8 · The bootstrap set — what to build first

Codex should add these in `loops/` first. Cowork drafts the YAML below; Codex commits + wires.

### 8a · `loops/CURRENT_GOAL.md` (file)
```
Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Sub-goals (rolling, swap as the operator updates):
1. Close first paying client (any tier) by 2026-09.
2. Anthropic Partner Network application accepted by 2026-09.
3. 50+ outbound qualified replies/month by 2026-10.
4. 100+ approved KB bits/month in aria_brain_pack/bits/ by 2026-09.
5. Capability Statement PDF + Cover-Letter template shipped by 2026-06-20.

History:
- 2026-06-13: Goal locked at top-level by Ahmad via /goal command after loops-engineering kickoff.
```

### 8b · `loops/lead-radar.yaml`
Hunter class. Wraps the existing `aria-lead-radar.mjs`. Adds explicit goal, budget=$0, spawn to `tender-enrich` when score≥60.

### 8c · `loops/aria-self-learn.yaml`
Hunter+Drafter combo. Wraps Codex's autonomous bits loop. Adds explicit termination (max 50 bits/day), `review_status: pending` on every new bit, verification = bit passes JSON schema.

### 8d · `loops/codex-observer.yaml`
Observer class. Wraps `outputs/codex-observer/observe-codex.mjs`. Daily run. Outputs to `.codex-observer/codex-playbook.md`.

### 8e · `loops/spend-gatekeeper.yaml`
Gatekeeper class. Continuous. Watches every loop's `cost_usd_per_run` vs daily budget. Pauses any loop that breaches. Posts to Telegram on breach.

### 8f · `loops/hard-rule-gatekeeper.yaml`
Gatekeeper class. Runs after every Netlify deploy. Curls `/aperture-learning.html` (200 expected + login form present) and `/aria` (chat input present + responds to "hi"). Fails → automated rollback via Netlify deploy restore.

### 8g · `loops/goal-alignment.yaml`
Joint class. Daily. Reads `CURRENT_GOAL.md`. Inspects each running loop. Flags any loop whose goal doesn't trace back. Writes report to `docs/LOOPS_ALIGNMENT.md`.

### 8h · `loops/cli/loops.mjs`
Node CLI implementing `/loops` subcommands. Codex builds. Reads/writes `loops/registry.json`. Self-contained, zero npm deps.

### 8i · `loops/cli/goal.mjs`
Same. Implements `/goal`. Reads/writes `loops/CURRENT_GOAL.md`.

---

## 9 · How this multiplies the 100x speed Ahmad asked for

The 100x isn't about running 100x faster on a single task. It's about running 100 loops in parallel, each tuned to a specific cadence and goal, with the gatekeepers preventing wreckage.

Today:
- Codex commits once Codex is told to, ~24 commits in 14 days.
- Cowork waits for a chat session, then drafts.
- ARIA waits for a user.

Post-loops:
- Lead-radar runs daily without prompting.
- Self-learn fills ARIA's KB nightly.
- Cover-letter loop drafts on every score≥75 tender, queues to review.
- Capability-statement loop keeps the gov-procurement PDF fresh.
- Codex-observer runs every 5 min during work hours; weekly during sleep.
- Goal-alignment loop catches drift before it costs a day.
- Hard-rule gatekeeper saves you from a broken aperture deploy every time.

Each loop is small ($0, deterministic). Together they're the operating system.

---

## 10 · Implementation order (concrete, this week)

Codex's queue (in priority order):
1. Create `loops/` directory + `loops/registry.json` (empty array).
2. Build `loops/cli/loops.mjs` + `loops/cli/goal.mjs` (Node, no deps).
3. Add npm scripts: `"loops": "node loops/cli/loops.mjs"`, `"goal": "node loops/cli/goal.mjs"` (so they look like commands).
4. Author `loops/CURRENT_GOAL.md` with §8a content.
5. Convert `aria-lead-radar.mjs` into `loops/lead-radar.yaml` + a thin runner.
6. Wrap Codex's self-learn into `loops/aria-self-learn.yaml`.
7. Wire `loops/spend-gatekeeper.yaml` + `loops/hard-rule-gatekeeper.yaml` as continuous loops via Netlify scheduled functions.
8. Append entry to `docs/change-log.md` describing the loops system.
9. Update `docs/COLLAB_BRIEF.md` §11 with the loops-engineering boot date.

Cowork's queue (in priority order, runs in parallel):
1. This file (DONE).
2. Author the 7 seed YAML records (`loops/*.yaml`) as drafts in `outputs/codex-collab/loops-drafts/`. Codex copies into repo.
3. Update `COLLAB_BRIEF.md` with §13 — Loops Engineering as a first-class operating concept (DONE).
4. Memory entry `project_loops_engineering.md` (DONE).
5. Observer loop integration — make Codex Playbook spit YAML-record summaries when Codex changes class of work.

Ahmad's only ask after this ships:
- Run `/goal` in either agent's session to confirm the top-level. Adjust if needed.
- Approve the first 3 loop runs personally; after that, gatekeepers carry the load.

---

## 11 · The 100x test — how we know it worked

We declare loops-engineering "working" when these are simultaneously true for 7 consecutive days:

- [ ] At least 5 loops in `running` state with `success_rate >= 0.9`
- [ ] Zero HARD RULE regressions (aperture login + ARIA chat verified passing every day)
- [ ] Daily LOOPS_LEDGER shows at least one human-noticeable artifact emitted per loop per day (KB bit, lead match, cover letter draft, observation report)
- [ ] Ahmad spends <30 min/day driving them (rest is approving)
- [ ] Total spend < $5/week (well under $100 cap)

Until all five are green, treat this as v1, iterate.

---

## 12 · Update log (append at top, never silent-rewrite)

### 2026-06-13 — Cowork
Created. Built on Ahmad's TikTok upload of Claude Code founder + Ahmad's "loop engineer" direction. Spec ready for Codex to implement §10. Mirrored to `outputs/codex-collab/LOOPS_SPEC.md`. Memory entry `project_loops_engineering.md` added.

---

**End of LOOPS_SPEC. Both agents: every new piece of work that isn't a one-shot chat reply is a loop. Make it one.**
