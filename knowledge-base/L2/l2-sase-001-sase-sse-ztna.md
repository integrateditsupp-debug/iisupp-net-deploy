---
id: l2-sase-001
title: "SASE, SSE, and ZTNA fundamentals and troubleshooting"
category: network-security
support_level: L2
severity: high
estimated_time_minutes: 40
audience: it-technician
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["sase","sse","ztna","zero trust network access","ztna vs vpn","secure web gateway","casb","fwaas","ztna agent not connecting","cant reach internal app","posture policy blocking","split tunnel issue","sase client certificate","private app unreachable","identity policy denied"]
related_articles: ["l2-vpn-001","l2-dns-001","l2-azure-ad-001","l2-network-troubleshoot-001"]
escalation_trigger: "A ZTNA private-application connector or the SASE/SSE vendor cloud is down, or policy changes are required that exceed local administrative scope."
last_updated: 2026-06-24
version: 1.0
---

# SASE, SSE, and ZTNA fundamentals and troubleshooting

## 1. Symptoms
- The SASE/SSE agent shows "disconnected," "connecting," or "captive portal" and never goes green.
- A specific internal (private) application is unreachable, while internet browsing works (or vice versa).
- User is blocked at sign-in with an "access denied / device not compliant / posture failed" message.
- Some sites are blocked or decrypted unexpectedly (SWG/inspection policy).
- Performance is poor or certain apps break only when the agent is on.

## 2. Likely Causes
1. **Agent/tunnel:** agent not running, not enrolled, expired token, or unreachable PoP/edge.
2. **Identity:** user not in the access policy group, or IdP/SSO/MFA step failed.
3. **Posture/compliance:** device fails a posture check (OS version, disk encryption, AV/EDR, certificate).
4. **Private app reachability:** the ZTNA **connector** to that app/segment is down or the app isn't defined in policy.
5. **Inspection/TLS:** SWG TLS-decryption breaks an app due to certificate pinning or a missing root CA on the device.
6. **Routing:** split-tunnel misconfig, DNS resolving private names to the wrong place, or overlapping subnets.

## 3. Questions To Ask User
1. What does the agent status say exactly, and what is the error/code?
2. Is **everything** broken (no internet) or only a specific app/site?
3. Are you signed in to the agent with your work identity, and did MFA succeed?
4. On-network (office) or remote? Wired, Wi-Fi, hotspot, or behind another VPN?
5. When did it last work, and did anything change (new laptop, OS update, password change, travel)?

## 4. Troubleshooting Steps
1. **Confirm the layer.** SSE = SWG + CASB + ZTNA + FWaaS (the security cloud). SASE = SSE + SD-WAN (adds the network/transport). ZTNA = the private-app access piece. Decide whether the issue is internet egress (SWG), a SaaS control (CASB), or private-app access (ZTNA).
2. **Agent health:** confirm the client is running, enrolled, and showing a healthy edge/PoP. Restart the agent; check it can reach the vendor cloud (the agent usually shows the connected PoP).
3. **Identity:** verify the user is signed in with the correct identity and is a member of the policy/group granting the app. Re-auth if the session/token expired.
4. **Posture:** check the device-posture/compliance result. Confirm OS version, disk encryption, EDR/AV running, and any required device certificate are present and valid.
5. **Private app path (ZTNA):** confirm the app is defined as a private application in policy, the **connector** serving its segment is healthy, and DNS for the app's hostname resolves via the ZTNA service (not public DNS to a dead IP).
6. **Inspection/TLS:** if only certain HTTPS apps break, suspect TLS decryption — confirm the SWG root CA is installed/trusted and add cert-pinned apps to a do-not-decrypt/bypass list.
7. **Routing/split-tunnel:** verify the app's subnet/hostname is in the tunnel's include list and there are no overlapping RFC1918 ranges or a competing VPN.

## 5. Resolution Steps
**A. Agent won't connect:**
1. Restart agent; if still failing, re-enroll/re-authenticate the device.
2. Verify outbound reachability to the vendor's PoP/cloud (corporate firewall/proxy may block required ports/FQDNs — allow them).
3. Clear a captive-portal state on hotel/guest Wi-Fi (open a plain HTTP site to trigger the portal, authenticate, then reconnect).

