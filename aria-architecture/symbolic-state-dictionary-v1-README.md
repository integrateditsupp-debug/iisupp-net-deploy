# Symbolic State Dictionary v1 — README

**File:** `aria-architecture/symbolic-state-dictionary-v1.json`
**Schema:** `aria-symbolic-state-dictionary/v1`
**Generated:** 2026-05-14 by kb-agent
**Purpose:** Implements AROC §4 v0.5 task "Symbolic code dictionary v1 — seed with 200 most common L1/L2 issues."

## What this is

A JSON dictionary of 51 net-new operational state codes, each mapped to one or more KB articles from the 136-article bundle. Designed to be merged into `aria-research.mjs`'s `STATE_PATTERNS` and `LIBRARY` maps.

## Why it exists

Per `project_aria_aroc_extension_law.md`:
- ARIA evolves toward compressed operational meaning (e.g., `M-LIC-01`) instead of giant text databases.
- Pattern Recognition Layer (v0.5) needs a seeded dictionary of common issue → code mappings.
- Research Agent already has 20 states shipped (DISK.FULL, NET.WIFI.AUTH, etc). This adds 51 more, bringing the catalog to **71 symbolic states** covering the top L1 helpdesk surface.

## Coverage delta

**Already in `aria-research.mjs` LIBRARY (20 states):**
DISK.FULL · OS.SLOW.PERF · OS.BOOT.FAIL · NET.WIFI.AUTH · NET.WIFI.NO.CONN · NET.SLOW · M365.OUTLOOK.SEND · M365.OUTLOOK.RECV · M365.OUTLOOK.OOO · M365.OUTLOOK.OPEN · AUT.PW.RESET · AUT.MFA.LOCK · PRT.OFFLINE · PRT.QUEUE.STUCK · SEC.PHISH · SEC.MALWARE · VPN.AUTH.FAIL · VPN.NO.TUNNEL · CLOUD.SYNC · SW.INSTALL.FAIL · SW.UPDATE.FAIL

**Added by this file (51 net-new states):**

| Category | New states |
|---|---|
| M365 / Outlook / Teams | M365.OUTLOOK.OUTBOX · M365.TEAMS.AUDIO.MEETING · M365.SHAREDMBX.SEND · M365.LICENSE.INVALID |
| Camera / Audio / Video | CAM.LOCKED.BY.APP · CAM.VIRTUAL.BG.FAIL · BT.HANDSHAKE.FAIL · AUDIO.MTG.WRONG.DEVICE · ZOOM.START.FAIL · SLACK.VOICE.JOIN.FAIL |
| Notifications | NOTIF.MISSING |
| Authentication | AUT.LOCKOUT.AFTER.PWCHG · AUT.ACCOUNT.STATE · AUT.SSO.LOOP · MFA.LOST.AUTHENTICATOR · MFA.SETUP |
| Display / Keyboard / Input | DISPLAY.SCALE.WRONG · DISPLAY.NOT.DETECTED · KBD.LAYOUT.WRONG · INPUT.DEAD |
| Printer | PRT.NOT.FOUND · PRT.SLEEP.OFFLINE |
| VPN | VPN.CONNECTED.NO.ACCESS · VPN.SLOW |
| Network | NET.ETH.UNIDENT · NET.WIFI.CONNECTED.NO.NET · NET.INT.NONE · NET.INT.INTERMITTENT |
| Sync | SYNC.ONEDRIVE.PAUSED · SYNC.ONEDRIVE.KFM · SYNC.ONEDRIVE.PATH · SYNC.CLOUD.PHONE |
| Files | FILE.RECOVERY · FILE.LOCKED.OFFICE · FILE.SHARED.NOACCESS |
| Mobile / New devices / Lost | MAIL.MOBILE.SETUP · DEVICE.NEW.SETUP · DEVICE.LOST.STOLEN |
| Software install | SOFT.INSTALL.REQUEST · SOFT.INSTALL.BLOCKED |
| Conference rooms | CONF.AV.ROOM |
| Calendar | CAL.OOO.SETUP · CAL.INVITE.MISSING · CAL.OUTLOOK.GENERIC |
| Browser | BROWSER.LOAD.FAIL · BROWSER.DEFAULT.REVERTS |
| OS / System | OS.WIN.UPDATE.REVERT · OS.MAC.SPOTLIGHT · OS.MAC.MAIL.PWCHG · CLOCK.DRIFT |
| Legacy | OS.WIN7.LEGACY · MAC.LEGACY.STUCK |

**Combined catalog: 71 symbolic states. Remaining toward AROC §4 v0.5 target of 200: ~129. Future iterations will add L2 codes (admin scope) and bleeding-edge tech codes.**

## OPS integration path (for whoever wires aria-research.mjs)

Each entry in `states.<CODE>` has:
- `pattern` — regex string (escape-encoded JSON). Use new RegExp(pattern, "i") when importing.
- `kb_ids` — array of KB article IDs. The recipe steps can be pulled from the bit-native chunks of these KBs at runtime.
- `title` — user-facing display title for the recipe.
- `short_code` — AROC §4 compressed form for use after 3+ hot fires (e.g., `O-OUT-01` for `M365.OUTLOOK.OUTBOX`).
- `long_form` — the full state path (same as the key).
- `to_human` — decompression template per AROC hard rule (every compressed state must remain decompressible).
- `confidence` — 0.0-1.0 baseline; AROC §6 surfaces caveat if <0.7.

### Suggested import code for aria-research.mjs

```javascript
import dictV1 from '../../aria-architecture/symbolic-state-dictionary-v1.json' assert { type: 'json' };

// Merge into STATE_PATTERNS at module load
for (const [code, entry] of Object.entries(dictV1.states)) {
  if (!STATE_PATTERNS[code]) {
    STATE_PATTERNS[code] = new RegExp(entry.pattern, 'i');
  }
}

// For LIBRARY recipes, pull steps from KB chunks at runtime — or pre-bake by reading
// assets/aria-kb-local-bundle-v3.json and extracting chunks for each entry.kb_ids
```

The frontend mirror in `assets/aria-v04-ext.js` (STATE_PATTERNS) needs the same imports — both layers must agree per `project_aria_research_agent_shipped.md`.

## AROC compliance checklist

- [x] Every state has a decompressible `to_human` template.
- [x] Every state has a `confidence` baseline; <0.7 surfaces caveat.
- [x] Mappings reference KB articles (existing tree, not replacement).
- [x] Short codes follow AROC §4 format (`X-XXX-NN`).
- [x] Additive merge policy — never overwrites existing aria-research.mjs entries.
- [x] No LLM dependency. Regex + KB lookup only.

## Carry-forward law

Future expansions of this dictionary must:
1. Read `project_aria_aroc_extension_law.md` first.
2. Read `feedback_kb_bit_native_style.md` second.
3. Map each new state to a real, bit-native KB chunk (no inventing recipes).
4. Update this README with the new state list.
5. Bump dictionary version semver: minor for additions, major for schema change.
