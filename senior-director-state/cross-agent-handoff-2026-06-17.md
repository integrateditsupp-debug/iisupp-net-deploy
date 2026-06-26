# Cross-Agent Handoff — 2026-06-17

**Issued by:** Cowork.
**Audience:** every IIS / ARIA agent. Read your section. Execute under standing pre-approvals.
**Why:** today Cowork shipped 41 deliverables + 4 new standing rules. This packet hands the next moves to the right agent without further Ahmad input.

---

## NEW STANDING RULES — apply immediately (UPDATED 2026-06-17 PM)

**LATEST ADDITIONS (Cowork sprint 2):**
11. **[feedback_parallel_tracks]** LOCKED 2026-06-17 — every Cowork response ships 3-5 deliverables (raised to 5-10 with rule 12).
12. **[feedback_loop_frequency_high]** LOCKED 2026-06-17 — worker tick 1-2 min, Cowork 5-10 deliverables / response, hourly KB build, 5-min idle-improvement fire, 48h critique tick. See `senior-director-state/director-cadence-update-2026-06-17.md`.
13. **`loops/packet-watcher.mjs`** shipped — read-only stale-packet detector. Cron every 2h. Reports to `senior-director-state/loop-engineer/stale-packets.md`.
14. **`bid-briefs/bid-filter-cheatsheet-2026-06-17.md`** shipped — 1-page tender-portal filter every agent runs in 30 sec before deeper investment.
15. **ARIA LIBRARY at 833 routing states + 964 articles** (Bundle v3.8). Production v3 unchanged at 143.
16. **Service Skills v1.1** — 10 sector tone overlays added: `aria-architecture/aria-service-skills-v1-1-sectors.json`.

Every agent reads + applies on first action of every session:

1. **[feedback_revenue_first_ordering]** — pick highest-revenue tier first. 10-tier order from active deals down to nice-to-have.
2. **[feedback_idle_brainstorm_loop]** PRE-APPROVED — idle agents auto-delegate to $0 improvements in their lane.
3. **[feedback_ship_now_no_tomorrow]** LOCKED — no deferrals. Use scheduled tasks for offline continuation.
4. **[feedback_form_fill_leave_tab]** PRE-APPROVED — any form encountered: fill every field from memory + repo state, leave tab open with final-button visible for Ahmad, open new tab, continue. Submit-actions stay Ahmad-gated.
5. **[reference_linkedin_apply_throttle]** — LinkedIn limited Chrome MCP applies today. Slow timing, ≤20 Easy Applies / day / profile, pause 5-15 min between batches.
6. **[feedback_spend_cap_20_70_per_month]** LOCKED — max CAD $20-70 / month new spend. Ask first.
7. **[feedback_smart_qualifier_not_hard_skip]** LOCKED — work around compliance gaps (sub-prime, scope-down, cert-on-award) before skipping any opportunity.
8. **[feedback_no_moneyback_guarantee]** LOCKED — no refund / guarantee / risk-free language on iisupp.net.
9. **[feedback_html_edit_tail_check]** — tag balance + `</html>` check MANDATORY before pushing large HTML edits.
10. **[feedback_preview_before_push]** LOCKED — visual changes get a mockup preview FIRST, push ONLY after Ahmad approves.

---

## KB AGENT

**Owns:** ARIA KB content quality + bundle promotion.

**Open work:**
1. **Convert Perplexity raw batch 3** (`aria-architecture/perplexity-raw-batch-482-581.md`, 97 issues) into ARIA bit-native v1.6 add-on. Same shape as v1.5 — symbolic state + pattern + to_human + confidence + business_impact + priority. Dedupe vs unified routing (521 states).
2. **Verify staged bundle v3.3** (652 articles) → spot-check 20 random new articles render correctly via ARIA retrieval. If clean, recommend swap to production.
3. **Populate the 167 stub articles in v3.1** flagged at intro time — author full slow-delivery `steps[]` for any P1/P2 state still serving as a stub.
4. **Continue Perplexity loop** — Cowork left tab `tabId=1193173487` open on Perplexity thread `a1d93328`. Use that thread; ask for next 100 issues focused on Asset/license mgmt (Lansweeper/ManageEngine/Spiceworks/Snipe-IT) and Print server / SMB share advanced (these were truncated from batch 3).

**Schedule under [[feedback_ship_now_no_tomorrow]]:** create a scheduled task `kb-batch-loop` daily 06:30 ET that runs one Perplexity batch + v1.x conversion + dedupe vs unified routing.

---

## CODEX (returning 2026-06-17 today)

**Owns:** repo builds. Read these in order on session start:

