# ARIA Web Live Test — 2026-06-24 (Cowork, computer-use)

Method: live test on https://iisupp.net/aria after Netlify redeploy `main@740ab84` (Anthropic key now set). Ticket ARIA-00000001, session 2861.

## Results
1. **Deploy + key = LIVE.** Redeploy without cache succeeded; 168 functions deployed. ARIA web loads and responds.
2. **Recipe path WORKS.** "My printer won't print and the print queue is stuck" → correct, detailed fix: stop Print Spooler → clear `C:\Windows\System32\spool\PRINTERS` → start spooler → test page, plus an escalation note. PASS.
3. **BUG — session locks to the first issue.** After the printer flow, "what is the difference between RAM and storage?" and "should I get 16GB or 32GB RAM for video editing?" BOTH got deflected back to "What is the printer doing?" with printer quick-replies. ARIA does not switch topics.
4. **BUG — CLEAR does not reset context.** Clicking CLEAR did not start a fresh conversation; the printer lock persisted.
5. **No generic "Resolve it for me" control.** Page search found no "resolve/fix it for me" button — only per-recipe quick-actions (Reset Password, VPN Diagnostic, Printer Queue). The web→Sentinel autonomous handoff Ahmad wants is NOT in production.
6. **LLM-for-general-questions = UNCONFIRMED.** Because of bug #3, novel questions never reached the LLM path; could not observe a free-form answer. The function deployed with the key, so the API likely works — must re-verify after the chat-logic fix.

## For Claude Code (priority)
- **Slice D (NEW, HIGH):** fix chat session logic — allow topic switches (don't lock to the first matched recipe), make CLEAR/END CHAT actually reset the session + context, and route non-recipe questions to the LLM. Then verify a free-form question (e.g., "16 vs 32GB RAM for video editing") returns a real LLM answer.
- **Slice C:** build "Resolve it for me" → open-with-ARIA-Sentinel deep-link (autonomous), with download fallback.

Re-run this script after the fix to confirm: topic-switch works, CLEAR resets, LLM answers a free-form question, and "Resolve it for me" appears + hands to Sentinel.

## RE-TEST after deploy b0ef4bf (2026-06-24, live)
Deployed main@b0ef4bf (merged web branch + rebuilt KB bundles, 280 articles). Web tester 7 PASS / 0 FAIL.
- PASS: deploy live; cross-load topic stickiness fixed; NEW CHAT button present; self-update modal works.
- FAIL (DoD #2): in-session topic-bleed (VPN->RAM got "What is the VPN doing?"); NEW CHAT no reset; aria-chat (LLM) never called for free-form questions (network-verified). -> Slice D Round 2.
- PENDING (need installed Sentinel build): Office recipe end-to-end, "Open with ARIA Sentinel" deep-link, Slice B live execution, Recipes tab finder.
