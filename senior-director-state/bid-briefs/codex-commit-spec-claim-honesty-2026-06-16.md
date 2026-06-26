# Codex Commit Spec — Claim-Honesty Pass

**Branch:** `cowork/honesty-pass-2026-06-16`
**Commit message:** `[cowork] Honesty pass — federal-safe claim parity across public pages`
**Scope:** Copy-only edits across 5 files. Zero CSS, zero layout, zero color, zero JS. Pure string replacement.
**Prerequisite:** Ahmad sign-off on this spec (one approval, replaces 9 per-finding picks).
**Source audits:** `aria-public-vs-federal-claim-conflicts-2026-06-16.md` (findings 1–5) + `aria-claim-conflicts-supplement-2026-06-16.md` (findings 6–9).

---

## Why this spec exists

9 separate findings = 9 approval gates = slow. One consolidated spec = one Ahmad sign-off + one Codex commit. Federal-bid lane and public-site claim parity ship together.

Every edit below is **Cowork's recommended pick** from the alternates documents. Ahmad can override any line before sign-off.

---

## Edit 1 — `aria.html:2923` — autonomous claim → human-in-loop

**Find:**
```
'I can either guide you step-by-step,<br/>or resolve the issue for you remotely.'
```

**Replace with:**
```
'I can guide you step-by-step,<br/>or walk a remote technician through it with you.'
```

**Why:** Removes the autonomous-AI claim flagged 2026-05-15 honesty audit + 2026-06-16 federal conflict.

---

## Edit 2 — `aria.html:1590` — unsubstantiated metric → real production fact

**Find:**
```
<div class="head"><em id="opsResolved">4,218</em> incidents resolved in the last 24 hours.</div>
```

**Replace with:**
```
<div class="head"><em id="opsResolved">9+</em> ARIA agents in continuous production rotation.</div>
```

**Why:** 9+ agents is documented in the federal one-pager + Ahmad's resume. Visual rhythm preserved.

### Sibling stat fixes in the same panel (lines 1592–1594 region)

| Find | Replace |
|---|---|
| `<div class="lbl">UPTIME</div><div class="val" id="opsUptime">99.998%</div>` | `<div class="lbl">PLATFORM</div><div class="val" id="opsUptime">Netlify prod</div>` |
| `<div class="lbl">MEAN RESOLVE</div><div class="val" id="opsResolve">11.4s</div>` | `<div class="lbl">RAG</div><div class="val" id="opsResolve">file-based</div>` |
| `<div class="lbl">AGENTS LIVE</div><div class="val" id="opsAgents">184</div>` | `<div class="lbl">AGENTS</div><div class="val" id="opsAgents">9+ / 12 MCP</div>` |

Same dashboard shape. All numbers truthful.

---

## Edit 3 — `aria.html:1634` — "24/7 ACTIVE" → "ADVISORY"

**Find:**
```
<div class="name">Server monitoring</div><div class="avg">24/7 ACTIVE</div>
```

**Replace with:**
```
<div class="name">Server monitoring</div><div class="avg">ADVISORY</div>
```

### Sibling tier-03 line fixes (lines 1635–1639 region)

| Find | Replace |
|---|---|
| `<div class="name">Threat isolation</div><div class="avg">AVG - 1.8s</div><div class="delta zero">0 INCIDENTS</div>` | `<div class="name">Threat isolation</div><div class="avg">ADVISORY</div><div class="delta zero">METHODOLOGY</div>` |
| `<div class="name">Directory repair</div><div class="avg">AVG - 02:14</div><div class="delta">+4%</div>` | `<div class="name">Directory repair</div><div class="avg">ADVISORY</div><div class="delta">RUNBOOK</div>` |
| `<div class="name">Infrastructure diagnostics</div><div class="avg">AVG - 03:48</div><div class="delta">+12%</div>` | `<div class="name">Infrastructure diagnostics</div><div class="avg">ADVISORY</div><div class="delta">REPORT</div>` |
| `<div class="name">Remote system recovery</div><div class="avg">AVG - 08:21</div><div class="delta">+7%</div>` | `<div class="name">Remote system recovery</div><div class="avg">METHODOLOGY</div><div class="delta">PLAN</div>` |
| `<div class="name">PKI certificate renewal</div><div class="avg">AVG - 05:42</div><div class="delta watch">WATCH</div>` | `<div class="name">PKI certificate renewal</div><div class="avg">ADVISORY</div><div class="delta watch">CHECKLIST</div>` |

Same panel visual rhythm. All true.

---

## Edit 4 — `commercial-real-estate.html:167` — "24/7 deflects out of the box" → "augmented + audit trail"

**Find:**
```
<strong>AI-native helpdesk</strong> — ARIA, our 24/7 AI helpdesk assistant, deflects Tier 1/2/3 tickets out of the box. <a href="/" class="text-[#c5a059] hover:underline">Try it live</a>.
```

