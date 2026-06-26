import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const cwd = process.cwd();
const outDir = path.join(cwd, "outputs", "sourcewell-rfp061726");
const outFile = path.join(outDir, "sourcewell-rfp061726-lot2-pricing-draft.xlsx");

const workbook = Workbook.create();

function write(sheet, range, values) {
  sheet.getRange(range).values = values;
}

function width(sheet, range, px) {
  sheet.getRange(range).format.columnWidthPx = px;
}

function moneyFormat(sheet, range) {
  sheet.getRange(range).format.numberFormat = "$#,##0";
}

function rateFormat(sheet, range) {
  sheet.getRange(range).format.numberFormat = "$#,##0";
}

const summary = workbook.worksheets.add("Executive Summary");
write(summary, "A1:F1", [["Sourcewell RFP 061726 - Lot 2 Pricing Draft", "", "", "", "", ""]]);
write(summary, "A3:B11", [
  ["Opportunity", "Enterprise Artificial Intelligence: Platforms, Services, and Integrated Delivery"],
  ["Recommended Primary Lot", "Lot 2 - AI Professional Services"],
  ["Status", "Draft for Ahmad approval; not final pricing"],
  ["Proposal Due", "2026-06-17 3:30 PM Central"],
  ["Pricing Score", "250 points per Amendment 1"],
  ["Admin Fee Assumption", "2% included in prices"],
  ["FX Assumption", "1 USD = 1.38 CAD draft conversion"],
  ["Submission Note", "Upload only after final legal, pricing, and truth/accuracy review"],
  ["Pricing Model", "Fixed packages + NTE role rates + managed services tiers + volume discounts"],
]);
write(summary, "A13:D18", [
  ["Service Category", "Draft USD", "Draft CAD", "Purpose"],
  ["Lowest entry package", "=MIN(Packages!C2:C10)", "=MIN(Packages!D2:D10)", "Easy first purchase"],
  ["Largest fixed package", "=MAX(Packages!C2:C10)", "=MAX(Packages!D2:D10)", "Advanced pilot/enterprise work"],
  ["Lowest hourly rate", "=MIN('Rate Card'!B2:B13)", "=MIN('Rate Card'!C2:C13)", "Transparent role pricing"],
  ["Highest hourly rate", "=MAX('Rate Card'!B2:B13)", "=MAX('Rate Card'!C2:C13)", "Senior advisory ceiling"],
  ["Maximum volume discount", "=MAX(Discounts!B2:B6)", "", "Supports expected volume pricing"],
]);
summary.freezePanes.freezeRows(1);
width(summary, "A:A", 210);
width(summary, "B:B", 520);
width(summary, "C:C", 160);
width(summary, "D:D", 380);

const packages = workbook.worksheets.add("Packages");
write(packages, "A1:H1", [["Package", "Description", "Draft NTE USD", "Draft NTE CAD", "Delivery Window", "Included Deliverables", "Exclusions", "Approval Status"]]);
const packageRows = [
  ["AI Readiness QuickStart", "Discovery, current-state review, use-case scoring, and 30/60/90 roadmap", 18500, "=ROUND(C2*Assumptions!B2,-2)", "2 weeks", "Stakeholder interviews; readiness score; roadmap; executive briefing", "Third-party tools; travel; implementation", "Ahmad approval needed"],
  ["Responsible AI Governance Toolkit", "Policy, acceptable use, intake/risk workflow, oversight model, incident playbook", 24500, "=ROUND(C3*Assumptions!B2,-2)", "3-4 weeks", "Policy pack; risk intake; oversight workflow; incident playbook", "Legal opinion; external audit", "Ahmad approval needed"],
  ["AI Pilot Sprint - Standard", "One workflow pilot with UAT, documentation, and launch plan", 58500, "=ROUND(C4*Assumptions!B2,-2)", "4-6 weeks", "Pilot design; build/configuration; UAT; launch readiness", "Cloud/API costs; custom security testing", "Ahmad approval needed"],
  ["AI Pilot Sprint - Advanced", "Advanced pilot with integrations, analytics, and change management", 98000, "=ROUND(C5*Assumptions!B2,-2)", "8-10 weeks", "Architecture; integrations; testing; adoption plan; reporting", "Third-party licensing; onsite travel", "Ahmad approval needed"],
  ["Workflow Automation Build", "AI-enabled intake, routing, summarization, retrieval, or reporting workflow", 42500, "=ROUND(C6*Assumptions!B2,-2)", "4-8 weeks", "Requirements; workflow build; SOP; admin handoff", "Major platform procurement", "Ahmad approval needed"],
  ["Managed AI Operations - Essential", "Monthly monitoring, updates, reporting, and support queue", 9500, "=ROUND(C7*Assumptions!B2,-2)", "Monthly", "Usage review; quality checks; monthly report; support queue", "24x7 support; platform fees", "Ahmad approval needed"],
  ["Managed AI Operations - Standard", "Essential plus governance reviews, analytics, and improvement backlog", 18500, "=ROUND(C8*Assumptions!B2,-2)", "Monthly", "All Essential items; governance review; analytics; backlog", "24x7 support; new major builds", "Ahmad approval needed"],
  ["Managed AI Operations - Enterprise", "Expanded support for multiple workflows/models and monthly steering", 37500, "=ROUND(C9*Assumptions!B2,-2)", "Monthly", "All Standard items; multiple workflows; steering meeting", "Dedicated onsite staff", "Ahmad approval needed"],
  ["AI Training Workshop", "Role-based AI literacy, governance, admin, or adoption training", 6500, "=ROUND(C10*Assumptions!B2,-2)", "Per day", "Workshop; deck; attendance; Q&A", "Custom LMS build; travel", "Ahmad approval needed"],
];
write(packages, "A2:H10", packageRows);
packages.freezePanes.freezeRows(1);
width(packages, "A:A", 240);
width(packages, "B:B", 420);
width(packages, "C:D", 130);
width(packages, "E:E", 140);
width(packages, "F:G", 360);
width(packages, "H:H", 180);
moneyFormat(packages, "C2:D10");

