import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const data = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-data.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-state.json"), "utf8"));
const outPath = path.join(stateDir, "contracts-bids-live-status.md");
const now = new Date().toISOString();

const contractActions = (data.sections || [])
  .find((section) => section.id === "contracts-bids")?.actions || [];

const rows = contractActions.map((action, index) => {
  const saved = state.actions?.[action.id] || {};
  const contract = state.contracts?.[action.id] || {};
  const brief = action.contractBrief || {};
  const fields = contract.fields || {};
  return `${index + 1}. ${action.title}
   - Organization: ${brief.organization || "Unknown"}
   - Status: ${contract.status || saved.status || "queued"}
   - Dashboard decision: ${saved.status || "open"}
   - Amount: ${fields.bid_amount || brief.estimatedValue || "Unknown / to confirm"}
   - Term: ${fields.term_length || brief.termLength || "Unknown / to confirm"}
   - Extensions: ${fields.extensions || brief.extensions || "Unknown / to confirm"}
   - Timeline: ${fields.timeline_notes || brief.timeline || "Not listed"}
   - Needed from us: ${contract.authorization ? "Agent may fill/submit using saved fields unless hard-stop appears." : "Fill dashboard fields or continue prep."}
   - Source: ${(action.links || [])[0]?.url || "not listed"}`;
});

const md = `# Contracts / Bids Live Status

Generated: ${now}

Purpose: one place to track contract/bid status: queued, submit authorized, submitted, under review, approved, won, rejected, or needs info.

## Status Board
${rows.length ? rows.join("\n\n") : "- No contract/bid items found."}

## Rules
- Dashboard fields are the source of truth for form-fill values.
- If status is \`submit_authorized\`, agent can fill and submit that specific live form using saved fields only.
- Stop for any new cost, legal attestation, certification, credential, upload, missing required unknown, or reputational risk.
`;

fs.writeFileSync(outPath, md, "utf8");
console.log(`Contracts/bids status written: ${outPath}`);
