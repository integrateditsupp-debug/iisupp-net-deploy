# STANDING RULES FOR ALL AGENTS
**Last update: 2026-06-18 by Cowork. Read this at session start. Pass to every subagent.**

This file is the single source of truth for the rules every agent (Cowork, Codex, OPS, leads, scheduled autopilots, dispatch agents, pinned agents) must follow. Memory file references are authoritative — these are summaries.

---

## RULE 1 — SPEND CAP $20-70 CAD/MONTH
**Memory:** `feedback_spend_cap_20_70_per_month.md`

- Max **$20-70 CAD/mo** total NEW operational/SaaS/compliance spend
- **NO pre-buying compliance** (SOC 2, ISO 27001, insurance upgrades) for unsigned contracts
- Spend ONLY after contract is signed + value justifies it
- **ASK AHMAD FIRST** before recommending or initiating ANY spend above current baseline
- Baseline allowed (no ask needed): Netlify, M365, Stripe, Anthropic API, DigitalOcean

## RULE 2 — SMART QUALIFIER (not hard skip)
**Memory:** `feedback_smart_qualifier_not_hard_skip.md`

When an opportunity requires something IIS doesn't have, **do NOT auto-skip**. Run the 4-step workaround tree:

```
1. Sub-prime under a certified vendor?  → apply as subcontractor
2. Scope down to avoid the gap?         → apply with scoped proposal
3. Obtain cert post-award?              → apply with "compliance on award" letter
4. Value > Year 1 cert cost × 3?        → flag spend ask to Ahmad
ONLY IF ALL FOUR FAIL → skip + log the 4 attempts
```

Workarounds by gap:
- **SOC 2**: sub-prime + cite our `/governance/information-security` ISMS
- **ISO 27001**: sub-prime + 12-month roadmap-on-award
- **Insurance**: bind cert ON award (insurers issue in 5 days)
- **CA Reliability/Secret**: scope unclassified + partner cleared vendor
- **US Federal clearance**: skip US classified entirely
- **Regional incorporation**: branch ON sign, or local sponsor, or remote contractor
- **Specific tech cert**: "cert complete by kickoff"

## RULE 3 — SHIP NOW, NO TOMORROW
**Memory:** `feedback_ship_now_no_tomorrow.md`

- Never say "tomorrow," "later," "when you have time" if work can ship NOW
- For recurring work, **use scheduled tasks** so loop continues offline
- For idle periods, auto-delegate to $0 improvements in your lane

## RULE 4 — REVENUE-FIRST ORDERING
**Memory:** `feedback_revenue_first_ordering.md`

- Always rank work by (revenue × probability × speed)
- Revenue-generating tasks ALWAYS before busy work
- High-value contract apply > internal docs > optimizations

## RULE 5 — RESUME-HONEST CLAIMS
**Memory:** `reference_ahmad_resume_facts.md`

- Claim **15+ years IT** (NOT 21+) — verified from resume start at IBM Jan 2011
- Real certs only: ITIL, Six Sigma Yellow Belt, Anthropic Academy ×5, PMP, Agile
- DO NOT claim: MS-100, MS-101, CISSP, CISM, CompTIA, CMT, M365 Enterprise Admin Expert (cert)
- Verticals OK to cite: capital markets (RBC), Big-4 IT (IBM), healthcare PHIPA (Ontario Health), legal (Cavalluzzo), municipal (City of Toronto), Scotia Bank
- **HARD RULE: NO Raymond James mention anywhere** — even though it's 6+ years of tenure

## RULE 6 — VISUAL STABILITY ON iisupp.net
**Memory:** `feedback_visual_stability.md` + `feedback_preview_before_push.md` + `feedback_aperture_aria_never_break.md`

- NEVER change look/theme/copy on iisupp.net without explicit ask
- For structural changes (hero, layout, sections): preview FIRST via SVG/HTML mockup
- Small text fixes, bug fixes, additive content: ship straight to push
- Tail-integrity check MANDATORY before every HTML push (tag balance + `</html>` confirm)

## RULE 7 — NO FAKE PROOF
**Memory:** `project_no_testimonial_proof_playbook.md`

- No fake testimonials, fake partnerships, fake search volume, copied products, spam
- No money-back guarantee / refund promise / "risk-free" language anywhere on iisupp.net
- Premium positioning carries itself — don't cheapen it with refund clauses
- Substitute proof: founder credibility, sample scenarios, build metrics, methodology grid, live trial

