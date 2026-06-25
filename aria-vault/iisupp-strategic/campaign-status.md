# USA Outreach — Campaign Status Dashboard

**Last updated:** May 12, 2026 (autonomous build session)
**Owner:** Ahmad Wasee | Integrated IT Support Inc.

---

## TL;DR

Campaign is built end-to-end and ready to fire. **Two unblocked actions for Ahmad sit between current state and revenue:**

1. **Approve enrichment of 11 contacts (11 Apollo credits)** to fill verified emails into today's drafts
2. **Confirm send infrastructure** — Gmail (cap 11/day) or new ahmad@iisupp.net (need to set up tonight, cap 30+/day after warmup)

Everything else is built and waiting.

---

## What's done

### Today (May 12)

- Apollo authenticated (2,383 credits)
- 178 DFW prospect companies surfaced across 3 segments
- 31 decision-makers identified at top 14 companies (zero credit cost — masked names)
- **Today's 11 pre-drafted emails** with deep, real personalization → `prospects-dfw-today-batch.md`
- **Day-2 batch plan** with 11 different companies + reserve list → `day-2-batch-plan.md`
- **Reply handling playbook** — responses for 12 common reply patterns → `reply-playbook.md`
- **Proposal one-pager** ready to send same-day to "yes, send info" responses → `proposal-one-pager.md`
- **Outreach reply tracker** scaffolded → `outreach-replies-tracker.csv`
- **iisupp.net audit** — 2 critical issues flagged (see below)
- **Scheduled task** for May 13 8 AM CT runs automatically tomorrow → `usa-outreach-daily-launch`
- **Cross-agent status** audited — 6 enabled autonomous agents running parallel

### Files in workspace folder

| File | Purpose | Status |
|---|---|---|
| `campaign-plan.md` | Master plan, KPIs, 90-day targets | ✅ Built |
| `email-templates.md` | Variants A.1/A.2/A.3 + B.1/B.2 + follow-up | ✅ Built |
| `prospects-dfw-batch1.csv` | Original 21-prospect starter list | ✅ Built |
| `prospects-dfw-today-batch.md` | Today's 11 pre-drafted personalized emails | ✅ Built |
| `day-2-batch-plan.md` | Tomorrow's 11 picks + reserve list | ✅ Built |
| `reply-playbook.md` | 12 reply scenario response templates | ✅ Built |
| `proposal-one-pager.md` | Send-ready engagement overview | ✅ Built |
| `outreach-replies-tracker.csv` | Reply tracking scaffold | ✅ Built |
| `workspace-setup-guide.md` | Step-by-step iisupp.net Workspace setup | ✅ Built |
| `campaign-status.md` | This file — master dashboard | ✅ Built |

---

## Blockers — what's between us and revenue

| Blocker | What's needed | Who | ETA |
|---|---|---|---|
| **Apollo enrichment approval** | One word: "go" — costs 11 credits (0.5% of balance) | Ahmad | 1 min |
| **Send infrastructure decision** | Gmail or new ahmad@iisupp.net | Ahmad | Tonight |
| **iisupp.net `noarchive` tag** | Remove from meta robots — kills SEO/Google credibility | Ahmad | 5 min |
| **US virtual mailbox** | Rent for CAN-SPAM compliance ($10/mo, anytimemailbox.com TX) | Ahmad | 10 min |
| **McCathern contact confirm** | Rodney D. (current pick) or Stephanie Almeter (newly-promoted Dallas MP)? | Ahmad | 1 min |
| **Google Workspace setup** | Sign up + DNS records — see `workspace-setup-guide.md` | Ahmad | 30 min |

---

## iisupp.net audit findings

**The site is strong** — premium positioning, $6K–$60K/mo tiers, ARIA AI product, real credibility (Raymond James, Ontario Health). Two issues that kill cold-outreach effectiveness:

### Issue 1 — `<meta name="robots" content="noarchive, nosnippet">`

This tag tells Google: "Don't show snippets, don't cache." Result: prospects who Google you after your email see a bare result with no description, often nothing at all. Looks like the site doesn't exist or is bare. Instant credibility kill in B2B outreach.

**Fix:** Remove the `noarchive, nosnippet` directive from the `<meta name="robots">` tag. Replace with `index, follow` to allow normal crawling. Should take 2 minutes.

