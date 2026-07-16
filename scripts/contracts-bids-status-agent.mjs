import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const data = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-data.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-state.json"), "utf8"));
const opportunities = JSON.parse(fs.readFileSync(path.join(stateDir, "opportunity-engine", "opportunities.json"), "utf8"));
const outPath = path.join(stateDir, "contracts-bids-live-status.md");
const now = new Date().toISOString();

const contractActions = (data.sections || [])
  .find((section) => section.id === "contracts-bids")?.actions || [];

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function sourceFor(action) {
  return (action.links || [])[0]?.url || "";
}

function matchingOpportunity(action) {
  const source = sourceFor(action);
  const title = normalize(action.title);
  return (opportunities.items || []).find((item) => {
    if (source && item.sourceLink === source) return true;
    if (source && item.sourceLink && source.includes(item.sourceLink)) return true;
    if (source && item.sourceLink && item.sourceLink.includes(source)) return true;
    return title && normalize(`${item.title} - ${item.organization}`) === title;
  }) || null;
}

function dispositionStatus(disposition) {
  switch (disposition) {
    case "direct_no_bid":
      return "rejected";
    case "partner_path_only":
      return "parked";
    case "review_no_cost_doc_access":
    case "research_more_go_no_go":
    case "rfi_research_only":
    case "review_third_party_package":
      return "needs_info";
    default:
      return null;
  }
}

function savedStatusFor(action) {
  const saved = state.actions?.[action.id] || {};
  const contract = state.contracts?.[action.id] || {};
  const savedTitle = normalize(saved.title || contract.title);
  const actionTitle = normalize(action.title);
  const staleSavedStatus = savedTitle && actionTitle && savedTitle !== actionTitle;
  return {
    action: staleSavedStatus ? {} : saved,
    contract: staleSavedStatus ? {} : contract,
    staleSavedStatus
  };
}

const rows = contractActions.map((action, index) => {
  const { action: saved, contract, staleSavedStatus } = savedStatusFor(action);
  const brief = action.contractBrief || {};
  const fields = contract.fields || {};
  const opportunity = matchingOpportunity(action);
  const groundedStatus = dispositionStatus(opportunity?.manualDisposition);
  const rawStatus = contract.status || saved.status || brief.currentStatus || "queued";
  const status = rawStatus === "submit_authorized" ? rawStatus : (groundedStatus || rawStatus);
  const dashboardDecision = staleSavedStatus
    ? "ignored stale saved dashboard decision"
    : (saved.status || "open");
  const needed = status === "submit_authorized"
    ? "Agent may fill/submit using saved fields unless hard-stop appears."
    : opportunity?.manualReason
    ? opportunity.manualReason
    : "Fill dashboard fields or continue prep.";
  return `${index + 1}. ${action.title}
   - Organization: ${brief.organization || "Unknown"}
   - Status: ${status}
   - Dashboard decision: ${dashboardDecision}
   - Amount: ${fields.bid_amount || brief.estimatedValue || "Unknown / to confirm"}
   - Term: ${fields.term_length || brief.termLength || "Unknown / to confirm"}
   - Extensions: ${fields.extensions || brief.extensions || "Unknown / to confirm"}
   - Timeline: ${fields.timeline_notes || brief.timeline || "Not listed"}
   - Needed from us: ${needed}
   ${opportunity?.manualReference ? `- Grounding file: ${opportunity.manualReference}` : "- Grounding file: not listed"}
   - Source: ${sourceFor(action) || "not listed"}`;
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
