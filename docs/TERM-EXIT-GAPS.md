# Term and exit gaps — what a customer is told about leaving

Opened RUN-AZ / AZ2, 2026-08-11.

Every cycle since RUN-M has been about getting INTO a contract. `scripts/lib/term-and-exit.mjs` is
the first thing in this program that walks out of one: the term ending, the notice that stops a
renewal, the export window, the destruction window, and the renewal conversation itself — each
resolved against HEAD's tree, and each number cross-read against every document that states it.

A stage has three fates, and a term window has the same three:

- **Delivered / agreed** — an artefact a clone receives carries the stage and actually speaks to it,
  and every document stating a window states the same one. The entry here then reads STALE and must
  be removed.
- **Declared open here**, with a reason a person wrote and a named decider.
- **Undeclared** — the audit goes RED.

A declaration with no reason, a reason too short to be one, a reason that only restates the topic, or
no named decider is **REFUSED** and also goes red.

## Why a silent document is not a delivered one

A file can be present, correct, and completely silent about the thing a stage is about. AY1 added
that state and this module inherits it: a packet that counts filenames has not been read. The stage
below is exactly that case — the documents that would carry it exist, are in the shared line, and say
nothing about it.

## Why nothing here is written to close a check

The missing artefact below could be produced in an afternoon by whoever is closing this row. That is
precisely the reason it is not: what a renewal conversation contains — whether a price can move,
whether the tier can change, what a customer is entitled to be told before it auto-renews — is a
commercial decision this company has not made. A document written to make an audit green would fix
the count and commit the company to terms nobody chose (Rule 14, Rule 15).

## Open

| topic | state | reason | who decides |
| --- | --- | --- | --- |
| X-06 | open | Nothing a customer receives says what happens at renewal beyond the fact that it happens. The MSA states the term auto-renews for successive periods equal in length unless 30 days' notice is given, and the plan page states prices — and neither says whether the price a customer renews at is the price they signed at, whether the tier can be changed at renewal, or whether they are told anything before the renewal date arrives. This is the moment a services company either grows a customer or loses one silently, and right now it is governed by nothing written down. It is deliberately NOT closed by writing a renewal clause into the MSA: the clause would commit this company to terms nobody has decided, which is worse than the gap. The decision is what a renewal is allowed to change and what notice a customer gets before it does. | Ahmad |
