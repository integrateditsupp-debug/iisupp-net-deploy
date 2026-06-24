# ARIA Sentinel — End User License Agreement (EULA)

> **TEMPLATE — NOT LEGAL ADVICE.** This End User License Agreement is a drafting
> template prepared for Integrated IT Support Inc. It has **not** been reviewed by
> licensed counsel and must be reviewed, adapted to the applicable jurisdictions
> and distribution channels, and approved by a qualified lawyer **before it is
> used, displayed, or relied upon** in any commercial release. Bracketed items
> marked `[ ]` require completion. Do not present this document to end users in
> its current form.

**Product:** ARIA Sentinel ("Software")
**Licensor:** Integrated IT Support Inc. ("IIS", "we", "us", "our"), an Ontario,
Canada corporation — ahmad.wasee@iisupp.net — 647-581-3182
**Effective date:** `[ date ]`
**Version:** `[ EULA version ]` — applicable to Software version 0.1.0 and later
unless superseded.

---

## 1. Acceptance of Terms

By downloading, installing, copying, or using the Software, you ("you", "Licensee",
or "End User") agree to be bound by this Agreement. If you are accepting on behalf
of an organization, you represent that you have authority to bind that
organization. If you do not agree, do not install or use the Software.

If your organization has signed a separate written master agreement or Data
Processing Agreement with IIS, that agreement governs to the extent of any
conflict with this EULA.

## 2. License Grant

Subject to your continuing compliance with this Agreement and payment of any
applicable fees, IIS grants you a **limited, non-exclusive, non-transferable,
non-sublicensable, revocable** license to install and use the Software in object
(executable) form solely for your internal IT-support and device-maintenance
purposes, on the number of devices and for the term permitted by your
subscription, order, or applicable plan.

## 3. Restrictions

You shall not, and shall not permit any third party to:

1. **reverse engineer, decompile, or disassemble** the Software, or attempt to
   derive its source code, **except** and only to the extent that such activity
   cannot be prohibited under applicable law (for example, mandatory
   interoperability rights), and then only after giving IIS prior written notice
   and a reasonable opportunity to provide the necessary information;
2. copy, **redistribute**, resell, rent, lease, lend, host as a service, or
   otherwise make the Software available to any third party;
3. modify, translate, or create derivative works of the Software, or remove,
   obscure, or alter any proprietary notices, labels, or marks;
4. circumvent or disable any security, licensing, safety (including the
   dry-run/command-safety boundaries), or usage-control mechanisms;
5. use the Software to develop a competing product, or for any unlawful,
   infringing, or abusive purpose, or in violation of applicable export-control,
   sanctions, or privacy laws.

The Software includes safety boundaries (dry-run-by-default execution, an
allow-listed recipe model, and blocking of destructive command families). You
acknowledge these are protective measures and agree not to defeat them.

## 4. Intellectual Property; Ownership

The Software is **licensed, not sold.** IIS and its licensors retain all right,
title, and interest in and to the Software, including all copyrights, patents,
trade secrets, trademarks (including "ARIA Sentinel"), and all other intellectual
property rights. No rights are granted except as expressly stated in this
Agreement. All rights not expressly granted are reserved by IIS.

The Software incorporates third-party open-source components licensed under
permissive licenses (e.g., MIT, ISC, Apache-2.0, BSD). Those components are
governed by their respective licenses, and applicable notices are provided in the
accompanying THIRD-PARTY-NOTICES materials. Nothing in this Agreement limits your
rights under those open-source licenses.

## 5. Privacy and Data; Content-Blind, Local-First Design

The Software is engineered to be **content-blind and local-first**:

- Device signals are processed **on your device**. The Software reads from
  **pull-only** IIS knowledge endpoints and does not transmit your file contents,
  documents, screenshots, credentials, cookies, form fields, or local-storage
  values to IIS.
- The companion browser extension transmits/stores only **opaque symbolic signal
  identifiers** (e.g., `BROWSER.CACHE.STALE`) and a non-identifying origin
  **category** — not page contents or personal data.
- **No personal data is collected by default.** Any diagnostic or recipe-outcome
  telemetry is **opt-in** and limited to non-content fields (e.g., recipe
  identifier, outcome, timestamp).

Your use of the Software is also subject to the IIS Privacy Policy at `[ privacy
policy URL ]`. Where the Software is used to process personal data on behalf of an
organization, the parties' Data Processing Agreement (see `docs/DPA_TEMPLATE.md`)
governs that processing. You are responsible for your own configurations,
recipes, and any optional integrations (for example, a customer-configured
ticketing endpoint) that you enable.

