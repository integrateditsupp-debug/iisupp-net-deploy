---
type: cc-run-sequence
brain_region: frontal
created: 2026-07-21
author: Cowork Flywheel (run 112)
status: RELEASED
prereq: RUN-J J1+J2+J3 built + verified (met 2026-07-21; branch 4de59249, merge 488ec6e1, feed 02ac7810; suite 276/278 first-hand, both reds environment-only and each re-run green -> effective 278/278)
rule14: true
---

/goal Ten runs of machinery now exist: we can find demand (G), prove it (H), stage the packet (H3), stage the invoice (I1), judge the renewal (I2), read one true revenue board (I3), autopsy why deals died (J1), know what we can actually deliver (J2), and read the week in sixty seconds (J3). The board still says **CAD $0**. RUN-K exists for one reason: make the FIRST real dollar structurally unavoidable — close the last gaps between "staged" and "paid", and make the moment money lands impossible to miss or fake.
ultrathink

# RUN-K — FIRST PAID CUSTOMER, END TO END (CC executable, branch `cc/run-k-*`)
**Prereq:** RUN-J built + verified (met 2026-07-21). **Read first:** `VISION-AND-GOAL-STANDING.md` (REVENUE MANDATE, free-only HARD LAW, Rule 14 honesty, Rule 15 preserve-everything), then the J assets (`deal-blocker-autopsy.mjs`, `delivery-capacity-truth.mjs`, `weekly-truth-digest.mjs`) and the I assets.
**Rules:** Rule 14 real-or-empty — never a fabricated customer, payment, date, or figure. Free only. **No external send / signing / payment / charge / account creation / deploy — every one staged to Ahmad's one click.** Additive only (Rule 15).

## K1 — PAYMENT RECEIPT LEDGER (buildable, free)
1. One place a REAL received payment is recorded, with the evidence that it was received (processor reference, date, amount, customer). A payment without a reference is **not** recorded as received — it is recorded as *claimed, unverified* and counted separately.
2. The moment a real payment is recorded, every downstream report (I3 board, J3 digest) must move on its own — no second entry, no manual sync.
**Exit K1:** unverified / verified / none-at-all all reachable from fixtures; a verified payment flows to board + digest with zero duplicate entry; no payment can be created without a reference; test-locked; full suite green.

## K2 — TIME-TO-FIRST-DOLLAR CLOCK (buildable, free)
1. From the first real recorded engagement to the first real received payment: how long, measured only from real timestamps. With no payment yet the clock reports **"still running, N days"** — never an estimate, never a forecast date.
2. Name the single longest real gap in the chain (evidence → packet → handoff → payment) so the slowest step is visible instead of guessed.
**Exit K2:** still-running / completed / not-enough-data all reachable; every interval traces to two real timestamps; no projected close date anywhere; test-locked; full suite green.

## K3 — THE ONE-PAGE ASK (buildable, free)
1. Compose the real proof pack (H1), the real close packet (H3) and the real capacity verdict (J2) into ONE page a buyer can say yes to — with a capacity line that refuses to promise delivery we cannot staff.
2. If any input is missing or unproven, the page **refuses to render** and names the missing input — exactly like H3. No template filler, no invented reference customer, no guarantee/money-back/risk-free language (screened, as in H3).
**Exit K3:** refuses / renders honestly / refuses on over-capacity all reachable; every claim on the page traces to a real record id; forbidden-terms screen locked; test-locked; full suite green.

## HARD-STOPS (Ahmad one-click, never a hold, never faked)
Any outreach send · signing · invoicing/payment/Stripe charge · account creation · public deploy/publish · loan or purchase. Stage each to one click and keep building everything else. Cost is never a blocker (free-only).

## REPORT BACK
Branch, assets, staged one-click list, real-or-empty proof. Cowork re-verifies honesty (Rule 14) + preservation (Rule 15), runs the full suite, merges green+sane slices as sole .git writer, logs program status, and auto-releases RUN-L when K's exit criteria hold. Never idle.

## Related
- [[VISION-AND-GOAL-STANDING]]
- [[RUN-J-durable-revenue]]
- [[RUN-I-first-dollar]]
- [[_Frontal]]
- [[Cowork]]
