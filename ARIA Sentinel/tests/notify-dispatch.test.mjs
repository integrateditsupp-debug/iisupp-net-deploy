// RUN-CU / CU4 — notify-dispatch with a MOCKED server (no network): desktop/email/sms results reported honestly
// (sent · dormant = NOT sent · failed · skipped), the content-blind refusal, the 6h per-issue dedupe, the channel
// toggles, the remote approve/deny links, the redacted audit line, and never-throws.
import assert from "node:assert/strict";
import { createNotifyDispatcher, redactRecipients } from "../src/main/notify-dispatch.mjs";
import { createOutbound } from "../src/main/outbound.mjs";

let n = 0; const t = () => { n++; };
const prefs = () => ({
  deviceUser: { name: "Sam", email: "sam@acme.com", phone: "+1 416 555 0100", smsOptIn: true },
  techContacts: [{ name: "Jo", email: "jo@acme.com", phone: "", role: "admin" }],
  approver: { mode: "self" },
  reportRecipients: [],
  notifyChannels: { desktop: true, email: true, sms: true }
});

function harness({ server, prefsFn = prefs, desktop = () => true, now } = {}) {
  const calls = [];
  const logs = [];
  let clock = now || Date.parse("2026-10-08T12:00:00Z");
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init, body: init && init.body ? JSON.parse(init.body) : null });
    if (typeof server === "function") return server(url, init);
    return { ok: true, status: 200, json: async () => ({ ok: true, email: { sent: 1 }, sms: { sent: 0, dormant: true, error: "twilio-not-configured" } }) };
  };
  const outbound = createOutbound({ fetchImpl, now: () => clock });
  const d = createNotifyDispatcher({ outbound, prefs: prefsFn, desktopNotify: desktop, logEvent: (tag, text, extra) => logs.push({ tag, text, extra }), deviceKeyHash: () => "a".repeat(64), deviceId: () => "dev-hash", now: () => clock });
  return { d, calls, logs, tick: (ms) => { clock += ms; }, outbound };
}

// 1 — happy path: one POST to aria-sentinel-notify with device auth; email sent, SMS reported DORMANT (not sent), desktop shown.
{
  const h = harness();
  const r = await h.d.dispatch("issue-detected", { title: "Restart print spooler", recipeId: "restart-print-spooler", severity: "green", platform: "win32" });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "https://iisupp.net/.netlify/functions/aria-sentinel-notify");
  assert.equal(h.calls[0].init.headers["x-sentinel-key"], "a".repeat(64), "device auth = sha256(licenseKey), never the raw key");
  assert.equal(h.calls[0].body.event, "issue-detected"); assert.equal(h.calls[0].body.recipeId, "restart-print-spooler");
  assert.deepEqual(h.calls[0].body.recipients.map((x) => x.email), ["sam@acme.com", "jo@acme.com"]);
  assert.equal(r.desktop.shown, true);
  assert.equal(r.email.status, "sent");
  assert.equal(r.sms.status, "dormant", "SMS dormant = reported as NOT sent");
  assert.match(r.sms.reason, /twilio-not-configured/);
  assert.ok(h.logs.some((l) => l.tag === "NOTIFY" && /sms dormant \(not sent — provider not configured\)/.test(l.text)), "audit line says dormant SMS was not sent");
  const logged = JSON.stringify(h.logs);
  assert.ok(!logged.includes("sam@acme.com") && !logged.includes("jo@acme.com"), "audit never carries a raw address");
  assert.ok(/e:[0-9a-f]{16}/.test(logged), "recipients are hashed in the audit line");
}
t();

// 2 — content-blind by construction: a raw path / URL / log line fed into ANY ctx field is cleaned out of the payload
//     before it can leave; the guard (mustBeTelemetrySafe) is the second lock and reports safe:true on the result.
{
  const h = harness();
  const r = await h.d.dispatch("fix-failed", { title: "C:\\Users\\bob\\budget.xlsx failed to open", recipeId: "flush-dns", severity: "green", platform: "win32", outcome: "2026-10-08 12:00:00.123 [ERROR] C:\\Users\\bob\\x", deviceLabel: "see https://intranet/x" }, { force: true });
  assert.equal(h.calls.length, 1);
  const body = JSON.stringify(h.calls[0].body);
  assert.ok(!/C:\\\\Users|https?:\/\/|\[ERROR\]/.test(body), `no path / URL / log line in the wire body: ${body}`);
  assert.equal(r.safe, true);
}
t();

