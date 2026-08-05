
| 2026-07-28 | goal-alignment | 27 agent YAMLs: `kpis:`/`tools_allowed:` values swapped — permission allowlist unusable | Ahmad review → Codex one-pass key swap | open |

| 2026-07-28 | goal-alignment | 27x loops/agents/*.yaml | kpis:/tools_allowed: block bodies swapped — capability allow-list unenforceable across full agent org chart. Blocks promotion of any agent loop out of `planned`. Mechanical fix, safe to script. | OPEN |
| 2026-07-28 | goal-alignment | .git/index.lock | 0-byte stale lock (07-28T02:55, ~12h). Same signature as 07-17 freeze. Sandbox cannot unlink — Ahmad delete locally or next write burst stalls. | OPEN |

| 2026-07-29 | goal-alignment | P2 | **All 27 agent YAMLs have `kpis:` and `tools_allowed:` block bodies swapped** — `kpis:` holds the tool list, `tools_allowed:` holds the KPI sentence. Systemic template bug, not 27 typos. Any executor gating tool access on `tools_allowed` reads prose. All 27 are `status: planned` so nothing runs on it yet — fix before the first agent activates. Needs Ahmad/Codex approval (edits loop YAMLs, outside goal-alignment's write scope). |
| 2026-07-29 | goal-alignment | P3 | **demand-gen mandate names no sub-goal** — Hunter class reporting to CMO, but mandate text never references leads, outbound, replies, or pipeline. Recommend rewriting to name sub-goal 3 (50+ outbound qualified replies/month). |
| 2026-07-29 | goal-alignment | P3 | **Schema drift: `loops/agents/*.yaml` use `mandate:`, `loops/*.yaml` use `goal:`** — LOOPS_SPEC §8g documents only `goal:`. Update the spec to declare `mandate:` the agent-tier synonym. |
| 2026-07-29 | goal-alignment | P3 | **This auditor cannot fail** — the `serves: top-goal` check passes trivially for all 35 loops and has returned 35/35 every run. Recommend promoting the strict goal-prose test to primary in the next LOOPS_SPEC revision. |

| 2026-08-04 | goal-alignment | P1 | 27 agent yamls under `loops/agents/` have `kpis:` and `tools_allowed:` contents swapped — permission gating will misread. Mechanical fix. | Ahmad/Codex | open |
| 2026-08-04 | goal-alignment | P2 | `loops/goal-alignment.yaml` reads `goal:` only; all 27 agent loops use `mandate:`. Spec should accept either key. | Ahmad/Codex | open |
| 2026-08-04 | goal-alignment | P3 | 18 non-infra loops pass alignment only via `serves: top-goal` — mandate text names no sub-goal. Tighten wording. | Ahmad | open |
