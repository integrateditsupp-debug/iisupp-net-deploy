# RUN 16 §G — Test KB upload + targeted Q&A results (2026-06-19)
**Suite:** tests/test-kb-qa.test.mjs · **Fixture:** tests/fixtures/test-kb.md (20 entries) · **Status:** PASS
- Ingest: every entry's distinctive citation survives the kb-ingester chunker.
- 20/20 questions retrieve the correct entry and cite its exact KB fact. 5/5 off-KB → "I don't know" (no hallucination).
- Live LLM-grounded answering runs server-side via aria-research; this offline battery proves the grounding contract.
