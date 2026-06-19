> **STANDING:** Apply Round Velocity Playbook at `senior-director-state/loop-engineer/ROUND_VELOCITY_PLAYBOOK.md` -- 4-5 shippables per Round, single push. LOCKED 2026-06-18 by Ahmad.

# CLAUDE CODE — NEXT PROMPT
**Mission file · 2026-06-17 · target: 100% coverage of the ARIA SaaS Scenario Universe**

**★ CROSS-AGENT HANDOFF 2026-06-17:** read `senior-director-state/cross-agent-handoff-2026-06-17.md` BEFORE anything else. 10 standing rules apply.

You are Claude Code working on Integrated IT Support Inc. (iisupp.net + ARIA SaaS). You operate via the local repo at `C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy`. Read all standing rules first (Rule 1 below).

---

## RULE 0 — READ THESE FIRST EVERY RUN

1. `senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md` (8 standing rules, source of truth)
2. `CLAUDE.md` (project instructions)
3. The memory index in `MEMORY.md` and at minimum these specific memories:
   - `feedback_spend_cap_20_70_per_month.md` (LOCKED — $20-70/mo cap, ASK FIRST)
   - `feedback_smart_qualifier_not_hard_skip.md` (workarounds before skip)
   - `feedback_ship_now_no_tomorrow.md` (no deferrals; use scheduled tasks for offline)
   - `feedback_aperture_aria_never_break.md` (verify after every push)
   - `feedback_preview_before_push.md` (structural visual changes need mockup approval)
   - `feedback_no_moneyback_guarantee.md` (no refund language on iisupp.net)
   - `reference_ahmad_resume_facts.md` (15+ yrs only, real certs only, RJ hard rule)
   - `project_no_testimonial_proof_playbook.md`

If any rule is unclear, STOP and ask in the response file. Do not violate a rule even if it appears to block velocity.

---

## RULE 1 — THE MISSION

