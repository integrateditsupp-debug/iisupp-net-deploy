// RUN-CU / CU4 (2026-10-08) — local bridge (127.0.0.1:37841) origin + route policy. PURE so the decision
// is unit-tested (tests/bridge-auth.test.mjs); main.mjs only asks it.
//
// The audit's P0 #5: the bridge accepted an EMPTY Origin on every route (any curl / local process as the
// user could POST /run-recipe with {dryRun:false, confirmed:true}) and /state leaked the full transparency
// log + license. The rules now:
//   · GET /health, /state, /dist-info — allowed with no Origin (the admin console + health probes); /state is
//     SCRUBBED (scrubPublicState) — no audit log, no license key, no contacts, no prefs.
//   · every POST (state-changing or spend) REQUIRES an Origin from a browser extension or the bridge's own
//     loopback origins; an empty / foreign Origin is refused. /detect and /chat stay open to the extension.
//   · /run-recipe is routed through runSupervisedFix (policy + countdown + approval) by main; the caller's
//     dryRun/confirmed flags are stripped (isStateChangingRoute tells main which routes get this treatment).
export const BRIDGE_READ_ROUTES = Object.freeze(["/health", "/state", "/dist-info"]);
export const BRIDGE_STATE_CHANGING_ROUTES = Object.freeze(["/run-recipe", "/incident", "/scan", "/knowledge/update", "/self-diagnose", "/self-repair"]);
export const BRIDGE_EXTENSION_ROUTES = Object.freeze(["/detect", "/chat", "/signature"]);

export function isStateChangingRoute(pathname) {
  return BRIDGE_STATE_CHANGING_ROUTES.includes(String(pathname || ""));
}

function originKind(origin, port) {
  const o = String(origin || "");
  if (!o) return "empty";
  if (o === "null") return "opaque";
  if (o.startsWith("chrome-extension://") || o.startsWith("edge-extension://") || o.startsWith("moz-extension://") || o.startsWith("safari-web-extension://")) return "extension";
  if (o === `http://127.0.0.1:${port}` || o === `http://localhost:${port}`) return "loopback";
  return "foreign";
}

/**
 * Decide whether a bridge request may proceed.
 * @param {{origin?:string, method?:string, pathname?:string, port?:number}} req
 * @returns {{ok:boolean, reason:string, kind:string}}
 */
export function isAllowedBridgeOrigin(req = {}) {
  const method = String(req.method || "GET").toUpperCase();
  const pathname = String(req.pathname || "/");
  const kind = originKind(req.origin, Number(req.port) || 37841);
  if (kind === "foreign") return { ok: false, reason: "origin_blocked", kind };
  if (method === "OPTIONS") return { ok: true, reason: "preflight", kind };
  if (method === "GET") {
    if (BRIDGE_READ_ROUTES.includes(pathname)) return { ok: true, reason: "read-route", kind };
    // any other GET: extension / loopback only
    return kind === "extension" || kind === "loopback" ? { ok: true, reason: "get", kind } : { ok: false, reason: "origin_required", kind };
  }
  // POST (and anything else) — an identified origin is mandatory on every route that does something.
  if (kind === "empty" || kind === "opaque") return { ok: false, reason: "origin_required", kind };
  return { ok: true, reason: "post", kind };
}

/** Strip renderer/caller-controlled execution flags off a /run-recipe body (the supervised path owns them). */
export function sanitizeRunRecipeBody(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  const out = { recipeId: String(b.recipeId || "").slice(0, 80), source: "bridge" };
  if (b.processName) out.processName = String(b.processName).slice(0, 80);
  if (Number.isInteger(b.pid)) out.pid = b.pid;
  return out; // dryRun / confirmed / mode / approved / approvalId deliberately dropped
}

