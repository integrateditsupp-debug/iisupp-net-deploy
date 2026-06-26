# KB Matcher Precision — Verification Guide + Marketing Readiness Brief
**Status:** Reference doc — action required from Ahmad
**Date:** 2026-06-26
**Context:** CC shipped G-PRECISION improvement (46.7% → 68.9% on n=45 labeled set). **UPDATE 2026-06-26 07:30:** Cowork re-ran the harness from mount and VERIFIED 68.9% (31/45 correct). The 68.9% internal self-test number is now confirmed. The 40% (n=20) baseline is superseded. This guide now serves as the marketing readiness brief — what you can/cannot say with this verified number, and how to raise it further.

---

## Part 1 — Verification Status (Already Done)

**VERIFIED 2026-06-26 07:30 by Cowork:** 31/45 correct → 68.9%. Matches CC's reported number exactly. The 40% (n=20) baseline is superseded.

**Current verified record:**
| Run | n | Precision | Status | Date |
|---|---|---|---|---|
| Original baseline | 20 | 40% | ~~Superseded~~ | 2026-06-06 |
| G-PRECISION (CC + Cowork verified) | 45 | 68.9% | ✅ VERIFIED | 2026-06-26 |

**If you want to re-run yourself** (good habit before citing in a proposal):
```bash
# In the ARIA Sentinel project directory
node tools/measure-kb-selftest.mjs
```
Should return 31/45 → 68.9%. If it doesn't, report in Live-Operations-Log before citing.

---

## Part 2 — What You Can and Cannot Say Once Verified

### RULE 14 guardrails — no exceptions

**What you CAN say (if verified ~68-70% on n=45):**
> "In internal self-testing on our own knowledge base, ARIA Sentinel correctly matched 68–70% of support queries to the right resolution — a 28-point improvement from our initial 40% baseline."

**What you CANNOT say:**
- ❌ "ARIA handles 68% of tickets automatically" — this implies live customer traffic.
- ❌ "Comparable to Moveworks" — Moveworks' 65-70% is from live enterprise deployments with millions of tickets.
- ❌ Any version of "industry-leading accuracy" — you're measuring on your own labeled set.

### Honest public framing options

**For the trust page / website:**
> "Internal self-test (n=45, IIS knowledge base): 68% match precision. Not yet validated on live customer traffic — that's where you help us build the proof."

**For sales conversations:**
> "We self-tested at 68% precision internally. That means when we set it up on your environment with your actual tickets and KB, the starting point is reasonably good, and it improves as we tune the knowledge base to your specific issues."

**For product copy / Growth Library:**
> "ARIA's local KB matcher scores 68% precision in internal testing — meaning it routes the right answer to the right question most of the time, right out of the box. Fine-tuning for your environment drives that higher."

---

## Part 3 — What Raises the Number Legitimately (Next Steps)

These are all safe, no-fake paths to a higher honest number:

| Action | Expected Impact | Who Does It |
|---|---|---|
| Expand KB with more IIS-specific articles (especially Office/Excel, Outlook) | +5-10% precision on common tickets | Ahmad writes / CC imports |
| Add synonym expansion for industry terms (SMB, ITSM, helpdesk language) | +3-5% | CC (already partially done in G-PRECISION) |
| Add negative examples (what NOT to match) to KB entries | +5-8% on out-of-scope rejection | CC task packet |
| Grow labeled test set from 45 → 200 questions (more representative) | More reliable number, less variance | Ahmad contributes real ticket examples |
| Run on first real customer's ticket backlog (anonymized) | Converts to "real-world" claim | Requires first paying customer onboarding |

**Priority recommendation:** Expand the labeled test set to 100+ questions using real ticket examples before citing 68%+ in any marketing. 45 questions is a narrow sample; a skeptical buyer will ask "what was the test set?"

---

## Part 4 — Progress Scorecard (honest)

| Metric | Current | What moves it | Timeline |
|---|---|---|---|
| KB precision (internal) | 40% verified / 68.9% provisional | Verify, then expand KB | This week |
| Deflection rate (internal) | 40% (n=20) | Improve matcher + expand KB | This week |
| Trust page published | No (unpublished) | Ahmad approve + Netlify publish | Day Ahmad reviews |
| Real customer data | 0 | First client onboarding | After publish |
| SOC 2 certification | 0 | Requires 6-12 months audit | Long term |
| Published reference customer | 0 | After first client + permission | Long term |

**Overall rating (honest, RULE 14):**
- vs top tier (Moveworks, ServiceNow): **3/10** → still 3/10 (internal metrics ≠ market proof)
- In-lane / product-readiness: **6.5/10** → movement from instrumentation, trust content, omni code, precision improvement

---

*No fabricated metrics. No marketing citations until Ahmad verifies the number on his machine. This document is internal only until then.*
