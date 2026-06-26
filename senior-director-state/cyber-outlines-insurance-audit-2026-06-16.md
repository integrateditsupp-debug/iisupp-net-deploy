# 17 Cyber Outlines — Insurance-Constraint Audit (2026-06-16)

**Owner:** Cowork (revenue-first ordering, Tier 6).
**Triggered by:** Ahmad 2026-06-16 — "no insurance yet, skip insurance items."
**Source:** `senior-director-state/cyber-preview-outlines-batch-2026-06-16.md` (17 lane outlines).
**Bid filter:** Federal Bid Supplement §3 — IIS only delivers remote advisory + methodology + documentation. No on-site, no implementation that triggers liability, no hands-on remediation on client production systems.

---

## Audit framework

For each of the 17 lanes, apply three tests:

1. **Remote-deliverable?** All methodology bullets can be done over screen-share + document delivery, no IIS hands inside client production?
2. **Advisory/documentation only?** Outputs are plans, audits, reports, templates — not configuration changes IIS makes inside the client tenant?
3. **No claim of remediation guarantee?** Sample pack does not promise IIS will fix things, only that IIS will identify, recommend, document?

If all three = SHIP. If any = NO → reframe to advisory-only OR hold until insurance.

---

## Audit results

| # | Lane | Remote? | Advisory only? | No remediation? | Verdict |
|---|---|:---:|:---:|:---:|---|
| 1 | SOC Automation | ✓ | ✓ (we design rules, client implements) | ✓ | **SHIP** |
| 2 | AI Security Platform | ✓ | ✓ (policy + inventory + matrix) | ✓ | **SHIP** |
| 3 | AI Phishing Protection | ✓ | ✓ — re-scope filter-tuning to "tuning playbook IIS hands over, client applies" | ✓ if reframed | **REFRAME** |
| 4 | M365 Security Hardening | ✓ | ✓ — re-scope "CA policy review" to "CA policy report, client implements" | ✓ if reframed | **REFRAME** |
| 5 | MFA Rollout | ✓ | ✗ — "phased rollout schedule" implies IIS executes | ✗ — rollout = hands-on | **REFRAME to MFA Readiness Plan** |
| 6 | Ransomware Readiness | ✓ | ✓ (tabletop facilitation = advisory; OSFI uses this) | ✓ | **SHIP** |
| 7 | Password Manager Rollout | ✓ | ✗ — "pilot group rollout" = hands-on | ✗ | **REFRAME to PM Readiness + Selection Guide** |
| 8 | DMARC Setup | ✓ | ✗ — "staged p=none → p=reject" = DNS changes IIS would make | ✗ | **REFRAME to DMARC Roadmap + Monthly Report Review** |
| 9 | Zero Trust Small Business | ✓ | ✓ (sequencing roadmap is pure advisory) | ✓ | **SHIP** |
| 10 | Endpoint Security | ✓ | ✗ — "phased deploy" = hands-on | ✗ | **REFRAME to EDR Selection + Rollout Plan** |
| 11 | Passkeys for Business | ✓ | ✓ (audit + pilot plan = advisory) | ✓ | **SHIP** |
| 12 | Patch Management | ✓ | ✓ (SLA tiers + report template) | ✓ | **SHIP** |
| 13 | Backup and Recovery | ✓ | ✗ — "semi-annual restore drill" requires IIS to access client backups | ✗ | **REFRAME to BCP Plan + Drill Template** |
| 14 | Cyber Audit Checklist | ✓ | ✓ (self-audit + findings = pure advisory) | ✓ | **SHIP** |
| 15 | Cyber Awareness Training | ✓ | ✓ (modules + simulation calendar = content delivery) | ✓ | **SHIP** |
| 16 | DLP | ✓ | ✗ — "DLP policy authoring" requires IIS inside M365 admin | ✗ | **REFRAME to DLP Strategy + Policy Templates** |
| 17 | Digital Provenance | ✓ | ✓ (advisory + signing-setup guide) | ✓ | **SHIP** |

## Net verdict

- **9 SHIP as-written:** #1, 2, 6, 9, 11, 12, 14, 15, 17
- **7 REFRAME to advisory-only:** #3, 4, 5, 7, 8, 10, 13, 16
- **0 KILL** — every lane is salvageable.

## Reframe rule (applies to all 7 above)

Replace any methodology bullet that implies IIS-hands-in-client-system with the advisory equivalent:

| Hands-in pattern | Advisory equivalent |
|---|---|
| "IIS rolls out X" | "IIS delivers rollout plan; client executes with IIS guidance over screen-share" |
| "IIS configures Y" | "IIS provides configuration spec + walkthrough document; client applies" |
| "IIS runs drill" | "IIS delivers drill template + scenario; client runs with IIS observer (read-only)" |
| "IIS authors policy in tenant" | "IIS authors policy in document form; client copies into tenant" |
| "IIS tunes Z" | "IIS delivers tuning playbook + monthly review; client makes changes" |

**Mechanic:** IIS is a methodology partner. Client always holds the keys to their own production system. This is also a stronger sales position — clients want their team to learn, not become dependent.

## Updated sample-pack pattern for the 7 reframed lanes

Each reframed lane's "Sample Pack" should now include explicitly:

- Methodology documentation IIS hands over.
- Implementation walkthrough document the client uses.
- Read-only observer report from IIS during client's own execution.
- Knowledge-transfer session recording / playbook for client team.

**Removed from sample packs across all 7:** any artifact that implies IIS-executed change in client systems.

## What this unlocks

- All 17 cyber lanes remain bid-able and sellable.
- IIS positioning shifts from "we'll do it for you" → "we'll teach you to do it right" — actually the stronger small-MSP positioning Hormozi-style operators recommend.
- Bid-filter compatibility: every lane now passes the no-insurance filter.
- Federal-bid alignment: PSPC AI Source List + OSFI both compatible since both are advisory anyway.

## Action items for Codex (when building HTML wave 2)

1. For the 9 SHIP lanes: use outlines as-written in `cyber-preview-outlines-batch-2026-06-16.md`.
2. For the 7 REFRAME lanes: rewrite methodology bullets per the reframe-rule table before HTML.
3. All 17 sample packs: include the "advisory artifacts + knowledge-transfer" pattern above.
4. Add a small "Delivery model" line under each preview hero: "Remote advisory + methodology. Your team makes the changes; we guide them step by step."

## Stop rules

- No HTML built yet.
- No public claim that IIS "implements" or "deploys" cybersecurity in client tenants.
- No remediation-guarantee language in any of the 17 outlines.
- Cowork keeps this audit local-only.

## One-line summary

> 9 of 17 cyber lanes ship as-written. 7 need a quick methodology reframe (IIS guides, client executes). Net result: all 17 still bid-able, IIS positioned as methodology partner not hands-in vendor. Stronger sales position, zero liability creep.
