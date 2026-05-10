# ARIA RAG Implementation Guide

## Goal
Do not train one giant model. Build a retrieval system that gives ARIA the right KB articles at the right time.

## Recommended Flow
1. Load KB files from `/kb/**`.
2. Validate each JSON article against `/schemas/kb_article.schema.json`.
3. Split long articles into chunks of 500–900 tokens.
4. Add metadata: level, category, environment, tags, applies_to, source_basis.
5. Generate embeddings.
6. Store in vector DB: ChromaDB, Supabase pgvector, Pinecone, or Weaviate.
7. At chat time, retrieve top 5–8 chunks.
8. Rerank by category, environment, severity, and exact symptom match.
9. Answer using retrieved KB only when confidence is good.
10. If confidence is low, ask a diagnostic question or escalate.

## Retrieval Ranking
Priority order:
1. Exact product/service match.
2. Symptom match.
3. Environment match: legacy, modern, hybrid.
4. Severity match.
5. Most recent internal KB.
6. Official-source-derived KB.

## Confidence Rules
- High: exact symptom + product + environment match.
- Medium: symptom and product match, environment unknown.
- Low: vague issue, no matching product, high-risk category.

## Low Confidence Behavior
ARIA should say:
“I don’t want to guess because this could affect your system. Let me narrow this down with one quick question.”

## KB Update Loop
After every solved support issue, create a new KB note with:
Title, issue, affected system, symptoms, cause, fix, prevention, escalation level, tags.
