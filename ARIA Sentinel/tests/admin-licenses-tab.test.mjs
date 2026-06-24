// RUN 24 A4 — admin console Licenses tab: nav + view + JS wiring, admin-token gated, key masked.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const admin = read("admin-console", "index.html");
const handler = read("..", "netlify", "functions", "sentinel-licenses.mjs");
const main = read("src", "main", "main.mjs");

// 1 — the tab exists (nav button + view panel) with the registry table columns.
assert.match(admin, /data-view-target="licenses"/, "Licenses nav button");
assert.match(admin, /data-view="licenses"/, "Licenses view panel");
for (const col of ["Email", "Name", "Tier", "Key", "Issued", "Status", "Actions"]) {
  assert.ok(admin.includes(`<th>${col}</th>`), `column ${col}`);
}

// 2 — the JS wires every action through the admin-token fetch helper, and the key is MASKED by default.
assert.match(admin, /function loadLicenses/, "loadLicenses defined");
assert.match(admin, /target === 'licenses'\) loadLicenses\(\)/, "tab activation loads the registry");
for (const action of ["action=list", "action=resend", "action=revoke", "action=addManual", "action=exportCsv"]) {
  assert.ok(admin.includes(`sentinel-licenses?${action}`), `wires ${action}`);
}
assert.match(admin, /const maskKey =/, "key masking helper");
assert.match(admin, /maskKey\(r\.key\)/, "table renders the MASKED key, not the raw key");
assert.match(admin, /data-key="\$\{esc\(r\.key/, "raw key only revealed on explicit click");
assert.match(admin, /confirm\(/, "revoke is confirmed");

// 3 — the API gates every mutation on the admin token (Bearer OR X-Admin-Token), is-revoked stays public.
assert.match(handler, /isAdminAuthorized\(authHeader, token\) \|\| isAdminAuthorized\(`Bearer \$\{xToken/, "accepts Bearer or X-Admin-Token");
assert.match(handler, /x-admin-token/i, "reads the admin console's X-Admin-Token header");
assert.match(handler, /action === "is-revoked"[\s\S]{0,400}?return json\(200, \{ revoked \}\)/, "is-revoked answers before the admin-token gate (public, content-blind)");
// is-revoked block appears BEFORE the admin-token gate (the env read, not the doc comment).
assert.ok(handler.indexOf('action === "is-revoked"') < handler.indexOf("process.env.SENTINEL_ADMIN_TOKEN"), "public revocation check precedes the admin gate");

// 4 — the whole admin console (and thus this tab) only opens for an admin-tier license (RUN 23e gate).
assert.match(main, /function openAdminConsole\(\)[\s\S]{0,400}?if \(!currentIsAdmin\(\)\)/, "admin console window is admin-tier gated");

console.log("Admin-licenses-tab test passed (nav+view+columns · token-gated actions · masked key · public is-revoked · admin-tier console gate).");
