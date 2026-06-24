// axis/brain-bridge/memory-reader.mjs — STUB (RUN A · Phase 1 scaffold)
// Purpose: read Cowork's persistent memory index (memory/MEMORY.md) and individual memory files, so
// AXIS shares the same long-term memory as the director. Read-only. No network. No dependency.

/**
 * Read the memory index (one-line pointers) from MEMORY.md.
 * @param {object} _opts { memoryDir? } default = Cowork's per-project memory dir
 * @returns {Promise<Array<{ title: string, file: string, hook: string }>>}
 */
export async function readMemoryIndex(_opts = {}) {
  // TODO(phase-1): read <memoryDir>/MEMORY.md; parse "- [Title](file.md) — hook" lines into entries.
  throw new Error("AXIS memory-reader: readMemoryIndex not implemented (Phase 1 stub)");
}

/**
 * Read one memory file's body (minus frontmatter).
 * @param {string} _file e.g. "aria-sentinel-run15-16.md"
 * @returns {Promise<{ name: string, description: string, body: string }>}
 */
export async function readMemory(_file, _opts = {}) {
  // TODO(phase-1): read <memoryDir>/<file>, parse frontmatter (name/description/type), return body.
  throw new Error("AXIS memory-reader: readMemory not implemented (Phase 1 stub)");
}
