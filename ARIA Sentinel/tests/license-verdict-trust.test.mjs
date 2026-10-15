// LICENCE VERDICT TRUST + TRIAL CLOCK (2026-10-14, review P1-3 app half · P2-9 consent).
// The review wrote ~/.aria-sentinel/license-cache.json by hand ({ key_sha256, plan:"admin", status:"active",
// verified_at:"2099-…" }) beside a license.json holding any 64-hex string: the cache was "fresh" (no network re-check)
// and the admin tier unlocked. A trial.json started a year in the future gave 395 days. Now:
//   1 the reviewer's forgery (pure): never fresh, never admin, refused as "in the future"; dated "now" it is still only
//     an unsigned claim from disk → re-checked first
//   2 a SIGNED verdict (throwaway Ed25519 pair through the module's verify seam) is accepted — bound to this device and
//     this key; any edited field, another device, another key, the production key (no seam), a future verified_at, a
//     clock rolled back under the high-water mark, a trial key past its own end → not accepted
//   3 an UNSIGNED verdict: only the one this run received, for ≤1 h, never admin
//   4 the trial clock (pure): rolled back 365 days → still expired; a start in the future → expired; the earliest start
//     wins; a missing record on a device that ran before → expired, never a new trial
//   5 main (the REAL main.mjs on the lab platform): the forgery on disk unlocks nothing, the launch re-check is NOT
//     skipped, and the resolve request carries X-Sentinel-Device and no email
//   6 main, signed: enterLicense stores verdict + sig verbatim → licensed; a relaunch trusts it from disk with no
//     network; an edited plan → nothing; the production public key rejects the throwaway signature
//   7 main, unsigned: licensed in this run only, re-asked before the hour lapses, gone after 1 h; a relaunch re-checks;
//     an unsigned "admin" never unlocks admin
//   8 main, the trial clock: 31 days → expired; the clock rolled back 365 days → still expired; trial.json deleted →
//     restored, not restarted; trial.json + its mirror deleted → still not restarted; a new machine → a new trial
//   9 main, the server's first sight of this device (heartbeat / resolve): earlier → it wins; later → the local start wins
//  10 main, P2-9: a pre-seeded licence is NOT sent before Setup consent; finishing Setup sends it once
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bootMain } from "./lib/main-sandbox.mjs";
import { createLabClock } from "./lib/fault-lab.mjs";
import { buildCache, cacheIsFresh, effectiveFromCache, unsignedFingerprint, signedVerdictCheck, FREE_PLAN, UNSIGNED_MAX_MS, CACHE_FRESH_MS } from "../src/main/license-cache.mjs";
import { computeTrialStatus, resolveTrialStart, trialStatusFor, TRIAL_DURATION_MS } from "../src/shared/license.mjs";
import { keyHash, licenseIsAdmin, activePlan } from "../src/shared/license-features.mjs";
import { verdictPayload, verifyResolveSignature } from "../src/shared/sentinel-resolve-pubkey.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000, H = 60 * MIN, DAY = 24 * H;
const KEY = "a".repeat(64);
const T0 = Date.parse("2026-10-14T12:00:00.000Z");
// main's deviceIdHash() on the lab machine (hostname LAB-PC) — what a verdict for THIS device must name.
const DEVICE = crypto.createHash("sha256").update("LAB-PC::aria-sentinel-device").digest("hex").slice(0, 32);
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const SPKI = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const verify = (v, s) => verifyResolveSignature(v, s, SPKI);
const sign = (v) => crypto.sign(null, Buffer.from(verdictPayload(v), "utf8"), privateKey).toString("base64url");
/** A sentinel-resolve answer (the contract in sentinel-resolve-pubkey.mjs), signed with the throwaway key unless told not to. */
function answer({ key = KEY, plan = "pro", status = "active", at = T0, device = DEVICE, expires_at = null, signed = true, trialStartedAt = null } = {}) {
  const verdict = { key_sha256: keyHash(key), plan, status, seats: null, expires_at, verified_at: new Date(at).toISOString(), device };
  return { plan, status, verified_at: verdict.verified_at, walkthroughEntitled: false, trialEndsAt: null, trialStartedAt, verdict, ...(signed ? { sig: sign(verdict) } : { signing: "unconfigured" }) };
}
const OPTS = { deviceHash: DEVICE, verify };
let groups = 0; const g = () => { groups++; };

