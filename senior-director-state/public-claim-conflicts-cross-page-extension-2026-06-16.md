# Public Claim Conflicts — Cross-Page Extension Audit 2026-06-16

**Owner:** Claude Cowork (read-only).
**Extends:** `aria-public-vs-federal-claim-conflicts-2026-06-16.md` (which scanned aria.html only).
**Scope this pass:** services.html, growth-library.html, start-here.html, shop.html, ai-edge.html, about.html, commercial-real-estate.html, **m.html**, **index.html**.
**Visual-stability rule respected:** Cowork flags, does not edit. Ahmad decides per `feedback_visual_stability.md`.
**Why this pass:** federal evaluators check vendor websites. Conflicts beyond aria.html still damage PSPC AI Source List credibility. Mobile homepage (`m.html`) was missed in original audit — it mirrors index.html and triples the public-claim surface.

---

## Pattern summary

The same two problem patterns documented in the original audit appear at scale across the homepage (both desktop `index.html` and mobile `m.html`) and the commercial-real-estate page:

1. **24/7 service claims** — "24/7 live escalation", "Always-On Support", "24/7 monitoring & incident response", "ARIA — your 24/7 AI senior technician". IIS does not currently staff a 24/7 desk and cannot produce SOC-2 / ISO documentation to back it.

2. **AI replaces humans claims** — "we replace expensive IT departments with one AI senior tech", "Instant retrieval replaces the L1 ticket queue", "deflects Tier 1/2/3 tickets out of the box". Federal-safe one-pager: "ARIA does not make autonomous decisions. Every action-taking step requires human oversight." Public claims conflict.

These are the same statements the original audit flagged on aria.html — but they propagate across the public site. Federal evaluators only need to find ONE conflict to score a vendor as inconsistent.

---

## New findings — ranked by federal-evaluator impact

### Finding 7 — CRITICAL: `index.html` line 2854 + `m.html` line 955 — "we replace expensive IT departments with one AI senior tech, available 24/7"

**File 1:** `index.html` line 2854
```
See ARIA in action — an 80-second sales pitch showing how we replace expensive IT departments
with one AI senior tech, available 24/7. Built for businesses tired of paying $7,000+/month
for in-house IT.
```

**File 2:** `m.html` line 955 (same claim, shorter)
```
See ARIA in action — an 80-second pitch showing how we replace expensive IT departments
with one AI senior tech, available 24/7.
```

**Conflict:** Three problems in one sentence:
- "replace expensive IT departments" → autonomous claim
- "one AI senior tech" → personhood claim (ARIA is software, not a tech)
- "available 24/7" → unbacked staffing claim
- The `$7,000+/month for in-house IT` figure is a competitive-positioning claim that's hard to substantiate on a federal evaluator's audit.

**Federal evaluator read:** vendor's headline ARIA pitch is autonomous-AI-replaces-humans + 24/7 staffing implied. Direct contradiction of federal-safe one-pager. **Highest-impact conflict on the site.**

**Recommended action (Ahmad):** rewrite the pitch sentence both places:
```
See ARIA in action — an 80-second walkthrough showing how an AI assistant cuts
support-ticket friction and gives your IT team more time for higher-value work.
```
Or: "augments your IT operations" / "reduces L1 load" framing.

---

### Finding 8 — HIGH: `index.html` line 2731 + `m.html` line 936 — "Instant retrieval replaces the L1 ticket queue"

**Same conflict pattern.** "Replaces" implies autonomy. Federal-safe positioning is "augments" or "reduces queue depth on L1 ticket categories."

**Recommended action:** swap "replaces" → "reduces" or "augments".

---

### Finding 9 — HIGH: `index.html` lines 1764, 1961, 1971, 2085, 2733 + `m.html` lines 563, 687, 697, 800, 938 — repeated "24/7" claims

**Locations (desktop `index.html`):**
- 1764: hero subtitle "AI diagnostics · guided fixes · equipment · 24/7 live escalation"
- 1961: deck tagline "24/7 monitoring, Major Incident Management..."
- 1971: tier-3 retainer line "24/7 monitoring & incident response"
- 2085: tier-3 retainer scale "Always-On Support"
- 2733: chain-reaction line "Every employee gets 24/7 expertise"

**Locations (mobile `m.html`):** same pattern at lines 563, 687, 697, 800, 938.

**Conflict:** None of these are demos. They're operational claims. Federal procurement will ask "where is your SOC-2 documentation?" IIS does not currently staff 24/7.

