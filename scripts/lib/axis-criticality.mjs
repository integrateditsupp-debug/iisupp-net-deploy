// axis-criticality.mjs — the bar for the AXIS Director queue (CC-BRIEF §2E, CONTRACTS §6). WORKER-OWNED.
// The old approvals queue became noise because everything landed in it. Exactly two things earn a human:
//   cost       — spends money, or commits to spending it.
//   reputation — leaves the building under the company name (outbound email to a third party, any public
//                artifact), or names a third party in something that goes out.
// Everything else auto-proceeds and is reported after the fact. The UI filters on the stamp, never decides.
//
// RETURN SHAPE: { criticality:'critical'|'routine', reason:'cost'|'reputation'|null, detail:string }.
// The approvals ROW field is named `critical_reason` (CONTRACTS §2/§6, read by assets/axis-director-screen.js).
// Whoever wires this into computeSnapshots() MUST map it explicitly — a bare Object.assign(row, verdict)
// leaves `critical_reason` undefined and every row renders "Flagged critical — no reason recorded.":
//   const v = classifyCriticality(row); row.criticality = v.criticality; row.critical_reason = v.reason;
//
// Accepts BOTH shapes the system produces: an `outreach_items` row (channel/kind/subject/to_email/
// template_id/status) and an intent payload (`{ type, ... }`, netlify/functions/axis-intent.mjs §KNOWN_TYPES).

export const CRITICAL_REASONS = ['cost', 'reputation'];

// Our own domain. Mail to it never leaves the building. Overridable via ctx.internalDomains.
export const INTERNAL_DOMAINS = ['iisupp.net'];

// Actions that only mutate our own state. Deliberately TIGHT: anything not proven internal falls through
// to the fail-safe below, because a false "routine" silently ships, while a false "critical" only costs a
// click. `compose_draft`/`draft_reply` are here because they stop at a Gmail draft and never transmit
// (CONTRACTS §3) — a *pending outreach row* is NOT a draft in this sense, it is a queued send.
export const ROUTINE_ACTIONS = [
  'stage_override', 'advance_stage', 'won_lost', 'score_edit',
  'note', 'note_route', 'add_note', 'snooze', 'mark_handled',
  'csv_export', 'export', 'cadence_edit', 'cancel_followup',
  'draft_reply', 'draft_email', 'compose_draft', 'edit_draft', 'rewrite', 'regen',
  'new_version', 'duplicate', 'edit', 'edit_record', 'add_record',
  'queue_research', 'suppress', 'reject', 'skip',
];

const EMAIL_CHANNELS = new Set(['email', 'mail', 'gmail']);
const OUTBOUND_KINDS = new Set(['initial', 'followup', 'reply']);
const SEND_ACTIONS = new Set(['compose_send', 'send', 'send_email', 'send_now', 'reply_send']);
const PUBLIC_CHANNELS = new Set(['public', 'web', 'website', 'social', 'blog', 'forum']);
const PUBLISH_ACTIONS = new Set(['publish', 'post', 'post_public', 'deploy_public']);
const INTERNAL_CHANNELS = new Set(['internal', 'system', 'log']);

// Structured money fields only. est_monthly_value / est_mrr are NOT here on purpose: those are pre-contact
// research estimates (assessed_value vocabulary, CONTRACTS §2), not a commitment to spend anything.
const MONEY_FIELDS = ['amount', 'amount_cents', 'amount_cad', 'amount_usd', 'price', 'total', 'cost',
  'fee', 'monthly_fee', 'project_fee', 'invoice_total', 'budget', 'spend'];
const MONEY_FLAGS = ['payment', 'subscription', 'recurring', 'charge'];

const COST_WORDS = /\b(payment|pay|invoice|purchase|subscription|billing|renewal|charge|checkout|retainer|deposit|wire transfer|purchase order)\b/i;
const AGREEMENT_WORDS = /\b(agreement|contract|msa|sow|statement of work|quote|proposal|order form|engagement letter)\b/i;

const critical = (reason, detail) => ({ criticality: 'critical', reason, detail });
const routine = (detail) => ({ criticality: 'routine', reason: null, detail });

const str = (v) => (typeof v === 'string' ? v : '');
const domainOf = (email) => email.slice(email.lastIndexOf('@') + 1);
const isInternal = (email, domains) => domains.some(d => domainOf(email) === d || domainOf(email).endsWith('.' + d));

// Same address extractor sentry.mjs uses, so both agree on what counts as a recipient.
const RECIPIENT_FIELDS = ['to_email', 'contact_email', 'to', 'recipient', 'recipients', 'cc', 'bcc'];
function recipientsOf(item) {
  const out = [];
  for (const f of RECIPIENT_FIELDS) {
    const v = item[f];
    if (!v) continue;
    for (const part of Array.isArray(v) ? v : String(v).split(/[,;]/)) {
      const m = String(part).match(/[\w.+%-]+@[\w.-]+\.[\w-]+/);
      if (m) out.push(m[0].toLowerCase());
    }
  }
  return [...new Set(out)];
}

