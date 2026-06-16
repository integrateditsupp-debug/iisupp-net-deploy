# ARIA KB — Triage & Routing Rules

Used by ARIA's orchestrator to map an incoming user utterance to the right
support level and KB article(s). Rules fire in order — first match wins
unless explicitly multi-tagged.

---

## Routing principles

1. **Classify intent before knowledge retrieval.** The user's request is one of:
   - IT troubleshooting (L1/L2/L3)
   - General assistance (GA — shopping, scams, seniors, education)
   - Pure information / explanation (no action)
   - Out of scope (refer or politely decline)

2. **Default to L1.** Promote to L2/L3 only on explicit signals (admin context,
   error codes, scope of impact, user identity).

3. **Always retrieve at least one article** before answering. Generic answers
   without a KB anchor are forbidden.

4. **Escalate, don't speculate.** If no article fits, surface that explicitly
   to the user and offer human handoff.

---

## Classification heuristics

### Signals that promote to L2
- Error codes: `0x8004`, `AADSTS5`, `0x800CCC`, `STOP 0x`, `BugCheck`.
- Admin language: "tenant", "policy", "GPO", "Intune", "Conditional Access".
- Scope: "all our users", "everyone in finance", "the whole office".
- Domain context: domain-joined PC, Active Directory, on-prem servers.

### Signals that promote to L3
- "Architecture", "design", "strategy", "rollout".
- Security incidents: "ransomware", "breach", "compromise", "exfil".
- Cross-tenant / multi-site / DR scenarios.
- Vendor escalation language.

### Signals that route to GA
- "How do I buy", "is this site safe", "compare X vs Y".
- "My grandma", "help my mom" — senior support.
- Shopping URLs pasted in.
- "Explain X like I'm 5".

---

## Symptom → Article quick map

| User says (paraphrase) | Likely article(s) |
|---|---|
| Blue screen | l1-windows-001 |
| Can't boot / spinning dots | l1-windows-002 |
| PC slow / laggy | l1-windows-003 |
| Disk full / out of space | l1-windows-004 |
| App crashes / won't open | l1-windows-006 |
| No sound | l1-windows-005 |
| Can't sign in to Office | l1-m365-001 |
| Office says "unlicensed" | l1-m365-002 |
| Outlook missing emails | l1-outlook-001 |
| Outlook can't send | l1-outlook-002 |
| Teams no audio | l1-teams-001 |
| Teams won't load | l1-teams-002 |
| OneDrive not syncing | l1-onedrive-001 |
| Restore deleted file | l1-onedrive-002 |
| OneDrive duplicate file | l1-onedrive-003 |
| Wi-Fi not working | l1-wifi-001 |
| Printer not printing | l1-printer-001 |
| Printer prints garbage | l1-printer-002 |
| MFA / lost phone | l1-mfa-001 |
| Forgot password | l1-password-001 |
| VPN won't connect | l1-vpn-001 |
| Browser won't load site | l1-browser-001 |
| Suspicious email / phishing | l1-email-001 → l3-security-001 if clicked |
| Conditional Access block | l2-azure-ad-001 |
| Device non-compliant | l2-intune-001 |
| Account keeps locking | l2-active-directory-001 |
| BitLocker recovery prompt | l2-bitlocker-001 |
| VPN gateway / cert | l2-vpn-001 |
| DNS resolution failing | l2-dns-001 |
| DHCP scope full | l2-dhcp-001 |
| Malware / virus | l2-malware-001 → l3-security-001 if ransomware |
| RDP / RDS issues | l2-rdp-001 |
| SharePoint permission | l2-sharepoint-001 |
| Driver fleet rollback | l2-drivers-001 |
| New user onboarding | l2-onboarding-001 |
| User offboarding | l2-offboarding-001 |
| Print server / Universal Print | l2-printers-001 |
| Mail flow / NDR | l2-exchange-001 |
| User profile rebuild | l2-windows-001 |
| Performance traces (WPA) | l2-performance-001 |
| NTFS / share permissions | l2-permissions-001 |
| ASR rules tuning | l2-endpoint-001 |
| Device deployment / Autopilot | l2-deployment-001 |
| Network latency / loss | l2-networking-001 |
| Cyber incident (P1) | l3-security-001 |
| SSO / SAML federation | l3-sso-saml-001 |
| Internal PKI / certs | l3-certificates-001 |
| Disaster recovery | l3-disaster-recovery-001 |
| Windows Server roles | l3-server-001 |
| Network architecture | l3-networking-001 |
| Azure tenant design | l3-cloud-001 |
| EDR / WDAC strategy | l3-endpoint-001 |
| Hybrid AD / AAD Connect | l3-hybrid-ad-001 |
| Immutable backup design | l3-backup-dr-002 |
| MSP architecture | l3-enterprise-001 |
| Online shopping help | ga-shopping-001 |
| Compare products | ga-shopping-002 |
| Is this site fake/scam | ga-scam-001 |
| Safe checkout / payment | ga-checkout-001 |
| Vet a vendor | ga-vendor-research-001 |
| Book an appointment | ga-booking-001 |
| Fill out a form | ga-form-filling-001 |
| Help a senior | ga-senior-001 |
| Explain X simply | ga-explanation-001 |
| Personal budgeting | ga-budgeting-001 |

---

## Multi-article patterns

Some user requests pull multiple articles:

- **"Email from my bank looks weird, I clicked it"** →
  l1-email-001 (immediate report) + ga-scam-001 (educate) + l3-security-001 (if creds entered)

- **"My laptop is slow and crashes"** →
  l1-windows-003 + l1-windows-001 + l2-performance-001 (if persistent)

- **"My mom can't sign in to her email and got an email saying her account is compromised"** →
  ga-senior-001 (tone) + ga-scam-001 (likely scam) + l1-password-001 (only if email is real)

---

## Hard fallbacks

- If no KB article matches with high confidence, say so. Don't fabricate.
- For destructive admin actions (BitLocker decrypt, AD reset, mass delete),
  always require explicit user confirmation with a clear summary of impact.
- For anything matching `l3-security-001` triage criteria, pause and surface
  the option to engage human IR — don't try to walk a possibly-compromised
  user through full remediation alone.