**Replace with:**
```
<strong>AI-augmented helpdesk</strong> — ARIA drafts Tier 1/2/3 responses for human approval and captures every decision with audit trail. <a href="/" class="text-[#c5a059] hover:underline">Try it live</a>.
```

---

## Edit 5 — `index-cmdline-preview.html:133` — "24/7 monitoring" → "L1-L3 advisory"

**Find:**
```
<div class="c"><b>Help desk</b><span>24/7 monitoring, major incident management.</span></div>
```

**Replace with:**
```
<div class="c"><b>Help desk</b><span>Senior-led L1-L3 advisory, major incident playbooks.</span></div>
```

---

## Edit 6 — `about.html:480` and lines 482–514 — "IIS executed for [employers]" → "Engagement Lead background"

**Find (line 480):**
```
<p style="margin-top: 20px;">Frameworks like Six Sigma / DMAIC, Kaizen, OKR, STAR, and After Action Review are not aspirational here &mdash; they are the operating history of the firm. What most providers study, IIS has executed against measurable outcomes for some of Canada&rsquo;s most demanding institutions.</p>
```

**Replace with:**
```
<p style="margin-top: 20px;">Frameworks like Six Sigma / DMAIC, Kaizen, OKR, STAR, and After Action Review are not aspirational here &mdash; they are the operating history our Engagement Lead carries into every IIS engagement. What most providers study, our Engagement Lead has executed against measurable outcomes inside some of Canada&rsquo;s most demanding institutions.</p>
```

**Find (line 482):**
```
<h3 id="about-track">Enterprise Track Record</h3>
```

**Replace with:**
```
<h3 id="about-track">Engagement Lead Background</h3>
```

**Find (line 483):**
```
<p>Enterprise environments where the stakes are real, the margins for error are zero, and the outcome is measured in business continuity &mdash; not closed tickets.</p>
```

**Replace with:**
```
<p>Enterprise environments where the Engagement Lead earned the operating discipline IIS now brings to every engagement &mdash; outcomes measured in business continuity, not closed tickets.</p>
```

### Track-tile prose rewrites (lines 486–514 region)

Tile order stays the same. Org names + role labels stay the same. Only the description paragraph in each tile changes.

| Tile | Find paragraph | Replace paragraph |
|---|---|---|
| Capital Markets Operations | `White-glove executive IT support inside live financial trading environments, where a single hour of downtime is not an inconvenience &mdash; it is a liability.` | `Where Ahmad provided white-glove executive IT support inside live financial trading environments &mdash; the operating posture he carries into every IIS engagement.` |
| RBC | `Six Sigma certified, ITIL certified, Team Lead and Major Incident Manager. Ran DMAIC cycles that systematically eliminated recurring failures in enterprise banking operations.` | `Where Ahmad led Service Desk teams as Team Lead and Major Incident Manager, running DMAIC cycles in enterprise banking &mdash; the methodology that grounds IIS today.` |
| Scotiabank | `Deployed 100+ laptops daily with executive-level migration support &mdash; scale and precision delivered simultaneously, without compromise on either.` | `Where Ahmad delivered 100+ laptop migrations daily with executive-level care &mdash; the throughput discipline IIS designs into client rollouts.` |
| Ontario Health | `PHIPA-compliant healthcare IT, EMR systems, and provincial-scale digital-health infrastructure &mdash; where data integrity is a legal and ethical obligation.` | `Where Ahmad supported PHIPA-compliant healthcare IT and EMR systems &mdash; the regulated-data posture he applies to every IIS engagement.` |
| City of Toronto | `Multi-division enterprise IT support across a major municipal environment &mdash; where service continuity touches every corner of public delivery.` | `Where Ahmad supported multi-division municipal IT operations &mdash; the public-sector continuity mindset he brings to IIS.` |
| IBM | `Multi-timezone, multi-client enterprise operations inside IBM&rsquo;s global delivery model &mdash; the benchmark environment for disciplined, documented execution.` | `Where Ahmad executed inside IBM&rsquo;s global delivery model &mdash; the documented-execution standard IIS holds itself to.` |

Logos / visuals / tile structure all unchanged.

---

## Edit 7 — `index.html:2163` — Seneca/George Brown delivery claim → Engagement Lead background

**Find:**
```
<div class="impact-outcome">Hundreds of users, thousands of devices, and data that legally cannot be compromised — ever. Lab operations, identity and access, onboarding, and disaster-recovery planning delivered for Seneca, George Brown, and public-sector environments built to scale without losing control.</div>
```

**Replace with:**
```
<div class="impact-outcome">Hundreds of users, thousands of devices, and regulated-data environments where downtime is a legal exposure. The operating posture our Engagement Lead carried through RBC Capital Markets, Ontario Health, and Scotia's migration window now grounds every IIS engagement.</div>
```

