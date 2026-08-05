---
id: diagnostics/add-printer-setup
intent: setup
vertical: generic
safe_recipe: add-printer-wizard
---

# Add a Network or Office Printer to Windows (Setup / How-To)

## Symptom: User wants to add or install a printer they don't have yet.
> User phrasings: "how do I add a printer", "add office printer", "add network printer", "install printer", "set up printer", "connect to printer", "can't find printer to add", "printer not showing in list", "add printer by IP", "add shared printer"

> **This is a SETUP article (adding a printer you don't have yet).** If the printer is already added but won't print, see the Printer Issues diagnostic instead.

### Step: Use Windows Settings to add the printer (try automatic first)
**Probability:** 60% resolved by auto-detection
**Detection:** Printer is powered on and on the same network; it may or may not appear in the Windows scan automatically.
**Safe diagnostic:** Open Settings → Bluetooth & devices → Printers & scanners → Add device. Wait ~30 seconds to see if the printer appears in the list (read-only scan).
**Safe fix:** If the printer appears → click it → Add device. Windows downloads the driver automatically. If it does NOT appear → use Method B (IP address).
**Escalation:** If the printer has no driver in Windows Update, escalate to IT for manual driver install (requires admin rights).

### Step: Add by IP address or hostname (network/office printers)
**Probability:** 30% require manual IP entry
**Detection:** Printer doesn't appear in the automatic scan; user knows the printer's IP address or share path (e.g. `192.168.1.50` or `\\server\printername`).
**Safe diagnostic:** Confirm the user has the IP or share path from IT or the printer's configuration page (read-only).
**Safe fix:** With user confirmation, Settings → Printers & scanners → Add device → Add manually → "Add a printer using an IP address or hostname" → TCP/IP → enter IP → Next. Windows installs a compatible driver.
**Escalation:** If the IP is unknown, IT must provide it. If a manufacturer-specific driver is required and the user lacks admin rights, escalate to IT.

### Step: Add a shared/print-server printer by network path
**Probability:** 10% (corporate print servers)
**Detection:** Office uses a print server; user has a share path like `\\printserver\HP-2ndFloor` from IT.
**Safe diagnostic:** Confirm the share path from IT (read-only).
**Safe fix:** With user confirmation, Settings → Printers & scanners → Add device → Add manually → "Select a shared printer by name" → enter the share path → Next.
**Escalation:** If the share path is invalid or permissions denied, escalate to IT to verify print-server configuration and user access rights.

### Cause: Printer requires admin rights to install driver
**Probability:** Common on managed/corporate PCs
**Detection:** Windows shows "You need to be an administrator to add this printer" or driver install is blocked by policy.
**Safe diagnostic:** Confirm the error message (read-only).
**Safe fix:** This is an IT provisioning task. Escalate to IT to push the printer via Group Policy or install the driver with admin credentials.
**Escalation:** Escalate to IT for all managed-device driver installs.
