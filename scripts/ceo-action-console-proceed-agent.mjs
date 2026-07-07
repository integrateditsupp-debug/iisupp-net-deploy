import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STAGED_REVIEW_FILES } from "./staged-review-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(repoRoot, "senior-director-state");
const dataPath = path.join(stateDir, "ceo-action-console-data.json");
const statePath = path.join(stateDir, "ceo-action-console-state.json");
const outMd = path.join(stateDir, "ceo-action-console-proceed-plan.md");
const outJson = path.join(stateDir, "ceo-action-console-proceed-plan.json");
const handoffPath = path.join(stateDir, "active-agent-handoff.md");
const commandUpdatePath = path.join(stateDir, "iis-aria-command-update.md");
const queuePath = path.join(stateDir, "codex-claude-queue.md");
const websitePackagePath = path.join(stateDir, "website-publish-staging-package-2026-06-12.md");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function append(filePath, text) {
  fs.appendFileSync(filePath, `\n${text.trim()}\n`, "utf8");
}

function allActions(data) {
  return (data.sections || []).flatMap((section) =>
    (section.actions || []).map((action) => ({ ...action, sectionTitle: section.title }))
  );
}

function groupByStatus(actions, state) {
  const buckets = {
    submitAuthorized: [],
    advance: [],
    agent: [],
    done: [],
    parked: [],
    open: []
  };
  for (const action of actions) {
    const saved = state.actions?.[action.id] || {};
    const status = saved.status || "open";
    const item = { ...action, status, note: saved.note || "", updatedAt: saved.updatedAt || "" };
    if (status === "submit_authorized") buckets.submitAuthorized.push(item);
    else if (status === "approve" || status === "accept") buckets.advance.push(item);
    else if (status === "agent") buckets.agent.push(item);
    else if (status === "done") buckets.done.push(item);
    else if (status === "hold" || status === "reject") buckets.parked.push(item);
    else buckets.open.push(item);
  }
  return buckets;
}

function actionLine(item, index) {
  const note = item.note ? `\n   - CEO note: ${item.note}` : "";
  return `${index + 1}. ${item.title}
   - Status: ${item.status}
   - Type: ${item.type}; group: ${item.group}
   - Agent next: ${item.agentContinuation || "Continue safe prep and stop at final gate."}
   - Final gate: ${item.finalGate || "Unknown"}${note}`;
}

function parseStagedFiles(markdown) {
  const match = markdown.match(/## Files staged locally\s*([\s\S]*?)(?:\n## |\s*$)/);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").replace(/^`|`$/g, ""));
}

function buildReviewActionId(relPath) {
  return `review-${path.basename(relPath, ".md")}`;
}

function websiteReviewStatus(item, state) {
  const saved = state.actions?.[buildReviewActionId(item.relPath)] || {};
  const status = saved.status || "";
  const approvedByDashboard = status === "approve" || status === "accept";
  const approvedByRegistry = item.status === "approved";
  return {
    status: status || (approvedByRegistry ? "approved" : "open"),
    approved: approvedByDashboard || approvedByRegistry,
    approvedByDashboard
  };
}

function buildWebsitePublishPackage(actions, state, now) {
  const approvedCore = STAGED_REVIEW_FILES
    .filter((item) => item.status === "approved")
    .map((item) => ({
      ...item,
      status: websiteReviewStatus(item, state).status
    }));

  const approvedLocal = STAGED_REVIEW_FILES
    .filter((item) => item.status === "local_only")
    .map((item) => ({
      ...item,
      ...websiteReviewStatus(item, state)
    }))
    .filter((item) => item.approved);

  const stagedFiles = new Set();
  for (const item of [...approvedCore, ...approvedLocal]) {
    const reviewPath = path.join(repoRoot, item.relPath);
    if (!fs.existsSync(reviewPath)) continue;
    const markdown = fs.readFileSync(reviewPath, "utf8");
    for (const file of parseStagedFiles(markdown)) {
      stagedFiles.add(file);
    }
  }

  const stagedPages = [...stagedFiles]
    .filter((file) => file.endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));
  const stagedArtifacts = [...stagedFiles]
    .filter((file) => !file.endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));

  const packageBody = `# Website Publish Staging Package

Generated: ${now}

Purpose: Ahmad already approved the core publish set and approved/accepted additional local-only website review slices in the CEO Action Console. This package moves those items to the staging/pre-publish lane only. It does not perform production publish.

## Safety Gate
- No production publish here.
- No paid service.
- No legal/compliance claim change without review.
- Stop at the production publish button unless Ahmad performs or explicitly re-confirms that final gate.

## Approved Core Website Items
1. Publish already-approved website slices
   - Console status: ${state.actions?.["publish-approved-slices"]?.status || "approve"}
   - Next: verify local staged pages, group changed files, and prepare publish checklist.
${approvedCore.map((item, index) => `${index + 2}. ${item.title}
   - Review: \`${item.relPath}\`
   - Status source: ${item.status}`).join("\n")}

