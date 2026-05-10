---
id: l3-certificates-001
title: "Internal PKI / cert lifecycle / autoenroll / OCSP"
category: certificates
support_level: L3
severity: high
estimated_time_minutes: 90
audience: technician
prerequisites: ["AD CS / PKI admin", "Network access to CA tier"]
os_scope: ["Windows Server"]
keywords:
  - pki
  - certificate authority
  - ad cs
  - autoenroll
  - crl
  - ocsp
  - subordinate ca
  - root ca
  - hsm
  - revoke
related_articles:
  - l3-sso-saml-001
  - l2-vpn-001
escalation_trigger: "CA compromise, root CA recovery, mass cert reissue"
last_updated: 2026-05-07
version: 1.0
---

# Internal PKI lifecycle

## 1. Architecture
- Offline Root CA (powered off, in safe).
- Online Subordinate Issuing CA(s) for day-to-day issuance.
- HSM-protected keys for any production CA.
- CRL Distribution Point (CDP) and AIA / OCSP responder published over HTTP (not LDAP) for broad reachability.
- Templates: device, user, code-signing, server-auth — each with appropriate key length, validity, EKUs.

## 2. Common operations
**Auto-enrollment for users / devices:**
- Configure GPO: Computer Configuration → Windows Settings → Security Settings → Public Key Policies → Certificate Services Client - Auto-Enrollment.
- Template ACL: Read + Enroll + Autoenroll for the security group.
- Renewal threshold typically at 80% of validity.

**Revocation:**
- `certutil -revoke <serial>` then publish CRL: `certutil -CRL`.
- Verify CRL published to CDP URL.
- For public-trust certs, contact issuing CA.

**Reissue compromised CA:**
- Document scope.
- Issue new offline root if root compromised.
- Re-issue subordinates.
- Mass reissue endpoint certs.
- Mass deploy new root cert via GPO.
- Old CRLs continue to apply until expiry.

**OCSP responder:**
- High-availability OCSP saves CRL download bandwidth.
- Configure `Online Responder` role; revocation provider points to CA database.

## 3. Verification
- New cert template enrolls cleanly.
- Revocation propagates within CRL publishing interval.
- OCSP responder green; clients hit it (not CRL) for typical revocation checks.
- Audit log captures issuance + revocation.

## 4. Escalation
- CA compromise — full IR + new infrastructure.
- HSM failure — vendor recovery.
- Cross-forest trust cert chain breakage.

## 5. Prevention
- Offline root, never connected.
- HSM for issuing CA keys.
- Quarterly DR drill: simulate sub-CA failure + recovery.
- Document templates + ACLs in source control.
- Cert lifecycle monitoring (Keyfactor, Venafi, or PowerShell).
- Don't let any cert (server or sub-CA) silently expire.

## 6. Notes
- Root CA validity 20 years typical; sub-CA 10 years; end-entity 1–3 years.
- Don't issue SHA-1; modern CAs SHA-256+.
- Avoid wildcard certs unless necessary; SAN-based preferred.
- Public + private trust mixed: maintain separation; no public chain on internal HTTPS endpoints unless required.

## 7. Related Articles
- l3-sso-saml-001 — Cert validation in SAML
- l2-vpn-001 — VPN cert chain

## 8. Keywords
pki, certificate authority, ad cs, autoenroll, crl, ocsp, subordinate ca, root ca, hsm, revoke
