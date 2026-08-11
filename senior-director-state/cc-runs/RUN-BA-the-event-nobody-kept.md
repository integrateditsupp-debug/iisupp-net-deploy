> STATUS 2026-08-11 (cycle 144): RELEASED. BA1 · BA2 · BA3 · BA4 open. Registry on release: 1063/1063 · 371/371 · exit 0.

# RUN-BA — the event nobody kept

Auto-released 2026-08-11 on the close of RUN-AZ / flywheel cycle 143. Previous: RUN-AZ — the customer
who stops answering, 4/4. Registry 1063/1063 · 371/371 · exit 0.

## Why this sequence

RUN-AZ asked whether this company could notice a customer in trouble and answered honestly: four of
seven signals resolve end to end, one is received and retained by nothing, two have no source at all.
It stopped exactly where an audit has to stop — at the report.

The finding underneath it is sharper than the count. **Sign-ins are received by three functions and
retained by none.** That single absence is why a customer drifting out of the product and a customer
growing out of their tier are the same invisible event, and it is why three of the ten steps toward a
second sale are blocked. It is also, unlike almost everything else this program has staged, closable
without a decision from Ahmad and without a dollar: the functions already run, the store already
exists, and the only thing missing is that nothing writes.

Three things follow, and none of them has been done:

**An event that is retained is not yet an event that can be read.** AZ1 named RETAINED-UNREAD as its
own class precisely because storage without a query is a gap wearing a solution's clothes. If this
cycle writes sign-ins and nothing asks the question, the number moves and the company learns nothing.

**A retention decision is a privacy decision.** The DPA states what is kept and for how long, and any
new stamped event lands inside that promise. A cycle that starts recording customer activity without
resolving it against the retention table would create the exact contradiction AX1 and AY2 exist to
catch — this time authored by us, this cycle, rather than inherited.

**Nothing here has ever verified that a thing it built is actually reachable in production.** Every
module in this series reads the tree. A function that writes to a store is the first artefact whose
correctness depends on something outside the repository, and the honest treatment of that boundary is
the whole task, not a footnote.

Same shape as every finding this series has produced: not a wrong answer, an unasked question.

## Tasks

**BA1 — the sign-in stamped, inside the promise we already made.** *Exit:* the retention window for a
sign-in record resolved against the DPA's retention table and the privacy policy BEFORE anything is
written, with a conflict reported and never resolved by software; the record's shape carrying the
minimum that answers the question and nothing more (Rule 11 — no name, no address, no content); and
the write itself proven in a throwaway store with no network, no key and no customer data. If the
retention table has no row for this class, that is a DECLARED decision for Ahmad, not a default
somebody picked.

**BA2 — the question asked, not merely the event kept.** *Exit:* a read path that can answer "has
this customer gone quiet" and "has this customer outgrown their tier" from what BA1 retains, resolved
against AZ1 so the signal's state moves from TRANSIENT to OBSERVABLE by measurement rather than by
assertion. A signal that still cannot be answered stays TRANSIENT and says why. No health score, no
risk number, no chart — AZ1's refusal is inherited whole and its suite must still pass unchanged.

**BA3 — what a production write costs, counted rather than assumed.** *Exit:* every act between the
code existing and the event actually being recorded for a real customer — deploy, environment, store
provisioning, the operator's one click — counted in acts and artefacts, never hours, with
manual-BY-DESIGN kept apart from manual-for-want. A step that depends on something outside this
repository is its own class with its reason, never rounded into either bucket, because a module that
reports a production dependency as done is the failure mode this task exists to prevent.

**BA4 — regenerate the AXIS status feed and the ledger head from this cycle's own numbers.** Standing
under AM1, AN2, AO3, AP4, AS4, AT4, AU4, AV4, AW4, AX4, AY4, AZ4. *Exit:* fresh `generatedAt`, one
truth object, feed + head + truth artefact in one transaction, publish rehearsal green inside the
emit, full registry green before any write and after every write, and every audit this series has
built still wired in as refusals.

## Exit criteria

All four tasks green, registry green on the real tree before and after every write, feed and head
agreeing, and every gate this series has built still holding: AW1 at 27/27, silent claims at zero,
the yes-path at 6/6, the prospect packet at 27/27, the customer packet at 6/6, the send sheet at zero
judgement calls, AX1 and AY2 with zero undeclared disagreements, AX2 with zero misdirected citations,
AZ1 with zero unclaimed-and-undeclared commitments, AZ2 with zero undeclared stages, AZ3 emitting no
money. And the staged list still led by the twelve second messages — which no software in this
repository can send.

## What stays out of scope, deliberately

Not deploying. Not creating a store, a key or an account. Not recording anything for a real customer —
every write in this cycle happens in a throwaway directory or a scratch store and is discarded.
Not deciding the retention window, what a renewal can change, the P1/P2 response times, the currency,
the price list, the insurance sentence, or the six unwritten artefacts — those are Ahmad's, and
staging them is the whole job. Not building a customer-health dashboard: a score computed from two
signals is still a score computed from signals, and AZ1's refusal does not expire because the data
improved.
