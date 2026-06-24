---
id: t4-frontier-001
title: "Post-Quantum Cryptography (PQC) / Quantum-Safe Migration"
category: cryptography
support_level: L3
tech_generation: tier-4
tier4_pack: frontier-infra
severity: high
estimated_time_minutes: 120
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["post-quantum cryptography","pqc","quantum-safe","crypto-agility","ml-kem","ml-dsa","nist pqc","crypto inventory","key exchange","hybrid cryptography","cbom","tls migration"]
related_articles: ["t4-frontier-002","t4-aigov-001","t4-aithreat-001"]
escalation_trigger: "A system uses cryptography that cannot be inventoried or upgraded, blocking a quantum-safe migration plan."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- Leadership/compliance asks "are we quantum-safe?" or requests a PQC readiness assessment.
- An audit or customer questionnaire asks which cryptographic algorithms protect data and key exchange.
- A vendor announces PQC support and you need to know whether/how to adopt it.
- Long-lived sensitive data exists that must stay confidential for many years (raises future-decryption risk — see t4-frontier-002).
- No one can produce a list of where cryptography is used across the estate.

## 2. Likely Causes / Drivers
- **Quantum-computing threat horizon:** a future large-scale quantum computer could break today's widely used public-key algorithms (RSA, ECC) used for key exchange and signatures.
- **Standards maturity:** NIST has published PQC standards (referenced here as ML-KEM for key encapsulation and ML-DSA for signatures, among others) that vendors are beginning to support.
- **Lack of crypto-agility:** systems hard-code algorithms, making future swaps difficult.
- **No crypto inventory:** the organization doesn't know where and how cryptography is used.
- **Long data lifetimes:** data that must remain secret beyond the quantum horizon is at risk now.

## 3. Questions To Ask User
- What data must remain confidential, and for how many years? (Long lifetimes raise urgency.)
- Do you have any inventory of where cryptography is used (TLS, VPNs, code signing, storage, PKI)?
- Are there compliance/customer drivers requiring a PQC roadmap?
- How agile are your systems — can algorithms be swapped via config, or are they hard-coded?
- Which vendors/products are in scope, and do any already offer PQC or hybrid modes?

## 4. Assessment Steps
1. **Build a cryptographic inventory (CBOM-style):** enumerate where crypto is used — TLS endpoints, VPNs, PKI/certificates, code signing, data-at-rest encryption, key stores, embedded/IoT, third-party services.
2. **Classify by risk:** algorithm type (quantum-vulnerable public-key vs. symmetric), data sensitivity, and data lifetime.
3. **Assess crypto-agility:** can each system change algorithms via configuration/update, or is it fixed?
4. **Map dependencies:** identify systems you don't control (SaaS, vendor appliances) and their PQC roadmaps.
5. **Prioritize:** long-lived, high-sensitivity, externally-exposed key exchange first (this links directly to harvest-now/decrypt-later, t4-frontier-002).

## 5. Resolution / Migration-Planning Steps
1. **Establish crypto-agility as the goal:** the objective is the *ability* to change algorithms safely, not a one-time swap.
2. **Adopt hybrid where available:** combine a classical and a PQC algorithm so you keep current assurance while gaining quantum resistance — a common transitional pattern.
3. **Sequence the migration:** start with high-risk/long-lived data and external key exchange; coordinate PKI, TLS, VPN, and code-signing updates.
4. **Engage vendors:** require PQC/hybrid roadmaps from key suppliers; track support as it ships.
5. **Test thoroughly:** PQC algorithms have larger keys/signatures — validate performance, certificate sizes, MTU/handshake impacts, and interoperability before broad rollout.
6. **Keep symmetric crypto strong:** ensure adequate symmetric key sizes (these are far less affected) as a stopgap and ongoing baseline.
7. **Document a roadmap** with milestones; treat as readiness/advisory work, not a compliance certification.

## 6. Verification Steps
- A crypto inventory exists and is maintained, with risk classification and data-lifetime tagging.
- High-risk systems have a sequenced migration plan with owners and milestones.
- Where adopted, hybrid/PQC modes are tested for interoperability and performance before production.
- Vendor PQC roadmaps are tracked for systems you don't directly control.
- The organization can change a cryptographic algorithm via a defined process (crypto-agility demonstrated).

## 7. Escalation Trigger
Escalate to L3 / security architecture when a system uses cryptography that cannot be inventoried or upgraded (hard-coded, unsupported, or vendor-locked) and therefore blocks the quantum-safe plan, or when high-sensitivity long-lived data has no viable migration path.

## 8. Prevention Tips
- Design new systems for crypto-agility (algorithm choice in config, not hard-coded).
- Maintain a living cryptographic inventory as part of asset management.
- Require PQC/hybrid roadmaps in vendor procurement now.
- Keep symmetric key sizes robust as an ongoing baseline.
- Reference NIST PQC standards as the authority; provide advisory/readiness guidance, never "certified quantum-safe" claims.

## 9. User-Friendly Explanation
Today's encryption relies on math that future quantum computers may be able to break — especially the part that exchanges keys and signs things. New "post-quantum" algorithms are being standardized to resist that. The first job isn't to rip-and-replace everything; it's to find everywhere we use encryption, figure out what's most at risk (especially data that must stay secret for many years), and make our systems able to switch algorithms smoothly. Then we upgrade the highest-risk pieces first, often running old and new together during the transition.

## 10. Internal Technician Notes
- The deliverable is **crypto-agility + an inventory + a prioritized roadmap** — this is advisory/readiness, never a compliance certification.
- Cite NIST PQC standards as references (ML-KEM = key encapsulation, ML-DSA = signatures, among others) — do not assert version-specific "compliance."
- Public-key algorithms (RSA/ECC) are the quantum-vulnerable ones (key exchange, signatures); symmetric algorithms are far less affected — prioritize accordingly.
- PQC keys/signatures are larger → test handshake size, certificate bloat, MTU/fragmentation, performance.
- This is the parent article for t4-frontier-002 (harvest-now/decrypt-later) — prioritization logic lives there.

## 11. Related KB Articles
- t4-frontier-002 — "Harvest-Now, Decrypt-Later" Risk Playbook
- t4-aigov-001 — AI Agent Governance Framework
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage

## 12. Keywords / Search Tags
post-quantum cryptography, PQC, quantum-safe, crypto-agility, ML-KEM, ML-DSA, NIST PQC, crypto inventory, CBOM, hybrid cryptography, key exchange, TLS migration