## Approved Local-Only Website Review Items
${approvedLocal.length ? approvedLocal.map((item, index) => `${index + 1}. ${item.title}
   - Review: \`${item.relPath}\`
   - Console status: ${item.status}
   - Next: include in publish grouping, then stop before production publish.`).join("\n") : "- None yet."}

## Files Grouped For Staging
${stagedPages.length ? stagedPages.map((file) => `- \`${file}\``).join("\n") : "- No staged HTML pages detected."}
${stagedArtifacts.length ? `${stagedArtifacts.map((file) => `- \`${file}\``).join("\n")}` : ""}

## Agent Work Before Returning To Ahmad
1. Verify local pages at \`http://127.0.0.1:8765/\`.
2. Confirm approved slices are present and not breaking desktop/mobile layout.
3. Prepare the deploy grouping from the staged file set above.
4. Stop before production publish unless Ahmad clicks the final publish gate.

## CEO Dashboard Link
- Proceed plan: \`senior-director-state/ceo-action-console-proceed-plan.md\`
- Console state: \`senior-director-state/ceo-action-console-state.json\`
`;

  fs.writeFileSync(websitePackagePath, packageBody, "utf8");
  return {
    approvedCoreCount: approvedCore.length,
    approvedLocalCount: approvedLocal.length,
    stagedFileCount: stagedFiles.size
  };
}

const data = readJson(dataPath, { sections: [] });
const state = readJson(statePath, { actions: {}, notes: [] });
const now = new Date().toISOString();
const actions = allActions(data);
const buckets = groupByStatus(actions, state);
const proceed = state.proceed || null;
const websitePackage = buildWebsitePublishPackage(actions, state, now);

const plan = {
  version: 1,
  generatedAt: now,
  proceed,
  counts: {
    submitAuthorized: buckets.submitAuthorized.length,
    advance: buckets.advance.length,
    agent: buckets.agent.length,
    done: buckets.done.length,
    parked: buckets.parked.length,
    open: buckets.open.length
  },
  buckets
};

const nextMoves = [
  `1. Advance approved/accepted website items only to publish staging and verification notes using \`${path.relative(repoRoot, websitePackagePath).replaceAll("\\", "/")}\`. Stop before production publish unless Ahmad explicitly performs the publish gate.`,
  "2. Submit-authorized Contracts/Bids may be filled/submitted only with exact saved dashboard fields and only if no new legal/cost/certification/upload/credential/unknown field appears.",
  "3. For LinkedIn/contact items marked Needs Agent, prepare/check next action only. Do not send, connect, scrape, or message autonomously.",
  "4. TELUS is marked done only after Ahmad completes the live registration gate. Track future email/inbox/status evidence; do not create new registrations without a final gate.",
  "5. Held items stay parked until Ahmad reopens them.",
  "6. Open items remain visible in the CEO dashboard."
];

function submitAuthorizedLine(item, index) {
  const contract = state.contracts?.[item.id] || {};
  const fields = contract.fields || {};
  const fieldLines = Object.entries(fields)
    .map(([key, value]) => `   - ${key}: ${value || "(blank)"}`)
    .join("\n") || "   - No saved fields.";
  return `${index + 1}. ${item.title}
   - Status: ${item.status}
   - Type: ${item.type}; group: ${item.group}
   - Agent next: Fill the live form using saved fields only, then click submit only if no new hard-stop field appears.
   - Final gate authorized: ${item.finalGate || "Submit"}
${fieldLines}`;
}

