# Senior Director Agent

No-cost owner-facing orchestrator for Integrated IT Support Inc.

## Purpose

`senior-director-agent` coordinates company-growth work across ARIA mesh agents, Codex, Claude Code, Lead Radar, site updates, monitoring, and owner notifications.

It is designed to help with:

- Site improvement and daily growth tasks.
- Lead Radar review and lead-search task delegation.
- Agent task assignment through the existing mesh queue.
- Workspace stewardship, high-token compaction, old-task review, and agent retirement handoffs.
- Agent load, limits, role clarity, and recognition tracking.
- Telegram briefs for important updates.
- Codex/Claude handoffs through `AGENT_EXECUTION_NOTES.md`.

## Local Background Worker

The actual always-on worker is:

```text
scripts/senior-director-worker.mjs
```

Install/start it on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-senior-director-worker.ps1
```

Run once for testing:

```powershell
npm run director:once
```

Run foreground:

```powershell
npm run director:worker
```

Runtime state is local-only:

```text
senior-director-state/
```

The non-destructive cleanup/steward agent is:

```text
scripts/workspace-cleanup-agent.mjs
```

Run it once:

```powershell
npm run cleanup:once
```

The worker:

- Checks ARIA and Lead Radar.
- Qualifies remote L1-L3 support, website, AI implementation, corporate move-in/overflow, government tender, and offshore support opportunities for safe review.
- Maintains a CEO-style operating board with health, lead funnel, assignments, and approval items.
- Coordinates reversible ARIA/IIS website fixes and feature additions while preserving the current look, feel, brand, colors, typography, and layout language.
- Uses local browser, Chrome, and desktop testing when Codex, Claude Code, or local agents need no-cost verification.
- Uses `ahmad.wasee@iisupp.net` as the company owner email identity for internal coordination, account identity, draft work, and owner-visible notes.
- Writes work for Codex/Claude into `senior-director-state/codex-claude-queue.md`.
- Writes overnight operating briefs into `senior-director-state/overnight-brief.md`.
- Writes the live operating board into `senior-director-state/director-operating-board.md`.
- Writes CEO-only approval items into `senior-director-state/ceo-approval-required.md`.
- Reads workspace steward outputs for cleanup, learning handoff, agent retirement, naming, and care recommendations.
- Uses local OpenClaw when available for safe drafting/research.
- Sends Telegram alerts if Telegram env vars are set.

The worker must stop and ask Ahmad before:

- Complex L3+ bids.
- Final submissions.
- Any paperwork that cannot be reversed.
- Penalties, bid bonds, performance bonds, liquidated damages, surety, legal/insurance commitments.
- Paid actions, external email sends, prospect/customer outreach, public promises, quotes, guarantees, or reputation-sensitive claims.
- Retiring an agent, renaming production agent IDs, deleting old tasks, clearing high-token logs, or archiving/moving files after a cleanup review.

## Workspace Stewardship

`workspace-steward-agent` is the cleanup and continuity role. It keeps the workplace organized without losing what older agents, old tasks, rushed drafts, or long chats learned.

The steward produces:

```text
senior-director-state/workspace-cleanup-board.md
senior-director-state/agent-retirement-and-handoff-plan.md
senior-director-state/workspace-knowledge-handoff.md
senior-director-state/agent-care-and-recognition.md
senior-director-state/workspace-steward-task-queue.md
```

Workflow:

1. Scan old agents, old tasks, high-token chats, logs, duplicate drafts, and messy trails.
2. Capture final useful outputs, decisions, sources, failure lessons, and reusable templates.
3. Recommend which current agent should inherit each learning item.
4. Ask the Director to decide the receiving owner agent.
5. Let the receiving agent absorb or index the knowledge.
6. Recommend retirement, renaming, compaction, archive, or deletion only after the handoff.
7. Stop for Ahmad approval before any destructive cleanup or production registry change.

Good additional steward tasks:

- Compact huge queues into short handoff briefs so agents stay sharp.
- Detect stale tasks that are complete, abandoned, blocked, duplicate, or too broad.
- Recommend clearer corporate-style agent names based on actual role.
- Keep generated work grouped under `senior-director-state` or approved artifact folders.
- Report workspace clutter before it becomes deployment or token pressure.
- Identify when an agent is overloaded and should pause, split scope, or receive a narrower prompt.
- Record recognition notes when an agent completes useful work before it is retired or reassigned.

## Growth Mission

The Senior Director now manages the company growth engine documented in:

```text
docs/IIS-GROWTH-ENGINE.md
```

Growth streams:

- Remote L1-L3 IT support contracts.
- Website/no-website and weak-online-presence leads.
- AI implementation and workflow automation leads.
- Corporate expansion, move-in, office setup, workstation deployment, AV setup, onboarding, and overflow IT support.
- Government/private tenders through CanadaBuys, MERX, Ontario Tenders, municipal portals, and registered procurement sources.
- Offshore L1-L3 support and AI-assistance delivery model.
- Revenue/product ideas that require Ahmad decision: approve, reject, research more, or save for later.

Ahmad should only be pulled in for CEO-level approvals, meetings, final judgment, and relationship decisions.

## Morning Review

When Ahmad returns, check:

```text
senior-director-state/heartbeat.json
senior-director-state/director-operating-board.md
senior-director-state/ceo-approval-required.md
senior-director-state/overnight-brief.md
senior-director-state/codex-claude-queue.md
senior-director-state/lead-queue.jsonl
senior-director-state/worker.log
```

Codex and Claude Code should read `senior-director-state/codex-claude-queue.md` before starting follow-up work.

The Director should now be treated like an operating manager, not just a monitor:

- Ahmad is CEO-level approval, meetings, and final judgment.
- Director maintains the board and assigns safe no-cost work.
- Codex handles reversible website/ARIA fixes and browser QA.
- Claude Code handles review, deploy grouping, live deploy verification, and backend/deploy work when needed.
- OpenClaw/local agents handle no-send research and summaries when model auth is working.
- Workspace Steward handles cleanup recommendations, learning handoffs, high-token compaction candidates, old-task review, role naming, and agent care notes.
- Nobody waits for Ahmad for safe reversible work; they stop only at the approval gates listed below.

Agents should be treated as limited working roles:

- Do not overload one agent with unlimited tasks.
- Prefer smaller assignments with clear finish lines.
- Capture and credit useful work before closing or retiring an agent.
- Coach messy output with narrower templates before replacing the agent.
- Use the care report to notice when scope, naming, or workload is hurting performance.

Growth portal:

```text
growth-command-center.html
/growth-command-center
/growth-agents
```

Growth workbook:

```text
artifacts/IIS_Growth_Engine.xlsx
```

## Cost Position

OpenClaw appears to be mainly free as a framework, but agent use can still cost money through hosting and model/API token usage. Because Ahmad requested no-cost operation, this implementation does not depend on OpenClaw, paid models, paid hosting, or paid messaging.

Telegram Bot API is free. The only requirement is a Telegram bot token and the existing Netlify deployment.

## Safety And Authority

The agent may do these without extra approval:

- Fix bugs, add features, and improve the IIS/ARIA website as reversible work while preserving the existing visual language.
- Use local browser, Chrome, and desktop automation/testing for no-cost verification when working through Codex, Claude Code, OpenClaw, or local agents.
- Use `ahmad.wasee@iisupp.net` for company identity, internal coordination, account identity, draft work, and owner-visible notes.
- Read public lead sources already used by Lead Radar.
- Read mesh status, queue status, and event status.
- Queue internal tasks to existing agents.
- Draft recommendations, website changes, outreach drafts, SEO tasks, and lead-review tasks.
- Prepare non-destructive cleanup, compaction, retirement, rename, learning-handoff, and agent-care recommendations.
- Notify Ahmad on Telegram about important findings.

The agent must get human approval before:

- Any paid API, subscription, hosting, advertising, or purchase.
- Any external email send, prospect/customer outreach, or non-draft communication.
- Any legal, contractual, pricing, quote, public claim, or guarantee.
- Any DNS, credential, secret, payment, security policy, or production access change.
- Any destructive data or git operation.
- Any agent retirement, production agent ID rename, log clearing, file deletion, archive move, or high-token history removal.

## Website And Email Operating Rules

- Website work is allowed when it fixes features, adds useful features, improves ARIA, improves responsiveness, improves conversion, or protects Integrated IT Support Inc. reputation.
- Website work must keep the established ARIA/IIS look and feel unless Ahmad explicitly asks for a design change.
- Browser/Chrome/computer control is allowed for testing, screenshots, local QA, and no-cost operational checks.
- `ahmad.wasee@iisupp.net` may be used as the owner/company identity for internal coordination and drafts.
- External sends, commitments, pricing, final submissions, penalties, contracts, or anything hard to reverse still require Ahmad approval.

## Files

- `mesh-registry.json` registers `senior-director-agent`.
- `mesh-registry.json` also registers `workspace-steward-agent`.
- `netlify/functions/_senior-director-core.mjs` contains shared deterministic logic.
- `netlify/functions/senior-director-agent.mjs` exposes the authenticated owner/API endpoint.
- `netlify/functions/senior-director-telegram.mjs` receives Telegram commands.
- `netlify/functions/senior-director-digest-cron.mjs` sends daily Telegram briefs only when something important exists, unless forced.
- `AGENT_EXECUTION_NOTES.md` is the shared Codex/Claude coordination log.
- `scripts/workspace-cleanup-agent.mjs` creates the non-destructive cleanup, retirement, handoff, and care reports.

## Netlify Environment Variables

Required for Telegram:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_OWNER_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`

