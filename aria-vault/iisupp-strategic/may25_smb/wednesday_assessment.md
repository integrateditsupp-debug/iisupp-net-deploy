# Wednesday 48-hr Assessment — May 25 SMB Blast

**Generated:** 2026-05-27, autonomous scheduled run, ahmad.wasee@iisupp.net mailbox scan
**Window:** 2026-05-25 14:00 UTC → 2026-05-27 13:30 UTC (48 hours)
**Decision required:** Disposition of remaining unsent drafts

---

## TL;DR

**Recommendation: STOP. Do not send the remaining drafts from ahmad.wasee@iisupp.net.**

Across two blasts (May 21-22 enterprise: 991 sent; May 25 SMB: 492+ sent) plus an unauthorized continuation on May 26, the domain has now produced **~1,640 sends and 0 conversational replies**. Bounce rate on the matured Monday cohort is **8.7%-10.2%** — at or above the stop threshold. The depth-pivot recommendation is the correct path.

The data does NOT favor the soft-template instinct beyond what was already known on Tuesday. The auto-filed tickets are still auto-acknowledgments, none have converted to human conversations after 48 hours.

---

## Numbers

### Sends in the 48-hr window
| Cohort | When | Count | Notes |
|---|---|---|---|
| Mon May 25 main blast | 14:00–15:50 UTC | ~492 | The "halted" blast per Tuesday memory |
| Tue May 26 continuation | 16:13–17:23 UTC | ~150 | **UNAUTHORIZED — see flag below** |
| Wed May 27 (today) | 13:25–13:27 UTC | 3 | Triggered ~5 min before this scan |
| **Total outreach over 48hr** | | **~645** | |

### Reply categories (all 48hr cohorts)
| Category | Count | Note |
|---|---|---|
| Conversational human replies (genuine "yes/no/tell me more") | **0** | The dominant signal |
| Unsubscribes | 1 | gramsey@usa.net (Village Habitat) — same one from Tue |
| OOO / auto-replies | 5 | Adelaide Clinic, OMA Construction, Maguire Financial (gave cell), Culinary Health Fund, ATI Physical Therapy |
| Ticket-system auto-acks | 3 | Primanti #58455, Coast Hotels (Benson), RDO Equipment #2R8VQAJA3 — same 3 from Tue, none human-replied since |
| Spam complaints / abuse reports | **0** | No abuse@/feedback-loop messages received. DMARC aggregate reports are routine, not complaint-driven |

### Bounces (now matured 48 hrs)
| Type | Count | Rate vs ~645 total | Rate vs 492 (Mon cohort only) |
|---|---|---|---|
| Confirmed permanent failures (visible) | ~43 | 6.7% | **8.7%** |
| + Delayed (likely-permanent in 24-48hr) | ~7-10 more | 7.7%-8.2% | **~10.2%** |

**Key insight:** The Tuesday 24hr triage said only 7 bounces (1.4%). That under-counted dramatically. Many "Delivery Delayed (retry 45 hours)" notices on Monday have now matured into permanent failures or are still queued for permanent failure. The matured 48hr bounce rate on the Monday cohort is roughly **8.7%-10.2%** — at or above the 8% stop threshold.

