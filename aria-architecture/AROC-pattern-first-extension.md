# AROC Pattern-First Extension — ARIA Operating Law
## v1.0 — locked 2026-05-14 by Ahmad Wasee, Integrated IT Support Inc.

> **This document is an EXTENSION LAYER to the existing ARIA architecture.**
> It MUST APPEND and ENHANCE the original ARIA core tree modularly.
> It does NOT overwrite, replace, remove, or collapse any prior system.
>
> **Parent doc:** `AROC-research-2026-05-12.md` (the 15-section research and stress-test report).
> **This doc** = the operating law derived from that research, written as directives every future ARIA build must follow.

---

## 0. Scope and intent

This is the law for **how ARIA evolves cognitively**. Every future change to ARIA must reference this file BEFORE adding storage, retrieval, reasoning, or memory layers. Builders who skip this file produce systems that bloat storage, repeat language, burn tokens, and weaken intelligence density.

The parent AROC research doc explains *why*. This doc says *what we will do*.

---

## 1. The Core Discovery (the line that drives everything)

> Human language is operationally expensive.
> Most AI systems waste storage and compute through repeated KB text, duplicated explanations, verbose operational language, oversized retrieval chunks, repeated embeddings, unnecessary translation layers, excessive token/context usage.

ARIA evolves toward **compressed operational meaning** and **semantic density** instead of giant sentence databases, brute-force memory scaling, endless raw text storage, and oversized retrieval systems.

---

## 2. Hard guarantees (what this extension MUST NOT do)

ARIA's existing cognition layers, safety systems, KB systems, trust systems, RAG/vector systems, workflows, tools, agents, and reasoning paths **stay**. This extension:

- **Appends modularly.** New paths under existing trees. Never replaces.
- **Preserves audit trail.** All compressed states must remain decompressible to human language for reporting.
- **Preserves safety verification.** Every reconstructed answer still goes through evidence checks, contradiction checks, confidence scoring, rollback awareness, environmental validation, safety verification — per parent doc §5.1 and §12.
- **Preserves enterprise trust.** No silent failures. No hidden uncertainty. No invented operational facts.

---

## 3. The Cognitive Flow ARIA evolves toward

This refines the cognitive flow in parent doc §1.3:

1. **Pattern Recognition Layer** — recognize operational issue patterns directly, BEFORE any language retrieval.
2. **Semantic Compression Layer** — map operational meaning into compressed symbolic state.
3. **Procedural Reasoning Layer** — reason through procedures and relationships in compressed form.
4. **Memory Layer** — procedural memory, pattern memory, sparse critical memory (per parent doc §9.1), semantic state memory, symbolic operational states.
5. **KB/RAG Layer** — retrieve detailed knowledge ONLY if necessary (not first move).
6. **Verification Layer** — evidence, contradictions, confidence, environment, rollback safety, operational risk.
7. **Human Translation Layer** — translate compressed cognition into natural language ONLY at the boundary (user reply, escalation summary, enterprise report).

Human language acts as **input layer, output layer, reporting layer, audit layer** — not internal cognition.

---

## 4. Compressed Operational State — the encoding standard

ARIA stops storing repetitive full sentences, duplicated KB paragraphs, verbose troubleshooting language, bloated retrieval chunks.

ARIA stores **compressed symbolic operational states** instead.

**Example encoding:**

- Raw: "User cannot connect remotely because VPN token expired after password reset."
- Compressed (long form): `VPN.AUTH.TOKEN.REMOTE.PWRESET`
- Compressed (short code): `V-ATR-01`

**Encoding rules:**

- **Domain prefix** (3-letter cap): `VPN`, `EML`, `PRT`, `NET`, `AUT`, `OS`, `M365`, `SEC`, `HW`.
- **State chain** (dot-separated, uppercase tokens, ≤6 deep): subsystem → cause → trigger.
- **Short code** (`<DOMAIN>-<CHAIN>-<NN>`): deterministic alias for hot patterns, generated when same long-form encoding fires ≥3 times.
- **Decompression metadata** stored alongside: each code has a `to_human()` reconstruction template + last-verified date.

