---
id: l2-mail-auth-001
title: "Email authentication: SPF, DKIM, and DMARC setup and troubleshooting"
category: email
support_level: L2
severity: high
estimated_time_minutes: 45
audience: it-technician
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["spf record","dkim setup","dmarc policy","email going to spam","domain being spoofed","spf 10 lookup limit","dkim selector cname","dmarc p=reject","email authentication failing","mail rejected external","txt record email","dmarc rua report","spf softfail hardfail","email spoofing protection","quarantine vs reject"]
related_articles: ["l2-mail-auth-002","l1-email-001","l2-dns-002","l2-m365-mailflow-001"]
escalation_trigger: "Legitimate business mail is being rejected/quarantined by a strict DMARC or third-party policy and the sending source cannot be authenticated without changes to a system outside IT's control."
last_updated: 2026-06-24
version: 1.0
---

# Email authentication: SPF, DKIM, and DMARC

## 1. Symptoms
- Outbound mail lands in recipients' Junk/Spam folders.
- Recipients report receiving spoofed mail "from" your domain.
- External systems bounce your mail with "SPF fail," "DKIM fail," or "DMARC reject."
- A newly added sending service (CRM, ticketing, marketing tool, scanner-to-email) suddenly fails to deliver.
- DMARC aggregate reports show large volumes of unauthenticated mail.

## 2. Likely Causes
1. **SPF** missing, incomplete (a sending service not listed), or exceeding the 10 DNS-lookup limit (PermError).
2. **DKIM** not enabled, wrong/rotated selector, or CNAMEs not published.
3. **DMARC** absent (no spoofing protection) or set too strict before all sources are authenticated.
4. **Alignment** failure — SPF/DKIM technically pass but on a domain that doesn't match the visible From address.
5. Multiple SPF TXT records on the domain (only one is allowed).
6. A new or rogue sender not authorized in any of the three records.

## 3. Questions To Ask User
1. What exactly is the complaint — your mail going to spam, your domain being spoofed, or a specific recipient rejecting you?
2. What is the affected sending domain, and what services send mail as that domain (M365/Google, CRM, marketing platform, app/relay, copier scan-to-email)?
3. Has anything changed recently — new vendor, DNS edit, domain migration?
4. Can you provide a sample bounce/NDR or a recent DMARC aggregate report?
5. Who controls DNS for the domain, and do you have edit access?

## 4. Troubleshooting Steps
1. **Inventory senders.** List every system that sends as the domain. SPF/DKIM/DMARC only protect mail you account for.
2. **Read current records** with public DNS lookups (an MXToolbox-style SPF/DKIM/DMARC lookup, or `nslookup -type=txt yourdomain`).
3. **Check SPF:** confirm exactly **one** TXT record beginning `v=spf1`; confirm each sending service's `include:` is present; count DNS lookups (each `include`, `a`, `mx`, `ptr`, `exists`, `redirect` counts) — must stay **≤ 10** or you get PermError.
4. **Check DKIM:** for each selector, query `selector._domainkey.yourdomain` and confirm the CNAME/TXT resolves and signing is enabled at the provider.
5. **Check DMARC:** query `_dmarc.yourdomain` for a `v=DMARC1` record; note the `p=` policy and whether reporting (`rua`) is configured.
6. **Check alignment:** in a failing sample, compare the From-header domain to the SPF (Return-Path/MailFrom) domain and the DKIM `d=` domain. DMARC passes only if at least one is **aligned** to the From domain.

## 5. Resolution Steps
**SPF — build/repair the record:**
- One TXT record only: `v=spf1 include:spf.protection.outlook.com include:_spf.google.com ip4:203.0.113.10 -all` (use only the includes/IPs your senders actually need).
- `~all` = SoftFail (mark suspicious); `-all` = HardFail (reject). Start with `~all` while validating, move to `-all` once all senders are confirmed.
- If over 10 lookups: remove unused includes, replace bulky includes with specific `ip4:`/`ip6:` entries, or flatten/consolidate. Never publish two `v=spf1` records.

**DKIM — enable signing:**
- At the mail provider, enable DKIM for the domain; it generates one or more **selectors**.
- Publish the provider's **CNAME** records (e.g. `selector1._domainkey` → provider host) or the TXT public key.
- Turn signing **on** only after the DNS records resolve. Rotate selectors per provider guidance; keep old selector live until rotation completes.

