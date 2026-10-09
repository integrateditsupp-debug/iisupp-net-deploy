// RUN-CU / CU4 — notify-channels (pure): per-event builders, recipient resolution by role, honest platform
// capabilities, and the content-blind guard that refuses raw paths / URLs / log lines / document text / usernames.
import assert from "node:assert/strict";
import { buildNotification, resolveRecipients, platformCapabilities, mustBeTelemetrySafe, channelsFor, dedupeKey, NOTIFY_EVENTS, ISSUE_DEDUPE_MS } from "../src/shared/notify-channels.mjs";

let n = 0; const t = () => { n++; };
const prefs = {
  deviceUser: { name: "Sam Lee", email: "Sam@Acme.com", phone: "+1 416 555 0100", smsOptIn: true },
  techContacts: [
    { name: "Jo", email: "jo@acme.com", phone: "", role: "it-lead" },
    { name: "Ada", email: "ada@acme.com", phone: "+1 416 555 0102", role: "approver" },
    { name: "Max", email: "max@acme.com", phone: "", role: "admin" }
  ],
  approver: { mode: "admin", contacts: ["it@acme.com"], timeoutMinutes: 30, onTimeout: "skip" },
  reportRecipients: [{ email: "owner@acme.com", phone: "" }],
  notifyChannels: { desktop: true, email: true, sms: true }
};

// 1 — platform honesty: Windows/Surface detect+fix · macOS detect+limited · phones/tablets/ChromeOS guided only.
{
  assert.deepEqual([platformCapabilities("win32").detect, platformCapabilities("win32").fix], [true, true]);
  assert.equal(platformCapabilities("surface").fix, true);
  const mac = platformCapabilities("darwin");
  assert.equal(mac.detect, true); assert.equal(mac.fix, "limited"); assert.match(mac.copy, /user-level/i);
  for (const p of ["ios", "ipados", "android", "chromeos"]) {
    const c = platformCapabilities(p);
    assert.equal(c.fix, false, `${p}: no fix`); assert.equal(c.detect, false, `${p}: no agent`); assert.equal(c.guided, true); assert.match(c.copy, /no agent runs/i); assert.doesNotMatch(c.copy, /\bfixed\b/i);
  }
  assert.equal(platformCapabilities("linux").fix, false);
  assert.equal(platformCapabilities("").platform, "unknown");
}
t();

// 2 — mustBeTelemetrySafe: catalog-shaped payloads pass; paths / URLs / log lines / emails / card-like digits are refused.
{
  assert.equal(mustBeTelemetrySafe({ title: "Restart print spooler", recipeId: "restart-print-spooler", severity: "green", platform: "windows" }).ok, true);
  assert.equal(mustBeTelemetrySafe({ t: "see C:\\Users\\bob\\Documents\\budget.xlsx" }).reason, "raw-path");
  assert.equal(mustBeTelemetrySafe({ t: "/Users/bob/private" }).reason, "raw-path");
  assert.equal(mustBeTelemetrySafe({ t: "\\\\fileserver\\share" }).reason, "raw-path");
  assert.equal(mustBeTelemetrySafe({ t: "open https://intranet.acme.com/x" }).reason, "url");
  assert.equal(mustBeTelemetrySafe({ t: "2026-10-08 12:00:00.123 [ERROR] Spooler died" }).reason, "log-line");
  assert.equal(mustBeTelemetrySafe({ t: "Exception in thread main" }).reason, "log-line");
  assert.equal(mustBeTelemetrySafe({ t: "mail bob@acme.com" }).reason, "email-in-payload");
  assert.equal(mustBeTelemetrySafe({ t: "card 4111 1111 1111 1111" }).reason, "content-leak");
  assert.equal(mustBeTelemetrySafe({ t: "x".repeat(9000) }).reason, "too-large");
  assert.equal(mustBeTelemetrySafe(undefined).ok, true, "empty payload is trivially safe");
}
t();

// 3 — recipient resolution by role (issue → user + every tech contact; approval → per approver.mode; report → recipients).
{
  const issue = resolveRecipients(prefs, "issue-detected");
  assert.deepEqual(issue.map((r) => r.email), ["sam@acme.com", "jo@acme.com", "ada@acme.com", "max@acme.com"]);
  assert.equal(issue[0].phone, "+1 416 555 0100", "device user opted in → phone kept");
  const noOpt = resolveRecipients({ ...prefs, deviceUser: { ...prefs.deviceUser, smsOptIn: false } }, "issue-detected");
  assert.equal(noOpt[0].phone, "", "no SMS opt-in → the user's phone is never used");
  const adminApr = resolveRecipients(prefs, "approval-requested");
  assert.deepEqual(adminApr.map((r) => r.email).sort(), ["ada@acme.com", "it@acme.com", "max@acme.com"].sort(), "admin mode → approver contacts + approver/admin tech contacts (not it-lead, not the user)");
  const selfApr = resolveRecipients({ ...prefs, approver: { mode: "self" } }, "approval-requested");
  assert.deepEqual(selfApr.map((r) => r.email), ["sam@acme.com"]);
  const either = resolveRecipients({ ...prefs, approver: { ...prefs.approver, mode: "either" } }, "approval-requested");
  assert.deepEqual(either.map((r) => r.email).sort(), ["ada@acme.com", "it@acme.com", "max@acme.com", "sam@acme.com"].sort());
  const adminNone = resolveRecipients({ ...prefs, techContacts: [], approver: { mode: "admin", contacts: [] } }, "approval-requested");
  assert.deepEqual(adminNone.map((r) => r.email), ["sam@acme.com"], "admin mode with nobody configured falls back to the device user (never nobody)");
  assert.deepEqual(resolveRecipients(prefs, "report").map((r) => r.email), ["owner@acme.com"]);
  assert.deepEqual(resolveRecipients({ ...prefs, reportRecipients: [] }, "report").map((r) => r.email), ["sam@acme.com"], "no report recipients → the user");
  assert.deepEqual(resolveRecipients({}, "issue-detected"), [], "no prefs → nobody (never an invented address)");
}
t();

