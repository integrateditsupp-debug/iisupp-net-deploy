# Response-time decisions — resolved before anyone signs

Opened RUN-BE / BE1, 2026-08-11. Companion to `docs/RETENTION-DECISIONS.md`, which did the same job
for retention, and to `tests/currency-consistency.test.mjs`, which did it for currency. This is the
third of the four decisions a paying stranger runs into, and it is the one with a signature under it.

Everything below was read out of the files named beside it. Nothing customer-facing was changed. No
number was written onto any page. The audit that produced these citations is
`scripts/lib/response-time-consistency.mjs` and it is held by 20 tests in
`tests/response-time-consistency.test.mjs`.

## The finding, in one sentence

**The company binds itself to ten response-time commitments in the document a customer signs, and
states none of them on the page that customer chose from.**

## What the signable agreement binds

`legal/MSA-template.md` Schedule B, lines 188–189, read verbatim:

| | Personal | Pro | SBA | Mid | Enterprise |
|---|---|---|---|---|---|
| P1 response time | Next biz day | 4 hr | 1 hr | 30 min | 15 min |
| P2 response time | 5 biz day | Next biz day | 4 hr | 2 hr | 1 hr |

Line 193 of the same file attaches a remedy to missing them: service credits, capped at 30% of the
monthly fee. So these are not aspirations. They are ten obligations with a price attached to failing
them.

## What the buying surface states

`plans/index.html`, the five-tier comparison matrix between its `SENTINEL_MATRIX` markers (line 1002),
publishes **Personal · Pro · Small Business · Mid Size · Enterprise** and carries this row:

> SLA tracking — · ✓ · ✓ · ✓ · ✓

That row states that an SLA is *tracked*. It never states what the SLA *is*. A buyer comparing tiers
on that page cannot learn, at any price point, how quickly anything gets answered. **Zero of the ten
bound commitments appear on it.**

There is one number published anywhere a buyer can reach it — `index.html:2463`:

> Priority SLA — 1 hour response or less

It sits on a retainer deck priced **$14,000 – $24,000 / mo**, which is a price band, not a matrix
tier. It is recorded here as UNATTACHED: it may well describe the Small Business tier, whose bound P1
is exactly 1 hr, but "may well" is not a mapping, and the audit is forbidden from inventing one.

## Why this is a decision and not a bug to be fixed quietly

Three separate things are wrong and they have three different remedies, so collapsing them into one
"add the numbers to the page" task would ship two mistakes:

**1 · The disclosure gap (nine tiers' worth).** Pro, Small Business, Mid Size and Enterprise each bind
a P1 and a P2 the page never mentions. The remedy is to publish what is already owed. This is
additive and breaks nothing (Rule 15). It is also the single most persuasive row the plans page does
not have — "15 minutes" sells a tier in a way "SLA tracking ✓" never will (Rule 17).

**2 · The Personal contradiction.** The matrix marks SLA tracking `—` for Personal. Schedule B binds
Personal to a next-business-day P1 and a five-business-day P2. **One of those two documents is wrong
and software may not choose which.** Either Personal genuinely carries a next-business-day commitment
and the matrix understates it, or it does not and the agreement over-promises against a $899/mo tier.

**3 · The unattached prose.** The home page's "1 hour response or less" is bound to a price band with
no tier behind it. Either the retainer decks are declared as mapping onto matrix tiers, or that line
is restated against a tier, or it is withdrawn.

## The three questions, stopped exactly where they become Ahmad's

**Q1 — Are the bound response times published on the plans page?**
Recommendation from this seat: yes, and there is no honest argument for no — the customer is bound by
them either way, and the only effect of withholding them is that they are discovered during a
dispute rather than during a decision. But publishing a commitment is a promise this company then has
to keep with the staffing it actually has, and that is Ahmad's call, not an audit's.

**Q2 — Does the Personal tier carry an SLA?**
The two documents disagree. Answering Q2 decides which one gets corrected.

**Q3 — Do the retainer decks map onto matrix tiers?**
If yes, the mapping gets declared and the 1-hour line becomes checkable. If no, the line is restated
against something a buyer can act on.

## How the answer is recorded

One file, written by Ahmad or on his explicit instruction, never by software:

`senior-director-state/decisions/response-times.json`

```json
{
  "publish": true,
  "personalCarriesSla": true,
  "decidedBy": "Ahmad",
  "decidedOn": "YYYY-MM-DD"
}
```

The moment that file exists, the audit stops reporting and starts enforcing: any tier whose published
commitment drifts from its bound one turns the suite red. Until it exists the verdict is `undecided`
and every gap is cited with a file and a line. **The audit cannot return `consistent` while a bound
commitment is published nowhere** — there is no code path that produces it, and a fixture proves it.

## Current verdict, measured this cycle

```
response times: UNDECIDED — 10 commitment(s) bound by the agreement and published nowhere,
1 stated in prose against a price band rather than a tier
```

10 bindings · 0 published · 0 tier-mapping failures · 1 unattached · 0 unreadable.
