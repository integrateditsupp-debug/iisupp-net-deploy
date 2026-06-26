# Production Recovery Review - 2026-06-13

Prepared: 2026-06-13T06:14:27Z
Owner: Codex
Status: ready for CEO final-action decision

## What Failed Live
- `https://iisupp.net/` returned Netlify `404 Page not found`.
- `https://iisupp.net/shop` returned Netlify `404 Page not found`.
- `https://iisupp.net/aria` returned Netlify `404 Page not found`.
- `https://iisupp.net/.netlify/functions/aria-lead-radar?debug=1` returned Netlify `404 Page not found`.

## What Still Works Locally
- Workspace route rule exists in `netlify.toml`:
  - `/aria -> /aria.html`
- Workspace file exists:
  - `aria.html`
- Workspace function exists:
  - `netlify/functions/aria-lead-radar.mjs`
- Local Netlify dev verification:
  - `curl.exe -I http://127.0.0.1:8888/aria` returned `200 OK`
  - `curl.exe -i http://127.0.0.1:8888/.netlify/functions/aria-lead-radar?debug=1` returned `200 OK` JSON with live lead output
- In-app browser verification:
  - Live `https://iisupp.net/aria` showed Netlify `Page not found`
  - Local `http://127.0.0.1:8888/aria` showed the ARIA interface normally

## Working Conclusion
- This does not currently look like a missing local file or missing local function.
- It looks like a production publish/state problem on Netlify: the current workspace serves correctly under local Netlify dev, while the production domain is serving Netlify's generic 404 surface.

## CEO Final Action
- Ahmad approve a targeted production recovery publish/redeploy from the current workspace state, then have the deploy owner run live verification for:
  - `/`
  - `/shop`
  - `/aria`
  - `/.netlify/functions/aria-lead-radar?debug=1`

## Risk
- Public production publish changes live customer-facing behavior and should stay an Ahmad-approved action even though the source was validated locally.

## Suggested Deploy Owner Flow
1. Use the current `main` workspace state as the recovery source.
2. Trigger a Netlify deploy/redeploy for the primary production site.
3. Re-check the four live paths above.
4. Record the deploy ID and verification result back into the queue and approval surfaces.

## Current Source Anchor
- Branch: `main`
- HEAD observed during prep: `691d7c3`
