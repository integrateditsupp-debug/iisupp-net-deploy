#!/usr/bin/env node
// verify-range-bundle.mjs — RUN-AR / AR2. The one command that proves the delivery artefact.
//
// Run from the repo root:  node scripts/verify-range-bundle.mjs
//
// Exits 0 only when the bundle on disk verifies against its manifest AND carries the exact commit
// and tree the tests were green against. Any other outcome exits 1 and names the failure class —
// a bundle that "probably works" is reported as a failure, because an unverified backup is worse
// than a known-missing one.
import { verifyRangeBundle, BUNDLE_FILE, MANIFEST_FILE } from "./lib/range-bundle.mjs";

const res = verifyRangeBundle({ root: process.cwd() });
if (!res.ok) {
  console.error(`BUNDLE NOT VERIFIED — ${res.class}`);
  console.error(`  ${res.detail}`);
  console.error(`  bundle:   ${BUNDLE_FILE}`);
  console.error(`  manifest: ${MANIFEST_FILE}`);
  process.exit(1);
}
console.log(`BUNDLE VERIFIED — ${res.detail}`);
console.log(`  fetch it with:  ${res.manifest.fetchCommand}`);
console.log(`  it needs:       ${res.manifest.basedOn.ref} at ${String(res.manifest.basedOn.sha).slice(0, 12)}`);
