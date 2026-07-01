// RUN-B B3 — HONEST TRUST/SECURITY SURFACE. Locks the moat: no surface may claim a certification we don't
// hold, every security claim maps to a real shipped module/test, and "how ARIA measures itself" ties to the
// real B1/B2 metrics (real-or-empty). Pure node, no electron.
import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  certificationPosture, dataResidency, securityControls, howAriaMeasuresItself, selfAssessment,
  buildTrustSummary, trustPostureText, findOverclaims, assertNoOverclaim, scrubField,
  HELD_CERTIFICATIONS, TRUST_POSTURE_SCHEMA
} from "../src/shared/trust-posture.mjs";
import { DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX } from "../src/shared/roi.mjs";
import { trustPostureHtml } from "../src/renderer/tabs/compliance.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// 1 — certification posture is honest and empty-by-truth.
const cert = certificationPosture();
assert.deepStrictEqual(HELD_CERTIFICATIONS, [], "we hold zero independent certifications");
assert.strictEqual(cert.independentlyCertified, false, "must never claim independent certification");
assert.deepStrictEqual(cert.heldCertifications, [], "held list stays empty");
assert.ok(/not\b/i.test(cert.statement) && /SOC 2/.test(cert.statement), "statement plainly disclaims the certs");
assert.deepStrictEqual(findOverclaims(cert.statement), [], "the honest disclaimer must not trip the guard");

// 2 — over-claim guard: catches affirmative, ignores honest negation.
assert.ok(findOverclaims("We are SOC 2 certified.").includes("soc 2 certified"), "catches an affirmative over-claim");
assert.ok(findOverclaims("marketed as fully compliant and 100% secure").length >= 2, "catches absolute-security claims");
assert.deepStrictEqual(findOverclaims("ARIA is not SOC 2 certified and not HIPAA compliant."), [], "negation is not an over-claim");

// 3 — the assembled buyer surface (data blob AND rendered HTML) is over-claim clean.
assertNoOverclaim(trustPostureText());
const html = trustPostureHtml(buildTrustSummary());
assert.ok(/[<]/.test(html) && html.length > 400, "renders a real buyer-facing block");
assertNoOverclaim(html);

// 4 — every security control maps to a REAL shipped module/test (file must exist on disk).
const controls = securityControls();
assert.ok(controls.length >= 6, "a security-conscious buyer's top controls are covered");
for (const c of controls) {
  assert.ok(c.id && c.claim && c.verifiableBy, "each control names what backs it");
  assert.ok(fs.existsSync(path.join(ROOT, c.verifiableBy)), `verifiableBy must be a real file: ${c.verifiableBy}`);
  assert.deepStrictEqual(findOverclaims(c.claim), [], `control claim honest: ${c.id}`);
}

// 5 — "how ARIA measures itself" ties to the REAL metric code (real-or-empty), not marketing.
const measures = howAriaMeasuresItself();
const deflect = measures.find((m) => /deflection/i.test(m.metric));
const roi = measures.find((m) => /ROI/i.test(m.metric));
assert.ok(/resolved.*÷.*conversations/i.test(deflect.formula), "deflection = resolved ÷ conversations");
assert.ok(/—/.test(deflect.emptyState), "deflection shows an empty-state until real data");
assert.ok(roi.formula.includes(String(DEFAULT_MINUTES_PER_FIX)) && roi.formula.includes(String(DEFAULT_HOURLY_RATE)),
  "ROI copy interpolates the real roi.mjs constants so it can't drift from code");
for (const m of measures) assert.ok(m.emptyState && m.source, "every metric states its empty-state + real source");

// 6 — buildTrustSummary is strictly real-or-empty: null until real events, moves only on real data.
const empty = buildTrustSummary();
assert.strictEqual(empty.schema, TRUST_POSTURE_SCHEMA);
assert.strictEqual(empty.live.deflectionPct, null, "no conversations => null deflection (never a fake %)");
assert.strictEqual(empty.live.hoursSaved, null, "no fixes => null hours (never a seeded ROI)");
assert.strictEqual(empty.live.dollarsSaved, null, "no fixes => null dollars");
const real = buildTrustSummary({ resolutionEvents: [{ outcome: "resolved" }, { outcome: "resolved" }, { outcome: "not-yet" }], fixes: 5 });
assert.ok(real.live.deflectionPct > 0 && real.live.deflectionPct <= 100, "deflection moves on real outcomes");
assert.ok(real.live.hoursSaved > 0 && real.live.dollarsSaved > 0, "ROI moves on real fixes");

// 7 — self-assessment answers the buyer's real security questions, honestly.
const qa = selfAssessment();
const ids = qa.map((x) => x.id);
for (const need of ["data-location", "external-ai", "file-access", "stop-it", "audit-trail", "certifications", "uninstall"]) {
  assert.ok(ids.includes(need), `self-assessment covers: ${need}`);
}
const certQa = qa.find((x) => x.id === "certifications");
assert.deepStrictEqual(findOverclaims(certQa.a), [], "certification answer claims no cert we don't hold");
assert.ok(/no|nothing/i.test(certQa.a), "certification answer is a plain no");

// 8 — R11/privacy scrub keeps private paths off the buyer surface.
assert.ok(!/Private pics and Vids/i.test(scrubField("C:\\Users\\Ahmad\\Private pics and Vids\\x.png")), "private folder scrubbed");
assert.ok(!/Ahmad/.test(scrubField("C:\\Users\\Ahmad\\Documents")), "user home scrubbed");

// 9 — wired end-to-end into the app (main IPC + real signals, preload bridge, compliance tab + renderer + DOM).
const main = read("src/main/main.mjs");
assert.ok(/trust-posture\.mjs/.test(main) && /trustPostureNow/.test(main), "main.mjs imports + builds trust posture");
assert.ok(/sentinel:trust-posture/.test(main), "main.mjs exposes the trust-posture IPC");
assert.ok(/trust:\s*trustPostureNow\(\)/.test(main), "trust posture is fed into the compliance payload");
assert.ok(/trustPosture/.test(read("src/main/preload.cjs")), "preload bridges trustPosture");
const comp = read("src/renderer/tabs/compliance.mjs");
assert.ok(/trust-posture\.mjs/.test(comp) && /export function trustPostureHtml/.test(comp), "compliance tab renders the trust block from the honest source");
assert.ok(/compTrust/.test(read("src/renderer/renderer.js")), "renderer injects the trust block");
assert.ok(/id="compTrust"/.test(read("src/renderer/index.html")), "the compliance tab has a container for it");

console.log("b3-trust-posture (RUN-B B3) test passed (honest cert posture: 0 held, never claims certification we don't hold; over-claim guard locks every surface, negation-aware; 8 security controls each map to a real shipped test/module; 'how ARIA measures itself' ties to real B1 deflection + B2 ROI constants, real-or-empty; self-assessment answers the buyer's security questions honestly; R11-scrubbed; main IPC + real signals + preload + compliance tab + renderer + DOM wired).");
