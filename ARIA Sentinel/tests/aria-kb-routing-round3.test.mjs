// RUN 36 round-3 — web LLM routing coverage for high-frequency end-user categories that had KB
// articles in the top50-gaps set but NO routing rule: calendar, external display, conference-room AV.
// Proves each routes to the right article id, and that the iter-7 vertical "wont print" fallthrough
// and key iter-7 lifts are NOT regressed.
import assert from "node:assert/strict";
import { routeIds } from "../../assets/aria-kb-retrieval.mjs";

const has = (q, id) => routeIds(q).includes(id);
let n = 0; const t = () => { n++; };

// 1 — Out-of-office / automatic replies → l1-calendar-002.
for (const q of ["set up out of office", "automatic replies not working", "turn on oof", "vacation responder", "away message in outlook"])
  assert.ok(has(q, "l1-calendar-002"), `oof: "${q}" → l1-calendar-002`);
t();

// 2 — Calendar problems (sync/missing/double-booked/shared) → l1-calendar-001.
for (const q of ["outlook calendar wont sync", "my calendar is missing meetings", "shared calendar not showing", "calendar double booked", "outlook calendar"])
  assert.ok(has(q, "l1-calendar-001"), `calendar: "${q}" → l1-calendar-001`);
t();

// 3 — Meeting/calendar invites missing/duplicating/wrong-calendar → l1-calendar-003.
for (const q of ["meeting invites missing", "calendar invites duplicating", "meeting invite on wrong calendar"])
  assert.ok(has(q, "l1-calendar-003"), `invites: "${q}" → l1-calendar-003`);
t();

// 4 — External monitor not detected → l1-display-001.
for (const q of ["external monitor not detected", "second screen no signal", "dual monitor not working", "hdmi no signal", "2nd monitor black"])
  assert.ok(has(q, "l1-display-001"), `display: "${q}" → l1-display-001`);
t();

// 5 — Monitor resolution / scaling / blurry → l1-display-002.
for (const q of ["monitor blurry text", "display wrong resolution", "screen scaling wrong"])
  assert.ok(has(q, "l1-display-002"), `display-res: "${q}" → l1-display-002`);
t();

// 6 — Conference-room AV (projector / Teams Room / boardroom) → l1-conference-001.
for (const q of ["conference room av not working", "boardroom projector", "teams room camera broken", "meeting room tv"])
  assert.ok(has(q, "l1-conference-001"), `conference: "${q}" → l1-conference-001`);
t();

// 7 — No regression: vertical-app "wont print" still falls through (no printer routing); iter-7 lifts intact.
for (const q of ["REUTERS TRADING WONT PRINT CONFIRM", "EHR wont print the chart", "the trade blotter wont print"])
  assert.ok(!has(q, "l1-printer-001") && !has(q, "l1-printer-002"), `vertical fallthrough: "${q}" must NOT route to printer`);
assert.ok(has("lockbit hit our file server", "l2-malware-001"), "iter-7 security intact");
assert.ok(has("no internet access", "l1-wifi-001"), "iter-7 wifi intact");
assert.ok(has("lost my authenticator phone", "l1-mfa-001"), "iter-7 mfa intact");
t();

assert.equal(n, 7, "7 round-3 routing groups");
console.log(`aria-kb-routing-round3 passed (${n} groups · calendar oof/problems/invites · external display detect+resolution · conference-room AV · iter-7 fallthrough+lifts intact).`);
