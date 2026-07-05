const MODE_LABELS = {
  manual: "Manual",
  confirmed: "Confirmed",
  autonomous: "Autonomous safe demo"
};

const CALL_GROUPS = [
  {
    prefix: "win",
    category: "Windows startup and reliability",
    detector: "Event log, service health, update state, disk signal",
    safeAction: "Collect visible symptoms, map the likely cause, and create a non-destructive recovery checklist.",
    calls: [
      ["Blue screen after Windows Update", "Blue screen after restart; user can reach recovery screen", "high"],
      ["PC stuck on preparing automatic repair", "Repair loop appears before sign-in", "high"],
      ["Black screen after login", "Desktop never appears after password entry", "medium"],
      ["App not responding every few minutes", "User sees repeated Not Responding banners", "green"],
      ["Windows Search does not open", "Start search box spins or closes", "green"],
      ["Taskbar missing after reboot", "Desktop loads but taskbar is gone", "green"],
      ["Update stuck at 0 percent", "Windows Update sits at 0 percent for a long time", "medium"],
      ["System time wrong after travel", "Clock is wrong and sign-ins fail", "green"]
    ]
  },
  {
    prefix: "net",
    category: "Network, Wi-Fi, VPN, and DNS",
    detector: "Adapter state, DNS response, gateway reachability, VPN client presence",
    safeAction: "Run read-only connectivity probes and present the lowest-risk reset path.",
    calls: [
      ["Wi-Fi connected but no internet", "Wi-Fi shows connected, browser cannot load pages", "green"],
      ["VPN connects then drops", "VPN says connected for seconds then disconnects", "medium"],
      ["DNS name not resolving", "Internal site name fails but IP works", "green"],
      ["Captive portal blocks hotel Wi-Fi", "Browser redirects to sign-in page repeatedly", "green"],
      ["Ethernet unplugged alert", "Docked laptop cannot see wired network", "green"],
      ["Teams works but browser does not", "Only browser traffic fails", "green"],
      ["Slow file share access", "Network share takes minutes to open", "medium"],
      ["Remote app cannot reach server", "Line-of-business app reports server unavailable", "medium"]
    ]
  },
  {
    prefix: "print",
    category: "Printing and scanning",
    detector: "Print queue, spooler service, default printer, driver signal",
    safeAction: "Inspect queue state and offer a gated spooler or queue-clear fix.",
    calls: [
      ["Printer queue stuck", "Documents remain in queue and never print", "green"],
      ["Wrong default printer", "Jobs go to a printer in another office", "green"],
      ["Printer offline after sleep", "Printer shows offline even though it is powered on", "green"],
      ["PDF prints blank pages", "Only PDF documents print blank", "medium"],
      ["Scanner not detected", "Scan app cannot find the device", "medium"],
      ["Label printer shifted", "Labels print with bad alignment", "green"],
      ["Print job asks for admin", "Driver prompt blocks non-admin user", "medium"],
      ["Secure print release missing", "User cannot find held job at printer", "green"]
    ]
  },
  {
    prefix: "mail",
    category: "Outlook and Microsoft 365 mail",
    detector: "Outlook process, profile hints, credential prompt loop, connectivity",
    safeAction: "Guide profile/cache checks and keep mailbox/data changes behind confirmation.",
    calls: [
      ["Outlook password prompt loop", "Outlook repeatedly asks for password", "medium"],
      ["Outlook stuck on loading profile", "Outlook never reaches the inbox", "medium"],
      ["Emails stuck in Outbox", "Messages sit in Outbox after Send", "green"],
      ["Shared mailbox missing", "Delegated mailbox no longer appears", "medium"],
      ["Calendar invites not updating", "Meeting changes do not appear", "green"],
      ["Search in Outlook returns nothing", "Old mail exists but search is empty", "green"],
      ["Attachment blocked", "Safe attachment cannot be opened", "medium"],
      ["Mailbox almost full", "Send/receive warns about quota", "green"]
    ]
  },
  {
    prefix: "meet",
    category: "Teams, Zoom, and meeting audio/video",
    detector: "Audio endpoint, camera permission, app process, conference device state",
    safeAction: "Check selected devices and permissions, then offer reversible app/device steps.",
    calls: [
      ["Teams microphone silent", "User can hear others but nobody hears them", "green"],
      ["Camera black in meeting", "Video preview is black", "green"],
      ["Speaker output wrong device", "Sound comes from laptop instead of headset", "green"],
      ["Echo in conference room", "Room audio loops back loudly", "medium"],
      ["Screen share button missing", "Meeting app blocks sharing", "green"],
      ["Zoom update required before call", "Zoom blocks join until update", "medium"],
      ["Bluetooth headset connects but fails", "Headset pairs but does not work in Teams", "green"],
      ["Meeting link opens wrong app", "Browser opens a wrong/default app", "green"]
    ]
  },
  {
    prefix: "file",
    category: "Office, Adobe, and file safety",
    detector: "Recent Office documents, lock files, extension type, backup validation status",
    safeAction: "Protect the live file first, validate a renamed backup copy, and avoid macro execution.",
    calls: [
      ["Word document may be corrupted", "Word says the document cannot be opened", "medium"],
      ["Excel workbook crashes on open", "Excel closes after loading one workbook", "medium"],
      ["PowerPoint missing fonts/media", "Deck opens but slides look broken", "green"],
      ["PDF form will not save", "Adobe form loses typed fields", "green"],
      ["Excel file locked by another user", "Workbook says it is already in use", "green"],
      ["Unsaved Office changes after crash", "User lost edits after app crash", "medium"],
      ["Macro workbook warning", "User sees a macro security prompt", "high"],
      ["Large PDF opens slowly", "Adobe freezes on a large PDF", "green"]
    ]
  },
  {
    prefix: "sync",
    category: "OneDrive and SharePoint",
    detector: "Sync client state, file lock, path length, local cache signal",
    safeAction: "Check sync status and steer the user to safe online/local recovery paths.",
    calls: [
      ["OneDrive not syncing", "Cloud icon shows errors", "green"],
      ["Red X on SharePoint folder", "Files show red X badges", "green"],
      ["File disappeared from synced folder", "User cannot find a document after sync", "medium"],
      ["Path too long", "Sync reports invalid file path", "green"],
      ["OneDrive sign-in expired", "Sync client requests sign-in", "green"],
      ["Conflicting copies created", "Multiple conflict files appear", "green"],
      ["SharePoint permission denied", "User cannot open a team folder", "medium"],
      ["Slow first sync after laptop swap", "New device takes hours to sync", "green"]
    ]
  },
  {
    prefix: "id",
    category: "Identity, password, MFA, and lockout",
    detector: "Lockout symptom, MFA prompt state, directory integration availability",
    safeAction: "Identify the authority owner and stage safe reset/escalation steps without bypassing policy.",
    calls: [
      ["Account locked out", "User cannot sign in after password attempts", "medium"],
      ["MFA push never arrives", "Authenticator prompt does not appear", "medium"],
      ["New phone needs MFA transfer", "User replaced phone and cannot approve sign-in", "high"],
      ["Password changed but app still fails", "Old password prompt repeats in apps", "green"],
      ["Badge login fails", "Device sign-in with badge/PIN fails", "medium"],
      ["Temporary access pass request", "User needs a TAP for recovery", "high"],
      ["Conditional access block", "Sign-in says access blocked by policy", "high"],
      ["Guest user cannot access tenant", "External collaborator sees permission error", "medium"]
    ]
  },
  {
    prefix: "perf",
    category: "Performance, storage, and battery",
    detector: "CPU, memory, disk space, startup apps, battery health",
    safeAction: "Gather resource evidence and preview reversible cleanup or startup recommendations.",
    calls: [
      ["Laptop is very slow", "Opening apps takes minutes", "green"],
      ["Disk almost full", "Windows warns storage is low", "green"],
      ["Fan always loud", "Fan runs high while idle", "green"],
      ["Battery drains quickly", "Laptop dies far faster than normal", "green"],
      ["High CPU from one app", "Task Manager shows one app using CPU", "green"],
      ["Memory pressure warning", "Apps close under heavy memory use", "green"],
      ["Startup takes too long", "Sign-in to usable desktop is slow", "green"],
      ["Laptop overheats in dock", "Machine gets hot when docked", "medium"]
    ]
  },
  {
    prefix: "web",
    category: "Browser and web applications",
    detector: "Browser profile state, extension list, cookie/session clue, safe URL classification",
    safeAction: "Use privacy-safe browser checks and avoid reading page content or credentials.",
    calls: [
      ["Website keeps logging out", "Browser loses the session repeatedly", "green"],
      ["Browser extension breaks site", "Internal website works in private mode only", "green"],
      ["Pop-ups blocked for required app", "Business app cannot open a required pop-up", "green"],
      ["Certificate warning", "Browser shows certificate not trusted", "high"],
      ["Download blocked by browser", "Business download is stopped", "medium"],
      ["Chrome profile corrupted", "Bookmarks/extensions behave strangely", "medium"],
      ["Password manager autofill wrong", "Saved login fills old credentials", "green"],
      ["SaaS app blank white page", "Corporate web app loads blank", "green"]
    ]
  },
  {
    prefix: "sec",
    category: "Security and phishing",
    detector: "Threat category, attachment risk, Defender state, policy gate",
    safeAction: "Contain first, collect safe evidence, and escalate anything high-risk to security.",
    calls: [
      ["Suspicious email reported", "User received a possible phishing email", "high"],
      ["Clicked a phishing link", "User clicked a suspicious link", "high"],
      ["Unknown browser pop-up", "Fake antivirus pop-up appears", "high"],
      ["Defender alert shown", "Windows Security reports a threat", "high"],
      ["USB drive found", "User inserted an unknown USB drive", "high"],
      ["Impossible travel sign-in alert", "Security portal reports odd login", "high"],
      ["Ransomware note screenshot", "User sees a ransom-like message", "critical"],
      ["Suspicious MFA fatigue", "User gets repeated MFA prompts", "high"]
    ]
  },
  {
    prefix: "rdp",
    category: "Remote access and asset rescue",
    detector: "RDP policy, customer-owned authority, device reachability, recovery preconditions",
    safeAction: "Stage the access request only; no hidden access, credential storage, or policy bypass.",
    calls: [
      ["Remote Desktop cannot connect", "RDP times out to a managed device", "medium"],
      ["User locked out before file handoff", "Files are needed but user cannot sign in", "high"],
      ["Grant asset RDP access request", "Admin needs another approved helper on the device RDP list", "high"],
      ["VPN required before RDP", "RDP works only after VPN connects", "medium"],
      ["Remote app printer missing", "Printer is not redirected in remote session", "green"],
      ["Remote session black screen", "RDP connects but shows black screen", "medium"],
      ["Cannot copy files over RDP", "Clipboard or drive redirect is disabled", "medium"],
      ["Blue-screen recovery request", "Device cannot boot normally; user asks for file recovery", "critical"]
    ]
  },
  {
    prefix: "corp",
    category: "Corporate apps and peripherals",
    detector: "App health, local device state, policy hint, vendor escalation signal",
    safeAction: "Identify app/device ownership and provide either a walkthrough or a gated support ticket draft.",
    calls: [
      ["ERP app login loop", "Finance app returns to login after password", "medium"],
      ["CRM records not loading", "Sales app loads but records are blank", "medium"],
      ["RSA token code rejected", "Token code is valid-looking but rejected", "high"],
      ["Dock does not charge laptop", "Docked laptop shows not charging", "green"],
      ["External monitor not detected", "Second display remains black", "green"],
      ["Keyboard or mouse lag", "Input device stutters during work", "green"],
      ["Barcode scanner types wrong data", "Scanner enters extra characters", "green"],
      ["Softphone calls fail", "Corporate phone app cannot place calls", "medium"]
    ]
  }
];

