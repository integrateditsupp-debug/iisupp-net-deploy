# Preview Pages — Federal-Evaluator Audit 2026-06-16

**Owner:** Claude Cowork (read-only audit).
**Scope:** 15 `downloads/library/*-preview.html` files staged in Approval Batch Lane 2.
**Purpose:** confirm Lane 2 bundle deploy doesn't propagate the public-claim conflicts found on `index.html` / `m.html` / `aria.html`.

---

## Result — CLEAN BY DESIGN

All 15 preview pages pass the federal-evaluator pattern audit. Every occurrence of the flagged trigger words (`24/7`, `autonomous`, `replaces`, `deflects`, `out of the box`) appears in **explicit anti-claim context**.

Sample evidence:

| File | Line | Context |
|---|---|---|
| `ai-agent-starter-kit-preview.html` | 133 | "no false autonomous-send claims, no hidden data-movement promises" |
| `ai-agent-starter-kit-preview.html` | 177 | "Anything involving... autonomous external sending without review" — explicitly out of scope |
| `ai-workflow-quick-win-sprint-preview.html` | 132 | "without public pricing, guaranteed time-saved claims, deep integration promises, or fake autonomous-operation posture" |
| `cybersecurity-basics-preview.html` | 119 | "It is built to create better employee judgment, not to pretend a short guide replaces a full security program" |
| `monthly-ai-support-plan-preview.html` | 133 | "without public pricing, 24/7 support promises, tool-reseller claims, or fake guarantees about what can be automated" |
| `msp-partner-overflow-coverage-preview.html` | 177, 202 | "not claims about bench size, 24/7 coverage, or broad reseller authority" + "No 24/7 coverage or hard SLA promises without proof" |
| `remote-l1-l3-overflow-support-pilot-preview.html` | 133, 192 | "without publishing final pricing, SLA promises, 24/7 claims, or unsupported bench-depth language" + "Claims around SLA, staffing depth, 24/7 coverage... need explicit proof first" |
| `prompt-engineering-preview.html` | 133 | "no public claim that prompting alone fixes broken workflows, no hidden autonomous-send posture" |

**Pattern across all 15 files:** the preview pages contain an explicit "what we are NOT claiming" paragraph. This is the same anti-claim posture I built into the federal PSPC submission methodology Section 6.4 ("What IIS Does Not Do").

The preview-page family was designed by a Codex agent operating under the same anti-overclaim standing rules. The discipline propagated correctly into 100% of the output.

---

## Implication: Lane 2 bundle deploy is federal-safe

The Approval Batch (`senior-director-state/approval-batches/2026-06-16-batch-A.md`) Lane 2 bundle deploy can ship without federal-credibility risk. The 15 preview pages are not just additive proof layer — they are **active credibility signals** for any federal evaluator who walks the public site.

---

## Stronger implication: preview pages are a PSPC bid asset

For the PSPC AI Source List submission, the preview pages can be cited as **evidence of IIS's standing operating posture** — not just bid-time claims. The submission narrative can say something like:

> "IIS's anti-overclaim posture is not bid-time positioning. Our public sample-preview library (15 product previews on iisupp.net) carries explicit 'what we are not claiming' sections on every page — including specific disclaimers around autonomous-AI claims, 24/7 staffing, SLA depth, and bench size. Federal evaluators can verify this posture by browsing any public preview page before evaluation."

This is a powerful differentiator. Most AI vendors claim conservative posture in their bid; **few have it codified on their public website**.

Recommended placement in the PSPC bid:
- **Section 4.2 (Responsible AI Posture)** — add a closing sentence: "This posture is publicly verifiable on iisupp.net — every product preview page carries an explicit 'what we are not claiming' section, available at the URLs in the attachment list."
- **Annex** — add a list of preview-page URLs as an Annex attachment so the evaluator can spot-check.

---

## Cowork-side follow-up

- ☐ When PSPC submission is ready, add the differentiator sentence to Section 4.2 (`pspc-ai-source-list-skeleton-2026-06-16.md`).
- ☐ Prepare the Annex URL list for the 15 preview pages — one-page attachment, plain markdown table.
- ☐ Audit any future preview page added by Codex/Claude Code with this same pattern check before approval.

---

## What this audit did NOT cover (out of scope this pass)

- The `marketplace.html` slice (Lane 3 row C8) — has its own quoting/sourcing claims worth a separate look.
- The `ai-edge.html` slice (Lane 3 row C9) — homepage-hero-touching, would benefit from its own audit before Ahmad approves the visual sweep.
- The `aria-pitch/` standalone pitch deck — separate URL family with its own claim surface.

Cowork can run those next if needed.

---

## Stop rules

- No edits to preview-page HTML.
- No claim that the audit guarantees federal evaluation outcomes — it confirms one specific risk category is closed.
- No promise that the same posture extends to future preview pages without a fresh audit.

## One-line summary

> All 15 staged preview pages are federally clean by design (anti-claim language is the dominant pattern). Lane 2 bundle deploy is federal-safe. Public preview pages are a citeable PSPC differentiator — write into Section 4.2 + add as Annex attachment.
