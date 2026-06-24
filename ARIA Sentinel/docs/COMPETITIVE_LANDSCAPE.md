# ARIA Sentinel — Competitive Landscape (honest read)

> Built 2026-06-19 by Cowork. Sources: well-documented vendor positioning + Reddit/G2/Capterra MSP threads through May 2025. Pricing snapshots — vendors change tiers, verify before quoting.

## Two markets ARIA Sentinel touches

1. **MSP-tooling (RMM/PSA)** — what IIS uses to deliver service. Competitors charge IT teams per-endpoint or per-tech.
2. **End-user AI service desk** — what the user interacts with. Competitors charge per-employee, focus on ticket deflection.

ARIA Sentinel sits on the seam: it's a **resident endpoint agent** that does both (auto-fix like RMM + employee-facing like AI service desk), with a privacy-first wrapper.

---

## §1 · MSP RMM/PSA competitors (the tools IIS-style firms compete with)

| Vendor | Pricing (approx, 2025) | What they're good at | Where they hurt |
|---|---|---|---|
| **NinjaOne** | $3-6/endpoint/mo | Best modern UI · fast support · M&A-fueled feature breadth | Cloud-only, telemetry exits customer · expensive at scale · no real "auto-fix without human in loop" |
| **Atera** | $129-249/tech/mo (UNLIMITED endpoints) | Per-tech pricing scales linearly · AI helpdesk Copilot launched 2024 · simple onboarding | Tech-cap pricing punishes small techs supporting many endpoints · Israeli backend (sovereignty concerns in CA/EU procurement) |
| **ConnectWise Automate** | $4-10/endpoint/mo + $50-100/tech/mo PSA | Enterprise-grade · widest integrations · scripting depth | Heavyweight setup (weeks to months) · UX dated · breached in 2021/2022 · MSPs leaving for SuperOps/NinjaOne |
| **Kaseya VSA / VSA X** | $4-12/endpoint/mo | Long-established · 365 platform bundling (BMS, DattoRMM acquired) | Reputation hit from 2021 REvil supply-chain breach · push-and-pray sales model |
| **SuperOps** | $79-129/tech/mo | AI-first product · cleanest modern UX · unified RMM+PSA · fast iteration | Younger product · smaller integration catalog · still hardening enterprise reporting |
| **Action1** | FREE up to 200 endpoints, $2/endpoint after | Genuinely free tier · best-in-class patch management | Patch-only (no full RMM scope) · ad-supported feel in free tier · no PSA |
| **Pulseway** | $1.75-3/endpoint/mo | Mobile-first remote management · cheap | Limited automation depth · positioning blurred after Kaseya acquisition |
| **Syncro** | $129/tech/mo (UNLIMITED endpoints) | All-in-one RMM+PSA+invoicing for SMB MSPs · transparent pricing | Smaller scale · less polished than NinjaOne/SuperOps · sales reps push hard |
| **N-able N-central / N-sight** | $3-8/endpoint/mo | MSP-pedigree · strong policy engine | Spin-off chaos post-SolarWinds · UX painful · slow shipping |
| **Datto RMM** (Kaseya) | $4-7/endpoint/mo | Strong backup integration · Autotask PSA pairing | Post-Kaseya acquisition product stagnation · churn observed |

### MSP-RMM patterns Ahmad's customers expect

- **Per-endpoint or per-tech pricing transparency** (no "contact sales")
- **Patch management** (Windows + 3rd party — Adobe, Chrome, etc.)
- **Remote control** (TeamViewer/Splashtop/ScreenConnect built-in)
- **Monitoring + alerts** (CPU/RAM/disk/services down)
- **Auto-remediation scripts** (the bread-and-butter)
- **Reports** (uptime, tickets, SLA, monthly customer-facing PDF)
- **PSA integration** (ticketing, invoicing, time-tracking)
- **Multi-tenant dashboard** (single pane across all customers)
- **Mobile app** for techs on-call
- **Customer-facing portal** (white-label)
- **Onboarding via deploy script + GPO + group policy / Intune**

---

## §2 · End-user AI service desk competitors (the experience the employee sees)

