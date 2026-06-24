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
