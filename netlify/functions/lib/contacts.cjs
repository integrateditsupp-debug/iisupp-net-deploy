// lib/contacts.cjs — ONE place for the IIS contact identities that functions email, page or print.
//
// Why: the 2026-10-08 functions audit (§3) found 77 hard-coded founder/support addresses across 49
// function files, three different "admin" mailboxes and seven env names for the same idea. This module
// resolves each identity from env first and falls back to the address that was literally in the code
// before, so behaviour is unchanged until Ahmad sets the env var. Only the files touched in that run
// import it (no mass edit).
//
// CJS so both `require()` (legacy handlers) and `import` (ESM functions, via default/named interop) work.
//
// Env (all optional):
//   FOUNDER_EMAIL / ORDER_NOTIFY_EMAIL  -> OWNER_EMAIL     (Ahmad's direct mailbox; ops + finance copies)
//   SUPPORT_INTERNAL_EMAIL / SUPPORT_EMAIL -> SUPPORT_EMAIL (shared support inbox; session reports, bookings)
//   SALES_NOTIFY_EMAIL                  -> SALES_EMAIL     (lead alerts)
//   ESCALATION_EMAILS                   -> ESCALATION_EMAILS (comma-separated; who gets paged on escalation)
//   SUPPORT_PHONE / SUPPORT_TEL         -> display + tel: forms of the support line
'use strict';

function env(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

const BRAND = 'Integrated IT Support';
const BRAND_LEGAL = 'Integrated IT Support Inc.';

// Documented defaults = the literals that were in the code before this module existed.
const DEFAULT_OWNER_EMAIL = 'ahmad.wasee@iisupp.net';
const DEFAULT_SUPPORT_EMAIL = 'integrateditsupp@iisupp.net';
const DEFAULT_SALES_EMAIL = 'integrateditsupp@gmail.com';
const DEFAULT_SUPPORT_PHONE = '(647) 581-3182';
const DEFAULT_SUPPORT_TEL = '+16475813182';

const OWNER_EMAIL = env('FOUNDER_EMAIL') || env('ORDER_NOTIFY_EMAIL') || DEFAULT_OWNER_EMAIL;
const SUPPORT_EMAIL = env('SUPPORT_INTERNAL_EMAIL') || env('SUPPORT_EMAIL') || DEFAULT_SUPPORT_EMAIL;
const SALES_EMAIL = env('SALES_NOTIFY_EMAIL') || DEFAULT_SALES_EMAIL;
const SUPPORT_PHONE = env('SUPPORT_PHONE') || DEFAULT_SUPPORT_PHONE;
const SUPPORT_TEL = env('SUPPORT_TEL') || DEFAULT_SUPPORT_TEL;

const ESCALATION_EMAILS = (env('ESCALATION_EMAILS')
  ? env('ESCALATION_EMAILS').split(',').map((s) => s.trim()).filter(Boolean)
  : [SUPPORT_EMAIL]);

// Default sender identity for outbound mail (Resend requires "Name <addr>" or "addr").
const DEFAULT_FROM = env('RESEND_FROM') || `${BRAND} <noreply@iisupp.net>`;

module.exports = {
  BRAND,
  BRAND_LEGAL,
  OWNER_EMAIL,
  SUPPORT_EMAIL,
  SALES_EMAIL,
  ESCALATION_EMAILS,
  SUPPORT_PHONE,
  SUPPORT_TEL,
  DEFAULT_FROM,
  DEFAULTS: {
    OWNER_EMAIL: DEFAULT_OWNER_EMAIL,
    SUPPORT_EMAIL: DEFAULT_SUPPORT_EMAIL,
    SALES_EMAIL: DEFAULT_SALES_EMAIL,
    SUPPORT_PHONE: DEFAULT_SUPPORT_PHONE,
    SUPPORT_TEL: DEFAULT_SUPPORT_TEL,
  },
};
