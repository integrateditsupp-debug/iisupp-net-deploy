// outreach.mjs — AXIS CC v2 P4 outreach + lint + SEND-TIME rails. WORKER-OWNED.
// Copy source of truth = Ahmad's LOCKED approved template (scripts/lib/axis-private-constants.mjs APPROVED_TEMPLATE,
// mirrored from aria-vault/01_Frontal/Outreach-Template-Approved.md). We DO NOT invent body copy — we
// personalize {name} only and append the exact CASL footer. Lint enforces conformance + a residual filler
// blocklist (drift guard). Sending is never done here; railsCheck() runs at send time in the outbound queue.
import { OUTREACH_IDENTITY, CASL, BANNED_FILLER, OUTREACH_LIMITS, OUTREACH_PACING, APPROVED_TEMPLATE } from './axis-constants.mjs';

const domainOf = (url) => (url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
const firstProv = (p, k) => { try { return JSON.parse(p.provenance_json)[k]?.value ?? null; } catch { return null; } };

// Generate the initial email from the LOCKED template. Personalize {name} ONLY. Subject is the one element
// not in the locked body — kept minimal + factual, tied to the template's actual offer.
export function generateOutreach(p) {
  const name = p.name; // [Name] for a company public inbox = the company
  const body = APPROVED_TEMPLATE.body.replace(/\{name\}/g, name);
  const subject = `Managed IT & AI automation for ${name}`;
  return { subject, body, template: APPROVED_TEMPLATE.source, service: 'Managed IT' };
}

// Exact CASL footer + working one-click unsubscribe (token identifies the contact for instant suppression).
export function caslFooter(unsubToken) {
  const link = `https://iisupp.net/unsubscribe?u=${unsubToken}`;
  return `\n\n—\n${CASL.line}: ${link}`;
}

// LINT — conformance to the approved template + CASL + residual filler. `body` is the email WITHOUT footer.
export function lint(body, p) {
  const issues = [];
  const lc = body.toLowerCase();
  // 1) personalization actually applied — no leftover placeholder
  if (/\{name\}|\[name\]/i.test(body)) issues.push('placeholder {name} not personalized');
  // 2) approved markers survived (offer, demo link, contact, phone)
  for (const m of APPROVED_TEMPLATE.must_contain) if (!body.includes(m)) issues.push(`missing approved element: ${m}`);
  // 3) opens as the approved template does (drift guard)
  if (!/^hello /i.test(body.trim())) issues.push('does not open with the approved greeting (drift)');
  // 4) residual banned filler (approved copy contains none of these)
  for (const f of BANNED_FILLER) if (lc.includes(f)) issues.push(`banned filler: "${f}"`);
  // 5) length sanity
  const words = body.trim().split(/\s+/).length;
  if (words > OUTREACH_LIMITS.body_words_max) issues.push(`too long: ${words} words (max ${OUTREACH_LIMITS.body_words_max})`);
  return { pass: issues.length === 0, issues, word_count: words, template: APPROVED_TEMPLATE.source };
}

// SEND-TIME RAILS — evaluated at the moment of send. Includes DKIM-gated pacing (P4 addendum): until DKIM
// is live, the daily cap is the low first-batch cap and volume must NOT ramp.
export function railsCheck(item, ctx) {
  const now = ctx.now || new Date();
  const dkimOk = !!ctx.dkim_ok;
  const cap = (OUTREACH_PACING.requires_dkim_to_ramp && !dkimOk) ? OUTREACH_PACING.first_batch_daily_cap : (ctx.dailyCap ?? OUTREACH_PACING.ramped_daily_cap);
  const checks = {};
  checks.dkim = { pass: true, warn: !dkimOk, detail: dkimOk ? 'DKIM live' : `DKIM NOT live — paced to ${OUTREACH_PACING.first_batch_daily_cap}/day, do not ramp` };
  checks.daily_cap = { pass: (ctx.sentToday || 0) < cap, detail: `${ctx.sentToday || 0}/${cap} sent today${dkimOk ? '' : ' (paced: DKIM off)'}` };
  const supp = (ctx.suppression || []).includes((item.to_email || '').toLowerCase());
  checks.suppression = { pass: !supp, detail: supp ? 'ON suppression list — BLOCKED' : 'not suppressed' };
  checks.approved_template = { pass: !!item.template_id, detail: item.template_id || 'no template id' };
  const hr = torontoHour(now);
  const q = ctx.quietHours || { start: 21, end: 8 };
  const inQuiet = (q.start > q.end) ? (hr >= q.start || hr < q.end) : (hr >= q.start && hr < q.end);
  checks.quiet_hours = { pass: !inQuiet, detail: `Toronto ${hr}:00 — ${inQuiet ? 'QUIET, hold' : 'ok to send'}` };
  const footOk = /unsubscribe/i.test(item.body || '') && (item.body || '').includes(CASL.address);
  checks.casl_footer = { pass: footOk, detail: footOk ? 'CASL address + one-click unsubscribe present' : 'MISSING CASL footer' };
  checks.consent_basis = { pass: !!item.consent_basis, detail: item.consent_basis ? `${item.consent_basis} (${item.consent_evidence || 'no evidence'})` : 'no consent basis' };
  // pass = all hard checks pass (dkim is a warn, not a hard block — but it caps volume)
  const pass = Object.entries(checks).every(([k, c]) => k === 'dkim' ? true : c.pass);
  return { pass, dkim_ok: dkimOk, checks };
}
function torontoHour(now) {
  try { return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }).format(now)) % 24; }
  catch { return now.getUTCHours(); }
}
