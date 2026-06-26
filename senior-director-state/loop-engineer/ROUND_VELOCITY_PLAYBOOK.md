# Round Velocity Playbook
**LOCKED 2026-06-18 by Ahmad · Pass to all agents · Source of truth for category-coverage Rounds**

## Mission
Ship 4–5 category lifts per Round. Single push. Single status report. <5 min wall time.

## The 10 leverage moves (memorize this)

1. **Heredoc via bash, never Edit/Write tool for JS/HTML > 100 lines** — file tools truncate
2. **`node --check` immediately after every JS write** — catches syntax in <100ms
3. **Use existing `/tmp/iisupp-push-cowork` clone** — fresh `git clone` fails on PAT auth
4. **One bash call per shippable** — mkdir + write + check + test, all together
5. **Inline `node -e` smoke tests** — no jest/mocha, no test files
6. **Batch 3–5 shippables per push** — one commit, one report
7. **Read 1 line of existing files, write whole new** — heredoc replacement
8. **Bullets in commit messages, not paragraphs** — 5 lines max
9. **Update `tests/run-stats.json` in same push** — no separate stats Round
10. **Status report to Ahmad = table only** — 5 rows, total, sources, "Going."

## The Round template

```
1. TaskCreate "Round N: <4-5 cat themes>"
2. TaskUpdate in_progress
3. Bash call A: write all files + node --check each + smoke test
4. Bash call B: cp to /tmp/iisupp-push-cowork + git add + commit + push
5. TaskUpdate completed
6. Status table to Ahmad: 5 rows + total + Going.
```

## Anti-patterns — DO NOT

- Edit tool on JS/HTML files >100 lines
- Fresh git clone per push
- Multiple bash calls when one would do
- Long commit messages or status reports
- Writing test files for one-off backend functions
- Touching iisupp.net frontend pages without preview-before-push approval

## When things break

- **PAT expired:** grep `/tmp/iisupp-push-cowork/.git/config` for token, save to `~/.cowork-github-pat`
- **Git index lock:** push from `/tmp/iisupp-push-cowork`, not mounted repo
- **File truncation:** heredoc bash + `tail -c 100 file && wc -l file` to verify
- **node --check fails:** simpler quotes (no nested escaped quotes in template strings)

## Frontend HTML rule

For NEW standalone HTML pages: ship direct. For EXISTING iisupp.net pages: preview-before-push.

## Director's job (senior-director-agent)

When idle, the Director MUST:
1. Read `tests/run-stats.json` — find the 4-5 categories with lowest coverage %
2. Spawn a Round task: `TaskCreate "Round N: <themes>"`
3. Delegate to an idle agent OR execute itself
4. Audit commit: tail-integrity (HTML), node --check (JS), stats updated, no frontend touched
5. Update `loops/registry.json` with weighted-coverage delta
6. Surface plateau (no lift in last 3 Rounds) to Ahmad's morning brief

## Coverage tracking

Source of truth: `tests/run-stats.json` keys `round_N.categories_lifted` and `last_round`.

Weighted coverage = `sum(category_pct * category_weight) / sum(category_weight)`.
Default weight = 1.0. Higher-revenue categories (Cat 2 SaaS lifecycle, Cat 5 Account, Cat 14 Marketing) get weight 1.5.

## Standing handoff to all agents

Any agent picking up code work in this repo should:
- Read this file FIRST
- Read [[playbook-round-velocity]] in Claude's memory if available
- Apply the 10 moves
- Never re-invent the pattern

Related files:
- `senior-director-state/codex-claude-collaboration-loop.md`
- `senior-director-state/loop-engineer/loop-board.md`
- `docs/COLLAB_BRIEF.md`
- `tests/run-stats.json`
