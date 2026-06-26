# Cybersecurity Preview Pages — Outline Batch (17 lanes)

**For:** Approval Batch A Lane 2 next-wave. Reuses the exact pattern Ahmad already saw work for M365 Tune-Up, AI Workflow Audit, etc.
**Owner:** Cowork (idle-improvement loop).
**Status:** Outline-only. NO HTML built yet. Codex/Claude Code can mass-produce the 17 HTML files in one session from these outlines once Lane 2 wave 1 publishes.
**Source data:** `senior-director-state/trend-radar/risk-flagged-triage-2026-06-16.md` — the 17 cybersecurity trends Cowork triaged this morning, scores 67–75/100, all Long longevity.
**Visual law:** [[feedback_visual_stability]] — each preview reuses existing `downloads/library/*-preview.html` design pattern. Zero theme change.

---

## Standard outline shape (same as approved Lane 2 wave 1)

Each preview file follows this pattern. Replace the bracketed fields per lane.

```
<title>[LANE NAME] — Sample Preview | IIS</title>

H1: [LANE NAME] — Sample Preview
Subhead: [1-line outcome statement, not feature list]

PROBLEM CARDS (3 short ones, ≤30 words each, written as the buyer would describe their pain — not as a sales pitch)

WHAT IIS DOES FOR THIS (4–6 bullets, methodology not deliverables)

WHAT YOU SEE IN THE SAMPLE PACK (3–5 bullets, the artifacts a paying buyer gets)

WHO THIS IS FOR (3 bullets: small business / mid-market / regulated industry)

PRIMARY CTA: Book a Scoping Call → /contact?lane=[lane-slug]
SECONDARY CTA: View the Full Service → /services.html#[anchor]

TRUST FOOTER: [1-line about IIS approach. Same boilerplate across all 17.]
```

**Trust footer (constant):**
> Senior-led delivery. Human oversight on every action. Clear scoping, written documentation, approval gates for security, legal, spend, and external commitments. Integrated IT Support Inc., Toronto, Ontario.

---

## The 17 lane outlines (ranked by revenue speed)

### 1. SOC Automation — score 75

- **Slug:** `soc-automation`
- **Subhead:** Stop drowning in alerts. Let triage workflows do the boring 80%, keep humans on the 20% that matters.
- **Problem cards:** "Our analysts are burned out chasing low-signal alerts." / "Every shift change drops context — investigation re-starts from scratch." / "Audit asks for decision trails we don't have."
- **Methodology:** alert classification taxonomy · auto-triage rules with human-required edges · decision-log capture · shift-handoff template · monthly tuning review
- **Sample pack:** alert taxonomy worksheet · sample auto-triage rule set · decision-log template · shift handoff sample · 30/60/90 tuning plan
- **Anchor:** services.html#soc-automation
- **CTA goal:** scoping call for SOC tooling assessment

### 2. AI Security Platform — score 74

- **Slug:** `ai-security-platform`
- **Subhead:** Run AI in your stack without becoming the next breach story. Permissions, prompts, and provenance, governed.
- **Problem cards:** "Staff are pasting client data into ChatGPT and we have no visibility." / "Our compliance team blocked AI but the business keeps asking for it." / "We need an AI policy that doesn't break the business."
- **Methodology:** AI inventory + risk grading · acceptable-use policy · approved-tools registry · prompt-data minimization · ARIA-backed activity logging optional
- **Sample pack:** AI inventory worksheet · sample acceptable-use policy · approved-tools matrix · prompt-data minimization guide · monthly governance report template
- **Anchor:** services.html#ai-security-platform

### 3. AI Phishing Protection — score 74 [REFRAMED — advisory-only]

- **Slug:** `ai-phishing-protection`
- **Subhead:** Adversarial AI writes better phishes. Your defenses need to evolve.
- **Problem cards:** "Phishing emails look authentic now — our staff can't tell." / "Existing filters miss AI-generated lures." / "Training is annual and nobody remembers it."
- **Methodology:** filter posture audit (read-only) · M365 Defender / Google Workspace tuning **playbook IIS hands over, your team applies** · DMARC/DKIM/SPF alignment **report + change spec** · just-in-time micro-training content (90-sec drops) · monthly simulated phish **plan + scoring template, your IT runs the campaign**
- **Sample pack:** filter posture report · DMARC alignment audit · tuning playbook (your team applies) · sample micro-training script · simulation calendar + scoring template · monthly metrics report template · knowledge-transfer session playback
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#ai-phishing-protection

### 4. M365 Security Hardening — score 68 [REFRAMED — advisory-only]

