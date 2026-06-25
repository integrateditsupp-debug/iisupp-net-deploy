# ARIA Sentinel — QA Program
Independent, evidence-based QA. Every number is from a real test run on a named commit — nothing estimated or carried over. Built to withstand enterprise/government procurement review.

## Contents
- `ARIA-Sentinel-QA-Report-<date>.md` — master report (Stage 1: automated + grounding; Stage 2 live pending).
- `coverage-matrix.md` — every scenario category x 3 modes: pass / fail / not-tested.
- `raw/` — raw, unedited test logs (evidence behind every figure).

## Legend
- PASS = ran, all green. WARN = passed with a finding. PENDING = not yet run (never a pass).
- Bugs ranked Critical / High / Medium / Low with repro steps. "Client-ready" = one blunt yes/no + shortest must-fix list.

## Stage status
- Stage 1 (commit 31c8872): automated suites + code grounding — DONE.
- Stage 2: live on-device pass (L1/L2/L3 x 3 modes) + online probes + classifier re-baseline — IN PROGRESS.
