// RUN 6 — Slack/Teams notify. Asserts: payload schema, 0 user content, webhook URL never logged,
// and only Slack/Teams incoming-webhook hosts are accepted.
import assert from "node:assert/strict";
import {
  buildNotifyPayload,
  isAllowedWebhook,
  redactWebhookForLog,
  NOTIFY_HOST_ALLOWLIST
} from "../src/shared/notify.mjs";

// Allowed webhook hosts (https only).
assert.equal(isAllowedWebhook("https://hooks.slack.com/services/T/B/xxxx"), true);
assert.equal(isAllowedWebhook("https://acme.webhook.office.com/webhookb2/abc"), true);
assert.equal(isAllowedWebhook("https://outlook.office.com/webhook/abc"), true);
assert.equal(isAllowedWebhook("http://hooks.slack.com/x"), false, "http rejected");
assert.equal(isAllowedWebhook("https://evil.com/collect"), false, "arbitrary host rejected");
assert.equal(isAllowedWebhook("not-a-url"), false);
assert.ok(NOTIFY_HOST_ALLOWLIST.length >= 3);

// Payload: built from a telemetry-event, carries only symbolic fields.
const built = buildNotifyPayload(
  { recipeId: "dns-fail-v1", signal: "NET.DNS.FAIL", outcome: "applied", endpoint: "LAPTOP-7F3K2MJ", durationMs: 1200, tier: "green", ts: Date.parse("2026-06-19T12:00:00Z") },
  { channel: "#it-fixes" }
);
assert.equal(built.ok, true);
assert.ok(typeof built.payload.text === "string", "has Slack/Teams text");
assert.equal(built.payload.channel, "it-fixes", "channel sanitized (no #)");
assert.equal(built.payload.event.v, "telemetry-event-v1");
assert.ok(!built.payload.event.endpoint.includes("LAPTOP"), "endpoint is an opaque handle, not the machine name");

// 0 user content: an attempt to smuggle PII through fields is dropped/escaped before send.
const dirty = buildNotifyPayload({ recipeId: "dns-fail-v1", outcome: "applied", endpoint: "x", durationMs: 1, tier: "green", note: "email jdoe@contoso.com path C:\\Users\\jdoe\\secret.docx" });
assert.equal(dirty.ok, true);
const text = JSON.stringify(dirty.payload);
assert.ok(!text.includes("jdoe@contoso.com"), "no email leaks into payload");
assert.ok(!text.includes("secret.docx"), "no file path leaks into payload");

// Webhook URL redaction for logs — the secret path/token never appears.
const masked = redactWebhookForLog("https://hooks.slack.com/services/T00/B00/SECRETTOKEN");
assert.equal(masked, "https://hooks.slack.com/***");
assert.ok(!masked.includes("SECRETTOKEN"), "webhook secret never logged");

console.log("Slack-notify test passed (host allowlist · symbolic-only payload · 0 user content · webhook redacted in logs).");
