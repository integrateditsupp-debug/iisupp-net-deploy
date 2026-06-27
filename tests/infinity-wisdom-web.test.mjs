// Infinity Wisdom web endpoint — the no-leak / auth-gate safety properties.
// The FULL named tree is authed-only; an unauthenticated caller gets 401 and the data store is never
// touched. The public projection carries counts only. (Live Blobs round-trip is Cowork's deploy check.)
import assert from 'node:assert/strict';
import handler, { publicCounts } from '../netlify/functions/infinity-wisdom-state.mjs';
import { assertNoLeak } from '../scripts/infinity-wisdom-core.mjs';

// Ensure no JWT secret ⇒ verifyAperture returns null ⇒ guaranteed 401 path (no Blobs access).
delete process.env.APERTURE_JWT_SECRET;

// ── Unauthenticated GET → 401, no data ────────────────────────────────────────────────────────
{
  const res = await handler(new Request('https://iisupp.net/.netlify/functions/infinity-wisdom-state'));
  assert.equal(res.status, 401, 'unauthenticated GET must be 401');
  const body = await res.json();
  assert.equal(body.error, 'auth required');
  assert.ok(!('state' in body), 'no state leaks to an unauthenticated caller');
}

// ── Unauthenticated POST (e.g. a forged STOP) → 401, never mutates the store ─────────────────────
{
  const res = await handler(new Request('https://iisupp.net/.netlify/functions/infinity-wisdom-state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }));
  assert.equal(res.status, 401, 'unauthenticated POST must be 401 (no forged STOP / sync)');
}

// ── Bad Bearer → 401 ─────────────────────────────────────────────────────────────────────────
{
  const res = await handler(new Request('https://iisupp.net/.netlify/functions/infinity-wisdom-state', { headers: { authorization: 'Bearer not-a-real-jwt' } }));
  assert.equal(res.status, 401);
}

// ── OPTIONS preflight → 204 with CORS ───────────────────────────────────────────────────────────
{
  const res = await handler(new Request('https://iisupp.net/.netlify/functions/infinity-wisdom-state', { method: 'OPTIONS' }));
  assert.equal(res.status, 204);
}

// ── publicCounts projection carries COUNTS ONLY (no names / titles / capabilities leak) ──────────
{
  const state = {
    counts: { tasksDone: 7, branchesSpawned: 11, newAgentsTotal: 2, approvalsPending: 1 },
    agents: [{ id: 'a0', name: 'SECRET-prospect-agent', capabilities: ['outreach'] }],
    runningAgentIds: ['a0'],
    nodes: [{ title: 'Confidential strategy', prompt: 'leak me' }],
  };
  const pub = publicCounts(state);
  assert.equal(pub.agentsActive, 1);
  assert.equal(pub.tasksDone, 7);
  const j = JSON.stringify(pub);
  for (const leak of ['SECRET', 'prospect', 'outreach', 'Confidential', 'leak me']) assert.ok(!j.includes(leak), `publicCounts leaked ${leak}`);
  assert.equal(assertNoLeak(pub), true);
}

console.log('infinity-wisdom-web test suite passed (401 unauthed GET/POST · bad bearer · OPTIONS · counts-only no-leak).');
