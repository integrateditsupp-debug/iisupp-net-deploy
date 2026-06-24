// whats-new — pure logic for the "What's new" modal trigger. Kept out of the renderer/main so the
// version comparison + first-install skip are unit-testable.

// Compare two dotted versions. Returns -1 (a<b), 0 (equal), 1 (a>b). Missing parts read as 0.
export function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * Decide whether to show the "What's new" modal.
 * - Skip on first install (no prior state) — the user has not "upgraded" to anything.
 * - Otherwise show when the last-seen version is strictly older than the current version.
 * @param {object} args { lastSeenVersion, currentVersion, firstRun }
 */
export function shouldShowWhatsNew({ lastSeenVersion, currentVersion, firstRun } = {}) {
  if (firstRun) return false;
  if (!currentVersion) return false;
  if (!lastSeenVersion) return false; // unknown last-seen on an existing install → don't nag
  return compareVersions(lastSeenVersion, currentVersion) < 0;
}
