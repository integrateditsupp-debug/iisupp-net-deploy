# Public Claim Fix Alternates — Findings 7-12 (Cross-page extension)

**Companion to:** `aria-claim-fix-alternates-2026-06-16.md` (which covered Findings 1–6 on aria.html).
**Source findings:** `public-claim-conflicts-cross-page-extension-2026-06-16.md` (Findings 7–12 on index.html, m.html, commercial-real-estate.html).
**Constraint per Ahmad 2026-06-16:** keep IIS reputable, don't oversell, don't damage brand by underselling either.
**Owner:** Cowork drafts. Ahmad picks one per finding. Codex applies all 16 finalized changes in ONE copy-only PR.
**Visual-stability rule respected:** only text strings change. No design, layout, color, font, or position change.

**Honesty bar:** every alt must be a thing IIS can actually back up under federal evaluator scrutiny.
**Reputation bar:** every alt must still sound senior-led, AI-capable, and worth hiring.

---

## Finding 7 — `index.html:2854` + `m.html:955` — "we replace expensive IT departments with one AI senior tech, available 24/7"

**Current (index.html):**
```
See ARIA in action — an 80-second sales pitch showing how we replace expensive IT
departments with one AI senior tech, available 24/7. Built for businesses tired
of paying $7,000+/month for in-house IT.
```

**Current (m.html):**
```
See ARIA in action — an 80-second pitch showing how we replace expensive IT
departments with one AI senior tech, available 24/7.
```

### Alt 7A (recommended — keeps sales energy, drops autonomy + staffing claims)
```
See ARIA in action — an 80-second walkthrough of how an AI assistant cuts L1/L2
ticket friction and gives your IT team more time for higher-value work.
```
*Why:* "Cuts friction" is honestly measurable. "Gives time back" is the customer outcome. No replacement claim, no 24/7 staffing claim, no "$7K/mo" benchmark that would require Ahmad to substantiate.

### Alt 7B (clearer about augment-not-replace + budget framing intact)
```
See ARIA in action — an 80-second walkthrough of how a permission-based AI
assistant augments your IT operations, reduces day-to-day support load, and
costs a fraction of expanding the in-house team.
```
*Why:* "Augments" + "permission-based" align directly with the federal one-pager language. Budget framing preserved without naming a specific dollar threshold.

### Alt 7C (boldest, strongest brand voice — federal-safe and operator-credible)
```
See ARIA in action — an 80-second walkthrough showing how AI changes the
economics of L1/L2 support without firing anyone or staffing 24/7.
```
*Why:* Direct, confident, anti-marketing — the kind of line operators trust. Says the quiet part: federal evaluators are skeptical of AI-replaces-humans pitches, and this line preempts that skepticism.

**Apply same chosen variant to both files** — index.html line 2854 + m.html line 955. M.html version omits the budget benchmark sentence (already does), so the trailing clause adapts naturally.

---

## Finding 8 — `index.html:2731` + `m.html:936` — "Instant retrieval replaces the L1 ticket queue"

**Current:**
```
No delays. Fewer late payments, missed trades, dropped client responses. Instant
retrieval replaces the L1 ticket queue.
```

### Alt 8A (recommended — single-word swap, near-zero change)
```
No delays. Fewer late payments, missed trades, dropped client responses. Instant
retrieval shrinks the L1 ticket queue.
```
*Why:* One word change. "Shrinks" is honest and measurable. Removes autonomy claim. UX shape identical.

### Alt 8B (slightly stronger framing)
```
No delays. Fewer late payments, missed trades, dropped client responses. Instant
retrieval keeps the L1 ticket queue from running deep.
```
*Why:* "Keeps from running deep" is a stronger operator promise. Still doesn't claim replacement.

### Alt 8C (federal-safe + IT-team-friendly)
```
No delays. Fewer late payments, missed trades, dropped client responses. Instant
retrieval moves routine answers out of the L1 queue and into the user's screen.
```
*Why:* Most explicit about HOW. Names the actual mechanism. Internal IT leaders prefer this framing because it doesn't threaten their team's role.

**Apply same chosen variant to both files** — index.html line 2731 + m.html line 936.

---

## Finding 9 — multiple "24/7" claims across index.html + m.html (5 + 5 instances each)

### 9a — Hero subtitle: `index.html:1764` + `m.html:563`

**Current:**
```
AI diagnostics · guided fixes · equipment · 24/7 live escalation
```

#### Alt 9a-A (recommended — preserves four-pillar shape)
```
AI diagnostics · guided fixes · equipment · after-hours escalation
```

