#!/usr/bin/env node
import { runAutonomySupervisor } from './autonomy-supervisor-core.mjs';

const state = await runAutonomySupervisor({ trigger: 'manual-script', writeTelemetry: true });
console.log(JSON.stringify({
  ok: true,
  reportingAgents: state.summary.reportingAgents,
  approvalCount: state.summary.approvalCount,
  readyApprovalCount: state.summary.readyApprovalCount,
  opportunityCount: state.summary.opportunityCount,
  contactCount: state.summary.contactCount
}, null, 2));
