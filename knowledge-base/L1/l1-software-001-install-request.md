---
id: l1-software-001
title: "Install or request software (apps, deployment, software center)"
category: software
support_level: L1
severity: low
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - software
  - install
  - installation
  - app
  - application
  - program
  - deploy
  - company portal
  - software center
  - license
  - request
---

# Install / request software

## 1. Self-service first (Company Portal / Software Center)
1. Open **Company Portal** (managed devices) or **Software Center** (SCCM) — most approved apps install with one click, no admin rights.
2. Search the app → **Install**. Wait for it to finish; reboot if asked.

## 2. Microsoft 365 apps
Install from **portal.office.com → Install apps** and sign in with your work account to activate.

## 3. App not in the catalog?
1. Submit a **software request** to IT with: app name, version, business justification, and whether a license is needed.
2. IT checks licensing + security (approved-software list) before packaging/deploying it.
3. Licensed/paid apps (Photoshop, Acrobat Pro, Visio, Project, AutoCAD, Tableau) require a **purchased license** assigned to you first.

## 4. Admin rights
Standard users can't install arbitrary .exe files by design (security). Use the catalog or the request path — don't download installers from untrusted sites.

## 5. Troubleshooting an install
- "Needs admin" → use Company Portal/Software Center instead of the raw installer.
- Install fails → note the error code; clear `%temp%`; retry; then log a ticket with the code.
