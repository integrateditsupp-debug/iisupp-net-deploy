---
id: stub-ivanti-secure
title: "Ivanti Secure Access (Pulse Secure) VPN (stub)"
category: vpn
support_level: L2
status: stub
keywords: [ivanti, ivanti secure access, pulse secure, vpn, won't connect, disconnects, install, certificate]
---
## Won't connect
- Confirm internet works without VPN. Verify the exact connection URL/profile from IT.
- Re-enter credentials + MFA; check the system clock (cert/MFA fail on wrong time).
- Restart the Ivanti Secure Access service/client; reboot if needed.
## Keeps disconnecting
- Check Wi-Fi stability; disable conflicting VPNs; update the client to the IT-approved version.
- Certificate expired/untrusted → reissue/reinstall the client cert.
## Install / reinstall
- Uninstall old Pulse/Ivanti fully → reboot → install the IT-provided package → import the connection profile/URL.
## Escalate
- Auth works but no resource access, gateway/realm errors, or cert issues → network/VPN admin.
