# Coverage Matrix — scenario x mode
Build 31c8872 - 2026-06-25. Legend: A=Automated/logic (routing+disposition in suite); M/C/Au=live end-to-end per mode. PASS / PENDING (Phase 5 live) / WARN.

## L1 (high-volume, automatable)
Password reset/lockout; MFA/SSO loop; "computer slow"; low disk (delete-Downloads Yes/No, No respected, logged); Wi-Fi down; VPN; Outlook send/receive; printer; app crash/freeze; frozen/black/blue screen; Teams/Zoom AV; phishing "is this real?"; software install; mouse/keyboard/webcam; OneDrive/SharePoint; browser hijack; mapped drive red X; email full / cert warning.
=> A: PASS (167-scenario battery + 21 Windows detectors). M/C/Au: PENDING (Phase 5 live).

## L2 (technician — triage+fix else clean escalation)
Onboarding/offboarding; file restore; update stuck; reboot loop; shared mailbox; RDP; AV/EDR quarantine; "I'm hacked"/spam; cert not-trusted; license expired; device migration; VoIP.
=> A: PASS. M/C/Au: PENDING.

## L3 (senior — diagnose, contain-if-safe, ESCALATE, never wing it)
Office-wide server/share down; site-wide slow net; suspected security incident; ACTIVE RANSOMWARE (contain+escalate, never guess); BEC; backup/restore; DNS/MX/SPF/DKIM/DMARC; GPO/AD multi-machine [WARN: AD intent 49%, finding C-1]; compliance audit logs; M365 conditional-access lockout.
=> A: detection+escalation logic PASS (web/deep-link actions clamped to Confirmed; Autonomous opt-in only). Destructive L3 (ransomware/AD/server-down): SIMULATE signals only. M/C/Au live: PENDING.

## Cross-cutting
- Wrong-user paths (ignore prompt / No / close mid-fix / nonsense / ask twice / inaccurate): PENDING (Phase 5).
- Backend unreachable mid-task (1xL1,1xL2,1xL3): offline-KB logic PASS; live: PENDING.
- Mode-switch immediate, no autonomous leak: logic PASS (mode-error-matrix); live: PENDING.
- Privacy gates: automated PASS (0 leaks / ~12,700 inputs); live confirm: PENDING.
