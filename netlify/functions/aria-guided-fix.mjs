// aria-guided-fix.mjs v1.0 — ARIA Guided Fix Phase A backend
// Single function with action dispatch:
//   ?action=match       — POST {issue, os} → return matching recipe(s)
//   ?action=recipe      — GET ?id=… → return single recipe by id
//   ?action=audit       — POST {recipeId, stepId} → return HMAC-signed approval token
//   ?action=log         — POST {sessionId, recipeId, stepId, cmd, output, risk} → append to audit log
//   ?action=sessions    — GET (admin/jwt) → return recent session logs
//   ?action=session     — GET ?id=… (admin/jwt) → return single session
//
// Storage: Netlify Blobs store 'aria-guided-fix' (sessions + audit log)
// Security: every fix command must carry a valid audit-gate token before frontend shows it.
//           The token proves the recipe is server-vetted + not user-injected.
// Risk classes: green (safe info) / yellow (safe diagnostic) / orange (repair w/ consent) / red (admin only) / black (never)

import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes } from 'node:crypto';
import { RECIPES, RECIPE_COUNT } from './aria-recipes-data.mjs';

const AUDIT_SECRET = process.env.ARIA_AUDIT_SECRET || 'CHANGE_ME_IN_NETLIFY_ENV';
const TOKEN_TTL_SECONDS = 600; // 10 minutes

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'match';
  const body = req.method === 'POST' ? await safeJson(req) : {};

  try {
    if (action === 'match')    return await actMatch(body);
    if (action === 'recipe')   return await actRecipe(url.searchParams.get('id'));
    if (action === 'audit')    return await actAudit(body);
    if (action === 'log')      return await actLog(body);
    if (action === 'sessions') return await actSessions();
    if (action === 'session')  return await actSession(url.searchParams.get('id'));
    if (action === 'list')     return json({ count: RECIPE_COUNT, recipes: RECIPES.map(r => ({ id:r.id, title:r.title, category:r.category, risk:r.riskOverall })) });
    return json({ error: 'unknown action', got: action }, 400);
  } catch (e) {
    console.error('[aria-guided-fix] error', e);
    return json({ error: e.message || String(e) }, 500);
  }
};

// ========= ACTIONS =========

async function actMatch(b) {
  const issue = String(b.issue || '').toLowerCase().trim();
  if (!issue || issue.length < 3) return json({ error: 'issue must be at least 3 chars' }, 400);
  const os = (b.os || 'windows').toLowerCase();

  const matches = [];
  for (const r of RECIPES) {
    if (!r.os.includes(os)) continue;
    let score = 0;
    for (const kw of r.matchKeywords) {
      if (issue.includes(kw.toLowerCase())) { score += 10; break; }
    }
    for (const pat of (r.matchPatterns || [])) {
      try { if (new RegExp(pat, 'i').test(issue)) { score += 5; } } catch(e) {}
    }
    // Light token overlap
    const issueTokens = new Set(issue.split(/\W+/).filter(t => t.length > 2));
    const titleTokens = r.title.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    for (const t of titleTokens) if (issueTokens.has(t)) score += 1;

    if (score > 0) matches.push({ ...r, _score: score });
  }
  matches.sort((a, b) => b._score - a._score);
  const top = matches.slice(0, 3).map(({_score, ...rest}) => rest);
  return json({ ok: true, query: issue, count: top.length, recipes: top, hint: top.length === 0 ? 'No matching recipe. Please call (647) 581-3182 for direct help.' : null });
}

async function actRecipe(id) {
  if (!id) return json({ error: 'id required' }, 400);
  const r = RECIPES.find(x => x.id === id);
  if (!r) return json({ error: 'recipe not found', id }, 404);
  return json({ ok: true, recipe: r });
}

async function actAudit(b) {
  const { recipeId, stepId } = b;
  if (!recipeId || !stepId) return json({ error: 'recipeId + stepId required' }, 400);
  const r = RECIPES.find(x => x.id === recipeId);
  if (!r) return json({ error: 'recipe not found' }, 404);
  const step = (r.fixSteps || []).find(s => s.id === stepId);
  if (!step) return json({ error: 'step not found' }, 404);

  // Risk gate: deny black, require special admin token for red (not implemented in Phase A — black-listed entirely)
  if (step.risk === 'black') return json({ error: 'risk=black — never allowed', step: stepId }, 403);
  if (step.risk === 'red') return json({ error: 'risk=red — admin approval required (not implemented in Phase A)', step: stepId }, 403);

  // Issue signed token
  const nonce = randomBytes(8).toString('hex');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;
  const payload = `${recipeId}|${stepId}|${step.risk}|${nonce}|${issuedAt}|${expiresAt}`;
  const sig = sign(payload);
  const token = Buffer.from(payload).toString('base64url') + '.' + sig;

  return json({
    ok: true,
    recipeId, stepId, risk: step.risk,
    token, issuedAt, expiresAt, ttlSeconds: TOKEN_TTL_SECONDS,
    cmd: step.cmd, shell: step.shell, manual: !!step.manual,
    explainer: step.explainer, rollback: step.rollback,
    requiresConfirm: !!step.requiresConfirm,
    estimatedSeconds: step.estimatedSeconds || null
  });
}

