# ARIA Sentinel — Legal Readiness Inventory

> **Status: internal working document — NOT legal advice.** This inventory is a
> first-pass readiness audit prepared by the engineering team. It is intended to
> brief counsel, not to replace counsel. Trademark clearance and the open-source
> license conclusions below should be independently verified by qualified legal
> professionals before any broad commercial launch.

- **Product:** ARIA Sentinel — privacy-first Electron desktop IT-support agent
- **Vendor:** Integrated IT Support Inc. ("IIS"), an Ontario, Canada corporation
- **Contact:** ahmad.wasee@iisupp.net — 647-581-3182
- **Version audited:** 0.1.0
- **Audit date:** 2026-06-19
- **Source of truth:** `package.json`, `package-lock.json` (npm lockfile v3)

---

## 1. Open-Source Dependency License Audit

### 1.1 Method

Licenses were read directly from the `license` field of every resolved package
node in `package-lock.json` (the full installed tree, including transitive
dependencies), cross-checked against the declared SPDX identifiers. No packages
were installed during this audit. The lockfile was scanned for the strings
`GPL`, `AGPL`, `LGPL`, `MPL`, `EPL`, `CDDL`, `SSPL`, `BUSL`, and
`Commons-Clause`.

### 1.2 Direct dependencies (declared in `package.json`)

| Package | Version (range) | Tree role | SPDX License | Copyleft? |
|---|---|---|---|---|
| `electron-store` | ^8.2.0 | runtime | **MIT** | No |
| `electron-updater` | ^6.8.9 | runtime | **MIT** | No |
| `electron` | ^42.4.1 | devDependency (build/runtime engine) | **MIT** | No |
| `electron-builder` | ^26.15.3 | devDependency (packaging) | **MIT** | No |

> **Runtime third-party footprint.** The only documented **runtime** third-party
> dependency that ships in the packaged application and performs network or
> update behaviour is **`electron-updater`** (MIT). `electron-store` is MIT and
> is a thin local-config wrapper. Everything else in the dependency graph is
> **dev tooling** (Electron itself as the runtime engine, `electron-builder` and
> its packaging chain) or **hand-rolled** application code authored by IIS. The
> application does not bundle `@netlify/blobs` or any other server SDK into the
> desktop binary; Netlify is used only as the *hosting* surface for the pull-only
> knowledge endpoints the app reads from (see DPA sub-processor list).

### 1.3 Key transitive runtime dependencies (pulled in by `electron-updater`)

| Package | Version | SPDX License | Copyleft? |
|---|---|---|---|
| `builder-util-runtime` | 9.7.0 | MIT | No |
| `fs-extra` | 10.1.0 | MIT | No |
| `js-yaml` | 4.1.0 | MIT | No |
| `lazy-val` | 1.0.x | MIT | No |
| `lodash.escaperegexp` | 4.1.2 | MIT | No |
| `lodash.isequal` | 4.5.0 | MIT | No |
| `semver` | 7.7.x | **ISC** | No |
| `tiny-typed-emitter` | 2.1.0 | MIT | No |

`electron-store` (runtime) pulls in `conf` (MIT) and `type-fest` (MIT).

### 1.4 Full-tree license distribution

The complete resolved tree (runtime + dev + all transitive packages) resolves to
the following SPDX identifiers only:

- **MIT** (the large majority)
- **ISC**
- **Apache-2.0**
- **BSD-2-Clause**, **BSD-3-Clause**
- **0BSD**
- **BlueOak-1.0.0**
- **Python-2.0** (single dev-tree node)
- **WTFPL**, **WTFPL OR ISC**, **(WTFPL OR MIT)**
- **(MIT OR CC0-1.0)**

All of the above are **permissive, non-copyleft** licenses. Apache-2.0 carries a
patent-grant and notice/attribution obligation; the BSD and MIT/ISC families
carry an attribution/notice obligation. These are satisfied by retaining the
upstream license texts in the distributed package and/or a NOTICE/THIRD-PARTY
file (recommended deliverable — see to-dos).

### 1.5 GPL / AGPL verdict

> **NO GPL, AGPL, or LGPL dependency was found anywhere in the dependency tree
> (runtime or development).** No MPL, EPL, CDDL, SSPL, BUSL, or
> Commons-Clause-encumbered package was found either.

There is therefore **no strong copyleft obligation** that would compel IIS to
open-source ARIA Sentinel's proprietary application code as a condition of
distribution. The only standing obligations are permissive-license attribution
and the Apache-2.0 notice/patent terms.

### 1.6 Caveats

- This audit reflects the lockfile state at version 0.1.0 on the audit date.
  Re-run on every dependency bump (recommend wiring `license-checker` or
  `npm ls --all --json` into CI).
- A small number of packages declare dual licenses (e.g. `(MIT OR CC0-1.0)`);
  IIS may elect the more permissive option in each case.
- Electron bundles Chromium (BSD-3-Clause family + many third-party components)
  and Node.js. Electron's own license is MIT, and its embedded components are
  redistributed under their respective permissive licenses; a packaged-app
  THIRD-PARTY-NOTICES file generated from the Electron release is recommended.