// 3 — dedupe: the same issue within 6h is suppressed (no POST, no desktop); a different recipe is not; after 6h it fires again; force bypasses.
{
  const h = harness();
  await h.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  const dup = await h.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(dup.deduped, true); assert.equal(h.calls.length, 1); assert.equal(dup.desktop.shown, false);
  await h.d.dispatch("issue-detected", { title: "Spooler", recipeId: "restart-print-spooler", severity: "green", platform: "win32" });
  assert.equal(h.calls.length, 2, "a different issue is not deduped");
  h.tick(6 * 3600000 + 1);
  await h.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(h.calls.length, 3, "after 6h the same issue notifies again");
  await h.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" }, { force: true });
  assert.equal(h.calls.length, 4, "force bypasses the dedupe (test notification)");
  await h.d.dispatch("fix-failed", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  await h.d.dispatch("fix-failed", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(h.calls.length, 6, "failures are never deduped");
}
t();

// 4 — channel toggles: email+sms off → no POST at all, desktop still shown; desktop off → not shown; no recipients → skipped.
{
  const off = harness({ prefsFn: () => ({ ...prefs(), notifyChannels: { desktop: true, email: false, sms: false } }) });
  const r = await off.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(off.calls.length, 0); assert.equal(r.desktop.shown, true); assert.equal(r.email.status, "skipped"); assert.equal(r.email.reason, "channel-off"); assert.equal(r.sms.status, "skipped");
  const nod = harness({ prefsFn: () => ({ ...prefs(), notifyChannels: { desktop: false, email: true, sms: false } }) });
  const r2 = await nod.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(r2.desktop.shown, false); assert.equal(r2.desktop.reason, "channel-off"); assert.equal(r2.email.status, "sent"); assert.equal(nod.calls[0].body.sms, null, "no SMS body when the channel is off");
  const none = harness({ prefsFn: () => ({ notifyChannels: { desktop: true, email: true, sms: true } }) });
  const r3 = await none.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(none.calls.length, 0); assert.equal(r3.email.reason, "no-recipient"); assert.equal(r3.sms.reason, "no-recipient");
}
t();

// 5 — server failure / network error / unsupported desktop are reported as failed — never as sent; dispatch never throws.
{
  const bad = harness({ server: async () => ({ ok: false, status: 503, json: async () => ({}) }), desktop: () => false });
  const r = await bad.d.dispatch("fix-failed", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(r.email.status, "failed"); assert.equal(r.email.reason, "http-503"); assert.equal(r.sms.status, "failed"); assert.equal(r.desktop.shown, false); assert.equal(r.desktop.reason, "unsupported");
  const net = harness({ server: async () => { throw new Error("ECONNRESET"); } });
  const r2 = await net.d.dispatch("fix-failed", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  assert.equal(r2.email.status, "failed"); assert.match(r2.email.reason, /ECONNRESET/);
  const thrower = createNotifyDispatcher({ outbound: null, prefs: () => { throw new Error("prefs exploded"); }, desktopNotify: () => { throw new Error("no"); }, logEvent: () => {} });
  const r3 = await thrower.dispatch("report", { title: "x" });
  assert.ok(r3 && r3.event === "report", "never throws");
}
t();

// 6 — approval-requested: the server's signed approve/deny URLs are surfaced (iisupp.net only; anything else is dropped).
{
  const h = harness({ server: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, email: { sent: 1 }, sms: { sent: 0, dormant: true }, approval: { id: "srv-1", approveUrl: "https://iisupp.net/.netlify/functions/aria-sentinel-approval?id=srv-1&t=abc", denyUrl: "https://evil.example/deny" } }) }) });
  const r = await h.d.dispatch("approval-requested", { title: "Clear Teams cache", recipeId: "teams-cache-v1", severity: "yellow", platform: "win32", approvalId: "apr-7", expiresAt: "2026-10-08T12:30:00Z" });
  assert.equal(r.remote.approvalId, "srv-1");
  assert.match(r.remote.approveUrl, /^https:\/\/iisupp\.net\//);
  assert.equal(r.remote.denyUrl, null, "a non-iisupp.net link is never surfaced");
  assert.equal(h.calls[0].body.approvalId, "apr-7");
  assert.deepEqual(redactRecipients([{ role: "approver", email: "x@y.com", phone: "+1 416 555 0100" }])[0].role, "approver");
  assert.doesNotMatch(JSON.stringify(redactRecipients([{ email: "x@y.com", phone: "+1 416 555 0100" }])), /x@y\.com|555/);
}
t();

// 7 — the outbound ring saw every POST (host, path, bytes, verdict) and NO body was stored.
{
  const h = harness();
  await h.d.dispatch("issue-detected", { title: "DNS", recipeId: "flush-dns", severity: "green", platform: "win32" });
  const rows = h.outbound.records();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].host, "iisupp.net"); assert.equal(rows[0].path, "/.netlify/functions/aria-sentinel-notify"); assert.equal(rows[0].method, "POST");
  assert.ok(rows[0].bytes > 100); assert.equal(rows[0].allowed, true); assert.equal(rows[0].declared, true);
  assert.equal(rows[0].bodySafe, true, "body is content-blind once the configured recipient addresses are counted separately");
  assert.equal(rows[0].identityFields, 3, "the two recipient emails + one opted-in phone are counted as identity fields, not content");
  assert.ok(!("body" in rows[0]), "the ring never stores a body");
}
t();

assert.equal(n, 7, "7 notify-dispatch groups");
console.log(`notify-dispatch test passed (${n} groups · honest per-channel results (dormant ≠ sent) · content-blind refusal · 6h dedupe · channel toggles · failures never 'sent' · remote links iisupp.net-only · privacy ring).`);
