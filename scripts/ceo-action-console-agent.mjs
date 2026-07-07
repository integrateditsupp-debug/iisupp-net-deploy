import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STAGED_REVIEW_FILES } from "./staged-review-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const outPath = path.join(stateDir, "ceo-action-console-data.json");
const persistedStatePath = path.join(stateDir, "ceo-action-console-state.json");
const WARM_LEAD_SEND_GATE_DATE = "2026-07-02";

function read(relPath) {
  try {
    return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
  } catch {
    return "";
  }
}

function publicFile(relPath) {
  return relPath.replaceAll("\\", "/");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function extractAcceptanceQueue(brief) {
  const marker = "## Acceptance Review Queue";
  const nextMarker = "## Search Plays For Today";
  const start = brief.indexOf(marker);
  const end = brief.indexOf(nextMarker);
  if (start === -1) return [];
  const section = brief.slice(start + marker.length, end === -1 ? brief.length : end);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line, index) => {
      const text = line.replace(/^- /, "");
      const [namePart, rest = ""] = text.split(":");
      return {
        id: `acceptance-${index + 1}`,
        title: `Check LinkedIn acceptance: ${namePart.trim()}`,
        group: "LinkedIn acceptance checks",
        type: "lead",
        priority: index < 4 ? 8 : 7,
        ahmadAction: "Open LinkedIn. If accepted, message or mark Needs Agent.",
        agentContinuation: "If accepted, move to obtained leads, select one narrow offer, and prepare/send-ready draft. If not accepted, leave pending.",
        detail: rest.trim() || text,
        links: [
          {
            label: "Open LinkedIn people search",
            url: "https://www.linkedin.com/search/results/people/?keywords=IT%20Director%20Microsoft%20365%20Copilot%20AI%20automation&origin=GLOBAL_SEARCH_HEADER"
          }
        ],
        finalGate: "Message / connect status only"
      };
    });
}

function extractPrepItems(handoff) {
  const marker = "## Keep Working While Waiting";
  const nextMarker = "## Warm Contact Watch";
  const start = handoff.indexOf(marker);
  const end = handoff.indexOf(nextMarker);
  if (start === -1) return [];
  const section = handoff.slice(start + marker.length, end === -1 ? handoff.length : end);
  const chunks = section.split(/\n(?=\d+\. )/).map((chunk) => chunk.trim()).filter(Boolean);
  return chunks.map((chunk, index) => {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const title = (lines[0] || `Opportunity ${index + 1}`).replace(/^\d+\.\s*/, "");
    const linkLine = lines.find((line) => line.startsWith("- Link:"));
    const nextLine = lines.find((line) => line.startsWith("- Next step:"));
    const deadlineLine = lines.find((line) => line.startsWith("- Deadline:"));
    const metaLine = lines.find((line) => line.startsWith("- Type:"));
    const url = linkLine ? linkLine.replace("- Link:", "").trim() : "";
    return {
      id: `prep-${index + 1}`,
      title,
      group: "Agent prep queue",
      type: title.toLowerCase().includes("supplier") || title.toLowerCase().includes("procurement") ? "vendor registration" : "tender",
      priority: index < 4 ? 9 : 8,
      ahmadAction: "No action unless agent brings it to final-click stage.",
      agentContinuation: (nextLine ? nextLine.replace("- Next step:", "").trim() : "Research and prepare packet, then stop before submit/send."),
      detail: [metaLine, deadlineLine].filter(Boolean).join(" | "),
      links: url ? [{ label: "Open source", url }] : [],
      finalGate: "Submit / Register / Send"
    };
  });
}

