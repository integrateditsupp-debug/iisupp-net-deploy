# Cowork procedure — "Sentinel Test Case" capture (run AFTER profile+email feature ships)
Deliverable: a document "sentinel test case - YYYY-MM-DD - [issue].docx" with a screenshot at each step + an instruction line under each, the ARIA-tab transcript, and the two emails (company + user) with SLA metrics.

Steps:
1. Chrome → iisupp.net/aria. Ask ARIA an issue (e.g. "my Wi-Fi keeps dropping" or "set my Out of Office"). Screenshot.
2. ARIA offers "Resolve it for me" → click. Screenshot.
3. Modal → "Open with ARIA Sentinel" → deep-link opens the desktop app. Screenshot.
4. (computer-use) Sentinel first-run profile form → fill a test profile (test email we control). Screenshot.
5. Sentinel runs the recipe — backend/automated; capture the gate (approve + 10s countdown + restore point) + each backend step. Screenshots.
6. Outcome + ARIA-tab transcript (chat-style). Screenshot.
7. End the session → capture the TWO emails in Gmail: company report (same data as ARIA web) + user email (issue, solution, SLA speed). Screenshots.
8. Assemble the .docx: each screenshot + instruction beneath + the SLA metrics summary. Save dated; also usable as a sellable demo/setup artifact.
Honesty: capture REAL output only; if a step escalates instead of resolving, document that truthfully.
