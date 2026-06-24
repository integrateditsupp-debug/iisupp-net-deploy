# ARIA Sentinel 0.1.6 Release Notes

Date: 2026-06-23  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.6 brings the full ARIA brain experience into the desktop. The headline is a redesigned ARIA Chat window that matches the iisupp.net/aria look, plus visible proof of the multi-tier answer chain (knowledge base first, Anthropic only as a last resort, local KB offline). It remains a no-cost, unsigned Windows MVP.

## What's new

- **ARIA Chat window redesign (RUN 33-0).** The chat window now matches the premium web /aria experience: a gold globe with **Integrated IT Support Inc.** centered at the top, an "ARIA Chat" subtitle, a centered chat dock, gold user bubbles vs neutral ARIA bubbles, animated "thinking" dots, and a roomier 480×720 size. When an answer comes from the knowledge base, a **KB article card** appears (title + tier chip + "Read full article ↗"). A status line and per-answer badge make the answer chain visible — "from the knowledge base · $0", "via Anthropic (novel question)", or "offline knowledge base" — so customers can see ARIA tries the free KB first and only falls back to the model when needed.
- **KB freshness in the top bar (RUN 33-A).** The top bar surfaces the live knowledge-base version + last-synced time pulled from the KB endpoint's freshness metadata.

## In progress (shipping across 0.1.6.x)

- **ARIA Core surfaces** (RUN 33 B–F) — a consolidated tab exposing what ARIA is learning, the live system-health / fall-through chain (with the locked "Anthropic is your last-resort safety net" banner), a local-only Memory/sessions viewer (R11-scrubbed), a setup wizard, and a read-only agent fleet monitor.

## Safety Defaults

- **The answer chain is locked:** knowledge base first ($0), then Anthropic only for novel questions, then the bundled local KB offline. Anthropic is never removed — it's the last-resort safety net.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat content and any session data are path-scrubbed. The chat window is sandboxed (no Node, no secrets).
- Manual mode keeps its dry-run preview; real execution (Confirmed/Autonomous) requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch (proven by the 3-mode harness).

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
