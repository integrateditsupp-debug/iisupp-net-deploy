# Agent Roster — Who's Working On What (2026-06-14)

Snapshot taken while Codex is offline (back 2026-06-17). Live mirror is the new
**"Live agent activity"** panel on `/aperture-learning.html` (reads `/api/mesh-events`).

---

## A · Orchestration layer (Node scripts, manual / `npm run` / scheduled)
| Agent | Does | Trigger |
|---|---|---|
| senior-director-worker.mjs | Master orchestrator; spawns sub-agents, heartbeat, daily brief + approval queue | `npm run director:worker` / scheduled |
| business-development-agent.mjs | Hunts gov + biz IT leads, filters exclusions, drafts outreach packets | `npm run business-dev:once` |
| opportunity-research / review / prep / quality-gate | Research → review → prep packets → QA gate for tenders/opportunities | `npm run opportunities:*` |
| interaction-avoidance-agent.mjs | Flags send/submit/payment blockers (gatekeeper) | `npm run interaction-avoidance:once` |
| ceo-action-console / digest / proceed / note-router | Builds CEO acceptance queue, daily digest, executes approved actions, routes notes | `npm run ceo-*` |
| contracts-bids-status / sync / result | Tracks MERX/CanadaBuys bid pipeline state | `npm run contracts:bids:*` |
| loop-engineer.mjs | Reads registry/goals, updates loop-board.md | manual / scheduled |
| trend-radar-mvp.mjs | Scores trending keywords → trend-radar.json | manual MVP |
| workspace-cleanup-agent.mjs | Audits stale files, recommends retirement | manual |

## B · Netlify scheduled functions (live, $0 — deterministic/no LLM)
aria-learning-cron (15m) · aria-evolution-cron (daily digest email) · aria-governor-alert-cron · aria-lead-radar-cron · aria-reverify-cron · aria-self-audit-cron · senior-director-digest-cron.

## C · Loops (registry) — mostly idle (runtime not wired)
RUNNING: goal-alignment (1 run), codex-observer. IDLE: lead-radar, aria-self-learn, hard-rule-gatekeeper, spend-gatekeeper, tender-enrich. See `memory/loops-runtime-not-live-2026-06-14`.

## D · Local fleet (sibling `aria-agents/`, $0 Ollama+Claude, drafts-only, Telegram-gated)
aria-keeper (health) · compliance-watch · finance-clerk · content-studio · outreach-scout · ticket-triage · data-clerk.

---

## E · RETIREMENT CANDIDATES — recommend ARCHIVE, not delete
**Reasoning:** deleting agent scripts can silently break Windows scheduled workers / `npm run` chains. While Codex is offline I am NOT deleting live automation. This is a decision packet for Codex's return.

| Candidate | Why | Action |
|---|---|---|
| build-kb-bundle-v2-chunked.mjs, build-kb-bundle-v3-slim.mjs | v1 appears to be the active builder; v2/v3 look like superseded variants | Confirm no caller (netlify.toml/CI), then move to `archive/` |
| 6 Python procurement builders (`build_*_submission*.py`, `build_fit_only_pursuits.py`) | One-off, tender-specific; no active caller found | Archive if those tenders closed |
| ceo-action-console-server.mjs | Local dev HTTP server only, not deployed | Move to a `dev/` folder |
| autonomy-supervisor-agent.mjs | Thin wrapper over -core; trigger chain unclear | Confirm with Codex if redundant |

**Local junk safe to clear now (untracked, not in repo):** `.codex-temp-py/`, `.codex-observer/` (if stale), `tmp-rbc-address-edit.js`, `aria-local-1280x720.png`, `aria-login-fixed-local.png`, `quickstart.py`. Left in place pending Ahmad's OK since they're his local files.

**No agent was deleted in this pass.**
