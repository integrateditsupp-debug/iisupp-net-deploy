// F4 2026-10-14 — the ONE Windows packaging command (`npm run package:win`), self-verifying and honest.
//
//   node scripts/package-win.mjs                 build: allow-list check → voice model → electron-builder (nsis + msi)
//                                                → verify dist (paths, SHA-256, signed/unsigned verdict) → dist/RELEASE-<v>.json
//   node scripts/package-win.mjs --verify-only   only inspect dist/ and print the verdict (what build-installer.bat shows)
//   node scripts/package-win.mjs --print-config  print the generated electron-builder config + command, build nothing
//                                                (REVIEW P2-11: no voice-model download, nothing written to dist/)
//   flags: --nsis-only (skip the MSI target) · --no-voice (skip the Vosk model fetch) · --skip-allowlist-check
//
// Signing is decided by the ENVIRONMENT, never by editing package.json:
//   Azure Trusted Signing  AZURE_SIGNING_ENDPOINT + AZURE_SIGNING_ACCOUNT + AZURE_SIGNING_PROFILE (+ AZURE_SIGNING_PUBLISHER,
//                          credentials via AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET or `az login`)
//   PFX / PKCS#12          CSC_LINK (path, https URL or base64) + CSC_KEY_PASSWORD (electron-builder reads these natively)
//   Store / USB token      SIGN_CERT_SUBJECT="Integrated IT Support Inc." or SIGN_CERT_SHA1=<thumbprint> (signtool picks
//                          the cert from the Windows certificate store — how OV/EV certs are delivered since mid-2023)
// With a signing identity the SAME command sets forceCodeSigning (a signing failure fails the build — never a silent
// unsigned fallback) and names the artifact ARIA-Sentinel-<v>-setup.exe; without one it names it
// ARIA-Sentinel-<v>-unsigned.exe and says "SmartScreen will warn". docs/SIGNING.md has the owner steps.
//
// No new dependency: the config is package.json `build` + computed overrides, written to dist/ and handed to the
// locally installed electron-builder CLI through --config (electron-builder loads that file in place of package.json's
// build block; nothing here is a wildcard). The Electron binary and WiX are downloaded by electron-builder itself on the
// build machine — this script cannot and does not fake a build where it cannot run.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeReachable, diffBuildFiles, driftCount } from "./customer-build-manifest.mjs";
import { VOSK_EXIT } from "./fetch-vosk-model.mjs";
import {
  detectSigning, isSigned, artifactNameTemplate, artifactNames, findDistArtifacts, sha256Hex, sha512Base64
} from "./release-artifacts.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = path.join(ROOT, "dist");
export const VOSK_MODEL_DIR = path.join(ROOT, "resources", "models", "vosk-model-small-en-us");
export const GENERATED_CONFIG = "electron-builder.generated.json";
export const DEFAULT_TARGETS = Object.freeze(["nsis", "msi"]);

/** Human line for the signing state — printed by the build and by build-installer.bat. */
export function signingSummary(signing) {
  if (signing.mode === "azure") return `SIGNED build via Azure Trusted Signing (${signing.account} / ${signing.profile}${signing.credentialsInEnv ? "" : "; credentials from az login / managed identity"})`;
  if (signing.mode === "pfx") return `SIGNED build via PFX certificate (CSC_LINK${signing.passwordInEnv ? "" : " — no CSC_KEY_PASSWORD in env"})`;
  if (signing.mode === "store") return `SIGNED build via a certificate in the Windows store / USB token (${signing.subject ? `subject "${signing.subject}"` : `sha1 ${signing.sha1}`})`;
  const tail = signing.missing && signing.missing.length ? ` (Azure setup incomplete — missing ${signing.missing.join(", ")})` : "";
  return `UNSIGNED build — no signing identity in the environment; Windows SmartScreen will warn on install${tail}. See docs/SIGNING.md.`;
}

