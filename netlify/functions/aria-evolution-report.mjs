// netlify/functions/aria-evolution-report.mjs
// ARIA Evolution Report - the monitoring/reporting agent that emails Ahmad an
// "ARIA evolved" digest: what areas it grew in, what it can now do, and anything
// the auditor/verifier flagged as a concern. Drives toward full autonomy by keeping
// a human in the loop on every evolution.
//
// Reads (read-only) the EXISTING self-learning data + mesh activity:
//   - SESSIONS store  active.json : { bitsLearned, roster[], lastCycle, ... }
//   - KB_LIVE store               : live bit-form KB blobs (count + recent)
//   - /api/mesh-events            : recent agent activity + flagged hops
// Writes only its own marker (last-report.json) to compute deltas. NO LLM -> ~$0.
//
// Endpoints:
//   GET  (Aperture JWT)                 -> digest JSON, DRY-RUN (never sends). For the dashboard.
//   POST (header x-aria-evolve-secret = ARIA_AUDIT_SECRET) -> compose + SEND email
//        (only if RESEND_API_KEY + recipient configured), then update marker. For cron.
//
// Dormant-safe: with no RESEND_API_KEY it never sends — it just returns the digest.
// Registered in mesh-registry.json (observe phase) as status:"planned".

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const SESSIONS = 'aria-learning-sessions';
const KB_LIVE = 'aria-kb-live';
const MARK_STORE = 'aria-evolution-report';
const MARK_KEY = 'last-report.json';

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-aria-evolve-secret', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
}
function jr(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: cors() }); }

async function safeJson(store, key) { try { const v = await store.get(key, { type: 'json' }); return v || null; } catch { return null; } }

// ---- pure digest builder (testable) ----
export function buildDigest(state, kbLiveCount, events, mark) {
  state = state || {};
  const since = (mark && mark.ts) || 0;
  const bitsNow = state.bitsLearned || 0;
  const bitsThen = (mark && mark.bitsLearned) || 0;
  const newBits = Math.max(0, bitsNow - bitsThen);
  const kbThen = (mark && mark.kbLiveCount) || 0;
  const newKBs = Math.max(0, (kbLiveCount || 0) - kbThen);

  const roster = state.roster || [];
  const newAgents = roster.filter((a) => a.born_at && a.born_at > since).map((a) => a.name || a.role);

  // activity + concerns from mesh events
  const evs = Array.isArray(events) ? events : [];
  const recent = evs.filter((e) => (e.ts || 0) > since);
  const hops = recent.filter((e) => e.kind === 'mesh-hop');
  const flagged = hops.filter((e) => e.success === false);
  const byAgent = {};
  hops.forEach((e) => { if (e.agentId) byAgent[e.agentId] = (byAgent[e.agentId] || 0) + 1; });
  const topAgents = Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // newly-covered symbolic states (areas of evolution)
  const states = Array.from(new Set(recent.map((e) => e.state).filter(Boolean))).slice(0, 12);

  // concerns: failed hops + any explicit audit/ethics flags
  const concerns = [];
  if (flagged.length) concerns.push(`${flagged.length} low-confidence/failed hop(s) fell through to fallback`);
  recent.filter((e) => e.kind === 'audit-flag' || e.ethics || e.concern).forEach((e) => concerns.push(e.message || e.concern || 'audit flag raised'));

  const areas = Array.from(new Set([
    ...newAgents.map((n) => `new agent: ${n}`),
    ...states.map((s) => `pattern: ${s}`),
    ...(newKBs ? [`${newKBs} new bit-form KB${newKBs > 1 ? 's' : ''}`] : []),
    ...(newBits ? [`+${newBits} learned bits`] : [])
  ])).slice(0, 14);

  const evolved = newBits > 0 || newKBs > 0 || newAgents.length > 0;
  const headlineArea = newAgents.length ? newAgents[0]
    : states.length ? states[0]
      : newKBs ? 'knowledge base'
        : 'operational tuning';

  return {
    evolved,
    subject: evolved
      ? `ARIA evolved — ${headlineArea}${areas.length > 1 ? ` (+${areas.length - 1} more)` : ''}`
      : 'ARIA status — steady (no new evolution this window)',
    summary: {
      newBits, newKBs, newAgents, totalBits: bitsNow, kbLiveCount: kbLiveCount || 0,
      activityHops: hops.length, topAgents, statesCovered: states, areas,
      concerns, canDoNow: areas
    },
    marker: { ts: Date.now(), bitsLearned: bitsNow, kbLiveCount: kbLiveCount || 0 }
  };
}