**B. "Can't reach internal app" (ZTNA triage):**
1. Confirm the **app is published** in the ZTNA policy and the user/group is **entitled**.
2. Confirm the **connector** for that app's network segment is online (vendor console shows connector health).
3. Resolve the app's hostname while connected — it should resolve to the ZTNA service, not a public/stale IP.
4. Verify posture is passing; a posture failure silently removes entitlement to sensitive apps.
5. Test from a second known-good user to isolate user-specific vs app-wide.

**C. Access denied / posture/identity block:**
1. Read the policy decision in the vendor logs (which rule denied, on what attribute).
2. Remediate the failing posture attribute (update OS, enable encryption, restart EDR, reissue cert) or correct group membership.
3. Re-evaluate posture / re-sign-in and retest.

**D. App breaks only with agent on (inspection):**
1. Identify if TLS decryption is applied; install/trust the SWG root CA on the device.
2. Add cert-pinned or sensitive apps (banking, native clients) to a **bypass/no-decrypt** policy.

## 6. Verification Steps
- Agent shows **connected** to a healthy PoP with the correct identity.
- The previously failing app loads and functions end-to-end while connected.
- Vendor policy logs show an **allow** decision for the user/app with posture **pass**.
- Internet egress and the private app both work without one breaking the other.
- A second user reproduces success, confirming the fix is policy/infra-level not local.

## 7. Escalation Trigger
- A **ZTNA connector** or the SASE/SSE **vendor cloud/PoP** is down (app-wide outage). Escalate to **L3 / vendor support** with connector IDs and timestamps.
- Required policy, group entitlement, or posture-baseline changes exceed your administrative scope.
- TLS-decryption breakage requires a global do-not-decrypt change or PKI work.

## 8. Prevention Tips
- Document each published private app: hostname(s), segment, owning connector, and entitled groups.
- Deploy connectors in **redundant pairs** per segment so a single connector failure doesn't black-hole an app.
- Pre-stage the SWG root CA and required posture (encryption, EDR, OS baseline) in the device image so new endpoints pass on day one.
- Roll out policy changes to a pilot ring first; keep a maintained do-not-decrypt list for known cert-pinned apps.
- Monitor connector/PoP health and policy-deny trends proactively, not reactively.

## 9. User-Friendly Explanation
"SASE/SSE replaces the old 'connect to the VPN and you're inside the whole network' model. Instead, every time you open an app, the service checks who you are and whether your device is healthy, then connects you to **only that app** — nothing else. So if one app won't open while everything else works, it's usually a permission, device-health, or app-routing check, not a broken internet connection. We look at the access logs to see exactly which check said no, and fix that."

## 10. Internal Technician Notes
- ZTNA vs legacy VPN: VPN grants broad network-layer access after one auth; ZTNA grants per-application, identity- and posture-aware access with continuous evaluation and no inbound exposure (outbound connectors only). Reduces lateral movement.
- Triage order for "can't reach internal app": entitlement → connector health → DNS/name resolution via the service → posture → inspection/bypass → routing/overlap. Most app-specific failures are connector or entitlement; most "everything broken" failures are agent/PoP reachability.
- Captive portals and double-VPN/host-firewall stacks are frequent remote-user culprits.
- TLS decryption: cert-pinned native apps (and some auth flows) fail inspection — maintain a curated bypass list rather than disabling inspection globally.
- DNS is a common silent failure: private hostnames must resolve through the ZTNA path; split-DNS or public resolution to a dead IP looks like an "app down."

## 11. Related KB Articles
- l2-vpn-001 — Legacy VPN client connection issues
- l2-dns-001 — Internal DNS resolution problems
- l2-azure-ad-001 — Conditional Access / identity policy blocks
- l2-network-troubleshoot-001 — Structured network triage methodology

## 12. Keywords / Search Tags
sase, sse, ztna, zero trust network access, ztna vs vpn, secure web gateway, casb, fwaas, agent not connecting, cant reach internal app, posture policy blocking, split tunnel, client certificate, connector down, identity denied
