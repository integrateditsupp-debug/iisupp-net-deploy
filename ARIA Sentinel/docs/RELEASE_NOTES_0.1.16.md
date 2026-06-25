# ARIA Sentinel 0.1.16 Release Notes

Date: 2026-06-24  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.16 is a **control-plane hardening + suite-repair** line on top of the 0.1.15 web↔Sentinel
parity work. It restores the two live knowledge endpoints the desktop agent depends on, finishes the RUN 34-2
Settings cleanup, and brings the full automated suite back to green. No-cost, unsigned Windows MVP.

## What's new

- **Control-plane endpoints restored (`aria-recipes`, `aria-stop-codes`).** The desktop agent's
  `RECIPE_ENDPOINT` / `STOP_CODES_ENDPOINT` are served again from `netlify/functions/`:
  - `aria-recipes` serves the IIS-vetted recipe library (`aria-recipes-data.mjs`) and carries the
    **global kill switch** the agent reads via `parseControlPlaneKill` — `killed:true` forces DETECT-ONLY
    mode fleet-wide (watchers keep running; no recipe may APPLY). Ops can flip it with `ARIA_RECIPES_KILLED=1`
    (optional `ARIA_RECIPES_KILL_REASON`) without a code change. Default `killed:false` keeps fixes enabled.
  - `aria-stop-codes` serves the 25-entry Windows stop-code (BSOD) index (`aria-stop-codes-data.mjs`),
    with optional `?q=` filter by code or hex.
  - Both are **content-blind** (`privacy.uploadToIisupp:false`) and ship an `x-aria-*-sha256` integrity
    header so clients can detect tampering in transit.
- **Web KB routing — round 3.** Added hard-routing for three high-frequency end-user categories that
  had KB articles (top50-gaps) but no routing rule: Outlook calendar (sync/missing/double-booked + invites
  + out-of-office), external display (not-detected + resolution/scaling), and conference-room AV (projector
  / Teams Room / boardroom). New `aria-kb-routing-round3` suite; iter-7 lifts + vertical wont-print
  fallthrough verified intact.
- **Tier-0 catalog expanded 14 → 20.** Six new safe-generic, content-blind, dry-run-default recipes
  (read-only diagnostics + a DHCP-client restart) on the existing allowlisted command set: show IP config,
  list active connections, check memory usage, check disk space, list installed updates, restart DHCP client.
- **Settings → Mode cleanup finished (RUN 34-2).** The redundant Settings "Ask ARIA" box stays removed
  (ARIA Chat lives only in the ARIA tab); the stale "dry-run toggle · ask ARIA dock" sub-caption is replaced
  with copy that reflects the current Mode panel. The Mode selector (Manual / Confirmed / Autonomous) is
  unchanged.

## Carry-forward (0.1.15 → 0.1.16)

- "Resolve it for me" (gated), ARIA Chat web parity, and the one-brain KB/recipes/stop-codes chain from
  0.1.15 are carried forward and green.

## Safety Defaults

- **The answer chain is locked and visible:** knowledge base first ($0), then Anthropic only for novel
  questions, then the bundled local KB offline. Anthropic is never removed.
- The control-plane kill switch, supervisor critic, 10-second countdown, and Ctrl+Alt+K kill-switch are all
  preserved. High-risk fixes always require explicit confirmation and never auto-execute.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat +
  session content are path-scrubbed.

## Build / deploy note

The physical `npm run package:win` (Electron + electron-builder) and the OTA publish run on Ahmad's Windows
machine. The new `netlify/functions/aria-recipes*` + `aria-stop-codes*` files are **web-deploy** assets
(repo-root Netlify) and go live only on Ahmad's manual Netlify publish. The customer build allow-list still
excludes admin-console, tests, fixtures, design-review, docs and `axis/`.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
