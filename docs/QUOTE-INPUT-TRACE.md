# The document a conversation ends in — every input, traced

RUN-BL / BL1 · 2026-08-12 · read first-hand from this tree by `scripts/lib/quote-inputs.mjs`,
proven by `tests/quote-inputs.test.mjs` (16 cases, every class red-first).
Nothing here was typed from memory; every figure and every line number below is read at run time
out of the module that already owns it.

## Why this took five cycles to reach

BG deferred it, BH found the branch reference under it, BI found the tier vocabulary under that, BK
found the amount a buyer is actually charged. Each cycle found something upstream, and each one was
right to. Everything a quote needs to *say* is now readable from code. What was never traced is the
thing they all lead to: six buttons that say **Request Custom Quote**, and what happens after one is
clicked.

## What running it found

Six quote buttons on `index.html`. Fifteen inputs traced. Six carried by an artefact, three a
person's step by design, four asked of the buyer and captured by nothing, **two missing for want of
an artefact — and both are named, not counted.**

### Finding 1 — the generator and the buttons are wired to different price lists

There *is* a proposal generator, and it is a good one: `retainer-proposal.mjs` selects every figure
by key out of the published plan table and stamps it with the file and line it came from, so a
proposal can never quote a price the website does not.

It is priced off `plans/index.html`, whose keys are `personal`, `pro`, `small-business`, `mid-size`
and `enterprise`. The six quote buttons are on `index.html`, on retainer decks whose tiers are
`retainer-tier-1`, `retainer-tier-2` and `retainer-tier-3`. Those tiers have no key in that table at
all.

Asked for a proposal against the card a buyer actually clicked, the generator refuses with
`unknown-plan` — **correctly**, because inventing a figure would be the worse answer. This was
established by *running* the generator against each tier this cycle, not by reading two files and
assuming they meet.

So the artefact exists, the surface exists, and they have never been introduced.

Two honest ways to close it. The choice is a decision about what is sold, not a defect to patch:

1. Publish the three retainer tiers in `plans/index.html`, so each carries a traceable figure and
   the existing generator can price them unchanged.
2. Teach the generator to read the band off the deck and render a **range**, with the scoping call
   named inside the document as the step that resolves it.

Inventing a single figure for a bespoke scope is the one option that is not available (Rule 14).

### Finding 2 — three cards offer a quote and are named nowhere

`Home Foundations`, `Recovery & Security` and `Monthly Home IT` each carry a Request Custom Quote
button and none of them appears in the tier registry. A quote for a card this tree cannot name has
nothing to check its wording, its band or its response time against — the vocabulary work BI did for
the retainer line, not yet done for these three.

Reported separately from Finding 1 on purpose. Folding them together would have made the whole trace
read UNREADABLE and buried the generator gap under a smaller, different problem.

### The four facts nobody keeps

Clicking Request Custom Quote opens a `mailto:` (`index.html:4503`) that asks a stranger for four
things — **users/devices, locations, current stack, timeline** — and drops the reply into an inbox.
Nothing in this tree parses, stores or carries any of them. The second person to touch that deal
starts from prose in an email. That is not a defect in the mailto; it is the absence of an intake
artefact, and it is stated here rather than absorbed.

## The trace

| input | origin | state | carried by / what is missing |
|---|---|---|---|
| `buyer.users-devices` | buyer | ASKED, NOT CAPTURED | asked at `index.html:4503`; no intake artefact |
| `buyer.locations` | buyer | ASKED, NOT CAPTURED | asked at `index.html:4503`; no intake artefact |
| `buyer.current-stack` | buyer | ASKED, NOT CAPTURED | asked at `index.html:4503`; no intake artefact |
| `buyer.timeline` | buyer | ASKED, NOT CAPTURED | asked at `index.html:4503`; no intake artefact |
| `scope.of-work` | founder | **by design** | a scope written by software is a scope nobody agreed to |
| `price.figure-for-this-scope` | founder | **by design** | which point inside a published band this buyer is quoted is a commercial judgement |
| `client.identity` | buyer | by design | lands in `generateRetainerProposal({ client })`, which refuses a proposal addressed to nobody |
| `price.published-band` | tree | carried | `chargeable-amounts.mjs · readCharges()` — `index.html:2437, 2472, 2508` |
| `price.deposit` | tree | carried | same; four deposits still published nowhere a buyer reads (`docs/CHARGEABLE-AMOUNT-DECISIONS.md`) |
| `tier.identity` | tree | carried | `tier-registry.mjs · TIERS` — 8 tiers across 2 lines |
| `tier.card-identity` | tree | **MISSING** | a registry entry for Home Foundations · Recovery & Security · Monthly Home IT |
| `document.sections` | tree | carried | `retainer-proposal.mjs · REQUIRED_SECTIONS` — Scope, Not included, Term, Notice, What you own at the end, Price |
| `document.generator-for-this-surface` | tree | **MISSING** | a price key for the deck tiers that `plans/index.html` publishes |
| `terms.response-times` | tree | carried | `docs/RESPONSE-TIME-DECISIONS.md` (141 lines) |
| `terms.retention` | tree | carried | `docs/RETENTION-DECISIONS.md` (121 lines) |

## The two classes that never merge

A **person's step** and a **gap** are different things and are reported as different things. Scoping
the work and naming the number are Ahmad's, and reporting them as missing would bury the two real
gaps under work nobody should automate. A gap is an input that needs no person and that nothing in
this tree produces.

Held to by test: with every artefact present, `scope.of-work` and `price.figure-for-this-scope` stay
BY_DESIGN and the gap count reads zero.

## What this refuses to do

- **Never hours.** This company sells a flat retainer. An hours figure read off a card is a refusal
  that drags the whole verdict to UNREADABLE, proven by fixture — and the inverse is proven too, so
  the guard is not a rubber stamp.
- **No figure is typed into the trace.** `quote-inputs.mjs` contains no dollar literal, asserted by
  reading its own source. Every amount is read from the module that owns it.
- **A provider that cannot be read is UNREADABLE, never clean.** "I could not check" and "there is
  nothing there" are different facts and only one of them is a finding.
- **It writes nothing, sends nothing, and decides nothing.** It states the gaps and the options.

## Needs Ahmad (one-click, not a hold)

1. Which way Finding 1 closes: publish the retainer tiers in the plan table, or render a range.
2. Whether the three private-engagement cards get registry entries or stop offering a quote.
3. Whether the four intake facts should land in an artefact at all, or stay a conversation.

Carried forward, unchanged: the deposit rule (`docs/CHARGEABLE-AMOUNT-DECISIONS.md`), the price-band,
tier-name and response-time directions, and the Netlify publish.
