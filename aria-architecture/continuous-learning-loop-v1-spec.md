# ARIA Continuous Self-Evolving Learning Loop — v1 Spec
## Drafted 2026-05-25 from Ahmad's direction. Status: DESIGN (not yet built). Extends AROC operating law.

> North star: ARIA learns **continuously and autonomously** from free web knowledge,
> agents reason together using the 9 frameworks, compress findings to **bit-format KBs
> stored locally**, and reconstruct answers from pattern/"muscle memory" — calling an
> LLM only as a last resort under SLA pressure, under a hard spend cap, alerting Ahmad once.

---

## 1. The non-negotiable rules (Ahmad, 2026-05-25)

1. **Loop runs continuously** as long as agents are scraping free web info and learning on their own.
2. **No LLM call** unless: pattern + KB + research **all exhausted** AND the request is **breaching / repeatedly breaching SLA**. Only then call the LLM.
3. **One-shot LLM:** for a given issue, call the LLM **at most once**. After that, **contact Ahmad** and **do not call again** for that issue.
4. **Hard spend cap:** never exceed the configured plan budget with any LLM provider. Cap is absolute.
5. Agents **converse using the 9 frameworks** on the website (5 W's, STAR, First Principles, OKR, Eisenhower, DMAIC, Kaizen, TOC, AAR) — reasoning to answers **without** web search where possible.
6. **Bit-format storage** (AROC §4): store only enough to **reconstruct** via pattern/muscle-memory (e.g. hear "RSA" → ARIA already knows everything about RSA without a KB lookup). Not full text.
7. **KB database lives on Ahmad's machine** at a known location (he owns the data), in addition to any cloud mirror.

---

## 2. Components

### 2.1 `aria-llm-governor` (NEW) — the cost/SLA gate (the brain of rule 2–4)
Every potential LLM call routes through here. Permits a call **only if ALL true**:
- pattern-first (`aria-pattern-router`) returned no high-confidence hit, AND
- research/RAG (`aria-research`) returned nothing usable, AND
- request is breaching SLA (elapsed > ~0.8× tier SLA: L1 ~60s, L2 ~90s, L3 ~180s) **or** this issue-class has a repeated-breach history, AND
- spend ledger is under `ARIA_LLM_MONTHLY_CAP_USD`.

Then: **one** call (flag `llm_used:{traceId|symbolicState}` in a blob), **alert Ahmad** ("ARIA used the LLM for X — why"), and **never call again for that issue**. At budget cap → hard refuse, escalate to human. Exposes a ledger to Aperture (spend used, calls this period, SLA health).

### 2.2 `aria-learning-loop` (EXISTS — enhance) — continuous deliberation
- "Continuous" on serverless = **high-frequency cron** (Netlify scheduled fn, e.g. every 1–5 min) — you cannot hold a long-running process in a function. Each tick = one deliberation round. (For truly continuous, run the loop on the **droplet/OpenClaw**, which already exists, and have it call the mesh.)
- Each round: pull a topic from the **curiosity queue** (§2.4) → run it through the **9 frameworks as deterministic operators** (5 W's decompose, First Principles → primitives, etc.) → agents exchange messages (deterministic transforms, $0) → converge on a compressed insight → write a **bit-format KB** (§2.3).
- **Emits a mesh-event per inter-agent message** → this is Ahmad's pick **#3**: the live spider-web becomes genuinely alive (not just simulated).

### 2.3 Bit-format KB + reconstruction ("muscle memory", AROC §4/§6/§7)
- Store **symbolic operational states** + a tiny `to_human()` reconstruction template + provenance + last-verified date. Not full paragraphs.
- Hot patterns (fired ≥10×, AROC §7) → "operational instinct": ARIA answers without any retrieval.
- **Provenance on every bit** (source URL + date) so audits/evolution emails are defensible for corp/gov.
- **Confidence decay** (AROC §7): bits unverified >90 days lose confidence and get re-checked.
- **Contradiction guard:** new bit checked against existing (via `aria-verifier`); conflicts flagged to Ahmad, never silently merged.

### 2.4 `aria-research` (EXISTS — extend) — free-source knowledge acquisition
Learn fundamentals (how computers work, what AI is, networking, business workflows, security e.g. RSA…) and ongoing vendor/issue knowledge from **legitimate free** sources:
- Wikipedia/Wikidata, MDN, official vendor docs & support, RFCs, NIST, gov open data, Stack Exchange dumps, RSS, YouTube **captions/transcript API**, open courseware.
- Each fetch → heuristic extract → compress to bit → store with provenance.

### 2.5 Curiosity queue
"What to learn next": gaps from unresolved tickets, low-confidence patterns, new terms seen in inquiries, plus a **seed curriculum** (computing, networking, AI, business ops, security primitives). Agents work it continuously.

### 2.6 Reporting (`aria-evolution-report`, BUILT) + Aperture governor dashboard
- Daily "ARIA evolved" email: new bits/KBs/agents, areas now covered, **LLM calls made + why + budget status**, and any auditor/verifier concerns.
- Aperture panel: spend vs cap, SLA health, LLM-calls-this-period, pending human alerts, kill switch.

---

## 3. ⚠️ One real concern to resolve before building §2.4

Ahmad mentioned scraping free-tier **ChatGPT / Gemini / DeepSeek / Claude web UIs** and YouTube/Google.
- **Programmatically scraping those chat UIs violates their Terms of Service** → account bans, IP blocks, and a reputation/legal exposure that's bad for a firm selling to corp/gov. It's also brittle (they change constantly).
- **Better, legitimate path:** learn from open knowledge sources (above) for free; if ARIA needs *LLM-grade* reasoning, use the **metered API through `aria-llm-governor`** (rule 2–4) — legitimate, capped, auditable.
- YouTube/Google: use official captions/feeds/APIs within their terms, not scraping.

Recommendation: build §2.4 on open sources + the governed API path; **do not** wire competitor chat-UI scraping.

---

## 4. Storing the KB on Ahmad's machine (rule 7)

Netlify functions **cannot write to Ahmad's PC** (serverless). Options to get the bit-KB local + owned:
1. **Droplet/OpenClaw owns the loop + local store**, syncs a mirror down to Ahmad's machine on a schedule (recommended — already have the droplet).
2. A small **local sync script** (`scripts/kb-pull.mjs`) Ahmad runs that pulls the Netlify-blob KB to a known local dir (e.g. `aria_brain_pack/bits/`).
3. Loop writes to a git-tracked `aria_brain_pack/` so the KB is versioned + on every clone.

---

## 5. Build order (when un-paused)
1. `aria-llm-governor` (gate + ledger + one-shot + alert) — **safety first; g() everything behind it.**
2. Enhance `aria-learning-loop` to emit mesh-events (Ahmad's **#3**) + framework-operator deliberation.
3. Curiosity queue + seed curriculum.
4. Extend `aria-research` to the open-source curriculum (no chat-UI scraping).
5. Local KB sync (§4).
6. Aperture governor dashboard panel.

All additive. Nothing flips to live `active` / cron / spends a cent until Ahmad reviews + the governor cap is set.