const rates = workbook.worksheets.add("Rate Card");
write(rates, "A1:E1", [["Role", "Draft NTE USD / Hour", "Draft NTE CAD / Hour", "Use", "Approval Status"]]);
const rateRows = [
  ["Executive AI Strategy Lead", 275, "=ROUND(B2*Assumptions!B2,0)", "Executive workshops, roadmap, governance", "Ahmad approval needed"],
  ["AI Solution Architect", 240, "=ROUND(B3*Assumptions!B2,0)", "Architecture, solution design, model/vendor selection", "Ahmad approval needed"],
  ["Responsible AI / Governance Lead", 225, "=ROUND(B4*Assumptions!B2,0)", "Policies, risk, controls, oversight", "Ahmad approval needed"],
  ["AI Automation Engineer", 195, "=ROUND(B5*Assumptions!B2,0)", "Workflow implementation, prompt/RAG/agents", "Ahmad approval needed"],
  ["Microsoft 365 / Azure AI Specialist", 190, "=ROUND(B6*Assumptions!B2,0)", "M365, Azure, Copilot, Entra, integration", "Ahmad approval needed"],
  ["Data / Knowledge Engineer", 185, "=ROUND(B7*Assumptions!B2,0)", "Knowledge base, retrieval, data preparation", "Ahmad approval needed"],
  ["ITSM / Support Automation Specialist", 175, "=ROUND(B8*Assumptions!B2,0)", "Service desk, ticketing, operations workflows", "Ahmad approval needed"],
  ["Business Analyst / Process Analyst", 150, "=ROUND(B9*Assumptions!B2,0)", "Discovery, requirements, process design", "Ahmad approval needed"],
  ["Trainer / Change Lead", 145, "=ROUND(B10*Assumptions!B2,0)", "Training, adoption, materials", "Ahmad approval needed"],
  ["Project Manager", 165, "=ROUND(B11*Assumptions!B2,0)", "Delivery governance, reporting, schedule", "Ahmad approval needed"],
  ["QA / UAT Analyst", 135, "=ROUND(B12*Assumptions!B2,0)", "Test plans, acceptance, quality checks", "Ahmad approval needed"],
  ["Technical Writer", 125, "=ROUND(B13*Assumptions!B2,0)", "SOPs, user guides, admin docs", "Ahmad approval needed"],
];
write(rates, "A2:E13", rateRows);
rates.freezePanes.freezeRows(1);
width(rates, "A:A", 270);
width(rates, "B:C", 155);
width(rates, "D:D", 380);
width(rates, "E:E", 180);
rateFormat(rates, "B2:C13");

const discounts = workbook.worksheets.add("Discounts");
write(discounts, "A1:C1", [["Annual Purchase Volume", "Proposed Discount", "Notes"]]);
write(discounts, "A2:C6", [
  ["Under USD 100,000", 0, "Sourcewell NTE prices apply"],
  ["USD 100,000 - 249,999", 0.03, "Apply to eligible services"],
  ["USD 250,000 - 499,999", 0.05, "Apply to eligible services"],
  ["USD 500,000 - 999,999", 0.08, "Apply to eligible services"],
  ["USD 1,000,000+", 0.10, "Negotiated project discount may be offered"],
]);
discounts.getRange("B2:B6").format.numberFormat = "0%";
discounts.freezePanes.freezeRows(1);
width(discounts, "A:A", 240);
width(discounts, "B:B", 150);
width(discounts, "C:C", 420);

