// JULY PORT 2026-10-14 (ddfcac5b, cc/security-lockdown-2026-07-01) — the READ-ONLY .txt file-association guard.
// ADAPTED to the production line: the fix is a dedicated guide IPC (sentinel:file-association-fix → Windows Default
// Apps for the PERSON to pick Notepad), the detection rides the normal addDetection → supervised pipeline, the
// registry probe never writes, the excluded-folder guard (path-guard.mjs) is applied to every registry-derived string,
// and the periodic re-check respects the spawn budget (10 min, not 60 s).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FILE_ASSOCIATION_GUARD_INTERVAL_MS,
  TEXT_ASSOCIATION_PRIMARY_RECIPE_ID,
  TEXT_ASSOCIATION_RISK_RECIPE_ID,
  buildAssociationGuardStatus,
  classifyTextAssociation,
  normalizeAssociationSnapshot,
  parseRegQueryValues
} from "../src/shared/file-association-guard.mjs";
import { recipeById } from "../src/shared/recipes.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const adobeDefault = classifyTextAssociation({
  extension: ".txt",
  userChoiceProgId: "AcroExch.Document.DC",
  userChoiceApplicationName: "Adobe Acrobat",
  openWithExecutables: ["Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"]
});
assert.equal(adobeDefault.ok, false, "Adobe default is flagged");
assert.equal(adobeDefault.issue.recipeId, TEXT_ASSOCIATION_PRIMARY_RECIPE_ID);
assert.equal(adobeDefault.issue.signal, "APP.TXT.DEFAULT_ADOBE");
assert.match(adobeDefault.issue.summary, /text files are opening in Adobe/i);
assert.match(adobeDefault.issue.summary, /switch them back to Notepad/i);
assert.equal(buildAssociationGuardStatus(adobeDefault).needsApproval, true, "actual default change needs approval");

const openWithRisk = classifyTextAssociation({
  extension: ".txt",
  userChoiceProgId: "AppX4ztfk9wxr86nxmzzq47px0nh0e58b8fw",
  userChoiceApplicationName: "Microsoft Windows Notepad",
  openWithExecutables: ["Acrobat.exe", "Code.exe"]
});
assert.equal(openWithRisk.ok, false, "Adobe in OpenWith history is surfaced as a prevention warning");
assert.equal(openWithRisk.issue.recipeId, TEXT_ASSOCIATION_RISK_RECIPE_ID);
assert.equal(openWithRisk.issue.signal, "APP.TXT.OPENWITH_ADOBE_RISK");
assert.equal(buildAssociationGuardStatus(openWithRisk).preventionStage, "before-drift");

const healthy = classifyTextAssociation({
  extension: ".txt",
  userChoiceApplicationName: "Microsoft Windows Notepad",
  openWithExecutables: ["Code.exe"]
});
assert.equal(healthy.ok, true, "Notepad default without Adobe history is healthy");

const notText = classifyTextAssociation({
  extension: ".pdf",
  userChoiceApplicationName: "Adobe Acrobat"
});
assert.equal(notText.ok, true, "PDF defaults are not mistaken for text-file drift");

