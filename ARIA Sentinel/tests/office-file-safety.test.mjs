// Office File Safety Net foundation: backup cadence, validation-copy rule, naming, retry, retention.
import assert from "node:assert/strict";
import {
  OFFICE_BACKUP_INTERVAL_MS,
  OFFICE_VALIDATION_INTERVAL_MS,
  officeAppForFile,
  isSupportedOfficeFile,
  buildOfficeBackupNames,
  planOfficeBackupSet,
  evaluateBackupValidation,
  shouldBackupBeforeAutonomousEdit,
  retentionPlan
} from "../src/shared/office-file-safety.mjs";

const TS = Date.parse("2026-07-04T12:00:00.000Z");

assert.equal(OFFICE_BACKUP_INTERVAL_MS, 2 * 60 * 1000, "backup cadence is every 2 minutes");
assert.equal(OFFICE_VALIDATION_INTERVAL_MS, 3 * 60 * 1000, "validation cadence is every 3 minutes");

assert.equal(officeAppForFile("Budget.xlsx"), "excel");
assert.equal(officeAppForFile("Deck.pptm"), "powerpoint");
assert.equal(officeAppForFile("Brief.docx"), "word");
assert.equal(isSupportedOfficeFile("scan.pdf"), false, "PDF is trainer scope, not Office backup scope");

const names = buildOfficeBackupNames({ filePath: "C:\\Work\\Budget.xlsx", timestamp: TS, version: 1 });
assert.equal(names.ok, true);
assert.equal(names.originalBackupName, "Budget__ARIA_BACKUP__20260704_120000__v001.xlsx");
assert.equal(names.validationCopyName, "Budget__ARIA_VALIDATE__20260704_120000__v001.xlsx");

const planned = planOfficeBackupSet({
  filePath: "C:\\Work\\Budget.xlsm",
  userSid: "S-1-5-21-1",
  documentId: "doc-123",
  timestamp: TS,
  version: 7
});
assert.equal(planned.ok, true);
assert.equal(planned.plan.app, "excel");
assert.equal(planned.plan.validateLiveFile, false, "validation never opens the live file");
assert.equal(planned.plan.validationUsesRenamedCopy, true);
assert.equal(planned.plan.twoLayerBackup, true);
assert.equal(planned.plan.macrosAllowedDuringValidation, false, "macros are disabled during validation");
assert.equal(planned.plan.macroEnabled, true);
assert.equal(planned.plan.openXmlPackageValidation, true);
assert.notEqual(planned.plan.liveFilePath, planned.plan.validationCopyPath);
assert.match(planned.plan.originalBackupPath, /__ARIA_BACKUP__20260704_120000__v007\.xlsm$/);
assert.match(planned.plan.validationCopyPath, /__ARIA_VALIDATE__20260704_120000__v007\.xlsm$/);

const failed = evaluateBackupValidation({ validationCopyOpened: false, previousKnownGood: { id: "old-good" }, attempts: 1 });
assert.equal(failed.healthy, false);
assert.equal(failed.needsRetry, true);
assert.equal(failed.preservePreviousKnownGood, true);
assert.match(failed.warning, /previous known-good/i);

const healthy = evaluateBackupValidation({ validationCopyOpened: true, packageReadable: true });
assert.equal(healthy.healthy, true);
assert.equal(healthy.needsRetry, false);

assert.equal(shouldBackupBeforeAutonomousEdit({ filePath: "C:\\Work\\Budget.xlsx" }), true);
assert.equal(shouldBackupBeforeAutonomousEdit({ filePath: "C:\\Work\\scan.pdf" }), false);

const retained = retentionPlan([
  { id: "old-good", createdAt: "2026-07-01T00:00:00Z", healthy: true },
  { id: "new-1", createdAt: "2026-07-04T12:00:00Z", healthy: false },
  { id: "new-2", createdAt: "2026-07-04T11:00:00Z", healthy: false }
], { maxVersions: 1 });
assert.equal(retained.find((b) => b.id === "new-1").retain, true, "newest retained");
assert.equal(retained.find((b) => b.id === "old-good").retain, true, "latest known-good is preserved beyond count cap");
assert.equal(retained.find((b) => b.id === "new-2").deleteCandidate, true, "extra invalid backup can be cleaned");

console.log("Office file safety test passed (2m backups, 3m validation, validation copy, retry, known-good retention).");