#### Alt 9a-B (most honest)
```
AI diagnostics · guided fixes · equipment · scheduled and on-call escalation
```

#### Alt 9a-C (keeps "24/7" but qualifies it credibly)
```
AI diagnostics · guided fixes · equipment · 24/7 incident escalation via partnered NOC
```
*Use only if a real partnered NOC/MSSP relationship exists.*

---

### 9b — "Call 24/7" tile: `index.html:1807` + `m.html:580`

**Current:**
```
System down? Call (647) 581-3182 · 24/7
```

#### Alt 9b-A (recommended — direct + honest)
```
System down? Call (647) 581-3182 — after-hours response available
```

#### Alt 9b-B
```
System down? Call (647) 581-3182 — fastest path during business hours
```

#### Alt 9b-C (kept-promise framing)
```
System down? Call (647) 581-3182 — same-business-day response promised
```

---

### 9c — Tier 3 retainer tagline: `index.html:1961` + `m.html:687`

**Current:**
```
24/7 monitoring, Major Incident Management, Six Sigma auditing, and named senior analyst.
```

#### Alt 9c-A (recommended — partnered framing makes 24/7 honest)
```
24/7 monitoring via partnered SOC/NOC, Major Incident Management, Six Sigma auditing,
and named senior analyst.
```

#### Alt 9c-B (drops 24/7 claim, keeps tier value)
```
Active environment monitoring, Major Incident Management, Six Sigma auditing, and
named senior analyst.
```

#### Alt 9c-C (most conservative)
```
Continuous monitoring during operational windows, Major Incident Management, Six
Sigma auditing, and named senior analyst.
```

---

### 9d — Tier 3 retainer bullet: `index.html:1971` + `m.html:697`

**Current:**
```
24/7 monitoring & incident response
```

#### Alt 9d-A (recommended — pair with 9c-A)
```
24/7 monitoring & incident response (delivered via partnered SOC/NOC)
```

#### Alt 9d-B
```
Continuous monitoring & rapid incident response
```

#### Alt 9d-C
```
After-hours incident response with documented escalation paths
```

---

### 9e — Tier 3 "Always-On Support" deck-scale label: `index.html:2085` + `m.html:800`

**Current:**
```
Always-On Support
```

#### Alt 9e-A (recommended — kept brand energy without staffing claim)
```
High-Availability Support
```
*Why:* "High-Availability" is enterprise IT vocabulary; signals tier without claiming 24/7 staffing.

#### Alt 9e-B
```
Senior-Led Support
```

#### Alt 9e-C
```
Continuous Coverage
```

---

### 9f — "Every employee gets 24/7 expertise" chain-reaction line: `index.html:2733` + `m.html:938`

**Current:**
```
Productivity compounds. IT focuses on architecture, not password resets. Every
employee gets 24/7 expertise.
```

#### Alt 9f-A (recommended — same outcome promise without 24/7 staffing claim)
```
Productivity compounds. IT focuses on architecture, not password resets. Every
employee gets on-demand expertise the moment they need it.
```

#### Alt 9f-B
```
Productivity compounds. IT focuses on architecture, not password resets. Every
employee gets self-service access to senior-grade troubleshooting any time of day.
```

#### Alt 9f-C
```
Productivity compounds. IT focuses on architecture, not password resets. Every
employee has a senior-level answer one prompt away.
```

---

## Finding 10 — `index.html:2985` — "Always-on AI triage, fixes & escalation"

**Current:** (homepage ARIA card description)
```
{t:'ARIA — AI IT Assistant',d:'Always-on AI triage, fixes & escalation. Personal, Pro & Business tiers.',s:'Live'},
```

### Alt 10A (recommended)
```
{t:'ARIA — AI IT Assistant',d:'Always-on AI triage and escalation routing; human-approved fixes. Personal, Pro & Business tiers.',s:'Live'},
```
*Why:* Triage + routing is honest. Human-approved fixes mirrors federal one-pager exactly. Same character count region.

### Alt 10B
```
{t:'ARIA — AI IT Assistant',d:'Always-on AI triage and guided fixes; escalation to a human when needed. Personal, Pro & Business tiers.',s:'Live'},
```

### Alt 10C
```
{t:'ARIA — AI IT Assistant',d:'AI triage, guided self-service, and escalation routing. Personal, Pro & Business tiers.',s:'Live'},
```
*Why:* Removes "always-on" entirely if Ahmad wants to play it safest.

---

## Finding 11 — `index.html:1908` + `m.html:638` — "This retainer prevents ten of them per month"

**Current:**
```
One IT emergency handled externally costs $500 – $2,000 alone. This retainer
prevents ten of them per month. You are not buying support — you are buying the
absence of downtime.
```

