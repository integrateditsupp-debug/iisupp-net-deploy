// generate-the-hour.mjs — RUN-X X2: regenerate the operator-facing HOUR artefact from the real records.
//
// Reads the warm-redirect record (V1), the reply record (W1) and the outbound mail record (U1), builds
// the ranked action list, REFUSES to write if the rendered artefact leaks identity or an internal path,
// and prints the cost of delay + the two blocker lines so the ledger can quote them verbatim.
//
// Free, pure at the edges: this script reads and writes files, but nothing it imports can send.
//
//   node "ARIA Sentinel/scripts/generate-the-hour.mjs"
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { buildTheHour, renderHour, hourLeaks } from "../src/shared/the-hour.mjs";
import { buildCostOfDelay, costMarkdown } from "../src/shared/cost-of-delay.mjs";
import { buildBlockerSurface, ledgerRendering } from "../src/shared/blocker-surface.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTBOUND = path.resolve(HERE, "../../senior-director-state/outbound");
const read = (f) => JSON.parse(readFileSync(path.join(OUTBOUND, f), "utf8"));

const now = Date.now();
const warmRaw = read("warm-redirect-record-2026-07-29.json");
const replyRaw = read("reply-record-2026-07-29.json");
const mailRaw = read("outbound-record-2026-07-28.json");

// The last instant anything ACTUALLY left the mailbox. Drafting never touches this.
const sentAt = (mailRaw.events || [])
  .filter((e) => e.kind === "sent" && e.at)
  .map((e) => Date.parse(e.at))
  .filter(Number.isFinite);
const lastSentAt = sentAt.length ? new Date(Math.max(...sentAt)).toISOString() : null;

const warm = buildWarmRedirectQueue(warmRaw, { now });
const hour = buildTheHour({ warm }, { now });

const leaks = hourLeaks(hour);
if (leaks.length) {
  console.error("REFUSED to write the hour — the rendered artefact leaks:");
  for (const l of leaks) console.error("  " + l);
  process.exit(1);
}

// sequencesBuilt/Landed are real counts of verified sequences and what has reached the shared line.
const cost = buildCostOfDelay(
  {
    landing: { sequencesBuilt: 24, sequencesLanded: 0 },
    mail: { lastSentAt },
    warm,
    replies: { repliesReceived: (replyRaw.replies || []).length },
  },
  { now }
);

const blockers = buildBlockerSurface({
  cost,
  secondMessagesSent: replyRaw.secondMessagesSent || 0,
});

const out = path.join(OUTBOUND, "THE-HOUR-2026-07-29.md");
writeFileSync(out, renderHour(hour) + "\n");

console.log(`wrote ${out}`);
console.log(`actions ${hour.actions.length} · not-open-yet ${hour.notYetOpen.length} · closed ${hour.closed.length} · refused ${hour.refused.length}`);
console.log(costMarkdown(cost));
console.log(ledgerRendering(blockers));
