// F4 2026-10-14 — the Windows packaging wrapper (scripts/package-win.mjs) + release-artifact truth
// (scripts/release-artifacts.mjs). No Electron binary, no electron-builder run: every decision the wrapper makes is a
// pure function proven here, and the generated electron-builder config is validated against electron-builder's OWN
// schema (the devDependency already present) so the owner's Windows build cannot fail on a config typo.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  detectSigning, isSigned, artifactBaseName, artifactNameTemplate, artifactNames, parseArtifactName, findDistArtifacts,
  resolveBinaryUrl, parseRepo, hostAdvice, DESKTOP_BINARY_HOSTS, sha256Hex, sha512Base64
} from "../scripts/release-artifacts.mjs";
import {
  ROOT, DEFAULT_TARGETS, GENERATED_CONFIG, buildConfig, electronBuilderArgs, signatureVerdict, verifyDist, reportLines, signingSummary
} from "../scripts/package-win.mjs";
import { assetName } from "../src/shared/ota-release.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// ---- signing detection: the environment decides, never a package.json edit ---------------------------------------
assert.deepEqual(detectSigning({}), { mode: "none", missing: [] });
assert.equal(isSigned(detectSigning({})), false);
assert.deepEqual(detectSigning({ AZURE_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net" }), { mode: "none", missing: ["AZURE_SIGNING_ACCOUNT", "AZURE_SIGNING_PROFILE"] }, "a partial Azure setup names what is missing");
const azure = detectSigning({ AZURE_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net ", AZURE_SIGNING_ACCOUNT: "acct", AZURE_SIGNING_PROFILE: "prof", AZURE_SIGNING_PUBLISHER: "CN=Integrated IT Support Inc.", AZURE_TENANT_ID: "t", AZURE_CLIENT_ID: "c", AZURE_CLIENT_SECRET: "s" });
assert.equal(azure.mode, "azure");
assert.equal(azure.endpoint, "https://eus.codesigning.azure.net", "trimmed");
assert.equal(azure.credentialsInEnv, true);
assert.equal(detectSigning({ AZURE_SIGNING_ENDPOINT: "e", AZURE_SIGNING_ACCOUNT: "a", AZURE_SIGNING_PROFILE: "p" }).credentialsInEnv, false, "az login is a valid credential source the env cannot see");
assert.deepEqual(detectSigning({ CSC_LINK: "C:\\cert.pfx", CSC_KEY_PASSWORD: "x" }), { mode: "pfx", passwordInEnv: true });
assert.deepEqual(detectSigning({ WIN_CSC_LINK: "C:\\cert.pfx" }), { mode: "pfx", passwordInEnv: false });
assert.deepEqual(detectSigning({ SIGN_CERT_SUBJECT: "Integrated IT Support Inc." }), { mode: "store", subject: "Integrated IT Support Inc.", sha1: null });
assert.deepEqual(detectSigning({ SIGN_CERT_SHA1: "ABC" }), { mode: "store", subject: null, sha1: "ABC" });
assert.equal(detectSigning({ AZURE_SIGNING_ENDPOINT: "e", AZURE_SIGNING_ACCOUNT: "a", AZURE_SIGNING_PROFILE: "p", CSC_LINK: "x" }).mode, "azure", "azure wins when both are set (electron-builder refuses both option blocks)");
assert.equal(detectSigning({ CSC_LINK: "   " }).mode, "none", "blank values do not count");
assert.match(signingSummary(detectSigning({})), /UNSIGNED build.*SmartScreen will warn/);
assert.match(signingSummary(azure), /SIGNED build via Azure Trusted Signing/);

// ---- artifact names say whether the build is signed ------------------------------------------------------------
assert.equal(artifactBaseName("0.2.1", false), "ARIA-Sentinel-0.2.1-unsigned");
assert.equal(artifactBaseName("0.2.1", true), "ARIA-Sentinel-0.2.1-setup");
assert.throws(() => artifactBaseName("nope", true), /bad version/);
assert.equal(artifactNameTemplate(false), "ARIA-Sentinel-${version}-unsigned.${ext}");
assert.equal(artifactNameTemplate(true), "ARIA-Sentinel-${version}-setup.${ext}");
assert.equal(artifactNames("0.2.1", false).exe, assetName("0.2.1"), "the unsigned name is the historical ota-release assetName (Rule 15)");
assert.deepEqual(artifactNames("0.2.1", true), { exe: "ARIA-Sentinel-0.2.1-setup.exe", blockmap: "ARIA-Sentinel-0.2.1-setup.exe.blockmap", msi: "ARIA-Sentinel-0.2.1-setup.msi", yml: "latest.yml" });
assert.deepEqual(parseArtifactName("ARIA-Sentinel-0.2.1-setup.msi"), { version: "0.2.1", signed: true, kind: "msi" });
assert.deepEqual(parseArtifactName("ARIA-Sentinel-0.2.1-unsigned.exe"), { version: "0.2.1", signed: false, kind: "exe" });
assert.equal(parseArtifactName("ARIA-Sentinel-0.2.1-signed.exe"), null, "only the two honest suffixes parse");
assert.equal(pkg.build.win.artifactName, "ARIA-Sentinel-${version}-unsigned.${ext}", "package.json's own default is the UNSIGNED name — a direct electron-builder run can never produce a signed-looking file");
assert.equal(pkg.build.win.signExecutable, false, "…and never attempts to sign");
assert.deepEqual(pkg.build.win.target, ["nsis", "msi"], "both installer types");
assert.equal(pkg.build.nsis.oneClick, false);
assert.equal(pkg.build.nsis.perMachine, false, "NSIS is per-user (no admin needed)");
assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true);
assert.equal(pkg.build.msi.perMachine, true, "MSI is per-machine (Intune/SCCM)");
assert.match(pkg.build.msi.upgradeCode, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "a fixed UpgradeCode makes a newer MSI an in-place upgrade");
assert.equal(pkg.scripts["package:win"], "node scripts/package-win.mjs", "package:win IS the wrapper");
assert.equal(pkg.scripts["package:win:verify"], "node scripts/package-win.mjs --verify-only");

// ---- dist resolution prefers the signed artifact and never renames ----------------------------------------------
const fakeFs = (present) => ({ existsSync: (p) => present.includes(path.basename(p)) });
let found = findDistArtifacts("/d", "0.2.1", fakeFs(["ARIA-Sentinel-0.2.1-unsigned.exe", "ARIA-Sentinel-0.2.1-unsigned.msi"]));
assert.equal(found.signed, false); assert.equal(found.name, "ARIA-Sentinel-0.2.1-unsigned.exe"); assert.ok(found.msi); assert.equal(found.blockmap, null);
found = findDistArtifacts("/d", "0.2.1", fakeFs(["ARIA-Sentinel-0.2.1-unsigned.exe", "ARIA-Sentinel-0.2.1-setup.exe", "ARIA-Sentinel-0.2.1-setup.exe.blockmap"]));
assert.equal(found.signed, true, "signed wins when both exist"); assert.ok(found.blockmap);
found = findDistArtifacts("/d", "0.2.1", fakeFs([]));
assert.deepEqual(found, { exe: null, msi: null, signed: null, name: null, blockmap: null });

// ---- the generated electron-builder config ------------------------------------------------------------------------
const unsignedCfg = buildConfig({ pkg, signing: detectSigning({}) });
assert.equal(unsignedCfg.win.artifactName, "ARIA-Sentinel-${version}-unsigned.${ext}");
assert.equal(unsignedCfg.win.signExecutable, false);
assert.equal(unsignedCfg.forceCodeSigning, undefined);
assert.equal(unsignedCfg.win.azureSignOptions, undefined);
assert.deepEqual(unsignedCfg.win.target, [...DEFAULT_TARGETS]);
assert.deepEqual(unsignedCfg.files, pkg.build.files, "the allow-list is carried verbatim");
assert.ok(unsignedCfg.extraResources.some((e) => e && /vosk-model/.test(String(e.from || ""))), "voice model ships when present");
assert.equal(pkg.build.win.target.length, 2); // untouched source
const azureCfg = buildConfig({ pkg, signing: azure });
assert.equal(azureCfg.win.artifactName, "ARIA-Sentinel-${version}-setup.${ext}");
assert.equal(azureCfg.win.signExecutable, true);
assert.equal(azureCfg.forceCodeSigning, true, "a signing failure FAILS the build instead of shipping unsigned under a signed name");
assert.deepEqual(azureCfg.win.azureSignOptions, { endpoint: "https://eus.codesigning.azure.net", codeSigningAccountName: "acct", certificateProfileName: "prof", publisherName: "CN=Integrated IT Support Inc." });
assert.equal(azureCfg.win.signtoolOptions, undefined);
const pfxCfg = buildConfig({ pkg, signing: detectSigning({ CSC_LINK: "c.pfx", CSC_KEY_PASSWORD: "p" }) });
assert.equal(pfxCfg.win.artifactName, "ARIA-Sentinel-${version}-setup.${ext}");
assert.equal(pfxCfg.forceCodeSigning, true);
assert.equal(pfxCfg.win.azureSignOptions, undefined, "PFX needs no config block — electron-builder reads CSC_LINK itself");
assert.equal(JSON.stringify(pfxCfg).includes("p\""), false, "the password never lands in the config file");
const storeCfg = buildConfig({ pkg, signing: detectSigning({ SIGN_CERT_SUBJECT: "Integrated IT Support Inc." }) });
assert.equal(storeCfg.win.signtoolOptions.certificateSubjectName, "Integrated IT Support Inc.");
assert.equal(storeCfg.win.signtoolOptions.rfc3161TimeStampServer, "http://timestamp.digicert.com");
const noVoice = buildConfig({ pkg, signing: detectSigning({}), voskPresent: false });
assert.ok(!noVoice.extraResources.some((e) => e && /vosk-model/.test(String(e.from || ""))), "a missing voice model is dropped (the mic hides) instead of failing the build or shipping an empty folder");
assert.ok(noVoice.extraResources.some((e) => String(e).includes("admin-console")), "the admin console still ships");
const nsisOnly = buildConfig({ pkg, signing: detectSigning({}), targets: ["nsis"] });
assert.deepEqual(nsisOnly.win.target, ["nsis"]);
const args = electronBuilderArgs({ configPath: "/x/dist/electron-builder.generated.json", cliPath: "/x/node_modules/electron-builder/cli.js" });
assert.deepEqual(args, ["/x/node_modules/electron-builder/cli.js", "--win", "--config", "/x/dist/electron-builder.generated.json", "--publish", "never"], "the locally installed CLI, an explicit config, never publishes from the build step");
assert.equal(GENERATED_CONFIG, "electron-builder.generated.json");

// electron-builder's own schema validation of every variant (the devDependency is present; a typo here would only
// surface on the owner's Windows machine otherwise).
const require = createRequire(import.meta.url);
let validateConfiguration = null;
try { ({ validateConfiguration } = require("app-builder-lib/out/util/config/config.js")); } catch { validateConfiguration = null; }
if (validateConfiguration) {
  const quiet = { isEnabled: false, add() {} };
  for (const [name, cfg] of [["unsigned", unsignedCfg], ["azure", azureCfg], ["pfx", pfxCfg], ["store", storeCfg], ["no-voice", noVoice], ["nsis-only", nsisOnly]]) {
    await validateConfiguration(JSON.parse(JSON.stringify(cfg)), quiet).then(() => {}, (e) => assert.fail(`${name} config fails electron-builder's schema: ${e.message}`));
  }
  // The validator really validates: an unknown key is refused.
  await validateConfiguration({ ...JSON.parse(JSON.stringify(unsignedCfg)), win: { ...unsignedCfg.win, notARealKey: 1 } }, quiet)
    .then(() => assert.fail("an unknown win key must be refused"), () => {});
} else {
  console.log("  (app-builder-lib not resolvable — schema validation skipped; the config shapes were still asserted above)");
}

// ---- the signature verdict is real-or-"not verified", never a guess ----------------------------------------------
assert.deepEqual(signatureVerdict({ expectedSigned: false, authenticode: null, signtool: null }).signed, null, "off-Windows nothing is claimed");
assert.match(signatureVerdict({ expectedSigned: true, authenticode: null, signtool: null }).verdict, /NOT VERIFIED/);
assert.equal(signatureVerdict({ expectedSigned: true, authenticode: { status: "Valid", signer: "CN=Integrated IT Support Inc." }, signtool: null }).signed, true);
assert.match(signatureVerdict({ expectedSigned: true, authenticode: { status: "Valid", signer: "CN=Integrated IT Support Inc." }, signtool: null }).verdict, /SIGNED \(CN=Integrated IT Support Inc\.\)/);
assert.equal(signatureVerdict({ expectedSigned: false, authenticode: { status: "NotSigned", signer: "" }, signtool: null }).signed, false);
assert.match(signatureVerdict({ expectedSigned: false, authenticode: { status: "NotSigned", signer: "" }, signtool: null }).verdict, /SmartScreen will warn/);
assert.match(signatureVerdict({ expectedSigned: true, authenticode: { status: "NotSigned", signer: "" }, signtool: null }).verdict, /do not publish/);
assert.equal(signatureVerdict({ expectedSigned: true, authenticode: { status: "HashMismatch", signer: "" }, signtool: { ok: true, output: "" } }).signed, true, "signtool success counts");

// ---- verifyDist on a fake dist: facts (size, sha256, sha512) + problems ---------------------------------------------
const buf = Buffer.from("not really an installer");
const mkFs = (names) => ({
  existsSync: (p) => names.includes(path.basename(p)),
  readFileSync: (p) => { if (!names.includes(path.basename(p))) throw new Error("ENOENT"); return buf; }
});
let rep = verifyDist({ version: "0.2.1", signing: detectSigning({}), distDir: "/d", fsImpl: mkFs(["ARIA-Sentinel-0.2.1-unsigned.exe", "ARIA-Sentinel-0.2.1-unsigned.msi", "latest.yml"]) });
assert.equal(rep.ok, true);
assert.equal(rep.artifacts.length, 2);
assert.equal(rep.artifacts[0].sha256, sha256Hex(buf));
assert.equal(rep.artifacts[0].sha512, sha512Base64(buf));
assert.equal(rep.artifacts[0].bytes, buf.length);
assert.equal(rep.latestYml, path.join("/d", "latest.yml"));
assert.equal(rep.signed, false);
const lines = reportLines(rep);
assert.ok(lines.some((l) => /sha256\s+[0-9a-f]{64}/.test(l)), "the report prints the SHA-256");
assert.ok(lines.some((l) => /RESULT: OK/.test(l)));
assert.ok(lines.some((l) => /publish-manifest\.mjs 0\.2\.1/.test(l)), "the next step is printed with the version");
assert.ok(lines.some((l) => /UNSIGNED pilot build/.test(l)), "an unsigned build is called unsigned in the next steps");
rep = verifyDist({ version: "0.2.1", signing: detectSigning({}), distDir: "/d", fsImpl: mkFs([]) });
assert.equal(rep.ok, false);
assert.match(rep.problems[0], /no installer for 0\.2\.1/);
assert.ok(reportLines(rep).some((l) => /RESULT: FAILED/.test(l)));
rep = verifyDist({ version: "0.2.1", signing: azure, distDir: "/d", fsImpl: mkFs(["ARIA-Sentinel-0.2.1-unsigned.exe"]) });
assert.equal(rep.ok, false, "signing requested but only the unsigned artifact exists → not publishable");
assert.match(rep.problems.join("\n"), /signing was requested but only the UNSIGNED artifact exists/);

// ---- where the binary lives: explicit https, else a GitHub Release; hosts outside the allow-list are named ------------
assert.deepEqual(resolveBinaryUrl({ version: "0.2.1", artifact: "ARIA-Sentinel-0.2.1-unsigned.exe" }),
  { url: "https://github.com/integrateditsupp-debug/iisupp-net-deploy/releases/download/sentinel-v0.2.1/ARIA-Sentinel-0.2.1-unsigned.exe", host: "github.com", source: "github-release", owner: "integrateditsupp-debug", repo: "iisupp-net-deploy" });
assert.equal(resolveBinaryUrl({ version: "0.2.1", artifact: "ARIA-Sentinel-0.2.1-setup.exe", releaseRepo: "integrateditsupp-debug/aria-sentinel-releases" }).url,
  "https://github.com/integrateditsupp-debug/aria-sentinel-releases/releases/download/sentinel-v0.2.1/ARIA-Sentinel-0.2.1-setup.exe", "GITHUB_RELEASE_REPO moves the release to a public releases-only repo");
assert.deepEqual(resolveBinaryUrl({ version: "0.2.1", artifact: "x", explicitUrl: "https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.1-setup.exe" }),
  { url: "https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.1-setup.exe", host: "download.iisupp.net", source: "explicit" });
assert.throws(() => resolveBinaryUrl({ version: "0.2.1", artifact: "x", explicitUrl: "http://download.iisupp.net/x.exe" }), /must be https/);
assert.throws(() => resolveBinaryUrl({ version: "0.2.1", artifact: "x", explicitUrl: "https://user:pw@download.iisupp.net/x.exe" }), /credentials/);
assert.throws(() => resolveBinaryUrl({ version: "0.2.1", artifact: "x", explicitUrl: "not a url" }), /not a URL/);
assert.throws(() => parseRepo("bad repo string"), /owner\/repo/);
assert.deepEqual(DESKTOP_BINARY_HOSTS, ["iisupp.net", "download.iisupp.net"]);
assert.equal(hostAdvice("download.iisupp.net").ok, true);
assert.equal(hostAdvice("github.com").ok, false);
assert.match(hostAdvice("github.com").note, /SENTINEL_UPDATE_HOSTS="github\.com"/, "the exact Netlify env the server needs");
assert.match(hostAdvice("github.com").note, /CAPTURE_HOST_ALLOWLIST/, "the exact desktop allow-list the main-process lane must extend");

console.log("package-win test passed (signing from env: none/azure/pfx/store · honest artifact names · generated config validated by electron-builder's schema · verify: sha256/sha512/signature verdict/problems · binary host advice).");
