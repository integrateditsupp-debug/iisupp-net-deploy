# Observability gaps — the promises nothing on this machine can measure

Opened RUN-AZ / AZ1, 2026-08-11.

AY2 read every support and availability commitment this company makes as one body and found where two
surfaces disagree. `scripts/lib/churn-signals.mjs` asks the prior question of the same promises: if
one of them were broken, **is there anything in the shared line that could tell us?**

Most of them are broken *silently*. A wrong currency is breached loudly — a card is charged in the
wrong denomination and somebody notices within the hour. A missed response window, a status page that
never updated, a post-incident review that was never sent: these are breached by **nobody doing
anything**. There is no exception, no failed request, no error to log. The only party who reliably
notices is the customer, and the way they tell you is by not renewing.

## The three fates of an unobservable promise

- **Covered** by a signal in `CHURN_SIGNALS`, with a receiver in the shared line that retains the
  event and something that reads it back. The entry here then reads STALE on the next run and must be
  removed — a register that rots reads as diligence and is worse than none.
- **Declared open here**, with a reason a person wrote and a named decider. Reported every run and
  never green-washed; it does not hold the registry red.
- **Undeclared** — the audit goes RED.

A declaration with no reason, a reason too short to be one, a reason that only restates the topic, or
no named decider is **REFUSED** by the reader and also goes red.

## What this register is not

It is not a backlog of dashboards to build. Several of these promises are kept by a **person doing
something a person should do**, and instrumenting them would be worse than leaving them uninstrumented
— a founder writing a post-incident review is the product, not a workflow step to be automated.
Others cannot be measured because the artefact they would be measured against has never existed, and
inventing that artefact to make a count green would be the fabrication Rule 14 forbids.

Nothing here edits a commitment to make a number move (Rule 15). Nothing here asserts a signal that
was not read out of the file that carries it (Rule 14).

## Kept separate from `SUPPORT-COMMITMENT-CONFLICTS.md` deliberately

That register holds promises that disagree **with each other**. This one holds promises that agree
with themselves and that **nothing can measure**. They are closed by different work — one by a
decision about what we owe, the other by an artefact that retains an event — and merging them would
put a contradiction and a blind spot on the same line as if they were the same problem.

## Open

| topic | state | reason | who decides |
| --- | --- | --- | --- |
| status-page-update | open | The incident-response policy commits to a status page reflecting a confirmed incident inside a stated window, and there is no status page in the shared line at all — nothing publishes one, nothing records when it was last written, and there is therefore no artefact against which the window could ever be checked. Building a status page to satisfy this row would be building a product surface to make an audit green rather than because a customer asked for one, which is the wrong reason to ship anything. The decision is whether a one-founder company publishes a status page at all, or whether that sentence comes out of the policy. | Ahmad |
| incident-customer-email | open | The policy commits to an affected customer receiving an email inside a stated window during an incident. Mail leaves this environment through Resend and through SMTP, and neither path writes a record of what was sent to whom and when — `netlify/functions/stripe-webhook.js` posts to the Resend API and keeps nothing, so a notification is provable only by whatever survives in a sent-items folder. This is closable, and it is the cheapest row here to close: the same call that sends could stamp the moment. It waits on a decision about where that stamp is kept, because a delivery record is customer data and lands under the DPA. | Ahmad |
| post-incident-review | open | The commitment is that a customer receives a written review within a stated number of days of an incident. This is kept by a founder writing a document and it should be — a post-incident review that a system emitted is worth nothing to the customer reading it, and automating it would automate the apology. What could honestly be observed is only whether a document exists per incident, which presumes an incident register that has never been written and is already a declared AX2 citation gap. | Ahmad |
| uptime-enterprise | open | The MSA states an availability figure to an Enterprise customer. Availability is the one commitment in this list that cannot be measured from inside the thing being measured — an uptime number computed by the service about itself is not evidence, and an outage that takes the function down also takes the measurement down. Honest measurement needs a prober somewhere else, which is a free-tier decision and an operational one, not a code change. | Ahmad |
| maintenance-window | open | The MSA names a window in which the service may be taken down for scheduled maintenance. Nothing in the shared line records a maintenance event, because there has never been one — no deploy is announced, no window is opened, no notice is stamped. The row is honest as a gap rather than a defect: the promise is real, the event has not happened yet, and the moment to decide how it is recorded is before the first one, not after a customer asks why the service was down inside a window they were never told about. | Ahmad |
| 24x7-reporting | open | The questionnaire tells a reviewer who can reach a human at 3am. Whether that promise was kept is a fact about a person answering a phone, and no code in this repository is on that path — there is no telephony, no pager, and no on-call record. Instrumenting it would mean routing a founder's phone through a system for the sole purpose of proving he answered it. The decision is whether the answer stays a founder's direct line, in which case this stays permanently declared, or whether 24x7 becomes a product commitment with a rota behind it. | Ahmad |
| escalation-route | open | The DPA names where a customer escalates when the first route does not answer. Escalation is by definition the path taken when the normal path failed, so the only honest signal would be a record of the first route NOT answering — which is exactly the response-window gap one row above, seen from the customer's side. It is declared rather than merged into that signal because the second route is a different promise to a different person on a worse day, and folding it into response times would hide the case where the escalation address itself is stale. | Ahmad |
