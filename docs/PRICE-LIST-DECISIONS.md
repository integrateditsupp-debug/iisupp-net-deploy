# PRICE LIST — the questions, and where they stop being software's

RUN-BF / BF1 + BF2, 2026-08-12. Every figure below was read first-hand from the file named beside
it. Nothing here is inferred, averaged, forecast, or repaired.

Run it yourself:

```
node -e 'import("./scripts/lib/price-consistency.mjs").then(m=>{const r=m.auditPrices({root:process.cwd()});console.log(m.statementFor(r))})'
```

---

## What does NOT disagree, stated plainly

The price **numbers** agree on every surface that quotes them. All five ARIA Sentinel monthly
figures — $899 · $2,250 · $19,500 · $39,000 · $78,125 — are identical on the plan cards
(`plans/index.html:130-187`), in the comparison matrix (`plans/index.html:1002`) and on
`pricing-experiments.html:30-34`. The savings calculator's annual bands
(`plans/index.html:473-477`) divide by twelve into exactly those monthly figures.

`priceDisagreements: 0`. That is a real result and it is worth saying rather than passing over.

The three retainer decks on `index.html` publish **bands** — $6,000–$10,000, $14,000–$24,000,
$30,000–$60,000 per month. A band is a legitimate way to publish a human-delivered service that is
scoped before it is priced, and it is reported as its own class rather than as a defect. Nobody is
charged a band by clicking.

---

## Decision 1 — who is each tier for?

**Two surfaces route the same company to different tiers, and therefore to different prices.**

| headcount | `plans/index.html` savings calculator | `pricing-experiments.html` reference |
|---|---|---|
| 1 – 10 | Personal · $899/mo | Small Business · $19,500/mo |
| 11 – 20 | Pro · $2,250/mo | Small Business · $19,500/mo |
| 21 – 75 | Pro · $2,250/mo | Mid Size · $39,000/mo |
| 76 – 100 | Small Business · $19,500/mo | Mid Size · $39,000/mo |
| 101 – 500 | Small Business · $19,500/mo | Enterprise · $78,125/mo |
| 501 – 1500 | Mid-Size · $39,000/mo | Enterprise · $78,125/mo |

Twelve boundary sizes were probed, every one drawn from a boundary one of the two surfaces
declares. All twelve disagree.

The worst spread is a **500-person company: $19,500/mo on one surface, $78,125/mo on the other** —
four times the price, on the same site, in the same week.

Neither surface is lying. Nobody had ever compared them. This is the class of thing that surfaces
as a customer quoting your own site back at you during a renewal negotiation.

**The question:** which staff-count band belongs to which tier? One answer, five rows.

---

## Decision 2 — a 100-person company is two tiers on one page

`pricing-experiments.html` says Mid Size is a "21-100 staff org" (line 33) and Enterprise is a
"100+ staff org" (line 34). A company with exactly 100 staff is both, at $39,000/mo and
$78,125/mo.

One character — `100+` becoming `101+`, or `21-100` becoming `21-99`. The cheapest item on this
page, and the likeliest to be found by a customer reading the page top to bottom.

---

## Decision 3 — the tier is called three things

`scripts/lib/tier-registry.mjs` now declares the vocabulary once, and in declaring it records three
contradictions it refuses to resolve on its own:

| where | says | and | in |
|---|---|---|---|
| `legal/MSA-template.md:167` (Schedule A) | `Small Business` | `SBA` | `legal/MSA-template.md:185` (Schedule B) |
| `legal/MSA-template.md:167` (Schedule A) | `Mid-Size` | `Mid` | `legal/MSA-template.md:185` (Schedule B) |
| `plans/index.html:173` (plan card) | `Mid-Size` | `Mid Size` | `plans/index.html:1002` (matrix) |

The first two are inside **one document, under one signature**. A customer who signs Schedule A as
"Small Business" has no row carrying that name in the SLA schedule four pages later.

**The question:** one name per tier, and then the three surfaces are edited to match it.

---

## Where the software stops

Nothing above was edited. No price was changed, no band was narrowed, no name was harmonised
(Rule 15). `resolvedHere: false` is asserted by the suite on both modules: which number is right,
and which surface moves, is a decision about what this company sells and to whom.

When the direction is decided, it goes in:

```
senior-director-state/decisions/price-list.json
```

Any shape with a `decidedBy` is enough to flip the audit from **UNDECIDED** (report the gaps) to
**DIVERGENT** (go red until the tree matches). The decision is made once; the suite holds it from
then on.

Bands are unaffected — they are declared, not decided.
