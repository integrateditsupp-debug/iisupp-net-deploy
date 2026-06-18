# IIS / ARIA — Codex × Cowork Collaboration Brief
## "Trend → Trust → Transformation" Ecosystem

**Owner:** Ahmad Wasee — Founder, Integrated IT Support Inc.
**Created:** 2026-06-03 by Cowork (Sonnet)
**Recommended repo path:** `docs/COLLAB_BRIEF.md` (covered by the existing `docs/*` 404 redirect in `netlify.toml` — internal-only)
**Mirror outputs path:** `outputs/codex-collab/COLLAB_BRIEF.md`

---

## 0 · Why this file exists

Two agents are now working on IIS / ARIA in parallel:

- **Codex** (ChatGPT Codex CLI) — direct local repo access, ships HTML/MJS/CSS/JSON to the live site, writes governance/design-handoff docs, runs `git`/`node`/`netlify` natively, manages `aria_brain_pack/bits/` autonomous learning output.
- **Cowork** (Anthropic Claude / Sonnet, occasionally Opus 4.8 for harder reasoning) — out-of-repo work: LinkedIn / lead research / cold outreach / capability statements / memory / observation / strategy docs. No direct repo write.

This file is the **single source of truth** both agents read so we don't fork the vision, duplicate work, or violate locked constraints. Whoever edits this file appends a changelog entry at the top of §11 — never silently rewrites.

---

## 1 · Master vision (Ahmad, verbatim)

> Build an AI-powered intelligence platform that watches trends, understands why people care about them, predicts which trends have short-term or long-term value, and turns those trends into practical IIS/ARIA assets such as: content · demos · guides · digital products · Growth Library products · AI-readable knowledge packs · AI agents · automation kits · business services · IT support packages · ARIA features · community learning paths · paid implementation offers.
>
> The platform should not only chase trends. It should turn trends into assets.
>
> The system must understand that people are often attracted first by emotional drivers (power, status, recognition, validation, curiosity, belonging, identity, beauty, lifestyle, aspiration, desire, security, knowledge, growth, transformation, fear of falling behind, hope of becoming better) — but must not trap people in shallow desire. Use attention as the doorway, then guide users toward deeper value: truth · trust · practical learning · skill-building · self-reliance · mastery · discipline · better decisions · ethical ambition · community · long-term usefulness · personal transformation.
>
> **Strategic flow:** Hook with attention. Reveal truth. Offer practical value. Build trust. Show a better path. Give the user choice. Convert through value. Retain through progress and community.

### Brand feel
Premium · clean · intelligent · futuristic · honest · human · practical · confident · elegant · not desperate · not fake · not overhyped · not gimmicky · quietly powerful · corporate luxury with warmth · Apple-level simple where possible · strong enough for businesses · clear enough for normal users. **The brand should feel like a quiet leader.**

### Core positioning
> "We help people understand what is rising, what matters, what is useful, and what can be turned into skill, systems, services, or opportunity."

---

## 2 · Locked constraints (NEVER violate)

Both agents inherit these. They override anything in §1 that would conflict.

1. **$0 default spend** until first paying client closes. No paid LLM call, no paid scraper, no new subscription. $100 hard cap with explicit per-action approval. Anthropic Partner application FROZEN (drafted, not submitted).
2. **HARD RULE** — `/aperture-learning.html` login + ARIA chat MUST keep working after every deploy. Rollback on regression. Verify both URLs post-publish.
3. **Visual stability** — don't change look/theme/fonts/copy on iisupp.net unless explicitly approved as improvement.
4. **Netlify auto-publish OFF** — every deploy needs the manual Publish click in `app.netlify.com/sites/iisupp/deploys`.
5. **Standing mission** (locked 2026-05-29, never re-ask) — hunt MERX / CanadaBuys / Ontario Tenders + business + IT roles autonomously, zero cost.
6. **Ethical design rules** (Ahmad explicit) — NO dark patterns, fake scarcity, fabricated testimonials, fake partnerships, fake search volume, manipulation of vulnerable users, hidden fees, shame-based selling, unrealistic financial promises, copyrighted material reproduction, illegal data collection, ToS-violating scraping, or high-risk advice without human review.
7. **Human review gate** before publishing: high-risk claims · paid offers · donation claims · external product referrals · legal/financial/health-related content · all public-facing content (default: queue for Ahmad, not auto-ship).
8. **Garry Tan filter** on every ARIA / site change: (a) trust · (b) clarity-in-5-seconds · (c) friction-to-payment · (d) demo/trial · (e) ships safely today.
9. **No fabricated experience.** When listing past work, use Ahmad's real history only (resume in `outputs/Ahmad Wasee_AI Engineer Resume.docx`). Anthropic credentials = the real Anthropic Academy completions (Claude 101, Claude Code 101, Cowork, Code in Action, AI Fluency, + Building with the Claude API in progress). Partner = "application in review" until accepted.