// ── 1 — the reviewer's forgery (pure) ────────────────────────────────────────────────────────────────────────────────
{
  const now = T0;
  const forged = { key_sha256: keyHash(KEY), plan: "admin", status: "active", verified_at: "2099-01-01T00:00:00.000Z" };
  assert.equal(cacheIsFresh(forged, now), false, "the forged cache is not fresh — the network re-check is never skipped");
  assert.equal(cacheIsFresh(forged, now, OPTS), false);
  const eff = effectiveFromCache(forged, now, OPTS);
  assert.equal(eff.plan, FREE_PLAN); assert.equal(eff.action, "banner"); assert.equal(eff.reason, "future", "verified_at in the future is refused");
  assert.equal(licenseIsAdmin({ licensed: eff.action === "use", plan: eff.plan }), false, "licenseIsAdmin: false");
  assert.equal(activePlan({ licensed: eff.action === "use" || eff.action === "toast", plan: eff.plan }), FREE_PLAN);
  // Dated "now" instead: still an unsigned claim read from disk → re-checked with the server before it counts.
  const dated = { ...forged, verified_at: new Date(now).toISOString() };
  const e2 = effectiveFromCache(dated, now, OPTS);
  assert.equal(e2.reason, "unsigned-recheck"); assert.equal(e2.plan, FREE_PLAN);
  assert.equal(licenseIsAdmin({ licensed: e2.action === "use" || e2.action === "toast", plan: e2.plan }), false);
  // A made-up signature beside it: not a signature at all.
  const e3 = effectiveFromCache({ ...dated, verdict: { ...answer({ plan: "admin" }).verdict }, sig: "A".repeat(86) }, now, OPTS);
  assert.equal(e3.reason, "bad-signature"); assert.equal(e3.plan, FREE_PLAN);
}
g();

// ── 2 — a signed verdict is accepted, and bound to this device + this key ─────────────────────────────────────────────
{
  const cache = buildCache(KEY, answer({ plan: "pro" }), T0);
  assert.deepEqual(cache.verdict, answer({ plan: "pro" }).verdict, "verdict stored verbatim");
  assert.equal(cache.sig, answer({ plan: "pro" }).sig, "sig stored verbatim");
  const ok = effectiveFromCache(cache, T0 + H, OPTS);
  assert.equal(ok.signed, true); assert.equal(ok.plan, "pro"); assert.equal(ok.action, "use", "a signed verdict for this device + key is accepted");
  assert.equal(cacheIsFresh(cache, T0 + H, OPTS), true, "…and is fresh (the launch may skip the network)");
  const admin = effectiveFromCache(buildCache(KEY, answer({ plan: "admin" }), T0), T0 + H, OPTS);
  assert.equal(admin.plan, "admin"); assert.equal(licenseIsAdmin({ licensed: true, plan: admin.plan }), true, "a SIGNED admin verdict is the one way to admin");
  // Every field is covered by the signature.
  for (const [field, value] of [["plan", "admin"], ["status", "active "], ["device", "x".repeat(32)], ["verified_at", new Date(T0 + DAY).toISOString()], ["seats", 999], ["expires_at", "2099-01-01T00:00:00.000Z"], ["key_sha256", keyHash("c".repeat(64))]]) {
    const edited = { ...cache, verdict: { ...cache.verdict, [field]: value } };
    assert.equal(effectiveFromCache(edited, T0 + H, OPTS).reason, "bad-signature", `editing verdict.${field} breaks the signature`);
  }
  assert.equal(effectiveFromCache({ ...cache, plan: "admin" }, T0 + H, OPTS).plan, "pro", "the unsigned top-level copy grants nothing (the plan comes from the signed verdict)");
  // Another device's verdict (a copied cache) and another key's verdict, both genuinely signed.
  const other = buildCache(KEY, answer({ device: "f".repeat(32) }), T0);
  assert.equal(signedVerdictCheck(other, OPTS).reason, "other-device");
  assert.equal(effectiveFromCache(other, T0 + H, OPTS).plan, FREE_PLAN, "another device's verdict → nothing");
  const otherKey = { ...buildCache("c".repeat(64), answer({ key: "c".repeat(64) }), T0), key_sha256: keyHash(KEY) };
  assert.equal(signedVerdictCheck(otherKey, OPTS).reason, "other-key");
  assert.equal(effectiveFromCache(otherKey, T0 + H, OPTS).plan, FREE_PLAN, "another key's verdict → nothing");
  // The production public key (no seam) does not accept the throwaway signature.
  assert.equal(effectiveFromCache(cache, T0 + H, { deviceHash: DEVICE }).reason, "bad-signature", "embedded key ≠ the throwaway key");
  // A signed verified_at in the future (this clock is behind) → refused, with an honest message.
  const ahead = effectiveFromCache(buildCache(KEY, answer({ at: T0 + 2 * H }), T0), T0, OPTS);
  assert.equal(ahead.reason, "future"); assert.match(ahead.message, /clock/);
  // The age is measured against the high-water mark: a clock rolled back cannot make a 4-day-old verdict fresh.
  assert.equal(effectiveFromCache(cache, T0 + H, { ...OPTS, highWaterMs: T0 + 4 * DAY }).action, "banner", "high-water 4 days on → hard-stale");
  // A trial key stops at its own end inside the 24 h window; non-active statuses never grant the plan.
  assert.equal(effectiveFromCache(buildCache(KEY, answer({ expires_at: new Date(T0 + 2 * H).toISOString() }), T0), T0 + 3 * H, OPTS).status, "expired");
  for (const status of ["revoked", "expired", "past_due"]) assert.equal(effectiveFromCache(buildCache(KEY, answer({ status }), T0), T0 + H, OPTS).plan, FREE_PLAN, `${status} → free`);
}
g();

