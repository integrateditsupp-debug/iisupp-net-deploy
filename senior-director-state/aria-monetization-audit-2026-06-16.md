# ARIA Monetization Audit — 2026-06-16

**Owner:** Cowork (revenue-first ordering, Tier 6 audit).
**Triggered by:** idle-improvement loop + Ahmad directive "no over-promising."
**Inputs:** `senior-director-state/aria-monetization-packages.md` (updated 2026-06-16 12:00) + `plans/index.html` + CLAUDE.md project instructions + Federal Bid Supplement.
**Finding:** two parallel pricing systems exist with conflicting capacity assumptions.

---

## System A — SMB Advisory Packages (`aria-monetization-packages.md`, updated today)

6 packages, all advisory + methodology, no-insurance-friendly, federally defensible:

| Package | Price | Delivery shape |
|---|---|---|
| Starter AI Setup | $750 – $2,500 | One-time scoped engagement |
| AI Workflow Audit | $500 – $1,500 | One-time discovery + roadmap |
| AI Help Desk Blueprint | $1,500 – $5,000 | One-time design + handoff |
| Small Business AI Agent Setup | $1,000 – $3,500 | One-time setup |
| AI Knowledge Base Build | $1,500 – $6,000 | One-time KB architecture |
| Monthly AI Support Plan | $500 – $3,000 / month | Recurring retainer |

**Federal-bid compatibility:** ALL packages pass the no-insurance bid filter. Match PSPC Band 1 scope (≤ CAD $1M engagements). Align with the federal-safe ARIA one-pager.

## System B — Enterprise SaaS Tiers (`plans/index.html` + CLAUDE.md project instructions)

5 tiers, presented as a self-serve subscription:

| Tier | Price | Implied capacity |
|---|---|---|
| Personal | $599 USD / month | 1 user, "24/7 chat + voice support" |
| Pro | $1,500 USD / month | Team, "24/7 chat + voice support" |
| Small Business | $156,000 USD / year | ~13K/mo, enterprise SaaS |
| Mid Size | $312,000 USD / year | ~26K/mo, multi-tenant |
| Enterprise | $625,000 USD / year | ~52K/mo, dedicated CSM + SOC-2/ISO |

**Federal-bid compatibility issues:**
- Small Business / Mid / Enterprise tiers price as enterprise SaaS. IIS does not have the operating capacity (no insurance, no clearance, no team beyond Ahmad, no SOC 2 / ISO certification) to deliver this scale.
- $625K/year Enterprise contracts trip PSPC Band 1 ceiling (≤$1M) and would require Band 2 evidence IIS doesn't have.
- Personal + Pro tiers' "24/7 chat + voice support" claim is the same Finding 9 conflict already flagged in `aria-claim-conflicts-supplement-2026-06-16.md` — IIS doesn't staff 24/7 voice.
- Stripe checkout on `/plans` may be unwired per `project_aria_revenue_blockers` (STRIPE_SECRET_KEY missing prod). Buyer who hits SUBSCRIBE faces broken UX.

## The conflict in one line

> SMB packages reflect IIS's actual current capacity (advisory, methodology, founder-led). Enterprise tiers reflect IIS's aspirational future scale (SaaS, enterprise-grade, multi-tenant). Both live publicly. Federal evaluators + serious enterprise buyers see the mismatch.

---

## Three resolution paths (Ahmad picks one)

### Path 1 (recommended) — Restructure as "Services + Future Platform" with current packages dominant

**What changes publicly:**
- Homepage + services pages lead with SMB advisory packages (`aria-monetization-packages.md` items). Real, deliverable, federally aligned, no-insurance-friendly.
- `/plans` page remains BUT is reframed as **"ARIA Platform Subscription — Preview Pricing for Charter Customers"**. Charter customers get a discounted rate AND share input on platform feature priority. Removes any "24/7 voice" claim.
- Personal $599 and Pro $1,500 stay (SMB-priced, defensible).
- Small Business / Mid Size / Enterprise tiers are explicitly framed as "Roadmap Pricing — Available Q3 2026 (or earlier with Charter Customer commitment). Pre-order to lock current rate."

