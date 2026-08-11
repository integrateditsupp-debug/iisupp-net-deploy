# Support commitment conflicts — the promises we make two ways

Opened RUN-AY / AY2, 2026-08-11.

AX1 read the pack a **prospect's reviewer** works through and found two policies disagreeing about
backup retention. This register is for the commitments that bind **after the money moves**: how fast
we answer, how available the service is, who can reach a human at 3am, and where a customer escalates
when the first route does not answer.

`scripts/lib/support-commitments.mjs` reads the contract, the questionnaires, the incident policy and
the DPA as one body. It has no code path that can call a disagreement consistent, and **no code path
that picks which promise is right** — what this company owes a paying customer is a decision, not a
formatting choice.

**Why this class is more dangerous than the currency AV1 found.** A wrong currency is breached
loudly: a card is charged in the wrong denomination and somebody notices within the hour. A missed
response time is breached **silently, by nobody doing anything**. If the contract says fifteen
minutes and the questionnaire says an hour, the breach happens at minute sixteen and the only person
who knows is the customer, who is already having a bad day. There is no event to catch and no error
to log. The failure is an absence, which is why it is read by code rather than remembered.

A disagreement has exactly three fates, as under AX1:

- **Resolved** in the documents themselves, by a person deciding — the entry here then reads STALE on
  the next run and must be removed. A register that rots reads as diligence and is worse than none.
- **Declared open here**, with a reason a person wrote and a named decider. Reported every run, never
  green-washed, and it does not hold the registry red.
- **Undeclared** — the audit goes RED.

A declaration with no reason, a reason too short to be one, a reason that only restates the topic, or
no named decider is **REFUSED** by the reader and also goes red.

Nothing in this register edits a document to make a count green (Rule 15). Nothing in it asserts a
figure that was not read out of the file that states it (Rule 14).

## Kept separate from `PACK-ANSWER-CONFLICTS.md` deliberately

That register is about what a pack of documents tells a reviewer **before** a signature. This one is
about what this company owes a customer who is **already paying**. The decider reads a different list
at a different moment, and merging them would bury a live contractual obligation inside a
due-diligence backlog.

| Topic | State | Reason a person wrote | Who decides |
|---|---|---|---|
| p1-response-enterprise | open | Schedule B of the MSA commits an Enterprise customer to a fifteen-minute P1 response, and the SIG-Lite the same buyer's own security reviewer works through states "P1 within 1 hour to Customer" with no tier written beside it at all. Both are client-facing and both are in the packet a single deal receives, so one buyer can be handed the two of them in the same week. The unqualified sentence is the dangerous half: whoever reads it is never told a tier table exists, so a Personal-plan customer reads an hour they were never sold and an Enterprise customer reads an hour that is four times slower than the one they paid for. Either the questionnaire answer states the tiers or Schedule B is what we actually commit to, and that is a contractual and a staffing decision about what one founder can answer at 3am, not a formatting fix. | Ahmad |
| p2-response-enterprise | open | The same split one severity down and from the same two lines: Schedule B commits an Enterprise customer to a one-hour P2 while the SIG-Lite states "P2 within 4 hours" with no tier stated. It is recorded as its own entry rather than folded into the P1 row because they can be decided differently — a founder-run desk may reasonably hold a fifteen-minute P1 and refuse a one-hour P2, and collapsing the two rows would hide that option from the person deciding. | Ahmad |
