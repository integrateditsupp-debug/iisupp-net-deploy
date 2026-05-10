# Claude Code Implementation Tasks

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
