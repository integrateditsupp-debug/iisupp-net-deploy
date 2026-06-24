# C2PA / Content Provenance Policy — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-24
**Status:** SELF-ASSESSMENT / READINESS MAP (NOT A CERTIFICATION OR AUDIT).
**Scope:** ARIA SaaS platform + ARIA Sentinel desktop agent — content production, AI-content labeling, and inbound media verification.

> **Disclaimer:** This is an internal policy and readiness statement. It is NOT a certification, conformance attestation, or audit, and it does not state or imply that IIS/ARIA is "C2PA certified," "compliant," or "conformant." C2PA is referenced as an open technical standard; IIS claims no certification against it. Adoption is a forward commitment with a staged roadmap below. Legal review is pending.

---

## 1. What C2PA / Content Credentials are

The **Coalition for Content Provenance and Authenticity (C2PA)** publishes an open technical standard for cryptographically signed "manifests" that travel with a media asset and describe its origin and edit history. **Content Credentials** is the consumer-facing label/UX built on that standard. A manifest can record: who/what created or edited an asset, whether AI tools were involved, the device or software used, and a tamper-evident signature chain. The goal is verifiable **provenance** — letting a recipient check where a piece of media came from and how it was changed — rather than judging whether content is "true."

This policy adopts C2PA's vocabulary and intent. It does not assert that any IIS asset currently carries a valid, signed C2PA manifest unless explicitly stated on that asset.

---

## 2. IIS stance on labeling AI-generated / AI-assisted content

- **Honesty by default.** IIS labels content that is materially AI-generated or AI-assisted. We do not present AI-generated media as human-authored when the distinction is material to the audience.
- **No deceptive synthetic media.** IIS does not create deepfakes of real people, fabricated testimonials, fake partnerships, or synthetic "proof." (This aligns with IIS's standing rules against unsupported claims and fabricated evidence.)
- **Proportionate disclosure.** Routine AI assistance in drafting (e.g., copy editing) is disclosed where it is material to the audience's understanding; fully synthetic imagery/audio/video intended to inform the public is labeled at the asset level.
- **Ties to transparency duties.** This labeling stance supports IIS's EU AI Act Art. 50 readiness (`compliance/EU-AI-Act-readiness-map.md`) and NIST AI RMF transparency goals.

---

## 3. Provenance for ARIA-produced media + marketing

| Area | Stance / Commitment |
|---|---|
| Marketing imagery/video produced with AI tools | Label as AI-generated/assisted; attach Content Credentials where the production tool supports C2PA export. |
| ARIA/KB written content authored or assisted by AI | Track AI assistance internally; add a visible AI-assistance note where published to inform the public. |
| Brand documents (navy+gold house style) | Human-reviewed before release; provenance note added where AI tools materially contributed. |
| Screenshots / product demos | Authentic captures; no fabricated UI or staged "results" presented as real outcomes. |

Current implementation status: **Planned/Partial** — labeling intent is policy today; automated Content Credentials embedding on produced media is on the roadmap (Section 6).

---

## 4. Verifying inbound media authenticity (anti-deepfake tie-in)

- **Treat unverified inbound media skeptically.** Media received from external parties (e.g., for client engagements, testimonials, or evidence) is not assumed authentic.
- **Check Content Credentials when present.** Where inbound assets carry C2PA manifests, IIS will inspect the manifest and signature chain before relying on the asset.
- **Absence is not proof of fakery, and presence is not proof of truth.** A missing manifest does not mean an asset is fake; a present manifest verifies provenance/edit history, not factual accuracy. IIS treats provenance as one signal among several.
- **No publication of suspected deepfakes** of real individuals without their consent and verification.

This complements ARIA's content-blind, privacy-first posture: provenance checks operate on media metadata/signatures, not on scanning private user file contents.

---

## 5. Boundaries (what this policy does NOT claim)

- It does **not** claim IIS/ARIA is C2PA-conformant or certified.
- It does **not** claim every IIS asset carries a valid signed manifest today.
- It does **not** assert detection of all synthetic media; no provenance tool guarantees that.
- It does **not** replace legal review for advertising, IP, or disclosure obligations.

---

## 6. Forward commitment + roadmap

Open items, stated honestly:

1. **Tooling** — adopt content-production tools that support C2PA / Content Credentials export and enable manifest embedding on AI-generated marketing media.
2. **Signing identity** — establish a signing key/identity for IIS-produced provenance manifests (with documented key management, tying to ISO A.8.24).
3. **Verification workflow** — define a lightweight inbound-media verification step for client/evidence assets that carry Content Credentials.
4. **Disclosure UX** — add visible AI-assistance disclosure to published, AI-assisted text where material to the audience.
5. **Standards tracking** — track C2PA specification updates and align labeling practice accordingly.
6. **Legal review** — review disclosure language and advertising implications with counsel. Legal review is **pending**.

*This policy reflects IIS's intent and direction on content provenance. It is a self-assessment / readiness statement and asserts no certification or conformance.*
