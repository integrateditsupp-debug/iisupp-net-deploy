# Codex / Claude Collaboration Brief

Updated: 2026-06-13

Purpose: keep Codex and Claude Cowork aligned on IIS / ARIA work without requiring Ahmad to repeat the vision every session. This is the shared source Claude should use; local command files extend it with live run state.

This file is internal operating guidance. Netlify currently redirects `/docs/*` to a 404 page, so this is not a public website page.

## Master Vision

Build IIS / ARIA into a trend-to-trust-to-transformation ecosystem.

The system watches what people care about, scores whether it matters, then turns useful demand into:

- AI Edge learning paths
- ARIA knowledge bits
- Growth Library products
- short demos
- service offers
- scripts and templates
- support guides
- business-development assets
- CEO final-action packets

The brand should feel premium, clean, intelligent, human, practical, and quietly powerful. Do not make it feel desperate, fake, scammy, combative, or copied.

## Locked Constraints

- Spend $0 unless Ahmad approves.
- Do not send, submit, publish risky changes, pay, create accounts, certify, sign, delete, or make irreversible commitments without Ahmad.
- Do not fabricate search volume, testimonials, partnerships, proof, experience, or credentials.
- Do not scrape platforms against rules.
- Do not create legal, medical, financial, safety, regulatory, public-claims, donation, or privacy exposure without human review.
- Keep public copy simple and need-to-know unless Ahmad asks for detail.
- Preserve website visual stability unless the task is explicitly a design change.
- No Raymond James involvement.

## Agent Split

Codex owns:

- live repo changes
- code implementation
- tests and verification
- ARIA KB/product integration
- website/product staging
- command-state updates
- CEO final-action packets

Claude Cowork owns:

- outside-the-repo strategy
- product architecture
- trend framing
- offer design
- content direction
- critique and risk review
- compact task prompts back to Codex

Conflict rule: Codex owns the live repo. If strategy conflicts with implementation reality, Codex chooses the safest repo-consistent path and records the reason.

## Main Modules

1. Trend Intelligence Engine
2. Trend Longevity Predictor
3. Trend Opportunity Scoring Engine
4. Trend-to-Asset Mapper
5. Ethical Content Engine
6. Demo Gateway
7. Growth Library Product Engine
8. ARIA Integration Engine
9. IIS Service Offer Engine
10. External Product Bridge
11. Personalized Progress Dashboard
12. Community Growth Layer
13. Donation / Social Good Layer
14. Admin Command Center
15. Human Review Layer
16. Cost and Approval Gate

Do not build duplicate systems. Extend existing Lead Radar, Growth Library, ARIA trial, Aperture/admin, and `aria_brain_pack/bits/` patterns where practical.

## Trend Opportunity Score

Use a deterministic 0-100 score. Store the breakdown, not only the total.

Default weights:

- Attention: 10
- Velocity: 10
- Longevity: 10
- Usefulness: 12
- Revenue Potential: 12
- IIS Fit: 10
- ARIA Fit: 10
- Growth Library Fit: 8
- Trust Potential: 8
- Distribution Fit: 5
- Defensibility: 5
- Legal Risk penalty: up to -10
- Ethical Risk penalty: up to -10
- Saturation Risk penalty: up to -8
- Build Difficulty penalty: up to -7
- Cost Risk penalty: up to -5

If source data is missing, label the score `estimated` and explain what evidence is missing.

## Longevity Classifier

Use one class per trend:

- Flash: days to weeks
- Seasonal: tied to event or calendar cycle
- Medium: 1-6 months
- Long: 6-24 months
- Structural-Shift: durable market or behavior change

Use rule-based classification first. LLMs can explain but should not silently override rules.

## ARIA KB Intake

Trend knowledge must be bit-native:

- path: `aria_brain_pack/bits/learn-trend-*.json`
- required fields: `id`, `title`, `category`, `problem`, `audience`, `short_answer`, `baby_steps`, `evidence`, `trend_score`, `score_breakdown`, `longevity`, `review_status`, `created_at`, `updated_at`
- default `review_status`: `pending`
- allowed review states: `pending`, `approved`, `rejected`, `needs_update`