function makeContractBidActions(prepItems) {
  return prepItems
    .filter((item) => item.type === "tender" || item.type === "vendor registration")
    .map((item, index) => {
      const isVendor = item.type === "vendor registration";
      const organization = item.title.includes(" - ") ? item.title.split(" - ").slice(-1)[0].trim() : item.title;
      const deadlineMatch = item.detail?.match(/Deadline:\s*([^|]+)/i);
      const timeline = deadlineMatch ? deadlineMatch[1].trim() : "Not listed";
      return {
        ...item,
        id: `contract-${item.id}`,
        sourceActionId: item.id,
        group: isVendor ? "Vendor portal" : "Contract / tender",
        type: isVendor ? "vendor registration" : "contract/bid",
        title: item.title,
        priority: item.priority || (isVendor ? 8 : 9),
        ahmadAction: "Only fill fields the agent cannot safely answer: legal/certification/cost/sensitive upload/unknown required items. Then authorize only if correct.",
        agentContinuation: "Agent should fill everything safe from known company data. Return only for legal, cost, certification, unknown required, sensitive upload, credential, or failed-submit blockers.",
        finalGate: isVendor ? "Authorize live registration submit" : "Authorize live bid submit",
        contractBrief: {
          organization,
          estimatedValue: "Unknown / to confirm",
          termLength: "Unknown / to confirm",
          extensions: "Unknown / to confirm",
          timeline,
          currentStatus: "queued",
          decision: "Show only if not actioned, blocked, failed, or needs CEO-only fields",
          sourceActionId: item.id
        },
        formFields: [
          { key: "blocker_summary", label: "What the live form needs from Ahmad", type: "textarea", required: true },
          { key: "legal_attestation_answer", label: "Legal attestation / declaration answer", type: "textarea", required: false },
          { key: "certification_confirmation", label: "Certification confirmation", type: "textarea", required: false },
          { key: "final_price_or_cap", label: "Final price / max bid / financial limit", type: "text", required: false },
          { key: "sensitive_upload_instruction", label: "Sensitive upload/document instruction", type: "textarea", required: false },
          { key: "credential_captcha_status", label: "Credential/CAPTCHA/MFA status", type: "text", required: false },
          { key: "submit_conditions", label: "Submit conditions / CEO limits", type: "textarea", required: true }
        ],
        bidStatusOptions: [
          "queued",
          "fields_needed",
          "submit_authorized",
          "submitted",
          "under_review",
          "approved",
          "won",
          "rejected",
          "failed_submit",
          "needs_info",
          "parked"
        ]
      };
    });
}

const now = new Date().toISOString();
const today = todayIsoDate();
const digest = read("senior-director-state/ceo-now-action-digest.md");
const approvals = read("senior-director-state/ceo-approval-required.md");
const brief = read("senior-director-state/business-development-daily-brief.md");
const drafts = read("senior-director-state/revenue-outreach-drafts.md");
const handoff = read("senior-director-state/active-agent-handoff.md");

const reviewFiles = STAGED_REVIEW_FILES.filter(({ relPath }) =>
  fs.existsSync(path.join(repoRoot, relPath))
);

const immediateActions = [
  {
    id: "telus-supplier-registration",
    title: "TELUS supplier registration final gate",
    group: "Register / supplier portal",
    type: "vendor registration",
    priority: 10,
    ahmadAction: "Review the restaged SAP Ariba form, enter password/consent only if accurate, then click Register only if everything is true.",
    agentContinuation: "After Ahmad marks Done, log TELUS registration status and queue the next enterprise supplier lane.",
    detail: "The live TELUS SAP Ariba form is restaged with verified IIS company/contact fields. Agent must not create the account or accept consent on Ahmad's behalf.",
    links: [
      { label: "Open TELUS procurement", url: "https://www.telus.com/en/about/procurement" },
      { label: "Open TELUS handoff", url: publicFile("senior-director-state/telus-live-registration-handoff-2026-06-27.md") }
    ],
    finalGate: "Register / Create Account / Consent"
  },
  today >= WARM_LEAD_SEND_GATE_DATE ? {
    id: "july-2-warm-lead-send-gate",
    title: "July 2 warm lead send gate",
    group: "Warm lead",
    type: "lead",
    priority: 10,
    ahmadAction: "Check LinkedIn reply state first. If Jason Brown and/or Azim Lila are still silent, send or hold the prepared follow-up for each person. If either replied, hold that message and mark Needs Agent.",
    agentContinuation: "If either follow-up is sent, set the next cadence. If either person replied, prepare a tailored response and opportunity note instead of using the staged copy.",
    detail: "Use the combined July 2 gate plus the office-move and AI workflow one-pagers for any reply asking for more detail.",
    links: [
      { label: "Open July 2 gate", url: publicFile("senior-director-state/july-02-warm-lead-send-gate-2026-07-01.md") },
      { label: "Open one-pager", url: publicFile("senior-director-state/office-move-property-it-readiness-one-pager-2026-06-11.md") },
      { label: "Open AI workflow one-pager", url: publicFile("senior-director-state/ai-workflow-quick-win-sprint-one-pager-2026-06-10.md") },
      { label: "Open LinkedIn messages", url: "https://www.linkedin.com/messaging/" }
    ],
    copyText: "Check the July 2 warm lead send gate file for the final Jason Brown and Azim Lila follow-up copy. Send only after confirming there is still no reply.",
    finalGate: "Send"
  } : null,
  {
    id: "publish-approved-slices",
    title: "Publish already-approved website slices",
    group: "Website publish",
    type: "publish",
    priority: 9,
    ahmadAction: "Approve production publish when ready. Local work is staged; risky production publish remains Ahmad-only.",
    agentContinuation: "After Done, verify production pages and continue conversion improvements.",
    detail: "Approved slices: operations conversion, homepage contact-intake context upgrade, Growth Library conversion.",
    links: [
      { label: "Open Netlify dashboard", url: "https://app.netlify.com/" },
      { label: "Open local site", url: "http://127.0.0.1:8765/" }
    ],
    finalGate: "Publish"
  }
].filter(Boolean);