| Vendor | Pricing | What they're good at | Where they hurt |
|---|---|---|---|
| **ServiceNow Now Assist** | $50-150/user/mo (E or premium SKU) | Embedded in dominant ITSM · Now Assist AI agent (2024) | Already-have-ServiceNow tax · $$$ even before AI · slow innovation cycle |
| **Microsoft Copilot for IT** | $30/user/mo on top of M365 E5 | Bundled into Microsoft estate · familiar | Generic IT bot · no auto-fix · no privacy story (data → MS) |
| **Freshservice** | $19-99/agent/mo + AI add-ons | Cheaper ITSM with Freddy AI · friendly UX | Per-agent pricing punishes scale · AI is summarization, not auto-fix |
| **Jira Service Management** | $20-50/agent/mo | Tight dev-team integration · low entry price | Engineering-team-shaped, not friendly to non-dev employees · AI is shallow |
| **Moveworks** | $30-100K/yr enterprise contracts | First-mover in conversational AI for IT · deep Slack/Teams integration | Cloud-only · enterprise-only entry · talent-heavy implementations · data exits customer |
| **Aisera** | $50K-500K/yr enterprise | Multi-domain AI agent · OpenAI partnership | Same enterprise-only · still ticket-deflection mindset (not endpoint-resident) |
| **Espressive Barista** | $50K+/yr enterprise | Conversational AI · 80+ languages | Cloud-only · no endpoint auto-fix · pure deflection |

### End-user AI service-desk patterns

- **Conversational interface** (Teams/Slack/web chat)
- **Ticket deflection** (the metric vendors sell against)
- **Knowledge-base lookup** (RAG over your wiki/Confluence)
- **Multi-language**
- **Escalation to human** when bot loses confidence
- **Analytics dashboard** (deflection rate, satisfaction, top topics)
- **Pre-built integrations** (Okta, AD, ServiceNow, Jira, Slack, Teams)

---

## §3 · Lifecycle — what made the leaders succeed