/**
 * The electron-builder config for this build: package.json `build` + the signing/artifact/voice decisions. PURE.
 * `voskPresent=false` drops the Vosk extraResource (the mic hides honestly instead of electron-builder dying on a
 * missing folder or shipping an empty one that would show a microphone that cannot hear).
 */
export function buildConfig({ pkg, signing, voskPresent = true, targets = DEFAULT_TARGETS } = {}) {
  const base = JSON.parse(JSON.stringify((pkg && pkg.build) || {}));
  const signed = isSigned(signing);
  base.win = { ...(base.win || {}) };
  base.win.target = [...targets];
  base.win.artifactName = artifactNameTemplate(signed);
  delete base.win.azureSignOptions;
  delete base.win.signtoolOptions;
  if (signed) {
    base.win.signExecutable = true;
    base.forceCodeSigning = true; // a signing failure fails the build — never an unsigned file under a signed name
    if (signing.mode === "azure") {
      base.win.azureSignOptions = {
        endpoint: signing.endpoint,
        codeSigningAccountName: signing.account,
        certificateProfileName: signing.profile,
        ...(signing.publisher ? { publisherName: signing.publisher } : {})
      };
    } else if (signing.mode === "store") {
      base.win.signtoolOptions = {
        ...(signing.subject ? { certificateSubjectName: signing.subject } : {}),
        ...(signing.sha1 ? { certificateSha1: signing.sha1 } : {}),
        rfc3161TimeStampServer: "http://timestamp.digicert.com"
      };
    }
  } else {
    base.win.signExecutable = false; // icon + metadata are still applied; no signing attempt, no signed-looking name
    delete base.forceCodeSigning;
  }
  if (!voskPresent && Array.isArray(base.extraResources)) {
    base.extraResources = base.extraResources.filter((e) => !(e && typeof e === "object" && /vosk-model/.test(String(e.from || ""))));
  }
  return base;
}

/** The exact CLI invocation (argv for `node`), with the config file path. PURE. */
export function electronBuilderArgs({ configPath, cliPath = path.join(ROOT, "node_modules", "electron-builder", "cli.js") } = {}) {
  return [cliPath, "--win", "--config", configPath, "--publish", "never"];
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false, ...opts });
  return r.status === null ? 1 : r.status;
}

/** Authenticode status of a file on Windows via PowerShell (built in everywhere); null off-Windows / on failure. */
export function authenticodeStatus(filePath) {
  if (process.platform !== "win32") return null;
  const cmd = `$s = Get-AuthenticodeSignature -LiteralPath '${filePath.replace(/'/g, "''")}'; ` +
    "Write-Output ($s.Status.ToString() + '|' + ($(if ($s.SignerCertificate) { $s.SignerCertificate.Subject } else { '' })))";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const [status, signer] = String(r.stdout || "").trim().split("|");
  return { status: status || "Unknown", signer: signer || "" };
}

/** `signtool verify /pa` when signtool is on PATH (Windows SDK); null when it is not installed. */
export function signtoolVerify(filePath) {
  if (process.platform !== "win32") return null;
  const where = spawnSync("where.exe", ["signtool"], { encoding: "utf8" });
  if (where.status !== 0) return null;
  const r = spawnSync("signtool", ["verify", "/pa", "/q", filePath], { encoding: "utf8" });
  return { ok: r.status === 0, output: String(r.stdout || r.stderr || "").trim() };
}

/** Classify what verification found. PURE: { signed: true|false|null, verdict } — null = could not verify here. */
export function signatureVerdict({ expectedSigned, authenticode, signtool }) {
  if (!authenticode && !signtool) {
    return { signed: null, verdict: expectedSigned ? "signing requested but NOT VERIFIED on this machine" : "not verified on this machine (unsigned build expected)" };
  }
  const valid = (authenticode && authenticode.status === "Valid") || (signtool && signtool.ok);
  if (valid) return { signed: true, verdict: `SIGNED (${authenticode && authenticode.signer ? authenticode.signer : "signtool verified"})` };
  const st = authenticode ? authenticode.status : "unknown";
  return { signed: false, verdict: expectedSigned ? `NOT SIGNED (${st}) — signing was requested; do not publish this file` : `NOT SIGNED (${st}) — SmartScreen will warn` };
}

