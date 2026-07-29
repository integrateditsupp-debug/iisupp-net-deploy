# Bid Response Pack — 2026-07-29

Four live bids assessed against the portal itself, not against the sweep summary.
Verdicts first, then the exact blocker, then everything pre-filled so the actual
work is a 20-minute job once the blocker clears.

---

## 1. Verdicts

| # | Bid | Term | Closes | Verdict |
|---|---|---|---|---|
| 1 | **Richmond Hill RFRC-2610203 — IT Staffing Services** | **36 months** | Fri Aug 14, 2:00 PM | **BID. Highest-value item on the board.** |
| 2 | **York RFP-2555-25 — Microsoft Endpoint Management Retainer** | **60 months** | Wed Aug 12, 1:00 PM | **BID — conditional on Microsoft Partner status.** |
| 3 | Oakville RFP-20-2026 — Cloud Backup for M365 | 12 months | Fri Aug 7, 2:00 PM | **Marginal. Bid only if a distribution agreement exists.** |
| 4 | York RFP-3463-25 — ITSM Solution | — | Tue Aug 4, 1:00 PM | **NO-BID.** |

### Why #1 is the one that matters

`RFRC` is not an RFP. It stands for **Request for Roster Candidates** — Richmond Hill
is building a 36-month pre-qualified roster for "IT Professional Consulting Services on
an *as and when required* basis." There is no single winner. Everyone who qualifies gets
on the list, and work is drawn down against the roster for three years without another
competition.

This is the exact structural thing worth chasing: one qualification, then recurring
draw-down. It is easier to win than a single-award RFP, it lasts longer, and it is the
one you did *not* lead with in your message. Lead with it.

### Why #2 has a hard gate

York RFP-2555-25 is a 60-month on-call retainer for Configuration Manager, Intune,
Entra ID and AD work — structurally excellent. But the bid document carries an
auto-disqualifier, quoted from the posting:

> "CERTIFIED MICROSOFT PARTNER: Any proposals received from proponents who are not a
> Certified Microsoft Partner shall be rejected from further consideration."

If Integrated IT Support Inc. does not currently hold a Microsoft Partner ID, the
proposal is rejected unread. Base membership in the Microsoft AI Cloud Partner Program
is free to join and produces a Partner ID — but it takes verification time, and there
are 14 days on the clock. **Confirm the Partner ID before spending an hour on this bid.**
No Partner ID by Aug 5 means walk away and put the hour into #1.

### Why #3 is weaker than it looked in the sweep

You called Oakville "recurring-revenue shaped." It is not. Read the scope: the Town wants
a **Software-as-a-Service backup product** covering Exchange Online, SharePoint, OneDrive
and Teams. It is a 12-month software subscription procurement, and it will be bid directly
by AvePoint, Veeam, Dropsuite and Barracuda. A reseller wins this only with a distribution
agreement and price authority. If neither exists, it is an hour spent losing to a vendor
who can undercut you on their own product.

### Why #4 is a no-bid

RFP-3463-25 is an enterprise ITSM platform buy — ServiceNow, Ivanti, Freshservice class.
It closes in 6 days. A 1–10 person firm does not win a Regional ITSM platform
implementation, and 6 days is not enough runway to write a competitive one anyway.

---

## 2. The blocker — read this before anything else

Every one of these is **"Submission Type: Online Submissions Only."** Hard copy is
explicitly refused. There is exactly one path in, and it has two gates.

### Gate 1 — the vendor account

All three portals show **Create Account | Login** in the header. There is no logged-in
session. Clicking "Register for this Bid" on Richmond Hill redirects to:

```
/Module/Tenders/en/Login?tenderId=ef2d40c6-...
```

I cannot create accounts or enter passwords. That gate is yours, and it is one account,
not three — bids&tenders uses a single vendor identity across every agency in Canada.
You already have a half-finished one open on the Whitby tab.

### Gate 2 — paid access to submit

Quoted verbatim from the bids&tenders account-creation page:

> "A free account lets you browse opportunities and get bid alerts. When you're ready to
> register as a plan taker or ready to submit to a bid opportunity, you can pick a
> subscription plan for ongoing access or select Pay-Per-Bid for one-time access."

And from Oakville's own homepage:

> "The Town of Oakville does not charge any document, project or administrative fees to
> bidders. The annual subscription to bids&tenders is the only charge you will incur to
> place unlimited bids for town business."

There is a per-bid or per-year fee to submit. One caveat worth checking once logged in:
the platform notes *"If the agency covers access, no subscription is required."* Some
agencies pay on the vendor's behalf. Oakville clearly does not. York and Richmond Hill
are unknown until an account exists to check with.