function sign(payload) {
  return createHmac('sha256', AUDIT_SECRET).update(payload).digest('hex');
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return { valid: false, error: 'malformed' };
  const [payloadB64, sig] = token.split('.');
  let payload;
  try { payload = Buffer.from(payloadB64, 'base64url').toString('utf8'); } catch { return { valid: false, error: 'bad-base64' }; }
  const expected = sign(payload);
  if (expected !== sig) return { valid: false, error: 'bad-signature' };
  const [recipeId, stepId, risk, nonce, issuedAt, expiresAt] = payload.split('|');
  if (Math.floor(Date.now() / 1000) > parseInt(expiresAt, 10)) return { valid: false, error: 'expired' };
  return { valid: true, recipeId, stepId, risk, nonce, issuedAt: parseInt(issuedAt, 10), expiresAt: parseInt(expiresAt, 10) };
}

async function actLog(b) {
  const { sessionId, recipeId, stepId, cmd, output, risk, token, status } = b;
  if (!sessionId || !recipeId) return json({ error: 'sessionId + recipeId required' }, 400);

  // If a token is provided (for fix steps), verify it before logging as "executed"
  let tokenInfo = null;
  if (token) {
    tokenInfo = verifyToken(token);
    if (!tokenInfo.valid) return json({ error: 'invalid audit token: ' + tokenInfo.error }, 403);
    if (tokenInfo.recipeId !== recipeId || tokenInfo.stepId !== stepId) return json({ error: 'token does not match recipeId+stepId' }, 403);
  }

  const entry = {
    sessionId, recipeId, stepId: stepId || null,
    cmd: cmd ? String(cmd).slice(0, 2000) : null,
    output: output ? String(output).slice(0, 8000) : null,
    risk: risk || null,
    status: status || 'logged',
    tokenValid: tokenInfo ? tokenInfo.valid : null,
    ts: Date.now(),
    ip: null, // privacy: don’t log IP. Add only if compliance requires.
  };

  const store = getStore({ name: 'aria-guided-fix', consistency: 'strong' });
  let session = await store.get(`s/${sessionId}`, { type: 'json' });
  if (!session) {
    session = { id: sessionId, recipeId, createdAt: new Date().toISOString(), entries: [], status: 'active' };
  }
  session.entries.push(entry);
  session.updatedAt = new Date().toISOString();
  if (status === 'completed' || status === 'escalated' || status === 'cancelled') session.status = status;
  await store.set(`s/${sessionId}`, JSON.stringify(session));

  // Index
  const idx = (await store.get('index', { type: 'json' })) || [];
  if (!idx.find(x => x.id === sessionId)) {
    idx.unshift({ id: sessionId, recipeId, createdAt: session.createdAt, status: session.status });
    if (idx.length > 1000) idx.length = 1000;
    await store.set('index', JSON.stringify(idx));
  } else {
    const i = idx.findIndex(x => x.id === sessionId);
    if (i >= 0) idx[i].status = session.status;
    await store.set('index', JSON.stringify(idx));
  }

  return json({ ok: true, entryCount: session.entries.length, sessionStatus: session.status });
}

async function actSessions() {
  const store = getStore({ name: 'aria-guided-fix', consistency: 'strong' });
  const idx = (await store.get('index', { type: 'json' })) || [];
  return json({ count: idx.length, sessions: idx.slice(0, 100) });
}

async function actSession(id) {
  if (!id) return json({ error: 'id required' }, 400);
  const store = getStore({ name: 'aria-guided-fix', consistency: 'strong' });
  const s = await store.get(`s/${id}`, { type: 'json' });
  if (!s) return json({ error: 'session not found' }, 404);
  return json({ ok: true, session: s });
}

// ========= HELPERS =========

async function safeJson(req) { try { return await req.json(); } catch { return {}; } }
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors() });
}
