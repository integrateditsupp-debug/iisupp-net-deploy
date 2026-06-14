# Change Log — iisupp.net

Reverse-chronological. Each major session: what changed, files, added/moved/archived, review, risks.
Backups: `/backups/YYYY-MM-DD-description/` · Archive: `/archive/deprecated/` · Deletions: `docs/deletion-log.md` · Restore: `docs/restore-notes.md`.
(These `/docs`, `/backups`, `/archive` paths are blocked from public access in `netlify.toml`.)

---

## 2026-06-13 — Loops Engineering bootstrap (Cowork, $0 cost, Codex idle)

- **What:** Every recurring agent task is now a registered loop with explicit goal, budget, verification, spawn rules, and on-failure handling. Operating system shift triggered by Ahmad's "loop engineer" direction + Claude Code's founder video.
- **Spec:** `docs/LOOPS_SPEC.md` (canonical contract — 12 sections).
- **Master brief updated:** `docs/COLLAB_BRIEF.md` §13 — Loops Engineering as first-class operating concept.
- **Added:** `loops/` directory with 7 seed YAML loops (lead-radar, aria-self-learn, hard-rule-gatekeeper, spend-gatekeeper, goal-alignment, codex-observer, tender-enrich), `loops/registry.json` (all idle), `loops/CURRENT_GOAL.md` (top goal: $1M ARR by 2027-06), `loops/cli/loops.mjs` (zero-dep Node CLI), `loops/cli/goal.mjs`, `loops/lib/load-yaml.mjs`, `loops/README.md`.
- **Smoke tested:** `loops list/show/graph/budget/pause/resume/ledger` all working. `goal` print working. Schema validator on `loops add` enforces the 9 locked rules.
- **NOT touched:** `aria.html`, `aperture.html`, `aperture-learning.html` (HARD RULE). `package.json` (Codex has uncommitted edits — Codex adds `npm run loops` + `npm run goal` scripts when it next touches it).
- **Files:** `loops/**`, `docs/LOOPS_SPEC.md`, `docs/COLLAB_BRIEF.md` (updated §13).
- **Risk:** none — all additive, no existing functionality changed. Loops are `idle` (not running) until each runner is wired by Codex.
- **Next (Codex queue):** Implement runners at `netlify/functions/loop-runner-{id}.mjs`. Wire `hard-rule-gatekeeper` + `spend-gatekeeper` as Netlify scheduled functions. Add `npm run loops` + `npm run goal` scripts to `package.json`. Append confirmation entry to `docs/COLLAB_BRIEF.md` §11.

---
## 2026-05-29 — "The Unstubborn Life" book shipped (deploy 180cdb5, LIVE)
- Wrote the full original 9-chapter manuscript (universal self-mastery framing) into `_library-content.mjs` (full + 30% peek); delivered via the verified gated download.
- Catalog `gl-book-living-well` un-greyed → $97, featured, no longer "in progress". Verified live + paywall-protected. Price editable.

## 2026-05-28 — ARIA brain / answering fixes (deploy 9afa734, LIVE)
- **Root causes found:** live `aria-research.mjs` was an OLDER build missing the conversational/diagnostic layer (it sat uncommitted); + routing bugs made it ask "which app?"/"sorry to hear that" for clearly-recognizable issues.
- **Fixes:** diagnostic gate no longer intercepts when `detectState()` already recognises the issue; symptom detection now apostrophe-tolerant (`won't`) + covers "no audio/sound/video", "won't print", "black screen"; "thanks so much" → social reply; "Sorry to hear that" only on a real symptom; broadened slow-PC + VPN-setup patterns. Shipped the conversational layer + diagnostic-first v4.
- **Verified LIVE (10/10):** hi, can-you-help, printer won't print, laptop slow, teams no audio, black screen, set up a vpn, thanks, phishing, outlook won't send → all curated/conversational.
- **Files:** `netlify/functions/aria-research.mjs`. **Backup:** prior live version in `/backups/2026-05-28-aria-research-answering-fixes/`. Zero LLM / zero new cost.
- **NOT touched:** `aria-chat.js`, `aria-llm-governor.mjs` (still uncommitted — LLM path = a cost decision, left for explicit go-ahead).

## 2026-05-28 — Autonomous Execution Mode + guardrail scaffolding
- **Added:** `docs/change-log.md`, `docs/deletion-log.md`, `docs/restore-notes.md`; `archive/deprecated/`, `backups/` (with READMEs).
- **Moved (security):** `YOUTUBE-GROWTH-ENGINE.md` and `BOOK-OUTLINE-living-well.md` → `docs/` (they were/would be publicly fetchable on iisupp.net — internal strategy docs).
- **Changed:** `netlify.toml` — added redirects returning 404 for `/docs/*`, `/backups/*`, `/archive/*` (block public access).
- **Review:** none blocking. **Risk:** low (docs-only + a security tightening).

## 2026-05-28 — Catalog overhaul (deploy 76c27e0)
- GL prices ×3 then AI Agent Kit→$400, Prompt Eng→$200; All-Access fixed **$2,000**; bundles auto-priced = sum of contents.
- Merged all how-to/troubleshoot/instructional products into one **"IT & AI How-To Guides"** section (KB-format).
- Added 7 pictured devices (INVENTORY, real photos, buy-now) + **"Order Through Us"** concierge hardware/software + trending phone case (luxury intake modal).
- Added book **The Unstubborn Life** as greyed "In progress" (not buyable).
- Unified keyword search on Shop + Growth Library. Downloads render in KB-article format. Removed redundant "access code" CTA.
- **Files:** `assets/iis-catalog.js`, `shop.html`, `growth-library.html`, `product.html`, `netlify/functions/library-download.mjs`.

## 2026-05-28 — Inventory + search + pricing (deploy 7b7cecc)
- Pictured Purchase-Tech devices into Shop with images + buy-now; unified search; GL prices ×3; irresistible value hero.

## 2026-05-28 — v2 polish (deploy 3c1bc65)
- Affiliate greyed "coming soon"; homepage Growth-Roadmap timeline; 8 labeled Shop sections; per-product detail pages (`product.html`); Product Studio (`/studio`).

## 2026-05-28 — Fulfillment (deploy d183b27)
- `library-download.mjs` (Stripe-verified gated downloads) + `_library-content.mjs` (real content for 9 products); `/unlock` delivery.

## 2026-05-28 — Peek/Finder (deploy 1e197d3)
- 30% paid "Peek" model; $40 Finder's-Fee.

## 2026-05-28 — Shop/Growth Library launch (deploy a21e62f)
- `assets/iis-catalog.js` catalog engine; `growth-library.html` vault; nav reorg (Purchase Tech → under Shop; AI Courses → Growth Library); additive `successPath` on `stripe-checkout`.

## 2026-05-27/28 — earlier
- ARIA Command Center redesign + agents-stat fix (663f690); Shop storefront + OpenClaw installer fix (77cda27).

---
### Known NOT-built (deliberate — see iis-catalog-growth-library memory)
- Auto-placing orders on Amazon/vendor sites (no legitimate API; ToS/reputation risk) → concierge intake instead.
- Full multi-user accounts + ARIA SSO + subscriptions + admin portal (security-sensitive; build via Stripe Customer Portal + webhook as a dedicated tested phase).
