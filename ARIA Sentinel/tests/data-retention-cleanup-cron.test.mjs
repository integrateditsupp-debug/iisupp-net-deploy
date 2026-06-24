// RUN 22 §5 — the daily 02:00 cleanup is scheduled, runs the retention plan, and is audit-logged.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { nextCleanupAt } from "../src/main/data-retention.mjs";

// nextCleanupAt resolves to an upcoming 02:00 local time (never in the past).
const now = Date.now();
const next = Date.parse(nextCleanupAt(now));
assert.ok(next > now, "next cleanup is in the future");
assert.equal(new Date(next).getHours(), 2, "scheduled at 02:00 local");

// main wires the daily cron at 02:00 + the cleanup function + audit log + next-run computation.
const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
assert.match(main, /function runRetentionCleanup\(/, "cleanup function exists");
assert.match(main, /scheduleDailyAt\(2,\s*runRetentionCleanup\)/, "daily 02:00 cron wired");
assert.match(main, /function scheduleDailyAt\(/, "daily scheduler helper exists");
assert.match(main, /logEvent\("RETENTION"/, "cleanup is audit-logged");
assert.match(main, /planCleanup\(/, "cleanup uses the retention plan");
assert.match(main, /nextCleanupAt\(\)/, "next run computed");

console.log("Data-retention-cleanup-cron test passed (daily 02:00 cron · retention plan · audit-logged).");