The shared scenario universe lives at:
`outputs/aria-saas-scenario-universe-2026-06-17.md` (or `local_442f5d4e-.../outputs/...` from Cowork's deliverable folder)

It defines **~418 scenarios across 25 categories** with current ARIA status (✅ live · ⚠️ partial · ❌ gap) and priority.

**Your goal: drive total coverage from ~30% toward 100%.**

Codex is running the same mission in parallel. You two split work by ownership — see Rule 3.

---

## RULE 2 — SCOPE OWNERSHIP (CLAUDE CODE)

Claude Code, you OWN these categories from the universe (the parts that need engineering depth in the local repo):

| Owned by Claude Code | Categories |
|---|---|
| Engineering implementation in iisupp.net + assets | 1.1-1.4 (L1-L3 + Cyber support flows), 3 (AI/chat behavior), 9 (edge cases), 13 (failure modes) |
| Local KB expansion | 1.x, 3.x — wiring real KB articles into `assets/aria-core.js` paths |
| Backend / Netlify functions | 6 (integrations — Stripe, email, future M365), 7 (performance + uptime), 23 (autonomous + MCP), 25 (cost tracking) |
| Test harness | 24 (AI safety — extend the 1,345 test scenarios) |

You DO NOT touch:
- Marketing copy / landing pages (Codex)
- Hero/visual structural changes without preview approval (any agent)
- Production deploys without tail-integrity check + ARIA-never-breaks verification

---

## RULE 3 — COORDINATION WITH CODEX

Codex queue lives at: `senior-director-state/codex-claude-queue.md`
Your in-progress packet log: `senior-director-state/loop-engineer/claude-code-in-progress.md` (create if missing)

Both you and Codex:
- Write tasks you START to your own in-progress file
- Mark complete with commit hash
- If you see Codex working on the same scenario, back off — pick the next unowned high-priority scenario

Conflict resolution: whoever started first owns it. Drop the other.

---

## RULE 4 — WORK LOOP (REPEAT)

Each batch (target: 30-60 min wall time):

1. **PICK** — open the scenario universe, find the next ❌-gap scenario in YOUR ownership categories ranked by priority. Skip anything Codex is mid-work on.
2. **PLAN** — write a 3-line plan to in-progress file: scenario · approach · files to touch
3. **SHIP** — implement. Tail-integrity check before every HTML write. Verify ARIA + Aperture didn't regress.
4. **COMMIT** — Garry Tan format commit message (Founder diagnosis / Product decision / Engineering changes / Revenue path / Deployment notes / Next best action)
5. **PUSH** to `origin/main` (Netlify auto-deploys)
6. **UPDATE** — flip scenario from ❌ to ✅ (or ⚠️ if partial) in the universe file. Note commit hash.
7. **REPORT** — append to in-progress log: scenario shipped + commit hash + any spend asks (always ask first per Rule 1) + open questions

Repeat until your machine session ends OR you hit a spend ask that needs Ahmad approval.

---

## RULE 5 — TOP 10 PRIORITY ORDER (start here)

From the revised post-addendum Top 10:

1. **Tool calling (MCP) for direct M365/Azure actions** (cat 23) — 10× value, advisor → operator
2. **Per-tenant KB + tenant isolation** (cat 12+21) — enterprise tier unlock
3. **Embeddable chat widget + Teams/Slack apps** (cat 19+6) — distribution multiplier
4. **Microsoft Cloud Partner program prep** (cat 17) — co-sell pipeline (DOCS only, no spend)
5. **Failed payment dunning + renewal reminders** (cat 16+22)
6. **Lead capture from chat + calendar booking** (cat 15)
7. **LLM cost tracking + Haiku/Opus routing** (cat 25) — margin improvement
8. **Hallucination scoring + confidence calibration** (cat 24+3)
9. **Multi-step workflow execution with approval gates** (cat 23)
10. **Comparison pages vs competitors** (cat 14) — Codex's domain, skip

Of YOUR owned categories, start with #1 (MCP tool calling) and #7 (cost tracking).

---

## RULE 6 — DELIVERABLE FORMAT (every commit)

```
## BATCH N (commit HASH)

### Founder-level diagnosis
[what was unclear/broken/missing]

### Product decision
[what shipped + why — tied to revenue/conversion/clarity]

### Engineering changes
- file/path — exact purpose
- another/file — exact purpose

### Revenue path
[how this moves closer to a paid contract]

### Deployment notes
[Netlify env vars, function deploys, etc.]

### Coverage delta
- scenario X: ❌ → ✅
- scenario Y: ⚠️ → ✅
- new total: NN/418 (NN%)

### Next best action
[single ranked-highest follow-up]
```

---

## RULE 7 — SPEND ASKS

Per Rule 1 + the spend cap rule, ANY new spend goes to Ahmad first. Format:

```
## SPEND ASK
- Item: [name]
- Cost: [$ + recurrence]
- Unlocks: [specific scenario + revenue tied to it]
- Alternative: [free workaround if any]
- Recommendation: [yes/no with reasoning]
- Decision needed by: [date]
```

Drop this in `senior-director-state/spend-asks-pending.md` and STOP work on that scenario until approved.

---

## RULE 8 — SESSION END

When session ends (machine off / explicit stop):

1. Final commit + push
2. Append session summary to `senior-director-state/claude-code-session-YYYY-MM-DD.md` with: batches shipped, commits, coverage delta, open questions, top 3 next-session priorities
3. Update `senior-director-state/codex-claude-queue.md` so Codex sees what you did

---

## RULE 9 — IF YOU SEE A RULE 8 VIOLATION (ARIA or Aperture break)

DROP everything. Hotfix first. Then resume.

---

## RULE 10 — START NOW

Open the universe file. Pick scenario #1 in your owned categories (MCP tool calling for M365 actions). Start with a 30-day MVP scope — read-only first (list users, check license, query Azure AD), action-write later with explicit approval gates. Push first batch within the first hour.

No "I'll review and get back." Just ship.

Ahmad reads every commit.

---

## 2026-06-18 — RULE 9 LOCKED — every detail perfect, limit the count

Ahmad's words: *"every detail in our business perfect, limit the number of details. Have that mindset as we continue and to anything we already have done."*

Action for this agent on next pickup:
1. Read `senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md` §RULE 9
2. STOP adding new customer-facing pages from FINISH-100 packet
3. Pivot to polish + prune of existing surfaces
4. Wait for `outputs/surface-audit-2026-06-18.md` (Cowork will publish) — pick keep/merge/kill targets from there
5. Backend functions / crons / scripts still fair game — keep shipping
6. Tail-integrity + visual-stability checks remain mandatory

Memory file: `feedback_perfect_details_limit_count.md`

---

## 2026-06-19 — RULE 10 LOCKED — shortest path first

Before any task: pick the SHORTEST code path that delivers the actual outcome.
- Bake non-secret config in code with env-var override
- One commit beats a setup script
- Don't ask Ahmad to run scripts when a code edit works
- Real secrets stay env vars; everything else: question the indirection

Memory: `feedback_shortest_path_first.md`. Standing-rules: §RULE 10.
