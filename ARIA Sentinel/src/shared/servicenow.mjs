// servicenow — the ONE intentional outbound integration: incidents to the customer's
// OWN ServiceNow instance, never to iisupp.net.
//
// Privacy contract (enforced by buildIncidentPayload + assertContentSafePayload):
//   - description carries ONLY: symbolic code, attempted recipe ids, dry-run|live,
//     and an OS-version hash. No raw error text, paths, URLs, page content.
//   - caller uses an opaque identifier (Windows SID hash) — never a name or email.
// The auto-generated incident is content-blind. The ONE exception is a comment the user
// TYPES themselves into their own ticket (postComment) — that is their data, going to
// their own ITSM, by explicit action, so it is passed through verbatim.
//
// Credentials come from env (SN_INSTANCE_URL / SN_USER / SN_PASS). When unset, every
// call returns a dry-run object and nothing leaves the device. A local JSON queue
// (no new deps — built-in fs) holds incidents raised while ServiceNow is unreachable;
// drainQueue() flushes them on next connect.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { assertContentSafePayload } from "./safety.mjs";

const TABLE = "/api/now/table/incident";

export function getServiceNowConfig(env = process.env) {
  const instanceUrl = normalizeInstanceUrl(env.SN_INSTANCE_URL);
  const user = String(env.SN_USER || "").trim();
  const pass = String(env.SN_PASS || "");
  return { configured: Boolean(instanceUrl && user && pass), instanceUrl, user, pass };
}

function normalizeInstanceUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!url) return "";
  // Only ever talk to a *.service-now.com host.
  if (!/^https:\/\/[\w.-]+\.service-now\.com$/i.test(url)) return "";
  return url;
}

function authHeader(cfg) {
  return "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
}

/** Opaque caller id — sha256 truncation. Never a username/email on the wire. */
export function hashIdentifier(value) {
  return "sid-" + createHash("sha256").update(String(value || "anonymous")).digest("hex").slice(0, 16);
}

export function osVersionHash(value = `${os.platform()} ${os.release()}`) {
  return "os-" + createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

/**
 * Build the content-blind incident body. Throws if (defensively) any PII slips in.
 */
export function buildIncidentPayload(input = {}) {
  const code = symbolic(input.symbolicCode || input.shortDesc || "UNKNOWN.SIGNAL");
  const recipeIds = (Array.isArray(input.recipeIds) ? input.recipeIds : [input.recipeId])
    .filter(Boolean)
    .map((id) => String(id).replace(/[^a-z0-9-]/gi, "").slice(0, 48));
  const mode = input.dryRun === false ? "live" : "dry-run";
  const payload = {
    short_description: `ARIA Sentinel · ${code}`,
    description: [
      `Symbolic code: ${code}`,
      recipeIds.length ? `Attempted recipes: ${recipeIds.join(", ")}` : "Attempted recipes: none",
      `Execution mode: ${mode}`,
      `OS: ${input.osVersionHash || osVersionHash()}`,
      "Raised by ARIA Sentinel. No PII leaves the device; minidump + recipe attempts attach separately."
    ].join("\n"),
    category: symbolic(input.category || "software").toLowerCase(),
    caller_id: sanitizeCaller(input.caller),
    u_iis_internal_id: String(input.iisInternalId || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64),
    comments: "Routed automatically by ARIA Sentinel from the local signal class."
  };
  if (input.assignmentGroup) payload.assignment_group = String(input.assignmentGroup).slice(0, 80);
  if (input.priority) payload.urgency = String(input.priority).replace(/[^0-9]/g, "").slice(0, 1) || "3";
  // Hard gate — the payload must contain no email/url/path/long-number leak.
  if (!assertContentSafePayload(payload)) {
    throw new Error("servicenow_payload_failed_content_safety");
  }
  return payload;
}

function symbolic(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9._-]+/g, ".").replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "").slice(0, 64) || "UNKNOWN.SIGNAL";
}

