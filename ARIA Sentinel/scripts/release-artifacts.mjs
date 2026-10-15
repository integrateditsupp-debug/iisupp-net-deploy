// F4 2026-10-14 — release-artifact truth shared by package-win.mjs, publish-manifest.mjs, publish-github-release.mjs,
// version-bump.mjs and build-installer.bat. PURE (no I/O unless a fs facade is injected) so tests prove it.
//
// The one rule: the artifact NAME says whether the build is signed. `ARIA-Sentinel-<v>-setup.exe` is produced only
// when a signing identity was present at build time (Azure Trusted Signing or a PFX) and electron-builder was told to
// FAIL rather than fall back; without one the same command produces `ARIA-Sentinel-<v>-unsigned.exe`, so nobody can
// ship an unsigned binary under a signed-looking name (Rule 14). src/shared/ota-release.mjs keeps its historical
// `assetName()` (= the unsigned name) untouched — Rule 15 — and the publishers resolve whichever artifact exists.
import { createHash } from "node:crypto";
import path from "node:path";
import { GITHUB_OWNER, GITHUB_REPO, releaseTag, isSemver } from "../src/shared/ota-release.mjs";

export const PRODUCT_PREFIX = "ARIA-Sentinel";
export const SIGNED_SUFFIX = "setup";
export const UNSIGNED_SUFFIX = "unsigned";

/** Azure Trusted Signing: the three config values electron-builder's azureSignOptions needs. */
export const AZURE_SIGNING_VARS = Object.freeze(["AZURE_SIGNING_ENDPOINT", "AZURE_SIGNING_ACCOUNT", "AZURE_SIGNING_PROFILE"]);
/** Azure credentials the TrustedSigning module resolves (EnvironmentCredential). `az login` on the build PC also works. */
export const AZURE_CREDENTIAL_VARS = Object.freeze(["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"]);
/** PFX / PKCS#12: electron-builder reads these natively (WIN_ prefixed variants win when both are set). */
export const PFX_VARS = Object.freeze(["CSC_LINK", "CSC_KEY_PASSWORD"]);
/** A certificate in the Windows certificate store / on a USB token (how OV/EV certs are issued since mid-2023). */
export const STORE_VARS = Object.freeze(["SIGN_CERT_SUBJECT", "SIGN_CERT_SHA1"]);

/**
 * What signing identity does this environment carry?
 *   { mode: "azure", publisher }  — AZURE_SIGNING_ENDPOINT + _ACCOUNT + _PROFILE present (credentials noted, not required
 *                                   here: `az login` is a valid credential source the env cannot see)
 *   { mode: "pfx" }               — CSC_LINK (or WIN_CSC_LINK) present
 *   { mode: "store" }             — SIGN_CERT_SUBJECT or SIGN_CERT_SHA1 names a cert in the Windows store / on a token
 *   { mode: "none", missing }     — nothing usable; `missing` lists what a PARTIAL Azure setup still lacks
 * Azure wins when several are configured (electron-builder refuses a config that carries both option blocks).
 */
export function detectSigning(env = process.env) {
  const has = (k) => typeof env[k] === "string" && env[k].trim() !== "";
  const azureMissing = AZURE_SIGNING_VARS.filter((k) => !has(k));
  if (azureMissing.length === 0) {
    return {
      mode: "azure",
      endpoint: env.AZURE_SIGNING_ENDPOINT.trim(),
      account: env.AZURE_SIGNING_ACCOUNT.trim(),
      profile: env.AZURE_SIGNING_PROFILE.trim(),
      publisher: has("AZURE_SIGNING_PUBLISHER") ? env.AZURE_SIGNING_PUBLISHER.trim() : null,
      credentialsInEnv: AZURE_CREDENTIAL_VARS.every(has)
    };
  }
  if (has("WIN_CSC_LINK") || has("CSC_LINK")) {
    return { mode: "pfx", passwordInEnv: has("WIN_CSC_KEY_PASSWORD") || has("CSC_KEY_PASSWORD") };
  }
  if (has("SIGN_CERT_SUBJECT") || has("SIGN_CERT_SHA1")) {
    return {
      mode: "store",
      subject: has("SIGN_CERT_SUBJECT") ? env.SIGN_CERT_SUBJECT.trim() : null,
      sha1: has("SIGN_CERT_SHA1") ? env.SIGN_CERT_SHA1.trim() : null
    };
  }
  const partialAzure = azureMissing.length < AZURE_SIGNING_VARS.length;
  return { mode: "none", missing: partialAzure ? azureMissing : [] };
}

export function isSigned(signing) { return Boolean(signing && signing.mode && signing.mode !== "none"); }

/** `ARIA-Sentinel-0.2.1-setup` or `ARIA-Sentinel-0.2.1-unsigned`. */
export function artifactBaseName(version, signed) {
  if (!isSemver(version)) throw new Error(`artifactBaseName: bad version "${version}"`);
  return `${PRODUCT_PREFIX}-${version}-${signed ? SIGNED_SUFFIX : UNSIGNED_SUFFIX}`;
}