const publishReviewActions = reviewFiles.map(({ relPath, title }, index) => ({
  id: `review-${path.basename(relPath, ".md")}`,
  title,
  group: "Publish review",
  type: "publish",
  priority: index < 6 ? 8 : 7,
  ahmadAction: "Open review. Approve publish or hold local only.",
  agentContinuation: "If approved, prepare publish path and stop at production publish. If held, keep local and continue next revenue work.",
  detail: relPath,
  links: [{ label: "Open review file", url: publicFile(relPath) }],
  finalGate: "Approve publish / Hold"
}));

const acceptanceActions = extractAcceptanceQueue(brief);
const prepActions = extractPrepItems(handoff);
const contractBidActions = makeContractBidActions(prepActions);
const growthActions = [
  {
    id: "growth-lead-engine",
    title: "Find new qualified revenue leads",
    group: "Growth engine",
    type: "internal work",
    priority: 10,
    ahmadAction: "No action unless the agent brings back a qualified lead, draft, or final-send item.",
    agentContinuation: "Find no-cost, legally usable leads in target sectors; qualify fit; draft messages; queue final sends in the dashboard.",
    detail: "Focus: banks, government, healthcare, education, law, financial/accounting firms, SMBs, enterprise overflow, AI/M365/IT support buyers.",
    finalGate: "Send / Contact / Submit"
  },
  {
    id: "growth-contract-staffing-lane",
    title: "Remote contract staffing / subcontracting lane",
    group: "Revenue model",
    type: "internal work",
    priority: 9,
    ahmadAction: "Review only if a compliant high-salary remote role or contract is ready.",
    agentContinuation: "Look for remote roles/contracts where staffing, subcontracting, or agency delivery is allowed; avoid misrepresentation; prepare compliant staffing plan and margin math.",
    detail: "Only legal/transparent opportunities. If subcontracting is not allowed, park it. Track salary/rate, margin, training need, and delivery risk.",
    finalGate: "Apply / Contract / Hire"
  },
  {
    id: "growth-aria-products",
    title: "Create new ARIA/IIS service products",
    group: "ARIA products",
    type: "internal work",
    priority: 9,
    ahmadAction: "Approve only when a product/page/offer is ready to publish or sell.",
    agentContinuation: "Package new sellable services: AI workflow audit, M365 tune-up, helpdesk automation, support overflow, website AI intake, office move readiness, compliance/audit prep.",
    detail: "Every product should have buyer, problem, deliverable, price range, proof, upsell path, and one-page offer.",
    finalGate: "Publish / Sell"
  },
  {
    id: "growth-claude-sync",
    title: "Share current work and learnings with Claude/agents",
    group: "Agent coordination",
    type: "internal work",
    priority: 8,
    ahmadAction: "No action unless conflicting agent guidance appears.",
    agentContinuation: "Mirror new dashboard rules, opportunities, leads, product ideas, docs, and lessons into Claude/agent handoff files.",
    detail: "Agents must learn from dashboard notes and reduce Ahmad explanation burden every cycle.",
    finalGate: "None"
  },
  {
    id: "growth-corp-docs",
    title: "Maintain IIS corporate documentation",
    group: "Operations",
    type: "internal work",
    priority: 8,
    ahmadAction: "Approve only for legal/tax/payroll submissions or irreversible company records.",
    agentContinuation: "Keep documentation folders organized for leads, contracts, hiring/onboarding, expenses, payroll, CRA/tax, compliance, regulatory, audit, insurance, invoices, and vendor registrations.",
    detail: "Track every work item and expense for year-end taxes and operational memory.",
    finalGate: "Submit / Sign / Pay / File"
  },
  {
    id: "growth-dashboard-health",
    title: "Keep dashboard non-empty and useful",
    group: "Operating system",
    type: "internal work",
    priority: 8,
    ahmadAction: "No action unless dashboard becomes noisy or low quality.",
    agentContinuation: "If active queue is empty, add qualified opportunities, action plans, improvement ideas, product/service ideas, documentation tasks, and next best revenue work.",
    detail: "Empty dashboard means agents should search, prepare, improve, document, or package the next revenue/growth action.",
    finalGate: "None"
  }
];

