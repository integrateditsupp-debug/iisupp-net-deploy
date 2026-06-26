# Live Site Verification

Verified: 2026-06-13 04:15 America/Toronto
Owner: Codex
Status: verified, no publish performed

Purpose: replace stale outage assumptions with the actual public IIS/ARIA state before Ahmad makes any publish decision.

## Public production check

- `https://iisupp.net/` returned `200 OK`.
- `https://iisupp.net/aria` returned `200 OK`.
- `https://iisupp.net/.netlify/functions/aria-lead-radar?debug=1` returned `200 OK` and produced JSON lead-radar output.

## Local staged QA

Checked against `http://127.0.0.1:8765/`:

- Homepage loaded and the proof-first shelf was present under `Choose the right path`.
- `start-here.html` loaded successfully.
- `product.html?id=gl-meeting-sop-pack` loaded successfully.
- `downloads/library/meeting-to-sop-ai-pack-preview.html` loaded successfully.

## What this means now

- The old Netlify 404 recovery posture is no longer the active blocker.
- The real CEO website decision is now simpler: approve the staged publish bundle or hold it local only.
- Publish is still approval-gated because the staged bundle affects public revenue pages, claims context, and buyer routing.

## Ahmad-only action

- Review `senior-director-state/website-publish-staging-package-2026-06-12.md`.
- Decide `Approve publish` or `Hold local only`.

## Verification commands

- `curl.exe -I https://iisupp.net/`
- `curl.exe -I https://iisupp.net/aria`
- `curl.exe -i https://iisupp.net/.netlify/functions/aria-lead-radar?debug=1`
