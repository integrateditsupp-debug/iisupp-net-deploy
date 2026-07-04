// RUN-B B5 - under-globe confirmation is real-or-empty: verified fix, real ticket ref, honest email status.
import assert from "node:assert/strict";
import { nextTicketSeq, mintTicketRef, buildGlobeConfirmation } from "../src/shared/globe-confirmation.mjs";

const now = Date.parse("2026-07-04T12:00:00.000Z");
let seq = nextTicketSeq({}, now);
assert.deepEqual(seq, { day: "20260704", seq: 1 });
seq = nextTicketSeq(seq, now + 60_000);
assert.deepEqual(seq, { day: "20260704", seq: 2 });

let minted = mintTicketRef({ seq: seq.seq, now });
assert.equal(minted.ref, "ARIA-20260704-0002");
assert.equal(minted.source, "local");
minted = mintTicketRef({ serviceNowNumber: "INC0012345", seq: 99, now });
assert.equal(minted.ref, "INC0012345");
assert.equal(minted.source, "servicenow");

assert.equal(buildGlobeConfirmation({ completed: true, verified: false, ticketRef: "INC1" }).show, false);
const conf = buildGlobeConfirmation({ completed: true, verified: true, issueTitle: "DNS fixed", ticketRef: "INC1", email: { attempted: true, sent: false, to: "user@example.com" } });
assert.equal(conf.show, true);
assert.match(conf.text, /Issue resolved/);
assert.equal(conf.email.status, "pending");
assert.equal(conf.email.to, "[configured]");

console.log("B5 globe-confirmation test passed (ticket sequence, local/SN refs, verified-only copy, honest email status).");
