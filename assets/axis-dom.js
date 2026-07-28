// axis-dom.js — shared DOM primitives for the AXIS Command Center v2 browser modules.
// Extracted VERBATIM from assets/axis-app.js so sibling modules import one implementation instead of
// redefining drifting copies. Vanilla ESM, no framework/bundler/CDN. This layer renders and posts intents;
// it never computes a metric, never sends mail, and never fabricates a value.

export const $ = (id) => document.getElementById(id);
export const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c != null && c !== false && n.append(c.nodeType ? c : document.createTextNode(String(c))));
  return n;
};
export const SVGNS = 'http://www.w3.org/2000/svg';
export const svg = (tag, attrs = {}, kids = []) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.append(c.nodeType ? c : document.createTextNode(String(c)))); return n; };
export const fmtMoney = (n) => n == null ? '—' : '$' + Number(n).toLocaleString();
export const ago = (ts) => { if (!ts) return ''; const s = (Date.now() - ts) / 1000; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };

// ── init hook ──
// toast/postIntent originally closed over axis-app's module-local auth state. This module cannot see it,
// so the shell MAY inject it at startup: initDom({ authHeaders, onUnauthorized }).
// It is optional on purpose: CONTRACTS §1 documents `import { postIntent } from './axis-dom.js'` with no
// init step, so the default reads the same token axis-app.js persists (localStorage 'aperture_jwt',
// axis-app.js:7/1037/1031) rather than being dead until a shell edit lands. No token ⇒ no fetch, return
// false — a falsy result is exactly what the optimistic-UI rollback path (CONTRACTS §3) expects.
const TOKEN_KEY = 'aperture_jwt';
const defaultAuthHeaders = (extra = {}) => {
  let tok = '';
  try { tok = localStorage.getItem(TOKEN_KEY) || ''; } catch { tok = ''; }
  return tok ? { Authorization: 'Bearer ' + tok, ...extra } : null;
};
let _authHeaders = defaultAuthHeaders;
let _onUnauthorized = null;
export function initDom(opts) {
  const { authHeaders, onUnauthorized } = opts || {};
  if (typeof authHeaders === 'function') _authHeaders = authHeaders;
  if (typeof onUnauthorized === 'function') _onUnauthorized = onUnauthorized;
}

// ── Toast + intent ──
let toastTimer;
export function toast(msg) {
  let t = $('toast'); if (t) t.remove();
  t = el('div', { class: 'toast', id: 'toast' }, msg); document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2800);
}
export async function postIntent(type, payload = {}) {
  if (!_authHeaders) return false; // no auth source — never post unauthenticated
  const headers = _authHeaders({ 'Content-Type': 'application/json' });
  if (!headers) return false;      // not signed in — fail safe, do not hit the endpoint
  try {
    const r = await fetch('/api/axis/intent', { method: 'POST', headers, body: JSON.stringify({ type, payload }) });
    if (r.status === 401) { if (_onUnauthorized) _onUnauthorized(); return false; }
    const j = await r.json();
    return j && j.ok;
  } catch { return false; }
}

// ── Screen chrome ──
export function head(title, eyebrow, style) { return el('div', { class: 'screen-head', style }, [el('div', { class: 'screen-title' }, title), eyebrow ? el('span', { class: 'eyebrow' }, eyebrow) : null]); }
export function downloadText(name, text) {
  const a = document.createElement('a');
  a.href = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(text || '');
  a.download = name; a.click();
}

// ── Centered modal overlay ──
// Renders OVER the current screen. Pure overlay: it never touches state.module, routing, or any screen
// state — that is what made "Draft AI Reply" bounce between tabs. Callers fill `body` and call `close()`.
//
// Two shell facts this must survive (both verified in assets/axis-app.js):
//  1. axis-app.js:725 `clearOverlays()` does `querySelectorAll('.drawer, .drawer-bg').forEach(remove)` and
//     runs inside EVERY renderModule() — including the 15s snapshot poll (axis-app.js:733/1026). Using the
//     shared `.drawer-bg` class would let a worker tick silently delete this modal's backdrop mid-edit,
//     killing backdrop-click-close and un-blocking the nav underneath. So the backdrop carries its own
//     class and inline styling (a copy of .drawer-bg, axis-tokens.css:261) and is not sweepable.
//  2. `.axis-fab` (z-index 70) and `.axis-dock` (71) are always mounted. At 60/61 they float ON TOP of the
//     dialog and stay clickable, so the modal is not modal. 80/81 sits above them and below
//     `.palette` (90) and `.toast` (110), which must still be reachable.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const OVERLAY_BG = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80';
export function overlay({ title = '', onClose, width = 720 } = {}) {
  const prevFocus = document.activeElement; // restored on close so the trigger keeps keyboard context
  let open = true;
  const bg = el('div', { class: 'axis-overlay-bg', style: OVERLAY_BG, onclick: () => close() });
  const body = el('div', { style: 'overflow:auto;min-height:0' });
  const root = el('div', {
    class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog', tabindex: '-1',
    style: `position:fixed;z-index:81;top:50%;left:50%;transform:translate(-50%,-50%);width:min(${Number(width) || 720}px,94vw);`
      + 'max-height:88vh;display:flex;flex-direction:column;gap:12px;box-shadow:0 40px 90px -40px #000;animation:rise .2s ease',
  }, [
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px' }, [
      el('div', { class: 'screen-title' }, title),
      el('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: () => close() }, '✕'),
    ]),
    body,
  ]);

  function focusables() { return Array.from(root.querySelectorAll(FOCUSABLE)).filter(n => n.offsetParent !== null || n === document.activeElement); }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) { e.preventDefault(); root.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function close() {
    if (!open) return; open = false; // idempotent: backdrop + Esc + caller can all race
    document.removeEventListener('keydown', onKey, true);
    bg.remove(); root.remove();
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    if (typeof onClose === 'function') onClose();
    // The shell suppresses its 15s repaint while a modal is up (a repaint underneath would destroy
    // whatever the operator is typing). Tell it the coast is clear so any deferred tick can land.
    if (!document.querySelector('.axis-overlay-bg')) document.dispatchEvent(new CustomEvent('axis:overlay-closed'));
  }

  // Capture phase so the overlay wins Esc/Tab over any screen-level handler underneath.
  document.addEventListener('keydown', onKey, true);
  // ...and swallow everything else on the way OUT, so the shell's global single-key shortcuts cannot fire
  // through an open dialog. axis-app.js:1080-1090 binds a/x/s on the Approvals screen to act('approve'|
  // 'reject'|'skip') — real writes — guarded only by "is an INPUT/TEXTAREA focused". With the composer's
  // Send button focused that guard is false, so a stray keystroke would approve an outbound email behind
  // the dialog. Bubble phase ON `root` (not capture on document) so every listener INSIDE the overlay
  // still receives the event first and keeps working.
  root.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.append(bg, root);
  // Content is appended to `body` by the caller after this returns, so defer the initial focus one tick.
  setTimeout(() => { if (!open) return; const f = focusables()[0]; (f || root).focus(); }, 0);
  return { root, body, close };
}

// ── Rail verdict chip ──
// Rails (daily cap, quiet hours, suppression, template lock) are decided worker-side. This renders the
// verdict string it is handed, verbatim and neutral — the DOM layer must never judge or infer a verdict.
export function confirmRail(text) {
  return el('span', { class: 'stage-tag', style: 'display:inline-flex;align-items:center;gap:6px;white-space:nowrap' },
    text == null || text === '' ? '—' : String(text));
}