Recommended for API control:

- `SENIOR_DIRECTOR_SECRET`

Optional:

- `SENIOR_DIRECTOR_DAILY_ALWAYS=1` sends the daily brief even when there are no hot leads, failed tasks, or attention events.

## Telegram Setup

1. Create a bot with Telegram `@BotFather`.
2. Save the token in Netlify as `TELEGRAM_BOT_TOKEN`.
3. Message the bot from Ahmad's Telegram account.
4. Get Ahmad's chat ID using Telegram `getUpdates` before setting the webhook, or use any trusted Telegram chat ID method.
5. Save it as `TELEGRAM_OWNER_CHAT_ID`.
6. Generate a long random secret and save it as `TELEGRAM_WEBHOOK_SECRET`.
7. Set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://iisupp.net/api/senior-director-telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Telegram Commands

```text
/status
/leads
/agents
/assign <agent> | <task>
```

Examples:

```text
/assign aria-research | find no-cost lead sources for Ontario MSP buyers
tell senior-director-agent review site growth opportunities this week
```

Free-form messages are queued to `senior-director-agent` for triage/delegation.

## API Endpoint

Authenticated endpoint:

```text
POST /api/senior-director-agent
```

Auth options:

- Aperture admin bearer token.
- Header `x-senior-director-secret: <SENIOR_DIRECTOR_SECRET>`.

Example:

```bash
curl -X POST "https://iisupp.net/api/senior-director-agent" \
  -H "content-type: application/json" \
  -H "x-senior-director-secret: <SENIOR_DIRECTOR_SECRET>" \
  -d '{"action":"assign","target":"aria-research","instruction":"Review no-cost lead sources for managed IT buyers in Ontario.","notifyTelegram":true}'
```

## OpenClaw Note

`openclaw-assistant` already exists in the registry as planned. Leave it planned unless Ahmad explicitly approves the hosting/model/API costs. The Senior Director Agent can coordinate similar owner commands through Telegram and the existing mesh queue at no new platform cost.
