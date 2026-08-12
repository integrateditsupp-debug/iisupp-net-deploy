# The amount a buyer is actually charged — what the tree says, and the three questions that are Ahmad's

RUN-BK · BI2 · 2026-08-12 · read first-hand from `index.html`, never inferred.
Produced by `scripts/lib/chargeable-amounts.mjs`, held by `tests/chargeable-amounts.test.mjs` (27 cases).

A published price is a statement. A chargeable amount is a transaction. RUN-BF checked the figures a
stranger *reads* against each other and found the numbers agreed. Nothing in this tree had ever
checked the figures a stranger is *charged* against the figures on the card they clicked.

## What the audit reads

Nineteen options across six `data-buy-options` attributes on `index.html`. Thirteen carry an amount;
six are "Request Custom Quote" and carry none.

**Nine of the thirteen are the exact floor of a band published on the same card.** That is the
strongest possible result and it is stated rather than passed over: a buyer who clicks *First Month*
on Tier 2 is charged $14,000, and $14,000 is the first number on the card they were reading. Same for
every Home Foundations and Recovery & Security line item. Nobody had verified it; it holds.

## What is open — four deposits that appear nowhere a buyer reads

| card | published band | deposit charged | share of the floor | line |
|---|---|---|---|---|
| Tier 1 · Operational Foundation | $6,000 – $10,000 / mo | **$2,000** | 33.33% | `index.html:2437` |
| Tier 2 · Business Continuity | $14,000 – $24,000 / mo | **$4,000** | 28.57% | `index.html:2472` |
| Tier 3 · Enterprise Operations | $30,000 – $60,000 / mo | **$10,000** | 33.33% | `index.html:2508` |
| Monthly Home IT | $1,500 – $3,000 / mo | **$750** | 50.00% | `index.html:2631` |

Two separate findings, kept apart because the remedies differ:

1. **The amount is unpublished.** The card says a monthly band. The button says "Deposit to start".
   The figure itself first appears inside the checkout. A deposit is a legitimate way to start a
   retainer; a deposit a buyer meets for the first time at the moment of payment is a different
   thing, and it is the one every one of these four is.
2. **The four follow no stated rule.** 33.33%, 28.57%, 33.33%, 50.00%. The percentages are arithmetic
   over two published figures and the division is printed so it can be checked rather than trusted.
   Three cards at a third and one at a half may be exactly what is intended — the audit does not
   correct it and does not say which figure moves.

## The three questions, and why software cannot answer them

1. **Is a deposit a fixed share of the floor, or a figure set per card?** If it is a share, Tier 2 at
   28.57% and Monthly Home IT at 50.00% are the two that differ from the other two.
2. **Should the deposit be printed on the card?** One sentence per card — "Deposit to start: $2,000,
   credited against month one" — closes the whole class. The audit will read it the moment it exists.
3. **Is the deposit credited against the first month, or additional to it?** The option's description
   says *"Deposit against … monthly retainer"*, which reads as credited; nothing on the card a buyer
   reads says so either way.

These are decisions about what this company sells and to whom. `resolvedHere` is asserted `false` and
a test proves no output field ever names a surface that must move.

## How to declare a direction

Write `senior-director-state/decisions/chargeable-amounts.json`:

```json
{ "publishDeposits": true, "depositPolicy": "one third of the band floor, credited against month one" }
```

The verdict moves from `UNDECIDED` to `ALIGNED`, and any future drift from the declared direction —
a new charge amount with nothing behind it, a deposit that stops being published — turns the suite
red. Until it exists, the audit reports and fails nothing.

## What was proven red-first

Every class was proven against a fixture built to fail exactly that way before the real tree was
trusted: a charge below every band on its card, a deposit published nowhere, the inverse (a deposit
that *is* printed, which must **not** be reported — otherwise the class is noise), a grouped amount
like `2,000.00` refused rather than repaired, a buy button outside any declared deck, a missing
surface, an attribute that is not JSON, and a direction file that does not parse being treated as
undecided rather than as permission.

The grouping check is not hypothetical. RUN-BF's money parser matched `[0-9][0-9,]*` and stripped
commas, so a truncated `$1,2` read as `$12`. A parser that repairs the number a card is debited for
is inventing a transaction. Both parsers here validate grouping and refuse.