const RISK_LABELS = {
  green: "low-risk",
  medium: "medium-risk",
  high: "high-risk",
  critical: "critical"
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

function makeScenario(group, call, index) {
  const [title, symptom, risk = "medium"] = call;
  const id = `${group.prefix}-${String(index + 1).padStart(2, "0")}-${slug(title)}`;
  const riskLabel = RISK_LABELS[risk] || "review";
  return {
    id,
    title,
    category: group.category,
    risk,
    riskLabel,
    prompt: `A corporate user reports: "${title}". Visible symptom: ${symptom}. Show the safest first response, what ARIA can check locally, and when to escalate.`,
    visualSymptom: symptom,
    detector: group.detector,
    safeDemoAction: group.safeAction,
    proofPoint: `${riskLabel} demo path; content-blind; no destructive system change.`,
    modeOutcomes: {
      manual: `ARIA explains the cause, gives a step-by-step walkthrough, and does not execute anything.`,
      confirmed: `ARIA stages a fix card with risk, reason, rollback notes, and a countdown before any safe action.`,
      autonomous: risk === "green"
        ? `ARIA controls the workflow in safe-demo mode: read-only probes and dry-run repair preview only. No real OS change in the demo.`
        : `ARIA controls triage, then stops at approval because this is ${riskLabel}. No bypass, no hidden access, no destructive action.`
    }
  };
}

export const COMMON_CALL_DEMO_SCENARIOS = Object.freeze(
  CALL_GROUPS.flatMap((group) => group.calls.map((call, index) => makeScenario(group, call, index)))
);

export const COMMON_CALL_DEMO_MODES = Object.freeze(Object.keys(MODE_LABELS));

export const LIVE_CAPTURE_DEMO_CASE = Object.freeze({
  id: "live-capture-print-queue-001",
  title: "Live capture: printer queue stuck",
  scenario: "A user tries to print an invoice, but the queue is frozen and the printer shows offline.",
  before: [
    "Queue state: 3 stuck jobs",
    "Spooler signal: stalled",
    "Default printer: reachable",
    "Risk tier: low-risk reversible workflow"
  ],
  after: [
    "Queue state: clear in demo sandbox",
    "Spooler signal: healthy after dry-run repair preview",
    "User action: print test page or send real job after approval",
    "Proof: evidence, diagnosis, action, verification captured"
  ],
  reportId: "ARIA-CAPTURE-DEMO-PRN-001"
});

export const LIVE_CAPTURE_DEMO_STEPS = Object.freeze([
  {
    id: "capture-symptom",
    label: "Capture symptom",
    detail: "ARIA records the visible complaint: print job is stuck and user cannot complete work.",
    proof: "Symptom captured without reading document content."
  },
  {
    id: "collect-evidence",
    label: "Collect evidence",
    detail: "Read-only probes check queue state, spooler signal, default printer, and reachability.",
    proof: "Evidence: 3 stuck jobs, spooler stalled, printer reachable."
  },
  {
    id: "diagnose-cause",
    label: "Diagnose cause",
    detail: "ARIA matches the pattern to a queue/spooler lock instead of blaming the application.",
    proof: "Likely cause: spooler queue lock; confidence: high for low-risk printer scenario."
  },
  {
    id: "choose-action",
    label: "Choose safe action",
    detail: "ARIA selects the vetted printer queue recipe and keeps it in dry-run for the recording.",
    proof: "Selected recipe: printer queue reset preview; rollback note attached."
  },
  {
    id: "run-remediation",
    label: "Run safe remediation",
    detail: "Autonomous safe demo controls the workflow: preview restart/clear steps without changing Windows.",
    proof: "Dry-run remediation completed; no service restart or file deletion happened."
  },
  {
    id: "verify-result",
    label: "Verify result",
    detail: "ARIA runs a verification probe against the demo state and compares before vs after.",
    proof: "Verification: queue clears in sandbox; printer route ready for user-approved real job."
  },
  {
    id: "write-report",
    label: "Write proof report",
    detail: "ARIA produces a case summary suitable for the customer or advertisement voiceover.",
    proof: "Report includes symptom, evidence, diagnosis, safe action, verification, and safety boundary."
  }
]);

export function buildLiveCaptureDemo() {
  return {
    case: LIVE_CAPTURE_DEMO_CASE,
    steps: LIVE_CAPTURE_DEMO_STEPS,
    safety: "Demo uses read-only probes and dry-run remediation. It proves the workflow without changing Windows.",
    completedText: "Troubleshooting proof complete: symptom -> evidence -> diagnosis -> dry-run fix -> verification -> report."
  };
}

export const AUTONOMOUS_TAKEOVER_DEMO = Object.freeze({
  id: "autonomous-visible-control-001",
  reportId: "ARIA-AUTONOMY-DEMO-001",
  issueTitle: "Issue detected: printer queue stuck",
  prompt: "ARIA detected a low-risk support issue. Do you want ARIA to fix it visibly on the front end, or run the safe checks in the back end?",
  choices: Object.freeze([
    {
      id: "frontend",
      label: "Front end - show me",
      detail: "ARIA displays a golden outline, announces ARIA using computer, and walks through the fix like a visible technician."
    },
    {
      id: "backend",
      label: "Back end - run quietly",
      detail: "ARIA runs the same safe workflow in the background, then reports what changed and whether a reboot is needed."
    }
  ]),
  frontendSteps: Object.freeze([
    {
      id: "ask-user",
      label: "Ask user",
      detail: "ARIA prompts the user before taking visible control.",
      proof: "User chose front end visibility for the recording."
    },
    {
      id: "show-control",
      label: "Show visible control",
      detail: "The screen receives a golden ARIA using computer outline so the user can see when Sentinel is operating.",
      proof: "Golden control frame is visible; no hidden access."
    },
    {
      id: "inspect-issue",
      label: "Inspect issue",
      detail: "ARIA checks the stuck queue, spooler signal, default printer, and reachability using safe probes.",
      proof: "Evidence collected without reading document contents."
    },
    {
      id: "run-safe-fix",
      label: "Run safe fix preview",
      detail: "ARIA previews the vetted queue/spooler fix and keeps risky actions behind the normal approval gate.",
      proof: "Dry-run repair preview completed; real Windows changes still require approval."
    },
    {
      id: "verify",
      label: "Verify result",
      detail: "ARIA compares before and after state and shows whether the issue is resolved or needs human approval.",
      proof: "Verification report generated for the customer demo."
    }
  ]),
  backendSteps: Object.freeze([
    {
      id: "ask-user",
      label: "Ask user",
      detail: "ARIA prompts the user before running back-end remediation.",
      proof: "User chose back end mode."
    },
    {
      id: "run-background",
      label: "Run background checks",
      detail: "ARIA runs content-blind health checks and applies only safe, reversible, approved actions.",
      proof: "Background workflow started without taking over the visible session."
    },
    {
      id: "repair-preview",
      label: "Repair preview",
      detail: "ARIA stages the low-risk repair path and records the safety boundary.",
      proof: "No hidden admin access, credential storage, or policy bypass."
    },
    {
      id: "verify",
      label: "Verify quietly",
      detail: "ARIA verifies the result and posts a plain-English completion report.",
      proof: "Background verification complete."
    },
    {
      id: "reboot-reminder",
      label: "Reboot reminder",
      detail: "If a reboot is needed, ARIA reminds the user hourly or uses the user-selected postpone window.",
      proof: "Reboot remains user/admin approved in this build."
    }
  ]),
  rebootPolicy: Object.freeze({
    required: true,
    forceEnabled: false,
    postponeOptions: Object.freeze(["15 minutes", "1 hour", "4 hours", "Tomorrow morning"]),
    attempts: Object.freeze([
      "Restart recommended. ARIA asks to reboot now or postpone.",
      "One hour later, ARIA reminds the user that the fix still needs a reboot.",
      "Final notice: in this production-safe build, ARIA still requires user/admin approval before any forced reboot policy can run."
    ])
  }),
  safety: "Autonomous demo shows the control workflow, but real OS changes, forced reboot, and policy changes remain gated."
});

export function buildAutonomousTakeoverDemo(mode = "frontend") {
  const normalizedMode = mode === "backend" ? "backend" : "frontend";
  const choice = AUTONOMOUS_TAKEOVER_DEMO.choices.find((item) => item.id === normalizedMode) || AUTONOMOUS_TAKEOVER_DEMO.choices[0];
  return {
    id: AUTONOMOUS_TAKEOVER_DEMO.id,
    reportId: AUTONOMOUS_TAKEOVER_DEMO.reportId,
    issueTitle: AUTONOMOUS_TAKEOVER_DEMO.issueTitle,
    prompt: AUTONOMOUS_TAKEOVER_DEMO.prompt,
    choices: AUTONOMOUS_TAKEOVER_DEMO.choices,
    choice,
    mode: normalizedMode,
    visibleFrame: normalizedMode === "frontend",
    steps: normalizedMode === "backend" ? AUTONOMOUS_TAKEOVER_DEMO.backendSteps : AUTONOMOUS_TAKEOVER_DEMO.frontendSteps,
    rebootPolicy: AUTONOMOUS_TAKEOVER_DEMO.rebootPolicy,
    safety: AUTONOMOUS_TAKEOVER_DEMO.safety,
    completedText: normalizedMode === "frontend"
      ? "Visible autonomous proof complete: prompt -> golden control frame -> inspect -> safe fix preview -> verification."
      : "Back-end autonomous proof complete: prompt -> background checks -> safe repair preview -> verification -> reboot reminder plan."
  };
}

export function demoDisposition(scenario, mode = "manual") {
  const normalizedMode = COMMON_CALL_DEMO_MODES.includes(mode) ? mode : "manual";
  const text = scenario?.modeOutcomes?.[normalizedMode] || "";
  const gatedRisk = normalizedMode === "autonomous" && scenario?.risk !== "green";
  return {
    mode: normalizedMode,
    label: MODE_LABELS[normalizedMode],
    summary: text,
    status: gatedRisk
      ? "approval-gated"
      : normalizedMode === "confirmed"
        ? "confirm-first"
        : normalizedMode === "autonomous"
          ? "safe-demo"
          : "walkthrough"
  };
}

export function summarizeCommonCallDemo(mode = "manual") {
  const normalizedMode = COMMON_CALL_DEMO_MODES.includes(mode) ? mode : "manual";
  const categories = new Set(COMMON_CALL_DEMO_SCENARIOS.map((s) => s.category));
  const highRisk = COMMON_CALL_DEMO_SCENARIOS.filter((s) => ["high", "critical"].includes(s.risk)).length;
  const green = COMMON_CALL_DEMO_SCENARIOS.filter((s) => s.risk === "green").length;
  return {
    mode: normalizedMode,
    label: MODE_LABELS[normalizedMode],
    count: COMMON_CALL_DEMO_SCENARIOS.length,
    categories: categories.size,
    green,
    highRisk,
    safety: normalizedMode === "autonomous"
      ? "Autonomous demo uses read-only probes, dry-runs, and approval stops for risky cases."
      : "No live system changes are made by the demo lab."
  };
}
