// axis-private-constants.mjs — OPERATOR-INTERNAL AXIS constants (worker/scripts side ONLY).
//
// Split out of assets/axis-constants.js 2026-07-21 (R-series gate review): that file rides the
// browser module graph (axis.html → axis-app.js → import) AND is world-readable under publish="."
// (/assets/* is not force-404'd), so every anonymous visitor could download the locked outreach
// template, the watched mailbox, pacing/ramp strategy, and Blobs store names. Under the axis-state
// leak-fix precedent (counts-only public surface, strategy private) that is operator-internal.
// /scripts/* IS force-404'd live, so this module never serves.
//
// Do NOT import this from any browser-served asset. Worker code should import
// scripts/lib/axis-constants.mjs, which re-exports BOTH halves — no drift by construction.
import { CONSENT_BASES } from '../../assets/axis-constants.js';

// ── Safety-rail defaults (checked at SEND time; caps are strategy, not UI vocabulary). ──
export const DEFAULT_RAILS = { daily_cap: 25, quiet_hours: { start: 21, end: 8 }, followup_days: [3, 7, 14], max_followups: 3 };

// ── Outreach identity (P4). ONE identity everywhere: From, Reply-To, CASL contact, and the mailbox
// the P5 inbox monitor watches for replies. iisupp.net is Google Workspace (MX=smtp.google.com), so this
// is a Workspace mailbox — Gmail API OAuth runs directly against it; tokens live LOCAL in data/secrets/. ──
export const OUTREACH_IDENTITY = {
  from_name: 'Ahmad Wasee',
  from_email: 'ahmad.wasee@iisupp.net',
  reply_to: 'ahmad.wasee@iisupp.net',
  watch_mailbox: 'ahmad.wasee@iisupp.net', // P5 reply monitor
};

// CASL footer — EXACT per Ahmad 2026-07-21. This one line + a working one-click unsubscribe on every
// commercial email. "Crt" and postal code L1P 1L4 as specified (authoritative for the outreach footer).
export const CASL = {
  company: 'Integrated IT Support Inc.',
  address: '30 Fothergill Crt, Whitby, ON L1P 1L4',
  contact: 'ahmad.wasee@iisupp.net',
  phone: '647-581-3182',
  bases: CONSENT_BASES, // implied | conspicuous_publication | express
  // Exact footer text (unsubscribe link appended per-recipient):
  line: 'Integrated IT Support Inc. · 30 Fothergill Crt, Whitby, ON L1P 1L4 · ahmad.wasee@iisupp.net · 647-581-3182 · instant one-click unsubscribe',
};

// APPROVED outreach copy — Ahmad-LOCKED verbatim (aria-vault/01_Frontal/Outreach-Template-Approved.md,
// locked 2026-06-25). Personalize ONLY {name}. Do NOT rewrite the body. Cold email appends the CASL footer.
export const DEMO_LINK = 'https://calendar.app.google/LUyV5pHxkqJRg5vp8';
export const APPROVED_TEMPLATE = {
  source: 'aria-vault/01_Frontal/Outreach-Template-Approved.md (locked 2026-06-25)',
  body: `Hello {name},

Hope you are doing well, I won't take much of your time.

We provide Managed IT Services that meet all your needs for IT support, AI automation, agentic workflow setup, and much more. Please book a quick 15-minute demo (${DEMO_LINK}) on how we can bring your business up to speed with tech and help prevent unnecessary costs and frustrating technical issues.

We'd appreciate your consideration for any current projects or if you could whitelist us for your future goals. You may reach us via ahmad.wasee@iisupp.net, 647-581-3182 or iisupp.net for more detailed info and ideas.


Regards,

Ahmad Wasee
Founder | Director
Integrated IT Support Inc.
E: ahmad.wasee@iisupp.net
T: 647-581-3182
W: iisupp.net`,
  // Markers lint checks are present (must survive personalization).
  must_contain: ['Managed IT Services', DEMO_LINK, 'ahmad.wasee@iisupp.net', '647-581-3182'],
};

// Lint: the approved body is authoritative, so lint enforces CONFORMANCE (personalized {name}, demo link +
// contact intact, CASL footer, length) + a residual filler blocklist for DRIFT if anyone edits the body.
// "hope you are doing well" is intentionally NOT banned — the approved template uses it.
export const BANNED_FILLER = [
  'i hope this finds you well', 'i hope this email finds you well',
  'cutting-edge', 'cutting edge', 'synergy', 'synergies', 'circle back', 'game-changer', 'game changer',
  'revolutionary', 'best-in-class', 'best in class', 'move the needle', 'low-hanging fruit', 'thought leader',
  'paradigm shift', 'unlock the power', 'take it to the next level', 'world-class', 'pick your brain',
];
export const OUTREACH_LIMITS = { body_words_max: 200 };
// First-batch pacing (P4 addendum): personalized, a few/day, no blast. Do NOT ramp until DKIM is live.
export const OUTREACH_PACING = { first_batch_daily_cap: 5, ramped_daily_cap: 25, requires_dkim_to_ramp: true };

// ── Blobs store names. Intents reuse the existing axis-inbox store (worker already consumes pending/).
// Snapshots get a dedicated store; key = module name, plus a 'version' key holding {v, modules:{m:v}}. ──
export const BLOBS = { inbox: 'axis-inbox', intentPrefix: 'pending/', snapshotStore: 'axis-snapshots', versionKey: 'version' };
