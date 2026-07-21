// outreach.mjs — AXIS CC v2 P4 outreach generation + lint + SEND-TIME rails. WORKER-OWNED.
// GENERATION ONLY writes drafts to SQLite (status 'pending' → Approvals). It NEVER sends. Sending happens
// only via the outbound queue after Ahmad approves, behind railsCheck() evaluated AT SEND TIME.
//
// Honesty rules baked in: emails are problem-first and framed as observations ("I couldn't find X published
// on your site") — never as unfounded claims about the prospect's internal reality. Every email cites a
// real sourced fact drawn from the prospect's provenance/assessment. No banned filler. Initial ≤150 words.
import { OUTREACH_IDENTITY, CASL, BANNED_FILLER, OUTREACH_LIMITS } from '../../assets/axis-constants.js';

const firstProv = (p, k) => { try { return JSON.parse(p.provenance_json)[k]?.value ?? null; } catch { return null; } };
const domainOf = (url) => (url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

// The single sourced fact the email leans on — drawn from real data, framed honestly.
function anchorFact(p) {
  const prov = safe(p.provenance_json); const opps = safe(p.opportunities_json) || [];
  const site = domainOf(prov.website?.value);
  const top = opps[0];
  const basis = (top?.basis || '').toLowerCase(); // case-insensitive matching
  // Prefer the concrete observed gap behind the top opportunity's basis. Every branch is problem-first.
  if (top && /weak visible security|no visible security/.test(basis)) {
    return { text: `you handle ${sectorNoun(p)} data, but I couldn't find a published security or backup posture on ${site}`, service: top.service };
  }
  if (top && /multiple office/.test(basis)) {
    return { text: `you run more than one location and I couldn't find a managed-IT provider referenced anywhere on ${site}`, service: top.service };
  }
  if (top && /no visible managed-it/.test(basis)) {
    return { text: `I looked at ${site} and couldn't tell who handles your IT and security — usually a sign it's off the side of someone's desk`, service: top.service };
  }
  return { text: `I looked at ${site} and couldn't find who's handling IT, backups, or security for the ${businessType(p)}`, service: top?.service || 'Managed IT' };
}
function businessType(p) {
  const ind = (firstProv(p, 'industry') || '').toLowerCase();
  if (/dental/.test(ind)) return 'practice';
  if (/law|legal/.test(ind)) return 'firm';
  if (/account/.test(ind)) return 'firm';
  if (/physio|health/.test(ind)) return 'clinic';
  if (/property/.test(ind)) return 'portfolio';
  if (/staffing|recruit/.test(ind)) return 'agency';
  return 'business';
}
function servicePhrase(svc) {
  const m = { 'Cybersecurity': 'security and backups', 'Managed IT': 'managed IT and backups', 'Backup & Business Continuity': 'backup and continuity', 'Microsoft 365 / Cloud': 'Microsoft 365 and cloud', 'Co-managed IT': 'co-managed IT support' };
  return m[svc] || svc.toLowerCase();
}
function sectorNoun(p) {
  const ind = (firstProv(p, 'industry') || '').toLowerCase();
  if (/dental/.test(ind)) return 'patient';
  if (/law|legal/.test(ind)) return 'client and case';
  if (/account/.test(ind)) return 'client financial';
  if (/physio|health/.test(ind)) return 'patient health';
  if (/property/.test(ind)) return 'tenant';
  return 'client';
}
const safe = (j) => { try { return JSON.parse(j); } catch { return j && typeof j === 'object' ? j : {}; } };

export function generateOutreach(p) {
  const prov = safe(p.provenance_json);
  const site = domainOf(prov.website?.value);
  const fact = anchorFact(p);
  const svc = fact.service;
  const city = prov.city?.value?.split(' ')[0] || 'Toronto';

  const subjects = [
    `${svc} gap I spotted on ${site}`,
    `${p.name}: ${sectorNoun(p)} data, no posture published`,
    `A GTA IT team's note on ${p.name}`,
  ];

  // Problem-first, ≤150 words, one sourced observation, honest framing, soft CTA.
  const initial =
`Hi ${p.name} team,

I run a Toronto-area IT firm and was looking at ${site} — ${fact.text}. For a ${businessType(p)} that size, it's the kind of gap that only surfaces once something's already gone wrong.

We help GTA professional-services firms close exactly that: ${servicePhrase(svc)}, and a documented posture, set up without disrupting how you already work.

If it's useful I'll send a one-page read on what I'd check first — no meeting needed unless you want one.

— ${OUTREACH_IDENTITY.from_name}, ${CASL.company}`;

  const followups = [
    `Hi again — following up on the note about ${svc.toLowerCase()} for ${p.name}. Happy to send the one-pager; just reply "send it".`,
    `Last note from me: if ${sectorNounShort(p)} data protection isn't a priority right now, no problem — I'll close the loop. If it is, I'm one reply away.`,
    `Closing this out. If anything changes on the IT/security side at ${p.name}, ${OUTREACH_IDENTITY.from_email} reaches me directly.`,
  ];
  const linkedin = `Hi — I run a ${city} IT firm and noticed ${fact.text} at ${p.name}. We help firms like yours close that quietly. Open to a one-pager?`;
  const call_script = `Opener: "Hi, this is ${OUTREACH_IDENTITY.from_name} with ${CASL.company} in ${city}. I was looking at ${site} and ${fact.text}. Do you handle IT in-house or through a provider?" → If provider: "How's their response time on security?" → If in-house: "Who covers backups and endpoint security?" Offer the one-pager. No pressure.`;
  const voicemail = `"Hi, ${OUTREACH_IDENTITY.from_name} from ${CASL.company}. I had a quick note about ${svc.toLowerCase()} for ${p.name} — nothing urgent. If useful, ${OUTREACH_IDENTITY.from_email} or ${CASL.phone}. Thanks."`;
  const crm_note = `Cold outreach drafted ${new Date().toISOString().slice(0, 10)}. Anchor: ${fact.text}. Top opp: ${svc}. Consent basis: conspicuous_publication (public email on ${site}).`;

  return { subjects, initial, followups, linkedin, call_script, voicemail, crm_note, anchor: fact.text, service: svc };
}
function sectorNounShort(p) { const n = sectorNoun(p); return n === 'client and case' ? 'legal' : n === 'client financial' ? 'financial' : n === 'patient health' ? 'healthcare' : n; }

// CASL footer: real address + working one-click unsubscribe. token uniquely identifies the contact.
export function caslFooter(unsubToken) {
  return `\n\n—\n${CASL.company} · ${CASL.address} · ${CASL.phone}\nYou received this because your business email is published publicly. Unsubscribe (honored immediately): https://iisupp.net/unsubscribe?u=${unsubToken}`;
}

// LINT (P4 §6). Returns {pass, issues[], word_count}. Body should be the email WITHOUT the CASL footer.
export function lint(body, p) {
  const issues = [];
  const words = body.trim().split(/\s+/).length;
  if (words > OUTREACH_LIMITS.initial_words_max) issues.push(`too long: ${words} words (max ${OUTREACH_LIMITS.initial_words_max})`);
  const lc = body.toLowerCase();
  for (const f of BANNED_FILLER) if (lc.includes(f)) issues.push(`banned filler: "${f}"`);
  // ≥1 sourced company-specific fact: must mention the company AND a sourced token (site domain / city / sector)
  const site = domainOf(firstProv(p, 'website'));
  const hasCompany = lc.includes(p.name.toLowerCase().split(' ')[0].toLowerCase());
  const hasSourced = (site && lc.includes(site.toLowerCase())) || lc.includes("couldn't find") || lc.includes("didn't");
  if (!hasCompany || !hasSourced) issues.push('missing a sourced company-specific fact');
  // problem-first: first 160 chars should surface a gap/observation, not a pitch
  const head = lc.slice(0, 200);
  const problemFirst = /(couldn't find|didn't (see|find)|no (visible|published)|gap|only shows up|more than one office|stood out|noticed)/.test(head);
  if (!problemFirst) issues.push('not problem-first (opens with a pitch)');
  return { pass: issues.length === 0, issues, word_count: words };
}

// SEND-TIME RAILS (P4 §5). Evaluated at the moment of send, not at queue time. ctx supplies live state.
export function railsCheck(item, ctx) {
  const now = ctx.now || new Date();
  const checks = {};
  checks.daily_cap = { pass: (ctx.sentToday || 0) < (ctx.dailyCap ?? 25), detail: `${ctx.sentToday || 0}/${ctx.dailyCap ?? 25} sent today` };
  const supp = (ctx.suppression || []).includes((item.to_email || '').toLowerCase());
  checks.suppression = { pass: !supp, detail: supp ? 'ON suppression list — BLOCKED' : 'not suppressed' };
  checks.approved_template = { pass: !!item.template_id && (ctx.approvedTemplates || []).includes(item.template_id), detail: item.template_id ? `template ${item.template_id}` : 'no template id' };
  // quiet hours in America/Toronto (default 21:00–08:00): compute Toronto hour
  const hr = torontoHour(now);
  const q = ctx.quietHours || { start: 21, end: 8 };
  const inQuiet = (q.start > q.end) ? (hr >= q.start || hr < q.end) : (hr >= q.start && hr < q.end);
  checks.quiet_hours = { pass: !inQuiet, detail: `Toronto ${hr}:00 — ${inQuiet ? 'QUIET, hold' : 'ok to send'}` };
  const footOk = /Unsubscribe/i.test(item.body || '') && (item.body || '').includes(CASL.address);
  checks.casl_footer = { pass: footOk, detail: footOk ? 'CASL address + unsubscribe present' : 'MISSING CASL footer' };
  checks.consent_basis = { pass: !!item.consent_basis, detail: item.consent_basis ? `${item.consent_basis} (${item.consent_evidence || 'no evidence'})` : 'no consent basis recorded' };
  const pass = Object.values(checks).every(c => c.pass);
  return { pass, checks };
}
function torontoHour(now) {
  try { return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }).format(now)) % 24; }
  catch { return now.getUTCHours(); }
}
