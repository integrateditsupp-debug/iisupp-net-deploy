# Codex / Claude Collaboration Brief

Updated: 2026-06-13

Purpose: keep Codex and Claude Cowork aligned on IIS / ARIA work without requiring Ahmad to repeat the vision every session.

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

Phase 2 - after first paying client or Ahmad approval:

- paid data/API experiments
- dashboard
- community features
- richer ingestion
- advanced admin workflows

Phase 3 - revenue-funded:

- scaled automation
- partner bridges
- ads
- larger community/donation systems
- enterprise analytics and licensing

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

1. Read `AGENT_EXECUTION_NOTES.md`.
2. Read `senior-director-state/iis-aria-command-system.md`.
3. Read `senior-director-state/last-mile-execution-protocol.md`.
4. Read `senior-director-state/active-agent-handoff.md`.
5. Read `senior-director-state/codex-claude-collaboration-loop.md`.
6. Read `senior-director-state/codex-claude-queue.md`.
7. Read this file.

Then continue the safest next task without asking Ahmad for routine direction.
