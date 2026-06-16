import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const statePath = path.join(stateDir, "ceo-action-console-state.json");
const outPath = path.join(stateDir, "contracts-bids-submit-result-log.md");

function arg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const id = arg("id");
const status = arg("status", "failed_submit");
const message = arg("message", "Submit attempt failed or hit a blocker.");
const nextStep = arg("next", "Review the live form and provide the missing Ahmad-only information.");

if (!id) {
  console.error("Usage: node scripts/contracts-bids-submit-result-agent.mjs --id=contract-prep-1 --status=failed_submit --message=\"...\" --next=\"...\"");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const now = new Date().toISOString();
const currentAction = state.actions?.[id] || {};
const currentContract = state.contracts?.[id] || {};

state.actions = {
  ...(state.actions || {}),
  [id]: {
    ...currentAction,
    status,
    updatedAt: now,
    title: currentAction.title || currentContract.title || id,
    note: message
  }
};

state.contracts = {
  ...(state.contracts || {}),
  [id]: {
    ...currentContract,
    status,
    updatedAt: now,
    failure: status === "failed_submit" ? { message, nextStep, at: now } : currentContract.failure || null
  }
};

state.notes = [
  ...(state.notes || []),
  {
    actionId: id,
    title: state.actions[id].title,
    status,
    note: message,
    at: now
  }
].slice(-200);

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
fs.appendFileSync(outPath, `\n## ${now}\n- ID: ${id}\n- Status: ${status}\n- Message: ${message}\n- Next: ${nextStep}\n`, "utf8");
console.log(JSON.stringify({ ok: true, id, status, message, nextStep }, null, 2));
