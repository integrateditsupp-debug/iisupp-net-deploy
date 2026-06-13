# Claude Code Implementation Tasks

## Codex / Claude Cowork Loop - Standing Directive

Read `docs/COLLAB_BRIEF.md` first, then `senior-director-state/codex-claude-collaboration-loop.md`, before planning new IIS / ARIA product, revenue, AI Edge, Growth Library, or trend-intelligence work.

The cowork loop should turn Ahmad's trend-to-trust-to-transformation vision into staged products, specs, code, KBs, demos, and CEO final-action packets without asking Ahmad for routine direction.

Claude Cowork should return compact task packets for Codex:
- objective
- reasoning
- files to create/update
- safest first build slice
- approval gates
- risks
- next prompt

Codex should turn those packets into repo changes, tests, staged assets, and updated handoff notes.

Do not create cost, submit forms, send outreach, publish risky changes, claim fake search volume, invent proof, scrape platforms against rules, or make legal/financial/medical/public-risk claims without Ahmad approval.

Trend work must use deterministic scoring, longevity classification, and pending-review ARIA KB intake before any public or authoritative ARIA use.

Prompt 2 technical MVP starts with local manual/CSV trend intake, scoring, classification, draft generators, review queue, and CSV/JSON/Markdown export before any external connectors or live dashboard.

Prompt 3 content/product/community work starts with review-gated product plans, templates, community prompts, dashboard copy, email/social drafts, CTA language, and ethical conversion rules. Public product pages, Stripe links, email sends, community launch, donation collection, and public claims require Ahmad review.

## Codex Coordination Note - 2026-06-03
Codex is currently handling the Aperture command-center polish and admin gate:
- Added Netlify Edge Basic Auth for `/aperture`, `/aperture-learning`, and command-center routes using `APERTURE_ADMIN_EMAIL` + `APERTURE_ADMIN_PASSWORD`.
- Tightened dashboard-only `aria-escalation` actions so ticket/chat reads and operator posts require the Aperture bearer token.
- Added the command-center visual stage to `aperture-learning.html` while preserving the existing page structure and live data contract.

## Phase 1 — Safe Integration
- [ ] Add `/aria_brain_pack` to project.
- [ ] Create `lib/kb/loadKnowledgeBase.ts` or equivalent.
- [ ] Recursively read `/kb/**/*.json`.
- [ ] Validate against `/schemas/kb_article.schema.json`.
- [ ] Return normalized KB records.

## Phase 2 — Retrieval
- [ ] Add keyword fallback search.
- [ ] Add vector search if embeddings/vector DB already exists.
- [ ] Add metadata filters: level, category, environment, tags.
- [ ] Return top matching KB articles with confidence score.

## Phase 3 — ARIA Chat Behavior
- [ ] Inject `/brain/ARIA_SYSTEM_BRAIN.md` as the ARIA system/developer instruction.
- [ ] Before answering, detect issue category and severity.
- [ ] Retrieve KB matches.
- [ ] Use high/medium/low confidence behavior.
- [ ] Ask one troubleshooting question at a time.
- [ ] Escalate high-risk items.

## Phase 4 — KB Creation Loop
- [ ] After resolved issues, generate KB note draft.
- [ ] Let admin approve before saving.
- [ ] Save approved note as JSON using schema.

## Phase 5 — Testing
- [ ] Test audio issue.
- [ ] Test VPN issue.
- [ ] Test suspicious login.
- [ ] Test ransomware report.
- [ ] Test legacy mapped drive.
- [ ] Test modern Intune compliance block.
