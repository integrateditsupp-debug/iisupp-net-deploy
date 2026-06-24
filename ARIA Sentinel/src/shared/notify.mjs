// notify — builds the Slack/Teams "ARIA auto-fixed something" message. Carries ONLY a sanitized
// telemetry-event-v1 (recipe id · outcome · endpoint handle · duration) — NEVER user content. Same
// principle as the RUN 3 privacy verifier: nothing crosses the boundary that isn't content-blind.
// The webhook URL is treated as a secret — redacted before it ever touches the audit log.
import { buildTelemetryEvent, isTelemetrySafe } from "./telemetry-event.mjs";

// Only well-known incoming-webhook hosts are accepted (https only). A user-pasted URL to anywhere
// else is refused, so this can't be turned into a generic exfil channel.
export const NOTIFY_HOST_ALLOWLIST = [
  "hooks.slack.com",
  "outlook.office.com",
  "outlook.office365.com",
  ".webhook.office.com" // Teams workflow/connector hosts (tenant subdomains)
];

export function isAllowedWebhook(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return NOTIFY_HOST_ALLOWLIST.some((a) => (a.startsWith(".") ? host.endsWith(a) : host === a));
}

// Mask a webhook URL for logging: keep scheme+host, drop the secret path/token.
export function redactWebhookForLog(url) {
  try {
    const u = new URL(String(url));
    return `${u.protocol}//${u.hostname}/***`;
  } catch {
    return "***";
  }
}

/**
 * Build the webhook JSON body from a fix event. Slack and Teams both accept a {text} payload.
 * Returns { ok, payload } — ok is false if the event isn't content-blind (then we send nothing).
 */
export function buildNotifyPayload(eventInput, opts = {}) {
  const event = buildTelemetryEvent(eventInput);
  if (!isTelemetrySafe(event)) return { ok: false, reason: "not-content-blind" };
  const channel = sanitizeChannel(opts.channel);
  const line = `ARIA Sentinel: ${event.recipeId || "fix"} — ${event.outcome} on ${event.endpoint || "an endpoint"} (${event.durationMs}ms) at ${event.ts}`;
  const payload = { text: line, event };
  if (channel) payload.channel = channel;
  return { ok: true, payload };
}

// Channel names are kebab/word only — a free-text channel can't smuggle content.
function sanitizeChannel(value) {
  const raw = String(value || "").trim().replace(/^#/, "");
  return /^[a-z0-9._-]{1,80}$/i.test(raw) ? raw : "";
}