ARIA must not serve unapproved trend content as authoritative support guidance.

## Phases

Phase 1 - $0 now:

- scoring formula
- longevity classifier
- trend radar model
- review queue
- three demo candidates
- Growth Library mapping
- ARIA pending-bit intake
- manual keyword input
- CSV import
- local JSON/CSV/Markdown export
- admin dashboard specification

Phase 2 - after first paying client or Ahmad approval:

- paid data/API experiments
- dashboard
- community features
- richer ingestion
- advanced admin workflows
- demo gateway integration
- Shop integration
- ARIA usage analytics only if privacy-compliant and consent-based

Phase 3 - revenue-funded:

- scaled automation
- partner bridges
- ads
- larger community/donation systems
- enterprise analytics and licensing
- multi-agent workflows with authenticated scheduler/bridge

## Technical MVP Contract

Prompt 2 turns the strategy into a buildable MVP. The first version must let IIS:

1. Input or import trending keywords.
2. Pull trend data only from compliant sources.
3. Score each trend.
4. Classify trend longevity.
5. Generate product ideas.
6. Generate content outlines.
7. Generate demo ideas.
8. Suggest Growth Library products.
9. Suggest IIS service offers.
10. Suggest ARIA feature connections.
11. Queue everything for human review.
12. Export CSV, JSON, Markdown, and website-ready copy.
13. Display it in an admin dashboard.

First safe build slice:

- local manual/CSV keyword intake
- deterministic scoring
- rule-based longevity classification
- generated draft product/content/demo suggestions
- review queue
- JSON/CSV/Markdown exports
- no external APIs
- no public publish

## Technical Architecture

Text diagram:

```text
Manual keyword entry / CSV upload
  -> Trend Intake
  -> Optional compliant source connectors
  -> Raw data store
  -> Normalized trend records
  -> Deterministic scoring + longevity classification
  -> Product/content/demo/service/ARIA suggestion generators
  -> Human review queue
  -> Admin dashboard + filters + export
  -> Approved assets only: Growth Library, Shop, ARIA KB, website, demos
```

Low-cost stack:

- Current repo first: static/admin pages, Node scripts, Netlify functions where needed.
- Backend first slice: Node `.mjs` scripts and JSON files in `senior-director-state/trend-radar/`.
- Later backend: Node Express or Python FastAPI only when the local MVP proves useful.
- Database later: PostgreSQL or Supabase PostgreSQL after revenue or Ahmad approval.
- AI later: LLM generation behind review gates; no hidden keys, no hardcoded secrets.

## Database Schema Target

Design for these future tables. The local MVP can mirror them as JSON files first.

- `users`
- `admin_users`
- `trend_keywords`
- `trend_sources`
- `trend_raw_data`
- `trend_normalized_data`
- `trend_scores`
- `trend_classifications`
- `generated_products`
- `generated_content`
- `generated_demos`
- `growth_library_suggestions`
- `iis_service_suggestions`
- `aria_feature_suggestions`
- `review_queue`
- `audit_logs`
- `api_usage_logs`
- `cost_logs`
- `risk_flags`

Every record should include:

- `id`
- `created_at`
- `updated_at`
- `source`
- `status`
- `confidence_score`
- `review_status`
- `notes`

## API Endpoint Target

Do not build all endpoints before the local script proves value. Target endpoints:

- `POST /api/trends/keywords`
- `POST /api/trends/upload`
- `GET /api/trends`
- `GET /api/trends/:id`
- `POST /api/trends/:id/score`
- `POST /api/trends/:id/generate`
- `GET /api/review-queue`
- `PATCH /api/review-queue/:id`
- `GET /api/trends/export.csv`
- `GET /api/trends/export.json`
- `GET /api/trends/export.md`
- `GET /api/audit-logs`
- `GET /api/cost-logs`

All write endpoints require admin auth, rate limits, audit logs, and review gating.

## Admin UI Target

Pages:

- Trend Radar dashboard
- Keyword input / CSV upload
- Trend detail
- Review queue
- Product ideas
- Content outlines
- Demo ideas
- Risk flags
- Exports
- Cost/API usage logs

