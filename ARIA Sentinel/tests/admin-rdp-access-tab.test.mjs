// Admin Console RDP rescue tab: present, honest, disabled until live endpoint authority exists.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin-console", "index.html"), "utf8");

assert.match(admin, /data-view-target="rdp-access"/, "Grant Asset RDP Access nav button exists");
assert.match(admin, /data-view="rdp-access"/, "Grant Asset RDP Access view exists");
assert.match(admin, /Grant Asset RDP Access/, "tab uses the requested product name");
assert.match(admin, /Corporate-controlled temporary rescue access/, "authority framing is visible");
assert.match(admin, /the company owns the authority model/i, "company-owned authority model is explicit");
assert.match(admin, /Credential storage<\/span><strong class="ok">None/, "credential storage says none");
assert.match(admin, /id="rdpGrantBtn" disabled/, "grant action is disabled until real validation exists");
assert.match(admin, /No live RDP grants loaded/, "history is honest when no backend records are loaded");
assert.match(admin, /RDP cannot work during a blue screen/i, "blue-screen limitation is explicit");
assert.match(admin, /ARIA does not bypass policy/i, "policy bypass is denied");
assert.match(admin, /OneDrive, SharePoint, corporate backup, or onsite recovery/i, "offline recovery alternatives are visible");
assert.doesNotMatch(admin, /RDP_GRANT_SUCCESS|Grant successful|Access granted/i, "static UI does not fake a successful grant");

assert.match(admin, /'Grant Asset RDP Access'/, "tab title metadata includes RDP tab");
assert.match(admin, /Temporary RDP rescue gated by customer-owned authority/, "tab subtitle metadata includes RDP tab");

console.log("Admin RDP access tab test passed (present, disabled, customer authority, no blue-screen or fake-success claim).");
