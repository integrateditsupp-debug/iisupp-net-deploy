// PROD 2026-10-14 (audit §4 / HOME) — the plain-language home: "What I found / What I did / What I need from you",
// the watcher status line and the "what this version can fix" line. PURE HTML builders (node-safe + testable),
// fed ONLY from real state (detections · transparency log · approvals · deferred fixes · pending cards · the recipe
// registry). REAL-OR-EMPTY (Rule 14): an empty list is an honest sentence, never a zero or a made-up percentage.
// 🔒 every string goes through esc() (redactPrivate + HTML-escape), so a private path can never surface here.
import { esc } from "./dashboard.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

function when(ts, now = Date.now()) {
  const t = Date.parse(ts || "");
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  if (diff < 60 * 1000) return "just now";
  if (diff < DAY_MS) return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Seconds/minutes/hours "ago" from a millisecond age. */
export function agoLabel(ageMs) {
  const ms = Number(ageMs);
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return "just now";
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)} s ago`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)} min ago`;
  if (ms < DAY_MS) return `${Math.round(ms / 3600000)} h ago`;
  return `${Math.round(ms / DAY_MS)} d ago`;
}

const RISK_WORD = { red: "needs a person", orange: "higher risk", yellow: "moderate", green: "low risk" };

/** "What I found" — the newest detections, each with the two honest actions (Fix it / Show me) + Not now. */
export function foundRowsHtml(detections = [], { limit = 5, now = Date.now() } = {}) {
  const rows = (Array.isArray(detections) ? detections : []).filter(Boolean).slice(0, limit).map((d) => {
    const id = esc(d.recipeId || "");
    const risk = String(d.risk || "yellow").toLowerCase();
    const sub = [d.summary, RISK_WORD[risk] ? RISK_WORD[risk] : ""].filter(Boolean).join(" · ");
    return `<div class="home-row" data-detection="${esc(d.id || "")}">` +
      `<span class="home-time">${esc(when(d.ts, now))}</span>` +
      `<div class="home-text"><strong>${esc(d.title || "Something needs a look")}</strong><small>${esc(sub)}</small></div>` +
      `<div class="home-actions">` +
      (id ? `<button class="primary" data-home-fix="${id}" data-risk="${esc(risk)}">Fix it</button><button class="ghost" data-home-walk="${id}">Show me</button>` : "") +
      `<button class="ghost" data-home-dismiss="${esc(d.id || "")}">Not now</button></div></div>`;
  }).join("");
  return rows || `<p class="home-empty">Nothing found so far. ARIA keeps checking and will list anything it finds here, in plain words.</p>`;
}

/** Classify one transparency-log row as a "did" item, or null when it is not one. */
export function didItemOf(entry = {}) {
  const tag = String(entry.tag || "");
  const text = String(entry.text || "");
  if (tag === "RUN" && /^Executing/.test(text)) return { kind: "applied", icon: "🔧", text: text.replace(/^Executing\s+(recipe\s+|macOS Tier-0\s+)?/, "Applied: "), status: "applied" };
  if (tag === "RUN" && /^Dry-run/.test(text)) return { kind: "previewed", icon: "👁", text: text.replace(/^Dry-run\s+(recipe\s+|macOS Tier-0\s+)?/, "Previewed (nothing changed): "), status: "preview" };
  if (tag === "DONE" && /^Verification for .*: passed\.$/.test(text)) return { kind: "verified", icon: "✅", text: text.replace(/^Verification for\s+/, "Verified: ").replace(/: passed\.$/, " — fix confirmed working"), status: "verified" };
  // REVIEW P2-9 (2026-10-14) — a fix whose check afterwards says the problem is still there is NOT "could not verify": the
  // steps ran and the answer is known. Main audits it as `REVIEW Verification for X: failed — not resolved (…)` with
  // outcome "not_resolved" and tells a person (the fix-failed notification, or the IT contact on the advisory track).
  if (tag === "REVIEW" && /^Verification for/.test(text) && (entry.outcome === "not_resolved" || /: failed — not resolved\b/.test(text))) {
    const what = (text.match(/^Verification for\s+(.+?): failed — not resolved\b/) || [])[1] || "";
    return { kind: "not-resolved", icon: "⚠", text: "Ran, but the problem is still there — not resolved; a person has been told.", sub: what, status: "not resolved" };
  }
  if (tag === "REVIEW" && /^Verification for/.test(text)) return { kind: "unverified", icon: "❔", text: text.replace(/^Verification for\s+/, "Could not verify: ").replace(/: inconclusive\.$/, ""), status: "unverified" };
  if (tag === "ERROR" && /exit \d+|failed/i.test(text)) return { kind: "failed", icon: "⚠", text: `Failed: ${text}`, status: "failed" };
  if (tag === "KILL-SWITCH") return { kind: "stopped", icon: "🛑", text, status: "stopped" };
  if (tag === "CANCEL") return { kind: "cancelled", icon: "↩", text: text.replace(/^Action countdown aborted: /, "Cancelled before it ran: "), status: "cancelled" };
  if (tag === "RESOLVED" || tag === "ESCALATE" || tag === "TICKET") return { kind: "ticket", icon: "🎫", text, status: tag.toLowerCase() };
  return null;
}

