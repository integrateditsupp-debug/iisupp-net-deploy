// omni-channel — Slack / Teams front-end for ARIA. A user asks in the channel; ARIA answers from the
// LOCAL KB; when it can't confidently resolve, it ESCALATES to a human with a clear handoff. Same safety
// posture as the desktop: this is READ-ONLY by construction — it answers + escalates and NEVER executes a
// fix or any write. Chat is input, not new authority; destructive/write actions stay behind the existing
// approval gates (supervised-fix). 🔒 HARD RULE 14: status is honest — without a token a provider reads
// "not_configured"; we NEVER report a fake "connected". Zero new deps (node crypto only). Each handled
// query is recorded as the SAME content-blind proof event as desktop chat, so omni usage counts toward the
// real deflection number. Pure + injectable (kbIndex / answer / record / now / fetch) for tests.
import crypto from "node:crypto";
import { matchKb } from "./aria-local-kb.mjs";

export const OMNI_PROVIDERS = ["slack", "teams"];
// Confidence floor for an honest auto-resolve — the same bar the proof-metrics self-test harness uses, so
// "resolved" means a genuinely confident KB match, not a loose graze.
export const OMNI_CONF = 0.30;

const DEFAULT_CONTACT = { email: "ahmad.wasee@iisupp.net", phone: "647-581-3182" };

// ── status (honest: config-presence only; never claims "connected" without a verified call) ───────────
export function getProviderStatus(provider, env = process.env) {
  const e = env || {};
  if (provider === "slack") {
    const configured = Boolean(String(e.SLACK_BOT_TOKEN || "").trim() && String(e.SLACK_SIGNING_SECRET || "").trim());
    return { provider, configured, status: configured ? "configured" : "not_configured",
      detail: configured ? "Bot token + signing secret present" : "Set SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET" };
  }
  if (provider === "teams") {
    const configured = Boolean(String(e.TEAMS_APP_ID || "").trim() && String(e.TEAMS_APP_PASSWORD || "").trim());
    return { provider, configured, status: configured ? "configured" : "not_configured",
      detail: configured ? "App id + password present" : "Set TEAMS_APP_ID + TEAMS_APP_PASSWORD" };
  }
  return { provider, configured: false, status: "not_configured", detail: "Unknown provider" };
}
export function getOmniStatus(env = process.env) {
  return { slack: getProviderStatus("slack", env), teams: getProviderStatus("teams", env) };
}

// ── Slack transport helpers (Events API; hand-rolled HMAC, no SDK) ─────────────────────────────────────
/** Verify Slack's v0 request signature with a 5-minute replay window. Returns boolean; never throws. */
export function verifySlackSignature({ signingSecret, timestamp, body, signature } = {}, { now = Date.now() } = {}) {
  if (!signingSecret || !timestamp || !signature) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60 * 5) return false; // stale → reject (replay guard)
  const base = `v0:${timestamp}:${String(body || "")}`;
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  try {
    const a = Buffer.from(expected), b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function stripMention(text) {
  return String(text || "").replace(/<@[^>]+>\s*/g, "").trim(); // drop the "@ARIA" prefix from a mention
}

/** Normalize a Slack Events payload → { kind: challenge|message|ignore, ... }. */
export function parseSlackEvent(payload = {}) {
  if (payload.type === "url_verification") return { kind: "challenge", challenge: String(payload.challenge || "") };
  const ev = (payload && payload.event) || {};
  if (payload.type === "event_callback" && (ev.type === "app_mention" || ev.type === "message")) {
    if (ev.bot_id || ev.subtype) return { kind: "ignore" }; // ignore bot echoes / edits / joins
    return { kind: "message", provider: "slack", text: stripMention(ev.text), user: String(ev.user || ""), channel: String(ev.channel || "") };
  }
  return { kind: "ignore" };
}

export function formatSlackResponse(result = {}) {
  const blocks = [{ type: "section", text: { type: "mrkdwn", text: String(result.text || "") } }];
  if (result.escalated) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: ":rotating_light: Escalated to a human on the IT team." }] });
  return { response_type: "in_channel", text: String(result.text || ""), blocks };
}

// ── Teams transport helpers (Bot Framework Activity; thin) ─────────────────────────────────────────────
export function parseTeamsActivity(payload = {}) {
  if (payload && payload.type === "message") {
    return { kind: "message", provider: "teams", text: String(payload.text || "").trim(),
      user: String((payload.from && payload.from.id) || ""), channel: String((payload.conversation && payload.conversation.id) || "") };
  }
  return { kind: "ignore" };
}
export function formatTeamsResponse(result = {}) {
  return { type: "message", text: String(result.text || "") };
}

// ── core answerer + escalation ─────────────────────────────────────────────────────────────────────────
/** Build an answerer over a KB index: a confident match (score ≥ OMNI_CONF) resolves; else it's a miss. */
export function defaultAnswerer(kbIndex) {
  return (text, platform = "") => {
    const hit = matchKb(Array.isArray(kbIndex) ? kbIndex : [], text, { platform });
    if (hit && hit.score >= OMNI_CONF) {
      const d = hit.doc || {};
      const excerpt = String(d.summary || d.text || "").trim().slice(0, 500);
      return { matched: true, score: hit.score, id: d.id || "", text: `From the knowledge base — ${d.title || "guide"}:\n\n${excerpt}` };
    }
    return { matched: false, score: hit ? hit.score : 0 };
  };
}

export function humanHandoff(contact = DEFAULT_CONTACT) {
  const c = { ...DEFAULT_CONTACT, ...(contact || {}) };
  return `I couldn't resolve that from the knowledge base, so I've flagged it for a human on the IT team. ` +
    `Reach us at ${c.email} or ${c.phone} and someone will follow up.`;
}

/**
 * Handle one inbound channel message. READ-ONLY: answers from the KB or escalates to a human — it never
 * executes a fix or any write (those remain behind the desktop approval gates). Records ONE content-blind
 * proof event (source = provider) via options.record. Returns { provider, text, resolved, escalated,
 * matchedKb, ... }. Never throws.
 */
export async function handleMessage(message = {}, options = {}) {
  const provider = OMNI_PROVIDERS.includes(message.provider) ? message.provider : "slack";
  const text = String(message.text || "").trim();
  const answer = options.answer || defaultAnswerer(options.kbIndex || []);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const t0 = now();
  let result;
  if (!text) {
    result = { text: "Ask me a tech question and I'll answer from the knowledge base — or I'll hand you to a human.", resolved: false, escalated: false, matchedKb: false, empty: true };
  } else {
    let ans;
    try { ans = await answer(text, message.platform || ""); } catch { ans = { matched: false }; }
    if (ans && ans.matched) {
      result = { text: ans.text, resolved: true, escalated: false, matchedKb: true, kbId: ans.id || "" };
    } else {
      result = { text: humanHandoff(options.contact), resolved: false, escalated: true, matchedKb: false };
    }
  }
  // content-blind metric — booleans + measured latency + symbolic source ONLY; never the message text.
  if (typeof options.record === "function" && !result.empty) {
    try { options.record({ source: provider, matchedKb: result.matchedKb, resolved: result.resolved, escalated: result.escalated, resolveMs: Math.max(0, now() - t0) }); } catch { /* metrics best-effort */ }
  }
  return { provider, ...result };
}