function sanitizeCaller(value) {
  const text = String(value || "").trim();
  if (!text) return hashIdentifier(os.hostname?.() || "anonymous");
  // If it already looks opaque (sid-…), keep it; otherwise hash it so no name/email leaks.
  if (/^sid-[a-f0-9]{8,}$/i.test(text)) return text;
  return hashIdentifier(text);
}

// ---- queue (local, content-blind) ----------------------------------------

export function queuePath() {
  return path.join(os.homedir(), ".aria-sentinel", "sn-queue.json");
}

function readQueue(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) || [];
  } catch {
    return [];
  }
}

function writeQueue(file, items) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(items.slice(0, 200), null, 2));
    return true;
  } catch {
    return false;
  }
}

export function enqueueIncident(payload, options = {}) {
  const file = options.queuePath || queuePath();
  const items = readQueue(file);
  items.push({ payload, queuedAt: new Date().toISOString() });
  writeQueue(file, items);
  return { ok: false, queued: true, depth: items.length };
}

export function queueDepth(options = {}) {
  return readQueue(options.queuePath || queuePath()).length;
}

// ---- API ------------------------------------------------------------------

function isRetryable(status) {
  return status === 0 || status === 408 || status === 429 || status === 503 || (status >= 500 && status < 600);
}

export async function ping(instanceUrl, user, pass, options = {}) {
  const cfg = getServiceNowConfig({ SN_INSTANCE_URL: instanceUrl, SN_USER: user, SN_PASS: pass });
  if (!cfg.configured) return { ok: false, configured: false };
  const fetchImpl = options.fetch || globalThis.fetch;
  const start = options.now ? options.now() : nowMs();
  try {
    const res = await fetchImpl(`${cfg.instanceUrl}${TABLE}?sysparm_limit=1`, {
      method: "GET",
      headers: { Authorization: authHeader(cfg), Accept: "application/json" }
    });
    const latency = (options.now ? options.now() : nowMs()) - start;
    return { ok: res.ok, status: res.status, latency_ms: latency, configured: true };
  } catch {
    return { ok: false, status: 0, configured: true, latency_ms: 0 };
  }
}

/**
 * Read-only connectivity test for the Integrations tab. Without creds → { ok:false, "Not configured" }.
 * With creds → a single GET (sysparm_limit=1) via ping(); never POSTs, never creates an incident, never
 * throws. `options.fetch` is injectable for tests.
 */
export async function testConnection(env = process.env, options = {}) {
  const cfg = getServiceNowConfig(env);
  if (!cfg.configured) return { ok: false, message: "Not configured" };
  try {
    const res = await ping(cfg.instanceUrl, cfg.user, cfg.pass, options);
    if (res.ok) return { ok: true, message: `Connected — HTTP ${res.status} in ${res.latency_ms}ms` };
    return { ok: false, message: res.status ? `ServiceNow returned HTTP ${res.status}` : "Could not reach ServiceNow" };
  } catch {
    return { ok: false, message: "ServiceNow check failed" };
  }
}

export async function createIncident(input = {}, options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  const payload = buildIncidentPayload(input);
  if (!cfg.configured) {
    // No credentials → never touch the network. Return a dry-run preview.
    return { ok: false, dryRun: true, queued: false, payload };
  }
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(`${cfg.instanceUrl}${TABLE}`, {
      method: "POST",
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const result = body?.result || {};
      return { ok: true, number: result.number || "", sysId: result.sys_id || "", payload };
    }
    if (isRetryable(res.status)) return enqueueIncident(payload, options);
    return { ok: false, status: res.status, queued: false, payload };
  } catch {
    // Network failure → queue for retry.
    return enqueueIncident(payload, options);
  }
}