// ── 3 — unsigned: this run's answer only, ≤1 h, never admin ──────────────────────────────────────────────────────────
{
  const cache = buildCache(KEY, answer({ signed: false }), T0);
  assert.equal(cache.sig, null); assert.equal(cache.signing, "unconfigured");
  const fp = unsignedFingerprint(cache);
  const live = effectiveFromCache(cache, T0 + 30 * MIN, { ...OPTS, trustedUnsigned: fp });
  assert.equal(live.plan, "pro"); assert.equal(live.action, "use"); assert.equal(live.signed, false, "the answer this run received counts");
  assert.equal(effectiveFromCache(cache, T0 + UNSIGNED_MAX_MS + MIN, { ...OPTS, trustedUnsigned: fp }).reason, "unsigned-expired", "…for at most 1 hour");
  assert.equal(effectiveFromCache(cache, T0 + 30 * MIN, OPTS).reason, "unsigned-recheck", "read back from disk (a later launch) it is re-checked first");
  assert.equal(effectiveFromCache({ ...cache, plan: "enterprise" }, T0 + 30 * MIN, { ...OPTS, trustedUnsigned: fp }).reason, "unsigned-recheck", "an edit makes it a different claim");
  assert.equal(cacheIsFresh(cache, T0 + MIN, { ...OPTS, trustedUnsigned: fp }), false, "never fresh: every launch asks again");
  const adminCache = buildCache(KEY, answer({ plan: "admin", signed: false }), T0);
  const adm = effectiveFromCache(adminCache, T0 + MIN, { ...OPTS, trustedUnsigned: unsignedFingerprint(adminCache) });
  assert.equal(adm.reason, "unsigned-admin"); assert.equal(adm.plan, FREE_PLAN);
  assert.equal(licenseIsAdmin({ licensed: adm.action === "use" || adm.action === "toast", plan: adm.plan }), false, "an unsigned verdict never grants admin");
  assert.equal(UNSIGNED_MAX_MS, H); assert.equal(CACHE_FRESH_MS, DAY);
}
g();

