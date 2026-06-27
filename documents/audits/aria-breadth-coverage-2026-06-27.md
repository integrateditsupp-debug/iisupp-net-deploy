# ARIA Classifier — Full-Scale Breadth & Coverage Audit

**Date:** 2026-06-27 · **Run by:** Forge (Claude Cowork) · **RULE 14** (real numbers, honest gaps) · **RULE 16** (queue KB-agent for gaps)
**Harness:** offline mirror of the production `aria.html` `classify()` — `tests/aria-classifier-mirror.js` — run in a **/tmp clone** against the **332,163-scenario** mega-corpus (`tests/scenario-corpus-mega.js`). Offline so the full set runs deterministically in ~20s with zero load on the live `aria-kb-query` endpoint (which rate-limits bursts by design — see `docs/aria-sentinel-159k-sample-results.md`).
**Scenarios this run:** **332,163** (far above the 1,000 minimum; the full set, not a sample).

---

## Part A — Scale routing (full corpus, classify() vs the corpus's own label)

| Metric | Value |
|---|---|
| Scenarios run | **332,163** |
| Routing accuracy (classify == label) | **327,647 / 332,163 = 98.64%** |
| IT-query deflection (got a confident KB route) | **177,541 / 181,822 = 97.65%** |
| Distinct intents exercised | 33 |

**Methodology honesty:** two label families (`weather/news`, `not-resolution`) are combined/negative forms that `classify()` can never *string-equal*; my first pass scored them 0% (a scorer artifact, not a classifier failure). Fixed: `weather/news` accepts `weather`|`news`; `not-resolution` is scored via `looksLikeResolution()===false`. That correction raised the honest headline from 96.61% → **98.64%**.

**Weakest real corpus categories (n ≥ 50):** `kb:m365` 85.2% (n=5,280) · `kb:networking` 93.3% (n=4,090) · `resolution` 94.6% (n=14,596) · `default` 97.8% (n=118,495). Everything else ≥ 99.7%.

> **What 98.64% does and does NOT mean (RULE 14):** the classifier was *tuned on this corpus*, so this is a **fit-to-corpus upper bound**, not a real-world number. The corpus reuses a fixed set of phrasings; the classifier's regex tree matches them. To measure **real-world breadth** we must probe with *independent, natural phrasings the corpus never trained on* — that is Part B, and it tells a more honest story.

---

## Part B — Taxonomy coverage map (independent natural-phrasing probes)

Curated probes (6 each, real user phrasings **not** drawn from the corpus) for every call category named in the goal. `accept` = the intent(s) that would correctly serve that category. **STRONG** ≥ 85% · **WEAK** 1–84% · **NONE** 0%.

| Category | Coverage | Band |
|---|---|---|
| break/fix · BSOD/boot | 100% (6/6) | ✅ STRONG |
| break/fix · performance | 100% (6/6) | ✅ STRONG |
| password reset | 100% (6/6) | ✅ STRONG |
| MFA | 100% (6/6) | ✅ STRONG |
| printer add | 100% (6/6) | ✅ STRONG |
| VPN (GlobalProtect/AnyConnect/FortiClient) | 100% (6/6) | ✅ STRONG |
| email | 100% (6/6) | ✅ STRONG |
| BitLocker | 100% (6/6) | ✅ STRONG |
| Intune enrollment | 83% (5/6) | ⚠️ WEAK |
| account unlock | 67% (4/6) | ⚠️ WEAK |
| onboarding / offboarding | 67% (4/6) | ⚠️ WEAK |
| permissions | 50% (3/6) | ⚠️ WEAK |
| mobile iOS/Android setup | 50% (3/6) | ⚠️ WEAK |
| app repair (Office) | 33% (2/6) | ⚠️ WEAK |
| Ivanti Secure VPN | 33% (2/6) | ⚠️ WEAK |
| **break/fix · hardware** | **0% (0/5)** | ❌ **NONE** |
| **RSA token setup** | **0% (0/6)** | ❌ **NONE** |

**The corpus-vs-probe gap is the headline finding:** the corpus reports `kb:permissions`, `kb:active-directory`, `kb:onboarding` at **100%**, yet independent phrasings of those same categories score **50–67%**. The classifier is **brittle to phrasing** — it nails the exact wording it was tuned on and drops natural variants to `default` (no KB, no deflection). Real-world deflection is materially below the 97.65% corpus figure for these categories.

