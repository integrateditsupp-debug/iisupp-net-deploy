---
id: l3-certificates-002
title: "Certificate Authority / critical certificate expiry"
category: pki
support_level: L3
severity: high
estimated_time_minutes: 180
audience: it-technician
os_scope: ["Windows Server", "Linux", "Network Appliances", "All"]
prerequisites: []
keywords:
  - ca certificate expired
  - root ca expiry
  - issuing ca expiry
  - crl expired
  - mass validation failure
  - certificate renewal
  - rekey
  - cross-sign
  - code signing expiry
  - 802.1x failure
  - vpn certificate
  - tls handshake failure
related_articles:
  - l3-certificates-001
  - l3-sso-saml-001
  - l3-security-001
  - l3-networking-001
escalation_trigger: "Engage PKI lead, the certificate vendor/public CA, and management when a root or issuing CA is expiring/expired, a CRL has lapsed causing mass failures, or a re-key/cross-sign is required across the fleet."
last_updated: 2026-06-24
version: 1.0
---

# Certificate Authority / critical certificate expiry

## 1. Symptoms
- Sudden, broad authentication/TLS failures across many systems at once (a hallmark of CA or CRL expiry, not a single leaf cert).
- Browsers/clients report certificate **expired**, **revoked**, or **untrusted issuer**.
- VPN, Wi-Fi (802.1x/EAP-TLS), or RADIUS clients can no longer connect.
- Code-signed apps/drivers/scripts blocked or warned as untrusted.
- Services fail to start or talk to each other (mutual TLS) after a known cert/CA date passes.
- CRL/OCSP checks fail "hard," so even valid leaf certs are rejected.

