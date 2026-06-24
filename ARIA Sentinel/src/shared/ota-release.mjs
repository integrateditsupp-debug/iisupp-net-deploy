// RUN 23c — pure OTA-release helpers shared by the publish scripts (publish-github-release / publish-
// manifest), version-bump, and (by pattern) the admin-console 1-click publish button. No I/O — semver,
// release-tag, GitHub asset URL, and the version record posted to /aria-sentinel-update-publish.
// 🔒 R11 — these only ever touch version strings + the signed dist .exe name; never a user path.

export const GITHUB_OWNER = "integrateditsupp-debug";
export const GITHUB_REPO = "iisupp-net-deploy";

/** Strict semver guard so a bad version can never be written back to package.json. */
export function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v || ""));
}

/** Bump the patch component: "0.1.0" → "0.1.1". Throws on a non-semver input (fail-closed). */
export function bumpPatch(version) {
  if (!isSemver(version)) throw new Error(`bumpPatch: "${version}" is not a valid x.y.z version`);
  const [maj, min, pat] = String(version).split(".").map(Number);
  return `${maj}.${min}.${pat + 1}`;
}

/**
 * Ahmad can skip the auto-bump for a hotfix retry by putting [no-bump] in the commit SUBJECT line.
 * RUN 23e hotfix — only the first line counts; a [no-bump] mention buried in the body (e.g. feature
 * documentation) must NOT silently skip the bump (that bug broke the RUN 23c OTA test).
 */
export function shouldBump(commitMessage) {
  const subject = String(commitMessage || "").split("\n")[0];
  return !/\[no-bump\]/i.test(subject);
}

/** Sentinel-only release tag so we never collide with other iisupp releases. */
export function releaseTag(version) { return `sentinel-v${version}`; }

/** The unsigned customer artifact name electron-builder produces. */
export function assetName(version) { return `ARIA-Sentinel-${version}-unsigned.exe`; }

/** The GitHub Releases download URL clients pull the .exe from (replaces the broken Netlify static path). */
export function githubAssetUrl(version, owner = GITHUB_OWNER, repo = GITHUB_REPO) {
  return `https://github.com/${owner}/${repo}/releases/download/${releaseTag(version)}/${assetName(version)}`;
}

/**
 * The version record POSTed to /aria-sentinel-update-publish (and persisted in the Blobs "versions" index).
 * `url` is the new field that points the manifest at GitHub Releases; everything else matches RUN 14/21.
 */
export function buildVersionRecord({ version, sha512, size, owner, repo, releaseNotes = "", mandatory = false, releaseDate } = {}) {
  if (!isSemver(version)) throw new Error(`buildVersionRecord: bad version "${version}"`);
  return {
    version,
    sha512: String(sha512 || ""),
    size: Number(size) || 0,
    url: githubAssetUrl(version, owner, repo),
    release_date: releaseDate || "",
    release_notes: String(releaseNotes || ""),
    mandatory: Boolean(mandatory)
  };
}
