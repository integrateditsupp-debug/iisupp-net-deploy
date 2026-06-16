import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishAgentReport } from "./autonomy-supervisor-core.mjs";

const root = process.cwd();
const engineDir = path.join(root, "senior-director-state", "opportunity-engine");
const dbPath = path.join(engineDir, "opportunities.json");
const logPath = path.join(engineDir, "actions-log.json");
const nowIso = () => new Date().toISOString();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function docsFor(item) {
  if (item.type === "job") {
    return ["Default AI Engineer resume", "LinkedIn/profile link", "Short cover message", "Work authorization answer"];
  }
  if (item.type === "vendor registration") {
    return [
      "Company profile",
      "Services summary",
      "Insurance/certification checklist",
      "Owner/contact details",
      "References/case studies if required"
    ];
  }
  if (item.type === "tender") {
    return ["Bid/no-bid brief", "Compliance matrix", "Company profile", "Pricing approach", "Required forms"];
  }
  return ["Company one-pager", "Relevant service pitch", "Discovery-call ask"];
}

function missingFor(item) {
  const missing = [];
  if (!item.deadline && (item.type === "tender" || item.type === "contract")) missing.push("deadline");
  if (!item.estimatedValueOrSalary) missing.push(item.type === "job" ? "salary range" : "estimated value");
  if (!item.contactDetails && item.type === "lead") missing.push("public contact");
  if (item.type === "vendor registration") missing.push("portal requirements review");
  return missing;
}

function shortSummary(item) {
  const score = `Priority ${item.priorityScore}/10, difficulty ${item.difficultyScore}/10`;
  const value = item.estimatedValueOrSalary ? `Value/salary: ${item.estimatedValueOrSalary}.` : "";
  return `${item.title} at ${item.organization}. ${score}. ${value} Fit: ${item.whyRelevant}.`;
}

function draftFor(item) {
  if (item.type === "job") {
    return `Hi, I am interested in ${item.title}. My background covers AI engineering, automation, IT support, and practical delivery across business systems. I can bring hands-on execution, clear troubleshooting, and disciplined client-facing communication. I would like to be considered for this role and can provide more detail on relevant work.`;
  }
  if (item.type === "vendor registration") {
    return `Hello, I am reviewing supplier registration for Integrated IT Support. We provide IT support, AI workflow automation, Microsoft 365 support, website/software implementation, and cybersecurity-aligned operational help. Please confirm the correct vendor onboarding path and any required documents for a small technology services provider.`;
  }
  if (item.type === "tender") {
    return `Integrated IT Support is reviewing this opportunity. Initial fit appears strongest around IT support, AI automation, Microsoft 365, cybersecurity, software, or managed-service delivery. Next step is to confirm mandatory requirements, deadline, pricing format, and submission portal before Ahmad approves any final submission.`;
  }
  return `Hello, I noticed a possible fit between your organization and Integrated IT Support. We help teams reduce IT friction, improve Microsoft 365/support operations, automate repetitive workflows, and fix weak web/software processes. If useful, we can quickly identify one practical improvement area and outline a low-friction next step.`;
}

function recommendedStatus(item) {
  if (isPastDeadline(item.deadline)) return "ignored";
  if (item.priorityScore >= 8 && item.difficultyScore <= 7) return "needs_review";
  if (item.priorityScore >= 7) return "queued";
  return item.status === "new" ? "new" : item.status;
}

function isPastDeadline(deadline) {
  if (!deadline || String(deadline).startsWith("9999")) return false;
  const normalized = String(deadline).replace(/\//g, "-");
  const due = new Date(`${normalized}T23:59:59`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function reminderFor(item) {
  if (["submitted", "ignored"].includes(item.status)) return null;
  const days = item.priorityScore >= 8 ? 1 : item.priorityScore >= 6 ? 3 : 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function main() {
  const db = await readJson(dbPath, { version: 1, items: [] });
  const log = await readJson(logPath, { version: 1, actions: [] });
  let updated = 0;

  const items = (db.items || []).map((item) => {
    const next = {
      ...item,
      summary: item.summary && item.summary.length > 80 ? item.summary : shortSummary(item),
      draftMessage: item.draftMessage || draftFor(item),
      requiredDocuments: item.requiredDocuments?.length ? item.requiredDocuments : docsFor(item),
      missingInformation: missingFor(item),
      recommendedNextStep:
        item.recommendedNextStep ||
        "Review fit, prepare materials, and stop before final external action.",
      nextReminderAt: item.nextReminderAt || reminderFor(item)
    };
    if ((item.status === "new" && next.priorityScore >= 7) || isPastDeadline(next.deadline)) {
      next.status = recommendedStatus(next);
    }
    if (JSON.stringify(next) !== JSON.stringify(item)) updated += 1;
    return next;
  });

  await writeFile(dbPath, JSON.stringify({ ...db, updated: nowIso(), items }, null, 2));
  log.actions.push({
    at: nowIso(),
    agent: "review-submission-agent",
    action: "review_prepared",
    updated,
    totalItems: items.length,
    result: "ok"
  });
  await writeFile(logPath, JSON.stringify({ version: 1, updated: nowIso(), actions: log.actions.slice(-1000) }, null, 2));
  await publishAgentReport({
    agentId: "opportunity-review-agent",
    label: "Opportunity Review Agent",
    summary: "Opportunity records were enriched with summaries, drafts, reminders, and required-document scaffolding.",
    metrics: {
      reviewedItems: items.length,
      updatedItems: updated
    },
    artifacts: [dbPath, logPath],
    nextActions: [
      items.length ? "Feed reviewed items into quality gate and prep packets." : null
    ].filter(Boolean),
    focusAreas: ["opportunity-enrichment", "draft-preparation", "reminder-scheduling"]
  });
  console.log(JSON.stringify({ ok: true, reviewed: items.length, updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