### Alt 11A (recommended — keeps persuasive arc, drops the unsubstantiated number)
```
One IT emergency handled externally can cost $500 – $2,000 alone. A managed retainer
is built to prevent the kind of recurring drag that leads to those emergencies. You
are not buying support — you are buying the absence of downtime.
```
*Why:* Removes "ten of them per month" without losing the persuasive rhythm. "Built to prevent" is a posture statement, not a metric claim.

### Alt 11B (sharper, removes both unsupported claims)
```
One IT emergency handled externally can cost $500 – $2,000 alone, and they almost
never come one at a time. A managed retainer is built so most of them never reach
emergency status. You are not buying support — you are buying the absence of
downtime.
```

### Alt 11C (preserves "ten" but caveats it)
```
One IT emergency handled externally can cost $500 – $2,000 alone, and a typical
mid-size business sees several of these every month. A managed retainer is built
to prevent most of them before they hit. You are not buying support — you are
buying the absence of downtime.
```
*Why:* "Typical mid-size business sees several" is a softer industry-norm framing — Ahmad could defend it as common-knowledge industry observation rather than IIS-specific metric.

---

## Finding 12 — `m.html:8` + `m.html:10` (meta description / og:description) — "ARIA, our 24/7 AI senior technician"

**Current (line 8 meta description):**
```html
<meta name="description" content="Integrated IT Support Inc. — distinguished,
AI-powered IT support. Managed retainers, private engagement, and ARIA, our 24/7
AI senior technician. Whitby · Ontario · Global.">
```

**Current (line 10 og:description):**
```html
<meta property="og:description" content="Managed IT, private engagement, and ARIA
— your 24/7 AI senior technician. Whitby · Ontario · Global.">
```

### Alt 12A (recommended — sync to whichever rephrase wins for Finding 7)
```html
<meta name="description" content="Integrated IT Support Inc. — distinguished,
AI-powered IT support. Managed retainers, private engagement, and ARIA, your
always-available AI support assistant. Whitby · Ontario · Global.">

<meta property="og:description" content="Managed IT, private engagement, and ARIA
— your always-available AI support assistant. Whitby · Ontario · Global.">
```
*Why:* "Always-available" describes the software being on, not staffing — federal-safe + accurate. "Assistant" replaces "senior technician" (avoids personhood claim).

### Alt 12B (most conservative)
```html
<meta name="description" content="Integrated IT Support Inc. — distinguished,
AI-powered IT support. Managed retainers, private engagement, and ARIA, our
permission-based AI support assistant. Whitby · Ontario · Global.">

<meta property="og:description" content="Managed IT, private engagement, and ARIA
— a permission-based AI support assistant. Whitby · Ontario · Global.">
```

### Alt 12C (shortest, drops the ARIA tagline)
```html
<meta name="description" content="Integrated IT Support Inc. — managed IT support,
private engagement, and AI-assisted operations. Whitby · Ontario · Global.">

<meta property="og:description" content="Managed IT, private engagement, and
AI-assisted operations. Whitby · Ontario · Global.">
```

---

## Combined application guide for Codex

After Ahmad picks one alt per finding:

| File | Lines to edit | Source findings |
|---|---|---|
| `aria.html` | per `aria-claim-fix-alternates-2026-06-16.md` | 1–6 |
| `index.html` | 1764, 1807, 1908, 1961, 1971, 2085, 2731, 2733, 2854, 2985 | 7–11 |
| `m.html` | 8, 10, 563, 580, 638, 687, 697, 800, 936, 938, 955 | 7–9, 11, 12 |
| `commercial-real-estate.html` | 167 | original Finding 4 |
| `index-cmdline-preview.html` | 133 | original Finding 5 |

**Single PR title suggestion:** `[ccode] Federal-credibility public-copy fixes (16 findings, copy-only)`
**No HTML / CSS / JS structural change.** Pure string swaps.

---

## Cowork next move after this

- Build a similar pre-fix alts table for the `downloads/library/*-preview.html` family **after** the Lane 2 batch deploys — that's the next federal-evaluator surface to audit.
- Track adoption by re-running the original grep audit post-deploy. Goal: zero "24/7", zero "replaces", zero "deflects" outside qualified contexts.

## Stop rules

- No edits to public-facing HTML without Ahmad approval.
- No promise that fixes preserve original "demo magic" — federal credibility is the goal.
- No claim that conflicts can be ignored — they are real federal-evaluator risk.

## One-line summary

> 6 new findings, 3 alts each, plus a combined application guide. 16-finding copy-only PR can ship same-day after Ahmad picks 16 strings.
