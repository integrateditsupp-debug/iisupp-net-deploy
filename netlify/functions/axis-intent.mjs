// axis-intent — AUTHENTICATED write path for AXIS Command Center v2.
// POST /api/axis/intent { type, payload }  → appends a content-safe intent to the axis-inbox Blobs queue
// the local worker already pulls each tick. This endpoint NEVER sends/applies/pays/executes — it only
// records intent. The worker applies it to SQLite and executes any external action behind its rails
// (daily cap / suppression / approved template / quiet hours / CASL). One queue, one audit trail.
//
// HARD GATE: valid Aperture session required. Records are namespaced schema:'axis-cc-v2' so the existing
// axis-director processor safe-holds them (it only auto-executes its own command/approval shapes) until
// the v2 worker handler lands.
import { verifyAperture } from './aperture-auth.mjs';
import { getStore } from '@netlify/blobs';

const INBOX_STORE = 'axis-inbox';
const MAX_PAYLOAD_BYTES = 8 * 1024;

// Known v2 intent types (assign table §5a). Unknown types are still SAFE (worker holds, never auto-runs),
// but we reject obviously malformed ones early. Kept permissive on purpose — execution safety is downstream.
const KNOWN_TYPES = new Set([
  'proceed', 'note_route',
  'draft_reply', 'mark_handled', 'snooze', 'suppress', 'advance_stage', 'schedule_followup', 'book_meeting',
  'approve', 'reject', 'rewrite', 'skip', 'note', 'bulk_approve', 'bulk_reject',
  'stage_override', 'won_lost',
  'queue_research', 'generate_pack', 'edit_draft', 'regen',
  'cadence_edit', 'cancel_followup',
  // Waiting Reply → Director → follow-up engine. Applied by scripts/lib/axis-intent-apply.mjs on the
  // worker; creates PENDING follow-up outreach only, so it still clears Approvals before anything sends.
  'delegate_followup',
  'duplicate', 'edit', 'new_version', 'prepare_for_client',
  'export', 'send_to_axis_review', 'score_edit',
  'run_now', 'pause', 'instruct',
  'generate_report', 'rails_edit', 'integration_test',
  'add_record', 'edit_record', 'add_note', 'draft_email', 'csv_export',
]);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });
const b36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jr(405, { ok: false, reason: 'POST only' });

  const claims = verifyAperture(req);
  if (!claims) return jr(401, { ok: false, reason: 'unauthorized — Aperture login required' });

  let body;
  try { body = await req.json(); } catch { return jr(400, { ok: false, reason: 'invalid JSON' }); }

  const type = typeof body.type === 'string' ? body.type.trim().slice(0, 64) : '';
  if (!type) return jr(400, { ok: false, reason: 'type required' });
  const payload = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) ? body.payload : {};

  let payloadStr;
  try { payloadStr = JSON.stringify(payload); } catch { return jr(400, { ok: false, reason: 'payload not serializable' }); }
  if (payloadStr.length > MAX_PAYLOAD_BYTES) return jr(413, { ok: false, reason: 'payload too large' });

  const entry = {
    id: 'ccv2-' + b36(),
    ts: new Date().toISOString(),
    schema: 'axis-cc-v2',
    type,
    known: KNOWN_TYPES.has(type),
    payload: JSON.parse(payloadStr),
    actor: claims.sub || 'admin',
    source: 'axis-cc-v2',
  };

  let queued = false;
  try {
    await getStore(INBOX_STORE).setJSON(`pending/${entry.id}`, entry);
    queued = true;
  } catch (e) {
    // Blobs unavailable (local without creds) — acknowledge but report not durably queued.
    console.warn('[axis-intent] inbox store unavailable:', e && e.message);
  }

  return jr(200, { ok: true, queued, id: entry.id, type: entry.type, known: entry.known });
};

export const config = { path: '/api/axis/intent' };
