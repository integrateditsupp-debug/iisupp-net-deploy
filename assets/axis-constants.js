// axis-constants.js — SINGLE SOURCE of AXIS Command Center v2 vocabulary.
// Pure ESM, no browser- or node-specific APIs, so BOTH the page (import) and the worker
// (scripts/lib/axis-constants.mjs re-exports this) use the exact same enums. No drift by construction.
// DB schema, worker, snapshots, UI chips, and Excel export all resolve their labels from here.

// ── Pipeline: 17 stages in 5 phases (spec §7 S4). Order matters (kanban left→right). ──
export const PIPELINE_PHASES = [
  { key: 'research', label: 'Research', stages: ['Researching', 'Profile Completed'] },
  { key: 'outreach', label: 'Outreach', stages: ['Email Generated', 'Waiting Approval', 'Approved', 'Ready to Send', 'Sent', 'Delivered', 'Opened'] },
  { key: 'engaged',  label: 'Engaged',  stages: ['Replied', 'Follow-up Required', 'Meeting Scheduled'] },
  { key: 'deal',     label: 'Deal',     stages: ['Proposal Sent', 'Negotiation'] },
  { key: 'closed',   label: 'Closed',   stages: ['Won', 'Lost', 'Archived'] },
];
export const PIPELINE_STAGES = PIPELINE_PHASES.flatMap(p => p.stages); // 17, canonical order
export const STAGE_PHASE = Object.fromEntries(PIPELINE_PHASES.flatMap(p => p.stages.map(s => [s, p.key])));
export const TERMINAL_STAGES = ['Won', 'Lost', 'Archived'];

// ── Inbox classification (spec §7 S2 / Sentry). "uncertain → actionable" is a Sentry rule, not here. ──
export const INBOX_CLASSES = ['reply_to_outreach', 'new_inbound_request', 'bounce', 'out_of_office', 'unsubscribe_request', 'noise'];
export const ACTIONABLE_CLASSES = ['reply_to_outreach', 'new_inbound_request']; // Badge law: only these count
export const INBOX_ACTIONS = ['draft_reply', 'open_gmail', 'schedule_followup', 'book_meeting', 'advance_stage', 'mark_handled', 'snooze', 'suppress'];

// ── Approvals ──
export const APPROVAL_STATES = ['pending', 'approved', 'rejected', 'skipped', 'outbound', 'sent'];
export const REJECT_REASONS = ['off-target', 'wrong contact', 'bad timing', 'tone', 'factual error', 'compliance risk', 'duplicate', 'other'];

// ── Channels ──
export const CHANNELS = ['email', 'linkedin', 'call', 'voicemail', 'bid', 'document'];

// ── Safety rails (checked at SEND time, spec §2 Law 1 / §9 CASL). Rail NAMES are UI vocabulary;
// the numeric DEFAULT_RAILS caps are strategy and live in scripts/lib/axis-private-constants.mjs. ──
export const RAILS = ['daily_cap', 'suppression', 'approved_template', 'quiet_hours', 'casl_footer'];

// ── CASL consent basis (spec §9). ──
export const CONSENT_BASES = ['implied', 'conspicuous_publication', 'express'];

// ── Documents: 16 seeded types (spec §7 S9). ──
export const DOCUMENT_TYPES = [
  'Managed IT Service Agreement', 'MSA', 'SOW', 'NDA', 'SLA', 'Quote', 'Proposal',
  'Terms & Conditions', 'Privacy Policy', 'Disclaimers', 'Cybersecurity Policy', 'Backup Policy',
  'AI Usage Policy', 'Remote Support Authorization', 'Project Docs', 'Onboarding Package',
];
export const DOCUMENT_STATES = ['Draft', 'Template', 'Ready', 'Sent', 'Signed'];

// ── Product discovery scoring axes (spec §7 S11 / Miner). ──
export const PRODUCT_AXES = ['demand', 'ease', 'profitability', 'scalability', 'advantage'];
export const PRODUCT_STATES = ['Idea', 'Validating', 'Recommended', 'Approved', 'Building', 'Live'];

// ── Snapshot module set (build plan D8). One Blobs key per module + snapshot:version. ──
export const SNAPSHOT_MODULES = [
  'overview', 'inbox', 'approvals', 'pipeline', 'prospects', 'outreach',
  'followups', 'documents', 'analytics', 'products', 'fleet', 'reports', 'crm', 'settings',
];

// ── Provenance: the shape every displayed business fact must carry (Law 3). ──
// { value, source_url, confidence (0-1), last_verified (ISO) } — unknown → UNKNOWN_FACT.
export const UNKNOWN_FACT = { value: null, source_url: null, confidence: 0, last_verified: null, unknown: true };
export const UNKNOWN_LABEL = 'Not found — never guessed';

// ── Operator-internal constants (outreach identity, LOCKED template, CASL footer, pacing/ramp
// strategy, Blobs store names, rail caps) were SPLIT OUT 2026-07-21 to
// scripts/lib/axis-private-constants.mjs (force-404'd live). This file rides the browser module
// graph and is world-readable under publish="." — it must carry UI vocabulary ONLY.
// Worker code imports scripts/lib/axis-constants.mjs, which re-exports both halves. ──