- **Slug:** `m365-security-hardening`
- **Subhead:** Most M365 tenants are 6 settings away from a much smaller blast radius.
- **Problem cards:** "We turned on M365 years ago — never revisited the config." / "Acquisitions left us with three tenants and inconsistent settings." / "Audit said our M365 baseline isn't documented."
- **Methodology:** Secure Score baseline read-only audit · CIS M365 benchmark gap report · **CA policy report (your admin applies)** · external sharing audit · admin role hygiene **walkthrough** · **documented baseline IIS authors, your team adopts**
- **Sample pack:** Secure Score gap report · CIS benchmark checklist · CA policy matrix (recommendations) · external-sharing inventory · admin role audit · documented baseline pack · knowledge-transfer session for your admin
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#m365-security-hardening
- **Note:** overlaps with existing M365 Tune-Up — frame as cybersecurity-focused sibling, not duplicate.

### 5. MFA Readiness Plan — score 67 [REFRAMED — advisory-only, renamed from "Rollout"]

- **Slug:** `mfa-readiness-plan`
- **Subhead:** MFA stops most account-takeover attacks. The rollout is the hard part. We plan it; your team executes with our guidance.
- **Problem cards:** "Some staff still use SMS or no MFA at all." / "Last MFA push broke logins for executives." / "We don't know if MFA is on for service accounts."
- **Methodology:** account inventory + MFA-gap report (read-only) · **phased rollout plan IIS authors, your IT executes** · break-glass account design (spec only) · helpdesk script for MFA enrollment · **post-rollout audit observed read-only, your team makes any corrections**
- **Sample pack:** MFA inventory · rollout plan template · break-glass procedure spec · helpdesk script · post-rollout audit checklist · knowledge-transfer session playback
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#mfa-readiness-plan

### 6. Ransomware Readiness — score 67 ★ (also drives OSFI bid)

- **Slug:** `ransomware-readiness`
- **Subhead:** Most ransomware victims weren't unlucky. They were unprepared. Two days of work changes that.
- **Problem cards:** "We have backups but never tested restore." / "Our IR plan is a PDF nobody has read." / "Cyber insurance keeps asking us questions we can't answer."
- **Methodology:** asset-criticality classification · backup posture test · facilitated tabletop scenario · after-action remediation backlog · re-test cadence
- **Sample pack:** asset criticality worksheet · backup test report · tabletop scenario sample · after-action template · re-test schedule
- **Anchor:** services.html#ransomware-readiness
- **Cross-link:** federal-bid lane (`senior-director-state/bid-briefs/osfi-ransomware-tabletop-2026-06-16.md`).

### 7. Password Manager Readiness + Selection Guide — score 67 [REFRAMED — advisory-only]

- **Slug:** `password-manager-selection`
- **Subhead:** Passwords on sticky notes aren't a culture problem — it's a tooling problem. We help you pick the right manager and stand it up safely.
- **Problem cards:** "Staff reuse passwords because remembering them is harder than security." / "Departing employees still have access to shared accounts." / "Our spreadsheets-with-passwords are everywhere."
- **Methodology:** tool selection comparison (Bitwarden/1Password/Keeper) · **pilot rollout plan IIS authors, your IT executes** · shared-vault structure spec · offboarding flow design · monthly hygiene report template
- **Sample pack:** tool comparison · rollout plan template · vault structure spec · offboarding checklist · hygiene metrics template · knowledge-transfer session playback
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#password-manager-selection

### 8. DMARC Roadmap + Monthly Report Review — score 67 [REFRAMED — advisory-only]

- **Slug:** `dmarc-roadmap`
- **Subhead:** Your domain is being spoofed right now. DMARC at p=reject stops it. Most companies are stuck at p=none. We chart the path; your team makes the DNS changes.
- **Problem cards:** "We deployed DMARC but it's in monitor-only mode forever." / "Marketing keeps breaking our email delivery." / "We have no visibility into who's spoofing us."
- **Methodology:** current posture report · SPF/DKIM alignment audit · **staged p=none → p=quarantine → p=reject roadmap IIS authors, your IT applies the DNS records** · subdomain policy spec · monthly DMARC report review (advisory)
- **Sample pack:** posture report · alignment audit · staged DNS-change plan with exact record values · subdomain matrix · monthly report walkthrough template
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#dmarc-roadmap

### 9. Zero Trust Small Business — score 67

