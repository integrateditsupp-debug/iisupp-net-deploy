# ARIA Sentinel 0.1.4 Release Notes

Date: 2026-06-22  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.4 makes "Ask ARIA" behave like the website assistant: it answers from the knowledge base first (at $0, no LLM) and only calls the reasoning model for genuinely novel questions. It also fixes the earlier desktop bug where Ask ARIA returned a canned, Windows-only offline message. It remains a no-cost, unsigned Windows MVP — ready for local internal testing and demos, not yet broad enterprise deployment.

## What's new

- **KB-first answering (RUN 31).** Ask ARIA now queries the same pure-retrieval engine that powers iisupp.net/aria (203 KB chunks, no external API) BEFORE the reasoning model. A confident KB match (confidence ≥ 8) answers instantly at $0; only a no-match / low-confidence query falls through to the model. This means Sentinel keeps working even when model credits are exhausted — exactly like the website.
- **Ask ARIA wired to the shared brain (RUN 30).** Fixed the request/response contract so the desktop reaches the live assistant (previously every call failed and fell back to a hardcoded string). Sends the user's real platform so answers are OS-correct.
- **Full cross-platform scope (RUN 30).** ARIA now answers for Windows, macOS, iOS, iPadOS, Android, ChromeOS and Linux — never the old "Windows/browser/printer/network/BSOD" limited list. Offline, it answers from the bundled cross-platform KB pack with platform bias (an in-message "MacBook" / "iPhone" routes to that platform's guidance).

## Answer path (online → offline)

1. **aria-kb-query** — pure KB retrieval, $0. Used whenever it returns a confident match.
2. **aria-chat** — the reasoning model, only for novel queries the KB doesn't cover.
3. **Local KB pack** — bundled in the .exe; the last-resort answer when the device is fully offline.

## Safety Defaults

- The KB query and its response are path-scrubbed (🔒 R11): no filesystem path, no `Private pics and Vids` reference, no PII ever leaves or is shown.
- The brain client may reach only three iisupp.net paths (aria-kb-query, aria-chat, aria-research) — enforced by an explicit test.
- Manual mode keeps its dry-run preview safety; real execution (Confirmed/Autonomous) still requires the supervisor + 10-second countdown + Ctrl+Alt+K kill-switch.
- `SENTINEL_LICENSE_SECRET` stays server-side; the desktop verifies licenses via `sentinel-resolve`.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