Components:

- trend table
- score badge
- longevity badge
- source chip
- review status selector
- risk flag panel
- product idea card
- content outline card
- demo idea card
- export toolbar
- filters and search

## Backend Services

- keyword intake service
- CSV parser
- compliant source connector service
- normalization service
- scoring service
- longevity classifier
- product generator
- content outline generator
- demo generator
- review queue service
- export service
- audit logger
- cost logger
- risk flagger

## Generation Rules

Content must follow:

1. Hook
2. Truth
3. Practical value
4. Personal relevance
5. Empowerment
6. Offer
7. Long-term path

Generated demos must include:

- demo title
- value shown
- input required
- output preview
- 10-minute limit
- free vs paid boundary
- upgrade path
- cost estimate
- conversion goal
- privacy note

## Content, Product, Community, And Ethical Conversion Contract

Prompt 3 adds the user-facing experience layer. It must preserve the full idea without making IIS / ARIA sound manipulative, desperate, anti-scam, or pressure-based.

Every trend becomes a user journey:

```text
attention -> awareness -> trust -> skill -> transformation -> community -> long-term value
```

Do not frame it as "trend -> buy something." Frame it as:

```text
You noticed this because something in it matters. Understand it, separate hype from value, then turn attention into a skill, tool, decision, workflow, asset, or growth path.
```

Trend content flow:

1. Attention Hook
2. Emotional Mirror
3. Truth Layer
4. Practical Explanation
5. Opportunity Layer
6. Demo Invitation
7. Choice-Based Offer
8. Long-Term Growth Path

Tone:

- human
- clean
- wise
- confident
- direct
- premium
- strong but humble
- inspiring but practical
- not corny
- not fake motivational
- not manipulative
- not desperate
- not overhyped

Use language such as:

- Here is what is really happening.
- Here is why people care.
- Here is the useful part.
- Here is the risk.
- Here is the better path.
- You can choose what fits you.
- If you want to build from this, start here.
- Turn attention into ability.
- Turn curiosity into skill.
- Turn a trend into an asset.

Avoid language such as:

- Guaranteed success
- Get rich quick
- Secret hack nobody knows
- This will change your life overnight
- You are behind if you do not buy this
- Limited time only, unless it is true
- Everyone is doing this, unless proven

Product types:

- PDF guide
- mini-book
- checklist
- template pack
- prompt pack
- AI agent starter kit
- automation blueprint
- troubleshooting guide
- AI-readable KB pack
- video lesson
- mini-course
- demo tool
- business audit
- website audit
- workflow audit
- consultation
- done-for-you implementation
- community challenge
- Growth Library bundle

Growth Library positioning:

```text
Practical intelligence packs for people, businesses, and AI systems.
```

Growth Library is not just courses. It is a premium practical intelligence vault for humans and AI systems.

For humans:

- Learn AI
- Learn automation
- Learn IT support
- Learn troubleshooting
- Learn prompt engineering
- Learn Microsoft 365 support
- Learn cybersecurity basics
- Learn workflow design
- Learn business systems

For AI systems:

- AI-readable KB packs
- SOPs
- escalation flows
- troubleshooting trees
- ticket triage packs
- help desk automation knowledge
- support agent training materials

First product plans:

1. Level 1 IT Support Troubleshooting Bible
2. Microsoft 365 Help Desk KB Pack
3. AI Agent Starter Kit for Small Business
4. Prompt Engineering for Workflows
5. Windows 11 Troubleshooting KB
6. Outlook Fix Guide
7. AI Help Desk Automation Blueprint
8. Cybersecurity Basics for Employees
9. No-Code Automation Kit

Each product plan must include:

- title
- subtitle
- target customer
- why it sells
- what it includes
- free preview idea
- 10-minute demo idea
- price range
- upsell path
- related IIS service
- related ARIA feature
- community challenge
- SEO keywords
- review status

Product page template:

- product title
- one-line promise
- who it is for
- problem it solves
- what is included
- preview/sample
- skill level
- time to complete
- format
- price
- FAQ
- privacy note when needed
- related products
- DIY path
- done-for-you path
- ARIA support path
- IIS implementation path
- community path

