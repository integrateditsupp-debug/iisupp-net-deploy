# ARIA Sentinel — Business tiers and the Integrated roadmap
### What you save vs. what you pay

> **Lead with the customer's savings, not the feature list.** Every figure below is an assumption the customer can change; none is a measurement of their environment until a pilot produces one.

---

## What ships today (0.2.1) vs. what is scoped per engagement

| | **Standalone (ships today)** | **Integrated (scoped per engagement — not shipped software)** |
|---|---|---|
| **What it does** | On-device AI IT support — finds and explains the top desktop tickets, applies the vetted fixes with the person's consent (UAC for admin steps), audited and content-blind. Business tiers add fleet view, compliance evidence pack, custom recipes, white-label, SLA tracking, quarterly PDFs. | Everything in Standalone **plus** directory integration delivered as an implementation project: **read-only** Microsoft Entra ID / AD lookups (users, lockout state, groups, devices) ship in the product today; **write actions** (verified self-service password reset, unlock, group changes) are built per engagement, never autonomous, always approval-gated, and are quoted below. ServiceNow incident routing ships today (customer's own instance). |
| **Who it's for** | Individuals, small teams, SMB fleets | Mid-market, enterprise, government |
| **Price** | Personal **$899/mo** · Pro **$2,250/mo** · Small Business **$19,500/mo** · Mid Size **$39,000/mo** · Enterprise **$78,125/mo** *(business tiers billed annually — $234K / $468K / $937.5K per year)* | The matching business tier **plus** the one-time implementation below |
| **Bundled human support** | Small Business **1** on-site visit/yr · Mid Size **2**/yr · Enterprise **4**/yr — plus remote jump-ins. Minimal by design. | Same bundle |

*Additional human on-site or remote support beyond the bundled visits is a **separate, quote-based contract** (human-delivered, not ARIA). No tier includes 24/7 human support.*

---

## One-time implementation (quoted, choose at purchase)

Pick the systems you want wired in. We scope your environment and quote **$10,000–$60,000 per connector** (a band that ends in a written quote — not a price a buyer can click).

Available to scope today: `Microsoft Entra ID (read-only lookups ship now; writes per engagement)` · `On-prem AD` · `ServiceNow (ships now)` · `Outlook / Exchange`

Roadmap connectors (not started; quote only after a discovery call): `RSA SecurID` · `PingOne Verify` · `Dynamics 365` · `Excel` · `Word` · `PowerPoint` · `OneNote`

---

## The ROI math (use your own numbers)

Editable assumptions: **10** helpdesk tickets / employee / year · **30%** are access/password · **$35** fully-loaded cost per ticket · verified self-service deflects **70%**. These are industry-typical planning figures, not measurements of your helpdesk — replace them with yours.

**Access/password savings ≈ seats × $73.5 / year** (10 × 30% × $35 × 70%):

| Seats | Access savings / yr (this flow alone) |
|---|---|
| 1,000 | **~$74,000** |
| 5,000 | **~$368,000** |
| 25,000 | **~$1.84M** |

Add the rest of L1 automation (slow PC, Outlook, printer, VPN, OneDrive…) and total savings are typically modelled at **2–3× the access-only figure**. On access alone, an Integrated engagement pays for itself at roughly **1,500–3,000 seats**; sooner once full L1 deflection, avoided downtime and reduced breach risk are counted. The access flow requires the write-action implementation above.

**Read:** the business tiers are built for organizations where the savings dwarf the license. For smaller orgs, **ARIA Web ($70/mo)**, **Personal** and **Pro** are the on-ramp that grows into a business tier.

---

## Why it commands the price

- **Replaces wait time and vendors:** the common desktop tickets are found and explained the moment they happen, and the vetted fixes are applied on the spot with consent — with a few human visits when hands-on is truly needed.
- **Identity-safe by design (Integrated):** never autonomous on a directory write; the target must be certain or ARIA stops and asks; end-user identity is verified through the business's own trusted verifier, never by ARIA handling ID photos or biometrics; every action is logged in the tamper-evident audit chain.
- **Honest by design:** an unsigned build reports its compliance control as not met; a fix Windows refused is reported as failed; nothing is counted as resolved that was not verified.

---

## Say this before the customer finds it

- 0.2.1 is an **unsigned** Windows build (SmartScreen warning on first run); signing is in progress.
- Directory **writes** are an implementation deliverable, not a shipped feature; **reads** ship now.
- No SMS channel; no unattended administrator fixes; macOS not yet verified on hardware.
