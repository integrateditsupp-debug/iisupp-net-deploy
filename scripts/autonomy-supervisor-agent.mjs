#!/usr/bin/env node
import { runAutonomySupervisor, logBootstrapHeader } from './autonomy-supervisor-core.mjs';

// RUN-CU 2026-10-08: name the current-state file this run started from, so a run that acted on
// stale state can be told apart from one that never read any. Guarded: a missing note is a log
// line, never a dead worker.
await logBootstrapHeader('autonomy-supervisor-agent');

const state = await runAutonomySupervisor({ trigger: 'manual-script', writeTelemetry: true });
console.log(JSON.stringify({
  ok: true,
  reportingAgents: state.summary.reportingAgents,
  approvalCount: state.summary.approvalCount,
  readyApprovalCount: state.summary.readyApprovalCount,
  opportunityCount: state.summary.opportunityCount,
  contactCount: state.summary.contactCount
}, null, 2));
