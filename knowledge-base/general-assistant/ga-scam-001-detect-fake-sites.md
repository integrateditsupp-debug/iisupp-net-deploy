---
id: ga-scam-001
title: "Detecting fake / scam websites and phishing pages"
category: scam-detection
support_level: GA
severity: high
estimated_time_minutes: 5
audience: end-user
os_scope: ["Multi-platform"]
keywords:
  - scam website
  - fake site
  - phishing
  - look-alike domain
  - typo squat
  - is this site safe
  - whois
  - trustpilot
related_articles:
  - l1-email-001
  - ga-shopping-001
last_updated: 2026-05-07
version: 1.0
---

# Detecting fake / scam websites

## 1. Fast checks (ARIA does these silently)
- **Padlock + HTTPS:** required, not sufficient. Scammers also have HTTPS now.
- **Domain age:** WhoIs registration <90 days ago = elevated risk for retail.
- **URL look-alikes:** `amaz0n.com`, `paypa1.com`, `microsoft-update.com`. Read the domain character by character.
- **Trustpilot / BBB / Sitejabber:** quick reputation check.
- **Google "site_name scam":** if it's a known scam, others have written about it.

## 2. Content red flags
- Spelling / grammar errors throughout.
- Stock photos used as "team" or "office".
- No physical address, or address that geocodes to empty land / a UPS store.
- Email is `gmail.com` instead of `@theirdomain.com`.
- Claims to be official but URL doesn't match (e.g., "Microsoft Support" page on a `.tk` domain).
- Pop-up "your computer is infected, call this number" — ALWAYS scam.
- "We are auditing your account, log in to verify" — phishing.

## 3. Behavioral red flags
- Asks for: banking password, MFA codes, gift cards, wire transfer, crypto.
- Pressures urgency: "expires in 30 minutes".
- Threatens consequences: "your account will be frozen".
- Asks you to install software or enter remote-control codes.

## 4. ARIA's response patterns
- **High confidence scam:** "I don't recommend continuing — this site has multiple signs of being fake. Want me to find the real version?"
- **Medium suspicion:** "I'd like to double-check this one. May I look at a few things?"
- **No evidence either way:** "Let me look into the seller before you buy. Give me a minute."

## 5. If the user already entered info
- Stop them from entering more.
- For password reuse: change the affected password everywhere it's used.
- For credit card: call card-issuer fraud line, dispute the charge, request new card.
- For SSN / ID: place fraud alert with credit bureaus, monitor for new accounts.
- Document the incident for police / FTC report.

## 6. Tools (free, public)
- VirusTotal — paste URL, see reputation across vendors.
- Google Safe Browsing — built into Chrome / Edge.
- Microsoft Defender SmartScreen.
- ICANN Lookup / WHOIS for domain age.

## 7. Related
- l1-email-001 — Phishing emails
- ga-shopping-001 — Buying safely

## 8. Keywords
scam website, fake site, phishing, look-alike domain, typo squat, is this site safe, whois, trustpilot