const parsed = parseRegQueryValues(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.txt\\OpenWithList
    a    REG_SZ    Microsoft.WindowsNotepad_8wekyb3d8bbwe!App
    d    REG_SZ    Acrobat.exe
    MRUList    REG_SZ    dacb
`);
assert.equal(parsed.a, "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App");
assert.equal(parsed.d, "Acrobat.exe");
assert.equal(parsed.MRUList, "dacb");

// ── Content-blind + the excluded-folder guard (never re-implemented: path-guard.mjs is called) ──
const withPath = normalizeAssociationSnapshot({ userChoiceCommand: `"C:\\Program Files\\Notepad++\\notepad++.exe" "%1"` });
assert.doesNotMatch(withPath.userChoiceCommand, /C:\\/, "a command path is reduced to [path]");
const privateRef = normalizeAssociationSnapshot({
  userChoiceCommand: `"C:\\Users\\someone\\${PRIVATE_FOLDER_NAME}\\viewer.exe" "%1"`,
  openWithExecutables: [`C:\\Users\\someone\\${PRIVATE_FOLDER_NAME}\\viewer.exe`, "Code.exe"]
});
assert.equal(privateRef.r11Redacted, true, "a registry value referencing the excluded folder is flagged");
assert.doesNotMatch(JSON.stringify(privateRef), new RegExp(PRIVATE_FOLDER_NAME.replace(/\s+/g, "\\s+"), "i"), "…and the folder name never survives into the snapshot");
assert.deepEqual(privateRef.openWithExecutables, ["Code.exe"], "an Open-With entry that references the excluded folder is dropped");
assert.equal(normalizeAssociationSnapshot({ userChoiceApplicationName: "Notepad" }).r11Redacted, false, "no false redaction flag");

assert.ok(recipeById(TEXT_ASSOCIATION_PRIMARY_RECIPE_ID), "primary association recipe exists");
assert.ok(recipeById(TEXT_ASSOCIATION_RISK_RECIPE_ID), "prevention warning recipe exists");
for (const id of [TEXT_ASSOCIATION_PRIMARY_RECIPE_ID, TEXT_ASSOCIATION_RISK_RECIPE_ID]) {
  const r = recipeById(id);
  assert.ok(r.actions.every((a) => a.shell === "manual"), `${id}: every action is a MANUAL guide step (the executor can never apply it)`);
  assert.doesNotMatch(JSON.stringify(r), /reg\s+add|reg\s+delete|Set-ItemProperty|New-ItemProperty|Remove-ItemProperty|powershell/i, `${id}: no registry write anywhere in the recipe`);
}
assert.equal(FILE_ASSOCIATION_GUARD_INTERVAL_MS, 10 * 60 * 1000, "periodic re-check every 10 minutes (spawn budget, audit M8)");

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
const overlay = fs.readFileSync(path.join(root, "src", "renderer", "overlay.js"), "utf8");

assert.match(main, /startFileAssociationGuard\(\); \/\/ JULY PORT/, "guard starts on app launch");
assert.match(main, /sentinel:file-association-scan/, "manual scan IPC is exposed");
assert.match(main, /sentinel:file-association-fix/, "the guide-action IPC is exposed");
assert.match(main, /scanFileAssociationGuard\("mode-autonomous"\)/, "Autonomous mode triggers an immediate association re-check");
assert.match(main, /spawn\("reg", args/, "registry probe uses positional reg query args");
const guardBlock = main.slice(main.indexOf("function runRegQuery"), main.indexOf("// ── RUN 23 — process-health poller"));
assert.doesNotMatch(guardBlock, /\breg\s+add\b|\breg\s+delete\b|Set-ItemProperty|New-ItemProperty|Remove-ItemProperty|"add"|"delete"/i, "association guard never writes registry keys");
assert.match(guardBlock, /childProcesses\.add\(child\)/, "the reg probe is tracked so the kill switch ends it");
assert.match(guardBlock, /if \(process\.platform !== "win32"\)/, "the probe is platform-guarded (no-op off Windows)");
assert.match(guardBlock, /r11Redacted[\s\S]*?logEvent\("SECURITY"[\s\S]*?r11AuditEntry\("file-association-guard"\)/, "a redaction is logged as a SECURITY audit row through the existing guard helper");
assert.match(guardBlock, /if \(agentBlocked\(\)\) return;/, "a paused / stopped ARIA does not scan");
assert.match(guardBlock, /addDetection\(recipe, \{[\s\S]*?source: "desktop-scan"/, "an issue becomes a NORMAL detection (same pipeline as every watcher)");
assert.match(guardBlock, /ms-settings:defaultapps/, "the guide action opens Windows Default Apps");
assert.match(guardBlock, /if \(remediationKilled\(\) \|\| agentBlocked\(\)\)[\s\S]*?paused or stopped/, "the guide action is refused while paused / killed");
assert.match(guardBlock, /logEvent\("GUIDE", "Opened Windows Default Apps/, "opening Settings is audit-logged as a guide action, never as an applied fix");
assert.match(main, /fileAssociationGuard: store\.get\("fileAssociationGuard"\)/, "getState carries the last guard status");
assert.match(main, /clearInterval\(fileAssociationGuardTimer\)/, "the timer is cleared on quit");
assert.match(preload, /fileAssociationScan/, "preload exposes safe manual association scan");
assert.match(preload, /fileAssociationFix/, "preload exposes the guide action");
assert.match(overlay, /Fix in Settings/, "globe card uses honest association-fix CTA");
assert.match(overlay, /sentinel\.fileAssociationFix\(currentDetection\.recipeId\)/, "the globe card's association fix is the guide action (explicit click), never a forced run");
assert.doesNotMatch(overlay, /runRecipe\([^)]*dryRun:\s*false/, "the overlay never asks for a live run directly");

console.log("file-association-guard test passed (read-only probe · guard-scrubbed snapshot · manual recipes · guide action via Settings · paused/killed refused · audit rows).");
