# ARIA Claim-Fix Alternates — Honest + Reputable Phrasings

**For:** the 5 conflicts in `aria-public-vs-federal-claim-conflicts-2026-06-16.md`.
**Constraint per Ahmad 2026-06-16:** keep IIS reputable, don't oversell, don't damage brand by underselling either.
**Owner:** Cowork drafts. Ahmad picks one per finding. Codex applies as one copy-only commit.
**Visual-stability rule respected:** only the text strings change, no design, layout, color, or position changes.

**Honesty bar:** every alt must be a thing IIS can actually back up under federal evaluator scrutiny.
**Reputation bar:** every alt must still sound senior-led, AI-capable, and worth hiring.

---

## Finding 1 — `aria.html:2923` — "or resolve the issue for you remotely"

**Current:**
```
'I can either guide you step-by-step,<br/>or resolve the issue for you remotely.'
```

### Alt 1A (recommended — preserves "two paths" UX without autonomy claim)
```
'I can guide you step-by-step,<br/>or walk a remote technician through it with you.'
```
*Why:* Two paths kept (self-serve / assisted). No autonomous claim. Federal-safe. Reputable.

### Alt 1B (clearer about the human role)
```
'I can walk you through it step-by-step,<br/>or stay with you while a technician handles the change.'
```
*Why:* Says explicitly a human technician makes changes. Strong trust signal.

### Alt 1C (simpler, no second path)
```
'I can walk you through this step-by-step.<br/>You stay in control of every change.'
```
*Why:* Removes the "resolve for you" claim entirely. Doubles down on user control — actually a stronger sales position for cautious buyers.

---

## Finding 2 — `aria.html:1590` — "4,218 incidents resolved in the last 24 hours"

**Current:**
```html
<div class="head"><em id="opsResolved">4,218</em> incidents resolved in the last 24 hours.</div>
```

> Context: the surrounding panel is labelled "GLOBAL OPERATIONS CENTER" — visually a dashboard. The fix needs to keep the dashboard visually impressive without claiming a number IIS can't back up.

### Alt 2A (recommended — frame as ARIA agent activity, which IS real)
```html
<div class="head"><em id="opsResolved">9+</em> ARIA agents in continuous production rotation.</div>
```
*Why:* 9+ agents is real (per resume + ARIA one-pager). "Continuous production rotation" is factually accurate. Looks impressive, IS impressive, federally defensible.

### Alt 2B (process-framed, no count)
```html
<div class="head">Every action ARIA proposes is logged with timestamp, decider, options, and rationale.</div>
```
*Why:* Replaces a metric with a methodology statement. Sells the decision-capture differentiator directly. Federal-safe.

### Alt 2C (operating cadence as the metric)
```html
<div class="head">Daily 3 PM contract scans · pre-dawn ops briefings · end-of-month tax reconciliation.</div>
```
*Why:* Cron schedules are real per resume. Shows operating rhythm — the kind of detail that signals "this thing actually runs."

### For the surrounding stats (UPTIME 99.998% · MEAN RESOLVE 11.4s · AGENTS LIVE 184)

These also need attention — same risk pattern. Recommended replacements:

| Current label / value | Recommended replacement |
|---|---|
| UPTIME 99.998% | **PLATFORM** Netlify production |
| MEAN RESOLVE 11.4s | **RAG** file-based markdown KB |
| AGENTS LIVE 184 | **AGENTS** 9+ scheduled, 12 MCP tools |

Same dashboard look, all numbers truthful.

---

## Finding 3 — `aria.html:1634` — "Server monitoring · 24/7 ACTIVE"

**Current:**
```html
<div class="name">Server monitoring</div><div class="avg">24/7 ACTIVE</div>
```

> Context: line item inside the "Tier 03 — Infrastructure" panel. Sibling lines like "Threat isolation AVG 1.8s · 0 INCIDENTS" share the same risk shape. Recommend fixing the whole panel as a set.

### Alt 3A (recommended — reframe to advisory)
```html
<div class="name">Server monitoring</div><div class="avg">ADVISORY</div>
```
*Why:* IIS does provide advisory on monitoring posture — recommendations, tuning, runbook. "Advisory" is a real IIS service line.

### Alt 3B (specify business-hours engagement)
```html
<div class="name">Server monitoring</div><div class="avg">BUSINESS-HRS</div>
```
*Why:* Honest about coverage. Federal-safe.

### Alt 3C (partner-network framing)
```html
<div class="name">Server monitoring</div><div class="avg">PARTNER-COV</div>
```
*Why:* If IIS partners or plans to partner for 24/7, this is the truthful frame.

### Other tier-03 line items in the same panel — recommended fixes

| Current | Recommended |
|---|---|
| Threat isolation · AVG 1.8s · 0 INCIDENTS | Threat isolation · ADVISORY · methodology |
| Directory repair · AVG 02:14 · +4% | Directory repair · ADVISORY · runbook |
| Infrastructure diagnostics · AVG 03:48 · +12% | Infrastructure diagnostics · ADVISORY · report |
| Remote system recovery · AVG 08:21 · +7% | Remote system recovery · METHODOLOGY · plan |
| PKI certificate renewal · AVG 05:42 · WATCH | PKI certificate renewal · ADVISORY · checklist |