1. `senior-director-state/loop-engineer/claude-critique-2026-06-16.md` — 3 highest-priority packets queued.
2. `senior-director-state/bid-briefs/codex-commit-spec-claim-honesty-2026-06-16.md` — single commit, 9 honesty fixes, 7 files, ~20 string replacements. Branch `cowork/honesty-pass-2026-06-16`. Push when Ahmad signs off.
3. `aria-architecture/phased-response-clarify-q-pack.md` + `symbolic-state-dictionary-v1-1-add-on.json` — Phased Response (PACKET 2) has zero content blockers now. Ship.
4. `senior-director-state/bid-briefs/past-performance-FILLED-2026-06-16.md` — RBC + Ontario Health + IIS/ARIA reference engagements drafted; no Codex action required, just respect when generating bid responses.
5. `loops/packet-watcher.mjs` mini-spec (in `senior-director-state/loop-engineer/loop-system-improvements-2026-06-16.md`) — build read-only stale-packet watcher.

**Use [feedback_html_edit_tail_check] before any large HTML push.** 2026-06-17 incident broke live gate.

---

## CLAUDE CODE (offline-bridge handler)

**While Codex is offline:** read `senior-director-state/loop-engineer/claude-code-next-prompt.md` packet header standard. Same 3 packets, same priorities.

---

## SENIOR DIRECTOR

**Owns:** agent coordination + the idle-improvement loop.

**Open work:**
1. **Enforce [feedback_idle_brainstorm_loop]** — any idle agent without a queued task gets routed into a $0 improvement in its own lane per `senior-director-state/director-operating-board.md` Standing Duty section.
2. **Route the form-fill-leave-tab rule** to contract-scout, tender-review, business-development, outreach-prep. They apply on every portal / form / registration encounter.
3. **Re-check Anthropic Partner submission status** — verification-findings flagged `outputs/anthropic-partner/` missing from repo. Ahmad's yes/no on submission status unblocks PSPC bid positioning.
4. **Daily packet-age check:** any packet with `Status: queued` + `Last touched ≥ 7 days` surfaces in next critique.

---

## CONTRACT-SCOUT + TENDER-REVIEW

**Owns:** government + private bid pipeline.

**New playbook:**
1. Apply **[feedback_form_fill_leave_tab]** on every CanadaBuys / MERX / Ontario Tenders / SAP Ariba portal. Fill what you can; leave the submit button for Ahmad.
2. Use **`iis-federal-bid-supplement-2026-06-16.md`** as the canonical answer source for every federal bid:
   - NAICS 541510–541519, GSIN D302A–D399A, PBN ACTIVE (locked from resume)
   - Insurance NOT IN FORCE → only bid remote-only advisory / methodology lanes
   - No security clearance → skip Reliability / Secret requirement bids
   - Past performance: RBC + Ontario Health + IIS/ARIA (Raymond James EXCLUDED)
3. Apply **[feedback_smart_qualifier_not_hard_skip]** — workaround scope (sub-prime, scope-down, cert-on-award) before rejecting any bid.
4. Active live action: **OSFI Ransomware Tabletop** (CanadaBuys cb-553-91017696). Bid brief at `senior-director-state/bid-briefs/osfi-ransomware-tabletop-2026-06-16.md`. Response skeleton at `osfi-ransomware-tabletop-response-skeleton-2026-06-16.md`. Cover letter at `osfi-cover-letter-shell-2026-06-16.md`. SOW pull still pending Ahmad+Chrome session.
5. **PSPC AI Source List** — Band 1 target. Skeleton at `pspc-ai-source-list-skeleton-2026-06-16.md`. Deadline 2026-09-30.

---

## OUTREACH-PREP + BUSINESS-DEVELOPMENT

**Owns:** lead drafts + LinkedIn / web outreach.

**New rules:**
1. **[reference_linkedin_apply_throttle]** — slow timing, ≤20/day per profile, batch-pause 5-15 min, no retry after throttle.
2. **[feedback_form_fill_leave_tab]** — same as scouts. Apply on Apollo, HubSpot, LinkedIn Easy Apply, Indeed, Glassdoor.
3. **Ahmad's resume facts locked** at `reference_ahmad_resume_facts.md`: 15+ years IT (since 2011), NOT 21+. Real certs only. **No Raymond James citation anywhere.**
4. **[feedback_email_draft_style]** — observe-imply-preview pattern. No how / price revealed in cold email.
5. **3 leads still in send-queue:** WD Numeric, Tangs Accounting, Global Health Physio. Ahmad sends when ready.

---

## LEGAL-SAFETY-REVIEW

**Owns:** claim-accuracy + reputation pre-push.

**Open work:**
1. **9 claim-honesty findings** consolidated at `senior-director-state/bid-briefs/codex-commit-spec-claim-honesty-2026-06-17.md`. One-commit fix ready. Track Ahmad's sign-off + verify smoke-test passes.
2. **17-trend cybersecurity lane** (Risk Triage at `senior-director-state/trend-radar/risk-flagged-triage-2026-06-16.md`): 3 KILL (not IIS scope) + 17 KEEP (real opportunities). Process when Ahmad approves.
3. **[feedback_no_moneyback_guarantee]** patrol — flag any new refund/guarantee/risk-free copy that lands on iisupp.net.
4. **Monitor ARIA-public vs federal-safe one-pager parity** going forward.

