# Trend Radar — Risk-Flagged Triage (2026-06-16)

**Owner:** Cowork (idle-improvement loop, strategy lane).
**Input:** 80 risk-flagged review-queue items in `senior-director-state/trend-radar/review-queue.json`.
**Output:** ranked triage of the underlying 20 trends (each trend = 4 review items).
**Why this exists:** PACKET 1 (Trend Radar dashboard) needs a known-good Risk Quarantine starter state. Surfacing 80 items as a flat list is noise. The real answer is 20 trends with 3 clear strategic decisions.

---

## The 80 items reduce to 20 trends

| Category | Trends | Items | Action |
|---|---|---|---|
| security_accuracy_review | 17 | 68 | KEEP — these are core IIS cybersecurity lanes. Flag means "review claims for accuracy before public copy," not "block." |
| child_privacy_and_safety_review | 1 | 4 | KILL — not an IIS lane. |
| money_or_finance_claim_review | 1 | 4 | KILL — not an IIS lane. |
| health_claim_review | 1 | 4 | KILL — not an IIS lane. |

## KILL list (3 trends → remove from queue, 12 items cleared)

These got auto-tagged because they were in the keyword universe but they're not Integrated IT Support's market. Public IIS pages making claims about kids' education, consumer finance tracking, or health wearables would create legal and brand-damage exposure — and even producing internal content here is wasted effort.

| Trend ID | Keyword | Score | Reason to kill |
|---|---|---|---|
| ai-tutor-for-kids-9 | AI tutor for kids | 72 | Child-services regulation. Not IIS scope. |
| ai-finance-tracker-97 | AI finance tracker | 61 | Consumer finance + securities-law exposure. Not IIS scope. |
| ai-health-wearable-92 | AI health wearable | 60 | Medical-device regulation. Not IIS scope. |

**Mechanic:** when the dashboard ships (PACKET 1), these 3 should be in the Risk Quarantine tab with a default action of `Kill` and a 1-click "Kill all 3" button.

## KEEP list — 17 cybersecurity trends (a strategic GIFT, not a risk)

These trends are the strongest IIS-fit cluster in the whole Radar. Average score 68/100, all Long longevity, all `security_accuracy_review` flag. The flag means: any public claim about "We do X" needs claim-accuracy review (e.g., don't say "guaranteed" or "100% protection"). It does NOT mean "block."

**Ranked by trend score then by IIS revenue speed:**

| # | Trend | Score | Why it matters to IIS |
|---|---|---|---|
| 1 | SOC automation | 75 | Pairs with ARIA helpdesk packaging — high-margin retainer. |
| 2 | AI security platform | 74 | Bundle ARIA + IIS managed detection as one offer. |
| 3 | AI phishing protection | 74 | Drop-in offer for any M365 client; recurring revenue. |
| 4 | M365 security hardening | 68 | Already an IIS-named offer (M365 Tune-Up). Direct revenue match. |
| 5 | MFA rollout | 67 | One-day implementation; high-margin small business deal. |
| 6 | Ransomware readiness | 67 | Tabletop + remediation playbook = paid engagement. |
| 7 | Password manager rollout | 67 | 1Password/Bitwarden deployment; recurring tail. |
| 8 | DMARC setup | 67 | Per-domain configuration; quick-win retainer add-on. |
| 9 | Zero trust small business | 67 | Strategy-engagement gateway; high-ticket. |
| 10 | Endpoint security for small business | 67 | EDR rollout = recurring license + management fee. |
| 11 | Passkeys for business | 67 | New tech; positioning advantage. |
| 12 | Software patch management | 67 | Core managed-services pillar. |
| 13 | Backup and recovery plan | 67 | One-time plan + recurring drill subscription. |
| 14 | Cybersecurity audit checklist | 67 | Free lead magnet → paid audit upsell. |
| 15 | Cybersecurity awareness training | 67 | Annual recurring per-seat revenue. |
| 16 | Data loss prevention | 67 | Mid-market upsell. |
| 17 | Digital provenance and content authenticity | 67 | Emerging — content-trust positioning for media clients. |

**Strategic note:** if Ahmad approves the Lane 2 preview-page pattern from Approval Batch A, the **next** preview-page batch should target these 17 cybersecurity lanes — each gets its own `downloads/library/<topic>-preview.html` and CTAs on services.html / shop.html. That converts the "risk quarantine" into the next product line.

## What PACKET 1 (Trend Radar dashboard) should do with this

1. **Risk Quarantine tab default sort:** group by flag category. `child_privacy_and_safety_review` + `money_or_finance_claim_review` + `health_claim_review` get a banner "Recommended: Kill all (not an IIS lane) — Cowork triaged 2026-06-16." One click removes them.
2. **Security-accuracy bucket gets a different banner:** "These 17 trends are high-fit IIS cybersecurity opportunities. Flag means: review public copy for unsupportable claims before publishing. Default action: Approve for product-pack-loop."
3. **Decision logging:** kill decisions append to `decision-log.jsonl` with `{trend_id, decision:"kill", actor:"cowork-triage", ts:"2026-06-16", reason:"not-iis-scope"}` so we don't re-litigate them.

## Net effect on the backlog

- Before triage: 80 risk-flagged items, undifferentiated.
- After triage: 12 items to kill (one click), 68 items that are actually high-fit product candidates needing standard claim-accuracy review.
- The "risk" in Risk Quarantine was 85% mislabel. The real backlog is one batch decision plus 17 product-pack-loop candidates.

## Stop rules

- No public publish from this triage. PACKET 1 dashboard surfaces these recommendations; Ahmad clicks through.
- KILL on the 3 non-IIS trends is reversible — the data stays in `decision-log.jsonl`; nothing is permanently deleted.
- The 17 sec-accuracy trends do NOT skip claim review. They get reviewed in product-pack-loop normally; this triage just unblocks them from looking like compliance risks.