// 4 — builders: every event yields subject/text/sms/desktop + a SAFE payload; copy is honest about dormant/dry-run/platform.
{
  for (const ev of NOTIFY_EVENTS) {
    const b = buildNotification(ev, { title: "Restart print spooler", recipeId: "restart-print-spooler", severity: "green", platform: "win32", approvalId: "apr-1", expiresAt: "2026-10-08T12:30:00Z", summary: { fixes: 2, detections: 3, failures: 1, period: "last 24 hours" }, ts: "2026-10-08T12:00:00Z" }, prefs);
    assert.equal(b.event, ev); assert.ok(b.subject && b.text && b.sms && b.desktop.title, `${ev} has all channel copy`);
    assert.equal(b.safe.ok, true, `${ev} payload is content-blind`);
    assert.equal(b.payload.v, "sentinel-notify-v1");
    assert.ok(!JSON.stringify(b.payload).includes("@"), `${ev} payload carries no address (recipients travel separately)`);
  }
  const apr = buildNotification("approval-requested", { title: "Clear Teams cache", recipeId: "teams-cache-v1", severity: "yellow", platform: "win32", expiresAt: "2026-10-08T12:30:00Z" }, prefs);
  assert.match(apr.text, /will not run until someone approves/i);
  assert.match(apr.text, /2026-10-08 12:30 UTC/);
  const dry = buildNotification("fix-executed", { title: "Flush DNS", recipeId: "flush-dns", severity: "green", platform: "win32", dryRun: true }, prefs);
  assert.match(dry.text, /previewed \(dry-run, nothing changed\)/i, "a dry-run is reported as a preview, never a fix");
  const ver = buildNotification("fix-executed", { title: "Flush DNS", recipeId: "flush-dns", severity: "green", platform: "win32", verified: true, restorePoint: true }, prefs);
  assert.match(ver.text, /fixed and verified/); assert.match(ver.text, /restore point was created/i);
  const norp = buildNotification("fix-executed", { title: "Flush DNS", recipeId: "flush-dns", severity: "green", platform: "win32", restorePoint: false }, prefs);
  assert.match(norp.text, /No restore point was available/i);
  const ios = buildNotification("issue-detected", { title: "Wi-Fi keeps dropping", severity: "yellow", platform: "ios" }, prefs);
  assert.match(ios.text, /nothing is executed on this platform/i, "phones: guided only, said plainly");
  const bad = buildNotification("issue-detected", { title: "C:\\Users\\bob\\secret.docx failed", severity: "red", platform: "win32" }, prefs);
  assert.equal(bad.safe.ok, true, "the title is cleaned to catalog shape before it can leak");
  assert.doesNotMatch(bad.payload.title, /\\/);
  const rep = buildNotification("report", { summary: { fixes: 1, detections: 4, failures: 0, period: "last 7 days" } }, prefs);
  assert.match(rep.text, /4 issues detected, 1 fix applied, 0 needing a person/);
  assert.match(rep.text, /PDF stays on the device/i);
  assert.equal(buildNotification("report", {}, prefs).payload.ts, null, "no timestamp is ever fabricated");
}
t();

// 5 — channels follow the wizard toggles; dedupe key is per event + recipe (never the device); 6h constant.
{
  assert.deepEqual(channelsFor({ notifyChannels: { desktop: false, email: true, sms: false } }), { desktop: false, email: true, sms: false });
  assert.deepEqual(channelsFor({}), { desktop: true, email: true, sms: false });
  assert.equal(dedupeKey("issue-detected", { recipeId: "flush-dns", title: "x" }), "issue-detected:flush-dns");
  assert.equal(dedupeKey("issue-detected", { title: "Disk nearly full" }), "issue-detected:disk nearly full");
  assert.equal(ISSUE_DEDUPE_MS, 6 * 60 * 60 * 1000);
}
t();

assert.equal(n, 5, "5 notify-channels groups");
console.log(`notify-channels test passed (${n} groups · platform honesty · content-blind guard · recipients by role · honest builders · channels/dedupe).`);
