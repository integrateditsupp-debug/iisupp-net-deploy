// evidence-pack — assembles the one-button RFP evidence pack. PURE: it takes a plain inputs object
// (gathered by the main process from local state + on-disk release artifacts) and returns the set of
// in-archive files plus a manifest. buildZip() turns it into a real .zip. No network, no clock except
// the caller-supplied `nowMs` used to window the audit log.
import { buildZip } from "./zip.mjs";

// The six artifacts an enterprise reviewer expects in the pack. The verifier/test asserts all six.
export const EVIDENCE_ARTIFACTS = [
  "audit-log-30d.json",
  "privacy-snapshot.json",
  "network-capture.json",
  "recipe-registry.json",
  "sbom-lite.json",
  "signed-bundle-hash.json"
];

const DAY_MS = 24 * 60 * 60 * 1000;

function last30dAudit(log, nowMs) {
  const cutoff = nowMs - 30 * DAY_MS;
  return (Array.isArray(log) ? log : []).filter((entry) => {
    const t = Date.parse(entry && entry.ts);
    return Number.isFinite(t) ? t >= cutoff : true; // keep undated entries rather than silently drop
  });
}

/**
 * Assemble the evidence pack.
 * @param {object} inputs {
 *   auditLog, allowedOutboundPaths, networkCapture, recipes, recipeRegistryVersion,
 *   sbom, signedBundleHash, productVersion
 * }
 * @param {object} [opts] { nowMs, dateStamp }
 * @returns {{ files: Array<{name,data}>, manifest: object }}
 */
export function buildEvidencePack(inputs = {}, opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const dateStamp = opts.dateStamp || new Date(nowMs).toISOString().slice(0, 10);

  const auditWindow = last30dAudit(inputs.auditLog, nowMs);

  const artifacts = {
    "audit-log-30d.json": {
      windowDays: 30,
      generatedFor: dateStamp,
      entryCount: auditWindow.length,
      entries: auditWindow
    },
    "privacy-snapshot.json": {
      externalAiCalls: false,
      reasoningMode: "local-symbolic",
      contentBlind: true,
      dataUploadPathsToIisupp: 0,
      allowedOutboundPaths: inputs.allowedOutboundPaths || []
    },
    "network-capture.json": inputs.networkCapture || {
      captured: false,
      note: "No live capture has been run this session; run Privacy verifier → Live capture first."
    },
    "recipe-registry.json": {
      version: inputs.recipeRegistryVersion || inputs.productVersion || "0.0.0",
      recipeCount: (inputs.recipes || []).length,
      recipes: (inputs.recipes || []).map((r) => ({ id: r.id, signal: r.signal, risk: r.risk, mode: r.mode }))
    },
    "sbom-lite.json": inputs.sbom || { format: "sbom-lite", packages: [], note: "SBOM not available." },
    "signed-bundle-hash.json": inputs.signedBundleHash || { note: "No signed-bundle hash available." }
  };

  const files = EVIDENCE_ARTIFACTS.map((name) => ({ name, data: artifacts[name] }));

  const manifest = {
    product: "ARIA Sentinel",
    artifact: "rfp-evidence-pack",
    productVersion: inputs.productVersion || "0.0.0",
    generatedFor: dateStamp,
    artifacts: EVIDENCE_ARTIFACTS,
    note: "Content-blind evidence pack. Contains only symbolic audit entries, counts and hashes — no user content."
  };
  files.push({ name: "manifest.json", data: manifest });

  return { files, manifest };
}

/** Build the evidence pack and return it as a real .zip Buffer. */
export function zipEvidencePack(inputs = {}, opts = {}) {
  const { files } = buildEvidencePack(inputs, opts);
  return buildZip(files);
}

/** The default on-disk filename for a pack generated on a given date stamp (YYYY-MM-DD). */
export function evidenceFileName(dateStamp) {
  return `aria-sentinel-evidence-${dateStamp}.zip`;
}