---

## 2. Trademark Posture

**Status: documented to-do — clearance NOT yet completed.**

### 2.1 Marks in use

- **"ARIA Sentinel"** — product name (word mark, and any future logo/design mark).
- **"Integrated IT Support Inc." / "IIS"** — corporate/house brand.

### 2.2 Risk assessment (preliminary, non-legal)

- **"ARIA"** is a common, widely-adopted term — it is used as a personal name, as
  the W3C "ARIA" (Accessible Rich Internet Applications) accessibility standard,
  and as a product/brand name across many software and hardware categories. The
  standalone "ARIA" element is **likely weak / crowded** and should not be relied
  on for exclusivity on its own.
- **"Sentinel"** is **heavily used** in the security / monitoring / endpoint
  software space (multiple registered marks and products incorporate it). Risk of
  confusion with existing security-product marks is non-trivial.
- The composite **"ARIA Sentinel"** may be more distinctive than either element
  alone, but composite distinctiveness does not guarantee registrability or
  freedom-to-operate, particularly within Nice classes covering downloadable
  software (Class 9) and SaaS/IT services (Class 42).

### 2.3 Required clearance actions (to-do)

1. Run a **manual knockout search** against:
   - **CIPO** — Canadian Intellectual Property Office Trademarks Database
     (Canada is the home jurisdiction).
   - **USPTO TESS** (now the Trademark Search system) for the United States, if
     US distribution is contemplated.
2. Screen the relevant Nice classes (at minimum Class 9 and Class 42).
3. If knockout results are clean, commission a **full clearance / availability
   search** through trademark counsel before broad commercial launch or any
   ® / TM public assertion.
4. Decide on filing strategy (CIPO application; Madrid Protocol / USPTO if
   international).

> This section is an honest **open to-do**, not a completed clearance. No
> clearance opinion has been rendered. Do not represent the marks as cleared.

---

## 3. Privacy / Data Architecture (legal-relevant summary)

ARIA Sentinel is **content-blind and local-first** by design:

- Device signals are processed **on-device**. Public `iisupp.net` endpoints are
  **pull-only** knowledge feeds.
- The browser extension transmits/stores only **opaque symbolic signal IDs**
  (e.g. `BROWSER.CACHE.STALE`) and an origin **category** — never page bodies,
  form fields, cookies, passwords, local-storage values, screenshots, or files.
- The desktop app runs in **dry-run by default**, executes only recipe-defined
  actions, blocks destructive command families, and never turns arbitrary user
  text into a shell command.
- **No personal data is collected by default.** Optional opt-in telemetry is
  limited to `{ recipe_id, outcome, ts }`.

This architecture materially lowers privacy-law exposure and is the foundation of
the EULA privacy section and the DPA's "minimal personal data" representation.
See `docs/PRIVACY_AND_SECURITY.md` for the engineering detail.

---

## 4. Pointers to Companion Legal Documents

- **End User License Agreement:** [`docs/EULA.md`](./EULA.md) — license grant,
  restrictions, IP ownership, AS-IS warranty disclaimer, limitation of liability
  (cap at fees paid / trailing 12 months), indemnification, term & termination,
  governing law = Ontario, Canada.
- **Data Processing Agreement (template):** [`docs/DPA_TEMPLATE.md`](./DPA_TEMPLATE.md)
  — GDPR Art. 28 + PIPEDA aligned, controller/processor roles, sub-processors
  (Netlify), security measures, breach notice, audit rights, signature block.

---

## 5. Remaining Legal To-Dos

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Privacy Policy** (public URL) | OPEN | Publish a customer-facing privacy policy and link it from the app/installer and EULA. |
| 2 | **Terms of Service** | OPEN | Public ToS for the iisupp.net knowledge endpoints / any web surface; distinct from the desktop EULA. |
| 3 | **Trademark clearance** (CIPO + USPTO) | OPEN | See §2 — knockout then full clearance before launch. |
| 4 | **Liability / E&O / cyber insurance** | OPEN | Secure errors-and-omissions and cyber-liability coverage sized to the LoL cap and customer base. |
| 5 | **THIRD-PARTY-NOTICES file** | OPEN | Generate attribution/notice file from the dependency tree (esp. Electron + Apache-2.0 nodes) and ship it with the installer. |
| 6 | **Code signing certificate** | OPEN | Current builds are unsigned (`signExecutable: false`); obtain an EV/OV signing cert before public distribution. |
| 7 | **Counsel review of EULA + DPA** | OPEN | Both companion docs are templates pending licensed-counsel review. |
| 8 | **Sub-processor list maintenance** | OPEN | Keep the DPA sub-processor list (Netlify, and any future processors) current and versioned. |
| 9 | **Accessibility-mark conflict check** | OPEN | Confirm no conflict/confusion with the W3C "ARIA" accessibility standard in messaging. |

---

*Prepared 2026-06-19 by Integrated IT Support Inc. engineering. For legal review.*
