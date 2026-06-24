# RUN 16 §0 — Live-globe icon swap results (2026-06-19)
**Suites:** tests/live-globe-icons.test.mjs + tests/icon-pipeline.test.mjs · **Status:** APPLIED (Ahmad approved)
- In-app: settings header (.brand-globe), footer (.aria-living-globe), and ServiceNow chip (.mini-globe) now render the live iisupp.net/aria globe via img src="aria-live-globe.svg".
- Extensions: Chrome · Edge · Safari toolbar icons (i-16/32/128.png) rasterized from the live globe via headless Chrome → a dependency-free PNG downscaler. Safari's previously-malformed 41×226 icons fixed.
- Kept unchanged (Ahmad's instruction): the floating overlay crystal-A avatar, and build/icon.ico.
- Audit: grep of src/ + admin-console/ found no remaining in-app gold-A globe except the protected overlay. Visual record: design-review/run16-live-globe-after.html.
