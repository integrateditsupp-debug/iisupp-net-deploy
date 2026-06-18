---
title: "Allscripts Sunrise is slow"
vertical: healthcare
tier: l1
intent_codes: [EMR.ALLSCRIPTS, PERFORMANCE.SLOW, NETWORK.LATENCY]
keywords: [allscripts, sunrise, slow, performance, workstation]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

Allscripts Sunrise loads slowly, clicks take several seconds, or screens stall during routine charting.

## What's happening (1-line cause)

The slowdown may be local workstation load, network latency, Citrix session health, or an EMR-side performance issue.

## Fix - try these in order

### 1. Identify whether it is one user or many

Ask two nearby clinical users to load the same general module, without opening the same record or sharing patient details.

**Escalation:** if multiple users are slow at the same time, go to step 3.

### 2. Restart the local session

Close Sunrise, sign out of Citrix if used, restart the workstation, and relaunch from the approved shortcut.

**Escalation:** if the same workstation remains slow after restart, go to step 3.

### 3. Record safe timing details

Write down module name, location, workstation name, approximate delay, network type, and exact time window.

**Escalation:** open a ticket with Allscripts support plus network or Citrix support if multiple users or modules are affected.

## Compliance reminder

Performance tickets should not include patient identifiers, screenshots of charts, orders, labs, or messages. Use module names and timestamps only. If logs are exported, store them in an encrypted support location.

## Related entries

- [[l2-emr-006-citrix-receiver-emr-disconnect-frequently]]
- [[l2-emr-007-emr-database-connection-loss-post-patch]]