**DMARC — deploy gradually:**
1. Start monitoring: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain; fo=1`.
2. Read aggregate (`rua`) reports for ~2–4 weeks; identify and authenticate every legitimate source via SPF/DKIM until they show **aligned pass**.
3. Tighten to `p=quarantine` (optionally with `pct=` ramp), then to `p=reject` once reports are clean.
4. Optionally add `ruf=` for forensic/failure reports and `aspf`/`adkim` for strict alignment if needed.

**Diagnose specific complaints:**
- *Mail to spam:* ensure SPF + DKIM both pass and align; missing DKIM is a common cause.
- *Being spoofed:* a `p=reject` DMARC (once legit mail is authenticated) is what stops spoofing.
- *External mail rejected:* find which check failed in the bounce, authenticate that source, or correct alignment.

## 6. Verification Steps
- Send a test to an external mailbox and inspect headers: `Authentication-Results` shows `spf=pass`, `dkim=pass`, `dmarc=pass`.
- SPF lookup count is ≤ 10 with no PermError; exactly one `v=spf1` record exists.
- DKIM selector(s) resolve and the test message is signed with `d=` aligned to the From domain.
- DMARC aggregate reports over the following days show legitimate sources passing and unauthorized sources failing.
- Spoofing test (where authorized) is rejected/quarantined per the policy.

## 7. Escalation Trigger
- Legitimate mail is still rejected because a sending source cannot be authenticated without changes in a system you don't control (vendor/relay).
- DNS is managed by an external party and edits cannot be made in a reasonable window.
- DMARC `p=reject` cannot be safely reached because an unknown high-volume legitimate sender remains. Escalate to **L3 / email architecture** with the sender inventory and recent reports.

## 8. Prevention Tips
- Maintain a living inventory of all systems authorized to send as each domain; update SPF/DKIM whenever a vendor is added or removed.
- Always deploy DMARC at `p=none` first and let reports guide tightening — never jump straight to `p=reject`.
- Keep SPF well under the 10-lookup limit; prefer specific IPs over chains of includes.
- Subdomains and parked/non-sending domains should also carry DMARC (`p=reject`) to block lookalike abuse.
- Document selector rotation schedules so DKIM never silently breaks.

## 9. User-Friendly Explanation
"These three records prove your mail is really from you. SPF lists the servers allowed to send on your behalf, DKIM stamps each message with a tamper-proof signature, and DMARC tells the world what to do if a message fails those checks — and emails you reports of who's pretending to be you. Set them up correctly and your legitimate mail stops landing in spam while impostors get blocked."

## 10. Internal Technician Notes
- DMARC alignment: SPF aligns on the **MailFrom/Return-Path** domain; DKIM aligns on the **`d=`** domain. Forwarding breaks SPF (Return-Path rewrites) but DKIM usually survives — this is why DKIM is the more durable signal and why DMARC needs only one aligned pass.
- SPF lookup limit is **10 DNS mechanisms** (not 10 records); exceeding it yields PermError and a DMARC fail on the SPF side. `void` lookups also count toward limits per RFC 7208.
- `~all` SoftFail vs `-all` HardFail: many receivers treat both leniently, so DMARC `p=reject` is what actually enforces rejection — SPF alone is not sufficient anti-spoofing.
- Use the aggregate `rua` XML reports (via a parser or DMARC service) to enumerate sources; raw XML is unreadable at volume.
- M365: DKIM under Defender/Exchange admin (rotate to 2048-bit). Google Workspace: DKIM under Apps → Gmail → Authenticate email. Both publish selector CNAMEs/TXT in DNS.
- Beware BIMI and MTA-STS as adjacent topics — BIMI typically requires DMARC at enforcement first.

## 11. Related KB Articles
- l2-mail-auth-002 — Diagnosing mail flow and NDR/bounce codes
- l1-email-001 — Reporting suspicious/phishing email
- l2-dns-002 — Editing public DNS records (TXT/CNAME/MX)
- l2-m365-mailflow-001 — Exchange Online mail flow and connectors

## 12. Keywords / Search Tags
spf record, dkim setup, dmarc policy, email going to spam, domain being spoofed, spf 10 lookup limit, dkim selector cname, dmarc p=reject, alignment fail, dmarc rua report, mail rejected external, quarantine vs reject, txt record email