**Why:** drops Seneca + George Brown (no resume backing for delivery to either); replaces with the institutions Ahmad actually worked at.

---

## Edit 8 — `shop.html:478` — "Our team" → senior-led owner-operator framing

**Find:**
```
Tell us what you're hunting for — a specific device, a hard-to-find part, the best supplier, a tool, a deal, or a straight answer. Our team does the legwork and hands you the vetted source. Flat <b style="color:#f1dca7">$40</b> to unlock each find — you're paying for our time and judgment, not the public information itself.
```

**Replace with:**
```
Tell us what you're hunting for — a specific device, a hard-to-find part, the best supplier, a tool, a deal, or a straight answer. Senior-led product research — we do the legwork and hand you the vetted source. Flat <b style="color:#f1dca7">$40</b> to unlock each find — you're paying for our time and judgment, not the public information itself.
```

---

## Edit 9 — `plans/index.html:112` — "24/7 chat + voice support" → honest tier feature

**Find (line 112 — Personal tier feature list):**
```
<li>24/7 chat + voice support</li>
```

**Replace with:**
```
<li>24/7 ARIA chat · business-hours voice support</li>
```

### Same pattern check on Pro / Small Business / Mid Size / Enterprise tiers

If any other tier in `plans/index.html` uses the same exact "24/7 chat + voice support" string, apply the same replacement.

**Engineering verify — separate Codex task (NOT in this commit):**

Before this commit ships OR concurrently in a separate PR, Codex must verify on the live deploy:

1. `/plans` SUBSCRIBE buttons hit a working Stripe checkout (test mode + live mode parity).
2. STRIPE_SECRET_KEY env var is set in Netlify production environment.
3. `/health` endpoint returns `stripe:true`.

If any check fails: disable SUBSCRIBE buttons via a CSS `pointer-events:none` toggle + "Coming soon — contact sales" overlay until live keys land. That's a small follow-on commit, not in this honesty pass.

---

## Files touched (5 files, ~28 string replacements)

- `aria.html` — 6 replacements (Edits 1, 2 + sibling stats, 3 + sibling tier-03 lines)
- `commercial-real-estate.html` — 1 replacement (Edit 4)
- `index-cmdline-preview.html` — 1 replacement (Edit 5)
- `about.html` — 9 replacements (Edit 6 — intro paragraph, h3, intro line, 6 tile paragraphs)
- `index.html` — 1 replacement (Edit 7)
- `shop.html` — 1 replacement (Edit 8)
- `plans/index.html` — 1+ replacement (Edit 9, repeated per tier if needed)

Total ~20 string replacements across 7 files (counted as one logical commit). No CSS, no JS, no markup-structure changes. Diff will read as pure prose updates.

## Smoke-test checklist (Codex runs post-commit, pre-deploy)

Per [[feedback_aperture_aria_never_break]]:

1. `/aperture` login still works.
2. `/aria` page loads without console errors.
3. ARIA chat + voice toggle behaviour unchanged.
4. Homepage `index.html` renders without layout shift.
5. `/about` Engagement Lead Background tiles render with the same visual rhythm.
6. `/plans` page still renders SUBSCRIBE buttons (visually intact even if Stripe broken).
7. `/shop` page renders unchanged.
8. `aria-core.css` not imported on any utilitarian admin page.

Any failure = rollback, do not deploy.

## Commit metadata

- Branch: `cowork/honesty-pass-2026-06-16`
- Commit prefix: `[cowork]` per [[agent_coordination_protocol]]
- Commit body: "Federal-safe claim parity across public pages — 9 findings, copy-only, no design changes. Sources: senior-director-state/aria-public-vs-federal-claim-conflicts-2026-06-16.md + supplement."
- PR title: "Honesty pass — federal-safe claim parity across public pages"
- PR labels: `cowork`, `copy-only`, `legal-safety-review`
- Tag Ahmad in PR description.

## Approval gate

**Single approval needed from Ahmad:** "Approve commit spec as-is" OR "Approve with overrides on edits X/Y/Z" OR "Defer." On approve, Codex applies in one branch + PR, Ahmad clicks Publish in Netlify per the standard locked-publish path ([[skill_netlify_publish_locked]]).

## Stop rules

- No edit outside the 7 files listed.
- No CSS / layout / color / position changes.
- No new claim added; only existing claims softened to match reality.
- No new metric introduced.
- Stripe wiring verify is a SEPARATE engineering task — not in this commit.
- Aperture + ARIA must verify functional post-deploy per HARD RULE.

## One-line summary

> 9 honesty fixes consolidated into one Codex-ready commit spec across 7 files. ~20 string replacements, zero design change. Single Ahmad sign-off replaces 9 per-finding picks. Federal credibility + visual stability + brand reputation all preserved.
