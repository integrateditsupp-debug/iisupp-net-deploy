// RUN 36 round-3 - routing coverage for calendar, external display, and conference-room AV top50 gaps.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeIds } from "../../assets/aria-kb-retrieval.mjs";

const has = (q, id) => routeIds(q).includes(id);
const chunks = JSON.parse(readFileSync(new URL("../../assets/aria-kb-chunks.json", import.meta.url), "utf8")).chunks || [];
const chunkPaths = chunks.map((c) => c.path_rel || "");

function shippedTop50(id) {
  return chunkPaths.some((p) => p.includes(`top50-gaps/${id}-`));
}

let n = 0;
const t = () => { n++; };

// 1 - Outlook calendar issues route to the shipped top50 calendar article.
assert.ok(shippedTop50("l1-calendar-001"), "l1-calendar-001 top50 article ships in aria-kb-chunks");
for (const q of [
  "outlook calendar meeting missing from my laptop",
  "calendar appointments disappeared after I accepted the invite",
  "shared calendar free busy is wrong",
  "room calendar invite duplicated"
]) assert.ok(has(q, "l1-calendar-001"), `calendar: "${q}" -> l1-calendar-001`);
t();

// 2 - External monitor detection routes to the shipped top50 display article, not Windows boot.
assert.ok(shippedTop50("l1-display-001"), "l1-display-001 top50 article ships in aria-kb-chunks");
for (const q of [
  "external monitor not detected",
  "second monitor no signal",
  "usb-c display is blank",
  "docking station monitor not detected"
]) {
  assert.ok(has(q, "l1-display-001"), `display detect: "${q}" -> l1-display-001`);
  assert.ok(!has(q, "l1-windows-002"), `display detect: "${q}" must not route to Windows boot`);
}
t();

// 3 - External monitor resolution/scaling routes separately from detection.
assert.ok(shippedTop50("l1-display-002"), "l1-display-002 top50 article ships in aria-kb-chunks");
for (const q of [
  "external monitor blurry text",
  "second display wrong resolution",
  "display scaling looks huge",
  "4k monitor is fuzzy"
]) assert.ok(has(q, "l1-display-002"), `display scaling: "${q}" -> l1-display-002`);
t();

// 4 - Conference-room AV routes to the shipped AV article before falling into generic audio.
assert.ok(shippedTop50("l1-conference-001"), "l1-conference-001 top50 article ships in aria-kb-chunks");
for (const q of [
  "conference room av not working",
  "meeting room projector no signal",
  "conference room microphone not working",
  "teams room camera is blank"
]) assert.ok(has(q, "l1-conference-001"), `conference room: "${q}" -> l1-conference-001`);
t();

assert.equal(n, 4, "4 round-3 routing groups");
console.log(`aria-kb-routing-round3 passed (${n} groups - calendar, external display detect/scaling, conference-room AV).`);
