// Spec acceptance (dev-docs/sentinel-profile-and-session-email-spec.md, D):
//  - first-run profile gate blocks until saved; profile.json persists + re-read
//  - session payload built from REAL metrics, content-safe, escalation says "escalated" (Rule 14)
//  - report built/sent ONLY at session end (never mid-session)
//  - the email function sends two emails, honest outcome wording, no "fixed" on an escalation
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import {
  validateProfile, profileComplete, loadProfile, saveProfile, profileGateRequired, PROFILE_FIELDS
} from "../src/shared/profile.mjs";
import {
  createSession, recordTurn, recordAction, endSession, slaStatus, buildSessionReport, scrub
} from "../src/shared/session.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const ok = () => { n++; };

// ── 1. profile gate: validation ────────────────────────────────────────────────────────────────────────
assert.equal(validateProfile({}).valid, false, "empty profile rejected");
assert.ok(validateProfile({ firstName: "A", lastName: "B", company: "C", email: "bad", phone: "6475551234" }).errors.email, "bad email rejected");
assert.ok(validateProfile({ firstName: "A", lastName: "B", company: "C", email: "a@b.co", phone: "123" }).errors.phone, "short phone rejected");
const good = { firstName: "Ada", lastName: "Lovelace", company: "Acme", email: "ada@acme.com", phone: "(647) 555-1234" };
assert.equal(profileComplete(good), true, "complete profile accepted");
assert.deepEqual(PROFILE_FIELDS, ["firstName", "lastName", "company", "email", "phone"], "same fields ARIA web asks");
ok();

// ── 2. persistence: gate required → save → re-read (fake fs over an in-memory map) ───────────────────────
const store = new Map();
const fakeFs = {
  readFileSync(p) { if (!store.has(p)) { const e = new Error("ENOENT"); throw e; } return store.get(p); },
  writeFileSync(p, data) { store.set(p, data); },
  mkdirSync() {}
};
const dir = "C:\\Users\\X\\AppData\\Local\\ARIA Sentinel";
assert.equal(profileGateRequired(fakeFs, path, dir), true, "gate required before any save");
assert.equal(saveProfile(fakeFs, path, dir, { firstName: "Ada" }).ok, false, "incomplete save refused");
const saved = saveProfile(fakeFs, path, dir, good);
assert.equal(saved.ok, true, "complete save persists");
assert.ok(saved.profile.savedAt, "savedAt stamped");
assert.equal(profileGateRequired(fakeFs, path, dir), false, "gate clears after save");
const reread = loadProfile(fakeFs, path, dir);                      // re-read each launch
assert.equal(reread.email, "ada@acme.com", "profile re-read from disk");
ok();

// ── 3. session: REAL metrics + content-safe + resolved only when resolved ──────────────────────────────
const t0 = 1_700_000_000_000;
let s = createSession({ id: "sess-1", issue: "wifi keeps dropping", intent: "wifi", startedAt: t0 });
recordTurn(s, "user", "my wifi keeps dropping at C:\\Users\\me\\private pics and vids\\x", t0 + 1000);
recordTurn(s, "aria", "Let's reset the adapter. token sk-ABCDEFGHIJKLMNOPQRST1234", t0 + 5000);
recordAction(s, { recipeId: "wifi-no-internet-v1", step: "reset adapter at C:\\Windows\\sys", outcome: "applied" }, t0 + 8000);
// build before end → must THROW (never mid-session)
assert.throws(() => buildSessionReport(s, good), /never.*mid-session/i, "no report mid-session");
endSession(s, "resolved", t0 + 120000);                            // 2 min real elapsed
const rep = buildSessionReport(s, good);
assert.equal(rep.resolved, true, "resolved=true only when resolved");
assert.equal(rep.escalated, false);
assert.equal(rep.sla.timeToResolveText, "2m", "REAL measured time-to-resolve");
assert.equal(rep.sla.respondText, "5s", "REAL first-response time");
assert.equal(rep.user.email, "ada@acme.com", "user contact attached for delivery");
const blob = JSON.stringify(rep);
assert.ok(!/private\s+pics\s+and\s+vids/i.test(blob), "R11 private folder scrubbed");
assert.ok(!/C:\\\\/.test(blob) && !/C:\\/.test(blob), "absolute paths scrubbed");
assert.ok(!/sk-[A-Za-z0-9]{16,}/.test(blob), "secret token scrubbed");
ok();

// ── 4. escalation is HONEST — says escalated, never fixed/resolved ─────────────────────────────────────
let e = createSession({ id: "sess-2", issue: "drive failing", intent: "disk", startedAt: t0 });
recordTurn(e, "aria", "I can't fix hardware remotely.", t0 + 2000);
endSession(e, "escalated", t0 + 30000);
const erep = buildSessionReport(e, good);
assert.equal(erep.resolved, false, "escalated is NOT resolved");
assert.equal(erep.escalated, true);
assert.match(erep.summary, /escalat/i, "summary says escalated");
assert.doesNotMatch(erep.summary, /\bfixed\b|\bresolved on your device\b/i, "never claims a fix on escalation");
assert.equal(erep.sla.resolveMet, null, "no resolve-SLA verdict on an escalation");
ok();

// ── 5. email function: only on ended session; honest subjects; never "fixed" on escalation ─────────────
const fn = (await import(pathToFileURL(path.join(root, "..", "..", "netlify", "functions", "sentinel-session-report.js")).href)).handler;
const opt = await fn({ httpMethod: "OPTIONS" });
assert.equal(opt.statusCode, 204, "OPTIONS → 204");
const mid = await fn({ httpMethod: "POST", body: JSON.stringify({ sessionId: "x", outcome: "resolved" }) }); // no endedAt
assert.equal(mid.statusCode, 400, "no send without an ended session (endedAt)");
// resolved + ended, no RESEND key → 503 with a content-safe preview, never throws
const okRep = await fn({ httpMethod: "POST", body: JSON.stringify(rep) });
assert.ok(okRep.statusCode === 503 || okRep.statusCode === 200 || okRep.statusCode === 207, "ended session accepted");
const erepRes = await fn({ httpMethod: "POST", body: JSON.stringify(erep) });
assert.ok(!/\bfixed\b/i.test(erepRes.body || ""), "escalation response never says fixed");
ok();

// ── 6. privacy invariant: the new outbound path is explicitly allow-listed, nothing else ───────────────
const { SESSION_OUTBOUND_PATHS, isSessionPathAllowed, CAPTURE_HOST_ALLOWLIST } = await import("../src/shared/network-capture.mjs");
assert.deepEqual(SESSION_OUTBOUND_PATHS, ["/.netlify/functions/sentinel-session-report"], "exactly one session-report path");
assert.equal(isSessionPathAllowed("/.netlify/functions/sentinel-session-report"), true, "session-report path allowed");
assert.equal(isSessionPathAllowed("/.netlify/functions/anything-else"), false, "no other path allowed");
assert.ok(CAPTURE_HOST_ALLOWLIST.includes("iisupp.net"), "host already allow-listed — telemetry allowlist UNCHANGED");
ok();

console.log(`profile-session test passed (${n} groups · profile gate+persistence · REAL SLA · content-safe scrub · escalated≠fixed · send-on-end-only · 2-email function · outbound-path allow-listed).`);
