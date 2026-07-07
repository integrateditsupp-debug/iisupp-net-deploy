import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const data = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-data.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(stateDir, "ceo-action-console-state.json"), "utf8"));
const opportunityDb = JSON.parse(fs.readFileSync(path.join(stateDir, "opportunity-engine", "opportunities.json"), "utf8"));
const outPath = path.join(stateDir, "contracts-bids-live-status.md");
const now = new Date().toISOString();

const parkedDirectNoBidLinks = new Set(
  (opportunityDb.items || [])
    .filter((item) => item.manualDisposition === "direct_no_bid")
    .map((item) => String(item.sourceLink || "").toLowerCase())
    .filter(Boolean)
);
const opportunityByLink = new Map(
  (opportunityDb.items || [])
    .map((item) => [String(item.sourceLink || "").toLowerCase(), item])
    .filter(([url]) => url)
);

const dispositionStatusMap = {
  partner_path_only: "needs_info",
  research_more_go_no_go: "needs_info",
  review_no_cost_doc_access: "needs_info",
  review_third_party_package: "needs_info",
  rfi_research_only: "research_only"
};

function derivedStatus(item, fallback) {
  if (item?.manualDisposition && dispositionStatusMap[item.manualDisposition]) {
    return dispositionStatusMap[item.manualDisposition];
  }
  if (item?.status === "ready_to_submit") return "submit_authorized";
  if (item?.status === "needs_review") return "needs_info";
  if (item?.status === "ignored") return "review";
  return fallback;
}

function neededFromUs(item, fallback) {
  if (item?.recommendedNextStep) return item.recommendedNextStep;
  if (item?.manualReason) return item.manualReason;
  return fallback;
}

const contractActions = (data.sections || [])
  .find((section) => section.id === "contracts-bids")?.actions || [];

const visibleActions = contractActions.filter((action) => {
  const url = String((action.links || [])[0]?.url || "").toLowerCase();
  return !parkedDirectNoBidLinks.has(url);
});

const rows = visibleActions.map((action, index) => {
  const saved = state.actions?.[action.id] || {};
  const contract = state.contracts?.[action.id] || {};
  const brief = action.contractBrief || {};
  const fields = contract.fields || {};
  const sourceUrl = String((action.links || [])[0]?.url || "").toLowerCase();
  const opportunity = opportunityByLink.get(sourceUrl);
  const status = derivedStatus(opportunity, contract.status || saved.status || "queued");
  const timeline = opportunity?.deadline || fields.timeline_notes || brief.timeline || "Not listed";
  const nextStepFallback = contract.authorization
    ? "Agent may fill/submit using saved fields unless hard-stop appears."
    : "Fill dashboard fields or continue prep.";
  return `${index + 1}. ${action.title}
   - Organization: ${brief.organization || "Unknown"}
   - Status: ${status}
   - Dashboard decision: ${status}
   - Amount: ${fields.bid_amount || brief.estimatedValue || "Unknown / to confirm"}
   - Term: ${fields.term_length || brief.termLength || "Unknown / to confirm"}
   - Extensions: ${fields.extensions || brief.extensions || "Unknown / to confirm"}
   - Timeline: ${timeline}
   - Needed from us: ${neededFromUs(opportunity, nextStepFallback)}
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
- Items parked as \`direct_no_bid\` in the opportunity engine stay off this live board.
- Stop for any new cost, legal attestation, certification, credential, upload, missing required unknown, or reputational risk.
`;

fs.writeFileSync(outPath, md, "utf8");
console.log(`Contracts/bids status written: ${outPath}`);
