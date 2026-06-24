// RUN 16 locked rule → RUN 23e single build. There is now ONE build (npm run package:win). The admin
// console ships to EVERYONE via build.extraResources (it only unlocks for an admin-tier license at
// runtime), but the asar `files` allow-list must still exclude tests, fixtures, the design-review
// preview HTMLs and docs so customer machines never carry them.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const files = (pkg.build && pkg.build.files) || [];

// The asar allow-list never pulls in tests / fixtures / design-review / docs.
const FORBIDDEN = ["tests", "fixtures", "design-review", "docs"];
for (const entry of files) {
  for (const f of FORBIDDEN) assert.ok(!entry.includes(f), `app allow-list excludes ${f} (offending: ${entry})`);
}
// admin-console is NOT inside the asar files list (it ships as an extraResource, not app code).
for (const entry of files) assert.ok(!entry.includes("admin-console"), `admin-console is not in the asar files list (offending: ${entry})`);

// RUN 23e — admin console ALWAYS ships via extraResources (single build).
const extra = (pkg.build && pkg.build.extraResources) || [];
assert.ok(extra.some((e) => String(e).includes("admin-console")), "extraResources ships the admin console to every build");

// Exactly ONE Windows build script, and it never sets a build-time admin flag.
const winScript = pkg.scripts["package:win"] || "";
assert.ok(winScript, "package:win exists");
assert.ok(!/IS_ADMIN_BUILD/.test(winScript), "package:win does not set a build-time admin flag");
assert.equal(pkg.scripts["package:win:admin"], undefined, "the separate admin build script is deleted (single build)");

// The allow-list still ships what the customer DOES need (renderer + the bundled extensions).
assert.ok(files.some((f) => f.startsWith("src/")), "build includes src");
assert.ok(files.some((f) => f.includes("chrome-extension")), "build includes the Chrome extension");

console.log("Build-exclusion test passed (RUN 23e single build · admin-console via extraResources · tests/fixtures/design-review/docs excluded · no package:win:admin).");