**Recommended action (Ahmad):** two options:
- **Option A (preferred):** rephrase tier-3 retainer language to "on-call after-hours response within agreed SLA windows" + "24/7 incident escalation through partnered NOC/MSSP" (only if a partner is real).
- **Option B (simpler):** add a small footnote anywhere a "24/7" claim appears: "24/7 incident response delivered via partnered monitoring service; in-house support hours business days."

The hero subtitle ("24/7 live escalation") is the most visible and can be rephrased to "after-hours incident escalation available" with the same UX shape.

---

### Finding 10 — MEDIUM: `index.html` line 2985 — "Always-on AI triage, fixes & escalation"

**File:** `index.html` line 2985

**Context:** appears in the deck-positioning short-line summarizing ARIA on the homepage card.

**Conflict:** "Fixes" implies autonomous remediation. Federal-safe: "AI triage and routing; human approval for fixes."

**Recommended action:** rephrase to "Always-on AI triage and escalation routing; human-approved fixes."

---

### Finding 11 — MEDIUM: `index.html` line 1908 + `m.html` line 638 — "This retainer prevents ten of them per month"

**File 1:** `index.html` line 1908
```
One IT emergency handled externally costs $500 – $2,000 alone. This retainer
prevents ten of them per month. You are not buying support — you are buying the
absence of downtime.
```

**File 2:** `m.html` line 638 — same line.

**Conflict:** "Prevents ten of them per month" is a specific unsubstantiated outcome claim. Federal procurement asks "how is this measured? what's the baseline data?" IIS cannot produce that.

**Recommended action (Ahmad):** soften to directional language:
```
One IT emergency handled externally can cost $500 – $2,000. A managed retainer is
built to prevent the kind of recurring drag that leads to those emergencies. You
are not buying support — you are buying the absence of downtime.
```
Removes the numeric outcome claim, keeps the persuasive framing.

---

### Finding 12 — LOW: `m.html` lines 8, 10 (meta description) — "ARIA, our 24/7 AI senior technician"

**File:** `m.html` lines 8, 10 — `<meta name="description">` and `<meta property="og:description">`

**Conflict:** OG and meta descriptions are scraped by Google + LinkedIn + procurement-research tools. Even if the homepage hero is fixed, the meta description still propagates the claim across search/social previews.

**Recommended action:** sync meta description to whichever rephrase wins for Finding 7. Same string in both places.

---

## Summary count

| Page | New findings (this pass) | Pre-existing (original audit) | Total claim conflicts |
|---|---|---|---|
| `index.html` | 5 | 0 | 5 |
| `m.html` | 6 (mirror of index + meta) | 0 | 6 |
| `commercial-real-estate.html` | 0 | 1 (Finding 4) | 1 |
| `aria.html` | 0 | 5 (Findings 1–3, 5, 6 LOW) | 5 |
| `index-cmdline-preview.html` | 0 | 1 (Finding 5) | 1 |

Pages with **no conflicts found this pass:** `services.html`, `growth-library.html`, `start-here.html`, `shop.html`, `ai-edge.html`, `about.html`.

---

## Cowork recommendation

**Track A continues — but expand the scope.** The original audit's Track A recommended copy-only fixes on 5 aria.html findings. After this pass:

- **Total findings: 16** (5 original + 11 new).
- Most of the new findings are **the same 2 strings appearing across `index.html` + `m.html`** — so the actual edit count is closer to 8 distinct string changes, applied 12-14 times across two files.
- **One coordinated copy-only commit** can address all 16 findings in a single PR.
- **No visual / layout / color / font change required.**

This is the highest-leverage federal-credibility fix available without touching design — small commit, large credibility delta, ships before PSPC submission window.

---

## What Cowork can ship next without Ahmad gate

- **Pre-draft 3 alternative phrasings per new finding** (same shape as `aria-claim-fix-alternates-2026-06-16.md`). Ahmad picks one per finding in one read-through, Codex applies as one copy-only PR.
- **Cross-check `Growth Library` content pages** (`downloads/library/*-preview.html`) for the same patterns — they're the trust layer federal evaluators are most likely to look at when judging IIS's "responsible AI" posture.
- **Audit Federal Bid Supplement + past-performance attachments** for any RJ refs or autonomous-AI language that snuck in (AI-5 from action board).

## Stop rules

- No edits to public-facing HTML without Ahmad approval (visual-stability hard rule).
- No claim that conflicts can be ignored — they are real federal-evaluator risk.
- No promise that fixes preserve current "demo magic" appeal — federal credibility wins over demo flash for B2G buyers.

## One-line summary

> 11 new federal-evaluator conflicts found across `index.html` (5), `m.html` (6 incl. meta description), and propagated patterns. Combined with original audit: 16 total findings. Track A copy-only fix still recommended; net edit ≈ 8 distinct string changes across 2 files in one commit.
