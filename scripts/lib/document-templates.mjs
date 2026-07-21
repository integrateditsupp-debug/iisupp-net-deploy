// document-templates.mjs — 16 Ontario DRAFT document templates for the Documents Center (S9).
// GENERIC templates only (IIS's own reusable IP — no client data). Every one is marked "DRAFT — not legal
// advice"; merged client versions live in SQLite ONLY. Merge fields use {{snake_case}} placeholders.
// These are skeletons for a starting point, NOT vetted legal instruments — review with counsel before use.

const DRAFT = '> **DRAFT — not legal advice.** Ontario-oriented starting template. Review with qualified counsel before use.';
const PARTIES = 'This document is made between **Integrated IT Support Inc.** ("Provider"), 30 Fothergill Crt, Whitby, ON L1P 1L4, and **{{client_name}}** ("Client"), {{client_address}}, effective **{{effective_date}}**.';
const GOVERN = 'This document is governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein.';
const SIGN = '## Signatures\n\nProvider: _______________________  Date: __________\n\nClient (**{{client_signer}}**): _______________________  Date: __________\n\n_E-signature: future-ready (status only — not yet enabled)._';

const wrap = (title, clauses) => `# ${title}\n\n${DRAFT}\n\n${PARTIES}\n\n${clauses.map((c, i) => `## ${i + 1}. ${c.h}\n${c.b}`).join('\n\n')}\n\n## ${clauses.length + 1}. Governing law\n${GOVERN}\n\n${SIGN}`;