// A nonzero, finite amount. Zero is not a spend — "$0" renders as $0 and asks nobody (CC-BRIEF §3.3).
function moneyField(item) {
  for (const f of MONEY_FIELDS) {
    const raw = item[f];
    const n = typeof raw === 'string' ? Number(raw.replace(/[$,\s]/g, '')) : raw;
    if (typeof n === 'number' && Number.isFinite(n) && n !== 0) return { field: f, value: n };
  }
  return null;
}

export function classifyCriticality(item, ctx) {
  // FAIL SAFE, ON PURPOSE: anything we cannot read is critical. A shape we do not recognise may spend money
  // or send mail; we refuse to assume otherwise and hand it to the human. Under-listing ROUTINE_ACTIONS is
  // therefore the safe error, and the only one this module is allowed to make.
  try {
    return classify(item, ctx && typeof ctx === 'object' ? ctx : {});
  } catch {
    // A field that throws on read (exotic getter, poisoned toString) is by definition unreadable. Same rule.
    return critical(null, 'Unrecognised item shape — cannot prove it is safe, so it goes to the Director.');
  }
}

function classify(item, ctx) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return critical(null, 'Unrecognised item shape — cannot prove it is safe, so it goes to the Director.');
  }

  const domains = Array.isArray(ctx.internalDomains) && ctx.internalDomains.length ? ctx.internalDomains : INTERNAL_DOMAINS;
  const action = str(item.type || item.intent || item.action).toLowerCase();
  const channel = str(item.channel).toLowerCase();
  const kind = str(item.kind).toLowerCase();
  const status = str(item.status).toLowerCase();
  const isEmailish = EMAIL_CHANNELS.has(channel) || SEND_ACTIONS.has(action) || (!channel && OUTBOUND_KINDS.has(kind));

  // 1) HARD EVIDENCE FIRST — structured money and an explicit public flag outrank the routine allowlist.
  //    A generic verb ('edit', 'export', 'add_record', 'note') must never launder a row that carries an
  //    amount or is marked public; CONTRACTS §6 says every cost and every public artifact reaches the
  //    Director. Only the *wording* heuristics stay below the allowlist (step 3), so that drafting an
  //    email whose subject happens to say "proposal" is still routine.
  const money = moneyField(item);
  if (money) return critical('cost', `Carries a monetary amount (${money.field}=${money.value}) — money is committed.`);
  const flag = MONEY_FLAGS.find(f => item[f] === true || (typeof item[f] === 'string' && item[f].trim() !== ''));
  if (flag) return critical('cost', `Marked as a ${flag} — money is committed.`);
  if (PUBLIC_CHANNELS.has(channel) || PUBLISH_ACTIONS.has(action) || item.public === true) {
    return critical('reputation', 'Public artifact published under the company name.');
  }

  // 2) Proven-internal actions. Checked before the recipient test so a draft-only action beats its own
  //    recipient field (compose_draft stops at a Gmail draft and never transmits — CONTRACTS §3).
  if (action && ROUTINE_ACTIONS.includes(action)) {
    return routine(`Internal state change (${action}) — nothing sends, nothing is spent.`);
  }

  // 3) COST by wording: contract/agreement/billing language. Subject/title text is scanned only for
  //    non-email items: "proposal" inside a cold-email subject is copy, not a commitment.
  const labels = [action, kind, channel, str(item.template_id), str(item.doc_type), str(item.type)].join(' ');
  const text = isEmailish ? labels : [labels, str(item.subject), str(item.title)].join(' ');
  if (COST_WORDS.test(text)) return critical('cost', 'Payment/billing action — money leaves the account.');
  if (AGREEMENT_WORDS.test(text)) return critical('cost', 'Contract or agreement document — it commits the company.');

  // 4) Outbound email. initial | followup | reply all count — cold outbound to a real business is exactly
  //    the reputation-affecting category. Our own domain never leaves the building.
  if (isEmailish) {
    const rcpt = recipientsOf(item);
    if (!rcpt.length) {
      return critical('reputation', 'Email with no resolvable recipient — cannot prove it stays internal.');
    }
    const external = rcpt.filter(e => !isInternal(e, domains));
    if (!external.length) return routine(`Internal recipients only (${rcpt.join(', ')}) — never leaves ${domains.join(', ')}.`);
    return critical('reputation', `Outbound ${kind || 'email'} to ${external.join(', ')} under the company name.`);
  }

  // 5) Documents. Non-agreement ones still name a third party the moment they are prepared for a client;
  //    one that has no client and is still marked draft has not gone anywhere.
  if (channel === 'document' || action === 'prepare_for_client') {
    const rcpt = recipientsOf(item);
    if (!rcpt.length && !item.business_id && /draft/.test(status)) {
      return routine('Document is an unassigned internal draft — nothing left the building.');
    }
    return critical('reputation', `Client-facing document${item.subject ? ` (${item.subject})` : ''} names a third party.`);
  }

  if (INTERNAL_CHANNELS.has(channel)) return routine(`Internal-only channel (${channel}) — nothing sends, nothing is spent.`);

  return critical(null, 'Unrecognised item shape — cannot prove it is safe, so it goes to the Director.');
}

export default classifyCriticality;
