import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const dataPath = path.join(stateDir, "ceo-action-console-data.json");
const statePath = path.join(stateDir, "ceo-action-console-state.json");
const outPath = path.join(stateDir, "contracts-bids-sync-report.md");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const now = new Date().toISOString();
const contracts = (data.sections || []).find((section) => section.id === "contracts-bids")?.actions || [];
const synced = [];

for (const contract of contracts) {
  const sourceId = contract.sourceActionId;
  const sourceStatus = state.actions?.[sourceId]?.status;
  const contractStatus = state.actions?.[contract.id]?.status || "open";
  if (sourceStatus && sourceStatus !== "open" && contractStatus === "open") {
    state.actions = {
      ...(state.actions || {}),
      [contract.id]: {
        ...(state.actions?.[contract.id] || {}),
        status: sourceStatus,
        updatedAt: now,
        note: state.actions?.[sourceId]?.note || "",
        title: contract.title
      }
    };
    state.contracts = {
      ...(state.contracts || {}),
      [contract.id]: {
        ...(state.contracts?.[contract.id] || {}),
        status: sourceStatus,
        title: contract.title,
        sourceActionId: sourceId,
        updatedAt: now
      }
    };
    state.notes = [
      ...(state.notes || []),
      {
        actionId: contract.id,
        title: contract.title,
        status: sourceStatus,
        note: `Synced from source dashboard action ${sourceId}.`,
        at: now
      }
    ].slice(-200);
    synced.push({ id: contract.id, title: contract.title, sourceId, sourceStatus });
  }
}

const md = `# Contracts / Bids Sync Report

Generated: ${now}

Synced contract cards from underlying dashboard source actions.

Count: ${synced.length}

${synced.length ? synced.map((item, index) => `${index + 1}. ${item.title}\n   - Contract ID: ${item.id}\n   - Source ID: ${item.sourceId}\n   - Synced status: ${item.sourceStatus}`).join("\n\n") : "- Nothing to sync."}

Rule:
- If the underlying bid/prep item is already approved, accepted, rejected, held, done, or needs-agent, the Contracts/Bids card should not remain open.
- Contracts/Bids cards should show in the active dashboard only when Ahmad has not actioned them, or when the agent reports a failure/blocker that needs Ahmad-only input.
`;

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
fs.writeFileSync(outPath, md, "utf8");
console.log(JSON.stringify({ ok: true, synced: synced.length, outPath }, null, 2));
