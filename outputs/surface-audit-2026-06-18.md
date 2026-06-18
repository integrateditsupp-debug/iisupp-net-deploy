# Surface audit — every public iisupp.net page (2026-06-18)

Triggered by Rule 9: "Every detail perfect. Limit the count."

**Scoring (1-10) is against the "perfect" definition:**
- Clear in 5 sec
- CEO-grade copy, no placeholders
- Mobile+desktop both look intentional
- Tag balance verified
- Trust signals consistent (15+ yrs IT, no fake claims, no money-back lang, no RJ)
- Visual stability respected
- ARIA + Aperture untouched

**Verdicts:** KEEP (passes + deserves to exist) · POLISH (good but raise the bar) · MERGE (consolidate into nearby cousin) · KILL (not deserving, drop from sitemap)

---

## Core revenue surfaces (always KEEP, polish-only)

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/` (index.html, homepage) | 9 | KEEP | Already strong. No structural change. Verify trial paywall + Stripe wiring on next push. |
| `/aria` | 9 | KEEP | Voice-mode and chat work. Keep ARIA/Aperture untouched per hard rule. |
| `/plans` | 8 | POLISH | Confirm 5 tiers display correctly on mobile flip, all Stripe checkout URLs resolve. |
| `/product.html` | 7 | POLISH | Tighten lede. Match homepage hero language. |
| `/start-here.html` | 7 | POLISH | First-time visitor flow — verify it answers "what now?" in 5 sec. |
| `/services.html` | 7 | POLISH | Confirm 15+ yrs claim (not 21+). Real certs only. |

## Vertical pitches (4 pages — KEEP all, but consolidate index)

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/verticals/` | 6 | POLISH | Index page — currently lightweight, could be the "choose your industry" hub. |
| `/verticals/healthcare` | 7 | KEEP | Compliance angle strong. Verify HIPAA cross-border framing accurate. |
| `/verticals/legal` | 7 | KEEP | Specialty KB ties to this. |
| `/verticals/finance` | 7 | KEEP | Strongest revenue vertical. |

## Procurement / large-account pages

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/enterprise` | 7 | KEEP | RFP-friendly entry. |
| `/government` | 7 | KEEP | Procurement playbook entry. |

## Compliance pages (consolidation candidate — too many)

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/privacy` | 8 | KEEP | Legal. Required. |
| `/terms` | 8 | KEEP | Legal. Required. |
| `/ai-governance` | 7 | KEEP | Real differentiator. Required by Rule 9 trust signal. |
| `/compliance/automated-decisions` | 6 | **MERGE** | Roll into `/ai-governance` as a section. Currently a single-purpose page. |
| `/compliance/iso-27001-readiness` | 5 | **MERGE** | Merge into one `/compliance` hub page with anchor sections. |
| `/compliance/pipeda-readiness` | 5 | **MERGE** | Merge into `/compliance` hub. |
| `/soc2-readiness` | 6 | **MERGE** | Merge into `/compliance` hub. |
| `/compliance-gap` | 6 | POLISH | Lead-capture surface. Keep but tighten copy to 5-sec clarity. |

**Recommendation:** kill 4 standalone compliance pages, build 1 `/compliance` hub with anchor links. Drops 4 surfaces → 1 great one.

## Lead-capture surfaces (too many — strong consolidation candidate)

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/scorecard` | 6 | **MERGE** | AI readiness scorecard — duplicates `/health-check` intent. |
| `/health-check` | 7 | KEEP | The 3-question modal on homepage already drives this. |
| `/cost-calculator` | 6 | **MERGE** | Currently low-traffic. Merge as a section inside `/plans`. |
| `/refer` | 6 | POLISH | Referral program — fine, but verify the cookie + tracking works. |
| `/webinar` | 5 | **KILL** | No webinar scheduled. Either schedule one or kill the page. |
| `/insiders` | 5 | **MERGE** | Newsletter signup — merge into homepage footer + `/start-here`. |
| `/book` | 8 | KEEP | Founder-direct demo. High-intent surface. |

**Recommendation:** kill `/webinar` (until we actually run one), merge `/scorecard` into `/health-check`, merge `/cost-calculator` into `/plans`, merge `/insiders` into homepage. 7 → 4 surfaces.

## Sample / proof surfaces

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/sample-scenarios` | 8 | KEEP | Strong proof page, founder-credibility forward. |

