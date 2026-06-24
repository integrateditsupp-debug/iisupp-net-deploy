// RUN 15 §5 → RUN 23e — the admin gate moved from a BUILD flag to a LICENSE-TIER gate. The runtime
// HMAC admin session (admin-gate.mjs) is unchanged and still tested here; the build-flag wiring is
// replaced by single-build license wiring: admin features unlock only for an admin-tier license.
import assert from "node:assert/strict";
import { signAdminSession, validateAdminSession, adminAvailable, ADMIN_SESSION_MS } from "../src/shared/admin-gate.mjs";
import { licenseIsAdmin } from "../src/shared/license-features.mjs";
import fs from "node:fs";
import path from "node:path";

const NOW = Date.parse("2026-06-20T00:00:00.000Z");
const SECRET = "admin-hmac-secret";

// Runtime admin session sign + validate round-trip (unchanged).
const session = signAdminSession("ahmad", NOW + ADMIN_SESSION_MS, SECRET);
assert.equal(validateAdminSession(session, SECRET, NOW).valid, true);
assert.equal(validateAdminSession({ ...session, username: "evil" }, SECRET, NOW).valid, false);
assert.equal(validateAdminSession({ ...session, sig: session.sig.replace(/.$/, "0") }, SECRET, NOW).valid, false);
assert.equal(validateAdminSession(session, SECRET, NOW + ADMIN_SESSION_MS + 1).reason, "expired");
assert.equal(validateAdminSession(session, "other", NOW).valid, false);

// RUN 23e — the admin TIER is what unlocks the console now. Only an admin-tier license is admin.
assert.equal(licenseIsAdmin({ licensed: true, plan: "admin" }), true, "admin license → admin");
for (const plan of ["personal", "pro", "smb", "midsize", "enterprise"]) {
  assert.equal(licenseIsAdmin({ licensed: true, plan }), false, `${plan} license is NOT admin`);
}
assert.equal(licenseIsAdmin({ licensed: false, plan: "admin" }), false, "no license → not admin");

// Single-build wiring: ONE package:win, no build-time admin flag, admin-console shipped via extraResources.
const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.ok(pkg.scripts["package:win"], "single build script exists");
assert.equal(pkg.scripts["package:win:admin"], undefined, "no separate admin build script");
assert.ok(!/IS_ADMIN_BUILD/.test(JSON.stringify(pkg.scripts)), "no script sets IS_ADMIN_BUILD");
assert.ok(((pkg.build && pkg.build.extraResources) || []).some((e) => String(e).includes("admin-console")), "admin console ships via extraResources");

// main.mjs now gates the admin console + tray entry on the license tier, not a build flag.
const mainJs = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /licenseIsAdmin/, "main imports the license admin gate");
assert.match(mainJs, /function currentIsAdmin\(\)/, "main defines currentIsAdmin()");
assert.match(mainJs, /if \(!currentIsAdmin\(\)\)\s*\{\s*\n\s*return \{ ok: false, error: "not-available" \}/, "openAdminConsole denies non-admin licenses");
assert.match(mainJs, /currentIsAdmin\(\) \? \[\{ label: "Open admin console"/, "tray shows admin console only for admin tier");
assert.doesNotMatch(mainJs, /const IS_ADMIN_BUILD =/, "the build-time admin flag is gone");
assert.doesNotMatch(mainJs, /isAdminBuild\(/, "main no longer calls isAdminBuild()");

// Adversarial: the gate must not be defeatable by setting the old env flag.
assert.equal(licenseIsAdmin({ licensed: true, plan: "pro", IS_ADMIN_BUILD: "1" }), false, "stale env flag cannot grant admin");

console.log("Admin-gate test passed (RUN 23e: HMAC session + license-tier admin gate + single-build wiring; non-admin tiers locked out).");