export async function drainQueue(options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  const file = options.queuePath || queuePath();
  if (!cfg.configured) return { ok: false, drained: 0, remaining: queueDepth({ queuePath: file }) };
  const fetchImpl = options.fetch || globalThis.fetch;
  const items = readQueue(file);
  const remaining = [];
  let drained = 0;
  for (const item of items) {
    try {
      const res = await fetchImpl(`${cfg.instanceUrl}${TABLE}`, {
        method: "POST",
        headers: { Authorization: authHeader(cfg), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(item.payload)
      });
      if (res.ok) drained++;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(file, remaining);
  return { ok: true, drained, remaining: remaining.length };
}

export async function listMyIncidents(params = {}, options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  if (!cfg.configured) return [];
  const fetchImpl = options.fetch || globalThis.fetch;
  const caller = sanitizeCaller(params.caller);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  const query = `caller_id=${encodeURIComponent(caller)}^ORDERBYDESCsys_updated_on`;
  try {
    const res = await fetchImpl(
      `${cfg.instanceUrl}${TABLE}?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=${limit}`,
      { method: "GET", headers: { Authorization: authHeader(cfg), Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const body = await res.json().catch(() => ({}));
    const rows = Array.isArray(body?.result) ? body.result : [];
    return rows
      .map(mapIncidentRow)
      .sort((a, b) => String(b.sysUpdatedOn).localeCompare(String(a.sysUpdatedOn)));
  } catch {
    return [];
  }
}

export function mapIncidentRow(row = {}) {
  return {
    number: row.number || "",
    sysId: row.sys_id || "",
    state: stateLabel(row.state),
    priority: row.priority || row.urgency || "",
    assignmentGroup: typeof row.assignment_group === "object" ? row.assignment_group?.display_value || "" : row.assignment_group || "",
    sysUpdatedOn: row.sys_updated_on || "",
    shortDescription: row.short_description || "",
    workNotes: parseJournal(row.work_notes)
  };
}

function stateLabel(state) {
  const map = { 1: "New", 2: "In Progress", 3: "On Hold", 6: "Resolved", 7: "Closed" };
  return map[String(state)] || (state ? String(state) : "New");
}

function parseJournal(value) {
  if (!value) return [];
  return String(value)
    .split(/\n\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function postComment(input = {}, options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  const sysId = String(input.incidentSysId || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  const comment = String(input.comment || "").slice(0, 1000); // user's own words, their ticket
  if (!sysId || !comment) return { ok: false, error: "missing_fields" };
  if (!cfg.configured) return { ok: false, dryRun: true };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(`${cfg.instanceUrl}${TABLE}/${sysId}`, {
      method: "PATCH",
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ comments: comment })
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function nowMs() {
  return Date.now();
}

// ===========================================================================
// MODULE 1 — gated ServiceNow WRITE ticket lifecycle (Interaction → Incident → resolve/close).
// Every write is: (1) GATED — refuses unless options.approved===true; (2) HONEST — flags a missing
// instance / write-enabled user and a 401/403 permission failure instead of faking; (3) READ-BACK
// VERIFIED — after the write it GETs the record and returns the REAL sys_id/number/state (never an
// invented ticket number — RULE 14); (4) AUDITED — emits a content-blind event per step via
// options.logger. Bodies stay content-blind (assertContentSafePayload + symbolic close notes). 🔒 R11.
// ===========================================================================

export const SN_INTERACTION_TABLE = "interaction";
export const SN_INCIDENT_TABLE = "incident";
const INCIDENT_STATE = { resolved: "6", closed: "7" };

function tableUrl(cfg, table, sysId) {
  const t = String(table).replace(/[^a-z_]/gi, "");
  const id = sysId ? "/" + encodeURIComponent(String(sysId).replace(/[^a-z0-9]/gi, "").slice(0, 40)) : "";
  return `${cfg.instanceUrl}/api/now/table/${t}${id}`;
}

function emitter(logger) {
  const events = [];
  const emit = (type, message, data = {}) => {
    const e = { type, message: String(message).slice(0, 200), ts: new Date().toISOString(), ...data };
    events.push(e);
    if (typeof logger === "function") { try { logger(e); } catch { /* logging must never throw */ } };
  };
  return { events, emit };
}

/** READ-BACK GET — confirm a written record actually exists and return its real fields. Never throws. */
export async function getRecord(table, sysId, options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  const id = String(sysId || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  if (!cfg.configured || !id) return { ok: false };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(`${tableUrl(cfg, table, id)}?sysparm_fields=sys_id,number,state,close_code,close_notes`, {
      method: "GET",
      headers: { Authorization: authHeader(cfg), Accept: "application/json" }
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json().catch(() => ({}));
    return { ok: true, record: body?.result || {} };
  } catch {
    return { ok: false };
  }
}

/**
 * The one gated-write primitive every lifecycle step routes through. POST (create) or PATCH (update)
 * a Table API record, then read-back GET to verify. Returns honest, structured outcomes:
 *   { ok:false, needsApproval } · { ok:false, notConfigured } · { ok:false, forbidden, status }
 *   { ok:false, unverified } · { ok:false, status } · { ok:true, sysId, number, state, record }
 */
async function writeRecord({ table, method, sysId, body, approved, label }, options = {}) {
  const cfg = options.config || getServiceNowConfig(options.env || process.env);
  const { events, emit } = emitter(options.logger);
  if (approved !== true) {
    emit("SN.WRITE.BLOCKED", `${label}: blocked — awaiting approval`, { table });
    return { ok: false, needsApproval: true, message: "Awaiting approval (gated write)", events };
  }
  if (!cfg.configured) {
    emit("SN.WRITE.UNCONFIGURED", `${label}: no ServiceNow instance / write-enabled user`, { table });
    return { ok: false, notConfigured: true, message: "ServiceNow instance + write-enabled user (itil/web_service) not configured", events };
  }
  // Defense-in-depth: the write body must be content-blind (no PII/path/url/long-number).
  if (!assertContentSafePayload(body)) {
    emit("SN.WRITE.LEAK", `${label}: body failed content-safety — not sent`, { table });
    return { ok: false, contentUnsafe: true, message: "Write body failed content-safety; not sent", events };
  }
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(tableUrl(cfg, table, sysId), {
      method,
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status === 401 || res.status === 403) {
      emit("SN.WRITE.FORBIDDEN", `${label}: write user lacks permission (HTTP ${res.status})`, { table, status: res.status });
      return { ok: false, forbidden: true, status: res.status, message: `Write user lacks permission (HTTP ${res.status}) — grant itil/web_service write role`, events };
    }
    if (!res.ok) {
      emit("SN.WRITE.FAIL", `${label}: HTTP ${res.status}`, { table, status: res.status });
      return { ok: false, status: res.status, message: `ServiceNow write failed (HTTP ${res.status})`, events };
    }
    const json = await res.json().catch(() => ({}));
    const rec = json?.result || {};
    const resultSysId = String(rec.sys_id || sysId || "").trim();
    // READ-BACK VERIFY — confirm the write landed; never trust the POST echo alone, never invent a number.
    const verified = await getRecord(table, resultSysId, options);
    if (!verified.ok || !verified.record?.sys_id) {
      emit("SN.WRITE.UNVERIFIED", `${label}: write returned but read-back unconfirmed`, { table });
      return { ok: false, unverified: true, sysId: resultSysId, number: rec.number || "", message: "Write returned but read-back could not confirm", events };
    }
    const number = rec.number || verified.record.number || "";
    emit("SN.WRITE.OK", `${label}: ${number || resultSysId} verified`, { table, number });
    return { ok: true, sysId: resultSysId, number, state: verified.record.state || rec.state || "", record: verified.record, events };
  } catch {
    emit("SN.WRITE.ERROR", `${label}: could not reach ServiceNow`, { table });
    return { ok: false, message: "Could not reach ServiceNow", events };
  }
}

/** Build the content-blind Interaction body (the customer-facing "case opened" record). */
export function buildInteractionPayload(input = {}) {
  const code = symbolic(input.symbolicCode || input.shortDesc || "SUPPORT.CASE");
  const body = {
    short_description: `ARIA Sentinel case · ${code}`,
    type: "phone",
    state: "new",
    channel: "virtual_agent",
    work_notes: "Opened automatically by ARIA Sentinel from a local support case. Content-blind."
  };
  if (input.assignmentGroup) body.assignment_group = String(input.assignmentGroup).slice(0, 80);
  return body;
}

/** STEP 1 — open the Interaction (gated, read-back-verified). */
export async function createInteraction(input = {}, options = {}) {
  return writeRecord(
    { table: SN_INTERACTION_TABLE, method: "POST", body: buildInteractionPayload(input), approved: input.approved === true || options.approved === true, label: "create interaction" },
    options
  );
}

/** STEP 2 — open the Incident, correlated to the Interaction (gated, read-back-verified). */
export async function createIncidentFromInteraction(input = {}, options = {}) {
  const body = buildIncidentPayload(input);
  // Link to the parent interaction via the correlation fields (no assumption of custom fields).
  if (input.interactionSysId) body.correlation_id = String(input.interactionSysId).replace(/[^a-z0-9]/gi, "").slice(0, 40);
  if (input.interactionNumber) body.correlation_display = symbolic(input.interactionNumber);
  return writeRecord(
    { table: SN_INCIDENT_TABLE, method: "POST", body, approved: input.approved === true || options.approved === true, label: "create incident" },
    options
  );
}

/** STEP 3 — update the Incident with a content-blind work note (gated, read-back-verified). */
export async function updateIncident(sysId, fields = {}, options = {}) {
  const body = {};
  if (fields.workNote) body.work_notes = symbolicNote(fields.workNote);
  if (fields.state) body.state = String(fields.state).replace(/[^0-9]/g, "").slice(0, 1) || "2";
  if (fields.assignmentGroup) body.assignment_group = String(fields.assignmentGroup).slice(0, 80);
  return writeRecord(
    { table: SN_INCIDENT_TABLE, method: "PATCH", sysId, body, approved: fields.approved === true || options.approved === true, label: "update incident" },
    options
  );
}

/** STEP 4 — resolve/close the Incident with content-blind close notes (gated, read-back confirms state). */
export async function resolveIncident(sysId, input = {}, options = {}) {
  const close = input.close === "closed" ? "closed" : "resolved";
  const body = {
    state: INCIDENT_STATE[close],
    close_code: symbolic(input.closeCode || "Solved.Permanently").replace(/\./g, " "),
    close_notes: symbolicNote(input.closeNotes || `Resolved by ARIA Sentinel · ${symbolic(input.recipeId || "remediation")} · verified`)
  };
  const result = await writeRecord(
    { table: SN_INCIDENT_TABLE, method: "PATCH", sysId, body, approved: input.approved === true || options.approved === true, label: `${close} incident` },
    options
  );
  // Honest confirmation: only report 'resolved' if the read-back state is actually Resolved/Closed.
  if (result.ok) {
    const landed = String(result.record?.state || result.state || "");
    result.resolvedConfirmed = landed === INCIDENT_STATE.resolved || landed === INCIDENT_STATE.closed;
  }
  return result;
}

/** STEP 5 — close the Interaction once the linked Incident is resolved (gated, read-back-verified). */
export async function closeInteraction(sysId, input = {}, options = {}) {
  return writeRecord(
    { table: SN_INTERACTION_TABLE, method: "PATCH", sysId, body: { state: "closed_complete" }, approved: input.approved === true || options.approved === true, label: "close interaction" },
    options
  );
}

// A content-blind work/close note: symbolic tokens only, never raw user text/paths.
function symbolicNote(value) {
  const text = String(value || "").replace(/[A-Za-z]:\\[^\s"']+/g, "[path]").replace(/https?:\/\/\S+/g, "[url]").slice(0, 600);
  // assertContentSafePayload is the hard gate in writeRecord; this is the soft pre-scrub.
  return text || "ARIA Sentinel automated update.";
}
