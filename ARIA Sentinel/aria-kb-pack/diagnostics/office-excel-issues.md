---
id: diagnostics/office-excel-issues
intent: break-fix
vertical: generic
---

# Office / Excel / Word App Issues — Crash, Not Opening, Formulas, File Errors

## Symptom: Microsoft Office app (Excel, Word, PowerPoint, Outlook) won't open, crashes, or behaves incorrectly.
> User phrasings: "excel won't open", "excel keeps crashing", "word not opening", "office crashing", "excel file corrupt", "excel not calculating", "formulas not working excel", "word freezing", "powerpoint not responding", "office won't start", "microsoft excel crash", "excel stopped working", "office application error", "excel file wont open", "excel found unreadable content", "excel file locked for editing", "office 365 apps crashing"

### Cause: Corrupt Office installation (Quick Repair fixes most crashes)
**Probability:** 35%
**Detection:** App crashes on startup, throws "has stopped working", or won't launch; check system-context.json `apps.office.lastCrash` or `apps.office.repairNeeded`.
**Safe diagnostic:** Note whether the crash happens in Safe Mode (`excel /safe` or `winword /safe`) — if Safe Mode works, an add-in or corrupt file is the cause; if it crashes in Safe Mode too, the installation is corrupt (read-only test).
**Safe fix:** With user confirmation:
1. **Quick Repair** (offline, fast): Settings → Apps → Microsoft 365 → Modify → Quick Repair.
2. If that doesn't fix it: **Online Repair** (reinstalls components, needs internet). Same path → Online Repair.
3. If both fail: Uninstall Office → reboot → reinstall from https://office.com.
**Escalation:** If repair fails repeatedly, escalate to L2/IT for a clean removal using the SaRA Office removal tool followed by a fresh install.

### Cause: Excel file corrupt or locked for editing
**Probability:** 20%
**Detection:** Error: "Excel found unreadable content", "The file is corrupt and cannot be opened", "File is locked for editing by [person]", or file opens as blank/read-only.
**Safe diagnostic:** Confirm the exact error message and whether the file is stored locally, on OneDrive, or on a network share (read-only).
**Safe fix:** With user confirmation:
- **Stale lock (no one actually editing):** Delete the `.~lock.*` temporary file next to the original, then reopen.
- **Corrupt file:** Excel → File → Open → Browse → select file → click the dropdown arrow on "Open" → **Open and Repair**.
- **Protected View:** Click "Enable Editing" in the yellow bar at the top if the file came from email or the internet (safe to do on trusted files).
**Escalation:** If Open and Repair fails and the file has critical data, escalate to L2 for advanced Excel recovery techniques.

### Cause: Excel formulas not calculating / showing formula text instead of result
**Probability:** 15%
**Detection:** Cells display the formula text (e.g. `=SUM(A1:A5)`) instead of the result, or values don't update when source data changes.
**Safe diagnostic:** Check Formulas tab → Calculation → whether it is set to Manual vs Automatic (read-only check).
**Safe fix:** With user confirmation:
- **Formula text showing:** Check if the cell format is set to Text → change to General, then press F2 → Enter to re-evaluate.
- **Not recalculating:** Formulas → Calculation Options → Automatic. Or press F9 to force a recalculate.
**Escalation:** If circular references or complex formula errors persist, escalate to the user's team or a data analyst.

### Cause: Faulty COM add-in causing crash or slowness
**Probability:** 15%
**Detection:** App opens only in Safe Mode (`/safe` flag), or crashes after a specific action tied to a plugin (PDF export, CRM sync, etc.).
**Safe diagnostic:** Open in Safe Mode → if it works, an add-in is the cause (read-only test).
**Safe fix:** With user confirmation, disable add-ins: File → Options → Add-ins → COM Add-ins → Go → uncheck all → restart. Re-enable one at a time to find the culprit.
**Escalation:** If a business-critical add-in is the cause, escalate to the add-in vendor or IT.

### Cause: License / activation error
**Probability:** 10%
**Detection:** "Unlicensed Product" banner, "Product Activation Failed", or app enters read-only mode after a grace period. Check system-context.json `apps.office.activationState`.
**Safe diagnostic:** File → Account → check Product Activated status and which account is signed in (read-only).
**Safe fix:** With user confirmation, sign out of the Office account (File → Account → Sign Out), then sign back in with the licensed work/school account. If the license is assigned, it re-activates automatically.
**Escalation:** If the correct account is signed in but activation still fails, the license may have been removed by an admin — escalate to IT/M365 admin to verify license assignment.

### Cause: Excel / Office update needed or stuck
**Probability:** 5%
**Detection:** App shows "Update Available" or behaves inconsistently after a recent Windows Update.
**Safe diagnostic:** File → Account → Update Options → check for pending Office updates (read-only).
**Safe fix:** With user confirmation: File → Account → Update Options → Update Now. Restart Office after the update.
**Escalation:** If Office Update fails, escalate to IT to check Windows Update policies and Office Click-to-Run service.