function renderEmailHtml(d) {
  const s = d.summary;
  const li = (arr) => (arr && arr.length ? arr.map((x) => `<li>${esc(String(x))}</li>`).join('') : '<li style="opacity:.6">none this window</li>');
  return `<div style="font-family:Inter,Arial,sans-serif;background:#050810;color:#d8e0e6;padding:24px;border-radius:8px;max-width:640px">
    <div style="font-family:'JetBrains Mono',monospace;letter-spacing:.28em;color:#2dd4bf;font-size:12px;text-transform:uppercase">ARIA · EVOLUTION REPORT</div>
    <h1 style="font-size:20px;margin:10px 0 4px">${esc(d.subject)}</h1>
    <div style="color:#6b7c87;font-size:12px;margin-bottom:18px">${new Date().toUTCString()}</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:18px;font-family:'JetBrains Mono',monospace">
      ${stat('+'+s.newBits,'new bits')}${stat('+'+s.newKBs,'new KBs')}${stat(s.newAgents.length,'new agents')}${stat(s.activityHops,'agent hops')}</div>
    <h3 style="color:#2dd4bf;font-size:13px;margin:16px 0 6px">Areas ARIA evolved in / can now do</h3>
    <ul style="font-size:13px;line-height:1.7;color:#98a8b3">${li(s.canDoNow)}</ul>
    <h3 style="color:#fbbf24;font-size:13px;margin:16px 0 6px">Concerns flagged (auditor)</h3>
    <ul style="font-size:13px;line-height:1.7;color:#98a8b3">${li(s.concerns)}</ul>
    <div style="margin-top:18px;color:#6b7c87;font-size:11px;border-top:1px solid #1a2b35;padding-top:12px">
      Total bits: ${s.totalBits} · live KBs: ${s.kbLiveCount} · this advances ARIA toward full autonomy. Reply with a steer to adjust.
    </div></div>`;
}
function stat(v, l) { return `<div><div style="font-size:24px;color:#2dd4bf">${esc(String(v))}</div><div style="font-size:10px;color:#6b7c87;text-transform:uppercase;letter-spacing:.12em">${esc(l)}</div></div>`; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderText(d) {
  const s = d.summary;
  return `${d.subject}\n\n+${s.newBits} bits · +${s.newKBs} KBs · ${s.newAgents.length} new agents · ${s.activityHops} hops\n\nAreas evolved / can now do:\n- ${(s.canDoNow.length ? s.canDoNow : ['none this window']).join('\n- ')}\n\nConcerns:\n- ${(s.concerns.length ? s.concerns : ['none']).join('\n- ')}\n\nTotal bits ${s.totalBits} · live KBs ${s.kbLiveCount}.`;
}

async function sendEmail(d) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'ARIA <aria@iisupp.net>';
  const to = process.env.EVOLUTION_REPORT_TO || process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set (dormant)' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: d.subject, html: renderEmailHtml(d), text: renderText(d) })
    });
    return { sent: r.ok, status: r.status, to };
  } catch (e) { return { sent: false, reason: e?.message || String(e) }; }
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  const isPost = request.method === 'POST';
  const secret = request.headers.get('x-aria-evolve-secret');
  const cronAuthed = secret && process.env.ARIA_AUDIT_SECRET && secret === process.env.ARIA_AUDIT_SECRET;
  const jwtAuthed = !!verifyAperture(request);
  if (!cronAuthed && !jwtAuthed) return jr({ error: 'unauthorized — Aperture JWT or x-aria-evolve-secret required' }, 401);

  // gather (read-only)
  let state = null, kbLiveCount = 0, events = [], mark = null;
  try {
    const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
    state = await safeJson(sessions, 'active.json');
  } catch {}
  try {
    const kb = getStore({ name: KB_LIVE, consistency: 'strong' });
    const list = await kb.list();
    kbLiveCount = (list && list.blobs && list.blobs.length) || 0;
  } catch {}
  try {
    const host = request.headers.get('host');
    const r = await fetch(`https://${host}/api/mesh-events?limit=500`, { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); events = j.events || []; }
  } catch {}
  try { mark = await safeJson(getStore(MARK_STORE), MARK_KEY); } catch {}

  const digest = buildDigest(state, kbLiveCount, events, mark);

  // GET = dry-run (never sends). POST + cron secret = send + advance marker.
  if (!isPost) return jr({ ok: true, dryRun: true, ...digest });

  const emailResult = await sendEmail(digest);
  if (emailResult.sent) { try { await getStore(MARK_STORE).setJSON(MARK_KEY, digest.marker); } catch {} }
  return jr({ ok: true, sent: emailResult.sent, email: emailResult, ...digest });
};
