import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TEXT_ASSOCIATION_PRIMARY_RECIPE_ID,
  TEXT_ASSOCIATION_RISK_RECIPE_ID,
  buildAssociationGuardStatus,
  classifyTextAssociation,
  parseRegQueryValues
} from "../src/shared/file-association-guard.mjs";
import { recipeById } from "../src/shared/recipes.mjs";

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

assert.ok(recipeById(TEXT_ASSOCIATION_PRIMARY_RECIPE_ID), "primary association recipe exists");
assert.ok(recipeById(TEXT_ASSOCIATION_RISK_RECIPE_ID), "prevention warning recipe exists");

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
const overlay = fs.readFileSync(path.join(root, "src", "renderer", "overlay.js"), "utf8");

assert.match(main, /startFileAssociationGuard\(\)/, "guard starts on app launch");
assert.match(main, /sentinel:file-association-scan/, "manual scan IPC is exposed");
assert.match(main, /mode-autonomous/, "Autonomous mode triggers an immediate association re-check");
assert.match(main, /spawn\("reg", args/, "registry probe uses positional reg query args");
const guardBlock = main.slice(main.indexOf("function runRegQuery"), main.indexOf("function supervisedVettedCatalog"));
assert.doesNotMatch(guardBlock, /\breg\s+add\b|\breg\s+delete\b|Set-ItemProperty|New-ItemProperty|Remove-ItemProperty/i, "association guard never writes registry keys");
assert.match(main, /ms-settings:defaultapps/, "approved fix opens Windows Default Apps");
assert.match(preload, /fileAssociationScan/, "preload exposes safe manual association scan");
assert.match(overlay, /Fix in Settings/, "globe card uses honest association-fix CTA");
assert.match(overlay, /confirmed:\s*true/, "association fix requires an explicit click/confirmation");

console.log("file-association-guard test passed.");