---

## ARIA-PRODUCT + GROWTH-LIBRARY-PRODUCT

**Owns:** product packaging.

**Open work:**
1. **17 cybersecurity preview-page outlines** at `senior-director-state/cyber-preview-outlines-batch-2026-06-16.md`. All 17 reframed advisory-only. Codex mass-produces HTML after Approval Batch A wave 1 publishes.
2. **ARIA monetization audit** at `senior-director-state/aria-monetization-audit-2026-06-16.md` — Path 1 recommended (reframe enterprise tiers as "Roadmap Pricing — Charter Customer Pre-Order"). Awaits Ahmad pick.
3. **Service-skills v1.0** at `aria-architecture/aria-service-skills-100.json` — 100 skill overlays ARIA applies on emotion/phase detection. Pairs with KB recipes.

---

## TREND-RADAR + PRODUCT-PACK

**Owns:** demand-to-product pipeline.

**Open work:**
1. **80 risk-flagged trends triaged** at `senior-director-state/trend-radar/risk-flagged-triage-2026-06-16.md`. 3 KILL one-click + 17 KEEP for product-pack-loop.
2. **Trend Radar dashboard** (PACKET 1 in loop-board) — Codex builds. Default tab = Top 20 by `score.total × (1 − risk_score/10)`.

---

## TREASURER + SRE

**Owns:** $$$ + infra.

**Open work:**
1. **[feedback_spend_cap_20_70_per_month]** LOCKED — track all $0-70 CAD/mo decisions against the cap.
2. **DigitalOcean droplet terminated** 2026-06-04 — card 2661 still failing 2026-06-16. PayPal alternative? Awaits Ahmad.
3. **Netlify site suspension risk ~Jul 2** (per memory). Same card 2661.
4. **STRIPE_SECRET_KEY missing prod** = stripe:false on /health. Engineering verify needed before any /plans traffic. Per `aria-claim-conflicts-supplement-2026-06-16.md` Finding 9.

---

## WORKSPACE-STEWARD

**Owns:** workspace hygiene.

**Open work:**
1. **Memory consolidated** 2026-06-16 + 2026-06-17 — 86+ entries indexed. Monitor for new bloat.
2. **Stale-packet watcher** — read `loop-engineer/loop-system-improvements-2026-06-16.md`. Build watcher script (assigned to Codex; Steward monitors output).
3. **Raw KB batches** awaiting v1.6 conversion at `aria-architecture/perplexity-raw-batch-*.md` (3 files, 281 issues raw). KB Agent owns conversion; Steward verifies dedupe pass.

---

## AHMAD — single approval pass unlocks the most velocity

In order of unlock-per-minute:

| # | Action | Time | Unlocks |
|---|---|---|---|
| 1 | **Approval Batch A** — 29 staged slices Y/N/Defer | 10 min | 16+ publishes |
| 2 | **Past-Performance** — confirm reference-contact perms on RBC / Ontario Health / Cavalluzzo | 30 min | Every federal bid Section 5 reusable |
| 3 | **5 claim picks** in `aria-claim-fix-alternates-2026-06-16.md` | 5 min | Website matches federal-safe |
| 4 | **OSFI cover-letter approve** + sign | 2 min | OSFI submission unlocks once SOW pulled |
| 5 | **Anthropic Partner status** (yes/no/pending) | 1 min | PSPC positioning decision |
| 6 | **BN / GST/HST look-up + tax certs** | 1-2 days elapsed | OSFI + PSPC + every future federal |
| 7 | **DigitalOcean payment** decision (card 2661 vs PayPal) | 5 min | ARIA infra restored |
| 8 | **9-fix honesty commit** sign-off | 2 min | One Codex commit → website matches federal-safe one-pager |

---

## OPEN INPUTS COWORK CANNOT SELF-CLEAR

- Live SOW pull (OSFI tender) — needs Ahmad's browser session OR Nimble auth.
- Anthropic Partner submission state — file directory missing from repo.
- Past-perf reference contacts — only Ahmad knows reachability.
- Card 2661 vs PayPal — Ahmad financial decision.

---

## CADENCE

- **Idle-improvement loop fires automatically** when any agent has no queued task.
- **Director board re-checked** every worker tick (current cadence: ~5 min).
- **Critique re-runs** when loop-board / claude-next-prompt drift > 7 days OR any packet flagged stale.
- **Promise-and-deliver:** [feedback_form_fill_leave_tab] applies to every external form encounter, every session.

## One-line summary

> 10 standing rules now active across all agents. Each agent has named open work + single-action Ahmad approval list ranked by unlock-per-minute. Loop continues under standing pre-approval; federal-bid lane stays priority #1 of revenue-first.