### Issue 2 — Canadian HQ visible on every email footer

Whitby ON address + 647 phone code = "out of country" signal for some US buyers. The Ontario credibility is real (PHIPA + Ontario Health = premium), but it should be framed as a capability strength, not a base of operations weakness.

**Fix:** Rent a virtual TX mailbox at anytimemailbox.com or earthclassmail.com ($10/mo). Use that as the visible address in CAN-SPAM footer. Keep Whitby HQ for actual mail.

---

## Today's KPIs at full execution

If everything fires:

- **11 emails sent today** with real verified contacts
- **Expected reply rate:** 8–15% on the segment-targeted batch (1–2 replies)
- **Expected discovery calls:** 0–1 from this batch
- **Cost:** 11 Apollo credits ($0 in real cost — already paid via subscription)
- **Time-to-revenue:** First retainer realistic in 30–60 days at this batch quality

---

## 90-day campaign forecast (from `campaign-plan.md`)

- Total verified prospects: 600
- Total sends: 1,200 (2-touch sequence)
- Reply rate: 8–12% (96–144 replies)
- Discovery calls: 25–40
- Proposals issued: 8–15
- **Retainers closed: 1–3 → $36K–$240K new ARR**

---

## Cross-agent ecosystem (your other autopilots)

For context — these run in parallel:

| Agent | Schedule | Last run | Purpose |
|---|---|---|---|
| `ops-agent-morning-prep` | Daily 6:09 AM | May 12 8:19 AM | Health check, lead drafts, outbound list, CEO brief |
| `bay-monitor-autopilot` | Daily 7:17 AM | May 12 8:19 AM | 141 Bay HubSpot pipeline + news |
| `contract-hunter-autopilot` | Daily 3:09 PM | Next: May 12 2:08 PM | Procurement portals + Indeed/LinkedIn |
| `usa-outreach-daily-launch` (this) | One-time tomorrow 8 AM | Pending | Today's batch follow-up |
| `aria-morning-autopilot` | Sunday 8:31 AM | Next: May 17 | ARIA weekly priorities |
| `aria-evening-autopilot` | Sunday 7:09 PM | Next: May 17 | ARIA week recap |

**Disabled (recommend reviewing whether to re-enable or delete):** `141-bay-daily-monitor`, `aria-morning-digest`, `aria-evening-digest`, `iisupport-contract-hunter` (superseded by `contract-hunter-autopilot`)

---

## Next 24 hours — recommended order of operations

1. **Right now (Ahmad):** Reply "go" in chat to approve 11-credit enrichment → drafts get finalized
2. **Tonight (Ahmad, ~45 min total):** Workspace signup + DNS + virtual mailbox + remove `noarchive` tag
3. **Tonight (Claude on Ahmad's signal):** Enrich 11 contacts, fill drafts, deliver send-ready batch
4. **Tomorrow morning 8 AM (auto):** `usa-outreach-daily-launch` runs — Day-2 batch goes through same flow
5. **Tomorrow throughout day (Ahmad):** Review replies, use `reply-playbook.md` templates, send proposal-one-pager to "yes" replies
6. **Day 4 (auto):** Follow-up sequence to non-repliers from today's batch

## Related

<!-- LINK-WEB:auto -->
- [[campaign-plan]]
- [[day-2-batch-plan]]
- [[email-templates]]
- [[iisupp_14day_followup_sequence]]
- [[iisupp_20_accounts_full_list]]
- [[iisupp_5_seed_emails]]
- [[iisupp_case_study_aria]]
- [[iisupp_offer_tiers]]
- [[iisupp_usa_exposure_playbook]]
- [[INDEX]]
- [[linkedin-connection-requests-today]]
- [[linkedin-outreach-playbook]]
- [[proposal-one-pager]]
- [[prospects-dfw-batch-2026-05-13]]
- [[prospects-dfw-day2-batch]]
- [[prospects-dfw-day4-batch]]
- [[prospects-dfw-today-batch]]
- [[prospects-dfw-today-batch-v2]]
- [[READ_ME_FIRST]]
- [[reply-playbook]]
- [[SEND-PACING-SCHEDULE]]
- [[SESSION_SUMMARY_2026-06-23]]
- [[USA600-status-2026-05-21]]
- [[workspace-setup-guide]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
