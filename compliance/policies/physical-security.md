# Physical Security Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual

## Purpose

Address physical security controls applicable to Integrated IT Support Inc. operations. Aligned with SOC 2 CC6.4, NIST SP 800-53 PE family, ISO 27001 A.11.

## Scope

- Inherited controls: cloud sub-processors (Netlify, DigitalOcean) provide datacenter physical security.
- Operational controls: personnel workspace, devices, removable media.

## Datacenter physical security (inherited)

Integrated IT Support Inc. operates entirely on third-party cloud infrastructure. Physical security at processing facilities is delivered by:

| Sub-processor | Region | Physical security cert |
|---|---|---|
| Netlify | US (multi-region) | SOC 2 Type II + ISO 27001 |
| DigitalOcean | Canada (Toronto) | SOC 2 Type II + ISO 27001 |
| Stripe | US | SOC 2 Type II + ISO 27001 + PCI-DSS L1 |

Customers may request the relevant sub-processor's SOC 2 reports through ARIA Provider via integrateditsupp@iisupp.net.

## Personnel workspace

- **Home office / remote work:** personnel agree to maintain secure workspace.
- **Screen lock:** required when unattended (auto-lock at ≤ 5 min idle).
- **Physical access to workstations:** restricted to authorized user.
- **Visitors:** prohibited from accessing workstations with active ARIA Provider sessions.

## Endpoint devices

All devices used to access ARIA Provider systems must:
- Have full-disk encryption (BitLocker on Windows, FileVault on macOS, LUKS on Linux).
- Use MFA / biometric / passcode for login.
- Auto-lock after idle.
- Run supported / patched OS.
- Have anti-malware enabled (Defender, XProtect, or third-party).
- Be enrolled in MDM (Intune deployment planned Q4 2026).

## Removable media

- USB drives, SD cards, external HDDs: prohibited for confidential data unless encrypted and approved.
- Bluetooth: disabled when not in use.

## Equipment disposal

When personnel offboard or replace equipment:
- Disk drives wiped per NIST 800-88 secure erasure standard.
- Devices returned per asset list.
- Personnel-owned devices: ARIA Provider data certified deleted by personnel.

## Travel security

When traveling with devices:
- Avoid leaving in unattended vehicles.
- Use privacy screen filter in public places.
- Connect via VPN when on untrusted networks.
- Customs / border: power off; comply with lawful requests; notify CISO of any data access.

## Office security (if any)

Integrated IT Support Inc. is currently fully remote. If a physical office is established:
- Access controlled via badge / smart lock.
- Visitor log maintained.
- Confidential discussions in private rooms.
- Clean desk policy.
- Locked storage for confidential documents.

## Incident reporting

Lost / stolen devices: report to CISO within 1 hour. Immediate remote wipe + credential rotation.

## Related

- `compliance/policies/access-control.md`
- `compliance/policies/incident-response.md`
- `compliance/SOC2-controls-self-assessment.md` CC6.4 + CC6.5