const data = {
  version: 1,
  generatedAt: now,
  mission: "Put every final-click approval in one screen, then let agents continue without Ahmad repeating instructions.",
  rules: [
    "No cost unless Ahmad explicitly approves.",
    "No legal/reputation risk, false claims, platform abuse, spam, scraping, or Raymond James involvement.",
    "Agents prepare to the final gate. Ahmad clicks Send, Submit, Apply, Register, Certify, Pay, Publish, Delete, or irreversible approval.",
    "After Ahmad marks Approve, Accept, Reject, Done, Hold, or Needs Agent, agents read this console state and continue from there.",
    "Notes on console cards are CEO coaching signals. Agents must apply them to the current item and improve future drafts, scoring, targeting, and prep without asking Ahmad to repeat himself.",
    "When console state includes a Proceed request, agents continue approved/accepted/done/needs-agent work, park held/rejected work, and do not ask Ahmad to restate next steps.",
    "Contracts/Bids dashboard fields are the single source for form-fill values. Authorize fill + submit applies only to the specific item and saved field values shown.",
    "The dashboard should rarely be empty. If approvals are cleared, agents add qualified opportunities, internal work, revenue plans, ARIA products, leads, documentation tasks, or improvement ideas."
  ],
  counts: {
    immediate: immediateActions.length,
    publishReviews: publishReviewActions.length,
    acceptanceChecks: acceptanceActions.length,
    prepQueue: prepActions.length,
    contractsBids: contractBidActions.length,
    growthActions: growthActions.length
  },
  sources: [
    "senior-director-state/ceo-now-action-digest.md",
    "senior-director-state/ceo-approval-required.md",
    "senior-director-state/business-development-daily-brief.md",
    "senior-director-state/revenue-outreach-drafts.md",
    "senior-director-state/active-agent-handoff.md"
  ],
  rawSignals: {
    digestUpdatedLine: digest.split(/\r?\n/).find((line) => line.startsWith("Updated:")) || "",
    approvalsUpdatedLine: approvals.split(/\r?\n/).find((line) => line.startsWith("Updated:")) || "",
    briefGeneratedLine: brief.split(/\r?\n/).find((line) => line.startsWith("Generated:")) || "",
    draftsUpdatedLine: drafts.split(/\r?\n/).find((line) => line.startsWith("Updated:")) || ""
  },
  sections: [
    { id: "do-now", title: "Do Now", actions: immediateActions },
    { id: "publish-review", title: "Publish / Hold Review", actions: publishReviewActions },
    { id: "linkedin-checks", title: "LinkedIn Acceptance Checks", actions: acceptanceActions },
    { id: "contracts-bids", title: "Contracts / Bids", actions: contractBidActions },
    { id: "growth-work", title: "Growth / Internal Work", actions: growthActions },
    { id: "agent-prep", title: "Agents Keep Working", actions: prepActions }
  ]
};

fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

if (!fs.existsSync(persistedStatePath)) {
  fs.writeFileSync(
    persistedStatePath,
    `${JSON.stringify({ version: 1, updatedAt: now, actions: {}, notes: [] }, null, 2)}\n`,
    "utf8"
  );
}

console.log(`CEO action console data written: ${outPath}`);