## 2. Likely Causes
- **Root or issuing (subordinate) CA certificate expired**, invalidating the entire chain beneath it — high blast radius.
- **CRL expired** (the Certificate Revocation List wasn't re-published before its nextUpdate), so clients doing hard revocation checks reject everything.
- A high-value **leaf certificate expired** (wildcard, load-balancer, RADIUS server, code-signing, SAML signing) affecting many dependents.
- OCSP responder down/expired causing revocation-check failures.
- Renewal automation (ACME/autoenroll) silently broke; nobody noticed until expiry.
- Clock skew making valid certs appear not-yet-valid or expired.

## 3. Questions To Ask User
- When did failures start, and is there a known cert/CA/CRL expiry date matching that time?
- Is one service affected or many at once (the latter points to CA or CRL, not a leaf cert)?
- Which exact certificate is implicated — leaf, issuing CA, root CA, or the CRL/OCSP — and where is it published?
- Was anything changed recently (CA migration, automation change, time/NTP change)?
- Is this an internal PKI (AD CS, see l3-certificates-001) or a public/third-party CA, or both in the chain?
- What is the business impact and which services must come back first?
- Do we have the CA admin credentials/HSM access and (for public certs) the vendor/CA account to perform an emergency reissue?

## 4. Troubleshooting Steps
> L3 triage. CA-tier and HSM operations are senior/PKI-lead work. ARIA identifies the failing certificate/CRL and documents scope; it does not autonomously re-key or re-issue CA certificates.
1. **Inspect the actual chain** on a failing endpoint: identify which certificate in the chain (leaf → issuing CA → root) is expired/untrusted, and capture not-before/not-after dates and serials.
2. **Distinguish CA/CRL expiry from leaf expiry by blast radius.** Many unrelated services failing together strongly indicates a CA or CRL problem; a single service failing indicates a leaf cert.
3. **Check the CRL and OCSP.** Confirm CRL nextUpdate hasn't passed and the OCSP responder is healthy — an expired CRL alone can cause mass validation failures.
4. **Verify time/NTP** on clients and CA/responder; clock skew mimics expiry.
5. **Map the dependency surface** of the implicated cert/CA: which services, devices, VPN/Wi-Fi, code-signing, and federations rely on it. This scopes the emergency change.
6. **Confirm whether keys can be reused (renew/re-key with same key) or must be rotated**, and where the private keys/HSM live, before any reissue is attempted.

## 5. Resolution Steps
> Section 5 is for a senior engineer / PKI lead. Public-trust and HSM-backed CA operations require vendor/CA engagement — called out inline.
1. **Expired/expiring leaf certificate:** Renew or re-key it through the existing CA (internal AD CS per l3-certificates-001, or the public CA), deploy to all dependents, and restart/reload the consuming services.
2. **Expired CRL (fastest, highest-impact fix):** Re-publish a fresh CRL from the issuing CA to all CDP locations and confirm clients pick it up. This often restores mass functionality immediately without touching any leaf cert.
3. **Issuing (subordinate) CA expiry:** Renew the subordinate CA certificate from the root (renew with existing or new key per policy), publish the new CA cert into trust stores, then renew/re-issue leaf certs as needed. **PKI lead drives this; engage vendor if HSM-backed.**
4. **Root CA expiry (highest blast radius):** This is a planned, human-led operation — generate/renew the root, distribute the new root to all trust stores (GPO/MDM/manual), and **cross-sign** old↔new where possible so existing chains keep validating during transition. **Mandatory: PKI lead + management approval; vendor engagement for public roots and HSM.**
5. **Public/third-party certificate or CA:** Perform emergency reissue through the **public CA/vendor** account; you cannot self-sign these. Engage the vendor's emergency/expedited process.
6. **Restore the renewal automation** (ACME/autoenroll) so this does not recur, and document the new expiry dates.

## 6. Verification Steps
- Failing endpoints now present a complete, valid, in-date chain (leaf → issuing CA → root all trusted and unexpired).
- CRL shows a fresh nextUpdate and is reachable at every CDP; OCSP responder healthy; revocation checks pass.
- Affected services (TLS, VPN, 802.1x/RADIUS, code-signing, SAML/federation) all reconnect and operate.
- New root/issuing CA cert present in all required trust stores across the fleet (spot-check multiple OS/device types).
- No clients still pinned to or caching the old expired artifact; clocks/NTP in sync.
- Renewal automation re-enabled and a monitoring alert exists for upcoming expiries.

## 7. Escalation Trigger
Engage the PKI lead, certificate vendor/public CA, and management when a root or issuing CA is expired/expiring, when a lapsed CRL is causing fleet-wide failures, when a re-key/cross-sign or root distribution is needed, or when HSM-backed key operations are involved. Root CA renewal and cross-signing are planned, approval-gated, human-led operations — never improvise them under pressure alone.

## 8. Prevention Tips
- Maintain a monitored inventory of every CA, CRL, OCSP responder, and high-value leaf certificate with expiry alerting well in advance (multiple thresholds).
- Treat **CRL nextUpdate** as a monitored expiry too — lapsed CRLs cause outages as surely as expired certs.
- Plan root/issuing CA renewal windows years ahead; never let a CA reach its last months unmanaged.
- Automate leaf renewal (ACME/autoenroll) and alert when automation fails, not only when certs expire.
- Pre-stage and test cross-signing for root rollovers so transitions are seamless.
- Keep CA recovery procedures, HSM access, and vendor contacts documented and rehearsed (tie to l3-certificates-001 DR drills).
- Sync time/NTP everywhere; skew turns valid certs into outages.

## 9. User-Friendly Explanation
Digital certificates are like ID cards that let your systems trust each other and encrypt traffic. Each has an expiry date, and they're arranged in a chain — if the "master" card (the Certificate Authority) or the public "revocation list" expires, every ID card under it stops being trusted all at once, which is why so many things broke together. The fix is to renew the right card in the chain and make sure every device gets the updated trust information. For the top-level master certificate, we plan carefully and often run old and new in parallel so nothing drops while we transition, and for purchased certificates we go through the vendor.

## 10. Internal Technician Notes
- Blast radius is the diagnostic shortcut: many things failing at once = CA or CRL, not a leaf cert. Check the CRL nextUpdate early — re-publishing a CRL is often the fastest mass fix.
- Re-publishing a fresh CRL can restore validation immediately even before any cert is renewed — try it when an expired CRL is the cause.
- Root CA renewal = cross-sign + trust-store distribution + management approval. Don't attempt it ad hoc; coordinate with the PKI lead per l3-certificates-001.
- Public/third-party certs cannot be self-renewed — you must go through the issuing CA/vendor's emergency process.
- After resolution, fix the automation that allowed the expiry, and add/verify the expiry monitoring so it never recurs.
- Watch for hard-fail revocation checking: an OCSP/CRL outage can break valid certs; understand the clients' soft-fail vs hard-fail behavior.

## 11. Related KB Articles
- l3-certificates-001 — Internal PKI lifecycle, AD CS, autoenroll, OCSP
- l3-sso-saml-001 — Certificate validation in SAML / federation
- l3-security-001 — If expiry coincides with or masks a CA compromise
- l3-networking-001 — VPN/802.1x/RADIUS dependencies on certificates

## 12. Keywords / Search Tags
ca certificate expired, root ca expiry, issuing ca expiry, crl expired, mass validation failure, certificate renewal, rekey, cross-sign, code signing expiry, 802.1x failure, vpn certificate, tls handshake failure
