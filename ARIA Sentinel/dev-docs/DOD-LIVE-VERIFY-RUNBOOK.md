# DoD Live-Verification Runbook — criteria 1-3 (the publish/install/VM-gated steps)

Criteria **4, 5, 6, 7 are DONE** (matcher 100%, tests green, Recipes-tab finder visually confirmed, all
recorded). Criteria **1, 2, 3** have their mechanisms proven live (see CHANGELOG) but need one action each
that only the owner can take — publish, a VM, or a signed-build install. This runbook makes each fast.

Branches to deploy/build: `cc/coverage-buildout-2026-06-24` (web) + `cc/coverage-sentinel-2026-06-24` (app).

---

## Criterion 2 — Web chat live (needs: Netlify publish)
1. Merge/publish `cc/coverage-buildout-2026-06-24` to the deploy branch → Netlify build.
2. Verify the free-form LLM answer:
   ```
   curl -s -X POST https://iisupp.net/.netlify/functions/aria-chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Should I get 16GB or 32GB RAM for video editing?"}]}'
   ```
   - **Expected:** a real `{"text":"…"}` answer.
   - **If it still 400s:** the model cascade has tried every candidate, so it's the **account/key**, not the
     model. The 502 now includes a `detail` field with Anthropic's real error — read it. Most likely fix is a
     one-line **`ARIA_MODEL`** env change (set it to a model your key can access) or refreshing the API key on
     Netlify. No code redeploy needed for an env change.
3. On iisupp.net/aria: ask a printer question (gets the fix), then "RAM vs storage" (answers, no printer
   lock), then **NEW CHAT** (resets). Topic-switch + reset already proven locally in `dev-web-chat-capture.cjs`.

## Criterion 3 — Resolve → Sentinel (needs: signed build installed + web published)
1. Install the signed build from `cc/coverage-sentinel-2026-06-24` (`npm run package:win`). On first launch it
   self-registers `aria-sentinel://` (proven to round-trip via the OS in `deeplink-receiver.cjs`).
2. On the published web, click **"Open with ARIA Sentinel"** in the resolve modal → Sentinel opens on the
   Recipes tab and gates the matched fix (Confirmed + countdown + restore point + kill-switch). Without the
   app installed → the download fallback appears.

## Criterion 1 — Recipes run for REAL (needs: a VM, elevated)
On a disposable Windows VM with the signed build (do NOT run the destructive sweep on a primary workstation):
1. **Mechanism already proven** on a live box (`live-exec-proof.mjs`): 3 Tier-0 recipes ran for real
   (DNS flush 15→0, spooler restart, Windows-Update restart **with a real rollback**), dry-run gate, audit
   trail, and the Ctrl+Alt+K kill-switch.
2. In the running signed app (Confirmed mode), trigger ≥10 representative recipes end-to-end and confirm for
   each: the fix completes, a **System Restore point** is created (the app runs elevated, so
   `Checkpoint-Computer` succeeds — it returns **Access denied** unprivileged, which is why this needs the
   signed app), an audit entry is written, and **Ctrl+Alt+K** aborts a fix mid-run.

---

## Already verified (no action needed)
- **4** Recipes tab — `recipes-tab.png`: A→Z dropdown + search ("zoom"→3); button "PREVIEW THE FIX" (Manual).
- **5** Matcher — `100-call-retest-2026-06-24.md`: 102/102 (100%). Re-run: `run-100-call-harness.mjs`.
- **6** Tests — new suites pass; 185/188 (3 pre-existing cross-tree netlify imports).
- **7** This CHANGELOG + the vault Live-Operations-Log.
