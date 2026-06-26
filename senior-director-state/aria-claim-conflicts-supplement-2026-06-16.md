# Claim-Conflict Audit — Supplement 2026-06-16

**Companion to:** `aria-public-vs-federal-claim-conflicts-2026-06-16.md` (original 5 findings).
**Why:** deeper sweep across services, index, start-here, shop, about, plans surfaced more conflicts the targeted grep missed. All same risk pattern: IIS as a young firm describing itself with the credibility weight of a much larger / older one.
**Owner:** Cowork legal-safety-review. Flag only — no edits.

---

## Finding 6 — CRITICAL: IIS claims past delivery to clients Ahmad worked at as an employee

**File:** `about.html` lines 482–514 (the "Enterprise Track Record" section).

**What's claimed:** "IIS has executed against measurable outcomes for some of Canada's most demanding institutions" — then 6 tiles listing RBC, Scotiabank, Ontario Health, City of Toronto, IBM, "Capital Markets Operations" as institutions IIS has served.

**Reality (per Ahmad's resume):** RBC, Scotiabank, Ontario Health, City of Toronto, IBM are all **prior employers** of Ahmad Wasee personally — pre-2023. IIS Inc. was founded in 2023. IIS has not delivered services to any of these institutions as a vendor.

**Why this is the highest-risk finding:**
- Federal evaluators routinely cross-check vendor track-record claims against LinkedIn + corporate-registry data. The mismatch is one search away.
- "Has executed for [Big Five Bank]" carries an implicit endorsement no employer-employee relationship creates.
- Some of these institutions (RBC especially — see [[project_codex_collab_brief]] memory rule excluding Raymond James for the same reason) may take exception to the framing.
- This is the same risk Cowork resolved in the past-performance template by reframing Ahmad's experience as "Engagement Lead background" rather than "IIS's clients."

**Recommended fix:** retitle the section "Engagement Lead Background" and reframe each tile prose: "Where the Engagement Lead earned the operating discipline he brings to IIS" — same tiles, same logos (where logo rights permit), but truthful about the employment relationship.

### Track-tile reframe (recommended replacement prose)

| Org | Current claim | Recommended honest reframe |
|---|---|---|
| Capital Markets Operations | "White-glove executive IT support inside live financial trading environments…" | "Where Ahmad provided white-glove executive IT support inside live financial trading environments — the operating posture he carries into every IIS engagement." |
| RBC | "Team Lead and Major Incident Manager. Ran DMAIC cycles…" | "Where Ahmad led Service Desk teams as Team Lead and Major Incident Manager, running DMAIC cycles in enterprise banking — the methodology that grounds IIS today." |
| Scotiabank | "Deployed 100+ laptops daily with executive-level migration support…" | "Where Ahmad delivered 100+ laptop migrations daily with executive-level care — the throughput discipline IIS designs into client rollouts." |
| Ontario Health | "PHIPA-compliant healthcare IT, EMR systems, and provincial-scale digital-health infrastructure…" | "Where Ahmad supported PHIPA-compliant healthcare IT and EMR systems — the regulated-data posture he applies to every IIS engagement." |
| City of Toronto | "Multi-division enterprise IT support across a major municipal environment…" | "Where Ahmad supported multi-division municipal IT operations — the public-sector continuity mindset he brings to IIS." |
| IBM | "Multi-timezone, multi-client enterprise operations inside IBM's global delivery model…" | "Where Ahmad executed inside IBM's global delivery model — the documented-execution standard IIS holds itself to." |

This swap keeps the prestige + visual weight, removes the false vendor-relationship implication, and aligns with the past-performance + 1-page CV documents Cowork already shipped today.

---

## Finding 7 — HIGH: "Hundreds of users, thousands of devices… delivered for Seneca, George Brown, and public-sector environments"

**File:** `index.html` line 2163.

**What's claimed:** IIS-delivered scope at Seneca, George Brown, and public-sector environments.

**Reality:**
- Resume confirms Ahmad attended Seneca College for his Advanced Diploma (student, not vendor).
- George Brown does not appear in Ahmad's resume at all.
- "Hundreds of users, thousands of devices" is real Ahmad experience (RBC trader floor + Scotia migration) — but not as IIS Inc.

**Recommended fix:** rewrite the impact-outcome line in one of two patterns:

**Option 7A (reframe as Engagement Lead background, parallel to Finding 6):**
> "Hundreds of users, thousands of devices, and regulated-data environments where downtime is a legal exposure. The same operating posture our Engagement Lead carried through RBC Capital Markets, Ontario Health, and Scotia's migration window now grounds every IIS engagement."

**Option 7B (drop the named institutions entirely; lead with methodology):**
> "Hundreds of users, thousands of devices, and regulated-data environments where downtime is a legal exposure. The Engagement Lead's operating posture — built in OSFI-aligned capital markets and PHIPA-aligned healthcare — grounds every IIS engagement."

Either option drops Seneca + George Brown (no resume backing for delivery to either), keeps the credible scale via Ahmad's documented background, and stays federally defensible.

---

## Finding 8 — MEDIUM: "Our team does the legwork"

**File:** `shop.html` line 478.

**What's claimed:** "Our team does the legwork and hands you the vetted source."

**Reality:** IIS is currently a founder-led firm. "Team" is overstated for an evaluator who checks LinkedIn or Corporations Canada.

**Recommended fix:**

- Alt 8A: **"We do the legwork and hand you the vetted source."** (drops "team" — owner-operator framing).
- Alt 8B: **"Our senior team does the legwork…"** (factually true — Ahmad is senior — but still implies plural; acceptable if Cowork frames IIS as "Engagement Lead + curated specialist bench under NDA").
- Alt 8C: **"Senior-led product research — we do the legwork…"** (cleanest; matches the "senior-led delivery" line already used in the Capability Statement).

**Recommended pick:** Alt 8C.

---

## Finding 9 — HIGH: `/plans` page advertises Stripe checkout, "24/7 chat + voice support," when STRIPE_SECRET_KEY is missing in prod (per memory `project_aria_revenue_blockers`)

**File:** `plans/index.html` lines 103, 112.

**What's claimed:**
- Line 103: "Start free on this site for 3 minutes. Pick the plan that matches your team. Stripe-secured checkout. Cancel anytime."
- Line 112 (Personal $599/mo features): "24/7 chat + voice support".

**Reality:**
- Memory `project_aria_no_monetization_live.md` (verified 2026-05-31): "no trial/paywall/Stripe checkout live on iisupp.net homepage." `/plans` page contradicts that — though monetization on a sub-page is intentional per `project_aria` roadmap, IF Stripe is wired to live keys.
- Memory `project_aria_revenue_blockers.md`: "STRIPE_SECRET_KEY missing in prod (stripe:false), PayPal sandbox on /. Fix before any other revenue work." Memory is dated; needs live verification, but if true, the SUBSCRIBE buttons either fail silently or open a sandbox URL.
- "24/7 chat + voice support" on a $599/mo tier: ARIA chat may be 24/7-available (it's a bot, doesn't sleep), but VOICE support implies a human picks up at 3 AM, which IIS doesn't currently staff.

**Why this is HIGH risk:**
- A buyer who clicks SUBSCRIBE and hits a broken Stripe = trust catastrophe.
- A buyer who pays $599/mo expecting voice support at 3 AM = guaranteed churn + Better Business Bureau exposure.
- A federal evaluator who hits `/plans` from a Google search sees consumer-grade pricing on a vendor pitching B2G — confuses positioning.

**Recommended fix (two-track):**

**Track 9-Fix-Stripe (engineering):** Codex verifies Stripe live key + tests `/plans` SUBSCRIBE end-to-end before any new traffic is sent there. If broken, disable the buttons until live. Cowork blocked from this work — needs you or Codex.

**Track 9-Soft-Claim (copy):** rewrite "24/7 chat + voice support" to:
- Alt 9A: **"24/7 ARIA chat · scheduled voice consultations"** (truthful — bot is always-on, voice is by appointment).
- Alt 9B: **"24/7 ARIA chat · business-hours voice support"** (matches federal-safe posture).
- Alt 9C: **"24/7 ARIA chat · email + voice support (1 business day)"** (sets expectations honestly).

**Recommended pick:** Alt 9B — strongest match to the federal-safe one-pager Cowork shipped earlier.

---

## Pattern summary — 9 total findings now (5 original + 4 new)

| Pattern | Count | Common fix |
|---|---|---|
| Autonomous-AI implication | 1 (F1) | Replace with "drafts for approval" / "walks human through" |
| Unsubstantiated metric | 2 (F2, F3) | Replace with real cron schedule + agent count / "advisory" labels |
| Capability overstatement (24/7) | 3 (F3, F4, F5, partial F9) | "Senior-led L1-L3 advisory" + "business-hours voice" |
| Founder-experience claimed as company track-record | 2 (F6 about.html, F7 index.html) | Reframe to "Engagement Lead background" |
| Team-size overstatement | 1 (F8) | "Senior-led" / "We" instead of "Our team" |
| Live-checkout claim without verified Stripe wiring | 1 (F9) | Engineering verify + copy soften |

## Single combined Ahmad approval pass

Adding these 4 to the original 5: **9 phrasings to confirm, plus an engineering verify on `/plans` Stripe.** Still under 30 minutes of your time.

Cowork can pre-draft Codex commit message + diff plan covering all 9 findings as ONE copy-only commit (zero design changes), if you want a single sign-off instead of nine. Say the word.

## Stop rules

- Cowork does NOT edit public HTML. Visual-stability hard rule.
- Ahmad picks per finding (or "go with Cowork's recommended alts").
- Track 9-Fix-Stripe is engineering work — Cowork can't verify Stripe wiring; Codex/Ahmad does.
- Nothing in this audit gets shared externally until Ahmad chooses fixes.

## One-line summary

> Deeper sweep added 4 findings, most-important being the "Enterprise Track Record" reframe (Ahmad's prior employers were claimed as IIS clients on about.html — federal-bid disqualifier risk). All 9 findings have honest replacement language drafted. Single copy-only commit available on your sign-off.