export const TEMPLATES = [
  { type: 'Managed IT Service Agreement', merge: ['client_name', 'effective_date', 'monthly_fee', 'sla_response', 'term_months'], clauses: [
    { h: 'Services', b: 'Provider will deliver managed IT support, monitoring, patching, and helpdesk for Client\'s environment as scoped in the attached Schedule A.' },
    { h: 'Fees', b: 'Client pays **{{monthly_fee}}/month**, invoiced monthly, net 15. Term: **{{term_months}} months**, auto-renewing unless cancelled with 30 days\' notice.' },
    { h: 'Service levels', b: 'Target first response **{{sla_response}}** during business hours (8:00–18:00 ET, Mon–Fri). Priorities and targets per Schedule B.' },
    { h: 'Confidentiality & data', b: 'Each party protects the other\'s confidential information; Provider handles Client data per applicable Ontario/Canadian privacy law (PIPEDA).' }] },
  { type: 'MSA', merge: ['client_name', 'effective_date', 'term_months'], clauses: [
    { h: 'Framework', b: 'This Master Services Agreement governs all Statements of Work ("SOWs") executed between the parties. In conflict, the SOW controls for its scope.' },
    { h: 'Term & termination', b: 'Term: **{{term_months}} months**. Either party may terminate for uncured material breach on 30 days\' written notice.' },
    { h: 'Liability', b: 'Aggregate liability is limited to fees paid in the preceding 12 months; neither party is liable for indirect or consequential damages.' }] },
  { type: 'SOW', merge: ['client_name', 'effective_date', 'scope', 'project_fee', 'timeline'], clauses: [
    { h: 'Scope', b: '{{scope}}' },
    { h: 'Deliverables & timeline', b: 'Deliverables and milestones per the table below; target completion **{{timeline}}**.' },
    { h: 'Fees', b: 'Fixed fee **{{project_fee}}**, invoiced 50% on start and 50% on acceptance. Out-of-scope changes handled via written change order.' }] },
  { type: 'NDA', merge: ['client_name', 'effective_date', 'term_months'], clauses: [
    { h: 'Confidential information', b: 'Non-public information disclosed by either party, marked or reasonably understood as confidential.' },
    { h: 'Obligations', b: 'Recipient uses confidential information only to evaluate/perform the relationship, protects it with reasonable care, and does not disclose it to third parties.' },
    { h: 'Term', b: 'Confidentiality survives for **{{term_months}} months** after disclosure. Standard exclusions apply (public, independently developed, lawfully received).' }] },
  { type: 'SLA', merge: ['client_name', 'effective_date', 'sla_response', 'uptime_target'], clauses: [
    { h: 'Availability', b: 'Provider targets **{{uptime_target}}** monthly availability for covered services, measured per Schedule A.' },
    { h: 'Response targets', b: 'Priority 1 (down): {{sla_response}}. P2: 4 business hours. P3: next business day. Business hours 8:00–18:00 ET.' },
    { h: 'Remedies', b: 'Sustained misses credit a pro-rated portion of the monthly fee, as the sole remedy.' }] },
  { type: 'Quote', merge: ['client_name', 'effective_date', 'monthly_fee', 'quote_valid_until'], clauses: [
    { h: 'Summary', b: 'Proposed managed IT services for **{{client_name}}** at **{{monthly_fee}}/month** (see line items below).' },
    { h: 'Validity', b: 'This quote is valid until **{{quote_valid_until}}**. Taxes extra. Not a binding offer until countersigned.' }] },
  { type: 'Proposal', merge: ['client_name', 'effective_date', 'monthly_fee', 'scope'], clauses: [
    { h: 'Understanding', b: 'Based on public information about {{client_name}}, we understand your priorities to include {{scope}}.' },
    { h: 'Recommended approach', b: 'Phased onboarding: assess → stabilize → optimize. Managed IT at **{{monthly_fee}}/month**; details in the attached plan.' },
    { h: 'Why IIS', b: '15+ years hands-on IT experience; honest, no lock-in; Ontario-based support.' }] },
  { type: 'Terms & Conditions', merge: ['client_name', 'effective_date'], clauses: [
    { h: 'Use of services', b: 'Client uses Provider services lawfully and per the applicable agreement; Provider may suspend for non-payment or abuse.' },
    { h: 'Payment', b: 'Invoices are due net 15. Late amounts accrue interest at 1.5%/month.' },
    { h: 'Changes', b: 'Provider may update these terms on 30 days\' notice; continued use constitutes acceptance.' }] },
  { type: 'Privacy Policy', merge: ['client_name', 'effective_date'], clauses: [
    { h: 'What we collect', b: 'Contact details and service data necessary to deliver support, consistent with PIPEDA.' },
    { h: 'How we use it', b: 'To provide, secure, and improve services; we do not sell personal information.' },
    { h: 'Your rights', b: 'You may access or correct your information by contacting ahmad.wasee@iisupp.net.' }] },
  { type: 'Disclaimers', merge: ['effective_date'], clauses: [
    { h: 'No warranty beyond agreement', b: 'Except as expressly stated in a signed agreement, services are provided "as is" to the extent permitted by Ontario law.' },
    { h: 'Not legal/financial advice', b: 'Materials provided are informational and not legal, tax, or financial advice.' }] },
  { type: 'Cybersecurity Agreement', merge: ['client_name', 'effective_date', 'monthly_fee'], clauses: [
    { h: 'Scope', b: 'Endpoint protection, patch management, MFA enforcement, backup verification, and incident response readiness for {{client_name}}.' },
    { h: 'Shared responsibility', b: 'Provider implements and monitors controls; Client maintains acceptable-use policies and staff cooperation. No absolute guarantee against breach.' },
    { h: 'Fees', b: 'Included in managed services or **{{monthly_fee}}/month** standalone.' }] },
  { type: 'Backup Agreement', merge: ['client_name', 'effective_date', 'rpo', 'rto'], clauses: [
    { h: 'Backup scope', b: 'Scheduled backups of covered systems with target RPO **{{rpo}}** and RTO **{{rto}}**; retention per Schedule A.' },
    { h: 'Testing', b: 'Restores are tested periodically; test results are shared with Client.' },
    { h: 'Limitations', b: 'Backups reduce but do not eliminate data-loss risk; Client validates critical data coverage.' }] },
  { type: 'AI Usage Agreement', merge: ['client_name', 'effective_date'], clauses: [
    { h: 'Permitted use', b: 'AI-assisted automation and support tools operate on Client data solely to deliver agreed services.' },
    { h: 'Human oversight', b: 'AI outputs affecting Client systems are reviewed by a person before action; no autonomous changes without approval.' },
    { h: 'Data handling', b: 'Client data is not used to train third-party public models without written consent.' }] },
  { type: 'Remote Support Authorization', merge: ['client_name', 'effective_date', 'client_signer'], clauses: [
    { h: 'Authorization', b: '{{client_name}}, via **{{client_signer}}**, authorizes Provider to remotely access covered devices for support and maintenance.' },
    { h: 'Scope & logging', b: 'Access is limited to support tasks and is logged. Client may revoke authorization in writing at any time.' }] },
  { type: 'Project Document', merge: ['client_name', 'effective_date', 'scope', 'timeline'], clauses: [
    { h: 'Objective', b: '{{scope}}' },
    { h: 'Plan', b: 'Phases, owners, and milestones tracked to target completion **{{timeline}}**. Risks and dependencies logged in the register.' }] },
  { type: 'Client Onboarding Package', merge: ['client_name', 'effective_date', 'monthly_fee'], clauses: [
    { h: 'Welcome', b: 'Onboarding checklist for **{{client_name}}**: contacts, asset inventory, access, monitoring, and backup enrolment.' },
    { h: 'First 30 days', b: 'Week 1 assess, week 2 stabilize, weeks 3–4 optimize. Support at **{{monthly_fee}}/month** begins on go-live.' },
    { h: 'Contacts', b: 'Primary support: ahmad.wasee@iisupp.net · 647-581-3182.' }] },
];

export function renderTemplate(t) { return wrap(t.type, t.clauses); }
export const DOC_TYPES = TEMPLATES.map(t => t.type);
