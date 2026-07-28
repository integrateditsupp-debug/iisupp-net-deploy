// sentry-classify.mjs — Sentry inbox classifier. WORKER-OWNED. Deterministic-first, conservative-AI for
// the genuinely ambiguous, and the safety default: unsure between noise and actionable → ACTIONABLE.
// Classes: reply_to_outreach | new_inbound_request | bounce | out_of_office | unsubscribe_request | noise.
// Only reply_to_outreach + new_inbound_request are actionable (Badge Law). Everything else is filtered.
export const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];

const h = (msg, name) => {
  const hs = msg.headers || {};
  const k = Object.keys(hs).find(x => x.toLowerCase() === name.toLowerCase());
  return k ? String(hs[k]) : '';
};
const emailOf = (from) => (String(from || '').match(/[\w.+%-]+@[\w.-]+\.[\w-]+/) || [''])[0].toLowerCase();

// ctx: { sentThreadIds:Set, sentMessageIds:Set, knownContacts:Set(lowercased emails) }
export function classify(msg, ctx = {}) {
  const from = emailOf(msg.from);
  const subj = (msg.subject || '').toLowerCase();
  const body = (msg.snippet || msg.body || '').toLowerCase();
  const det = (classification, reason) => ({ classification, reason, deterministic: true });

  // 1) Bounces / delivery failures → bounce (highest priority; never actionable)
  if (/mailer-daemon|postmaster|mail delivery (sub)?system|delivery status notification/i.test(from + ' ' + subj) ||
      /report-type=delivery-status|multipart\/report/i.test(h(msg, 'Content-Type')) ||
      /(delivery|delivery has) failed|undeliverable|address not found|550|recipient.*(rejected|not found)/i.test(subj + ' ' + body)) {
    return det('bounce', 'mailer-daemon / DSN / delivery-failure signal');
  }

  // 2) Explicit unsubscribe request (from a human, tied to our outreach)
  if (/\b(unsubscribe|opt.?out|remove me|take me off|stop emailing)\b/i.test(subj + ' ' + body) && body.length < 600) {
    return det('unsubscribe_request', 'unsubscribe/opt-out phrasing');
  }

  // 3) Out-of-office / auto-reply
  if (/auto-?replied/i.test(h(msg, 'Auto-Submitted')) ||
      /out of (the )?office|automatic reply|auto-?reply|on (leave|vacation|holiday)|away from my desk|currently out/i.test(subj + ' ' + body.slice(0, 200))) {
    return det('out_of_office', 'auto-reply / OOO phrasing');
  }

  // 4) Bulk / automated mail (newsletters, notifications) → noise, UNLESS it threads with our outreach
  const inReplyTo = h(msg, 'In-Reply-To') + ' ' + h(msg, 'References');
  const threadsWithSent = (ctx.sentThreadIds && ctx.sentThreadIds.has(msg.thread_id)) ||
    (ctx.sentMessageIds && [...(ctx.sentMessageIds || [])].some(id => inReplyTo.includes(id)));
  const bulk = !!h(msg, 'List-Unsubscribe') || /bulk/i.test(h(msg, 'Precedence')) || /auto-generated/i.test(h(msg, 'Auto-Submitted'));
  if (bulk && !threadsWithSent) return det('noise', 'List-Unsubscribe / Precedence:bulk / auto-generated (newsletter/notification)');

  // 5) Receipts / transactional from no-reply senders → noise
  if (/no-?reply|donotreply|receipts?@|billing@|notifications?@/i.test(from) &&
      /receipt|invoice|payment (received|confirmation)|your order|statement|subscription/i.test(subj + ' ' + body)) {
    return det('noise', 'transactional receipt from no-reply sender');
  }

  // 5b) AXIS/ARIA internal reports and known provider account notices are operational telemetry,
  // not client work. A direct reply to sent outreach still wins below through its thread linkage.
  const internalSystemSender = /@(iisupp\.net|integrateditsupp\.com)$/i.test(from);
  if (internalSystemSender && !threadsWithSent) return det('noise', 'internal AXIS/IIS operational message');
  if (/@mail\.anthropic\.com$|academy-support@anthropic\.com$/i.test(from) && !threadsWithSent) {
    return det('noise', 'provider account or program notification');
  }
  if (/@service-now\.com$/i.test(from) && /developer instance|inactivity warning|instance.*warning/i.test(subj + ' ' + body) && !threadsWithSent) {
    return det('noise', 'provider developer-instance notification');
  }

  // 6) Reply to our outreach → reply_to_outreach (thread/Message-ID match, or known contact replying)
  if (threadsWithSent) return det('reply_to_outreach', 'threads with a sent outreach message');
  if (ctx.knownContacts && ctx.knownContacts.has(from) && /^re:/i.test(msg.subject || '')) {
    return det('reply_to_outreach', 'known contact + Re: subject');
  }

  // 7) Known contact, new thread → new_inbound_request
  if (ctx.knownContacts && ctx.knownContacts.has(from)) return det('new_inbound_request', 'known contact, new thread');

  // 8) Ambiguous → conservative AI (stubbed heuristic here; live path may call the LLM). A genuine-looking
  //    human message with a question/request from a non-bulk sender is treated as a new inbound request.
  const humanish = !/no-?reply|donotreply|mailer|daemon|newsletter|notifications?@/i.test(from);
  const asksSomething = /\?|please|can you|could you|interested|quote|help|support|inquir|question|reach out|looking for/i.test(subj + ' ' + body);
  if (humanish && asksSomething) return { classification: 'new_inbound_request', reason: 'human sender with a request (conservative: actionable)', deterministic: false };

  // Safety default: unsure between noise and actionable → ACTIONABLE (never silently drop a real client).
  if (humanish) return { classification: 'new_inbound_request', reason: 'unsure → actionable (human sender)', deterministic: false };
  return { classification: 'noise', reason: 'no actionable signal', deterministic: false };
}
