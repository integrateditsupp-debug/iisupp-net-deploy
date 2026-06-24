// axis/brain-bridge/vault-reader.mjs — STUB (RUN A · Phase 1 scaffold)
// Purpose: read the brain-shaped vault (aria-vault/) by region + query. AXIS routes a classified
// transcript here to pull the relevant notes (e.g. region "hippocampus" → RULES/STACK/VOICE).
// Read-only. No network. No dependency (uses node:fs at implementation time).

// Region → vault folder (mirror of aria-vault/00_Index/Brain-Map.md). Sub-regions live under their lobe.
export const REGION_FOLDERS = {
  frontal: "01_Frontal", "frontal-iis": "01_Frontal/IIS", "frontal-aria": "01_Frontal/ARIA",
  "frontal-sentinel": "01_Frontal/Sentinel", "frontal-decisions": "09_Decisions",
  hippocampus: "02_Hippocampus", "basal-ganglia": "03_BasalGanglia", "short-term": "04_ShortTerm",
  thalamus: "05_Thalamus", cerebellum: "06_Cerebellum", cortex: "07_Cortex",
  "cortex-frontal": "07_Cortex", "cortex-association": "00_Index", amygdala: "08_Amygdala",
  brainstem: "10_Brainstem", "corpus-callosum": "11_CorpusCallosum", glia: "12_Glia"
};

/**
 * Read notes in a region, ranked by relevance to a query.
 * @param {string} _region one of REGION_FOLDERS keys
 * @param {string} _query the user's spoken question
 * @param {object} _opts { vaultRoot?, limit? }
 * @returns {Promise<Array<{ note: string, region: string, excerpt: string }>>}
 */
export async function readByRegion(_region, _query, _opts = {}) {
  // TODO(phase-1): resolve REGION_FOLDERS[region] under vaultRoot (default ../../aria-vault),
  // read .md files, score by query term overlap (reuse the recipe-style scorer), return top N excerpts.
  throw new Error("AXIS vault-reader: readByRegion not implemented (Phase 1 stub)");
}

/** Read a single note by region + note name. */
export async function readNote(_region, _noteName, _opts = {}) {
  // TODO(phase-1): read aria-vault/<folder>/<noteName>.md and strip the LINK-WEB auto block.
  throw new Error("AXIS vault-reader: readNote not implemented (Phase 1 stub)");
}
