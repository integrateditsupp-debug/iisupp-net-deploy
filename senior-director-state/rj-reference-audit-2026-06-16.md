# Raymond James Reference Audit — 2026-06-16

**Owner:** Claude Cowork.
**Rule audited:** HARD RULE — "No Raymond James involvement" (per `project_codex_collab_brief` memory + standing IIS / ARIA rules).
**Scope:** every text file across `senior-director-state/`, `outputs/`, capability statements, federal bid supplements, past-performance docs, capture work.
**Why:** Sourcewell draft + Lot 2 portal entry already breached this rule (documented in `sourcewell-rfp061726-no-bid-recommendation-2026-06-16.md`). Need to confirm the same leak hasn't propagated into PSPC, OSFI, or DND materials.

---

## Result

**Active federal bid pipeline is CLEAN.** Contamination is contained to drafted/capture materials that are not currently feeding any submitted bid.

### CLEAN — safe to use in federal bid submissions

| File | Status |
|---|---|
| `senior-director-state/iis-federal-bid-supplement-2026-06-16.md` | ✅ Clean |
| `senior-director-state/iis-public-safe-capability-statement-2026-06-06.md` | ✅ Clean |
| `senior-director-state/bid-briefs/aria-platform-one-pager-2026-06-16.md` | ✅ Clean |
| `senior-director-state/bid-briefs/ahmad-wasee-cv-1page-federal-2026-06-16.md` | ✅ Clean (RJ only in "intentionally excluded" footer) |
| `senior-director-state/bid-briefs/past-performance-FILLED-2026-06-16.md` | ✅ Clean (RJ only in "excluded per rule" annotation) |
| `senior-director-state/bid-briefs/osfi-cover-letter-shell-2026-06-16.md` | ✅ Clean (RJ only in instructions to NOT name) |
| `senior-director-state/bid-briefs/pspc-ai-source-list-skeleton-2026-06-16.md` | ✅ Clean |
| `senior-director-state/bid-briefs/pspc-ai-source-list-cover-letter-and-methodology-2026-06-16.md` | ✅ Clean |
| `senior-director-state/capture/2026-06-04-first-three/iis-it-support-courseware-capability-statement.md` | ✅ Clean |

**This means PSPC AI Source List + OSFI Ransomware Tabletop + any DND subcontract response can be assembled from the CLEAN set without rule violation.**

---

## CONTAMINATED — must not be used verbatim in any submission

These are draft / capture / planning materials. All contain RJ references. None of them are CURRENTLY in a submission pipeline, but any agent (Codex, Claude Code, Cowork) that grabs them as source-of-truth would re-introduce the breach.

| # | File | Line(s) | Risk if used |
|---|---|---|---|
| C1 | `senior-director-state/capture/2026-06-04-first-three/iis-ai-enablement-capability-statement.md` | 40 | HIGH — this is a "capability statement" file. If pulled into a bid attachment by name confusion with `iis-public-safe-capability-statement-2026-06-06.md`, it leaks. |
| C2 | `senior-director-state/capture/2026-06-04-first-three/ahmad-procurement-cv-for-merx.md` | 30 | HIGH — this is a CV intended for federal procurement. Superseded by clean `ahmad-wasee-cv-1page-federal-2026-06-16.md` but still on disk. |
| C3 | `senior-director-state/capture/2026-06-04-first-three/bid-win-readiness-boost-plan.md` | 67, 145 | MEDIUM — planning doc, not a submission artifact. Risk if quoted. |
| C4 | `senior-director-state/capture/2026-06-04-first-three/sourcewell-rfp061726-bid-workplan.md` | 37 | LOW — Sourcewell pursuit being no-bid. Workplan irrelevant once archived. |
| C5 | `senior-director-state/capture/2026-06-04-first-three/sourcewell-rfp061726-compliance-matrix.md` | 62, 63 | LOW — same context. |
| C6 | `senior-director-state/capture/2026-06-04-first-three/sourcewell-rfp061726-portal-status-and-evidence-needed.md` | 14 | LOW — historical record of the breached portal state. |
| C7 | `senior-director-state/capture/2026-06-04-first-three/sourcewell-rfp061726-submission-checklist.md` | 54 | LOW — same context. |
| C8 | `senior-director-state/capture/2026-06-05-breakfast-work-block.md` | 65 | MEDIUM — daily-planning doc, references RJ as evidence source. |
| C9 | `senior-director-state/capture/ahmad-resume-extracted-2026-06-05.txt` | 6, 28 | SOURCE DATA — this is the raw resume text. Should not be edited; should be flagged with header note. |

---

## Cowork-recommended actions

### Action 1 (immediate, zero-risk) — Add a top-of-file warning to source-data files

For C9 (`ahmad-resume-extracted-2026-06-05.txt`): add a header note marking it as raw-input, NOT to be used verbatim in any federal bid material. Source data must stay as captured, but the warning prevents future agents from copying it forward into a bid response.

Suggested header (would be added in a follow-up commit after Ahmad approves):
```
[Source-data only. Contains Raymond James references. DO NOT use verbatim in any federal
bid, capability statement, CV, or public-facing document. Filtered, RJ-excluded versions
live in senior-director-state/bid-briefs/.]
```

### Action 2 (immediate, zero-risk) — Archive superseded contaminated CVs and capability statements

- Move C1 (`iis-ai-enablement-capability-statement.md`) → `senior-director-state/archives/superseded-rj-contaminated/`
- Move C2 (`ahmad-procurement-cv-for-merx.md`) → same folder
- Move C8 (`capture-2026-06-05-breakfast-work-block.md`) header-only annotation

These were superseded by clean rebuilds on 2026-06-16. Keeping them at original path invites accidental reuse.

### Action 3 (after Sourcewell decision) — Archive the Sourcewell capture folder

Once Ahmad confirms Sourcewell no-bid, move the entire `senior-director-state/capture/2026-06-04-first-three/sourcewell-rfp061726-*` set to `archives/sourcewell-2026-06-no-bid/`. C4–C7 cleared in one move.

### Action 4 (Cowork standing pattern) — Flag in every future RJ scan

This audit pattern (`grep -rn -i "raymond" senior-director-state/ outputs/`) becomes a Cowork standing check before any federal bid submission. Add to `feedback_verify_before_asking` memory pattern.

---

## Risk if no action taken

Active bids are clean today. The risk is **future drift** — any agent that pulls "ahmad-procurement-cv-for-merx.md" because the filename looks federal-bid-relevant will breach the rule. Action 1 + Action 2 close that path.

## Stop rules

- No file moves performed in this audit (Action 2/3 are recommendations).
- No edits to the source-data resume file (Action 1 is a recommendation with suggested header text — Ahmad approves before applied).
- No bid submission triggered by this audit.

## One-line summary

> Federal bid pipeline (PSPC, OSFI, DND-subcontract) is RJ-clean. Contamination contained to 9 capture/draft files that are not currently feeding any active submission. Three small moves close the future-drift risk before PSPC submission window.
