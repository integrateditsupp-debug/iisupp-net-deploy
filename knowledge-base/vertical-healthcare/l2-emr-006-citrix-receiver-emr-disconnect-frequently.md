---
title: "Citrix Receiver EMR disconnects frequently"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.EMR, CITRIX.DISCONNECT, NETWORK.SESSION]
keywords: [hipaa, citrix, receiver, workspace, emr, disconnect]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

The EMR session disconnects frequently in Citrix Receiver or Citrix Workspace.

## What's happening (1-line cause)

Session drops can come from endpoint network changes, Citrix client version, gateway load, policy timeout, or backend host issues.

## Fix - try these in order

### 1. Separate local network from Citrix

Check whether the workstation internet or clinic network drops at the same time as the EMR session.

**Escalation:** if local network drops are confirmed, go to step 3 with network support.

### 2. Repair Citrix Workspace client

Update or repair the approved Citrix Workspace version, clear stale sessions, and reconnect through the official portal.

**Escalation:** if the same user disconnects across devices, go to step 3.

### 3. Review session logs and policy scope

Check Citrix Director or gateway logs for disconnect reason, host, policy, idle timeout, and user scope.

**Escalation:** open a HIPAA-aware ticket with Citrix admin, EMR owner, and network support if drops affect care workflows.

## Compliance reminder

HIPAA access logs may be needed when EMR sessions disconnect during care. Do not paste screen content or chart details into the ticket. Preserve session metadata and admin actions.

## Related entries

- [[l1-emr-002-cerner-powerchart-crashes]]
- [[l2-emr-007-emr-database-connection-loss-post-patch]]