## Comparison pages (likely no organic search traffic — 3 dead pages)

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/compare/` | 4 | POLISH or KILL | If this hub has no traffic, kill it. |
| `/compare/aria-vs-msp-x/` | 4 | KILL | "MSP X" is a placeholder competitor — fake comparison. KILL immediately. |
| `/compare/aria-vs-retell/` | 5 | POLISH | Real competitor (Retell AI). Polish copy to be honest comparison, not marketing puff. |
| `/compare/aria-vs-vapi/` | 5 | POLISH | Real competitor (Vapi). Same — polish. |

**Recommendation:** kill `/compare/aria-vs-msp-x/` immediately (fake-competitor risk). Polish the other two with honest comparisons.

## Admin / internal (correctly noindex — keep all)

These are not customer-facing, so Rule 9 doesn't apply at the same intensity:
- `/admin-console`, `/leads-admin`, `/revenue-dashboard`, `/usage`, `/partners-prep`, `/white-label-admin`, `/tenant-admin`, `/status-history`, `/write-gate-history`, `/cost-dashboard`, `/analytics`, `/soc2-evidence-inventory`, `/ipv6-readiness`, `/pricing-experiments`
- All noindex'd. Keep as-is.

## Other / legacy

| Page | Score | Verdict | Polish action |
|---|---|---|---|
| `/ai-edge.html` | 6 | POLISH | Learning paths — verify content reads CEO-grade. |
| `/growth-library.html` | 6 | POLISH | Confirm not stale. |
| `/marketplace.html` | 5 | POLISH or MERGE | Currently sparse. Decide: build to perfect or merge into `/start-here`. |
| `/docs/api` | 7 | KEEP | Engineer-facing — important for technical credibility. |
| `/security/disclosure` | 8 | KEEP | Vulnerability disclosure program. Trust signal. |
| `/status` | 8 | KEEP | Uptime page. Trust signal. |
| `/aria-trial`, `/tenant-onboarding` | n/a | KEEP | Functional flows, not pitch pages. |

## Summary — surfaces today vs proposed

- **Today:** ~38 public + ~15 admin = 53 surfaces
- **Proposed:** ~28 public + ~15 admin = 43 surfaces
- **Reduction:** 10 customer-facing surfaces eliminated
- **Time to bring all surviving surfaces to 9/10:** ~6 polish passes (1-2 hours each)

## Execution order (revenue impact × ease)

1. **Kill `/compare/aria-vs-msp-x/`** — fake-competitor risk (Rule 7). 5-min job.
2. **Kill `/webinar`** until a real webinar is scheduled.
3. **Build one `/compliance` hub** with anchor sections for SOC 2, ISO 27001, PIPEDA, automated decisions. Then 410 the 4 old paths.
4. **Polish homepage `/`** to 10/10 — already 9/10. Tightest possible 5-sec clarity test.
5. **Polish `/plans`** to 10/10 — every Stripe URL verified live, every mobile flip tested.
6. **Polish `/sample-scenarios`** — already 8/10. Push to 10/10.
7. **Honest competitor comparisons** for `/compare/aria-vs-retell/` and `/compare/aria-vs-vapi/`.
8. **Merge `/scorecard` + `/cost-calculator` + `/insiders`** into their cousins.
9. **Vertical pages polish pass** — finance, healthcare, legal, government.

**Rule 9 freeze remains in effect:** no new customer-facing surfaces until this audit list is executed.

— Cowork, 2026-06-18
