# Pack answer conflicts — the questions this pack answers two ways

Opened RUN-AX / AX1, 2026-08-11.

RUN-AW read each of the twenty-seven client-facing documents on its own. This register exists because
a security reviewer never does. They read an **answer**, assembled from several of these documents at
once, and the failure that costs a deal is not a wrong sentence in one file — it is two files
answering the same question differently, discovered by the person we are asking to trust us.

`scripts/lib/pack-answer-consistency.mjs` reads the pack as one body and compares every answer it
finds. It has no code path that can call a disagreement consistent, and **no code path that picks
which answer is right** — what this company promises a paying customer is a decision, not a
formatting choice.

What software *can* refuse is silence. So a disagreement has exactly three fates:

- **Resolved** in the documents themselves, by a person deciding — the register entry then goes
  STALE on the next run and must be removed. A register that rots reads as diligence and is worse
  than no register.
- **Declared open here**, with a reason a person wrote and a named decider. Reported on every run,
  never green-washed, and it does not hold the registry red.
- **Undeclared** — the audit goes RED. The cheapest moment to notice two client-facing policies
  disagreeing is the moment the second one is written, not the moment a reviewer reads both.

A declaration with no reason, a reason too short to be one, a reason that only restates the topic, or
no named decider is **REFUSED** by the reader and also goes red.

Nothing in this register edits a document to make a count green (Rule 15). Nothing in it asserts a
figure that was not read out of the file that states it (Rule 14).

| Topic | State | Reason a person wrote | Who decides |
|---|---|---|---|
| backup-retention | open | The BCP policy tells a reviewer that droplet snapshots keep seven days by default and that ninety days is an extra five dollars a month; the data-classification policy tells the same reviewer that backup retention is ninety days rolling. Both are client-facing, both ship in the same packet, and only one of them can be what a customer actually gets when they ask us to restore something from two months ago. The seven-day figure describes the plan we pay for today and the ninety-day figure describes the promise the pack makes. Picking is a spend decision and a contractual one, so it is staged rather than guessed. | Ahmad |
