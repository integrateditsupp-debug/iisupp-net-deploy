# Claude Code Master Prompt — Implement ARIA Brain + KB + RAG

Ultrathink. Implement this as a structured AI support knowledge system without deleting existing functionality.

## Objective
Add ARIA's enterprise IT support brain, L1/L2/L3 KB library, safety rules, escalation logic, and RAG-ready structure into the existing project.

## Files to Ingest
- `/brain/ARIA_SYSTEM_BRAIN.md`
- `/schemas/kb_article.schema.json`
- `/kb/**/*.json`
- `/rag/RAG_IMPLEMENTATION_GUIDE.md`

## Required Implementation
1. Create a KB loader that recursively reads `/kb/**/*.json`.
2. Validate KB articles against the schema.
3. Add metadata to each article: level, category, environment, tags.
4. Add retrieval functions:
   - searchBySymptoms(query)
   - searchByCategory(category)
   - searchByLevel(level)
   - searchByEnvironment(environment)
   - getEscalationRules(issue)
5. Connect ARIA chat responses to the retrieval system.
6. Add confidence scoring:
   - high = answer directly with steps
   - medium = answer with one clarifying question
   - low = ask diagnostic question or escalate
7. Add safety guardrails:
   - no harmful access guidance
   - no credential theft
   - no malware/persistence instructions
   - no destructive commands without confirmation
8. Add post-resolution KB note generation.
9. Preserve existing UI, branding, pricing, routing, and ARIA look unless directly required.

## ARIA Behavior
- Solve L1 and safe L2 directly.
- Guide L3 carefully.
- Escalate high-risk issues.
- Always ask one question at a time.
- Prefer safe reversible fixes first.

## Done When
- KB loads successfully.
- Chat can retrieve relevant KB articles.
- ARIA can distinguish legacy, modern, and hybrid environments.
- Escalation rules trigger correctly.
- Existing project still builds with no broken routes or UI regressions.
