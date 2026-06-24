// RUN 15 §4 — ARIA-brain client: request shape, header propagation, offline fallback, escalation,
// and privacy (only the chat/research iisupp.net paths are reachable).
import assert from "node:assert/strict";
import { askAria, buildChatRequest, nextEscalationTier, ESCALATION_TIERS, CHAT_ENDPOINT, RESEARCH_ENDPOINT, escalationCta } from "../src/shared/aria-brain-client.mjs";
import { isBrainPathAllowed, BRAIN_OUTBOUND_PATHS } from "../src/shared/network-capture.mjs";

// RUN 30 — request matches aria-chat.js's real contract: a `messages` array (NOT a `prompt` string), plus
// sessionId + platform/tier/version/source so the brain answers for the user's actual OS.
const req = buildChatRequest("macbook wont wake from sleep", { deviceId: "dev-1", licenseKey: "LIC", sessionId: "s1", platform: "darwin", tier: "pro", version: "0.1.3" });
assert.equal(req.url, CHAT_ENDPOINT);
assert.equal(req.method, "POST");
assert.equal(req.headers["X-Sentinel-Device"], "dev-1");
assert.equal(req.headers["X-Sentinel-License"], "LIC");
const body = JSON.parse(req.body);
assert.equal(body.source, "sentinel-desktop");
assert.ok(Array.isArray(body.messages) && body.messages.length === 1, "messages is an array (aria-chat contract)");
assert.equal(body.messages[0].role, "user");
assert.equal(body.messages[0].content, "macbook wont wake from sleep");
assert.equal(body.sessionId, "s1");
assert.equal(body.platform, "darwin", "real OS carried (not Windows-only)");
assert.equal(body.tier, "pro");
assert.ok(!("prompt" in body), "no legacy `prompt` field");

// askAria with a mock fetch → maps aria-chat's `text` field to reply (ok:true required).
let calledUrl = null;
const fetchOk = async (url) => { calledUrl = url; return { ok: true, json: async () => ({ text: "On macOS, reset the SMC: shut down, hold Control+Option+Shift…", sessionId: "s9", resolved: false, escalate: false }) }; };
const r = await askAria("macbook wont wake", { sessionId: "s1", fetchImpl: fetchOk });
assert.match(r.reply, /macOS/, "brain reply (text) surfaced unchanged");
assert.equal(r.session_id, "s9", "sessionId mapped");
assert.equal(r.offline, false);
assert.equal(calledUrl, CHAT_ENDPOINT, "only the chat endpoint is called");

// escalate flag → action "escalate".
const esc = await askAria("help", { fetchImpl: async () => ({ ok: true, json: async () => ({ text: "Let me get a human.", escalate: true }) }) });
assert.equal(esc.action, "escalate");

// A non-OK HTTP response (e.g. 400/500) → offline fallback (caller serves local KB), never the brain.
const off400 = await askAria("x", { fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: "messages required" }) }) });
assert.equal(off400.offline, true, "HTTP error degrades to offline");

// An empty brain reply → offline fallback too (don't surface a blank answer).
const offEmpty = await askAria("x", { fetchImpl: async () => ({ ok: true, json: async () => ({ text: "" }) }) });
assert.equal(offEmpty.offline, true);

// Offline (network throw) → graceful local-KB fallback, never throws, platform-NEUTRAL copy (no "Windows").
const fetchFail = async () => { throw new Error("offline"); };
const off = await askAria("anything", { fetchImpl: fetchFail });
assert.equal(off.offline, true);
assert.equal(off.action, "local-kb-only");
assert.doesNotMatch(off.reply, /\bWindows\b/, "offline copy is not Windows-only");

// Escalation ladder order.
assert.deepEqual(ESCALATION_TIERS, ["kb", "screen-and-event", "research", "ticket"]);
assert.equal(nextEscalationTier("kb"), "screen-and-event");
assert.equal(nextEscalationTier("research"), "ticket");
assert.equal(nextEscalationTier("ticket"), null);
assert.match(escalationCta(), /647-581-3182/);

// Privacy: ONLY the allow-listed brain paths are reachable; nothing else from iisupp.net.
// RUN 31 added aria-kb-query; RUN 33 added the ARIA-tab data surfaces — growing this list is gated by THIS test.
assert.equal(BRAIN_OUTBOUND_PATHS.length, 5);
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-kb-query"), true, "RUN 31 KB-first path allowed");
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-kb-stats"), true, "RUN 33 kb-stats allowed");
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-system-status"), true, "RUN 33 system-status allowed");
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-chat"), true);
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-research"), true);
assert.equal(isBrainPathAllowed("/.netlify/functions/aria-recipes"), false, "other iisupp.net path not a brain path");
assert.equal(isBrainPathAllowed("/sentinel-admin"), false);
assert.ok(CHAT_ENDPOINT.startsWith("https://iisupp.net/") && RESEARCH_ENDPOINT.startsWith("https://iisupp.net/"));

console.log("ARIA-brain-client test passed (request shape · headers · offline fallback · escalation · only 2 brain paths).");