// ── 4 — the trial clock (pure) ───────────────────────────────────────────────────────────────────────────────────────
{
  const started = new Date(T0).toISOString();
  // The reviewer's input: a start a year in the future.
  const future = computeTrialStatus(new Date(T0 + 365 * DAY).toISOString(), T0);
  assert.equal(future.state, "expired"); assert.equal(future.reason, "started-in-future"); assert.equal(future.daysLeft, 0);
  // Ran 31 days (the high-water mark), then the clock rolled back 365 days.
  const rolled = computeTrialStatus(started, T0 + 31 * DAY - 365 * DAY, { highWaterMs: T0 + 31 * DAY });
  assert.equal(rolled.state, "expired", "clock rolled back 365 days → still expired");
  // Rolled back only part-way (day 31 → day 20): the high-water mark keeps the 31 days.
  assert.equal(computeTrialStatus(started, T0 + 20 * DAY, { highWaterMs: T0 + 31 * DAY }).state, "expired");
  assert.equal(computeTrialStatus(started, T0 + 20 * DAY, { highWaterMs: T0 + 25 * DAY }).daysLeft, 5, "elapsed = max(wall clock, high-water − start)");
  assert.equal(computeTrialStatus(new Date(T0 + 2 * MIN).toISOString(), T0).state, "active", "a start 2 minutes ahead is an NTP correction, not an attack");
  assert.equal(computeTrialStatus(new Date(T0 + 2 * MIN).toISOString(), T0).remainingMs, TRIAL_DURATION_MS, "…and never more than 30 days");
  // The earliest start wins; adding a later one changes nothing.
  assert.equal(resolveTrialStart(new Date(T0).toISOString(), new Date(T0 - 40 * DAY).toISOString(), null, "garbage"), new Date(T0 - 40 * DAY).toISOString());
  assert.equal(trialStatusFor({ starts: [started, new Date(T0 - 40 * DAY).toISOString()], now: T0 }).state, "expired", "the server's earlier first sight wins");
  assert.equal(trialStatusFor({ starts: [started, new Date(T0 + 5 * DAY).toISOString()], now: T0 + DAY }).daysLeft, 29, "a later server start loses to the local one");
  // No record anywhere: a first run → not started; a device that ran before → ended, never a new trial.
  assert.equal(trialStatusFor({ starts: [], hasRunBefore: false, now: T0 }).state, "not-started");
  const missing = trialStatusFor({ starts: [null, undefined], hasRunBefore: true, now: T0 });
  assert.equal(missing.state, "expired"); assert.equal(missing.reason, "trial-record-missing");
}
g();

