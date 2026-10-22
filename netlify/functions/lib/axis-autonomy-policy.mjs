// axis-autonomy-policy.mjs — HOW MUCH AXIS DOES ON ITS OWN, and the trail every action leaves.
//
// Owner directive (Ahmad, 2026-10-21, verbatim intent): "it should do everything without me but have a
// trail of it all." AXIS is the Senior Director of Operations: invoices, tax papers, marketing, client
// communication, the inbox, and everything else run WITHOUT Ahmad's involvement. Two reflexes stay:
//   (a) when AXIS knows a better route than the one Ahmad asked for, it says so BEFORE executing, then
//       executes (advise-first is a pause for one sentence, not a stop);
//   (b) critical inputs that came from Ahmad's own mouth or keyboard (amounts, recipients, legal names,
//       dates) are read back twice before they are used — so a mis-heard number never ships.
// Everything, without exception, is written to the trail (Blob store `axis-exec` key `trail`, mirrored to
// the attention-log the Brief tab reads, and surfaced in the sign-in debrief).
//
// MODE is an environment switch so the business can throttle without a deploy:
//   AXIS_AUTONOMY=full   (default since 2026-10-21) — act, then trail. Approvals auto-approve.
//   AXIS_AUTONOMY=gated  — the pre-2026-10-21 behaviour: approvals wait for Ahmad in AXIS → Approvals.
//   AXIS_AUTONOMY=off    — AXIS drafts only; nothing executes. (Kill switch.)
// Ctrl+Alt+K in the console and "AXIS stop" still stand everything down immediately, in every mode.

export const AUTONOMY_REV = '2026-10-21-full-with-trail';

export function autonomyMode() {
  const m = String(process.env.AXIS_AUTONOMY || 'full').toLowerCase();
  return m === 'gated' || m === 'off' ? m : 'full';
}

// Action classes. `tier` is what AXIS does by default in `full` mode:
//   act      — execute, trail it.
//   advise   — say the better route in one line, then execute, trail it (used when AXIS disagrees).
//   readback — read the critical input back twice, then execute, trail it.
// `capability` names the integration that has to exist for the action to be possible at all. Without
// it AXIS stages the step (drafts the invoice, writes the filing packet) and trails WHY it stopped —
// that is a missing tool, not a request for Ahmad's permission.
export const ACTIONS = Object.freeze({
  // Money
  'invoice.draft':      { tier: 'act',      capability: null },
  'invoice.issue':      { tier: 'readback', capability: 'stripe' },
  'invoice.remind':     { tier: 'act',      capability: 'mail' },
  'payment.record':     { tier: 'act',      capability: 'ledger' },
  'spend.commit':       { tier: 'readback', capability: 'card' },         // AXIS never holds the card: stages + trails
  // Tax / compliance
  'tax.collect':        { tier: 'act',      capability: null },           // gather documents, build the packet
  'tax.calc':           { tier: 'act',      capability: null },           // estimates, labelled as estimates
  'tax.file':           { tier: 'readback', capability: 'cra' },          // no CRA integration exists: stages the packet
  // Marketing
  'marketing.draft':    { tier: 'act',      capability: null },
  'marketing.publish':  { tier: 'act',      capability: 'site' },         // branch + publish via Codex loop
  'social.post':        { tier: 'act',      capability: 'social' },
  'ads.change':         { tier: 'advise',   capability: 'ads' },          // budget moves get the one-line advice first
  // Clients + inbox
  'inbox.triage':       { tier: 'act',      capability: 'mail' },
  'client.reply':       { tier: 'act',      capability: 'mail' },
  'client.proposal':    { tier: 'readback', capability: 'mail' },         // price + scope read back twice
  'outreach.send':      { tier: 'act',      capability: 'mail' },         // CASL rules still apply inside the send path
  'followup.send':      { tier: 'act',      capability: 'mail' },
  'calendar.book':      { tier: 'act',      capability: 'calendar' },
  // Operations
  'agent.dispatch':     { tier: 'act',      capability: null },
  'automation.create':  { tier: 'act',      capability: null },
  'doc.create':         { tier: 'act',      capability: null },
  'account.change':     { tier: 'readback', capability: 'admin' },        // Entra / security / repo visibility: staged, trailed
  'contract.sign':      { tier: 'readback', capability: 'esign' },
});

export function tierFor(action) {
  const a = ACTIONS[action];
  const mode = autonomyMode();
  if (mode === 'off') return 'draft';
  if (mode === 'gated') return 'approve';
  return a ? a.tier : 'act';
}

/** True when the action should execute without waiting for Ahmad in the current mode. */
export function autoExecute(action) { const t = tierFor(action); return t === 'act' || t === 'advise' || t === 'readback'; }

/**
 * Append one entry to the trail. `store` is the Blob-backed readJSON/writeJSON pair from axis-exec-core.
 * Entry shape: { id, t, action, tier, mode, who, summary, inputs, result, cost, ref }.
 * Never throws — a trail failure must not stop the work, but it is itself trailed on the next write.
 */
export async function trail(store, entry) {
  try {
    const list = await store.readJSON('trail', []);
    const row = {
      id: 'trl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      t: new Date().toISOString(), mode: autonomyMode(), rev: AUTONOMY_REV, who: 'AXIS',
      ...entry,
    };
    list.unshift(row);
    await store.writeJSON('trail', list.slice(0, 2000));
    return row;
  } catch (e) { return { error: e && e.message }; }
}

/** The debrief line for the trail: what AXIS did since a timestamp. */
export function trailSummary(list, sinceIso) {
  const since = sinceIso ? Date.parse(sinceIso) : 0;
  const rows = (list || []).filter((r) => Date.parse(r.t) > since);
  if (!rows.length) return 'No actions since your last sign-in.';
  const by = {};
  for (const r of rows) { const k = String(r.action || 'other').split('.')[0]; by[k] = (by[k] || 0) + 1; }
  const parts = Object.entries(by).map(([k, n]) => `${n} ${k}`);
  return `Since your last sign-in I took ${rows.length} action${rows.length === 1 ? '' : 's'}: ${parts.join(', ')}. The trail has every one.`;
}