## 6. Updates

The Software may check for and install updates (via the integrated update
mechanism) to deliver fixes and improvements. Updates are subject to this
Agreement unless accompanied by separate terms. You may be able to control
update behaviour through Software settings or your organization's policy.

## 7. Fees

If your use is subject to a subscription or order, you agree to pay the applicable
fees. Except as required by law or expressly stated in an order, fees are
non-refundable.

## 8. Disclaimer of Warranties

> THE SOFTWARE IS PROVIDED **"AS IS"** AND **"AS AVAILABLE"**, WITH ALL FAULTS AND
> WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW,
> IIS AND ITS LICENSORS **DISCLAIM ALL WARRANTIES**, WHETHER EXPRESS, IMPLIED,
> STATUTORY, OR OTHERWISE, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, ACCURACY, AND
> NON-INFRINGEMENT. IIS DOES NOT WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED,
> ERROR-FREE, OR SECURE, OR THAT IT WILL CORRECT ANY DEVICE ISSUE.

You are responsible for maintaining appropriate backups and for reviewing
automated actions. Some jurisdictions do not allow the exclusion of certain
warranties, so portions of this section may not apply to you.

## 9. Limitation of Liability

> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL IIS OR ITS
> LICENSORS BE LIABLE FOR ANY **INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
> EXEMPLARY, OR PUNITIVE DAMAGES**, OR FOR ANY **LOSS OF PROFITS, REVENUE, DATA,
> GOODWILL, OR BUSINESS INTERRUPTION**, ARISING OUT OF OR RELATED TO THE SOFTWARE
> OR THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
>
> IIS'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THE SOFTWARE AND
> THIS AGREEMENT WILL NOT EXCEED THE **GREATER OF (a) THE TOTAL FEES YOU ACTUALLY
> PAID TO IIS FOR THE SOFTWARE DURING THE TWELVE (12) MONTHS IMMEDIATELY
> PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (b) ONE HUNDRED CANADIAN
> DOLLARS (CAD $100)** WHERE NO FEES WERE PAID.

These limitations apply regardless of the theory of liability and form an
essential basis of the bargain. Nothing in this Agreement excludes or limits
liability that cannot be excluded or limited under applicable law (such as for
fraud, or death or personal injury caused by negligence). Some jurisdictions do
not allow certain limitations, so portions of this section may not apply to you.

## 10. Indemnification

You agree to defend, indemnify, and hold harmless IIS and its officers,
directors, employees, and agents from and against any third-party claims, losses,
liabilities, damages, costs, and expenses (including reasonable legal fees)
arising out of or related to: (a) your use of the Software in violation of this
Agreement or applicable law; (b) your configurations, recipes, data, or
integrations; or (c) your infringement or misappropriation of any third party's
rights.

## 11. Term and Termination

This Agreement is effective until terminated. It terminates automatically if you
breach any of its terms. IIS may suspend or terminate your license upon notice if
you violate this Agreement or fail to pay applicable fees. Upon termination, you
must cease all use of the Software and delete or destroy all copies in your
possession or control. Sections 3, 4, 8, 9, 10, 12, and 13 survive termination.

## 12. Governing Law and Venue

This Agreement is governed by and construed in accordance with the laws of the
**Province of Ontario** and the federal laws of **Canada** applicable therein,
without regard to its conflict-of-laws rules. The parties submit to the exclusive
jurisdiction of the courts located in Ontario, Canada, except that IIS may seek
injunctive relief in any court of competent jurisdiction. The United Nations
Convention on Contracts for the International Sale of Goods does not apply.

## 13. General

- **Entire Agreement.** This Agreement (together with any applicable order,
  Privacy Policy, and DPA) is the entire agreement between the parties regarding
  the Software and supersedes prior understandings on its subject matter.
- **Severability.** If any provision is held unenforceable, the remaining
  provisions remain in effect.
- **No Waiver.** Failure to enforce a provision is not a waiver.
- **Assignment.** You may not assign this Agreement without IIS's prior written
  consent; IIS may assign it in connection with a merger, acquisition, or sale of
  assets.
- **Notices.** Legal notices to IIS: ahmad.wasee@iisupp.net.
- **Compliance.** You agree to comply with applicable export-control and
  sanctions laws.

---

*© Integrated IT Support Inc. All rights reserved. "ARIA Sentinel" is a trademark
of Integrated IT Support Inc. (clearance pending — see `docs/LEGAL_INVENTORY.md`).
Template pending counsel review.*