**Direct call-out:** your standing rule is "nothing that costs money, has to be free."
That rule is correct for directories and listings, where paid placement is a leak. It is
the wrong rule here. A per-bid fee measured in tens of dollars, against a 36-month roster
and a 60-month retainer, is not a cost — it is the cheapest customer acquisition line in
the entire business. Applying the free-only rule to bid access is the single highest-cost
mistake available to you this week. Pay it.

---

## 3. Account form — exact values, copy straight across

For `https://oakville.bidsandtenders.ca/Module/Tenders/en/Vendor/Create/b0174368-d7b1-4767-ad1a-7fdb104e96ec`
(or finish the Whitby one already open — same account either way).

| Field | Value |
|---|---|
| Legal Company Name | `Integrated IT Support Inc.` |
| Operating/other name | *(leave blank)* |
| Address 1 | `30 Fothergill Court` |
| Address 2 | *(leave blank)* |
| City | `Whitby` |
| Postal Code | `L1P 1L4` |
| Province | `Ontario` |
| Country | `Canada` |
| Fax | *(leave blank)* |
| Website | `https://iisupp.net` |
| Tax Registration Number | *(your HST number — do not guess)* |
| Certified Diverse Supplier | `No` — unless certified by a recognized SCO. Do not claim it. |
| Emergency Vendor | `Yes` |
| First / Last name | `Ahmad` / `Wasee` |
| Email | `integrateditsupp@gmail.com` |
| Phone | `(647) 581-3182` |
| Primary Contact | checked |

**Legal name must match exactly.** York's instructions state that at bid closing they
verify document names against the account name, and a mismatch can disqualify the bid.
`Integrated IT Support Inc.` — with the period.

### Categories to select

Search these terms and tick everything under them:

```
information technology
computer
managed services
network
software
consulting - information technology
telecommunications
cyber security
data
help desk
staffing / temporary personnel   <- required for Richmond Hill RFRC-2610203
```

### Agency notifications

Tick, at minimum: **Richmond Hill, York Region, Oakville, Whitby, Durham Region, Ajax,
Pickering, Oshawa, Clarington, Markham, Vaughan, Burlington, Milton, Peel Region,
Brampton.** These are free notification subscriptions and cost nothing.

---

## 4. Standing bid-form answers

| Field | Answer |
|---|---|
| Business type | Corporation (Canada) |
| Country of operation | Canada |
| Year established | **CONFIRM — do not guess.** Goes on a legal procurement document. |
| Number of employees | 1–10 |
| Small business | Yes |
| Delivery model | Remote nationwide; onsite Greater Toronto Area |
| Languages | English |
| Currency | CAD |
| Insurance | Commercial General Liability; Errors & Omissions |
| Payment terms | Net 30 |
| Accepts government POs | Yes |
| Willing to subcontract to a prime | Yes |
| Bonding capacity | None currently — answer "not applicable" for service-only bids |
| NAICS | 541512 (primary); 541519, 541511, 811210 |
| UNSPSC | 81111800, 81111700, 81111500, 81112200 |
| Conflict of interest declaration | None |
| Litigation history | None |

---

## 5. Sequence — do these in this order

1. **Finish the bids&tenders vendor account.** ~10 minutes with the table above.
   Do it once; it works on all three portals.
2. **Confirm two facts and send them to me:** HST number, and year of incorporation.
   Both go on legal documents; neither will be guessed.
3. **Check Microsoft Partner status.** Do you hold a Microsoft Partner ID? If no,
   start the free AI Cloud Partner Program registration today — it is the gate on a
   60-month retainer and it will not clear itself.
4. **Register for RFRC-2610203 first**, and select Pay-Per-Bid if York/Richmond Hill do
   not cover access. That opens the secured documents and the submission form.
5. **Tell me you're logged in.** I take the browser from there, pull the mandatory forms
   from the 22-page RFRC and the 23-page Appendix D, fill every field, and stop with the
   cursor on Submit.

Nothing in step 5 needs you. Steps 1 through 4 are gated on account creation, credentials,
and a payment method — the three things I am not permitted to touch on your behalf.

---

## 6. Contacts

| Bid | Buyer contact |
|---|---|
| York RFP-2555-25 | Michelle Doiron — michelle.doiron@york.ca |
| York (general) | purchasing@york.ca |
| Richmond Hill RFRC-2610203 | Submit a Question button only (deadline Thu Aug 6, 4:00 PM) |
| Oakville RFP-20-2026 | Question deadline **already passed** (Mon Jul 27) — (905) 338-4197 |

Question deadlines that still matter: **York RFP-2555-25 — Wed Aug 5, 5:00 PM.**
**Richmond Hill RFRC-2610203 — Thu Aug 6, 4:00 PM.**
