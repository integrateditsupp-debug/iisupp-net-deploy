// file-association-guard — JULY PORT 2026-10-14 (ddfcac5b, cc/security-lockdown-2026-07-01). PURE classification of
// the Windows `.txt` file association: is Notepad still the default, or has Adobe/Acrobat/PDF taken it (or crept into
// the Open-With history)? main.mjs owns the READ-ONLY `reg query` probes and the detection; this module owns every
// decision so it is unit-tested. It never writes a registry key and never names a fix that would.
//
// 🔒 Content-blind: registry values are reduced to safe tokens/labels (paths → "[path]"); the excluded-folder guard
// (path-guard.mjs) is applied to every registry-derived string — a value that references an excluded folder is
// redacted and the snapshot is flagged `r11Redacted` so main can log the SECURITY audit row. Never re-implemented.
import { isBlockedPath, redactPrivate } from "./path-guard.mjs";

export const TEXT_ASSOCIATION_PRIMARY_RECIPE_ID = "app-txt-default-adobe-v1";
export const TEXT_ASSOCIATION_RISK_RECIPE_ID = "app-txt-openwith-adobe-risk-v1";
// July re-checked every 60 s (≈7 reg.exe spawns a minute). The production line budgets process spawns (audit M8:
// "the agent must not become the problem"), and a default-app association drifts rarely, so the periodic re-check is
// every 10 minutes; launch, a manual scan, switching Autonomous on and the post-fix re-check still scan at once.
export const FILE_ASSOCIATION_GUARD_INTERVAL_MS = 10 * 60 * 1000;

const ADOBE = /\b(adobe|acrobat|acrobat\.exe|acroexch|pdf)\b/i;
const NOTEPAD = /\b(notepad|txtfilelegacy|txtfile)\b/i;

export function parseRegQueryValues(output = "") {
  const values = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(.+?)\s+REG_[A-Z0-9_]+\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    values[key] = match[2].trim();
  }
  return values;
}

export function normalizeAssociationSnapshot(input = {}) {
  const openWithExecutables = Array.isArray(input.openWithExecutables)
    ? input.openWithExecutables
    : [];
  // 🔒 excluded-folder guard: redact before any other shaping, and remember that it happened.
  const rawStrings = [input.userChoiceProgId, input.userChoiceApplicationName, input.userChoiceCommand, input.associationProgId, ...openWithExecutables];
  const r11Redacted = rawStrings.some((v) => isBlockedPath(v));
  return {
    extension: normalizeExtension(input.extension || ".txt"),
    userChoiceProgId: safeToken(redactPrivate(input.userChoiceProgId)),
    userChoiceApplicationName: safeLabel(redactPrivate(input.userChoiceApplicationName)),
    userChoiceCommand: safeLabel(redactPrivate(input.userChoiceCommand)),
    associationProgId: safeToken(redactPrivate(input.associationProgId)),
    openWithExecutables: openWithExecutables.filter((v) => !isBlockedPath(v)).map((v) => safeToken(redactPrivate(v))).filter(Boolean),
    source: safeToken(input.source || "windows-registry"),
    r11Redacted
  };
}

export function classifyTextAssociation(input = {}) {
  const snapshot = normalizeAssociationSnapshot(input);
  if (snapshot.extension !== ".txt") return { ok: true, issue: null, snapshot };

  const currentText = [
    snapshot.userChoiceProgId,
    snapshot.userChoiceApplicationName,
    snapshot.userChoiceCommand,
    snapshot.associationProgId
  ].filter(Boolean).join(" ");
  const openWithText = snapshot.openWithExecutables.join(" ");
  const currentAdobe = ADOBE.test(currentText);
  const openWithAdobe = ADOBE.test(openWithText);
  const currentNotepad = NOTEPAD.test(currentText);

  if (currentAdobe) {
    return {
      ok: false,
      snapshot,
      issue: {
        key: "txt-default-adobe",
        recipeId: TEXT_ASSOCIATION_PRIMARY_RECIPE_ID,
        signal: "APP.TXT.DEFAULT_ADOBE",
        family: "APP",
        risk: "orange",
        confidence: 0.94,
        title: ".txt files are opening in Adobe",
        chip: "APP - TXT DEFAULT",
        summary: "Problem detected: text files are opening in Adobe. Shall I switch them back to Notepad?",
        promptCta: "Switch to Notepad",
        preventionStage: "after-drift",
        needsApproval: true
      }
    };
  }

  if (openWithAdobe && currentNotepad) {
    return {
      ok: false,
      snapshot,
      issue: {
        key: "txt-openwith-adobe-risk",
        recipeId: TEXT_ASSOCIATION_RISK_RECIPE_ID,
        signal: "APP.TXT.OPENWITH_ADOBE_RISK",
        family: "APP",
        risk: "green",
        confidence: 0.78,
        title: "Adobe is listed for text files",
        chip: "APP - TXT WARNING",
        summary: "Heads up: Adobe is in the text-file Open With list. Keep Notepad selected for .txt files; I will warn you if it becomes the default.",
        promptCta: "Review default app",
        preventionStage: "before-drift",
        needsApproval: false
      }
    };
  }

  return { ok: true, issue: null, snapshot };
}

export function buildAssociationGuardStatus(classification, scannedAt = new Date().toISOString()) {
  const issue = classification?.issue || null;
  return {
    scannedAt,
    extension: ".txt",
    status: issue ? "issue" : "healthy",
    issueKey: issue?.key || "",
    signal: issue?.signal || "",
    title: issue?.title || "Text files open with the expected app.",
    summary: issue?.summary || ".txt association is not currently pointing at Adobe.",
    preventionStage: issue?.preventionStage || "clear",
    needsApproval: Boolean(issue?.needsApproval)
  };
}

function normalizeExtension(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return text.startsWith(".") ? text : "." + text;
}

function safeToken(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w .!{}:@?/$%+,_=-]/g, "")
    .trim()
    .slice(0, 160);
}

function safeLabel(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\b[a-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+/gi, "[path]")
    .trim()
    .slice(0, 180);
}
