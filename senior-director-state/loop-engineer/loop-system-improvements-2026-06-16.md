# Loop System Improvements — 2026-06-16

**Owner:** Cowork (strategy lane).
**Trigger:** PACKET B (phased response) was queued 2026-05-14 and still unshipped on 2026-06-16 — **33 days idle**. The loop system has no alarm for aging packets, so it took a human-eye critique to surface it. That's a failure of the operating engine, not the packet author.

The same loop system is supposed to make IIS / ARIA "several steps ahead." If packets sit for a month, we're behind, not ahead.

---

## Diagnosis — why PACKET B sat 33 days

1. **No packet age field.** `claude-code-next-prompt.md` lists packets by spec, not by when they entered the queue. Nothing tells the next reader "this has been here a month."
2. **No status tracking inside the file.** A packet is either "in the file" or removed. There's no `queued / in-progress / blocked / shipped` field, so a packet that was started, hit a snag, and got abandoned looks identical to a freshly-queued one.
3. **No results-loop trip.** `claude-code-next-prompt.md` says results go in `claude-code-results-<YYYY-MM-DD>.md` — but no such file exists for PACKET B because nobody started it. There's no alarm when a packet was queued but no matching result file ever appeared.
4. **Codex hiatus.** Codex was offline 2026-06-14 → 06-17. Claude Code was supposed to take over (per `feedback_codex_offline_route_claude_code.md`) but wasn't woken with explicit packet ownership.
5. **The critique cadence wasn't strict.** Loop board says claude-strategy-loop re-runs each tick, but there's no enforced tick interval. The 05-14 critique just sat.

## Three concrete fixes (low cost, ship today)

### Fix 1 — Packet age + status header on every claude-code-next-prompt packet

Standard format for every packet block going forward:

```
### PACKET X — <title>

| Field | Value |
|---|---|
| Queued | YYYY-MM-DD |
| Owner | Codex / Claude Code / (unassigned) |
| Status | queued / in-progress / blocked / shipped / abandoned |
| Last touched | YYYY-MM-DD |
| Result file | claude-code-results-<date>.md or "—" |

**Spec:** ...
```

When `Last touched > Queued + 7 days` and Status is still `queued`, the packet is "stale" and surfaces in the next critique.

Cost: a 5-line table per packet. Zero engineering.

### Fix 2 — `loops/packet-watcher.mjs` (next session, not now)

A tiny script that:
- Reads `senior-director-state/loop-engineer/claude-code-next-prompt.md` and the parallel Codex file.
- Parses the YAML/table header of each packet.
- Flags any packet where `Status = queued` and `Last touched < today - 7 days`.
- Writes `senior-director-state/loop-engineer/stale-packets.md` (empty if none).
- Future: prepended to the loop-board "Next Recommended Order" section automatically.

**Spec:** Cowork drafts in this file (below). Codex builds when free.

### Fix 3 — Critique cadence rule (codified now)

Add to `docs/LOOP-ENGINEER.md`:

> The `claude-strategy-loop` MUST re-critique whenever any of these conditions hold:
>
> 1. The last critique is more than 7 days old AND any packet from it is unshipped.
> 2. `loop-board.md` is touched (any field updated).
> 3. `claude-next-prompt.md` is touched (any field updated).
> 4. A packet's `Status` field changes to `blocked` or `abandoned`.
>
> The critique writes to `senior-director-state/loop-engineer/claude-critique-<YYYY-MM-DD>.md` and updates `loop-board.md` "Next Recommended Order".

This converts the strategy loop from "vibes-based" to "trigger-based."

---

## Packet-watcher mini-spec (for Codex when free)

**File:** `loops/packet-watcher.mjs`

**Inputs:**
- `senior-director-state/loop-engineer/claude-code-next-prompt.md`
- `senior-director-state/loop-engineer/codex-next-prompt.md`
- Current date.

**Output:** `senior-director-state/loop-engineer/stale-packets.md`

**Algorithm:**
1. Read both prompt files. For each `### PACKET` heading, parse the table header (fields above).
2. Compute age = today − Queued. Compute idle = today − Last touched.
3. A packet is stale if `Status === 'queued'` AND `idle >= 7 days`. Or if `Status === 'in-progress'` AND `idle >= 14 days`.
4. Write a table to `stale-packets.md`: packet ID, file, age, idle, status, recommended action.
5. Empty output if no stale packets — file still updated with a timestamp + "no stale packets" line, so we can prove the watcher ran.

**No external dependencies.** Pure Node fs + a small markdown parser.

**Verification before shipping:**
- Run against current state of `claude-code-next-prompt.md`. Should flag PACKET A as stale (queued 2026-05-14, idle 33 days). PACKET B is now in the new critique queue, so should NOT show (resets the clock).

**Stop rule:** read-only. Never modifies prompt files or packets.

## Memory note to save next tick

A new feedback memory: "Every queued packet gets a Queued/Status/Last-touched header — stale packets are surfaced automatically." Reference: this file.

## Single-line summary

> The loop engine can generate but can't yet detect stagnation. Three fixes: header standard on every packet (now), critique cadence rule in LOOP-ENGINEER.md (now), and a small packet-watcher script (next Codex session). Cost: zero. Stops the next 33-day silent failure.