### Every misroute, by category
- **break/fix · hardware (NONE):** "my laptop wont turn on" → `default` · "screen is black" → `default` · "keyboard stopped working" → `default` · "laptop wont charge" → `default` · "docking station not working" → `default`. *(No hardware route at all — every probe falls through to `default`.)*
- **RSA token setup (NONE):** "set up my rsa token" · "rsa securid not working" · "my rsa token is out of sync" · "import my rsa soft token" · "rsa securid app setup" · "need a new rsa token issued" → **all `default`**. *(The word "rsa" appears nowhere in the classifier.)*
- **Ivanti Secure VPN (WEAK 33%):** "ivanti secure access wont connect" → `default` · "cant connect with ivanti secure" → `default` · "ivanti secure access keeps disconnecting" → `default` · "install ivanti secure access" → `default`. *(Only probes containing the literal word "vpn"/"pulse" route correctly; the actual product name "Ivanti Secure Access" is unknown.)*
- **app repair / Office (WEAK 33%):** "repair my office installation" → `default` · "reinstall office" → `default` · "my office apps wont launch" → `default` · "word keeps freezing" → `default`. *(Named apps Outlook→`mail`, Teams→`kb:teams` route fine; bare "Office"/"Word" do not.)*
- **mobile iOS/Android setup (WEAK 50%):** "set up my work phone" → `default` · "add my work account to my ipad" → `default` · "enroll my android phone for work" → `default`. *("set up email on my iphone" routes to `mail`; device-level setup/enrollment has no route.)*
- **permissions (WEAK 50%):** "permission denied on the network drive" → **`wifi`** (the word "network" hijacks it) · "i lost access to a folder" → `default` · "cant open the shared drive" → `default`.
- **account unlock (WEAK 67%):** "my account is locked" → `default` · "please unlock my account" → `default`. *(The password regex requires "locked **out**"; "is locked" / "unlock my account" miss.)*
- **onboarding/offboarding (WEAK 67%):** "deactivate a user account" → `default` · "provision a new employee" → `default`.
- **Intune enrollment (WEAK 83%):** "company portal wont enroll my device" → `default`.

---

## Gap classification — two kinds (this drives the fix owner)

**A. KB CONTENT gaps → KB-agent authors a new article (RULE 16), + add a classifier route:**
1. **RSA SecurID token** — setup, app registration, token re-sync, "out of sync", new-token request. *(NONE today.)*
2. **Mobile device (iOS/Android)** — set up work email on a personal/work phone or iPad, and MDM **enrollment** (Company Portal / Intune). *(NONE/WEAK today.)*
3. **Office app repair/reinstall** — "repair Office", "reinstall Office", "Office apps won't launch", "Word/Excel keeps freezing". *(WEAK today.)*
4. **Hardware break/fix triage** — won't power on, black screen, won't charge, dead keyboard, docking station. *(NONE; may intentionally escalate to a tech, but there is no self-serve triage/route — at minimum it should route to `escalation`, not `default`.)*

**B. ROUTING-regex gaps → classifier fix (the KB article likely already exists; only the route is wrong):**
5. **Ivanti Secure Access** → add `ivanti|ivanti secure( access)?|pulse connect secure` to the `vpn` regex.
6. **Permissions phrasing** → "permission denied", "lost access to a folder", "can't open the shared drive" should beat `wifi`/`default` → reorder/broaden `kb:permissions`.
7. **Account-locked phrasing** → add "account is locked", "unlock my account" to the `password` (or `kb:active-directory`) regex.
8. **Onboarding phrasing** → add "deactivate a user account", "provision a new employee" to `kb:onboarding`.
9. **Intune "Company Portal"** → add `company portal` to the `kb:m365`/Intune regex.

---

## RULE 16 — KB-agent authoring queue (queued this run)
Queued in `senior-director-state/aria-classifier-pending-fixes-2026-06-27.md` (routing fixes) and the Cowork queue (content articles). Author priority by deflection impact:
1. RSA SecurID token setup & resync (NONE)
2. Mobile (iOS/Android) work-email + device enrollment (NONE/WEAK)
3. Office repair / reinstall / app-won't-launch (WEAK)
4. Hardware triage → escalation route (NONE)
Plus the 5 classifier-regex routing fixes (B5–B9) for the next classifier-loop iteration.

---

## Limitations (honest)
- Part A measures **fit to the training corpus**, an upper bound — not field accuracy. Part B (independent probes) is the truer breadth signal and is a **small sample (6/category)** meant to *locate* gaps, not to precisely quantify them; the named gaps are real (reproducible misroutes above), but the exact per-category % would tighten with a larger independent probe set.
- This run is **offline** against the classifier mirror. A spaced, rate-limit-respecting **live** spot-check against `aria-kb-query` should confirm the deployed endpoint matches the mirror before claiming production parity. Cowork re-verifies.
- Fixing routing (B) without authoring content (A) would route users to a confident answer that doesn't exist — so the content articles (A) gate the routing changes for RSA/mobile/hardware.

**Reproduce:** `node breadth-test.cjs` in the /tmp clone (classifier mirror + `scenario-corpus-mega.js`). Raw results: `breadth-results.json`.
