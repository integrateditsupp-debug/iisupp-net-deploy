# ARIA Brain Pack for Claude Code

Drop this folder into your project as `/aria_brain_pack` or merge its folders into your existing ARIA knowledge folder.

## What This Pack Contains
- `/brain/ARIA_SYSTEM_BRAIN.md` — ARIA behavior, support levels, safety, escalation logic.
- `/kb/` — starter L1/L2/L3/legacy/modern/security KB articles in structured JSON.
- `/schemas/kb_article.schema.json` — validation schema for every KB article.
- `/rag/RAG_IMPLEMENTATION_GUIDE.md` — how to load, chunk, embed, retrieve, and confidence-score KBs.
- `/prompts/CLAUDE_CODE_MASTER_PROMPT.md` — paste this into Claude Code with the folder attached.
- `/claude-code/IMPLEMENTATION_TASKS.md` — task list for Claude Code.

## Important Legal/Quality Note
This pack does not copy vendor KB articles. It converts trusted IT support concepts into original structured troubleshooting playbooks. Use official vendor docs through citations, APIs, live links, or approved ingestion where licensing allows.

## Recommended Next Step
Paste `/prompts/CLAUDE_CODE_MASTER_PROMPT.md` into Claude Code and attach this folder. Ask Claude Code to implement the KB loader, validation, retrieval, and ARIA response logic without changing your existing UI unless necessary.