/** electron-builder artifactName template for this signing state (the ${version}/${ext} placeholders are its own). */
export function artifactNameTemplate(signed) {
  return `${PRODUCT_PREFIX}-\${version}-${signed ? SIGNED_SUFFIX : UNSIGNED_SUFFIX}.\${ext}`;
}

/** The files one Windows build produces (nsis exe + blockmap, msi, electron-updater feed). */
export function artifactNames(version, signed) {
  const base = artifactBaseName(version, signed);
  return { exe: `${base}.exe`, blockmap: `${base}.exe.blockmap`, msi: `${base}.msi`, yml: "latest.yml" };
}

/** Parse an artifact file name back into { version, signed, kind }. Null when it is not ours. */
export function parseArtifactName(name) {
  const m = String(name || "").match(new RegExp(`^${PRODUCT_PREFIX}-(\\d+\\.\\d+\\.\\d+)-(${SIGNED_SUFFIX}|${UNSIGNED_SUFFIX})\\.(exe|msi)$`));
  if (!m) return null;
  return { version: m[1], signed: m[2] === SIGNED_SUFFIX, kind: m[3] };
}

/**
 * Which artifact of `version` sits in dist? Prefers the signed name. `fsImpl` is a facade { existsSync } so tests need no
 * disk. Returns { exe, msi, signed, name } with nulls when absent.
 */
export function findDistArtifacts(distDir, version, fsImpl) {
  const out = { exe: null, msi: null, signed: null, name: null, blockmap: null };
  for (const signed of [true, false]) {
    const n = artifactNames(version, signed);
    const exe = path.join(distDir, n.exe);
    if (fsImpl.existsSync(exe)) {
      out.exe = exe; out.signed = signed; out.name = n.exe;
      const bm = path.join(distDir, n.blockmap);
      out.blockmap = fsImpl.existsSync(bm) ? bm : null;
      const msi = path.join(distDir, n.msi);
      out.msi = fsImpl.existsSync(msi) ? msi : null;
      return out;
    }
  }
  return out;
}

export function sha256Hex(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
export function sha512Base64(buffer) { return createHash("sha512").update(buffer).digest("base64"); }

/**
 * Where the customer downloads the binary from. Priority: an explicit https URL (SENTINEL_BINARY_URL / --url), else a
 * GitHub Release of `owner/repo` (GITHUB_RELEASE_REPO="owner/repo" overrides the source repo — a PUBLIC releases-only
 * repo keeps downloads working after the source repo goes private). Never http, never a bare host.
 */
export function resolveBinaryUrl({ version, artifact, explicitUrl, releaseRepo } = {}) {
  if (explicitUrl) {
    let u;
    try { u = new URL(String(explicitUrl)); } catch { throw new Error(`binary url is not a URL: ${explicitUrl}`); }
    if (u.protocol !== "https:") throw new Error(`binary url must be https: ${explicitUrl}`);
    if (u.username || u.password) throw new Error("binary url must not carry credentials");
    return { url: u.toString(), host: u.hostname.toLowerCase(), source: "explicit" };
  }
  const [owner, repo] = parseRepo(releaseRepo);
  const url = `https://github.com/${owner}/${repo}/releases/download/${releaseTag(version)}/${artifact}`;
  return { url, host: "github.com", source: "github-release", owner, repo };
}

export function parseRepo(releaseRepo) {
  const s = String(releaseRepo || "").trim();
  if (!s) return [GITHUB_OWNER, GITHUB_REPO];
  const m = s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) throw new Error(`GITHUB_RELEASE_REPO must be "owner/repo", got "${s}"`);
  return [m[1], m[2]];
}

/**
 * The hosts the DESKTOP may reach for a binary today (src/shared/network-capture.mjs CAPTURE_HOST_ALLOWLIST, owned by
 * the main-process lane) and the hosts the deployed publish endpoint accepts by default. A publish to any other host
 * is still allowed here — the owner decides — but it is reported as "needs allow-list change", never silently.
 */
export const DESKTOP_BINARY_HOSTS = Object.freeze(["iisupp.net", "download.iisupp.net"]);

export function hostAdvice(host) {
  const h = String(host || "").toLowerCase();
  if (DESKTOP_BINARY_HOSTS.includes(h)) return { ok: true, note: "host is on the desktop allow-list and the server default" };
  return {
    ok: false,
    note: `host "${h}" is NOT on the desktop's 6-host allow-list (src/shared/network-capture.mjs) nor the server default — ` +
      `set SENTINEL_UPDATE_HOSTS="${h}" on Netlify for the publish to be accepted, and add the host (plus the CDN host its ` +
      `download redirects to) to CAPTURE_HOST_ALLOWLIST with a test before the desktop can fetch it.`
  };
}
