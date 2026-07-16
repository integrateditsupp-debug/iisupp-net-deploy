// P0 (2026-07-14) — end-user chat answer shaping. The live KB articles carry INTERNAL-facing sections
// (## 10. Internal Technician Notes — spooler CLI + registry keys flagged "security trade-off";
// ## 12. Keywords / Search Tags; ## 3. Questions To Ask User). Rendering the whole article into an end
// user's chat bubble is a liability + trust hit (an L1 employee should never receive registry-edit
// guidance labelled "internal"). This shaper LEADS with the plain-language User-Friendly Explanation +
// the fix steps and NEVER emits the internal/keyword sections. It is pure + unit-tested and is applied on
// BOTH the server excerpt (netlify/functions/aria-kb-query.mjs) and Sentinel's renderer (defense in depth).
//
// Robust by design: articles WITHOUT the numbered sections (short/learned chunks) pass through with only
// the internal/keyword blocks stripped — never truncated, never fabricated (Rule 14).

function normHeading(t) {
  return String(t || "").toLowerCase().replace(/^\d+[.)]\s*/, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Section headings that must NEVER reach an end user.
const EXCLUDE = [
  /internal technician notes/, /internal notes/, /technician notes/,
  /keywords/, /search tags/, /questions to ask/
];
function isExcluded(key) { return EXCLUDE.some((re) => re.test(key)); }

// Map a normalized heading → a semantic role we reorder around.
function roleOf(key) {
  if (/user friendly explanation|plain language|in plain/.test(key)) return "explain";
  if (/resolution steps|the fix|how to fix|fix steps/.test(key)) return "fix";
  if (/troubleshooting steps|troubleshooting|diagnos/.test(key)) return "troubleshoot";
  if (/verification steps|verify|confirm/.test(key)) return "verify";
  if (/escalation trigger|escalation|when to escalate/.test(key)) return "escalate";
  if (/prevention tips|prevention|avoid/.test(key)) return "prevent";
  if (/symptom/.test(key)) return "symptom";
  if (/likely causes|cause/.test(key)) return "cause";
  if (/related/.test(key)) return "related";
  return "other";
}

function splitSections(raw) {
  const lines = String(raw).split(/\r?\n/);
  const sections = [];
  let title1 = "";
  let cur = { title: "", key: "__preamble__", role: "preamble", lines: [] };
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1 && !title1) { title1 = h1[1].trim(); continue; }
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (m) {
      sections.push(cur);
      const title = m[2].trim();
      const key = normHeading(title);
      cur = { title, key, role: roleOf(key), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  sections.push(cur);
  return { title1, sections };
}

function bodyOf(sec) { return sec.lines.join("\n").trim(); }

/**
 * Shape a KB article/excerpt for an end-user chat bubble.
 * @param {string} markdown raw article/excerpt markdown
 * @returns {string} shaped answer — internal/keyword sections removed, User-Friendly Explanation first.
 */
export function shapeKbAnswerForEndUser(markdown) {
  const raw = String(markdown == null ? "" : markdown);
  if (!raw.trim()) return raw;
  const { title1, sections } = splitSections(raw);

  // Keep only non-excluded sections.
  const kept = sections.filter((s) => !isExcluded(s.key));
  const byRole = (role) => kept.filter((s) => s.role === role && bodyOf(s));

  const explain = byRole("explain");
  const fix = byRole("fix");
  const troubleshoot = byRole("troubleshoot");

  // If the article has none of the sections we can reason about (learned/short chunk), just return the raw
  // text with any excluded sections stripped — never a truncated fragment.
  if (!explain.length && !fix.length && !troubleshoot.length) {
    const out = [];
    if (title1) out.push(`# ${title1}`);
    for (const s of kept) {
      const b = bodyOf(s);
      if (s.role === "preamble") { if (b) out.push(b); continue; }
      out.push(`## ${s.title}\n${b}`.trim());
    }
    return out.join("\n\n").trim();
  }

  const parts = [];
  if (title1) parts.push(`# ${title1}`);
  // 1) LEAD with the plain-language explanation (Rule 17 — value the user feels, first).
  for (const s of explain) parts.push(bodyOf(s));
  // 2) The fix — resolution steps preferred, else troubleshooting steps.
  const steps = fix.length ? fix : troubleshoot;
  for (const s of steps) parts.push(`**What to do**\n${bodyOf(s)}`);
  // 3) Verify, then escalation, then prevention — supportive, still no internal content.
  for (const s of byRole("verify")) parts.push(`**Confirm it's fixed**\n${bodyOf(s)}`);
  for (const s of byRole("escalate")) parts.push(`**If that doesn't resolve it**\n${bodyOf(s)}`);
  for (const s of byRole("prevent")) parts.push(`**Prevent it next time**\n${bodyOf(s)}`);
  return parts.join("\n\n").trim();
}

// P7 (2026-07-14) — split a SHAPED answer into the concise LEAD (plain-language explanation + the fix steps) and
// the supporting "more help" (verify / escalation / prevention). The chat leads with the LEAD (Rule 17 — value
// first) and tucks `more` behind a toggle. Loses nothing (F2-safe): the "Full article" link still stands, and a
// text without the supporting markers (offline/learned chunk) returns all as `lead` with an empty `more`.
const MORE_MARKERS = ["**Confirm it's fixed**", "**If that doesn't resolve it**", "**Prevent it next time**"];
export function splitShapedAnswer(shaped) {
  const text = String(shaped == null ? "" : shaped);
  let cut = -1;
  for (const m of MORE_MARKERS) { const i = text.indexOf(m); if (i >= 0 && (cut < 0 || i < cut)) cut = i; }
  if (cut < 0) return { lead: text.trim(), more: "" };
  return { lead: text.slice(0, cut).trim(), more: text.slice(cut).trim() };
}

// A cheap assertion helper for tests: true if the text carries NO internal/keyword marker or registry hive.
export function isEndUserSafe(text) {
  const t = String(text || "");
  if (/internal technician notes|keywords\s*\/\s*search tags|questions to ask user/i.test(t)) return false;
  if (/\bHK(EY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)|LM|CU|CR|U|CC)\\/i.test(t)) return false;
  return true;
}
