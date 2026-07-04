// office-trainer - pure trainer/autonomous choice foundation for Office, Adobe/PDF, and Sentinel help.
//
// The module separates instruction from action. Walkthroughs are always safe. Autonomous plans are
// blocked until the user confirms and, for file edits, an Office/File Safety backup is present.
import { shouldBackupBeforeAutonomousEdit } from "./office-file-safety.mjs";

export const TRAINER_CHOICES = [
  { id: "walkthrough", label: "Walk me through it" },
  { id: "resolve", label: "Resolve it for me" }
];

const INTENTS = [
  { id: "excel_formula", app: "Excel", match: /\b(excel|spreadsheet|formula|vlookup|xlookup|pivot|calculation)\b/i, modifies: true },
  { id: "word_formatting", app: "Word", match: /\b(word|document|header|footer|format|template)\b/i, modifies: true },
  { id: "powerpoint_cleanup", app: "PowerPoint", match: /\b(powerpoint|slides?|deck|presentation)\b/i, modifies: true },
  { id: "pdf_adobe", app: "Adobe/PDF", match: /\b(pdf|adobe|acrobat|merge|split|redact|sign)\b/i, modifies: true },
  { id: "sentinel_help", app: "ARIA Sentinel", match: /\b(aria sentinel|backup|restore|admin console|rdp|rescue)\b/i, modifies: false }
];

export function classifyTrainerIntent(question = "") {
  const text = String(question || "");
  const found = INTENTS.find((intent) => intent.match.test(text));
  if (found) return { id: found.id, app: found.app, modifiesFile: found.modifies, confidence: 0.8 };
  return { id: "general_corporate_app", app: "Corporate app", modifiesFile: false, confidence: 0.35 };
}

export function trainerChoicesFor(question = "") {
  const intent = classifyTrainerIntent(question);
  return {
    intent,
    choices: TRAINER_CHOICES.map((choice) => ({
      ...choice,
      requiresConfirmation: choice.id === "resolve",
      backupRequiredBeforeModify: choice.id === "resolve" && intent.modifiesFile === true
    }))
  };
}

export function buildWalkthrough(question = "") {
  const intent = classifyTrainerIntent(question);
  const stepsByIntent = {
    excel_formula: [
      "Describe the calculation in plain language and identify the input columns.",
      "Build the formula in a blank helper cell first.",
      "Check the first result manually against one known example.",
      "Fill down only after the first result is correct.",
      "Save a copy before replacing existing formulas."
    ],
    word_formatting: [
      "Open a copy of the document before layout changes.",
      "Use Styles for headings instead of manual font changes.",
      "Apply headers, footers, and page numbers from the Insert tab.",
      "Use Print Preview or Export to PDF to verify the final layout."
    ],
    powerpoint_cleanup: [
      "Duplicate the deck before broad formatting changes.",
      "Use Slide Master for repeated headers, footers, fonts, and colors.",
      "Normalize title placement and spacing slide by slide.",
      "Export a PDF proof and review it before sending."
    ],
    pdf_adobe: [
      "Work from a copy of the PDF, not the only original.",
      "Choose the specific PDF task: merge, split, sign, form fill, export, or redact.",
      "For redaction, use real redaction tools, not black rectangles.",
      "Save the result with a new filename and review every page."
    ],
    sentinel_help: [
      "Open ARIA Sentinel and choose the tab that matches the task.",
      "Use walkthrough mode when learning or when a change is risky.",
      "Use Resolve it for me only after reviewing the confirmation gate.",
      "Check the audit trail after any confirmed action."
    ],
    general_corporate_app: [
      "Name the app and the exact result you need.",
      "Ask ARIA for a walkthrough first if the task changes data.",
      "Use Resolve it for me only after ARIA explains the change and asks for confirmation."
    ]
  };
  return { intent, mode: "walkthrough", steps: stepsByIntent[intent.id] || stepsByIntent.general_corporate_app };
}

export function buildAutonomousTrainerPlan(question = "", {
  confirmed = false,
  filePath = "",
  backupReady = false,
  actorAuthorized = true
} = {}) {
  const intent = classifyTrainerIntent(question);
  const backupRequired = shouldBackupBeforeAutonomousEdit({ filePath, willModify: intent.modifiesFile });

  if (!actorAuthorized) return blocked(intent, "not-authorized", "This task requires an authorized user or admin.");
  if (!confirmed) return blocked(intent, "confirmation-required", "Review and confirm before ARIA changes anything.");
  if (backupRequired && backupReady !== true) {
    return blocked(intent, "backup-required", "Create an ARIA File Safety backup before modifying this file.");
  }

  return {
    ok: true,
    intent,
    mode: "resolve",
    requiresConfirmation: true,
    backupRequired,
    actionLogRequired: true,
    macroExecutionAllowed: false,
    steps: [
      "Confirm the requested outcome.",
      backupRequired ? "Verify the latest ARIA backup exists." : "Verify no file backup is needed for this guidance-only task.",
      "Perform only the approved, scoped change.",
      "Summarize what changed and how to undo or restore."
    ]
  };
}

function blocked(intent, reason, message) {
  return {
    ok: false,
    intent,
    mode: "resolve",
    reason,
    message,
    requiresConfirmation: true,
    actionLogRequired: true,
    macroExecutionAllowed: false
  };
}