- **Slug:** `zero-trust-small-business`
- **Subhead:** Zero trust isn't a product. It's a sequence of decisions. We help you make them in the right order.
- **Problem cards:** "We hear zero trust from every vendor — none explain what to do first." / "Our network was built when everyone was in the office." / "We don't have a CISO and can't justify hiring one yet."
- **Methodology:** identity-first sequencing · device posture baselining · network segment-by-need · application-level controls · documentation + handoff
- **Sample pack:** zero-trust roadmap · identity posture report · device baseline · network segment plan · application control matrix
- **Anchor:** services.html#zero-trust-small-business

### 10. EDR Selection + Rollout Plan — score 67 [REFRAMED — advisory-only]

- **Slug:** `edr-selection-plan`
- **Subhead:** Antivirus is 1995. EDR is the new baseline. We help you pick the right EDR and chart the rollout; your team deploys.
- **Problem cards:** "Our antivirus catches nothing modern." / "Staff complain endpoint tools slow their machines." / "We don't know what's installed on half our endpoints."
- **Methodology:** endpoint inventory (read-only) · EDR tool selection comparison · **phased deploy plan IIS authors, your IT executes** · false-positive tuning playbook · monthly endpoint posture report template
- **Sample pack:** inventory · tool comparison · rollout plan · tuning playbook · posture report template · knowledge-transfer session playback
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#edr-selection-plan

### 11. Passkeys for Business — score 67

- **Slug:** `passkeys-business`
- **Subhead:** Passwords are dying. Passkeys are the replacement. We help you pilot before your competitors.
- **Problem cards:** "We don't know which of our SaaS tools support passkeys yet." / "Staff confused by what FIDO2 even is." / "Compliance asks if passkeys count as MFA."
- **Methodology:** SaaS passkey-support audit · pilot user group · training script · helpdesk readiness · governance documentation
- **Sample pack:** SaaS audit · pilot plan · training script · helpdesk script · governance addendum
- **Anchor:** services.html#passkeys-business

### 12. Software Patch Management — score 67

- **Slug:** `patch-management`
- **Subhead:** Most breaches exploit a patch that was available months ago. We close that gap on a documented schedule.
- **Problem cards:** "We patch when there's a panic, not on a cadence." / "Our M365 patches itself but we don't know about everything else." / "Audit asked for our patch cycle — we don't have one in writing."
- **Methodology:** asset + software inventory · patch SLA tiers (critical / standard / deferred) · monthly patch report · exception process · annual patch-posture review
- **Sample pack:** inventory · SLA tiering · monthly report template · exception form · annual review template
- **Anchor:** services.html#patch-management

### 13. BCP Plan + Drill Template — score 67 [REFRAMED — advisory-only]

- **Slug:** `bcp-plan-drill`
- **Subhead:** Untested backups are tickets to a panicked restore. We design the drill; your team runs it; we observe and document gaps.
- **Problem cards:** "We have backups, but nobody has tried restoring." / "Our M365 / Google Workspace data has no backup at all." / "Recovery Time Objective? Recovery Point Objective? Don't know."
- **Methodology:** backup posture audit (read-only) · RTO/RPO definition workshop · M365/Google Workspace backup add-on selection guide · **semi-annual restore drill template, your team runs, IIS observes read-only** · documented runbook IIS authors
- **Sample pack:** posture audit · RTO/RPO matrix · backup add-on comparison · restore drill plan + scoring template · runbook · IIS observer report template
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#bcp-plan-drill

### 14. Cybersecurity Audit Checklist — score 67

- **Slug:** `cyber-audit-checklist`
- **Subhead:** Know your security posture in one afternoon — before someone else discovers it for you.
- **Problem cards:** "We've never had a security audit." / "Customer/insurer just asked for our security posture summary." / "We don't know what we don't know."
- **Methodology:** 50-point CIS-aligned self-audit · findings ranked Critical/High/Medium/Low · prioritized 90-day remediation plan · re-audit cadence
- **Sample pack:** 50-point checklist · findings template · remediation backlog · re-audit schedule
- **Anchor:** services.html#cyber-audit-checklist
- **Note:** Strong lead magnet — runs as free download with light-touch upgrade to paid audit.

### 15. Cybersecurity Awareness Training — score 67

- **Slug:** `cyber-awareness-training`
- **Subhead:** Annual training is theater. Real defense is monthly micro-drops people actually finish.
- **Problem cards:** "Our annual training has a 100% completion rate and 0% retention." / "Compliance demands evidence — we don't have it." / "Staff laugh at our phishing simulations because the lures are obvious."
- **Methodology:** monthly 90-sec micro-modules · quarterly simulated phish · role-specific tracks (exec / finance / IT / general) · auto-tracked completion · monthly metrics
- **Sample pack:** sample micro-module · simulation calendar · role track matrix · completion tracker · monthly report
- **Anchor:** services.html#cyber-awareness-training

