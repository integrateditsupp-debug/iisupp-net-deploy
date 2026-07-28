// axis-composer.js — the ONE composer, used by BOTH the Action Inbox (reply) and the Prospect profile
// (outreach). CC-BRIEF §2A/§2B, CONTRACTS §4. It renders through overlay() OVER the current screen: no
// go(), no state.module, no clearing of state.ui.thread / state.ui.prospect. Zero navigation is the whole
// point — "Draft AI Reply → now go look in Approvals" is what made the task never finish.
//
// The browser NEVER sends. Send/Save post an intent; the worker executes behind the authoritative
// railsCheck(). What the operator reads here is exactly what transmits, CASL block included.
import { el, overlay, toast, postIntent } from './axis-dom.js';

const CSS = `
.axis-composer-subject{width:100%;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;
  padding:9px 11px;color:var(--txt);font:inherit}
.axis-composer-text{width:100%;min-height:200px;resize:vertical;background:var(--surface-2);
  border:1px solid var(--line);border-radius:8px;padding:11px;color:var(--txt);font:inherit;font-size:12.5px;
  line-height:1.55;white-space:pre-wrap}
.axis-composer-subject:focus,.axis-composer-text:focus{border-color:var(--gold);outline:none}
.axis-composer-casl{border:1px dashed var(--gold);background:var(--gold-dim);border-radius:8px;padding:10px 12px}
.axis-composer-casl pre{margin:7px 0 0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);
  font-size:11px;line-height:1.5;color:var(--txt-2)}
.axis-composer-rail{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line)}
.axis-composer-rail:last-child{border-bottom:0}
.axis-composer-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px;
  border-top:1px solid var(--line);flex:none}
.axis-composer-send{border:1px solid var(--gold);background:var(--gold);color:var(--gold-ink);border-radius:8px;
  padding:8px 18px;font:inherit;font-weight:600;cursor:pointer}
.axis-composer-send[disabled]{opacity:.42;cursor:not-allowed}
.axis-composer-dot-unread{background:var(--txt-3)}
`;
function injectCss() { // scoped to this module's own classes; every value is an axis-tokens.css variable
  if (document.getElementById('axisComposerCss')) return;
  document.head.append(el('style', { id: 'axisComposerCss' }, CSS));
}