const assumptions = workbook.worksheets.add("Assumptions");
write(assumptions, "A1:C1", [["Assumption", "Draft Value", "Notes"]]);
write(assumptions, "A2:C12", [
  ["USD to CAD FX rate", 1.38, "Draft conversion; update before final submission"],
  ["Sourcewell admin fee", 0.02, "Assumed included in offered prices"],
  ["Primary currency", "USD", "CAD shown for Canadian participating entities"],
  ["Taxes", "Excluded", "Applicable taxes excluded unless SOW states otherwise"],
  ["Third-party licenses", "Excluded", "AI/model/API/cloud/platform costs are pass-through unless included"],
  ["Travel", "Excluded", "Travel/onsite expenses quoted separately if required"],
  ["Master Agreement prices", "Not-to-exceed", "IIS may quote lower prices by scope or volume"],
  ["Rate validity", "Draft", "Final terms must align with Sourcewell Master Agreement"],
  ["Administrative fee billing", "Not separately charged to entity", "Fee included in pricing assumption"],
  ["Submission status", "Not approved", "Requires Ahmad approval and portal attestation"],
  ["Primary Lot", "Lot 2", "AI Professional Services"],
]);
assumptions.getRange("B3:B3").format.numberFormat = "0%";
assumptions.freezePanes.freezeRows(1);
width(assumptions, "A:A", 240);
width(assumptions, "B:B", 200);
width(assumptions, "C:C", 520);

const narrative = workbook.worksheets.add("Pricing Narrative");
write(narrative, "A1:B1", [["Topic", "Narrative"]]);
write(narrative, "A2:B10", [
  ["Pricing approach", "IIS proposes fixed-fee packages, not-to-exceed hourly rates, managed services tiers, training rates, and volume discounts for Lot 2 AI Professional Services."],
  ["Cost scaling", "Costs scale by number of workflows, systems integrated, stakeholder groups, data volumes, user groups, compliance requirements, and support coverage."],
  ["Change triggers", "Pricing may change based on approved SOW expansion, additional systems or environments, third-party licensing, cloud consumption, model/platform changes, travel, or annual rate-card updates allowed by the Master Agreement process."],
  ["TCO estimation", "Participating Entities can estimate total cost by selecting a package, adding role-based hours for implementation, adding any managed operations tier, including third-party pass-through costs, and applying approved volume discounts."],
  ["Admin fee", "Draft pricing assumes the Sourcewell administrative fee is included in IIS offered prices and is not separately assessed to the Participating Entity."],
  ["Not included", "Taxes, travel, third-party subscriptions, cloud consumption, hardware, external audits, and independent security testing are excluded unless specifically included in a statement of work."],
  ["Volume pricing", "Discounts are available for higher annual purchase volumes and may be reflected in quotes below the published not-to-exceed Master Agreement price."],
  ["CAD pricing", "CAD prices are draft converted values and should be updated before final submission using an Ahmad-approved exchange-rate assumption."],
  ["Final approval", "All pricing is draft and must be approved by Ahmad before portal upload or proposal attestation."],
]);
narrative.freezePanes.freezeRows(1);
width(narrative, "A:A", 220);
width(narrative, "B:B", 850);

const checklist = workbook.worksheets.add("Upload Checklist");
write(checklist, "A1:D1", [["Item", "Required Before Upload", "Status", "Owner"]]);
write(checklist, "A2:D10", [
  ["Primary Lot selected as Lot 2", "Portal selection matches proposal", "Needs Ahmad approval", "Ahmad"],
  ["Pricing rates approved", "Packages and role rates approved", "Not approved", "Ahmad"],
  ["Admin fee confirmed", "Line 73 and pricing assumptions aligned", "Draft 2%", "Ahmad"],
  ["CAD/USD assumption confirmed", "Currency basis approved", "Draft", "Ahmad"],
  ["Taxes/pass-through wording approved", "No surprise customer costs", "Draft", "Ahmad/legal"],
  ["Master Agreement exceptions reviewed", "No unsupported legal commitments", "Needed", "Ahmad/legal"],
  ["Addenda acknowledged", "Amendments/addenda checked in portal", "Needed", "Ahmad"],
  ["Truth attestation approved", "Authorized representative approval", "Not approved", "Ahmad"],
  ["Confirmation email monitored", "After submission", "After submit", "Ahmad"],
]);
checklist.freezePanes.freezeRows(1);
width(checklist, "A:A", 260);
width(checklist, "B:B", 420);
width(checklist, "C:D", 180);

for (const sheet of [summary, packages, rates, discounts, assumptions, narrative, checklist]) {
  const used = sheet.getUsedRange();
  used.format.wrapText = true;
  used.format.verticalAlignment = "top";
}

await fs.mkdir(outDir, { recursive: true });

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan before export",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "Executive Summary", range: "A1:F18", scale: 1 });
await workbook.render({ sheetName: "Packages", range: "A1:H10", scale: 1 });
await workbook.render({ sheetName: "Rate Card", range: "A1:E13", scale: 1 });
await workbook.render({ sheetName: "Assumptions", range: "A1:C12", scale: 1 });

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outFile);
console.log(outFile);

