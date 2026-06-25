# May 25 SMB Blast — Day-7 Late-Reply Check

**Run:** 2026-06-02 (autonomous, scheduled) · Mailbox: ahmad.wasee@iisupp.net · Window: newer_than:7–8d

---

## One-screen summary

**Bottom line: nothing changed. Zero real replies. The cool-down call still holds.**

- **New warm/human replies in the late window (May 28–Jun 2): 0.** The 3–10 day reply tail produced no prospect conversations. Every inbound from a prospect address is from the original May 25–26 window and is an auto-reply or ticket auto-ack — already counted in the 48hr assessment.
- **Bounce rate is matured and stable.** Cold-outreach DSNs tapered cleanly and stopped: 13 (5/25) → 19 (5/26) → 14 (5/27) → 9 (5/28) → 4 (5/29) → 0 after. No new outreach bounces in 3+ days. The matured rate stands at the ~9–10% established at 48hr; it did not climb further. Scraped-list quality remains the cause (typo domains, `info@`/`sales@` role addresses, dead aliases).
- **Ticketed companies (Primanti, RDO, Coast): no human follow-up.** All three sit at the automated-acknowledgement stage only. None escalated to a person.
- **Drafts intact.** The held soft-template set is still in Drafts, untouched. The 4 hand-personalized May 26 follow-ups (Primanti, Coast, Maguire Financial, Raymond James/Sid) are still sitting unsent at the top — correctly held during cool-off.
- **Domain reputation: stabilizing, not degrading.** No spam complaints, no FBL notices, no abuse@ reports, bounces stopped. This is the quiet the cool-down was meant to produce.
- **🚩 Separate URGENT flag — billing, not outreach:** Google Workspace Business Plus for iisupp.net has a **failed payment / declined card (Mastercard ••2661), past-due balance, and Cloud/API access already disabled** (Jun 1–2). If the Workspace subscription lapses, the sending mailbox itself goes down and all iisupp.net email stops. This is unrelated to the blast but threatens the entire domain. Resolve the card before anything else. DigitalOcean ($19.01) and Stripe (proof-of-directors) also have open billing/compliance items.

---

## What came in (full triage)

### Real human replies from prospects
**None.** Across the entire 7-day window there is not a single typed, human reply from a targeted company.

### Auto-replies / OOO (all old, all already counted)
| Sender | Company | Date | Type |
|---|---|---|---|
| PatientAdvocate@atipt.com | ATI Physical Therapy | 5/26 | Auto-reply |
| sprescott@adelaideclinic.com | Adelaide Health Clinic | 5/25 | Auto-reply |
| tmaguire@maguirefinancialgroup.com | Maguire Financial Group | 5/25 | Memorial Day auto-reply |
| b.akers@omaconstruction.com | OMA Construction | 5/25 | Out-of-office |

### Ticket auto-acknowledgements (no human behind them)
| System | Company | Status |
|---|---|---|
| John Deere ExpertConnect (#2R8VQAJA3) | RDO Equipment | Auto-ack only, no human reply |
| Zohodesk (#58455) | Primanti Bros. | Auto-routed; Ahmad's follow-up drafted, never sent |
| info@coasthotels.com | Coast (note: "Coast Dental" was a separate send) | Auto-routed; follow-up drafted, never sent |

### Everything else
System/vendor/marketing noise: Google billing, Stripe, DigitalOcean, Netlify, LinkedIn, Apollo, Anthropic/Claude login links, Indeed job alerts, Ontario Tenders (Jaggaer), BestBuy/SAP/Bubble/Emergent newsletters, IT Rockstars (Skool/Scott Millar — a marketing community, not a prospect), DMARC reports, and ARIA's own internal ticket emails. None require outreach action.

---

## Bounce maturation detail

DSN messages by date (8-day pull):

```
2026-05-25 ████████████      13
2026-05-26 ███████████████████ 19
2026-05-27 ██████████████      14
2026-05-28 █████████            9
2026-05-29 ████                 4
2026-05-30 –                    0  (outreach bounces stopped)
2026-05-31 –                    0
2026-06-01 ██                   2  ← internal ARIA address only, NOT outreach
```

The only DSNs after 5/29 are the ARIA ticketing system failing to deliver to `integrateditsupp@iisupp.net` (an internal address that doesn't exist) — a system-config bug, not a cold-outreach bounce. **Outreach bounce maturation is complete and the rate did not worsen past the ~9–10% recorded at 48hr.** This validates the "measure at 48–72hr" lesson: the curve was fully matured by ~Day 5.

> Minor cleanup item: the ARIA app is emailing a dead internal alias (`integrateditsupp@iisupp.net`). Worth fixing so it stops generating self-bounces — those count against domain hygiene too.

---

## Assessment vs. the decision matrix

- **Reply rate: 0%** across **1,640+ total sends** over two blasts. Fails the ">1%" viability gate, decisively.
- **Bounce rate: ~9–10% matured, stable.** At/above the ">8%" stop gate but no longer climbing.
- **Verdict unchanged: the cool-down is correct.** There is no late-reply recovery story here — I checked specifically for one and it isn't there. Two blasts at zero conversations is a strategy signal, not a timing or sample-size problem. The fix remains upstream: Apollo-verified list (≈2% bounce vs ~10%), warmed secondary mailbox, and depth/personalization over volume.

---

## Recommended actions (priority order)

1. **TODAY — fix the Workspace/Cloud billing.** Update the card on iisupp.net's Google Workspace before the subscription lapses and takes the mailbox down. This is now the single biggest risk to the domain, bigger than reputation.
2. **Hold the cool-down to ~2026-06-09.** No bulk from ahmad.wasee. Drafts stay parked.
3. **Optional, low-risk:** the 4 personalized follow-ups (Primanti, Coast, Maguire, Raymond James) are genuinely tailored and tied to real inbound signals. If Ahmad wants any motion, send those **manually, one at a time**, or route via LinkedIn / public contact pages — not as a batch. They're the only threads with any thread to pull.
4. **Prep next round during cool-off:** Apollo credit reset (~6/7) → pull verified list; finish warming the secondary mailbox so the next attempt doesn't run through the rep-damaged primary.
5. **Fix the ARIA dead-alias self-bounce** so the system stops mailing `integrateditsupp@iisupp.net`.

---

*No replies were spun as recovery. The honest read: the campaign is dead air, the domain is quietly healing, and the urgent item this week is the billing failure, not the outreach.*

## Related

<!-- LINK-WEB:auto -->
- [[AHMAD_DECISION_REQUIRED]]
- [[wednesday_assessment]]
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