**What this buys us:**

- Vector index shrinks: embed the code, not the paragraph.
- Pattern matching at intake is O(1) lookup before any LLM call.
- KB updates touch the template, not 47 article copies.
- Audit log is human-readable on decompression.

---

## 5. Pattern-First Cognition — the runtime contract

When a user message arrives, ARIA's FIRST move is **pattern match**, not retrieval:

1. Extract operational signals (keywords, error codes, named systems).
2. Hash to candidate symbolic states.
3. Score each candidate against intake signals (>0.7 confidence → proceed without retrieval).
4. Only if no high-confidence pattern → fall through to vector RAG → KB lookup → LLM generation.

This is the inverse of today's stack (which always starts with LLM/RAG). Pattern-first cuts latency, cost, and hallucination surface.

---

## 6. Reconstructive Intelligence — the runtime safety contract

ARIA reconstructs solutions from sparse clues, operational patterns, semantic state encoding, procedural abstractions, contextual evidence, causal relationships, pattern recognition, compressed symbolic states — NOT replayed paragraphs.

**HARD SAFETY RULE (non-negotiable, ties to parent §5.1 + §12):**

Every reconstructed answer MUST pass:

- Evidence check (signal supports conclusion)
- Contradiction check (no internal conflicts with prior steps)
- Confidence score (calibrated per parent §13)
- Rollback awareness (proposed action is reversible OR confirmed irreversible-with-consent)
- Environmental validation (target environment matches assumptions)
- Operational validation (within IT-support scope)
- Safety verification (no destructive ops without explicit human approval)

ARIA must **never** fake certainty, fake progress, hide uncertainty, or invent operational facts. If reconstruction fails verification → escalate to L2 human, do not paper over.

---

## 7. Adaptive Memory — the strengthening/forgetting law

This refines parent doc §11 and §14.

ARIA dynamically decides:

- **Strengthen** — repeated successful reasoning paths gain weight (procedural fluency, technician intuition).
- **Archive** — items below access-frequency threshold move to warm tier (compressed, retrievable).
- **Compress** — verbose memory rewrites itself into symbolic state codes when fired ≥3x.
- **Decay** — confidence drops on items unverified for >90 days.
- **Forget** — cold-tier items past audit-lock window are released (audit log preserved).
- **Operational instinct** — patterns fired ≥10x with >0.9 success rate skip pattern recognition step and route directly to procedural reasoning.

KB storage in bits: every compressed code → 1 row in pattern table + 1 row in decompression template. No paragraph duplication. Where the existing KB has 47 articles all containing "to flush DNS cache, run `ipconfig /flushdns`" — the new tree has 1 procedural fragment `NET.DNS.FLUSH` referenced by all 47, with 1 template.

---

## 8. Tree append — exactly where new paths live

These paths **append** under existing tree. They do not replace any sibling.