External product bridge template:

1. What is trending?
2. Why people want it.
3. What emotion it speaks to.
4. What value it actually gives.
5. What is hype.
6. What to consider before buying.
7. Smarter alternatives.
8. What the same money could build.
9. IIS / ARIA / Growth Library related path.
10. Clear disclosure of any service, referral, or concierge fee.
11. Free user choice.

Required bridge message:

```text
If you still want the product, that is your choice. Our role is to help you see the full picture before you spend.
```

Community content should reward growth, not noise:

- helpfulness
- consistency
- useful answers
- completed learning paths
- shared builds
- kindness
- practical contribution

Avoid ego-based ranking.

Dashboard copy should make users feel progress:

- Your Growth Path
- Skills Started
- Skills Completed
- Demos Tried
- Tools Built
- Time Invested
- Knowledge Unlocked
- Next Best Step
- Your Builder Level
- Your Practical Wins
- Continue Your Path

Journey levels:

- Beginner
- Builder
- Skilled
- Advanced
- Creator
- Leader

Donation layer copy must be honest:

```text
Optional contribution: Support digital literacy, AI education, and practical learning resources. We will only claim impact that we can actually track and verify.
```

Ethical conversion philosophy:

- free trust-building content
- low-cost products
- premium Growth Library
- ARIA tools
- IIS services
- consultation
- done-for-you implementation
- community membership
- enterprise packages
- transparent referral or concierge fees

The user should always feel informed, respected, free to choose, and more capable after interacting.

## Review Rules

Generated assets must enter review before public use.

Review statuses:

- Draft
- Needs review
- Approved
- Rejected
- Needs edits
- Published
- Archived

Flag for review when content includes:

- money claims
- health claims
- legal claims
- tax claims
- investment claims
- donation claims
- external product fees
- affiliate/referral links
- strong psychological persuasion language
- sensitive user data
- copyright risk
- brand partnership claims

## Testing Checklist

- manual keywords import correctly
- CSV upload/import handles missing fields
- same input produces same score
- score breakdown totals are explainable
- longevity rules are deterministic
- generated suggestions stay draft/review-gated
- exports are valid CSV, JSON, and Markdown
- no API keys are exposed
- no external source is called unless explicitly enabled
- risky categories create review flags
- ARIA KB content remains pending until approved

## Security Checklist

- no secrets in code
- `.env` for future keys
- admin-only dashboard
- role-based access later
- audit logs for review/publish actions
- rate limits for APIs
- no sensitive personal data without consent
- privacy notes on demos
- cost logs for paid APIs
- human review before public publishing

## Agent Workflow

1. Trend Intelligence Agent prepares candidate trends and evidence.
2. Scoring Agent applies deterministic formula and classifier.
3. Product Agent maps trends to products, demos, services, ARIA, and Growth Library.
4. Legal/Safety Review Agent flags risk.
5. Codex implements local files, scripts, UI, tests, and exports.
6. Claude Cowork critiques strategy and sends compact packets.
7. Ahmad only receives final-action items or real blockers.

## Collaboration Loop Reality

The loop is designed as a governed recursive handoff, not an uncontrolled infinite agent.

What is solved now:

- shared source: `docs/COLLAB_BRIEF.md`
- live queue: `senior-director-state/codex-claude-queue.md`
- local operating extension: `senior-director-state/codex-claude-collaboration-loop.md`
- execution log: `AGENT_EXECUTION_NOTES.md`
- CEO final-action gates are explicit
- Codex and Claude can continue from files without Ahmad restating the mission

What is not automatic yet:

- Codex cannot independently keep Claude running unless Claude local-agent mode or another authenticated bridge is active.
- Claude cannot independently run Codex unless a trusted local scheduler/bridge launches Codex with repo context.
- A true always-on loop needs a supervised worker that reads the queue, starts the available agent, records the packet, and stops at approval gates.

Safe next automation step:

- build a local `collab-loop-supervisor` that watches `senior-director-state/codex-claude-queue.md`, writes assigned packets, and never performs external actions. It should only prepare the next prompt or local task until Ahmad approves any risky final action.