// ── the REAL main.mjs on the lab platform ────────────────────────────────────────────────────────────────────────────
const SETUP_DONE = { setupConfig: { onboarding: { completed: true, skipped: false, step: 3, version: 1 }, setup: { completed: true, step: 12, prefs: { mode: "manual" } } } };
const resolveCalls = (b) => b.outbound.filter((o) => /sentinel-resolve/.test(o.url));
async function boot({ at = T0, root = null, seed = SETUP_DONE, respond = null, seam = true } = {}) {
  const clock = createLabClock(at);
  const r = root || fs.mkdtempSync(path.join(os.tmpdir(), "license-trust-"));
  const headers = [];
  const wrapped = (u, init) => { if (/sentinel-resolve/.test(u)) headers.push({ ...(init && init.headers) }); return respond ? respond(u, init) : undefined; };
  const b = await bootMain({ clock, root: r, storeSeed: seed, respond: wrapped, licenseVerify: seam ? verify : undefined });
  const dir = path.join(r, "home", ".aria-sentinel");
  fs.mkdirSync(dir, { recursive: true });
  return { ...b, clock, root: r, dir, resolveHeaders: headers, file: (n) => path.join(dir, n) };
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const audit = (b) => (b.store.get("transparencyLog") || []).map((x) => `${x.tag}: ${x.text}`);
function clean(b, label) {
  const all = [JSON.stringify(b.store.snapshot()), JSON.stringify(b.outbound), JSON.stringify(b.notifications)].join("\n");
  assert.ok(!all.includes(PRIVATE_FOLDER_NAME), `${label}: no excluded-folder name anywhere`);
  assert.ok(!all.includes(KEY) || resolveCalls(b).length > 0, `${label}: the raw key appears only in the resolve POST body`);
}

// ── 5 — the forgery on disk unlocks nothing; the launch re-check is not skipped ────────────────────────────────────────
{
  const b = await boot({ respond: (u) => (/sentinel-resolve/.test(u) ? { status: "invalid" } : undefined) });
  fs.writeFileSync(b.file("license.json"), JSON.stringify({ key: KEY, email: "sam@example.com" }));
  fs.writeFileSync(b.file("license-cache.json"), JSON.stringify({ key_sha256: keyHash(KEY), plan: "admin", status: "active", verified_at: "2099-01-01T00:00:00.000Z" }));
  const lic = b.main.licenseStatus();
  assert.equal(lic.licensed, false, "the forged cache does not license"); assert.equal(lic.plan, FREE_PLAN);
  assert.equal(b.main.currentIsAdmin(), false, "…and never unlocks admin");
  assert.equal(b.main.gateStatus().licensed, false);
  await b.main.refreshLicense();
  assert.equal(resolveCalls(b).length, 1, "the launch re-check went to the server (a forged cache is never 'fresh')");
  assert.equal(b.resolveHeaders[0]["x-sentinel-device"], DEVICE, "the request names this device (X-Sentinel-Device)");
  assert.deepEqual(JSON.parse(resolveCalls(b)[0].body), { key: KEY }, "the key only — the email the server no longer reads is not sent");
  assert.equal(b.main.licenseStatus().licensed, false, "a server 'invalid' leaves nothing unlocked");
  // The same forgery dated "now" (the review's other variant) is still only a claim from disk.
  fs.writeFileSync(b.file("license-cache.json"), JSON.stringify({ key_sha256: keyHash(KEY), plan: "enterprise", status: "active", verified_at: new Date(T0).toISOString() }));
  assert.equal(b.main.licenseStatus().licensed, false, "an unsigned cache written to disk never counts");
  clean(b, "forgery");
}
g();

// ── 6 — signed (throwaway pair through the sandbox seam): stored verbatim, trusted from disk, tamper-evident ──────────
{
  const a = await boot({ respond: (u) => (/sentinel-resolve/.test(u) ? answer({ plan: "pro", at: T0 }) : undefined) });
  const r = await a.main.enterLicense({ key: KEY.toUpperCase() });
  assert.equal(r.ok, true, "a signed verdict for this device + key activates");
  assert.equal(a.main.licenseStatus().licensed, true); assert.equal(a.main.licenseStatus().plan, "pro"); assert.equal(a.main.licenseStatus().licenseSigned, true);
  const onDisk = readJson(a.file("license-cache.json"));
  assert.deepEqual(onDisk.verdict, answer({ plan: "pro", at: T0 }).verdict, "verdict written verbatim");
  assert.equal(onDisk.sig, answer({ plan: "pro", at: T0 }).sig, "sig written verbatim");
  assert.ok(!JSON.stringify(onDisk).includes(KEY), "no raw key in the cache");
  // A relaunch an hour later trusts the signed cache from disk and skips the network.
  const b = await boot({ at: T0 + H, root: a.root, seed: a.store.snapshot(), respond: () => { throw new Error("no network expected"); } });
  assert.equal(b.main.licenseStatus().licensed, true, "relaunch: the signed cache counts");
  await b.main.refreshLicense();
  assert.equal(resolveCalls(b).length, 0, "…and a fresh signed cache skips the launch re-check");
  // Edit the plan on disk → the signature no longer verifies → nothing.
  fs.writeFileSync(b.file("license-cache.json"), JSON.stringify({ ...onDisk, verdict: { ...onDisk.verdict, plan: "admin" } }));
  assert.equal(b.main.licenseStatus().licensed, false, "edited verdict → no licence");
  assert.equal(b.main.currentIsAdmin(), false);
  // The real (embedded) key: the throwaway-signed cache is not a verdict at all.
  fs.writeFileSync(b.file("license-cache.json"), JSON.stringify(onDisk));
  const c = await boot({ at: T0 + H, root: a.root, seed: a.store.snapshot(), seam: false, respond: (u) => (/sentinel-resolve/.test(u) ? { status: "rate-limited" } : undefined) });
  assert.equal(c.main.licenseStatus().licensed, false, "production key: a verdict not signed by the licence server is rejected");
  clean(a, "signed");
}
g();

// ── 7 — unsigned: this run only, re-asked before it lapses, gone after an hour; an unsigned admin never unlocks admin ──
{
  let answerWith = () => answer({ plan: "pro", signed: false });
  const a = await boot({ respond: (u) => (/sentinel-resolve/.test(u) ? answerWith() : undefined) });
  const r = await a.main.enterLicense({ key: KEY });
  assert.equal(r.ok, true, "an unsigned answer counts in the run that received it");
  assert.equal(a.main.licenseStatus().licenseSigned, false);
  assert.ok(audit(a).some((t) => /^LICENSE: The licence server's answer was not signed \(unconfigured\) — it counts for at most 1 hour, never unlocks admin/.test(t)), "audited");
  answerWith = () => ({ status: "rate-limited" }); // the re-ask finds the server busy
  await a.clock.advance(50 * MIN + 1000);
  assert.equal(resolveCalls(a).length, 2, "re-asked 50 minutes in (before the hour lapses)");
  assert.equal(a.main.licenseStatus().licensed, true, "still inside the hour");
  await a.clock.advance(11 * MIN);
  assert.equal(a.main.licenseStatus().licensed, false, "after 1 hour an unsigned answer no longer counts");
  // A relaunch inside the hour does not trust the unsigned cache it finds on disk.
  const b = await boot({ at: T0 + 5 * MIN, root: a.root, seed: a.store.snapshot() });
  fs.writeFileSync(b.file("license-cache.json"), JSON.stringify(buildCache(KEY, answer({ plan: "pro", signed: false }), T0)));
  assert.equal(b.main.licenseStatus().licensed, false, "relaunch: an unsigned verdict is re-checked before it counts again");
  // Unsigned admin.
  const c = await boot({ respond: (u) => (/sentinel-resolve/.test(u) ? answer({ plan: "admin", signed: false }) : undefined) });
  const rc = await c.main.enterLicense({ key: KEY });
  assert.equal(rc.ok, false); assert.equal(rc.error, "unverified");
  assert.equal(c.main.currentIsAdmin(), false, "an unsigned verdict never grants admin");
  clean(a, "unsigned");
}
g();

// ── 8 — the trial clock on main: run 31 days, roll the clock back, delete the record ─────────────────────────────────────
{
  const a = await boot();
  assert.equal(a.main.ensureTrialStarted(), true, "a first run starts the trial");
  assert.equal(a.main.trialState().state, "active"); assert.equal(a.main.trialState().daysLeft, 30);
  assert.equal(a.store.get("trialStartedAt"), new Date(T0).toISOString(), "the start is mirrored in the store");
  // 31 days of running (the minute tick raises the high-water mark).
  const b = await boot({ at: T0 + 31 * DAY, root: a.root, seed: a.store.snapshot() });
  b.main.touchClockHighWater();
  assert.equal(b.main.trialState().state, "expired");
  assert.equal(readJson(b.file("license-cache.json")).last_seen, new Date(T0 + 31 * DAY).toISOString(), "the high-water mark is in the licence cache too");
  // Clock rolled back 365 days, relaunch.
  const c = await boot({ at: T0 + 31 * DAY - 365 * DAY, root: a.root, seed: b.store.snapshot() });
  assert.equal(c.main.ensureTrialStarted(), false, "no new trial");
  assert.equal(c.main.trialState().state, "expired", "clock rolled back 365 days → still expired");
  assert.equal(c.main.gateStatus().unlocked, false);
  assert.equal(c.main.licenseStatus().daysLeft, 0, "no phantom days on any surface");
  // Rolled back to day 10 after a 31-day run (inside the trial window by the wall clock): still expired.
  const d = await boot({ at: T0 + 10 * DAY, root: a.root, seed: b.store.snapshot() });
  assert.equal(d.main.trialState().state, "expired", "high-water − start = 31 days");
  // trial.json deleted → restored from the mirror, not restarted.
  fs.rmSync(d.file("trial.json"));
  assert.equal(d.main.ensureTrialStarted(), false, "trial.json missing → not restarted");
  assert.equal(readJson(d.file("trial.json")).started_at, new Date(T0).toISOString(), "restored from the recorded start");
  assert.equal(d.main.trialState().state, "expired");
  // trial.json AND its store mirror deleted (the high-water mark remains) → still not restarted.
  fs.rmSync(d.file("trial.json"));
  d.store.delete("trialStartedAt");
  const e = await boot({ at: T0 + 10 * DAY, root: a.root, seed: d.store.snapshot() });
  assert.equal(e.main.ensureTrialStarted(), false, "a device ARIA has run on before never starts a second trial");
  assert.equal(e.main.trialState().state, "expired"); assert.equal(e.main.trialState().reason, "trial-record-missing");
  assert.ok(audit(e).some((t) => /trial\.json was missing on a device ARIA has run on before — the trial is not restarted/.test(t)), "audited");
  // A brand-new machine still gets its trial.
  const f = await boot({ at: T0 + 10 * DAY });
  assert.equal(f.main.ensureTrialStarted(), true); assert.equal(f.main.trialState().state, "active");
  clean(e, "trial clock");
}
g();

// ── 9 — the server's first sight of this device anchors the trial (earlier wins; later loses) ─────────────────────────
{
  const early = await boot({ at: T0, respond: (u) => (/aria-sentinel-heartbeat/.test(u) ? { ok: true, trialStartedAt: new Date(T0 - 40 * DAY).toISOString(), trialAnchor: "existing" } : undefined) });
  early.main.ensureTrialStarted();
  assert.equal(early.main.trialState().state, "active", "locally a fresh trial…");
  await early.main.sendHeartbeat();
  assert.equal(early.store.get("serverTrialStartedAt"), new Date(T0 - 40 * DAY).toISOString());
  assert.equal(early.main.trialState().state, "expired", "…but the server first saw this device 40 days ago: the earlier start wins");
  const late = await boot({ at: T0 + DAY, respond: (u) => (/aria-sentinel-heartbeat/.test(u) ? { ok: true, trialStartedAt: new Date(T0 + DAY).toISOString() } : undefined) });
  fs.writeFileSync(late.file("trial.json"), JSON.stringify({ started_at: new Date(T0).toISOString() }));
  await late.main.sendHeartbeat();
  assert.equal(late.main.trialState().daysLeft, 29, "a later server date never lengthens the local trial");
  // sentinel-resolve's trialStartedAt is honoured the same way.
  const viaResolve = await boot({ at: T0, respond: (u) => (/sentinel-resolve/.test(u) ? answer({ trialStartedAt: new Date(T0 - 35 * DAY).toISOString() }) : undefined) });
  viaResolve.main.ensureTrialStarted();
  await viaResolve.main.enterLicense({ key: KEY });
  assert.equal(viaResolve.store.get("serverTrialStartedAt"), new Date(T0 - 35 * DAY).toISOString());
  assert.equal(viaResolve.main.trialState().state, "expired");
  clean(early, "server anchor");
}
g();

// ── 10 — P2-9: a pre-seeded licence waits for Setup consent ─────────────────────────────────────────────────────────────
{
  const b = await boot({ seed: {}, respond: (u) => (/sentinel-resolve/.test(u) ? answer({ plan: "pro" }) : undefined) });
  fs.writeFileSync(b.file("license.json"), JSON.stringify({ key: KEY, email: "it@example.com" })); // Intune pre-seed
  const r = await b.main.refreshLicense();
  assert.equal(r && r.deferred, true, "before Setup: deferred");
  await b.clock.advance(5 * MIN);
  assert.equal(b.outbound.length, 0, "nothing at all left the device before Setup (no licence check, no heartbeat)");
  assert.ok(audit(b).some((t) => /^LICENSE: Licence check deferred until Setup is completed \(nothing leaves the device before consent\)\.$/.test(t)));
  await b.ipc.invoke("setup:complete", {});
  await b.clock.advance(2000);
  assert.equal(resolveCalls(b).length, 1, "finishing Setup runs the licence check once");
  assert.equal(b.main.licenseStatus().licensed, true, "…and the pre-seeded key is verified");
  clean(b, "consent");
}
g();

assert.equal(groups, 10);
console.log(`license-verdict-trust test passed (${groups} groups · the reviewer's forged cache: never fresh, never admin · signed verdicts accepted only for this device + key, every field covered · unsigned: this run only, ≤1 h, never admin · trial: rolled back 365 days still expired, deleted record not restarted, earliest start (server first sight) wins · a pre-seeded licence waits for Setup consent).`);