// ── Rails (pure, unit-testable) ──────────────────────────────────────────────────────────────────
// ADVISORY MIRROR of railsCheck() in scripts/lib/outreach.mjs. Rail names and semantics match that file so
// the operator reads the same words the worker will use. It is DISPLAY ONLY: the worker copy runs at send
// time against the live DB and is the authority. Anything this side cannot know (today's sent count, the
// suppression addresses, the CASL mailing address) is reported as unknown — never guessed, and never
// counted as a failure, since a hard block on missing data would hide a perfectly sendable message.
// Warn-only rails (DKIM, exactly as in railsCheck) report pass:true with the warning in `detail`.
export function composerRailVerdict(rails, ctx) {
  const r = rails || {};
  const c = ctx || {};
  const mode = c.mode === 'outreach' ? 'outreach' : 'reply';
  const cold = mode === 'outreach'; // CASL / template / consent rails exist for cold outbound only
  const to = String(c.to || '').trim().toLowerCase();
  const body = String(c.body || '');
  const checks = [];
  // `known` = the composer actually evaluated this rail against a published value. A rail we could not
  // evaluate is NOT a pass: it carries pass:true only so an unpublished snapshot cannot block a sendable
  // message, and renders neutral, never green. A green tick for a value nobody read is a lying dashboard.
  const add = (key, label, pass, detail, known = true) => checks.push({ key, label, pass: !!pass, detail, known: known !== false });

  // DKIM — warn, never a hard block (it caps volume, it does not stop a send).
  if (r.dkim_ok === true) add('dkim', 'DKIM', true, 'DKIM live');
  else if (r.dkim_ok === false) add('dkim', 'DKIM', true, 'DKIM not live — the worker holds the first-batch cap and does not ramp');
  else add('dkim', 'DKIM', true, 'not published to the composer — checked at send time', false);

  // Daily cap — the worker publishes the cap; today's count is worker-side unless it publishes that too.
  const cap = r.effective_daily_cap ?? r.daily_cap;
  if (cap == null) add('daily_cap', 'Daily cap', true, 'cap not published to the composer — enforced at send time', false);
  else if (r.sent_today == null) add('daily_cap', 'Daily cap', true, `cap ${cap}/day — today's count not published, enforced at send time`, false);
  else add('daily_cap', 'Daily cap', r.sent_today < cap, `${r.sent_today}/${cap} sent today`);

  // Suppression — hard block. The list itself is normally NOT published to the browser (it holds real
  // addresses), so the honest answer here is usually "count known, addresses checked worker-side".
  const list = Array.isArray(r.suppression) ? r.suppression.map(x => String(x).toLowerCase()) : null;
  const domain = to.includes('@') ? '@' + to.split('@')[1] : '';
  if (list) {
    const hit = !!to && (list.includes(to) || (!!domain && list.includes(domain)));
    add('suppression', 'Suppression list', !hit, hit ? `${to} is ON the suppression list — BLOCKED` : 'not on the suppression list');
  } else {
    const n = r.suppression_count;
    add('suppression', 'Suppression list', true, n == null
      ? 'list not published to the composer — checked at send time'
      : `${n} entr${n === 1 ? 'y' : 'ies'} — the list stays worker-side and is checked at send time`, false);
  }

  // Locked template — cold outbound must carry the approved template id.
  // NB: railsCheck() in scripts/lib/outreach.mjs applies this to EVERY item, replies included
  // (`pass: !!item.template_id`). So a reply is not "not applicable" — it is a rail this surface
  // cannot judge, and the worker may still hold on it. Say that, do not paint it green.
  if (!cold) add('approved_template', 'Locked template', true, 'reply on an existing thread — the worker still applies this rail at send time', false);
  else add('approved_template', 'Locked template', !!c.templateId, c.templateId ? String(c.templateId) : 'no template id — the worker will hold this');

  // Quiet hours — the ONE rail evaluated locally, because it is a clock read, not a metric. Same
  // arithmetic as railsCheck(): a wrapping window (21→8) is inside when hr >= start OR hr < end.
  // `hour()` is deliberately strict: Number(null) and Number('') are both 0, so a null/blank quiet window
  // would otherwise render as a fabricated "00:00–00:00 ET" instead of the honest "not published".
  const hour = (v) => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const q = (r.quiet_hours && typeof r.quiet_hours === 'object') ? r.quiet_hours : {};
  const qs = hour(q.start), qe = hour(q.end);
  const hr = torontoHour(c.now == null ? new Date() : c.now);
  if (qs == null || qe == null || hr == null) {
    add('quiet_hours', 'Quiet hours', true, 'window not published to the composer — enforced at send time', false);
  } else {
    const inQuiet = (qs > qe) ? (hr >= qs || hr < qe) : (hr >= qs && hr < qe);
    const win = `${pad2(qs)}:00–${pad2(qe)}:00 ET`;
    add('quiet_hours', 'Quiet hours', !inQuiet, `Toronto ${pad2(hr)}:00 — ${inQuiet ? `quiet ${win}, hold` : `ok to send (quiet ${win})`}`);
  }

  // CASL footer — hard for cold outbound. The mailing address lives in the worker's private constants and
  // is never shipped to /assets, so the browser can only confirm the working one-click unsubscribe.
  // Same railsCheck() caveat as the template rail: the worker evaluates casl_footer and consent_basis on
  // every item, so on a reply these are unevaluated-here, not not-applicable.
  if (!cold) {
    add('casl_footer', 'CASL footer', true, 'reply on an existing thread — the worker still applies this rail at send time', false);
  } else {
    const unsub = /unsubscribe/i.test(body);
    const addr = r.casl_address ? body.includes(r.casl_address) : null;
    add('casl_footer', 'CASL footer', unsub && addr !== false,
      !unsub ? 'MISSING — no one-click unsubscribe in the message'
        : addr === false ? 'unsubscribe present but the mailing address is missing'
          : addr === true ? 'mailing address + one-click unsubscribe present'
            : 'one-click unsubscribe present — the worker verifies the mailing address at send time',
      addr !== null); // address half unread ⇒ not a full pass
  }

  // Consent basis — recorded on the outreach record worker-side; echoed here only when handed to us.
  if (!cold) add('consent_basis', 'Consent basis', true, 'reply on an existing thread — the worker still applies this rail at send time', false);
  else if (c.consentBasis) add('consent_basis', 'Consent basis', true, `${c.consentBasis}${c.consentEvidence ? ` (${c.consentEvidence})` : ''}`);
  else add('consent_basis', 'Consent basis', true, 'not published to the composer — the worker requires one at send time', false);

  // Not in railsCheck, but a real failure mode this surface owns: an empty recipient, subject or body.
  const miss = [];
  if (!to) miss.push('recipient');
  if (!String(c.subject || '').trim()) miss.push('subject');
  if (!body.trim()) miss.push('body');
  add('recipient', 'Recipient + content', miss.length === 0, miss.length ? `empty: ${miss.join(', ')}` : `to ${to}`);

  return { pass: checks.every(x => x.pass), checks };
}
const pad2 = (n) => String(n).padStart(2, '0');
// Same helper as outreach.mjs — Toronto is the operating timezone. Returns null rather than throwing or
// rendering "Toronto NaN:00": outreach.mjs's copy assumes a real Date, this one is exported surface and
// must survive a caller handing it a string, a plain object or an Invalid Date.
function torontoHour(now) {
  const d = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(d.getTime())) return null;
  let h;
  try { h = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }).format(d)) % 24; }
  catch { h = d.getUTCHours(); }
  return Number.isFinite(h) ? h : null;
}

