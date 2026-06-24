// patch-management — detect missing Windows + third-party updates. PURE: the version comparison and
// the patch plan are testable; the desktop side runs the scans. Vendor version checks go ONLY to a
// dedicated, pinned allowlist of official version hosts, and they are GET-only (no body, no user
// data) — a separate outbound class from the content-blind telemetry verifier (which stays at 6 hosts,
// unchanged). Installing a patch ALWAYS takes a restore point first and confirms in Manual/Confirmed.
import { compareVersions } from "./whats-new.mjs";

// Official version-check hosts, one per supported vendor. GET-only, version string only.
export const PATCH_VENDOR_ALLOWLIST = {
  chrome: "versionhistory.googleapis.com",
  edge: "edgeupdates.microsoft.com",
  firefox: "product-details.mozilla.org",
  adobe: "armmf.adobe.com",
  zoom: "zoom.us",
  java: "javadl-esd-secure.oracle.com"
};

export const SUPPORTED_VENDORS = Object.keys(PATCH_VENDOR_ALLOWLIST);

export function isVendorHostAllowed(host) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  return Object.values(PATCH_VENDOR_ALLOWLIST).some((a) => h === a || h.endsWith(`.${a}`));
}

// Is an installed version behind the latest? Unknown/garbage versions never report "needs update".
export function patchNeeded(installed, latest) {
  if (!/^\d+(\.\d+)*$/.test(String(installed || "")) || !/^\d+(\.\d+)*$/.test(String(latest || ""))) return false;
  return compareVersions(installed, latest) < 0;
}

/**
 * Build the patch plan from per-vendor {installed, latest} readings (+ Windows update count).
 * @returns {{ signals, requiresRestorePoint, vendors }} — one PATCH.AVAILABLE signal if anything is behind.
 */
export function buildPatchPlan(input = {}) {
  const vendors = [];
  for (const v of SUPPORTED_VENDORS) {
    const reading = (input.vendors && input.vendors[v]) || null;
    if (reading && patchNeeded(reading.installed, reading.latest)) {
      vendors.push({ vendor: v, installed: reading.installed, latest: reading.latest });
    }
  }
  const windowsMissing = Math.max(0, Number(input.windowsMissing) || 0);
  const anything = vendors.length > 0 || windowsMissing > 0;
  const signals = anything ? [{ signal: "PATCH.AVAILABLE", hint: "patch-available" }] : [];
  return {
    signals,
    windowsMissing,
    vendors,
    // Installing a patch is system-changing → a restore point is mandatory before any install,
    // and it always confirms in Manual/Confirmed (auto only in Autonomous, behind the usual guards).
    requiresRestorePoint: anything
  };
}
