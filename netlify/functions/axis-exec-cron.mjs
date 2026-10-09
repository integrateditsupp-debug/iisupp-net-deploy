// axis-exec-cron.mjs — AXIS works on its own every 10 minutes.
// Order per tick (bounded to ~22s; scheduled functions get 30s): approved sends → due automations →
// inbox watch → stuck-work sweep → hourly research shared with ARIA and ARIA Sentinel.
import { getStore } from '@netlify/blobs';
import {
  PERSONA, claude, pickTier, parseJSON, readJSON, writeJSON, now, id, attention, requestApproval,
  MAILBOXES, MAIN_MAILBOX, mailboxReady, fetchUnread, sendMail, esc,
} from './lib/axis-exec-core.mjs';

const BUDGET_MS = 22000;
const RESEARCH_TOPICS = [
  'newest B2B marketing and lead-generation tactics for IT managed services and cybersecurity firms',
  'Alex Hormozi current communication, offers and outreach principles applied to IT services',
  'Canadian legal and compliance updates affecting IT service providers (CASL, PIPEDA, Bill C-27, CRA)',
  'global data-protection and AI regulation updates (GDPR, EU AI Act, US state privacy laws)',
  'new cybersecurity threats and fixes small businesses need this week',
  'AI automation services SMBs are buying now and typical pricing models',
  'client retention, upsell and follow-up best practices for MSPs',
  'risk-management frameworks for small IT companies (NIST CSF 2.0, ISO 27001, SOC 2) — practical updates',
];

export default async () => {
  const start = Date.now();
  const left = () => BUDGET_MS - (Date.now() - start);
  const report = { sent: 0, tasks: 0, inbox: 0, research: false, errors: [] };
  const step = async (name, fn) => { if (left() < 3000) return; try { await fn(); } catch (e) { report.errors.push(`${name}: ${e.message}`); } };

  await step('approved', () => sendApproved(report));
  await step('tasks', () => runTasks(report, left));
  await step('inbox', () => watchInbox(report, left));
  await step('sweep', sweepStuck);
  await step('research', () => research(report));

  if (report.errors.length) {
    await attention('Axis hit a problem it could not fix alone', `<pre style="white-space:pre-wrap">${esc(report.errors.join('\n'))}</pre><p>Axis will keep retrying; this note repeats at most every 6 hours.</p>`, `cron-${report.errors.map((e) => e.split(':')[0]).join(',')}`);
  }
  await writeJSON('cron-last', { t: now(), ...report });
  return new Response(JSON.stringify(report), { headers: { 'content-type': 'application/json' } });
};

async function sendApproved(report) {
  const list = await readJSON('approvals', []);
  let changed = false;
  for (const a of list) {
    if (a.status !== 'approved' || !a.payload?.to || !['reply', 'outreach'].includes(a.kind)) continue;
    const box = MAILBOXES.find((m) => m.address === a.payload.mailbox) || MAILBOXES[0];
    if (!mailboxReady(box)) continue;
    await sendMail(box, { to: a.payload.to, subject: a.payload.subject, text: a.payload.text, inReplyTo: a.payload.inReplyTo });
    a.status = 'sent'; a.sent_at = now(); changed = true; report.sent++;
  }
  if (changed) await writeJSON('approvals', list);
}

async function runTasks(report, left) {
  const tasks = await readJSON('tasks', []);
  for (const t of tasks) {
    if (left() < 8000) break;
    if (t.status !== 'active' || new Date(t.next_run) > new Date()) continue;
    try {
      const out = await claude({
        messages: [{ role: 'user', content: `Automation "${t.title}". Instructions: ${t.instructions}\nPrevious result: ${t.last_result?.summary || 'none'}\nDo the work now with what you know. If it needs money, outreach sending, a decision, missing info, or something changed since last time, set needs_attention. Return ONLY JSON {"summary": "<=2 short lines", "output": "the work product (markdown)", "needs_attention": boolean, "reason": "why, or empty", "cost_usd": number (0 unless spending is required)}` }],
        tier: pickTier(t.instructions), maxTokens: 1500, webSearch: /research|news|latest|find|market|competitor/i.test(t.instructions),
      });
      const r = parseJSON(out.text, { summary: out.text.slice(0, 200), output: out.text, needs_attention: false });
      t.last_result = { at: now(), summary: r.summary, output: String(r.output || '').slice(0, 12000), model: out.model };
      t.runs++; t.failures = 0;
      if (Number(r.cost_usd) > 0) await requestApproval({ kind: 'spend', title: `${t.title}: spend $${r.cost_usd}`, detail: r.reason || r.summary, costUsd: Number(r.cost_usd), payload: { task: t.id } });
      else if (r.needs_attention) await attention(`${t.title}: ${r.reason || 'update needed'}`, `<p>${esc(r.summary)}</p>`, `task-${t.id}-${(r.reason || '').slice(0, 40)}`);
    } catch (e) {
      t.failures = (t.failures || 0) + 1;
      if (t.failures >= 2) await attention(`Automation stuck: ${t.title}`, `<p>${esc(e.message)}</p><p>Axis will keep trying another way.</p>`, `taskfail-${t.id}`);
    }
    t.next_run = new Date(Date.now() + t.every_minutes * 60000).toISOString();
    report.tasks++;
  }
  await writeJSON('tasks', tasks);
}