## RULE 8 — APERTURE + ARIA NEVER BREAK
**Memory:** `feedback_aperture_aria_never_break.md`

- After every deploy that touches `aria.html` or `assets/aria-core.js` or `assets/aria-trial.js`: verify ARIA still loads, paywall fires, trial bar counts, voice-mode works
- Hotfix immediately if anything regresses

## RULE 10 — SHORTEST PATH FIRST  *(LOCKED 2026-06-19)*
**Memory:** `feedback_shortest_path_first.md`

- Before any task, pick the SHORTEST code path that delivers the actual outcome.
- **Bake config in code over env vars** when the value isn't secret (Stripe price IDs, public API endpoints, public keys).
- **One commit beats a setup script** when the task is bounded.
- **Don't ask Ahmad to run a script** when a code edit ships the same outcome.
- **Real secrets stay in env vars** (Stripe SECRET key, Anthropic key, admin passwords). Everything else: question whether env-var indirection actually helps.

## RULE 9 — EVERY DETAIL PERFECT, LIMIT THE COUNT  *(LOCKED 2026-06-18)*
**Memory:** `feedback_perfect_details_limit_count.md`

- Every detail customers see must be **perfect**: clear in 5 sec, CEO-grade copy, no TODO/Lorem/placeholders, mobile+desktop intentional, tag balance verified, trust signals consistent (15+ yrs IT, real claims).
- **Limit the NUMBER of details.** Fewer surfaces, higher polish. Default answer is "polish an existing surface, don't add a new one."
- Before shipping ANY new customer-facing page/section/badge/CTA: justify why it deserves to exist AND that we can make it perfect. If either fails → kill it or merge into existing.
- **Backend / crons / functions** are exempt — they compound invisibly.
- **Pruning is now a first-class action.** Audit → keep/merge/kill.
- Watchout: during autonomous windows, do NOT add customer-facing surfaces. Use that time to audit, polish, and prune.

---

## AGENT-SPECIFIC INSTRUCTIONS

### For scheduled autopilots (contract hunters, lead scrapers)
- Apply Rule 2 (Smart Qualifier) to every opportunity before classifying as skip
- Generate brief in fixed format — see `daily-international-contract-scan` task for template
- Flag ALL spend asks at top — never silently incur cost

### For Codex (code work)
- Apply preview-before-push rule (Rule 6)
- Read this file at task start
- Tail-integrity check before every HTML write

### For OPS agent (operations + leads)
- Apply outreach cadence: ≤5 sends/2h gap/3min intra
- CASL footer on every cold email (identity + unsubscribe + consent basis)
- Log to casl-consent-log.md

### For Cowork (this session's agent)
- Use Plan + Tasks tools liberally
- Push memory updates the moment Ahmad confirms a new standing rule
- Update THIS file when new standing rules lock

---

## RULE 11 — TOKEN-EFFICIENCY + STYLE (all agents, every run)
Goal: spend the fewest tokens that still do the job right (Ruben Hassid "21 hacks", distilled).
1. Read ONLY what the task needs. Never load a whole folder or the whole vault — pick the exact files. No file needed -> load none.
2. Keep input tight (aim < ~2000 words). Trim, do not dump.
3. ONE pass: a single specific prompt with all steps beats many round-trips.
4. Right model for the job: cheap/fast model for format/grammar/simple pulls; big model only for real reasoning.
5. Tight output: ask for exactly what is needed; "just the output, no commentary" when that is all.
6. One topic per run. Unrelated task = new run, not a pile-on.
7. Long run -> every ~15-20 steps write a short state summary to a file and continue from it; do not re-chew history.
8. Targeted fixes only: redo the wrong part, not the whole thing.
9. Recurring work stays SCHEDULED; do not re-run by hand.
10. STYLE: default to concise / "caveman-short" phrasing in chat, agent outputs, and NEW vault notes — UNLESS the content is CRITICAL (commands, file paths, prices, code, safety, decisions, specs), then be precise and complete. Do NOT mass-rewrite existing vault notes (corruption + info-loss risk); apply the short style to new/edited notes only.

## CHANGE LOG

| Date | Change |
|---|---|
| 2026-06-17 | Initial publication after spend-cap + smart-qualifier + ship-now rules locked |
| 2026-06-18 | RULE 9 added: every detail perfect, limit the count. Customer-surface freeze + audit-and-prune pass mandated. |
| 2026-06-25 | RULE 11 added: token-efficiency workflow + concise/caveman style default (critical content stays precise; no destructive vault rewrite). |
