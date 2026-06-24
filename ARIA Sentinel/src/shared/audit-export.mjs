// audit-export — human-readable audit exports (CSV + a hand-rolled, zero-dependency PDF) for the
// last 30 days. Same content-blind guarantee as the evidence pack: only the symbolic audit fields
// (timestamp · tag · recipe id · already-sanitized detail) are emitted — never page or file content.
const DAY_MS = 24 * 60 * 60 * 1000;

function windowed(entries, now) {
  const cutoff = now - 30 * DAY_MS;
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    const t = Date.parse(e && e.ts);
    return Number.isFinite(t) ? t >= cutoff : true;
  });
}

function csvCell(value) {
  // Quote every cell and escape quotes — a newline or comma in a detail string can never break a row.
  return `"${String(value == null ? "" : value).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function toCsv(entries, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const rows = windowed(entries, now);
  const header = ["timestamp", "tag", "recipe", "detail"].join(",");
  const body = rows.map((e) => [csvCell(e.ts), csvCell(e.tag), csvCell(e.recipeId || ""), csvCell(e.text || "")].join(",")).join("\n");
  return `${header}\n${body}`;
}

function pdfEscape(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Build a minimal but valid single-stream PDF (Helvetica, one logical page of text lines).
 * Hand-rolled so it adds zero dependencies. Returns the PDF as a string.
 */
export function toPdf(title, entries, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const rows = windowed(entries, now);
  const lines = [String(title || "ARIA Sentinel — audit (30 days)"), ""];
  for (const e of rows) lines.push(`${e.ts || ""}  [${e.tag || "LOG"}]  ${e.recipeId ? e.recipeId + "  " : ""}${e.text || ""}`);
  if (rows.length === 0) lines.push("No audit entries in the last 30 days.");

  let content = "BT /F1 10 Tf 40 760 Td 12 TL\n";
  for (const ln of lines.slice(0, 200)) content += `(${pdfEscape(ln).slice(0, 140)}) Tj T*\n`;
  content += "ET";

  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(content, "utf8")}>>\nstream\n${content}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

export function auditFileName(kind, dateStamp) {
  return `aria-sentinel-audit-${dateStamp}.${kind === "pdf" ? "pdf" : "csv"}`;
}
