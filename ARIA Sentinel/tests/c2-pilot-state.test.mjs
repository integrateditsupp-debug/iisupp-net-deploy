// RUN-C C2 - 14-day SMB pilot state. Restores the missing suite referenced by run-all.
import assert from "node:assert/strict";
import {
  pilotStatus,
  pilotBadge,
  pilotUpgradePrompt,
  validatePilotIntake,
  buildPilotRecord,
  scrubField,
  PILOT_DAY_MS
} from "../src/shared/pilot-state.mjs";

const START = Date.parse("2026-07-01T00:00:00.000Z");

assert.deepEqual(
  pilotStatus({ now: START }),
  { state: "inactive", daysRemaining: null, startedAt: null, expiresAt: null },
  "no start is real-or-empty inactive"
);

let status = pilotStatus({ startedAt: START, now: START + 2 * PILOT_DAY_MS });
assert.equal(status.state, "active");
assert.equal(status.daysRemaining, 12);
assert.match(pilotBadge(status), /12 day/);

status = pilotStatus({ startedAt: START, now: START + 12 * PILOT_DAY_MS });
assert.equal(status.state, "expiring");
const prompt = pilotUpgradePrompt(status);
assert.equal(prompt.show, true);
assert.equal(prompt.blocking, false, "pilot prompt never blocks the app");
assert.equal(pilotUpgradePrompt(status, { dismissed: ["expiring"] }), null, "dismissed expiring prompt stays quiet");

status = pilotStatus({ startedAt: START, now: START + 15 * PILOT_DAY_MS });
assert.equal(status.state, "expired");
assert.equal(pilotUpgradePrompt(status).dismissible, true);

let intake = validatePilotIntake({ org: "Acme Clinic", size: "11-50", pains: ["printer jams", "Excel help"] });
assert.equal(intake.ok, true);
assert.deepEqual(intake.value.pains, ["printer jams", "Excel help"]);

intake = validatePilotIntake({ org: "", size: "bad", pains: [] });
assert.equal(intake.ok, false);
assert.deepEqual(intake.errors.sort(), ["org-required", "pains-required", "size-invalid"].sort());

const scrubbed = scrubField("C:\\Users\\Ahmad\\secret.txt and \\\\server\\share\\file.docx");
assert.equal(scrubbed.includes("Ahmad"), false, "paths are scrubbed before persistence");

const built = buildPilotRecord(
  { org: "Acme Clinic", size: "11-50", topPains: "Printers; C:\\Users\\Ahmad\\secret.txt" },
  { now: START, deviceId: "device-1" }
);
assert.equal(built.ok, true);
assert.equal(built.record.schema, "pilot.v1");
assert.equal(built.record.started_at, new Date(START).toISOString());
assert.equal(built.record.pains.length, 2);
assert.equal(built.record.pains[1].includes("Ahmad"), false, "pilot pain text is path-scrubbed");

console.log("C2 pilot-state test passed (real-or-empty status, nonblocking prompts, intake validation, path scrubbing).");