### Why the bounce rate is so high
Pattern in failed addresses confirms scraped-list quality issues:
- Typo domains: `ggnlaw.comyou`, `mavenmechanicalsesrvicews.com`, `masseydental.com` (doesn't exist)
- Typo addresses: `info@www.X.com` pattern (e.g., `info@www.boxerproperty.com`, `info@www.magiccityboxing.com`) — should be `info@X.com`
- Dead `info@`, `sales@`, `contactus@` aliases on Office 365 / Google Workspace tenants
- Mailbox-full forwarders (msn.com, qmail-only legacy)
- Allowlist-only mailboxes (Hawkins Service Co)
- Misconfigured MX records (multiple)

This is what scraped Google Maps + web extraction without verification produces. Apollo-verified lists ran ~2% bounce; this scraped list ran ~10%.

---

## Comparison vs May 21-22 enterprise baseline

| Metric | May 21-22 (enterprise, Apollo) | May 25 SMB (scraped) | Delta |
|---|---|---|---|
| Sends | 991 | 492 | -50% volume |
| Bounce rate | 2.2% | 8.7%-10.2% | **+4-5x worse** |
| Conversational replies | 0 | 0 | No change |
| Ticket-system engagements | 0 | 3 | SMB unique signal |
| OOOs | 10 | 5 (Memorial Day inflated) | -5 |
| Unsubscribes | 0 | 1 | +1 |
| Spam complaints | 0 | 0 | No change |

**Read:** SMB engagement signal (tickets) is real but has NOT converted to humans in 48 hours. Bounce rate is materially worse, which is the bigger risk to domain reputation. Reply rate is identical: zero.

---

## Decision matrix application

From the task spec:
- IF reply rate > 1% AND bounce rate < 5% AND no spam complaints → resume sending
- IF reply rate < 1% OR bounce rate > 8% → STOP
- IF spam complaints detected → DELETE, warmup protocol

Actual measurements:
- Reply rate = **0%** → fails "> 1%" threshold ✗
- Bounce rate (Mon cohort matured) = **8.7%-10.2%** → at/above "> 8%" threshold ✗
- Spam complaints = **0** (good — domain hasn't been blacklisted YET)

**Verdict: STOP — both reply-rate and bounce-rate gates fail. Do NOT send the remaining drafts from ahmad.wasee@iisupp.net.**

---

## Drafts folder status

**Memory said:** 560 drafts (559 unsent outreach + 1 Lauren personal draft)
**Observed now:**
- Many drafts have clearly been sent on Tuesday — list still paginating heavily (likely 400-450 outreach drafts remaining, exact count not fully walked)
- **4 personal-reply drafts** observed (high-quality, preserve these regardless of decision):
  1. Re: Primanti Bros ticket #58455 — context-routing follow-up
  2. Re: Coast Hotels (Benson) — IT operations routing
  3. Re: Maguire Financial — Memorial Day cell handover follow-up
  4. Re: Sid Seetharaman / Raymond James — ARIA follow-up
- The other ~400 are the soft-template bulk to be decided on

---

## 🚩 FLAG: Tuesday continuation was not authorized

Memory file `project_may25_override.md` states the blast was "halted at 492 sent on Ahmad's call; 559 unsent drafts preserved." However, the sent-log shows **~150 additional outreach sends on Tuesday May 26 between 16:13–17:23 UTC** — a ~70-minute send burst at the same ~25-second cadence as Monday's blast.

This was either:
- (a) Ahmad himself resumed sending manually, OR
- (b) Another scheduled task / automation fired and didn't respect the pause

Either way, **the "paused" state did not actually hold for 24 hours**. This needs to be raised with Ahmad. If (a), the memory note should be updated. If (b), the automation needs to be located and disabled before any further outbound work.

Plus 3 more sends today (May 27 13:25-13:27 UTC) — these fired roughly 5 minutes before this assessment task ran. Same source unknown.

---

## Honest data read — depth pivot vs soft template

The task brief asked: "Be honest about the data — if it favors Ahmad's soft-template instinct or my depth-pivot rec, say so. No spin."

**The data favors the depth pivot.**

Across 1,640+ sends from this mailbox in the last 6 days:
- 0 humans have replied to talk
- 1 has explicitly unsubscribed
- 3 ticket-systems acknowledged (no human conversion in 48hr)
- Bounce rate trending up as list quality drops (scraped > Apollo-verified by 4-5x)
- Domain reputation now actively at risk

The soft-template **DID** generate a different signal vector (ticket systems vs. enterprise gatekeepers) — that finding from Tuesday is confirmed. But that signal has not produced a single human conversation. Memorial Day inflated the OOO rate slightly but doesn't change the headline number.

Continuing with the same template + scraped lists from the same mailbox is investing more send volume into a domain that has just earned a 0% conversion rate and a 9% bounce rate. That's the textbook condition for accelerated deliverability decline.

---

## Recommended next moves (in priority order)

1. **Do not send the ~400 remaining bulk drafts from ahmad.wasee@iisupp.net.** Preserve them in Drafts as a recovery option, or migrate/export them, but do not click Send.
2. **Investigate Tuesday's 150-send continuation.** If a scheduled task is firing without authorization, that's a domain-risk incident, not a small process bug.
3. **Send the 4 personal-reply drafts manually** (Primanti, Coast Hotels, Maguire, Sid/Raymond James) — these are high-quality, hand-personalized, and follow normal correspondence patterns. They are NOT bulk.
4. **Pause volume on ahmad.wasee@iisupp.net for 7-14 days** to let domain reputation recover. Monitor postmaster.google.com for sender reputation signals during this window.
5. **Set up a secondary sending domain/mailbox** (subdomain like outreach.iisupp.net OR a fresh domain) and warm it for 2 weeks before any further volume.
6. **Stop scraping for outreach lists.** The 9% bounce rate is mostly typo'd and dead `info@` addresses. Wait for Apollo credits to reset June 7, or use verified lookup services. Use Maps scraping only as research input, not as a send list.
7. **Pivot to depth:** 15-25 hand-personalized sends/day, each with profile-first analysis (Hughes/Tan/Hormozi methodology from memory). Test reply rate at that volume for 2 weeks before any return to scale.

---

## Files written
- `/USA Outreach/may25_smb/wednesday_assessment.md` (this file)
- Drafts folder: untouched (still paused, preserved)

## Files NOT actioned (per "report on findings" autonomous-task default)
- No drafts sent
- No drafts deleted
- No labels applied
- No reply automation triggered

Decision lives with Ahmad. The four options below need a human call.

## Related

<!-- LINK-WEB:auto -->
- [[AHMAD_DECISION_REQUIRED]]
- [[day7_late_check]]
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