async function watchInbox(report, left) {
  const log = await readJSON('inbox-log', []);
  for (const box of MAILBOXES.filter(mailboxReady)) {
    if (left() < 8000) break;
    const { client, messages } = await fetchUnread(box, 6);
    try {
      for (const m of messages) {
        if (left() < 6000) break;
        if (/no-?reply|mailer-daemon|notifications?@/i.test(m.from) || m.from.endsWith('@iisupp.net')) { await client.messageFlagsAdd({ uid: m.uid }, ['\\Seen'], { uid: true }); continue; }
        const cls = parseJSON((await claude({
          messages: [{ role: 'user', content: `Classify this inbound email for Integrated IT Support. Return ONLY JSON {"category":"lead"|"client"|"routine"|"billing"|"legal"|"complaint"|"tax"|"spam"|"other","sensitive":boolean,"summary":"one line"}. sensitive=true for pricing commitments, disputes, legal, tax, contracts, security incidents, angry clients, anything risky.\nFrom: ${m.fromName} <${m.from}>\nSubject: ${m.subject}\n\n${m.text.slice(0, 2500)}` }],
          tier: 'fast', maxTokens: 200,
        })).text, { category: 'other', sensitive: true, summary: m.subject });
        let action = 'skipped';
        if (cls.category !== 'spam') {
          const draft = (await claude({
            system: PERSONA,
            messages: [{ role: 'user', content: `Write the reply email body only (no subject line). Short, warm, professional, welcoming, modern; balanced detail; one clear next step (e.g. book a quick call at https://iisupp.net/book.html). Sign as "Integrated IT Support Inc." Never commit to prices or dates not stated. Email:\nFrom: ${m.fromName} <${m.from}>\nSubject: ${m.subject}\n\n${m.text.slice(0, 3000)}` }],
            tier: cls.category === 'lead' ? 'quality' : 'balanced', maxTokens: 500,
          })).text;
          const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
          const autoSend = box.address === MAIN_MAILBOX() && !cls.sensitive && ['lead', 'client', 'routine'].includes(cls.category);
          if (autoSend) { await sendMail(box, { to: m.from, subject, text: draft, inReplyTo: m.messageId }); action = 'replied'; }
          else { await requestApproval({ kind: 'reply', title: `Reply to ${m.fromName || m.from}: ${m.subject}`, detail: `${cls.summary} (${cls.category}${cls.sensitive ? ', sensitive' : ''})`, payload: { mailbox: box.address, to: m.from, subject, text: draft, inReplyTo: m.messageId } }); action = 'drafted for approval'; }
        }
        await client.messageFlagsAdd({ uid: m.uid }, ['\\Seen'], { uid: true });
        log.unshift({ t: now(), mailbox: box.address, from: m.from, subject: m.subject, category: cls.category, action });
        report.inbox++;
      }
    } finally { await client.logout().catch(() => {}); }
  }
  await writeJSON('inbox-log', log.slice(0, 300));
}

async function sweepStuck() {
  const tasks = await readJSON('tasks', []);
  for (const t of tasks) {
    if (t.status === 'active' && Date.now() - new Date(t.next_run).getTime() > 2 * t.every_minutes * 60000) {
      await attention(`Falling behind: ${t.title}`, '<p>This automation is overdue. Axis is retrying; open AXIS if it needs new instructions.</p>', `overdue-${t.id}`);
    }
  }
}

// Hourly: learn something useful, keep it, and share it with ARIA + ARIA Sentinel (aria-kb-live).
async function research(report) {
  const last = await readJSON('research-last', { t: 0, i: 0 });
  if (Date.now() - last.t < 55 * 60000) return;
  const topic = RESEARCH_TOPICS[last.i % RESEARCH_TOPICS.length];
  const out = await claude({
    messages: [{ role: 'user', content: `Research: ${topic}. Use web search. Return ONLY JSON {"title": string, "insights": ["5 short, specific, sourced, actionable insights"], "action_for_iis": "one revenue or risk action for Integrated IT Support this week", "sources": ["urls"]}` }],
    tier: 'balanced', maxTokens: 1500, webSearch: true,
  });
  const r = parseJSON(out.text);
  if (!r?.insights?.length) { await writeJSON('research-last', { t: Date.now(), i: last.i + 1 }); return; }
  const body = `${r.insights.map((x) => `- ${x}`).join('\n')}\n\nAction: ${r.action_for_iis}\nSources: ${(r.sources || []).join(' ')}`;
  const notes = await readJSON('research', []);
  notes.unshift({ t: now(), topic, ...r });
  await writeJSON('research', notes.slice(0, 200));
  const kb = getStore({ name: 'aria-kb-live', consistency: 'strong' });
  const key = `learn-axis-${id('r')}`;
  await kb.setJSON(key, { topic: r.title, question: topic, body: body.slice(0, 3500), agent: 'axis-research', source: 'axis-research', verified_answer: false, promoted: true, promoted_at: now(), created_at: now() });
  let idx = null; try { idx = await kb.get('kb-index.json', { type: 'json' }); } catch { idx = null; }
  if (!idx || !Array.isArray(idx.entries)) idx = { entries: [] };
  idx.entries.push({ key, topic: r.title, promoted: true, t: Date.now() });
  await kb.setJSON('kb-index.json', { ...idx, entries: idx.entries.slice(-5000) });
  await writeJSON('research-last', { t: Date.now(), i: last.i + 1 });
  report.research = true;
}

export const config = { schedule: '*/10 * * * *' };