/** Inspect dist for `version`: paths, bytes, SHA-256, SHA-512 (electron-updater), signature verdict. */
export function verifyDist({ version, signing, distDir = DIST, fsImpl = fs } = {}) {
  const found = findDistArtifacts(distDir, version, fsImpl);
  const expectedSigned = isSigned(signing);
  const artifacts = [];
  for (const p of [found.exe, found.msi]) {
    if (!p) continue;
    const buf = fsImpl.readFileSync(p);
    const auth = authenticodeStatus(p);
    const st = signtoolVerify(p);
    const verdict = signatureVerdict({ expectedSigned, authenticode: auth, signtool: st });
    artifacts.push({ path: p, name: path.basename(p), bytes: buf.length, sha256: sha256Hex(buf), sha512: sha512Base64(buf), signature: verdict, authenticode: auth, signtool: st });
  }
  const problems = [];
  if (!found.exe) problems.push(`no installer for ${version} in ${distDir} (expected ${artifactNames(version, expectedSigned).exe})`);
  if (found.exe && expectedSigned && found.signed === false) problems.push(`signing was requested but only the UNSIGNED artifact exists (${found.name})`);
  for (const a of artifacts) if (a.signature.signed === false && expectedSigned) problems.push(`${a.name}: ${a.signature.verdict}`);
  const yml = path.join(distDir, "latest.yml");
  return {
    version,
    signingMode: signing.mode,
    signed: found.signed,
    artifacts,
    latestYml: fsImpl.existsSync(yml) ? yml : null,
    blockmap: found.blockmap,
    problems,
    ok: problems.length === 0
  };
}

/** The lines a person reads after a build (also what build-installer.bat echoes). PURE. */
export function reportLines(report, { base = "https://iisupp.net" } = {}) {
  const L = [];
  L.push(`ARIA Sentinel ${report.version} — build verification`);
  for (const a of report.artifacts) {
    L.push(`  ${a.name}`);
    L.push(`    path    ${a.path}`);
    L.push(`    size    ${a.bytes.toLocaleString("en-US")} bytes`);
    L.push(`    sha256  ${a.sha256}`);
    L.push(`    sha512  ${a.sha512}`);
    L.push(`    signed  ${a.signature.verdict}`);
  }
  if (report.latestYml) L.push(`  latest.yml  ${report.latestYml}`);
  if (report.problems.length) { L.push("  PROBLEMS:"); for (const p of report.problems) L.push(`    - ${p}`); }
  L.push(report.ok ? "  RESULT: OK" : "  RESULT: FAILED — fix the problems above before publishing");
  if (report.ok) {
    L.push("  NEXT:");
    L.push(`    1. publish the installer:  node scripts/publish-github-release.mjs ${report.version}   (or upload it to your own https host)`);
    L.push(`    2. publish the manifest:   node scripts/publish-manifest.mjs ${report.version} [--url https://<host>/<file>]   (needs SENTINEL_ADMIN_TOKEN; POSTs to ${base})`);
    L.push("    3. or run ota-build.bat, which does 1 + 2 after its own build");
    if (report.signed === false) L.push("    note: this is an UNSIGNED pilot build — customers will see a SmartScreen warning; see docs/SIGNING.md");
  }
  return L;
}

const voskModelPresent = () => fs.existsSync(VOSK_MODEL_DIR) && fs.readdirSync(VOSK_MODEL_DIR).length > 0;

/**
 * The build. `io` exists for tests (REVIEW P2-11): run / writeFile / mkdir / log / error / voskPresent replace the real
 * process spawn, file writes, console and the model probe — so a suite can prove --print-config downloads and writes
 * nothing, and that an unpinned voice model stops the build, without ever touching the network.
 */
