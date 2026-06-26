# Google Workspace Setup Guide — iisupp.net Sending Domain

**Total time:** ~30 minutes today + 7–10 days warmup.
**Cost:** $7/user/month (Business Starter plan).
**Why it matters:** Sending from `ahmad@iisupp.net` vs `integrateditsupp@gmail.com` will roughly **5x your reply rate** on B2B outreach. Without this, 90% of your DFW prospects' corporate spam filters bin you before you arrive.

---

## Step 1 — Sign up for Google Workspace (10 min)

1. Go to https://workspace.google.com → click **Get started**.
2. Plan: **Business Starter** ($7/user/mo).
3. Business name: `Integrated IT Support Inc.`
4. Number of employees: 1–9
5. Region: United States (use a US address for CAN-SPAM compliance; rent a virtual mailbox in TX if needed — anytimemailbox.com, $10/mo).
6. Current email: `integrateditsupp@gmail.com`
7. Domain: select **Use a domain you already own** → enter `iisupp.net`.
8. Create your business username: `ahmad@iisupp.net`.
9. Set a strong password. Enable 2FA immediately after first login.
10. Enter payment. Skip the optional add-ons.

---

## Step 2 — Verify domain ownership (5 min)

Google will give you a TXT record to add at your DNS host (likely Namecheap, GoDaddy, Cloudflare, or wherever iisupp.net is registered).

1. Log into your DNS provider's control panel.
2. Add the **TXT record** Google provides (looks like `google-site-verification=...`).
3. Back in Workspace setup, click **Verify**.

If you're on Netlify DNS (since you mentioned Netlify), the DNS records go in Netlify → Domain Settings → iisupp.net → DNS records.

---

## Step 3 — Add the MX, SPF, DKIM, DMARC records (10 min)

These four records are what get your mail past corporate spam filters. **All four are required.** Sending without DKIM and DMARC = guaranteed spam folder.

### MX records (route mail TO your domain)

| Priority | Host | Value |
|---|---|---|
| 1 | @ | smtp.google.com |

(Modern Workspace uses a single MX record. If your DNS host shows the legacy 5-record setup, that also works.)

### SPF record (says Google can send FROM your domain)

| Type | Host | Value |
|---|---|---|
| TXT | @ | `v=spf1 include:_spf.google.com ~all` |

### DKIM record (cryptographic signature)

1. In Workspace Admin → Apps → Google Workspace → Gmail → **Authenticate email**.
2. Click **Generate new record** for `iisupp.net`.
3. Copy the TXT record (host is `google._domainkey`, value is a long string starting with `v=DKIM1; k=rsa; p=...`).
4. Add that TXT record at your DNS provider.
5. Back in Admin, click **Start authentication**.

### DMARC record (policy enforcement)

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ahmad@iisupp.net; pct=100; adkim=s; aspf=s` |

Start with `p=none` so you can see reports without bouncing legitimate mail. Move to `p=quarantine` after 14 days of clean reports.

---

## Step 4 — Warm up the domain (7–10 days, automated)

A brand-new sending domain that suddenly emails 30 strangers/day = instant spam classification. Warmup = sending small volumes to inboxes that auto-reply and mark as "important," teaching Gmail/Outlook your domain is trustworthy.

**Pick one warmup tool (all ~$30–$50/mo, cancellable):**

- **Lemwarm** — https://lemwarm.com — recommended for cold-outreach use case
- **Mailwarm** — https://mailwarm.com — solid alternative
- **Warmup Inbox** — https://warmupinbox.com — cheapest entry tier

**Settings:**
- Start: 5 sends/day
- Ramp: +3/day until you hit 40/day
- Duration: 10 days minimum before any real cold sends

While warming, you can still **manually email known contacts** from ahmad@iisupp.net — Apollo prospect lists go through warmup gating only.

---

## Step 5 — Pre-flight check before first cold send

- [ ] Send a test email from ahmad@iisupp.net to a Gmail and Outlook address you control
- [ ] Verify it lands in **Primary inbox**, not Promotions or Spam
- [ ] Check headers (click "Show original" in Gmail) — confirm SPF=PASS, DKIM=PASS, DMARC=PASS
- [ ] Run https://mail-tester.com → forward your test email there → score must be **9.0/10 or higher**
- [ ] Set up signature in Gmail: name, title, phone, website, physical address
- [ ] Set up CAN-SPAM-compliant footer in every cold email: physical address + clear opt-out

---

## CAN-SPAM compliance footer (paste into all cold emails)

```
---
Integrated IT Support Inc. | [Your physical address — virtual mailbox OK]
You're receiving this because we believe IIS may be a fit for your operations.
Reply "unsubscribe" and I'll remove you immediately.
```

---

## Cost summary

| Item | Cost | Frequency |
|---|---|---|
| Google Workspace Business Starter | $7 | per month |
| Warmup tool (Lemwarm or similar) | $30–$50 | per month, cancel after warmup or keep for ongoing health |
| Virtual mailbox (Texas address) — optional | $10 | per month |
| **Total starting cost** | **$47–$67** | **per month** |

ROI math: one $3K/mo retainer closed = 53–64x payback in month 1. This is the cheapest leverage in the entire campaign.

---

## What to do RIGHT NOW (priority order)

1. Sign up for Workspace ahead of tomorrow's Cowork run (Step 1) — 10 min.
2. Add the DNS records (Steps 2–3) — 15 min.
3. Sign up for Lemwarm and connect the new inbox (Step 4) — 5 min.
4. Reply in Cowork chat with the message: "Workspace live, warmup running."
5. Tomorrow's scheduled task will gate full send volume on this confirmation.

If you can't complete this tonight, no panic — the scheduled task will still run tomorrow, but it will cap volume at 10 hyper-personalized Gmail sends rather than 30–50 from Workspace.

## Related

<!-- LINK-WEB:auto -->
- [[campaign-plan]]
- [[campaign-status]]
- [[day-2-batch-plan]]
- [[email-templates]]
- [[iisupp_14day_followup_sequence]]
- [[iisupp_20_accounts_full_list]]
- [[iisupp_5_seed_emails]]
- [[iisupp_case_study_aria]]
- [[iisupp_offer_tiers]]
- [[iisupp_usa_exposure_playbook]]
- [[INDEX]]
- [[linkedin-connection-requests-today]]
- [[linkedin-outreach-playbook]]
- [[proposal-one-pager]]
- [[prospects-dfw-batch-2026-05-13]]
- [[prospects-dfw-day2-batch]]
- [[prospects-dfw-day4-batch]]
- [[prospects-dfw-today-batch]]
- [[prospects-dfw-today-batch-v2]]
- [[READ_ME_FIRST]]
- [[reply-playbook]]
- [[SEND-PACING-SCHEDULE]]
- [[SESSION_SUMMARY_2026-06-23]]
- [[USA600-status-2026-05-21]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