// The worker appends the CASL block with caslFooter() as "\n\n—\n<line>: <unsubscribe url>". Split it back
// off so it can be shown read-only: the operator may rewrite the message, never the legally required block.
function splitCasl(full) {
  const i = full.lastIndexOf('\n\n—\n');
  if (i >= 0) return { body: full.slice(0, i), footer: full.slice(i) };
  const m = full.match(/\n[^\n]*unsubscribe[^\n]*\s*$/i); // footer inlined without the separator
  if (m) return { body: full.slice(0, m.index), footer: full.slice(m.index) };
  return { body: full, footer: '' };
}

// ── The composer ─────────────────────────────────────────────────────────────────────────────────
export function openComposer(opts = {}) {
  injectCss();
  const mode = opts.mode === 'outreach' ? 'outreach' : 'reply';
  const src = splitCasl(String(opts.body || ''));   // src.body = the worker's copy = the drift baseline
  const restore = opts.restore || null;             // set only when we reopen after a failed post
  const st = {
    subject: String(restore ? restore.subject : (opts.subject || '')),
    body: String(restore ? restore.body : src.body),
    edited: !!(restore && restore.edited),
    closed: false,
  };
  const transmitted = () => st.body + src.footer;   // the exact bytes, every time
  const who = opts.contactName || opts.to || 'recipient';
  const title = mode === 'outreach' ? `Email ${who}` : `Reply to ${who}`;

  // — recipient is read-only: we send to the address the worker resolved, never one typed here —
  const idRow = el('div', {}, [
    el('div', { class: 'eyebrow' }, mode === 'outreach' ? 'initial outreach · locked template' : 'reply in place · zero navigation'),
    el('div', { style: 'display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-top:6px' }, [
      el('span', { class: 'eyebrow' }, 'to'),
      opts.to ? el('span', { class: 'mono', style: 'font-size:12px' }, opts.to)
        : el('span', { class: 'unknown', style: 'font-size:12px' }, 'No address on file — nothing can be sent'),
      opts.companyName ? el('span', { class: 'stage-tag' }, opts.companyName) : null,
      opts.templateId ? el('span', { class: 'stage-tag' }, String(opts.templateId)) : null,
    ]),
  ]);

  const subjectInput = el('input', { class: 'axis-composer-subject', type: 'text', 'aria-label': 'Subject', autocomplete: 'off' });
  subjectInput.value = st.subject;
  subjectInput.addEventListener('input', onEdit);

  const bodyArea = el('textarea', { class: 'axis-composer-text', 'aria-label': 'Message body — exactly what will be transmitted' });
  bodyArea.value = st.body;
  bodyArea.addEventListener('input', onEdit);

  // — CASL block: visually distinct, clearly labelled, NOT editable —
  const caslBox = el('div', { class: 'axis-composer-casl' }, [
    el('div', { class: 'eyebrow', style: 'color:var(--gold)' }, 'required by CASL — sent with every message'),
    src.footer
      ? el('pre', {}, src.footer.replace(/^\n+/, ''))
      : el('div', { class: 'unknown', style: 'margin-top:6px;font-size:12px' },
        'No CASL block on this message. The worker attaches it — if it is still missing at send time the send is held.'),
  ]);

  const drift = el('div', { style: 'font-size:12px' });
  const counts = el('div', { class: 'mono', style: 'font-size:10.5px;color:var(--txt-3);margin-top:5px' });
  const railList = el('div', {});
  const heldNote = el('div', { style: 'flex:1;min-width:170px;font-size:12px' });
  const sendBtn = el('button', { class: 'axis-composer-send', onclick: () => transmit('compose_send') }, 'Send');
  const foot = el('div', { class: 'axis-composer-foot' }, [
    sendBtn,
    el('button', { class: 'chip', onclick: () => transmit('compose_draft') }, 'Save as draft'),
    el('button', { class: 'chip', onclick: () => requestClose() }, 'Cancel'),
    heldNote,
  ]);

  // Optional: the message being replied to, collapsed and read-only. Not in the CONTRACTS §4 opts list —
  // it is there so the operator can re-read the client's words without closing the composer to go find
  // them, which is the same tab-hop this module exists to kill. Rendered only when the caller passes it.
  const quote = (mode === 'reply' && opts.quote)
    ? el('details', { class: 'filtered-drawer', style: 'margin:0' }, [
      el('summary', {}, `▸ ${opts.quoteLabel || 'The message you are replying to'}`),
      el('div', { style: 'padding:0 14px 12px;color:var(--txt-2);font-size:12px;white-space:pre-wrap' }, String(opts.quote)),
    ])
    : null;

  const sections = [
    idRow,
    quote,
    el('div', {}, [el('div', { class: 'eyebrow', style: 'margin-bottom:5px' }, 'subject'), subjectInput]),
    el('div', {}, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:5px' }, 'message — this is exactly what transmits'),
      bodyArea, drift, counts,
    ]),
    caslBox,
    el('div', { class: 'card', style: 'padding:11px 13px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px' }, [
        el('div', { class: 'eyebrow' }, 'rails'), el('span', { class: 'footnote' }, 'published by the worker'),
      ]),
      railList,
      el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:8px' },
        'Shown for your judgement — the composer does not compute these. railsCheck() runs again worker-side at send time and is the authority.'),
    ]),
  ];

  // overlay() owns the backdrop, Esc and the ✕, and closes on all three WITHOUT asking. The unsaved-edits
  // guard therefore has to win the race: both listeners are capture-phase on document and are registered
  // BEFORE overlay() is constructed, so they run first and can stop the close from ever happening.
  document.addEventListener('keydown', escGuard, true);
  document.addEventListener('click', backdropGuard, true);
  let verdict = { pass: false, checks: [] }; // declared before the first refresh() — no TDZ
  const ov = overlay({ title, width: 760, onClose: teardown });
  ov.body.append(...sections.filter(Boolean)); // append(null) would stringify to a literal "null" node
  ov.root.append(foot);                       // outside the scroll area: Send stays visible
  ov.root.addEventListener('keydown', onKey); // isolate the app's global ⌘K / J-K-A-X-S bindings
  refresh();
  // overlay defers its own initial focus by a tick and would land on the ✕. Ours is registered later, so
  // it runs after and wins: the operator starts in the message, cursor at the top.
  setTimeout(() => { if (!st.closed) { bodyArea.focus(); try { bodyArea.setSelectionRange(0, 0); } catch { /* older engines */ } } }, 0);

  function onEdit() {
    st.subject = subjectInput.value;
    st.body = bodyArea.value;
    st.edited = st.subject !== String(opts.subject || '') || st.body !== src.body;
    refresh();
  }
  function onKey(e) {
    e.stopPropagation(); // Esc/Tab are already handled by overlay() in the capture phase
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (verdict.pass) transmit('compose_send'); }
  }
  function escGuard(e) {
    if (st.closed || e.key !== 'Escape' || !st.edited) return; // untouched composer: let overlay close it
    e.preventDefault(); e.stopImmediatePropagation(); requestClose();
  }
  function backdropGuard(e) {
    if (st.closed || !st.edited) return;
    const t = e.target;
    // MUST be the class axis-dom.js's overlay() actually puts on its backdrop (axis-dom.js:88).
    // It is deliberately NOT the shell's '.drawer-bg' — clearOverlays() sweeps that one every poll.
    if (!t || !t.classList || !t.classList.contains('axis-overlay-bg')) return;
    e.preventDefault(); e.stopImmediatePropagation(); requestClose();
  }

  function refresh() {
    verdict = composerRailVerdict(opts.rails, {
      mode, to: opts.to, subject: st.subject, body: transmitted(),
      templateId: opts.templateId, consentBasis: opts.consentBasis, consentEvidence: opts.consentEvidence,
    });
    railList.innerHTML = '';
    // Three states, not two: fail (red), evaluated-and-clear (green), and NOT EVALUATED HERE (neutral).
    // A rail nobody read must never render as a green tick — that is the lying-dashboard failure mode.
    verdict.checks.forEach(ch => railList.append(el('div', { class: 'axis-composer-rail' }, [
      el('span', { class: 'dot ' + (!ch.pass ? 'dot-crit' : ch.known === false ? 'axis-composer-dot-unread' : 'dot-ok'), style: 'margin-top:5px;flex:none' }),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-size:12.5px;font-weight:600;color:' + (!ch.pass ? 'var(--crit)' : ch.known === false ? 'var(--txt-2)' : 'var(--txt)') }, ch.label),
        el('div', { class: ch.known === false ? 'unknown' : '', style: 'font-size:11.5px;color:var(--txt-3)' }, ch.detail),
      ]),
    ])));
    const unread = verdict.checks.filter(ch => ch.known === false).length;
    if (!opts.rails) railList.append(el('div', { class: 'unknown', style: 'font-size:11.5px;padding-top:6px' },
      'The settings snapshot has not published rails yet — nothing above came from a live read.'));
    else if (unread) railList.append(el('div', { class: 'unknown', style: 'font-size:11.5px;padding-top:6px' },
      `${unread} of ${verdict.checks.length} rails were not evaluated here (grey) — the worker reads those at send time.`));

    const words = st.body.trim() ? st.body.trim().split(/\s+/).length : 0;
    counts.textContent = `${words} word${words === 1 ? '' : 's'} · ${st.body.length} characters`
      + (src.footer ? ` · CASL block adds ${src.footer.trim().length}` : '');

    // Drift: warn, never block. The locked copy is the approved copy, and the worker lints on send.
    drift.innerHTML = '';
    if (mode === 'outreach' && src.body && st.body !== src.body) {
      const d = st.body.length - src.body.length;
      drift.append(el('div', { style: 'color:var(--warn);margin-top:7px' },
        `Edited away from the locked template (${d >= 0 ? '+' : ''}${d} characters). That is allowed — the worker `
        + 'lints the copy at send time and holds anything that drifted off the approved template.'));
    }

    const failing = verdict.checks.filter(ch => !ch.pass);
    sendBtn.disabled = failing.length > 0;
    heldNote.style.color = failing.length ? 'var(--crit)' : 'var(--txt-3)';
    heldNote.textContent = failing.length
      ? `Held: ${failing[0].label.toLowerCase()} — ${failing[0].detail}` + (failing.length > 1 ? ` (+${failing.length - 1} more)` : '')
      : 'Nothing sends until you press Send (⌘/Ctrl + Enter).';
  }

  function teardown() { // overlay() calls this after ANY close: ✕, backdrop, Esc, or our own close()
    st.closed = true;
    document.removeEventListener('keydown', escGuard, true);
    document.removeEventListener('click', backdropGuard, true);
  }
  function close() { if (!st.closed) ov.close(); } // ov.close() is idempotent and fires teardown
  function requestClose() {
    // Only nag when there is something to lose. An untouched composer closes instantly.
    if (st.edited && !window.confirm('Discard your edits? This message has not been sent.')) return;
    close();
  }

  function payload() {
    return {
      message_id: opts.messageId ?? null,
      business_id: opts.businessId ?? null,
      contact_email: opts.to || null, // CONTRACTS §3 carries both; we only ever know the one address
      to_email: opts.to || null,
      subject: st.subject,
      body: transmitted(),
      source: mode === 'outreach' ? 'prospect_outreach' : 'inbox_reply',
      template_id: opts.templateId ?? null,
    };
  }

  // Optimistic close + rollback (CONTRACTS §3). The operator's typed message is the one thing we must
  // never lose: on a falsy post we reopen with the exact text and say plainly that nothing transmitted.
  async function transmit(type) {
    if (st.closed) return;
    if (type === 'compose_send' && !verdict.pass) return; // belt and braces — the button is already disabled
    const sending = payload();
    const keep = { subject: st.subject, body: st.body, edited: st.edited };
    close();
    toast(type === 'compose_send'
      ? 'Sending — the worker checks rails, then logs it to CRM'
      : 'Saved as a Gmail draft — nothing transmitted');
    const ok = await postIntent(type, sending);
    if (!ok) {
      toast(type === 'compose_send' ? 'Send failed — nothing was transmitted, your message is back' : 'Draft failed — your message is back');
      openComposer({ ...opts, restore: keep });
      return;
    }
    if (type === 'compose_send' && typeof opts.onSent === 'function') opts.onSent(sending);
  }

  return { close, root: ov.root };
}