export function main(argv = process.argv.slice(2), io = {}) {
  const runImpl = io.run || run;
  const writeFile = io.writeFile || ((p, t) => fs.writeFileSync(p, t));
  const mkdir = io.mkdir || ((p) => fs.mkdirSync(p, { recursive: true }));
  const log = io.log || ((...a) => console.log(...a));
  const error = io.error || ((...a) => console.error(...a));
  const voskPresentNow = typeof io.voskPresent === "function" ? io.voskPresent : voskModelPresent;
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const version = pkg.version;
  const signing = detectSigning(io.env || process.env);
  const targets = argv.includes("--nsis-only") ? ["nsis"] : [...DEFAULT_TARGETS];
  const voskPresent = voskPresentNow();

  if (argv.includes("--verify-only")) {
    const report = verifyDist({ version, signing });
    mkdir(DIST);
    writeFile(path.join(DIST, `RELEASE-${version}.json`), JSON.stringify(report, null, 2) + "\n");
    log(reportLines(report).join("\n"));
    return report.ok ? 0 : 1;
  }

  log(`[package-win] ARIA Sentinel ${version} · ${signingSummary(signing)}`);

  if (!argv.includes("--skip-allowlist-check")) {
    const graph = computeReachable(ROOT);
    const d = diffBuildFiles(pkg, graph);
    if (driftCount(d)) {
      error("[package-win] REFUSED: package.json build.files does not match the customer import graph (or names another version's release notes).");
      error("  run: node scripts/customer-build-manifest.mjs --check   (then --write to repair)");
      return 2;
    }
    log(`[package-win] allow-list OK: ${graph.reachable.length} reachable src files ship, ${graph.unreachable.length} stay out.`);
  }

  const configPath = path.join(DIST, GENERATED_CONFIG);
  if (argv.includes("--print-config")) {
    // REVIEW P2-11 — print only: the config for the model state as it is now (no download), nothing written to dist/.
    const config = buildConfig({ pkg, signing, voskPresent, targets });
    log(JSON.stringify(config, null, 2));
    log(`command: ${process.execPath} ${electronBuilderArgs({ configPath }).join(" ")}`);
    log(`(print only — a build writes this config to ${path.relative(ROOT, configPath)}${voskPresent || argv.includes("--no-voice") ? "" : " and first fetches the voice model, which needs a pinned SHA-256"}; nothing was downloaded or written)`);
    return 0;
  }

  if (!argv.includes("--no-voice") && !voskPresent) {
    log("[package-win] fetching the on-device voice model (one-time, ~40 MB; checked against its pinned SHA-256) …");
    const fetched = runImpl(process.execPath, [path.join(ROOT, "scripts", "fetch-vosk-model.mjs")]);
    if (fetched === VOSK_EXIT.NO_PIN || fetched === VOSK_EXIT.MISMATCH) {
      error(`[package-win] REFUSED: the voice model ${fetched === VOSK_EXIT.NO_PIN ? "has no pinned SHA-256" : "did not match its pinned SHA-256"} (see above) — nothing unverified goes into the installer.`);
      error("  pin it (VOSK_MODEL_SHA256=<64 hex> or scripts/vosk-model.sha256), or build without on-device voice: --no-voice");
      return 3;
    }
  }
  const voskNow = voskPresentNow();
  if (!voskNow) log("[package-win] voice model absent — building WITHOUT on-device voice (the microphone hides; typing works).");

  const config = buildConfig({ pkg, signing, voskPresent: voskNow, targets });
  mkdir(DIST);
  writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  const args = electronBuilderArgs({ configPath });

  log(`[package-win] electron-builder --win ${targets.join(" ")} (config: ${path.relative(ROOT, configPath)})`);
  const status = runImpl(process.execPath, args);
  if (status !== 0) {
    error(`[package-win] electron-builder exited ${status}. Nothing was verified; nothing is publishable.`);
    return status;
  }
  const report = verifyDist({ version, signing });
  writeFile(path.join(DIST, `RELEASE-${version}.json`), JSON.stringify(report, null, 2) + "\n");
  log(reportLines(report).join("\n"));
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