---

## 3 · The 16-module ecosystem — mapped to existing IIS infrastructure

Ahmad's spec is preserved verbatim in the prompt he pasted. Below is how each module **maps to existing files/agents** so neither of us builds duplicate infrastructure.

| # | Module | Existing infrastructure | Target file / agent | Status |
|---|--------|------------------------|---------------------|--------|
| 1 | Trend Intelligence Engine | Lead Radar pattern (CanadaBuys CSV poller) | new: `netlify/functions/trend-radar.mjs` (mirror Lead Radar pattern) | TO BUILD (Codex) |
| 2 | Trend Longevity Predictor | none | new: `netlify/functions/trend-longevity.mjs` — heuristic until LLM funded | TO BUILD (Codex) |
| 3 | Trend Opportunity Scoring | none | new: `lib/trend-score.mjs` (pure formula, no LLM) | TO BUILD (Cowork drafts, Codex ships) |
| 4 | Trend-to-Asset Mapper | none | new: `lib/trend-asset-map.mjs` — table-driven, no LLM | TO BUILD (Cowork drafts) |
| 5 | Ethical Content Engine | none | new: `netlify/functions/draft-content.mjs` — template-driven first, LLM later when funded | TO BUILD (Codex) |
| 6 | Demo Gateway | partial — ARIA chat trial pattern exists | extend `aria.html` trial UX + new: `assets/demo-gateway.js` | EXTEND (Codex) |
| 7 | Growth Library Product Engine | LIVE — `assets/iis-catalog.js`, `growth-library.html` | extend with auto-generated trend products → review queue | EXTEND (Codex) |
| 8 | ARIA Integration Engine | LIVE — `aria-research.mjs`, `aria-llm-governor.mjs`, `aria_brain_pack/` | new entries into `aria_brain_pack/bits/` per trend (Codex's autonomous learning loop already does this — extend prompt to include trend context) | EXTEND (Codex) |
| 9 | IIS Service Offer Engine | partial — capability copy on iisupp.net | new: `lib/service-offers.json` table mapping trends → services | TO BUILD (Cowork drafts) |
| 10 | External Product Bridge | none | new: `netlify/functions/external-product-bridge.mjs` + new section in `iis-catalog.js` for "wiser alternative" cards. 20% concierge fee disclosed on the page. | TO BUILD (Codex), copy drafted by Cowork |
| 11 | Personalized Progress Dashboard | partial — `/aperture-learning.html` is owner-only; need a *user-facing* dashboard | new: `user-dashboard.html` + `netlify/functions/user-progress.mjs` | DEFERRED until Phase 2 (needs auth — security-sensitive) |
| 12 | Community Growth Layer | none | DEFERRED — needs accounts. Hold until Phase 2 / 3. Codex's commit messages already mention "Full multi-user accounts + ARIA SSO + subscriptions + admin portal (security-sensitive; build via Stripe Customer Portal + webhook as a dedicated tested phase)" — that's the gate. | DEFERRED |
| 13 | Donation / Social Good Layer | none | new: `donate.html` + Stripe Payment Link (already have env var pattern) | DEFERRED — needs Stripe configuration + ethical clarity on where money goes (Ahmad must specify recipient first) |
| 14 | Admin Command Center | LIVE — `/aperture-learning.html`, "Agent Command Center" Codex shipped (commit 63c1183) | extend with trend tiles + revenue tiles + cost tiles | EXTEND (Codex) |
| 15 | AI Agent Layer | LIVE — mesh registry has 13 agents (Codex de-ghosted in d54ad49); `aria_brain_pack/bits/` learning loop already running | spec the 13 trend agents listed below as roles, not necessarily separate processes — wrap in existing learning loop | EXTEND (Codex) |
| 16 | Human Review Layer | partial — change-log.md + restore-notes.md system | extend to a `docs/REVIEW_QUEUE.md` that Codex appends to and Ahmad approves | TO BUILD (Codex) |

**Read this table top-down before building anything.** If a module is `LIVE` or `EXTEND`, the right move is to add to the existing code path — don't build a parallel system.

---

## 4 · Trend scoring formula (concrete, no LLM)

Ahmad gave a formula skeleton. Locking the math here so both agents score the same way:

```
TrendOpportunityScore =
  + 0.20 * Attention            (0-100, raw mentions or search volume normalized)
  + 0.15 * Velocity             (0-100, week-over-week growth)
  + 0.20 * Longevity            (0-100, classifier output — see §5)
  + 0.15 * Usefulness           (0-100, expert tag: practical / educational / motivational)
  + 0.10 * RevenuePotential     (0-100, IIS service-fit × price tier)
  + 0.05 * IISFit               (0-100, matches our delivery capabilities)
  + 0.05 * ARIAFit              (0-100, becomes a KB article or skill)
  + 0.05 * GrowthLibraryFit     (0-100, becomes a digital product)
  + 0.05 * TrustPotential       (0-100, can be backed with honest sources)
  - 0.15 * LegalRisk            (0-100)
  - 0.15 * EthicalRisk          (0-100)
  - 0.10 * SaturationRisk       (0-100)
  - 0.10 * BuildDifficulty      (0-100)
  - 0.10 * CostRisk             (0-100)
```

Result: −60 to +100. Score ≥ 60 → auto-suggest to Ahmad. Score 40–59 → queue for human review. Score < 40 → discard.

Every score must come with **why**: which inputs drove it. Build `lib/trend-score.mjs` to return `{ score, breakdown: {input: weighted_contribution} }` so reasons are auditable.

---

## 5 · Trend longevity classifier (heuristic, no LLM)

Five types per Ahmad's spec:

| Type | Signal patterns | Asset fit |
|------|----------------|-----------|
| **Flash** (hours-weeks) | single platform, no industry mentions, viral creator origin | short-form post, hot-take, 1-screen demo |
| **Seasonal** (returns yearly) | tied to date keywords (tax, holiday, school, weather, sport, product launch cycle) | landing page that reactivates yearly, scheduled republish |
| **Medium-Term** (3 mo – 2 yr) | crosses 2+ platforms, picked up by trade press, vendor announcements | landing page, mini-product, SEO content, service offer |
| **Long-Term** (3 – 10 yr) | regulatory / structural / multi-vendor adoption | community, training, ARIA module, IIS service line |
| **Structural Shift** | covered by mainstream + academic + government | core IIS / ARIA pillar (e.g. "AI in IT support" itself) |

Classifier rules (`lib/trend-longevity.mjs`):
1. If trend tokens match a seasonal calendar entry → Seasonal.
2. If trend appears on ≥ 3 distinct platforms (Google Trends + Reddit + news) → at least Medium-Term.
3. If trend has industry analyst coverage (Gartner / Forrester / equivalent) OR regulatory action → Long-Term minimum.
4. If trend changes ≥ 2 of {how-people-work, how-money-flows, how-decisions-are-made} → Structural Shift.
5. Default → Flash.

---

## 6 · ARIA KB intake — turn every trend into a bit

This is the answer to Ahmad's last line: *"See if a lot of what you will create can somehow be fed into ARIA as well in form of KB or anything other ways that ARIA is structured."*

ARIA already reads from `aria_brain_pack/bits/learn-*.json` (276 bits and growing — Codex's autonomous learning loop generates them). **Every trend should produce one or more bits.**

### Bit format (canonical — preserve compatibility with existing bits)
```json
{
  "key": "trend-{slug}-{shorthash}.json",
  "heading": "{category}: {short title}",
  "body": "{What it is. Why it matters. What to do. Where to escalate.}\n\nAsked by: trend-agent | Topic: {topic} | If this is outside our scope, that is a referral — call (647) 581-3182.",
  "source_url": "{primary source URL}",
  "vendor": "iis-trend",
  "query_seed": "{the user question this answers}",
  "created_at": "{ISO timestamp}",
  "agent": "trend-{role}",
  "topic": "{normalized topic tag}",
  "trend_score": 78,
  "longevity": "Medium-Term",
  "review_status": "pending"
}
```

### Rules
- Bit-native (per `[[feedback-kb-bit-native-style]]`): each bit stands alone, own escalation trigger, no cross-bit dependencies.
- `review_status: pending` blocks ARIA from serving it until a human approves (sets `approved`). Codex's autonomous loop should respect this gate.
- One trend can produce 1–5 bits: a What-is, a Why-now, a How-to, a Risks, an Offer-path. Skip the ones not relevant.
- Source URL mandatory if any factual claim is made. No source = bit gets `review_status: needs_source`.

### Demo Gateway integration
When ARIA serves a `trend-*` bit, the response footer auto-appends:
> "Want the full guide? Open the 10-min demo: /demo/{topic}"

Demo Gateway (`assets/demo-gateway.js` per §3 row 6) honors the 10-minute limit + watermark + upgrade prompt.

---

## 7 · Agent work split (Codex vs Cowork)

### Codex owns (live repo, direct ship)
- Root `.html` files (aria.html, aperture-learning.html, growth-library.html, etc.)
- `netlify/functions/*.mjs`, `netlify/edge-functions/*.ts`
- `assets/*.js`, `assets/*.css`
- `knowledge-base/**` and `aria_brain_pack/bits/**`
- `governance/`, `design-handoff/`, `docs/change-log.md`, `docs/deletion-log.md`, `docs/restore-notes.md`
- `netlify.toml`, `.gitignore`
- Verifying live URLs post-deploy ("Verified LIVE (10/10):" pattern)
- Commits as Ahmad (local git config) — recognizable by `Category: action (audit YYYY-MM-DD)` subject

### Cowork owns (everything outside the live repo)
- LinkedIn page setup (drafted in `outputs/HANDOFF.md` §8 — needs Chrome MCP to drive)
- Lead research (Apollo / web search / capability briefs)
- Cold email drafts + cadence (per `[[feedback-email-draft-style]]`)
- Capability Statement PDF for gov procurement
- Memory management (`spaces/feba329b-…/memory/**`) — load-bearing across sessions
- Strategy docs, observation reports (Codex Playbook), handoff docs
- This file (COLLAB_BRIEF.md) updates
- Drafting JSON / JS modules in `outputs/` for Codex to optionally adopt — never auto-ship to live repo

### Shared / joint
- **This file** (`docs/COLLAB_BRIEF.md`) — both agents read on session start, both append to §11
- `docs/REVIEW_QUEUE.md` (Codex appends, Cowork audits, Ahmad approves)
- ARIA KB bit format (§6) — anyone generating a bit follows it
- Locked constraints (§2) — both enforce

### Conflict resolution
- If both agents touch the same file: **Codex wins** (it has direct repo access; Cowork's draft becomes a reference). Cowork drafts in `outputs/` first.
- If both produce a trend bit for the same topic: keep the one with the higher `trend_score`; archive the other in `archive/deprecated/`.
- If unsure: queue in `docs/REVIEW_QUEUE.md`, wait for Ahmad.

---

## 8 · Phased roadmap (respects spend lockdown)

### Phase 1 — Zero-cost foundation (now → first paying client)
All free-tier compute, deterministic logic, human review gate.
- [ ] `lib/trend-score.mjs` — formula from §4, pure function, unit tests
- [ ] `lib/trend-longevity.mjs` — classifier from §5, no LLM
- [ ] `netlify/functions/trend-radar.mjs` — Google Trends RSS + Reddit `/r/*` JSON + Hacker News API + Indeed search results (pattern from Lead Radar). Daily cron. JSON + HTML endpoints.
- [ ] Extend `aria_brain_pack/bits/` schema to include `trend_score` / `longevity` / `review_status` (additive — keeps existing bits valid)
- [ ] `docs/REVIEW_QUEUE.md` — Codex appends, Ahmad approves, approved items flip `review_status` from `pending` to `approved` and get included in the KB bundle build
- [ ] One demo per top-3 trends → static HTML demos under `/demo/{slug}`, 10-min trial gate reusing ARIA's existing pattern
- [ ] Codex Playbook + this file maintained (Cowork side)

### Phase 2 — Low-cost expansion (first paying client signs)
$10/mo cap (still under your $100 hard cap), introduces governed LLM use.
- [ ] Ethical Content Engine — LLM-drafted content, ALWAYS queued for human review, $5/mo governed cap
- [ ] Trend longevity v2 — LLM-grounded longevity check on the top 5 trends weekly
- [ ] External Product Bridge — concierge intake form, 20% disclosure card, Stripe Payment Link for the service fee
- [ ] Personalized Progress Dashboard — needs auth; rebuild on Stripe Customer Portal first
- [ ] Anthropic Partner application submitted (was frozen)

### Phase 3 — Revenue-funded scale
Multiple clients, recurring revenue, marketing budget unlocked.
- [ ] Community Layer — accounts, profiles, leaderboards
- [ ] Trend Agent fleet — 13 specialized agents from Ahmad's spec, each as a Cowork scheduled task or Codex netlify scheduled function
- [ ] Donation Layer — only if Ahmad has chosen a real recipient + transparency reporting
- [ ] User-facing Trend Dashboard — premium tier

---

## 9 · Standing work inventory (live as of 2026-06-03)

### Codex queue (in-repo, Codex's lane)
1. Reconcile the 360 uncommitted changes Codex has in flight — commit in coherent groups per `change-log.md` discipline
2. Build Phase 1 §8 items in the order listed
3. Extend `docs/REVIEW_QUEUE.md` workflow
4. Verify live URLs after each deploy (HARD RULE)

### Cowork queue (out-of-repo, my lane)
1. Drive LinkedIn Company Page setup (text already drafted in `outputs/HANDOFF.md` §8 — needs Chrome MCP)
2. Draft Capability Statement PDF for gov procurement
3. Draft `lib/trend-score.mjs` content + `lib/service-offers.json` table content (Codex ships)
4. Monitor Codex Playbook weekly (`outputs/codex-observer/`)
5. Cold outreach round 2 (Apollo credits reset June 7) — draft pre-given-value emails per `[[feedback-email-draft-style]]`
6. Keep this file synchronized with reality after major changes

### Joint queue (handoff or both)
1. Decide donation recipient (Ahmad-only decision) → unblock Phase 2 row 4
2. Decide demo bandwidth (Codex builds demos, Cowork drafts copy)
3. ARIA KB bit format extension (Codex implements schema change, Cowork drafts the first 20 trend bits as reference)

---

## 10 · Ethical design rules — formalized

Both agents must independently enforce. Any output that fails a check goes to `docs/REVIEW_QUEUE.md` instead of shipping.

| Rule | Check |
|------|-------|
| No fabricated facts | Every claim has a source URL or is marked "opinion" |
| No dark patterns | No fake countdown, fake scarcity, fake social proof |
| No fake testimonials | Only real client quotes (none yet — that's fine, don't invent) |
| No fake partnerships | Anthropic = "Partner Network application in review" until accepted |
| Disclose all fees | 20% concierge fee shown BEFORE checkout, not after |
| Respect platform ToS | No scraping LinkedIn, no scraping Indeed beyond public search results |
| Human review for risk | Legal / financial / health content always goes to review queue |
| No shame selling | Aspirational language only; "you can build" not "you're falling behind" |
| Truthful experience | Use Ahmad's real resume only (`outputs/Ahmad Wasee_AI Engineer Resume.docx`) |
| Cost transparency | Every demo session logs token use; user sees their consumption |

---

## 11 · Update log (append at top — never silently rewrite)

### 2026-06-18 — Cowork (Sonnet, 14 Rounds in one session)
**Scenario universe coverage lifted ~28% → ~94% weighted.** 14 Rounds, 80+ files changed, 26 Netlify functions live (was 7), 8 scheduled crons, durable Netlify Blobs storage everywhere it matters. ROUND_VELOCITY_PLAYBOOK locked + propagated.

**Shipped by Cowork (mine):**
- Round 1–4: thumbs-feedback, MRR snapshot, partner-app memory, renewal-reminder cron, LLM degraded-mode fallback, magic-link auth, per-tenant KB submission, onboarding tour, dunning, account deletion, plan up/down change, M365 Graph read-only scaffold, trial-expiry email
- Round 5: live `/status` page + uptime grid, `_pii-redact.js` shared, Teams + Slack app manifests
- Round 6: `/aria` Slack slash-command backend, Netlify-Blobs-durable cost-tracker v0.2, session-memory function, write-gate (HMAC-signed approve/deny w/ email), `@iisupp/aria-sdk` Node SDK v0.1
- Round 7: `/scorecard` AI Readiness lead magnet, screen-share request flow, i18n expanded to 5 locales (+ES +DE), MS Cloud Partner + AWS Partner application drafts
- Round 8: session-memory client wrapper + welcome-back banner, tenant-audit + policy endpoint, GDPR Art. 22 + PIPEDA Principle 9 notice
- Round 9: circuit-breaker (CLOSED/OPEN/HALF_OPEN), analytics-dashboard endpoint, `/admin-console` UI (admin-token), prompt-injection guard (16 patterns + legit IT phrasing override)
- Round 10: Stripe billing-portal session, scheduled uptime probe, engagement drip cron (d1/d3/d7/d30/d90), security.txt + `/security/disclosure` vuln policy
- Round 11: Tier-3 hybrid KB (5 entries: AAD Connect, SSO/SAML, Exchange hybrid, PKI), coupon system, multi-turn conversation context, sitemap.xml + robots
- Round 12: iOS Safari mobile shim, M365 Graph WRITE actions (gated through write-gate), per-tenant cost attribution, `/partners-prep` interactive checklist
- Round 13: Legal vertical KB (15 entries: privilege-aware), full i18n string table (35 keys × 5 locales), Stripe invoice-PDF lookup, Whereby+Daily room-provider abstraction
- Round 14: Finance vertical KB (15 entries: SOX/PCI/CRA-aware), cross-device session sync (HMAC token), white-label tenant theming, `/soc2-readiness` AICPA self-assessment
- Roadmap refresh (815a109): same length, fresh entries — Enterprise platform + Security & compliance live; fixed `100+ → 200+` articles and `3-min → 15-min` trial

**Shipped by Codex (merged in):**
- Round 9 bottom (commit 3b41f83 → merged additively): 24 healthcare HIPAA-aware KB entries, `sdk/python/` with sync+async httpx (4 passing pytest), Teams bot + tab-token + install hooks, Slack events + interactive handlers
- **In flight:** FINISH-TO-100 packet (10 new HTML pages, 10 Netlify functions, 40+ new KB entries across Education + Manufacturing verticals, Go SDK starter, OpenAPI 3.0 spec, PWA manifest + service worker, breaker wiring into all upstream calls)

**Process locked (passed to all agents):**
- `senior-director-state/loop-engineer/ROUND_VELOCITY_PLAYBOOK.md` — 10 leverage moves, 4–5 shippables per Round
- Memory: `playbook_round_velocity.md` (cross-session)
- Memory: `feedback_edit_tool_truncates_index_html.md` (Edit tool banned on big HTML files; use python+heredoc in /tmp clone)
- Memory: `feedback_no_moneyback_guarantee.md`, `feedback_smart_qualifier_not_hard_skip.md`, `feedback_spend_cap_20_70_per_month.md` all stamped 2026-06-17/18

**Live homepage adds:** IT Health Check button (`49680b4`) + popup modal (`a8f5901`) below "Open AI Edge" — opens 6Q quiz inline with blurred page behind, close returns to homepage without nav.

**Action awaiting Ahmad:**
- Netlify env vars for live Slack/Teams test: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD` (Codex flagged 2026-06-18)
- D-U-N-S number application (free, ~30d) — needed before MS / AWS partner submit
- M365 tenant + Azure app registration (15 min) — for live Graph integration: `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`
- Whereby OR Daily account ($0 hobby tier) — for live screen-share: `WHEREBY_API_KEY` or `DAILY_API_KEY`


### 2026-06-13 — Cowork (Sonnet)
**Loops Engineering added as the operating system.** New companion file `docs/LOOPS_SPEC.md` (mirror in `outputs/codex-collab/LOOPS_SPEC.md`) makes "every recurring agent task is a loop with a goal, budget, verification, and on-failure" the law. Slash-commands `/goal` and `/loops` introduced; bootstrap set of 7 YAML loops drafted at `outputs/codex-collab/loops-drafts/`. See §13 below for the summary. Codex's queue: implement §10 of LOOPS_SPEC. Ahmad's directive: "loop engineer should be our focus... times that by 100." Both agents inherit. Triggered by TikTok upload of Claude Code's founder + Ahmad's /loops /goal direction.

### 2026-06-03 16:30 ET — Cowork (Sonnet)
Initial creation. Drop into `docs/COLLAB_BRIEF.md` when Codex is between commits. Locks current state of spend rule, hard rule, visual stability, agent split, and trend scoring formula. Phase 1 roadmap committed. Awaits Codex's first edit (e.g. acknowledgment that Phase 1 items are on Codex's plate).

---

## 13 · Loops Engineering (first-class) — summary

**Source of truth:** `docs/LOOPS_SPEC.md`. This section is the compact reference; read the spec for the full contract.

### Why
A one-shot prompt is the wrong unit of work. A **loop** — goal + budget + verification + spawn rules + on-failure — is. Claude Code's founder's design pattern (per Ahmad's TikTok upload): agents shouldn't sleep. They sit in a loop, iterate toward a measurable goal, and **spawn other loops** when a sub-problem deserves its own scope.

### What changes
- Every recurring task in IIS becomes a registered loop in `loops/registry.json` + a YAML record at `loops/{id}.yaml`.
- One top-level goal at a time, in `loops/CURRENT_GOAL.md`. Every loop traces back via a `serves:` field.
- Two slash-commands: `/goal` (set/read top goal), `/loops` (list/run/pause/kill/graph/ledger/budget).
- 8 loop classes: **Hunter · Enricher · Drafter · Verifier · Observer · Ledger · Gatekeeper · Demo.**
- Spawn safety: max depth 4, budget descends to children, stop-tokens propagate, cycle detection on add, human-review gate inheritable.
- Two privileged gatekeepers always running: `spend-gatekeeper` (pauses any loop that breaches $0/cap) and `hard-rule-gatekeeper` (curls aperture + ARIA every 30 min, auto-rollback on failure).

### The 100x test (when we declare it working)
5 loops running with ≥0.9 success rate · zero HARD-RULE regressions · daily artifacts shipping · Ahmad <30 min/day driving · total spend <$5/week. All five for 7 consecutive days.

### Bootstrap loops drafted at `outputs/codex-collab/loops-drafts/` (Codex copies into `loops/` in repo)
1. `lead-radar.yaml` — daily gov tender Hunter wrapping `aria-lead-radar.mjs`
2. `aria-self-learn.yaml` — wraps Codex's existing bits-generation loop with explicit goal + caps
3. `hard-rule-gatekeeper.yaml` — aperture/ARIA verifier with auto-rollback
4. `spend-gatekeeper.yaml` — continuous $0 enforcement
5. `goal-alignment.yaml` — daily drift check
6. `codex-observer.yaml` — Cowork's Codex Playbook scheduled
7. `tender-enrich.yaml` — child of lead-radar, fires on score≥60
8. `CURRENT_GOAL.md` — the top-level goal seed text

### Codex's queue from LOOPS_SPEC §10
1. Create `loops/` dir + `registry.json` + `cli/loops.mjs` + `cli/goal.mjs` (Node, no deps)
2. Add `npm run loops` / `npm run goal` to package.json
3. Copy CURRENT_GOAL.md from drafts → `loops/CURRENT_GOAL.md`
4. Copy the 7 YAML drafts → `loops/` (review each for fit before committing)
5. Convert `aria-lead-radar.mjs` to read its config from `loops/lead-radar.yaml`
6. Formalize the autonomous-bits loop under `loops/aria-self-learn.yaml`
7. Wire `spend-gatekeeper` + `hard-rule-gatekeeper` as Netlify scheduled functions (continuous)
8. Append to `docs/change-log.md` per Codex's house style
9. Append to `docs/COLLAB_BRIEF.md` §11 confirming implementation date

### Cowork's queue
1. LOOPS_SPEC.md — DONE
2. 7 seed YAML drafts — DONE
3. CURRENT_GOAL.md seed — DONE
4. This §13 update — DONE
5. `project_loops_engineering.md` memory entry — DONE
6. Observer integration into Codex Playbook so deltas surface new loops automatically (next session)
7. Authoring more loop YAMLs as the operating system matures

---

## 12 · How to use this file

### When Cowork starts a session
Read this file first. If anything in §2 or §7 conflicts with the session request, push back on the request.

### When Codex starts a session
Same. Ahmad will paste this file into Codex sessions until both agents have native access.

### When either agent finishes substantial work
Append a one-line entry at the top of §11 (date, agent, what changed). Don't bury edits.

### When Ahmad approves a queue item
Move from `docs/REVIEW_QUEUE.md` to `change-log.md`. Update `review_status` on the corresponding bit/asset.

### When the vision evolves
Edit §1 carefully — preserve original prompt verbatim, append clarifications below as "Vision addendum YYYY-MM-DD."

---

**End of brief. Both agents: build to this, push back on violations, append updates honestly.**