```
/llm
  /pattern_first_cognition            ← NEW
    /sensory_pattern_recognition
    /direct_pattern_mapping
    /operational_pattern_recognition
    /meaning_before_language
    /low_translation_reasoning
    /pattern_to_symbol_fallback
    /causal_trigger_recognition

/semantic_compression                 ← NEW top-level
  /compressed_operational_storage
  /semantic_state_encoding
  /symbolic_issue_codes
  /semantic_density
  /compressed_operational_language
  /procedural_abstractions
  /relationship_mapping
  /trigger_based_recall

/reconstructive_intelligence          ← NEW top-level
  /sparse_critical_memory             (cross-link to parent §9.1)
  /dynamic_reconstruction
  /reconstructive_reasoning
  /procedural_memory
  /adaptive_forgetting                (cross-link to parent §14)
  /memory_decay_rules
  /pattern_strengthening
  /confidence_aware_cognition         (cross-link to parent §13)
  /false_reconstruction_detection
  /reconstruction_verification        (cross-link to parent §12)

/memory_system                        ← REORGANIZE (additive)
  /procedural_memory                  (new)
  /pattern_memory                     (new)
  /reconstructive_memory              (new)
  /symbolic_memory                    (new)
  /semantic_state_memory              (new)
  /memory_weighting                   (parent §11 lives here)
  /adaptive_forgetting                (parent §14 lives here)
  /compressed_operational_memory      (new)

/kb
  /existing                            ← UNCHANGED. All current 102 KBs live here.
  /compressed                          ← NEW
    /symbolic_operational_kbs
    /compressed_issue_states
    /procedural_issue_patterns
    /semantic_operational_templates

/vectors
  /existing                            ← UNCHANGED. Current paragraph embeddings stay.
  /compressed_index                    ← NEW
  /relationship_index                  ← NEW
  /pattern_index                       ← NEW
  /semantic_state_index                ← NEW
  /procedural_index                    ← NEW
```

**Migration rule:** new compressed codes get indexed alongside existing paragraph embeddings. Pattern-first router queries compressed index first; falls through to paragraph index if no high-confidence match. No existing KB article is deleted; the compressed version is an INDEX, not a replacement of the audit-readable text.

---

## 9. What ships now vs what's a multi-sprint engineering project

**Implementation-ready today (and applied in v0.4):**

- Architecture law is locked (this doc).
- Admin email metrics in `aria-session-end.mjs` will use symbolic operational codes (e.g., `recon=78% reused_pattern=V-ATR-01 growth=+12kb/-2.4s`) instead of verbose sentences.
- Each new feature shipped to ARIA references this doc in its commit message and PR description.

**v0.5 (next 4-8 weeks of focused engineering):**

- Pattern Recognition Layer service (small classifier, ~50ms p50, runs BEFORE LLM call).
- Symbolic code dictionary v1 — seed with 200 most common L1/L2 issues, expand from real ticket data.
- Compressed index alongside existing vector index.

**v0.6+ (8-16 weeks):**

- Adaptive forgetting scheduler (warm/cold tier mover).
- Reconstruction verifier (separate small model per parent §12.1).
- Confidence calibration network (parent §13).
- KB-in-bits migration tool (one-way write that compresses existing 102 KBs into symbolic states + templates, keeps originals as fallback).

**v0.7+ (organizational autonomy):**

- Operational instinct routing (patterns fired ≥10x skip recognition step).
- Procedural fluency replay (recurring successful flows execute without retrieval).

---

## 10. Builder checklist before any ARIA change

Every commit that touches ARIA's brain answers YES to all of these:

1. Did I read this file?
2. Am I adding paths, not replacing existing siblings?
3. Does the new path append under one of the trees in §8?
4. If I store text, can it be expressed as a symbolic operational state instead? If yes, do that.
5. Does my change ride on top of existing safety/verification, or did I bypass it? (Bypass = reject.)
6. Did I update the symbolic dictionary if I introduced a new operational state?
7. Is the human-readable decompression template attached so audits still work?

---

## 11. Long-term direction (north star)

> ARIA evolves toward **Pattern-First Adaptive Reconstructive Operational Cognition**:
> stores less, understands more, compresses operational meaning, reconstructs intelligently, reasons procedurally, adapts dynamically, minimizes operational waste, preserves enterprise trust, maximizes semantic density, reduces storage and retrieval overhead, strengthens procedural operational intelligence over time.
>
> Not: brute-force memory scaling, giant duplicated KB storage, excessive language dependency, oversized retrieval systems, unnecessary token/context expansion.

This is the line every builder must defend. Pattern-first is the wedge — what makes ARIA structurally different from GPT-wrapping competitors. Defend it.

---

*Document law locked 2026-05-14. Editable only with founder sign-off. Cross-link to AROC-research-2026-05-12.md for "why"; this doc is "what we will do".*