/** "What I did" — applied / previewed / verified / failed / cancelled rows from the audit log, newest first. */
export function didRowsHtml(log = [], { limit = 6, now = Date.now() } = {}) {
  const items = [];
  for (const e of Array.isArray(log) ? log : []) {
    const d = didItemOf(e || {});
    if (d) items.push({ ...d, ts: e.ts });
    if (items.length >= limit) break;
  }
  const rows = items.map((d) => `<div class="home-row did-${esc(d.kind)}"><span class="home-time">${esc(when(d.ts, now))}</span><span class="home-icon" aria-hidden="true">${esc(d.icon)}</span><div class="home-text"><strong>${esc(d.text)}</strong>${d.sub ? `<small>${esc(d.sub)}</small>` : ""}</div><em class="home-status">${esc(d.status)}</em></div>`).join("");
  return rows || `<p class="home-empty">Nothing applied yet. When ARIA previews or applies a fix, it is listed here with its verified outcome — never before it ran.</p>`;
}

/**
 * 2026-10-14 — the advise-first notices (Autonomous mode: "advise three times, then act"), from getState().advisories:
 * what ARIA found · what it will do · when — with the choices that still apply (Fix now · Not now · Never for this).
 * The copy is main's plain-words copy (advisory-escalation.mjs), escaped here like every other string.
 */
export function advisoryRowsHtml(advisories = []) {
  return (Array.isArray(advisories) ? advisories : []).filter((a) => a && a.id).map((a) => {
    const c = a.copy || {};
    const choices = Array.isArray(c.choices) ? c.choices.filter((x) => x && x.id) : [];
    const buttons = choices.map((x) => `<button class="${x.id === "fix-now" ? "primary" : "ghost"}" data-advisory-ack="${esc(a.id)}" data-choice="${esc(x.id)}">${esc(x.label || x.id)}</button>`).join("");
    const sub = [c.line, c.willDo, c.when].filter(Boolean).join(" · ");
    return `<div class="home-row need-advisory" data-advisory="${esc(a.id)}" data-kind="${esc(a.kind || "")}"><span class="home-time">${esc(`${a.advisory || 1} of ${a.of || 3}`)}</span>` +
      `<div class="home-text"><strong>${esc(c.found || a.title || "ARIA found a problem")}</strong><small>${esc(sub)}</small></div>` +
      (buttons ? `<div class="home-actions">${buttons}</div>` : "") + `</div>`;
  }).join("");
}

/** "What I need from you" — approvals waiting for a yes, fixes queued to a window, and the pending cards (trial/update). */
export function needRowsHtml({ approvals = {}, deferred = [], pending = [], advisories = [] } = {}, { now = Date.now() } = {}) {
  const out = [];
  const notices = advisoryRowsHtml(advisories);
  if (notices) out.push(notices);
  for (const a of (approvals && Array.isArray(approvals.pending)) ? approvals.pending : []) {
    const left = Number.isFinite(Date.parse(a.expiresAt || "")) ? Math.max(0, Math.round((Date.parse(a.expiresAt) - now) / 60000)) : null;
    out.push(`<div class="home-row need-approval" data-approval="${esc(a.id || "")}"><span class="home-time">${esc(when(a.createdAt, now))}</span><div class="home-text"><strong>Say yes to: ${esc(a.title || a.recipeId || "a fix")}</strong><small>${esc(a.color || "yellow")} tier · asked by ${esc(a.requestedBy || "ARIA")}${left == null ? "" : " · waits " + left + " min"}</small></div><div class="home-actions"><button class="primary" data-approve="${esc(a.id || "")}">Approve</button><button class="ghost" data-deny="${esc(a.id || "")}">Deny</button></div></div>`);
  }
  for (const d of Array.isArray(deferred) ? deferred : []) {
    out.push(`<div class="home-row need-window"><span class="home-time">${esc(when(d.queuedAt, now))}</span><div class="home-text"><strong>Queued: ${esc(d.title || d.recipeId || "a fix")}</strong><small>${d.nextWindowStart ? "runs in your maintenance window " + esc(new Date(d.nextWindowStart).toLocaleString()) : "waiting for a maintenance window"}</small></div><div class="home-actions"><button class="ghost" data-deeplink="autonomy">Change window</button></div></div>`);
  }
  for (const p of Array.isArray(pending) ? pending : []) {
    out.push(`<div class="home-row need-card" data-deeplink="${esc(p.tab || "about")}"><span class="home-time"></span><div class="home-text"><strong>${esc(p.text || "")}</strong></div><div class="home-actions"><button class="ghost" data-deeplink="${esc(p.tab || "about")}">${esc(p.cta || "Open")}</button></div></div>`);
  }
  return out.join("") || `<p class="home-empty">Nothing needs you right now.</p>`;
}

