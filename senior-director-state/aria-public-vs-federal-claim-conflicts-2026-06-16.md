# ARIA Public Claims vs Federal-Safe Framing — Conflict Audit 2026-06-16

**Owner:** Cowork (legal-safety-review-agent surface analysis).
**Why this exists:** I just shipped a federal-safe ARIA one-pager (`aria-platform-one-pager-2026-06-16.md`) using strict anti-claim language. The public site iisupp.net may still carry older claims that conflict. Federal evaluators check vendor websites — claim parity matters.
**Visual-stability rule respected:** Cowork flags, does not edit. Ahmad decides.
**Scope:** Read-only grep audit of repo `*.html` files for autonomous-AI claims, unsupported metrics, 24/7 staffing claims, "resolves for you" language.

---

## Findings — ranked by federal-evaluator impact

### Finding 1 — CRITICAL: "resolve the issue for you remotely" in ARIA homepage

**File:** `aria.html` line 2923.

```javascript
headline:'I can either guide you step-by-step,<br/>or resolve the issue for you remotely.'
```

**Conflict:** Federal one-pager says "ARIA does not make autonomous decisions. Every action-taking step requires human oversight." Public site says ARIA can "resolve the issue for you remotely" — implies autonomous remediation.

**History:** Memory `project_aria_honesty_audit_2026_05_15.md` already flagged this as "FAKE theatre — hardcoded Mail.exe audit trail even on printer queries."

**Federal evaluator read:** vendor claims autonomous AI on its website but disclaims it in the bid response. Trust gap. Could be evaluated as misleading marketing under federal Integrity Regime.

**Recommended action (Ahmad):** soften to "or walk a human technician through the fix" OR remove the "or resolve" half entirely. Cowork can draft 3 alternative phrasings on request.

### Finding 2 — HIGH: "4,218 incidents resolved in the last 24 hours" — unsubstantiated metric

**File:** `aria.html` line 1590.

```html
<div class="head"><em id="opsResolved">4,218</em> incidents resolved in the last 24 hours.</div>
```

**Conflict:** Federal one-pager carries no metrics that aren't internally measured. Public site shows a specific number IIS cannot substantiate to a federal evaluator who asks "how is this measured, what counts as resolved, what's the data source?"

**Federal evaluator read:** if asked, IIS cannot back this up. Fictional metrics are an Integrity Regime risk.

**Recommended action (Ahmad):** replace with directional language ("daily incident throughput in production" with no specific number) OR remove the panel until metric is real and auditable.

### Finding 3 — HIGH: "24/7 ACTIVE" server monitoring tier

**File:** `aria.html` line 1634.

```html
<div class="name">Server monitoring</div><div class="avg">24/7 ACTIVE</div>
```

**Conflict:** Federal one-pager: "Remote-only delivery. No on-site work. Engagement Boundaries: Band 1." IIS does not currently operate a 24/7 monitoring desk. Public claim implies IIS does.

**Federal evaluator read:** federal buyers ask for SOC-2 / ISO documentation for any 24/7 claim. IIS cannot produce it.

**Recommended action (Ahmad):** label as "Demo dashboard" OR replace with realistic positioning ("on-call support during agreed business hours; 24/7 monitoring available via partner network").

### Finding 4 — HIGH: "ARIA, our 24/7 AI helpdesk assistant"

**File:** `commercial-real-estate.html` line 167.

```html
<strong>AI-native helpdesk</strong> — ARIA, our 24/7 AI helpdesk assistant, deflects Tier 1/2/3 tickets out of the box.
```

**Conflict:** "Deflects Tier 1/2/3 tickets out of the box" implies ARIA replaces human IT staff at all three tiers. Federal one-pager: "Workflow draft generation: ARIA drafts proposals, summaries, RCAs, runbooks for human approval. Never publishes, sends, or executes without sign-off."

**Federal evaluator read:** "deflects" sounds autonomous; "out of the box" implies no professional services needed. Both conflict with the conservative federal positioning.

**Recommended action (Ahmad):** rephrase to "augments your Tier 1/2/3 desk with AI-drafted responses (human approval required)" OR similar.

### Finding 5 — MEDIUM: "Help desk" panel "24/7 monitoring, major incident management"

**File:** `index-cmdline-preview.html` line 133.

```html
<div class="c"><b>Help desk</b><span>24/7 monitoring, major incident management.</span></div>
```

**Conflict:** Same 24/7 issue — IIS does not currently staff 24/7 help-desk monitoring.

**Recommended action (Ahmad):** same as Finding 3.

### Finding 6 — LOW: "Six Sigma certified, ITIL certified" on about.html

**File:** `about.html` lines 465, 469, 493.

**Conflict:** None — these are real per Ahmad's resume (Six Sigma Yellow Belt RBC 2017, ITIL Foundations RBC 2017). Federal-safe.

**No action needed.** Listed to confirm audit was complete.

---

## Pattern analysis

Two systemic patterns drove the issues:

1. **Demo-aspirational copy that became permanent claims.** Statements like "24/7 monitoring" and "4,218 incidents resolved" originated as ARIA capability demos — they look impressive but turned into public-website claims without an evidence backstop.
2. **"Resolve" / "deflect" / "out of the box" language** that implies autonomous AI delivery. This was acceptable internally as a directional aspiration; it's risky to a federal procurement evaluator.

Fixing both = website matches federal one-pager = federal evaluators see one consistent vendor story.

---

## Two-track recommendation

**Track A — Quick fix (no visual regression):** Cowork drafts 3 alternative phrasings per finding (no design changes, copy-only). Ahmad picks one per finding. Codex applies as a single small commit. Roughly 30 minutes of Ahmad time, zero risk to look/feel.

**Track B — Hold (status quo):** Do nothing publicly. Use the federal one-pager only in private bid responses. Risk: evaluators do check public sites. Some PSPC / OSFI evaluators score this as a red flag.

**Cowork recommendation: Track A.** Federal procurement is too coordinated a buyer to let public/private mismatch slide.

---

## What Cowork can do without Ahmad

- **Pre-draft 3 alternative phrasings per finding** — local-only, no public commit. Then Ahmad picks per finding in one read-through.
- **Cross-check `services.html`, `growth-library.html`, `start-here.html`** for similar patterns the targeted grep didn't surface.
- **Flag any new public claims** going forward via the same audit pattern any time a deploy lands.

## Stop rules

- No edits to public-facing HTML without Ahmad approval (visual-stability hard rule).
- No claim that conflicts can be ignored — they are real federal-evaluator risk.
- No promise that fixes preserve current "demo magic" appeal — federal credibility wins over demo flash for B2G buyers.

## One-line summary

> 5 public-site claims conflict with the federal-safe ARIA one-pager. Cowork drafts 3 alternative phrasings per finding on request; Ahmad picks once; Codex applies one small copy-only commit. Federal credibility + visual stability both preserved.