### 16. DLP Strategy + Policy Templates — score 67 [REFRAMED — advisory-only]

- **Slug:** `dlp-strategy-templates`
- **Subhead:** Your sensitive data leaves the building every day. We map classification, write the policy templates, and hand them to your M365 admin to deploy.
- **Problem cards:** "We have no idea what staff are uploading to personal cloud accounts." / "We need DLP for compliance — vendor demos overwhelmed us." / "Our existing M365 DLP is on but nobody reviews the alerts."
- **Methodology:** data classification taxonomy workshop · **DLP policy templates IIS authors, your admin deploys in M365** · alert triage workflow design · false-positive reduction playbook · monthly DLP posture review template
- **Sample pack:** classification taxonomy · DLP policy templates (ready for your admin to paste) · alert triage workflow · tuning playbook · posture report template · knowledge-transfer session playback
- **Delivery model:** Remote advisory + methodology. Your team makes the changes; we guide them step by step.
- **Anchor:** services.html#dlp-strategy-templates

### 17. Digital Provenance & Content Authenticity — score 67 (emerging)

- **Slug:** `content-provenance`
- **Subhead:** Generative AI broke "seeing is believing." Provenance signatures restore it. Early-mover positioning for media-adjacent clients.
- **Problem cards:** "We publish content — how do we prove it's ours and unaltered?" / "Our brand has been deepfaked." / "Customers ask if our material is AI-generated."
- **Methodology:** C2PA content credentials primer · publishing-workflow audit · provenance signing setup · disclosure policy · monitoring for impersonation
- **Sample pack:** C2PA primer · workflow audit · signing setup guide · disclosure policy template · impersonation monitoring plan
- **Anchor:** services.html#content-provenance
- **Note:** Lower volume today, but white-space positioning — likely no IIS competitor talks about this yet.

---

## What this unlocks

- **Approval Batch A Lane 2 wave 2:** 17 additional preview pages ready for Codex to template in one HTML-mass-production session. Same pattern as wave 1 (M365 Tune-Up, AI Workflow Audit, etc.) — zero new design work.
- **Services.html anchor expansion:** each preview links to a `services.html#[anchor]`. Codex adds 17 anchors + matching service blurbs in one pass.
- **Lead-magnet pipeline:** items 14 (audit checklist) and 15 (awareness training) make natural top-of-funnel free downloads.
- **PSPC AI bid cross-reference:** items 1, 2, 3 (SOC, AI security, AI phishing) reinforce the "responsible AI + security" capability narrative in the PSPC response.

## Ahmad approval pass needed (single batch)

For each lane: approve / hold / kill. Default recommendation for all 17 = **approve to build** (zero copy is unsupported; all 17 are direct IIS lanes; pattern already validated in wave 1).

```
1.  SOC Automation                            [ Approve / Hold / Kill ]
2.  AI Security Platform                      [ Approve / Hold / Kill ]
3.  AI Phishing Protection                    [ Approve / Hold / Kill ]
4.  M365 Security Hardening                   [ Approve / Hold / Kill ]
5.  MFA Rollout                               [ Approve / Hold / Kill ]
6.  Ransomware Readiness                      [ Approve / Hold / Kill ]
7.  Password Manager Rollout                  [ Approve / Hold / Kill ]
8.  DMARC Setup                               [ Approve / Hold / Kill ]
9.  Zero Trust Small Business                 [ Approve / Hold / Kill ]
10. Endpoint Security for Small Business      [ Approve / Hold / Kill ]
11. Passkeys for Business                     [ Approve / Hold / Kill ]
12. Software Patch Management                 [ Approve / Hold / Kill ]
13. Backup and Recovery Plan                  [ Approve / Hold / Kill ]
14. Cybersecurity Audit Checklist             [ Approve / Hold / Kill ]
15. Cybersecurity Awareness Training          [ Approve / Hold / Kill ]
16. Data Loss Prevention (DLP)                [ Approve / Hold / Kill ]
17. Digital Provenance & Authenticity         [ Approve / Hold / Kill ]
```

## Stop rules

- No HTML built, no routes added, no `services.html` edited yet.
- All claims in outlines are methodology-only — no metrics, no guarantees, no client names.
- Approval Batch A wave 1 must publish FIRST so Ahmad sees the pattern is working before wave 2 builds.
- Lane 17 (provenance) is positioning-only until Ahmad confirms there's at least one buyer asking — emerging vertical.

## One-line summary

> 17 cyber preview pages outlined to match Lane 2 wave-1 pattern exactly. Codex mass-produces in one session after Ahmad approves the batch. Converts the "risk quarantine" trends into the next IIS revenue line.