**Why this works:**
- Honest about current capacity.
- Keeps the aspirational pricing on the page (anchoring) without claiming delivery readiness.
- Lets Ahmad acquire revenue at SMB tiers TODAY while pre-selling enterprise for later.
- Federal evaluators see a vendor that's transparent about its stage.

### Path 2 — Pull enterprise tiers from public view until capacity lands

**What changes publicly:**
- `/plans` page shows ONLY Personal + Pro tiers. Small Business / Mid / Enterprise hidden until insurance + clearance + team-of-2 land.
- Aspirational tiers stay in private sales conversations only (NDA enterprise outreach).

**Why this works:**
- Cleanest from a claim-accuracy standpoint.
- No federal-evaluator confusion.
- Cost: loses the marketing anchor of $625K Enterprise tier on the public page.

### Path 3 — Status quo + add disclaimer

**What changes publicly:**
- Keep everything as-is.
- Add small disclaimer near enterprise tiers: "Enterprise pricing applies upon completion of mutual due-diligence, security clearance verification, and signed master services agreement."

**Why this works:**
- Minimum effort.
- Federal evaluators will still flag mismatch. Track record of website-vs-bid divergence stays.
- Cowork recommends NOT this path.

## Cowork's recommended pick

**Path 1.** Strongest combination of (a) immediate revenue from SMB packages at honest tiers, (b) aspirational anchoring kept visible, (c) federal-evaluator clean read, (d) buyer-trust preserved.

## Cross-system mapping (so both stay in sync)

If Path 1 is taken, here's the recommended mapping from current packages to plan tiers:

| Plan tier | Current realistic equivalent | Pre-order anchor |
|---|---|---|
| Personal $599/mo | "AI Workflow Audit" outcome subscribed monthly + Starter AI Setup | OK (real today) |
| Pro $1,500/mo | "AI Help Desk Blueprint" outcome + Monthly AI Support retainer | OK (real today) |
| Small Business $156K/yr | Roadmap — bundled IIS-managed AI desk + KB + governance for 50-100 seat firms | Available 2026-Q3 — pre-order locks rate |
| Mid Size $312K/yr | Roadmap — 100-500 seat firm with dedicated success rotation | Available 2026-Q4 — pre-order locks rate |
| Enterprise $625K/yr | Roadmap — regulated multi-tenant with SOC-2 evidence pack | Available 2027 — Charter Customer pre-commit only |

## Federal-bid implication

For PSPC AI Source List + OSFI Ransomware Tabletop, IIS bids at **services pricing**, not platform-subscription pricing. The Federal Bid Supplement §7 day-rates ($1,200-$1,800 Engagement Lead, $600-$1,000 documentation) are the relevant numbers, not the $599-$625K plans ladder. Cowork's federal bid responses already reflect this.

## What this audit does NOT do

- Does NOT propose pulling the enterprise pricing from CLAUDE.md project instructions (Ahmad set those intentionally as roadmap targets).
- Does NOT recommend lowering aspirational pricing — anchoring is real and useful when honestly framed.
- Does NOT touch any HTML. Same visual-stability rule. Cowork flags, Ahmad decides, Codex applies.

## Stop rules

- No public edit until Ahmad picks a path.
- No claim of 24/7 voice on any tier until staffing lands.
- No SUBSCRIBE button left unverified — engineering must confirm Stripe wiring before any traffic.
- Federal bids use day-rate pricing, not plan-tier pricing.

## One-line summary

> Two pricing systems coexist publicly: realistic SMB packages updated today vs aspirational enterprise tiers from project instructions. Cowork recommends Path 1 — keep both visible, but reframe enterprise tiers as "Roadmap Pricing — Charter Customer Pre-Order." Honest, anchoring preserved, federal-clean.