const md = `# CEO Action Console Proceed Plan

Generated: ${now}

Need-to-know:
- Proceed request: ${proceed?.requestedAt || "none found"}
- Submit authorized: ${buckets.submitAuthorized.length}
- Advance approved/accepted: ${buckets.advance.length}
- Needs Agent: ${buckets.agent.length}
- Done / monitor: ${buckets.done.length}
- Parked: ${buckets.parked.length}
- Still open on dashboard: ${buckets.open.length}

## Next Moves
${nextMoves.map((line) => `- ${line}`).join("\n")}

## Submit Authorized Contracts / Bids
${buckets.submitAuthorized.length ? buckets.submitAuthorized.map(submitAuthorizedLine).join("\n\n") : "- None."}

## Advance Approved / Accepted
${buckets.advance.length ? buckets.advance.map(actionLine).join("\n\n") : "- None."}

## Needs Agent
${buckets.agent.length ? buckets.agent.map(actionLine).join("\n\n") : "- None."}

## Done / Monitor
${buckets.done.length ? buckets.done.map(actionLine).join("\n\n") : "- None."}

## Parked
${buckets.parked.length ? buckets.parked.map(actionLine).join("\n\n") : "- None."}

## Still Open
${buckets.open.length ? buckets.open.map(actionLine).join("\n\n") : "- None."}

## Standing Safety
- No cost.
- No external send, apply, connect, message, certify, sign, pay, purchase, subscribe, account creation, destructive cleanup, platform abuse, scraping, false claim, legal/reputation risk, Raymond James involvement, or risky production publish.
- Exception: contract/bid items with status \`submit_authorized\` may be filled and submitted only for that exact item using saved dashboard fields, unless a new hard-stop field appears.
- Keep preparing to the final gate and route the next CEO action back into the dashboard.
`;

fs.writeFileSync(outJson, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
fs.writeFileSync(outMd, md, "utf8");

const handoffUpdate = `## ${now} - CEO Dashboard Proceed Consumed

Proceed file: \`senior-director-state/ceo-action-console-proceed-plan.md\`

- Submit authorized: ${buckets.submitAuthorized.length}
- Advance approved/accepted: ${buckets.advance.length}
- Needs Agent: ${buckets.agent.length}
- Done / monitor: ${buckets.done.length}
- Parked: ${buckets.parked.length}
- Still open: ${buckets.open.length}

Agent rule: continue from the proceed plan without asking Ahmad to repeat instructions. Stop again only at true final gates.`;

append(handoffPath, handoffUpdate);
append(commandUpdatePath, `## CEO Dashboard Proceed\n- Latest: ${now}\n- Plan: \`senior-director-state/ceo-action-console-proceed-plan.md\`\n- Website staging package: \`senior-director-state/website-publish-staging-package-2026-06-12.md\`\n- Continue submit-authorized/approved/accepted/done/needs-agent work from saved dashboard state; parked items stay parked; open items stay on dashboard.`);
append(queuePath, `## ${now} - CEO Dashboard Proceed\n\nProceed consumed into \`senior-director-state/ceo-action-console-proceed-plan.md\`.\n\nWebsite staging package refreshed: \`senior-director-state/website-publish-staging-package-2026-06-12.md\`.\n\nCounts: submit-authorized ${buckets.submitAuthorized.length}; advance ${buckets.advance.length}; needs-agent ${buckets.agent.length}; done/monitor ${buckets.done.length}; parked ${buckets.parked.length}; open ${buckets.open.length}; approved core website items ${websitePackage.approvedCoreCount}; approved local website items ${websitePackage.approvedLocalCount}; staged files ${websitePackage.stagedFileCount}.\n\nClaude/agents should continue from this board and stop only at final gates.`);

console.log(`Proceed plan written: ${outMd}`);