// 2026-10-14 — the advise-first escalations ("advise three times, then act"), CONTENT-BLIND: catalog recipe ids, status
// words, counters and ISO times only — no titles, no notice copy, no log text, no contact. Every field FAILS CLOSED to
// null when it is not the expected shape. This is what an operator's on-device fault-lab run polls (scripts/fault-lab-run.mjs).
const ADVISORY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const ADVISORY_WORD_RE = /^[a-z][a-z0-9-]{0,39}$/;
export function advisoryPublicSlice(state = {}) {
  const s = state && typeof state === "object" ? state : {};
  const id = (v) => (typeof v === "string" && ADVISORY_ID_RE.test(v) ? v : null);
  const word = (v) => (typeof v === "string" && ADVISORY_WORD_RE.test(v) ? v : null);
  const iso = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };
  const int = (v) => (Number.isInteger(v) && v >= 0 && v <= 999 ? v : null);
  const obj = (v) => (v && typeof v === "object" ? v : {});
  const active = (Array.isArray(s.advisories) ? s.advisories : []).slice(0, 20).map(obj).map((a) => ({
    id: id(a.id), recipeId: id(a.recipeId), track: word(a.track), kind: word(a.kind), status: word(a.status),
    advisory: int(a.advisory), of: int(a.of), nextAt: iso(a.nextAt), frozen: Boolean(a.frozen)
  }));
  const outcomes = (Array.isArray(s.advisoryOutcomes) ? s.advisoryOutcomes : []).slice(0, 20).map(obj).map((o) => ({
    id: id(o.id), recipeId: id(o.recipeId), track: word(o.track), status: word(o.status), outcome: word(o.outcome),
    advisories: int(o.advisories), of: int(o.of), choice: word(o.choice), closedAt: iso(o.closedAt)
  }));
  const auditTags = { advisory: 0, autoFix: 0, escalate: 0 };
  for (const e of Array.isArray(s.transparencyLog) ? s.transparencyLog : []) {
    const tag = e && typeof e === "object" ? e.tag : "";
    if (tag === "ADVISORY") auditTags.advisory++;
    else if (tag === "AUTO-FIX") auditTags.autoFix++;
    else if (tag === "ESCALATE") auditTags.escalate++;
  }
  return { active, outcomes, auditTags };
}

/**
 * The public, content-blind slice of getState() served at GET /state. Keeps operational facts + counts;
 * drops the transparency log, license key/email, contacts/prefs, approvals detail, restore points, detections.
 */
export function scrubPublicState(state = {}) {
  const s = state && typeof state === "object" ? state : {};
  const count = (v) => (Array.isArray(v) ? v.length : 0);
  return {
    version: s.version || null,
    mode: s.mode || null,
    dryRun: Boolean(s.dryRun),
    systemFixesEnabled: Boolean(s.systemFixesEnabled),
    paused: Boolean(s.paused),
    killed: Boolean(s.killed),
    platform: s.platform || null,
    agentState: s.agentState || null,
    bridgeStatus: s.bridgeStatus ? { listening: Boolean(s.bridgeStatus.listening), conflict: Boolean(s.bridgeStatus.conflict), port: s.bridgeStatus.port || null, killed: Boolean(s.bridgeStatus.killed) } : null,
    healthScore: s.healthScore && typeof s.healthScore === "object" ? { score: s.healthScore.score ?? null, ts: s.healthScore.ts || null } : null,
    autonomy: s.autonomy ? { level: s.autonomy.level || null, mode: s.autonomy.mode || null } : null,
    platformCapabilities: s.platformCapabilities || null,
    licensed: Boolean(s.license && s.license.licensed),
    plan: (s.license && s.license.plan) || null,
    counts: {
      detections: count(s.detections),
      incidents: count(s.incidents),
      auditEvents: count(s.transparencyLog),
      recipes: count(s.recipes),
      approvalsPending: s.approvals && Number.isFinite(s.approvals.pendingCount) ? s.approvals.pendingCount : 0
    },
    externalAiCalls: Boolean(s.externalAiCalls),
    auditIntegrity: s.auditIntegrity ? { ok: s.auditIntegrity.ok !== false } : null,
    advisory: advisoryPublicSlice(s),
    contentBlind: true
  };
}