/** The three blocks, as one HTML string for #homeLists. */
export function homeListsHtml({ detections = [], log = [], approvals = {}, deferred = [], pending = [], advisories = [] } = {}, opts = {}) {
  return `<section class="home-block" id="homeFound"><p class="eyebrow">What I found</p>${foundRowsHtml(detections, opts)}</section>` +
    `<section class="home-block" id="homeDid"><p class="eyebrow">What I did</p>${didRowsHtml(log, opts)}</section>` +
    `<section class="home-block" id="homeNeed"><p class="eyebrow">What I need from you</p>${needRowsHtml({ approvals, deferred, pending, advisories }, opts)}</section>`;
}

// The detectors this version runs on Windows (one word each, the order a person would read them).
export const WATCHER_NAMES = Object.freeze(["disk", "services", "network", "crashes", "performance", "event log"]);

/**
 * "Watching: disk · services · network · crashes · performance · event log — last check 12 s ago".
 * `watchers` is getState().watchers when main sends it ({ running, count, lastTickAgeMs }); otherwise the line
 * falls back to the process-health snapshot age, and says "—" when nothing has been measured yet (never a fake
 * timestamp). A stopped / paused / detect-less platform says exactly that.
 */
export function watcherLine({ runState = null, watchers = null, platformCapabilities = null, processHealthAgeMs = null, now = Date.now() } = {}) {
  const caps = platformCapabilities || {};
  if (caps.detect === false) return `Watching: not available on ${caps.label || "this platform"} — ARIA answers questions and guides you here.`;
  if (runState && runState.running === false) return `Not watching — ARIA is ${runState.label || "stopped"}. ${runState.hint || ""}`.trim();
  if (runState && runState.id === "paused") return `Watching paused — ${runState.hint || "resumes when the pause ends."}`;
  const names = WATCHER_NAMES.join(" · ");
  let age = null; // a null/absent age is "not measured yet" — never coerced to "just now"
  if (watchers && watchers.lastTickAgeMs != null && Number.isFinite(Number(watchers.lastTickAgeMs))) age = Number(watchers.lastTickAgeMs);
  else if (processHealthAgeMs != null && Number.isFinite(Number(processHealthAgeMs))) age = Number(processHealthAgeMs);
  const running = watchers ? watchers.running !== false : true;
  if (!running) return `Watchers are not running — press Start ARIA.`;
  const last = age == null ? "last check: not measured yet" : `last check ${agoLabel(age)}`;
  return `Watching: ${names} — ${last}`;
}

/** Count what this version can really apply (recipes with live steps) vs guide-only, and how many need admin. */
export function fixCapability(recipes = [], platformCapabilities = null) {
  const list = (Array.isArray(recipes) ? recipes : []).filter(Boolean);
  const applicable = list.filter((r) => Array.isArray(r.actions) && r.actions.length > 0);
  const needsAdmin = applicable.filter((r) => r.needsAdmin === true || (r.actions || []).some((a) => a && a.needsAdmin === true));
  return { total: list.length, applicable: applicable.length, needsAdmin: needsAdmin.length, guided: Math.max(0, list.length - applicable.length), platform: (platformCapabilities && platformCapabilities.label) || "this device" };
}

/** "On this version ARIA can apply N vetted fixes on Windows (M need administrator approval); the rest are guided." */
export function canFixLine({ recipes = [], platformCapabilities = null, liveFixes = null } = {}) {
  const caps = platformCapabilities || {};
  const c = fixCapability(recipes, caps);
  if (caps.fix === false) return `On ${c.platform} ARIA detects and guides — it does not apply fixes here. ${c.total} guides are in this version.`;
  const live = liveFixes && typeof liveFixes === "object" ? liveFixes.enabled === true : null;
  const liveLine = live === true ? "Live fixes: on." : live === false ? "Live fixes: off — every fix previews only until you turn them on in Settings → Autonomy." : "";
  const admin = c.needsAdmin > 0 ? ` (${c.needsAdmin} need administrator approval — Windows asks you first)` : "";
  return `On this version ARIA can apply ${c.applicable} vetted fixes on ${c.platform}${admin}; the other ${c.guided} are guided step by step. ${liveLine}`.trim();
}