| Vendor | The wedge | The scale move | The current motion |
|---|---|---|---|
| **NinjaOne** | Modern UI in a sea of ugly RMMs (2014) | Annual feature waves + acquisitions (RMM → patching → docs → backup) | Hitting MSP saturation, moving upmarket to internal IT |
| **Atera** | Per-tech (not per-endpoint) pricing in 2017 — broke the model | AI Copilot 2024 timed perfectly with ChatGPT mania | Pushing "AI-powered IT" as differentiator |
| **SuperOps** | AI-first PSA+RMM in 2020 | YC + Sequoia backing · Indian engineering at scale | Eating ConnectWise/Kaseya churn |
| **Moveworks** | Pure-play AI IT bot in 2016 (pre-ChatGPT) | $315M raise · Fortune 500 logos · acquired by ServiceNow 2024 ($2.85B) | (Now ServiceNow's AI front-end) |
| **Action1** | Genuinely free patch management 2018 | Free tier became massive lead funnel | Now monetizing past 200 endpoints |

### Patterns across winners

1. **Wedge with one painfully better thing** (UI · pricing model · AI · free tier).
2. **Don't sell to MSPs first if you're tiny** — pivot SMB direct or internal-IT. MSPs are vicious negotiators with thin margins.
3. **Ship in public.** Monthly release notes. Customer-visible roadmap (NinjaOne, SuperOps).
4. **Trust signals early.** SOC 2 Type II by year 2-3. ISO 27001 by year 4.
5. **Avoid the "platform" trap.** Don't sprawl until product-market fit on one wedge is rock-solid.

---

## §4 · ARIA Sentinel's honest position

### Where ARIA Sentinel OUT-DOES the field

| Capability | ARIA | Best competitor | Why ARIA wins |
|---|---|---|---|
| **Local-first / on-device fixes** | ✓ resident agent | All others cloud-call to fix | No data exits customer network → ARIA passes privacy/GDPR/PIPEDA reviews other RMMs fail |
| **Content-blind sanitization** | ✓ provable | None | Privacy verifier shipped (RUN 3) — competitors can't show this |
| **Evidence pack export (ZIP)** | ✓ one-click | None | RFP/audit gold — competitors require manual log gather |
| **Auto-fix without human-in-loop (with gate-enforced confirm for risky ones)** | ✓ 8 green + 4 yellow recipes | RMMs require tech to click | Saves the most expensive cost (tech time) |
| **No new dependencies / signed bundles / SBOM-LITE** | ✓ enterprise-supply-chain ready | Most use 100+ npm deps | Supply-chain breach risk dramatically lower (Kaseya 2021 lesson) |
| **Single product across endpoint + browser** | ✓ desktop + Chrome ext + soon Edge/Safari | Most need 2-3 separate agents | Lower deploy friction |
| **Open-architecture sanitizer that 3rd-party auditors can inspect** | ✓ pure JS modules | All proprietary | Customer security teams can verify, not just trust |

### Where ARIA Sentinel UNDER-PERFORMS (must close)

| Gap | Best competitor | Severity | Closed by |
|---|---|---|---|
| Patch management (Windows + 3rd party) | NinjaOne, Action1, ManageEngine | **HIGH** — table stakes for MSP/IT | NOT in RUN 1-10 — needs RUN 11 (or earlier) |
| Remote control (live desktop takeover) | All RMMs have it via ScreenConnect/Splashtop | **HIGH** — table stakes | NOT in plan — Whereby exists for video, not control |
| Multi-tenant dashboard (MSP single pane of glass) | NinjaOne, Atera, SuperOps | **MEDIUM** — needed for IIS to sell to other MSPs | Partial in admin console; **RUN 9 extension** in SaaS gap pack |
| PSA (ticketing/billing/time tracking) | Atera, Syncro, ConnectWise | **LOW for IIS** (we use external) **HIGH for resale** | Defer — wrap ServiceNow instead |
| Mobile app | Pulseway, NinjaOne | **MEDIUM** — IT on-call expects it | v1.5 deferral OK; web responsive in v1.0 |
| Public-cloud SaaS option (no install) | All cloud RMMs | **MEDIUM** — some buyers won't install agents | Local-first IS the wedge — don't compromise |
| Customer-visible status page | NinjaOne, Stripe (vendor pattern) | **LOW** — already in RUN 8 SaaS gap pack | RUN 8 |
| SOC 2 Type II certification | All enterprise vendors | **HIGH for $625K tier** | Out of v1.0 scope (Rule 1 — no pre-buying compliance) — readiness page is the bridge |
| Marketplace / templates / community recipes | NinjaOne (script library), Atera (AI shared) | **LOW for now**, **HIGH at scale** | v1.5 |
| Established integration breadth | ConnectWise (100s), NinjaOne (50+) | **MEDIUM** — Sentinel has ServiceNow only | RUN 10 API + RUN 14+ integrations |

---

## §5 · Pricing — honest cost-per-value comparison

### Standard ranges

- **NinjaOne**: $4/endpoint/mo → 100 endpoints = $400/mo, 1000 endpoints = $4,000/mo
- **Atera**: $149/tech/mo (1 tech = unlimited endpoints) → 1 tech 1000 endpoints = $149/mo (best-in-class price)
- **ConnectWise**: $5-8/endpoint/mo + $80/tech PSA → 100 endpoints + 2 techs = $660/mo
- **SuperOps**: $99/tech/mo → 1 tech unlimited endpoints = $99/mo
- **Action1**: $0 for first 200 endpoints, $2/endpoint after → 1000 endpoints = $1,600/mo

### ARIA Sentinel pricing

| Tier | Monthly | Yearly | Implied endpoints | Implied $/endpoint/mo |
|---|---|---|---|---|
| Personal | $599 | $5,990 | 1-5 (solo / freelancer) | $120-599 |
| Pro | $1,500 | $15,000 | 5-25 (small dev shop) | $60-300 |
| Small Business | $13,000 (=$156K/yr) | $156,000 | 50-150 | $87-260 |
| Mid Size | $26,000 (=$312K/yr) | $312,000 | 500-1,000 | $26-52 |
| Enterprise | $52,000 (=$625K/yr) | $625,000 | 2,500-5,000 | $10-21 |

### Honest read

- **At Enterprise tier**: $10-21/endpoint/mo is **2-5× NinjaOne** but with auto-fix included. If ARIA replaces one $80K/yr L1 tech, it pays for ~5,000 endpoints. Defensible.
- **At Mid-Size tier**: $26-52/endpoint/mo is **6-13× NinjaOne**. Only defensible if (a) we're managed-service-included (white-glove), (b) the auto-fix demonstrably reduces helpdesk volume by >50%, or (c) the privacy story is the entire reason they chose us.
- **At SMB tier**: $87-260/endpoint/mo is **20-65× NinjaOne**. Only defensible as a **fully managed IT department** (Ahmad + ARIA replaces hiring 2-3 IT FTEs). The pricing card has to make this crystal clear — it's not "RMM software", it's "your IT department".
- **At Personal/Pro**: $599-$1,500/mo for a freelancer/dev-shop is essentially impossible to justify as RMM. These tiers only work if positioned as "ARIA = your personal IT department + privacy moat" (Hormozi-style value bundling).

### The recommended positioning fix (no code, just messaging — already aligns with R7 + R9)

- **SMB tier and below** → reframe as "Fully Managed IT" not "RMM software"
- **Mid-Size and Enterprise** → keep as-is; explicitly cite auto-fix savings + privacy moat in pricing card
- **All tiers** → add ROI calculator (already in RUN 9 SaaS gap pack) that lets buyer see "X auto-fixes/mo × $75/hr saved = $Y" vs subscription cost

---

## §6 · What ARIA Sentinel must ship to compete (gap-closure roadmap)

Items already on the path (RUNs 4-10 + SaaS gap pack):
- macOS, Edge, Safari, autonomous opt-in, recipes 25→75, evidence pack, weekly digest, status page, multi-tenant dashboard, API, ROI calculator, command palette, Slack notify

Items to ADD as NEW RUN 11 (replacing original "wallet items" which become RUN 12+):

```
### RUN 11 · MSP/RMM table stakes (~4hr)

Goal: close the patch + remote-control + multi-tenant gaps that block "RMM replacement" positioning. Without these, Sentinel cannot win against NinjaOne/Atera in a head-to-head bake-off.

Build:
1. Patch management v1
   - Detect missing Windows updates via wuauclt + scan
   - Detect missing Chrome, Edge, Firefox, Adobe Reader, Java, Zoom updates via version-check API (vendor official endpoints, allowlist-pinned)
   - Recipe: PATCH.AVAILABLE → confirm in Manual/Confirmed; auto in Autonomous with gate
   - Restore-point before patch install (already plumbed)
2. Remote control via existing Whereby integration
   - Tray menu → "Allow remote control" → opens Whereby room
   - Customer ends session via tray icon
   - No screen-recording, no keystroke capture (privacy stays intact)
3. Multi-tenant dashboard upgrade at iisupp.net/sentinel-admin
   - One row per customer with: name (handle, per R11 privacy), endpoint count, health score avg, fixes this week, last seen
   - Click → drill into customer's endpoint list
   - Already-shipped admin console becomes per-tenant view
4. Mobile-responsive admin (no native app — PWA-style)
   - Existing admin HTML gets responsive breakpoints
   - "Add to Home Screen" works on iOS/Android

Tests:
- tests/patch-management.test.mjs — mock vendor version endpoints, assert allowlist enforcement + 0 user content leak
- tests/multi-tenant.test.mjs — fleet aggregation math + per-tenant filter

Acceptance:
- npm test = 24/24 green (was 22)
- Patch management ships 6 of the most-impactful patches (Chrome, Edge, Firefox, Adobe, Zoom, Java)
- Multi-tenant dashboard responsive on phone
- Whereby tray integration works end-to-end

Locked rules:
- Zero new deps (Whereby is already a wired dep · vendor version APIs are HTTP GET only)
- No data exits customer network EXCEPT vendor version queries (already in allowlist via RUN 3 verifier)
- All patches reversible via existing restore-point system
- Write docs/RUN_11_REPORT.md · update ENTERPRISE_READINESS.md

Ship it.
```

### Resulting roadmap (renumbered)

- RUN 4: macOS port + telemetry-event foundation
- RUN 5: Edge + Safari + Chrome polish + embed badge + Calendly link
- RUN 6: Autonomous + Slack/Teams notify + weekly digest
- RUN 7: Recipes 25→50
- RUN 8: Recipes 50→75 + status page + audit CSV/PDF
- RUN 9: v1.0 polish + command palette + ROI calc + multi-tenant pane
- RUN 10: Trial license + distribution + API/webhooks + Stripe portal link
- **RUN 11 (NEW): MSP table stakes — patch + remote-control + multi-tenant + responsive**
- RUN 12+: Ahmad's wallet items (Authenticode EV, Apple Developer ID, Chrome Web Store, Microsoft Partner Center, ServiceNow OAuth, Legal DPA/EULA/SLA, External pen test)

---

## §7 · Bottom line

**ARIA Sentinel is NOT positioned to win on RMM-feature-checkbox parity.** Even with the new RUN 11, NinjaOne and SuperOps have years of head-start on patch/PSA/integration depth.

**ARIA Sentinel WINS on:** local-first privacy · auto-fix value-per-dollar at enterprise tier · evidence pack/audit posture · sub-prime compliance fit for Canadian gov + EU/UK · single-agent simplicity vs sprawl.

**The honest pitch:** *"NinjaOne if you trust the cloud. ARIA Sentinel if you don't — and want the fixes to happen on-device, with proof you can hand to a regulator."*

**Pricing recommendation:** keep the published tiers, but reposition SMB-and-below as "managed IT" not "RMM"; cite the cost of one IT FTE in the pricing card so the buyer math is obvious.
