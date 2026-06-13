# Loop Engineer

Updated: 2026-06-13

Purpose: manage `/goal`, `/loops`, and loops that prompt other loops for IIS / ARIA without routine Ahmad involvement.

This is the coordination layer above Codex, Claude Cowork, ARIA, Trend Radar, Growth Library, and revenue agents. It does not perform risky external actions. It decides the next safe loop turn, writes the next prompts, and stops at CEO final-action gates.

## Core Idea

Ahmad's operating style should be multiplied by structured loops:

```text
goal -> loops -> loop packets -> agent prompts -> local outputs -> review gates -> next loop
```

The system should always ask:

- What is the goal?
- Which loop owns the next useful move?
- What evidence already exists?
- What can be advanced safely without Ahmad?
- What needs Claude strategy critique?
- What needs Codex implementation?
- What requires Ahmad final action?

## Commands

`/goal`

- Defines the main business outcome.
- Example: "Build IIS / ARIA into a trend-to-trust-to-transformation engine that creates revenue assets from long-life demand."

`/loops`

- Lists active loops, owners, priority, inputs, outputs, next prompt, and blockers.

`/loop <id>`

- Opens one loop packet.
- Shows objective, current evidence, next safe action, approval gates, and next prompt.

`/loop-prompt claude`

- Produces the next Claude Cowork prompt.

`/loop-prompt codex`

- Produces the next Codex implementation prompt.

## Default Loops

1. `trend-radar-loop`: finds long-life demand, scores it, creates review-gated trend assets.
2. `product-pack-loop`: turns high-fit trends into Growth Library products, guides, templates, demos, and pricing drafts.
3. `aria-behavior-loop`: improves ARIA's response quality, support reasoning, phased interaction, and KB intake.
4. `website-conversion-loop`: improves top-of-funnel, product pages, demos, and checkout readiness without risky publish.
5. `revenue-opportunity-loop`: prepares supplier, bid, lead, outreach, and CEO final-action packets.
6. `qa-safety-loop`: checks claims, pricing, Stripe, privacy, platform rules, and approval gates.
7. `claude-strategy-loop`: asks Claude Cowork to critique strategy, positioning, product quality, and next prompts.
8. `codex-build-loop`: turns approved or safe loop packets into local files, scripts, pages, tests, and handoff notes.

## Loop Rules

- Every loop must have an owner, objective, evidence, next safe action, approval gates, risks, and output files.
- Loops can prompt other loops, but cannot bypass approval gates.
- No loop may send, submit, publish risky production changes, create accounts, pay, buy, subscribe, delete, certify, sign, or make public high-risk claims without Ahmad.
- Loops should prefer local files, drafts, previews, review queues, and checklists.
- Loops should use `docs/COLLAB_BRIEF.md` as the shared source.

## Local Implementation

Starter script:

```bash
node scripts/loop-engineer.mjs
```

Local outputs:

- `senior-director-state/loop-engineer/goals.json`
- `senior-director-state/loop-engineer/loops.json`
- `senior-director-state/loop-engineer/loop-board.md`
- `senior-director-state/loop-engineer/claude-next-prompt.md`
- `senior-director-state/loop-engineer/codex-next-prompt.md`
- `senior-director-state/loop-engineer/loop-packets.jsonl`
- `senior-director-state/loop-engineer/supervisor-state.json`

## Current Reality

The loop protocol can now be generated locally. True hands-free Codex/Claude execution still needs an authenticated local bridge that can start available agent sessions. Until that exists, each Codex or Claude session should read the loop board and act as the next loop turn.