## Loop Engineer Layer

Loop Engineer is now the preferred coordination surface for `/goal`, `/loops`, and loops that prompt other loops.

Read:

- `docs/LOOP-ENGINEER.md`
- `senior-director-state/loop-engineer/loop-board.md`
- `senior-director-state/loop-engineer/claude-next-prompt.md`
- `senior-director-state/loop-engineer/codex-next-prompt.md`

Run:

```bash
node scripts/loop-engineer.mjs
```

Current loops:

- `trend-radar-loop`
- `product-pack-loop`
- `aria-behavior-loop`
- `website-conversion-loop`
- `revenue-opportunity-loop`
- `claude-strategy-loop`
- `qa-safety-loop`
- `codex-build-loop`

Current reality:

- The loop board and prompts can be generated locally.
- Claude/Codex can use the board to continue without Ahmad restating the mission.
- True always-on execution still needs an authenticated local bridge that starts available agent sessions.
- The bridge must never bypass CEO final-action gates.

## Handoff Packet

Every Codex/Claude loop should produce:

- `round_id`
- `owner`
- `objective`
- `context_read`
- `what_changed`
- `evidence`
- `next_best_task`
- `files_to_touch`
- `approval_gates`
- `risks`
- `question_for_cowork`
- `recommended_next_prompt`

Write detailed working context to:

- `AGENT_EXECUTION_NOTES.md`
- `senior-director-state/codex-claude-queue.md`
- `senior-director-state/active-agent-handoff.md`
- `senior-director-state/iis-aria-command-update.md`
- `senior-director-state/ceo-approval-required.md`
- `senior-director-state/autonomous-execution-board.md`

## Session Start Protocol

1. Read this file first: `docs/COLLAB_BRIEF.md`.
2. Read `AGENT_EXECUTION_NOTES.md`.
3. Read `senior-director-state/iis-aria-command-system.md`.
4. Read `senior-director-state/last-mile-execution-protocol.md`.
5. Read `senior-director-state/active-agent-handoff.md`.
6. Read `senior-director-state/codex-claude-collaboration-loop.md`.
7. Read `senior-director-state/codex-claude-queue.md`.

Then continue the safest next task without asking Ahmad for routine direction.

## Starter Code Now Present

Codex started Prompt 2 with a local no-cost script:

- `scripts/trend-radar-mvp.mjs`

Run:

```bash
node scripts/trend-radar-mvp.mjs
```

Local outputs:

- `senior-director-state/trend-radar/keywords.csv`
- `senior-director-state/trend-radar/trend-radar.json`
- `senior-director-state/trend-radar/trend-radar.csv`
- `senior-director-state/trend-radar/review-queue.json`
- `senior-director-state/trend-radar/trend-radar-summary.md`
- `senior-director-state/trend-radar/audit-log.jsonl`

Current research pack:

- `docs/TREND-RADAR-TOP-100-2026.md`
- This is a directional top-100 long-life demand keyword list, not an exact search-volume ranking.
- It uses public source anchors, buyer-intent logic, IIS / ARIA fit, and longevity scoring.
- The local Trend Radar has processed those 100 candidates into review-gated JSON, CSV, Markdown, and ARIA pending-bit queue outputs.

Current limits:

- manual/CSV input only
- deterministic heuristic scoring only
- no Google Trends / Pytrends yet
- no external APIs yet
- no LLM generation yet
- no public dashboard yet
- no publish path

Next best build step:

- Add a local admin dashboard page that reads the JSON output and shows trends, scores, filters, generated ideas, risk flags, review status, and export links.

Prompt 3 starter code:

- `scripts/content-product-community-mvp.mjs`

Run:

```bash
node scripts/content-product-community-mvp.mjs
```

Local outputs:

- `senior-director-state/content-product-community/content-system.json`
- `senior-director-state/content-product-community/content-system.md`
- `senior-director-state/content-product-community/product-plans.csv`
- `senior-director-state/content-product-community/review-queue.json`

Current limits:

- templates and first 9 product plans only
- no public page publish
- no Stripe/checkout creation
- no email/social send
- no community launch
- no donation collection