All same panel design. All true. Federal-safe.

---

## Finding 4 — `commercial-real-estate.html:167` — "ARIA, our 24/7 AI helpdesk assistant, deflects Tier 1/2/3 tickets out of the box"

**Current:**
```html
<strong>AI-native helpdesk</strong> — ARIA, our 24/7 AI helpdesk assistant, deflects Tier 1/2/3 tickets out of the box.
```

### Alt 4A (recommended — honest about role)
```html
<strong>AI-augmented helpdesk</strong> — ARIA drafts Tier 1/2/3 responses for human approval, captures every decision with audit trail.
```
*Why:* Real. Anti-autonomous. Says "drafts for approval" not "deflects." Sells the audit trail = federal-friendly + commercial-buyer-friendly.

### Alt 4B (faster, punchier)
```html
<strong>AI-augmented helpdesk</strong> — ARIA accelerates Tier 1/2/3 response with human-approved drafts and a full decision log.
```
*Why:* "Accelerates" instead of "deflects." Same energy, no autonomy claim.

### Alt 4C (CRE-specific framing — building-ops angle)
```html
<strong>AI-augmented helpdesk</strong> — ARIA helps your building-ops team handle tenant tickets faster, with senior-led methodology and a logged decision trail.
```
*Why:* Speaks to the commercial-real-estate audience directly. Mentions "senior-led" — the real IIS differentiator.

---

## Finding 5 — `index-cmdline-preview.html:133` — "Help desk · 24/7 monitoring, major incident management"

**Current:**
```html
<div class="c"><b>Help desk</b><span>24/7 monitoring, major incident management.</span></div>
```

### Alt 5A (recommended — preserves the line length and visual rhythm)
```html
<div class="c"><b>Help desk</b><span>Senior-led L1-L3 advisory, major incident playbooks.</span></div>
```
*Why:* "Senior-led L1-L3 advisory" is exactly what IIS is. "Major incident playbooks" is the deliverable IIS actually produces (per RBC experience + resume).

### Alt 5B (focuses on the AI angle)
```html
<div class="c"><b>Help desk</b><span>AI-augmented Tier 1-3 desk design, incident runbooks.</span></div>
```

### Alt 5C (shortest, closest to original cadence)
```html
<div class="c"><b>Help desk</b><span>L1-L3 methodology, major incident management.</span></div>
```

---

## Standby alternates if Ahmad picks none of the above

For each finding, three safe fallback patterns that work anywhere:

| Risk pattern | Safe fallback shape |
|---|---|
| Autonomous "resolves for you" | "Walks you through" / "Drafts for your approval" / "Captures every decision" |
| Unsubstantiated metric (X resolved in Y) | Real-and-reportable metric (agent count, cron schedule, MCP count) |
| 24/7 capability | "Advisory" / "Business-hours engagement" / "Partner-network coverage" |
| "Out of the box" automation | "Designed for your team" / "Plug into your existing desk" / "Senior-led integration" |
| Vague enterprise-scale language | Specific, real, smaller-scale truth (Band 1, 1-Founder firm, Anthropic Partner pipeline) |

## What this preserves

- **Brand reputation:** IIS still sounds senior-led, AI-native, premium. Just stops claiming things it can't substantiate.
- **Demo magic:** the dashboards still look impressive — same panel design, same visual rhythm. Numbers change to real numbers.
- **Sales position:** "we'll teach your team to do it right" is actually a stronger small-MSP positioning than "we'll do it for you" (Hormozi-style operator framing).
- **Federal credibility:** the website now matches the federal-safe one-pager. Evaluators see one consistent story.
- **Visual stability:** zero CSS / layout / color / position change. Only string literals shift.

## How Ahmad uses this

For each finding 1–5, pick A / B / C (or write your own in the same shape). One pass through this document = 5 quick choices. Then Codex applies as a single small commit:

```
1A / 1B / 1C → ____
2A / 2B / 2C → ____  (+ optionally fix the 3 sibling stats per Alt 2A guide)
3A / 3B / 3C → ____  (+ optionally fix the 5 sibling tier-03 lines)
4A / 4B / 4C → ____
5A / 5B / 5C → ____
```

## Stop rules

- Cowork does NOT apply these to public HTML — Ahmad picks, Codex applies.
- No claim added that requires evidence IIS doesn't have.
- No regulatory / certification claim ("SOC 2", "ISO 27001", "PCI-compliant") added anywhere.
- No metric stated that IIS cannot show under federal evaluator inspection.

## One-line summary

> Five findings, three alternative honest phrasings each, plus sibling-line fixes for the dashboard stats and tier-03 panel. Ahmad picks one per finding (~5 quick choices). Codex applies as a copy-only commit. Brand stays reputable, federal credibility lands, visual look untouched.
