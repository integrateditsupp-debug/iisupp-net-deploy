# QUOTED FIGURES — the register of money a client can read that the plan page does not carry

> **What this file is for.** `plans/index.html` is the only place this company publishes a price a
> client can check. Every other money figure in a document a client, a prospect, or a client's own
> security reviewer reads has to be accounted for HERE, with a reason a person wrote and can argue
> with. A figure that is neither published nor listed below is **silent** — quoted to somebody and
> consciously accounted for by nobody — and `tests/quoted-figures.test.mjs` goes red on it.
>
> **This file is a register, not a permission slip.** Listing a figure does not make it correct. It
> makes it *deliberate*. Two of the entries below are open questions Ahmad still has to answer
> (`NEEDS-AHMAD.md`), and they say so.
>
> **Nothing was deleted to build this list** (Rule 15). Reconciliation is additive: documents were
> read, not edited.
>
> Format: `| figure | where it is quoted | why it is quoted outside the published plan table |`

## Implementation and integration fees — client-signable contracts

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$5,000` | legal/MSA-template.md:203 | One-time ServiceNow ITSM implementation fee in the MSA integration table. It is a professional-services charge, not a plan price, so it has no row in the plan table. **OPEN — NEEDS-AHMAD item 3:** publish an implementation-fee table or stop quoting it in a signable contract. |
| `$3,000` | legal/MSA-template.md:204-205 | One-time Jira Service Management and Zendesk implementation fees, same integration table, same class. **OPEN — NEEDS-AHMAD item 3.** |

## Contract-size thresholds — conditions, not prices

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$625K` | legal/DPA-template.md:219 · compliance/CAIQ-Lite-prefilled.md:25 · compliance/SIG-Lite-prefilled.md:20,104,124,190 · compliance/SOC2-controls-self-assessment.md:8,138,167 · ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md:53 | The annual contract value at which this company commits to starting a SOC 2 Type II audit and to binding cyber liability cover. It is a threshold the company is held to, not an amount anybody is charged. It is deliberately consistent across all ten places so a reviewer comparing two documents finds the same number. |
| `$1M` | compliance/SIG-Lite-prefilled.md:131 | The US federal opportunity tier at which FedRAMP authorisation would be pursued. A qualifying threshold in a security questionnaire answer, not a price. |
| `$5M` | compliance/SIG-Lite-prefilled.md:20 · compliance/SOC2-controls-self-assessment.md:103 · compliance/policies/business-continuity.md:21 | Target cyber liability cover limit, stated as a target and labelled "in procurement". A limit we would carry, not an amount we charge. |

## Our own costs, stated to a reviewer

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$3` | compliance/SOC2-controls-self-assessment.md:136 | The low end of "~$3-5K/yr", our estimated cyber liability insurance premium, in the internal-cost column of a control self-assessment a reviewer reads. Our cost, not a client's. |
| `$15` | compliance/SOC2-controls-self-assessment.md:138,157 · ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:4 | The low end of "$15-40K", the estimated cost of a SOC 2 Type II audit engagement, and separately a per-seat figure in the ROI sheet. Both are costs, not plan prices. |
| `$5` | compliance/policies/business-continuity.md:66 | The DigitalOcean charge to extend snapshot retention to 90 days. A named supplier cost disclosed in a continuity policy. |

## Comparison figures — what a buyer is comparing us against

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$60K` `$95K` | ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md:13 | The salary band for an in-house IT hire, offered as the alternative a buyer is weighing. Somebody else's cost. It is a market range and it is labelled as one. |
| `$150` `$300` | ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md:61 | The range for a single emergency IT call-out from another provider. A competitor comparison, not our price. |
| `$3K` `$5K` | ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md:62 | The monthly range for a part-time IT contractor. Same class. |

## Scoped work quoted on assessment

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$10,000` `$60,000` | ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:25 | The stated range for a per-connector integration, explicitly quoted after scoping the client's environment. A range for bespoke work cannot sit in a fixed plan table without becoming a promise the scope has not earned. |

## Annualised statements of published monthly prices

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$234K` `$468K` `$937.5K` | ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:15 | Small Business, Mid-Size and Enterprise annualised: $19,500, $39,000 and $78,125 per month × 12, on the same line as the monthly figures and labelled "billed annually". Arithmetic on published prices, shown because those tiers bill annually. |

## ROI model outputs — arithmetic from stated assumptions

| figure | where | why it is quoted outside the published plan table |
|---|---|---|
| `$35` | ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:33 | The fully-loaded cost-per-ticket assumption, printed on the page as an editable assumption rather than a claim. The reader can change it. |
| `$73.5` | ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:35 | Per-seat annual saving, derived on the page from the assumptions above it (10 tickets × 30% access/password × $35 × 70% deflection). Output of a model whose inputs are shown, not an independent claim. |
| `$74,000` `$368,000` `$1.84M` | ARIA Sentinel/sales/ARIA-Sentinel-Integrated-Pricing-ROI.md:39-41 | The same per-seat figure multiplied by 1,000 / 5,000 / 25,000 seats, in a table headed "this flow alone". Arithmetic on a stated assumption for a hypothetical fleet — never presented as a measured customer result, and not attributed to any customer. |

## A second price list — NOT declared, and deliberately not

The ARIA Sentinel sales one-pager carries its own price table quoting **Personal $599/mo, Pro
$1,500/mo, Small Business $156K/yr, Mid-Size $312K/yr, Enterprise $625K/yr**. Every one of those
contradicts the published plan page ($899, $2,250, $19,500/mo, $39,000/mo, $78,125/mo).

These figures are **deliberately absent from the register above.** They are not figures quoted
outside the published table for a good reason — they are a *second, different price for the same
named plan*, in a document a prospect is handed. Declaring them here would be using this register to
launder a contradiction, which is the exact failure it exists to prevent.

`reconcileQuotedFigures()` reports them separately as `contradictions`, with both citations. They are
either the Sentinel desktop product's own price list (in which case the plan names must stop
colliding with the web plans) or they are stale. **Software may not pick.** See `NEEDS-AHMAD.md`.
