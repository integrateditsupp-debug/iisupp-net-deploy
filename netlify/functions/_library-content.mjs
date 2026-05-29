// _library-content.mjs — PRIVATE Growth Library product content.
// Not a routed function (leading underscore + no config.path). Imported only by
// library-download.mjs, which serves it ONLY after verifying a paid Stripe session.
// Each entry: { title, format, peek (HTML teaser), full (HTML body) }.
// All content is original IIS work built from public knowledge + real workflows.

export const BUNDLE_ITEMS = {
  'bundle-it-mastery': ['gl-l1-it-bible', 'gl-m365-kb', 'gl-win11-kb', 'gl-outlook-fix'],
  'bundle-ai-automation': ['gl-ai-agent-starter', 'gl-prompt-workflows', 'gl-helpdesk-blueprint', 'gl-nocode-kit'],
  'bundle-allaccess': ['gl-l1-it-bible', 'gl-m365-kb', 'gl-ai-agent-starter', 'gl-prompt-workflows', 'gl-win11-kb', 'gl-outlook-fix', 'gl-helpdesk-blueprint', 'gl-cyber-basics', 'gl-nocode-kit']
};

const peekNote = '<div class="peek-cut"><b>This is the 30% preview.</b> The full unlock adds every step, the copy-paste templates, the admin-only procedures, and the AI-readable version. Reply to your receipt to credit this preview toward full access.</div>';

export const CONTENT = {

  'gl-l1-it-bible': {
    title: 'Level 1 IT Support Troubleshooting Bible',
    format: 'Guide + checklists',
    peek: `
<h2>The L1 mindset (read this first)</h2>
<p>Great Level 1 support isn't about knowing every answer — it's a <b>repeatable method</b>: confirm the symptom, reproduce it, isolate the layer, try the safe fix, and escalate with clean notes if it resists. Speed comes from running the same loop every time.</p>
<ol>
<li><b>Confirm</b> — restate the problem in one sentence and get the user to agree.</li>
<li><b>Scope</b> — one user or many? One app or the device? Started when?</li>
<li><b>Reproduce</b> — see it happen; never fix what you can't observe.</li>
<li><b>Isolate</b> — account → app → device → network. Change one thing at a time.</li>
<li><b>Resolve or escalate</b> — apply the safe fix, or hand off with notes.</li>
</ol>
<h2>The universal first five (fixes ~40% of tickets)</h2>
<ul><li>Sign out / sign back in (clears most auth + token issues).</li><li>Full reboot (not sleep) — closes leaked handles and stuck services.</li><li>Confirm connectivity (other sites load? other users affected?).</li><li>Update / restart the specific app.</li><li>Check for a known outage before deep-diving.</li></ul>
${peekNote}`,
    full: `
<h2>The L1 mindset</h2>
<p>Level 1 support is a <b>repeatable method</b>, not trivia. Run the same loop on every ticket: Confirm → Scope → Reproduce → Isolate → Resolve/Escalate. Change one variable at a time so you always know what fixed it.</p>
<h2>The universal first five</h2>
<ul><li>Sign out / back in.</li><li>Full reboot (not sleep).</li><li>Confirm connectivity & whether others are affected.</li><li>Update / restart the app.</li><li>Check for a known outage first.</li></ul>
<h2>Password reset — safe workflow</h2>
<ol><li>Verify identity per policy (callback, manager, or ID challenge) — never reset on an unverified inbound.</li><li>Reset in the directory (Entra/AD), set "must change at next sign-in".</li><li>Communicate the temp credential over a second channel.</li><li>Confirm the user can sign in and that MFA still works.</li><li>Log who requested, who approved, what was changed.</li></ol>
<h2>MFA recovery</h2>
<ul><li><b>New phone:</b> re-register the authenticator; remove the old method after confirming the new one.</li><li><b>Lost device:</b> verify identity hard, issue temporary access pass / one-time bypass, then re-enrol.</li><li><b>Code rejected:</b> check device clock sync; codes are time-based.</li></ul>
<h2>Outlook quick fixes</h2>
<ul><li>Not receiving: check Junk, rules, blocked senders, and mailbox-full.</li><li>Won't open: start in safe mode (<code>outlook /safe</code>), disable add-ins.</li><li>Search broken: rebuild the index; for the new Outlook, search is server-side — check connectivity.</li></ul>
<h2>Teams quick fixes</h2>
<ul><li>Clear the Teams cache, sign out/in, confirm the account region.</li><li>Audio/video: confirm OS-level device + app permissions.</li></ul>
<h2>Printers</h2>
<ol><li>Power-cycle the printer; confirm it's on the network (print a config page).</li><li>Clear the print queue; restart the Print Spooler service (admin).</li><li>Re-add by IP if the driver is flaky.</li></ol>
<h2>Wi-Fi & VPN</h2>
<ul><li>Forget/rejoin the network; renew IP (<code>ipconfig /release && /renew</code>).</li><li>VPN: confirm credentials/MFA, then time + DNS; reinstall client if handshake fails.</li></ul>
<h2>Slow computer checklist</h2>
<ol><li>Reboot uptime &gt; 7 days? Restart.</li><li>Task Manager → kill the top CPU/RAM/disk hog.</li><li>Free disk space &lt; 10%? Clean temp + downloads.</li><li>Pending updates / pending reboot?</li><li>Too many startup apps — trim them.</li></ol>
<h2>Browser issues</h2>
<ul><li>Hard refresh, clear cache, test in private window, disable extensions.</li><li>One site only? It's the site or a cached credential, not the browser.</li></ul>
<h2>User-safe vs admin-only</h2>
<p><b>User-safe:</b> reboots, re-login, cache clears, re-adding printers, toggling Wi-Fi. <b>Admin-only:</b> directory resets, service restarts, registry/Group Policy, driver installs, disabling security controls (requires change approval).</p>
<h2>Escalation rules</h2>
<ul><li>Escalate when: it needs admin rights you don't have, it affects many users, data loss/security is involved, or SLA risk is rising.</li><li>Escalate <b>with</b>: one-line summary, scope, steps already tried + result, and the exact error text.</li></ul>
<h2>Ticket-note template</h2>
<pre>SUMMARY: <one line>
SCOPE: <user/many · app/device · since when>
TRIED: <step → result> ...
STATUS: resolved | escalated to <tier> | awaiting user
NEXT: <owner + action></pre>`
  },

  'gl-m365-kb': {
    title: 'Microsoft 365 Help Desk KB Pack',
    format: 'SOP KB',
    peek: `
<h2>How to use this pack</h2>
<p>Each article is a stand-alone SOP: <b>Symptom → Checks → Fix → Escalate</b>. Drop them into your wiki, or feed the AI-readable version to your support bot. This preview shows the Outlook + sign-in articles; the full unlock includes Teams, OneDrive, SharePoint, licensing, mailbox, calendar, admin-center checks, and the JSON KB files.</p>
<h2>SOP — Can't sign in to M365</h2>
<ol><li>Confirm the exact error and whether it's one user or many (check service health).</li><li>Verify the account isn't blocked/locked; confirm licensing.</li><li>Reset password if needed; confirm MFA method is current.</li><li>Clear cached credentials (Credential Manager / browser).</li><li>Escalate to admin if conditional-access or tenant policy is blocking.</li></ol>
${peekNote}`,
    full: `
<h2>How to use this pack</h2>
<p>Every article follows <b>Symptom → Checks → Fix → Escalate</b>. Use as human SOPs or feed the structure to an AI support agent.</p>
<h2>Sign-in failures</h2>
<ol><li>One user or many? Check service health first.</li><li>Account blocked/locked? Licensing assigned?</li><li>Reset password; confirm MFA method current.</li><li>Clear cached credentials.</li><li>Escalate if conditional access / tenant policy blocks.</li></ol>
<h2>Outlook</h2>
<ul><li>Not receiving: Junk, rules, blocked senders, mailbox quota.</li><li>Won't open: safe mode, disable add-ins, rebuild profile.</li><li>Shared mailbox: confirm Full Access + auto-mapping.</li></ul>
<h2>Teams</h2>
<ul><li>Clear cache, re-login, confirm region/policy.</li><li>Missing from a team: check membership + Teams admin policies.</li></ul>
<h2>OneDrive</h2>
<ul><li>Not syncing: check sign-in, storage quota, file path length, and "Files On-Demand".</li><li>Reset: <code>onedrive /reset</code> then re-link.</li></ul>
<h2>SharePoint access</h2>
<ul><li>Confirm site permissions + sharing policy; check sensitivity labels.</li><li>"Access denied" → owner grants, or escalate to SharePoint admin.</li></ul>
<h2>MFA & password</h2>
<p>Re-register methods on device change; temporary access pass for lockouts; verify time sync for code rejection.</p>
<h2>Licensing</h2>
<ul><li>Feature missing → confirm the license includes it and is assigned.</li><li>Use group-based licensing to avoid per-user drift.</li></ul>
<h2>Mailbox & calendar</h2>
<ul><li>Quota full → archive / increase.</li><li>Calendar sharing/permissions; free-busy across tenants needs org relationships.</li></ul>
<h2>Admin-center checks (first 5)</h2>
<ol><li>Service health.</li><li>User license + sign-in status.</li><li>Message trace (mail flow).</li><li>Conditional access / sign-in logs.</li><li>Recent admin changes.</li></ol>
<h2>Escalation paths</h2>
<p>L1 (user/app) → L2 (tenant config, message trace) → L3 (conditional access, hybrid, Microsoft case). Always attach correlation/sign-in IDs.</p>
<h2>AI-readable KB</h2>
<p>The full pack ships each SOP as a structured JSON object (symptom, checks[], fix[], escalate, tags) ready to index for an AI support agent — the same bit-format used by ARIA.</p>`
  },

  'gl-ai-agent-starter': {
    title: 'AI Agent Starter Kit for Small Business',
    format: 'Guide + templates',
    peek: `
<h2>What an AI agent actually is</h2>
<p>An AI agent is software that takes a goal, decides the steps, and uses tools/data to get there — with guardrails. For a small business, the win isn't "replace people"; it's <b>removing repetitive decisions and lookups</b> so your team does the work only humans should.</p>
<h2>Where to start (safest first)</h2>
<ol><li>Internal knowledge assistant (answers from your own docs).</li><li>Email triage & drafting.</li><li>Customer-support first-response.</li></ol>
${peekNote}`,
    full: `
<h2>What an AI agent is</h2>
<p>Software that takes a goal, plans steps, and uses tools/data with guardrails. Goal for SMBs: remove repetitive lookups and decisions.</p>
<h2>Safe first use-cases (in order)</h2>
<ol><li>Internal knowledge assistant (your docs only).</li><li>Email triage + drafting (human approves send).</li><li>Customer support first-response (handoff to human on low confidence).</li><li>Sales follow-up reminders & drafts.</li><li>Appointment-booking helper.</li></ol>
<h2>Customer-support agent — prompt template</h2>
<pre>You are [Company]'s support assistant.
Answer ONLY from the knowledge provided below.
If unsure or it involves billing/refunds/legal, say you'll connect a human.
Tone: warm, concise. Never invent policy.
KNOWLEDGE: """{docs}"""
CUSTOMER: """{message}"""</pre>
<h2>Email assistant — prompt template</h2>
<pre>Summarize this thread in 2 lines, list any asks, and draft a reply
matching my style (concise, friendly). Flag anything needing my decision.
THREAD: """{thread}"""</pre>
<h2>Intake agent — template</h2>
<pre>Collect: name, company, need, urgency, budget range, best contact.
Ask one question at a time. Confirm, then output clean JSON.</pre>
<h2>Tool recommendations</h2>
<ul><li>Start in a hosted assistant (Claude / ChatGPT) before building.</li><li>No-code orchestration for triggers (forms, email, calendar).</li><li>Keep your knowledge in one clean, current source.</li></ul>
<h2>Risk & privacy checklist</h2>
<ul><li>Never paste secrets/customer PII into tools without a data agreement.</li><li>Human-in-the-loop for anything that sends, pays, or promises.</li><li>Log what the agent did; review weekly.</li><li>Tell customers when they're talking to AI.</li></ul>
<h2>30-day rollout</h2>
<ol><li>Week 1: pick ONE use-case, write the knowledge doc.</li><li>Week 2: build + test on real past tickets.</li><li>Week 3: soft-launch with human approval on every output.</li><li>Week 4: measure time saved; expand or adjust.</li></ol>`
  },

  'gl-prompt-workflows': {
    title: 'Prompt Engineering for Workflows',
    format: 'Guide + prompt library',
    peek: `
<h2>The 4 levers of every good prompt</h2>
<ol><li><b>Role</b> — who the AI should act as.</li><li><b>Context</b> — the facts it must use (and only those).</li><li><b>Task</b> — the exact deliverable, in steps.</li><li><b>Format</b> — how the answer should look.</li></ol>
<p>Most weak results come from skipping Context and Format. This guide turns that into muscle memory across real work — support, email, research, automation.</p>
${peekNote}`,
    full: `
<h2>The 4 levers</h2>
<ol><li><b>Role</b> · <b>Context</b> · <b>Task</b> · <b>Format</b>. Add Constraints when accuracy matters.</li></ol>
<h2>Before → after</h2>
<p><b>Before:</b> "write an email to a late client." <b>After:</b> "You are my office manager. Context: invoice #204, 15 days overdue, good long-term client. Task: write a firm-but-warm 4-sentence reminder offering a payment link. Format: subject + body, no fluff."</p>
<h2>Role prompting</h2>
<p>Name the expert ("staff IT engineer", "CFO", "copy editor"). It shifts vocabulary, depth, and what the model checks for.</p>
<h2>Context prompting</h2>
<p>Paste the facts and say "use only this." Reduces hallucination dramatically. For long context, ask it to quote the source line it used.</p>
<h2>Step-by-step prompting</h2>
<p>"Think through it in steps, then give the final answer" for reasoning tasks. For multi-stage work, number the steps yourself.</p>
<h2>Output formatting</h2>
<p>Ask for tables, JSON, bullet lists, or "≤120 words". Specify it or you'll reformat by hand.</p>
<h2>Prompt library (copy/paste)</h2>
<pre>SUPPORT: "Act as L2 support. From the log below, list the 3 most likely
causes, the test for each, and the safest first fix. LOG: {log}"

EMAIL: "Summarize, list asks, draft a reply in my voice. THREAD: {x}"

RESEARCH: "Compare {A} vs {B} for {use-case} in a table: cost, fit,
risk, verdict. Cite what each claim is based on."

AUTOMATION: "Turn this process into numbered triggers/actions a no-code
tool could run. PROCESS: {x}"</pre>
<h2>Improvement checklist</h2>
<ul><li>Did I give a role?</li><li>Did I supply (and bound) the context?</li><li>Is the task a concrete deliverable?</li><li>Did I specify format + length?</li><li>Did I add constraints for accuracy?</li></ul>`
  },

  'gl-win11-kb': {
    title: 'Windows 11 Troubleshooting KB',
    format: 'KB + checklists',
    peek: `
<h2>Triage order for any Windows issue</h2>
<ol><li>Reboot (clears most transient faults).</li><li>Updates pending? (many bugs are already patched).</li><li>Reproduce + read the exact error.</li><li>Isolate: app vs profile vs device vs network.</li></ol>
<h2>Slow PC — fast wins</h2>
<ul><li>Task Manager → top resource hog.</li><li>Startup apps → disable noise.</li><li>Disk &lt;10% free → clean up.</li></ul>
${peekNote}`,
    full: `
<h2>Triage order</h2>
<ol><li>Reboot.</li><li>Check updates.</li><li>Reproduce + capture exact error.</li><li>Isolate app/profile/device/network.</li></ol>
<h2>Slow PC</h2>
<ul><li>Task Manager hog; trim startup; free disk; check for pending reboot; scan for malware.</li></ul>
<h2>Startup / won't boot</h2>
<ol><li>Automatic Repair (interrupt boot 3×).</li><li>Safe Mode → uninstall last change/driver.</li><li>System Restore to a good point.</li></ol>
<h2>Update issues</h2>
<ul><li>Run Update Troubleshooter; ensure disk space.</li><li>Stuck: stop wuauserv, clear SoftwareDistribution, restart (admin).</li></ul>
<h2>Drivers</h2>
<ul><li>Device Manager → update/rollback; get GPU/network drivers from the vendor, not just Windows Update.</li></ul>
<h2>Blue screen triage</h2>
<ol><li>Note the STOP code.</li><li>Undo the most recent change (driver/update/hardware).</li><li>Test RAM (mdsched) + disk (chkdsk) if it recurs.</li></ol>
<h2>Storage</h2>
<ul><li>Storage Sense; clear temp; move large files; uninstall unused apps.</li></ul>
<h2>App crashes</h2>
<ul><li>Repair/reset the app; update it; check Event Viewer → Application log.</li></ul>
<h2>Network</h2>
<ul><li><code>ipconfig /release</code> + <code>/renew</code>; flush DNS; reset adapter; test another network.</li></ul>
<h2>Login / profile</h2>
<ul><li>Temp profile? Don't work in it. Fix profile via registry ProfileList (admin) or create a fresh profile and migrate.</li></ul>
<h2>User-safe vs admin</h2>
<p><b>User:</b> reboot, cleanup, app repair, network reset. <b>Admin:</b> service edits, registry, driver installs, profile rebuilds.</p>
<h2>AI-readable structure</h2>
<p>Each issue ships as {symptom, checks[], userSteps[], adminSteps[], escalate} JSON for support automation.</p>`
  },

  'gl-outlook-fix': {
    title: 'Outlook Fix Guide',
    format: 'Guide + templates',
    peek: `
<h2>The 30-second Outlook triage</h2>
<ol><li>Is it Outlook, or is it the mail server? (Check webmail — if web works, it's the client.)</li><li>One mailbox or all? One device or all?</li><li>Restart Outlook in safe mode: <code>outlook /safe</code>.</li></ol>
${peekNote}`,
    full: `
<h2>30-second triage</h2>
<ol><li>Check webmail — works there? It's the client.</li><li>One mailbox/device or all?</li><li><code>outlook /safe</code> to rule out add-ins.</li></ol>
<h2>Won't open</h2>
<ul><li>Safe mode → disable add-ins one by one.</li><li>Repair Office; create a new mail profile.</li></ul>
<h2>Not syncing / not receiving</h2>
<ul><li>Send/Receive settings; Work Offline toggle; mailbox quota; rules/blocked senders; Junk.</li></ul>
<h2>Search not working</h2>
<ul><li>Classic: rebuild index (Indexing Options).</li><li>New Outlook: search is server-side — check connectivity/account health.</li></ul>
<h2>Calendar</h2>
<ul><li>Permissions for sharing; duplicate items → disable double sync; free/busy needs connectivity.</li></ul>
<h2>Shared mailbox</h2>
<ul><li>Full Access + auto-mapping; if not mapping, add manually as an additional account.</li></ul>
<h2>Profile rebuild (fixes a huge share of issues)</h2>
<ol><li>Control Panel → Mail → Show Profiles → Add.</li><li>Set the new profile default; open Outlook; let it resync.</li></ol>
<h2>Cached mode / OST</h2>
<ul><li>Corruption suspected → close Outlook, rename the .ost; it rebuilds on next launch.</li><li>PST = local archive (back it up); OST = offline copy of the server (safe to rebuild).</li></ul>
<h2>Add-ins</h2>
<ul><li>Disable all, re-enable one at a time to find the culprit.</li></ul>
<h2>Mobile & web fallback</h2>
<ul><li>Re-add the account on mobile; use Outlook on the web while fixing the desktop client.</li></ul>
<h2>Ticket-note template</h2>
<pre>OUTLOOK ISSUE: <symptom>
WEBMAIL OK? <y/n>  SCOPE: <one/all>
TRIED: safe mode / profile / index / quota → <result>
STATUS: <resolved/escalated></pre>`
  },

  'gl-helpdesk-blueprint': {
    title: 'AI Help Desk Automation Blueprint',
    format: 'Blueprint',
    peek: `
<h2>The thesis</h2>
<p>~40–60% of help-desk volume is repetitive and pattern-matchable. AI shouldn't replace your team — it should <b>remove the noise</b> so humans handle the judgment calls. This blueprint is the architecture behind ARIA.</p>
<h2>The five AI jobs on a help desk</h2>
<ol><li>Monitor & classify incoming tickets.</li><li>Summarize long threads.</li><li>Detect SLA risk and alert.</li><li>Suggest the likely fix from past resolutions.</li><li>Draft the KB article after resolution.</li></ol>
${peekNote}`,
    full: `
<h2>Thesis</h2>
<p>Most L1 volume is patternable. AI removes noise; humans keep judgment.</p>
<h2>Five AI jobs</h2>
<ol><li>Monitor & classify.</li><li>Summarize threads.</li><li>Detect SLA risk + alert.</li><li>Suggest fixes from history.</li><li>Auto-draft KB articles.</li></ol>
<h2>Architecture</h2>
<pre>Intake (email/portal/chat)
  → Classifier (category, priority, sentiment)
  → Knowledge retrieval (your KB + past tickets)
  → Suggested response/fix (human approves)
  → SLA monitor (timers, breach prediction)
  → Alerts (Teams/Outlook) → Escalation
  → Post-resolution: draft KB article + tag patterns</pre>
<h2>Ticket-pattern detection</h2>
<p>Cluster recurring issues weekly. 5 "VPN slow" tickets from one site = a problem ticket + a proactive fix, not 5 separate firefights.</p>
<h2>SLA / KPI monitoring</h2>
<ul><li>Track first-response, resolution time, FCR, reopen rate.</li><li>Predict breaches at ~0.8× the limit and alert the owner before it's late.</li></ul>
<h2>Alert patterns</h2>
<ul><li>Teams card on SLA risk with one-click claim.</li><li>Daily digest: open, aging, at-risk, resolved.</li></ul>
<h2>Escalation logic</h2>
<p>Confidence + impact gating: high-confidence + low-impact = auto-suggest; low-confidence or high-impact = human now. Never auto-act on billing, security, or data loss.</p>
<h2>Cost guardrails</h2>
<p>Exhaust pattern + KB + retrieval before any paid LLM call; cap monthly spend; one-shot on truly novel issues, then learn it. (This is exactly how ARIA's governor works.)</p>
<h2>ARIA-style roadmap</h2>
<ol><li>Phase 1: summarize + classify (read-only, instant value).</li><li>Phase 2: suggested fixes + SLA alerts.</li><li>Phase 3: auto-KB + pattern detection.</li><li>Phase 4: scoped auto-resolution with human audit.</li></ol>
<h2>Want it built?</h2>
<p>This is what Integrated IT Support deploys as ARIA. If you'd rather buy than build: <b>ahmad.wasee@iisupp.net</b>.</p>`
  },

  'gl-cyber-basics': {
    title: 'Cybersecurity Basics for Employees',
    format: 'Training + quiz',
    peek: `
<h2>Why you're a target (and why it's fixable)</h2>
<p>Attackers rarely "hack" — they <b>trick</b>. Most breaches start with one person clicking one thing. The good news: a handful of habits stop the vast majority. This is the plain-English version your whole team will actually finish.</p>
<h2>Spot a phishing email (the 5 tells)</h2>
<ul><li>Urgency / fear ("account will be closed").</li><li>Unexpected attachment or link.</li><li>Sender address slightly "off".</li><li>Asks for credentials, payment, or gift cards.</li><li>Hover the link — does it go where it claims?</li></ul>
${peekNote}`,
    full: `
<h2>Why you're a target</h2>
<p>Attackers trick, not hack. A few habits stop most of it.</p>
<h2>Phishing — the 5 tells</h2>
<ul><li>Urgency/fear; unexpected link/attachment; "off" sender; asks for creds/payment/gift cards; link hover mismatch.</li></ul>
<h2>Passwords</h2>
<ul><li>Long passphrases &gt; complex short ones; unique per site; use a password manager; never reuse work passwords personally.</li></ul>
<h2>MFA — your seatbelt</h2>
<p>Even a stolen password usually fails without your second factor. Approve prompts ONLY when you just logged in — unexpected prompts = say no and report.</p>
<h2>Suspicious links & downloads</h2>
<ul><li>Don't open unexpected attachments; verify via a second channel; only install software from official sources.</li></ul>
<h2>Device security</h2>
<ul><li>Lock your screen; keep updates on; don't disable security tools; encrypt laptops.</li></ul>
<h2>Public Wi-Fi</h2>
<ul><li>Assume it's watched; use the VPN; avoid banking/admin on open networks.</li></ul>
<h2>Social engineering</h2>
<ul><li>"IT" calling for your password? No. Verify callers; pressure + secrecy = red flag.</li></ul>
<h2>If something's wrong — report</h2>
<p>Reporting fast limits damage. You will never be punished for reporting a click — only for hiding it.</p>
<h2>Quick quiz (10)</h2>
<ol><li>Unexpected "reset your password" email — what do you do?</li><li>A vendor emails new banking details — verify how?</li><li>Unprompted MFA prompt at 2am — approve?</li><li>Best password approach?</li><li>Coffee-shop Wi-Fi — safe for payroll?</li><li>"IT" asks for your password by phone?</li><li>Attachment "invoice.zip" from unknown sender?</li><li>You clicked a bad link — next step?</li><li>Why does MFA help even if the password leaks?</li><li>Where do you report a suspected phish?</li></ol>
<h2>Completion</h2>
<p>Finished + passed the quiz? Issue a dated completion record. (The full pack includes a printable certificate template.)</p>`
  },

  'gl-nocode-kit': {
    title: 'No-Code Automation Kit',
    format: 'Guide + templates',
    peek: `
<h2>The rule of automation</h2>
<p>Automate the <b>repetitive and rule-based</b>, keep humans on the <b>judgment</b>. If you do something the same way more than ~5 times a week, it's a candidate. You don't need code — you need a trigger and an action.</p>
<h2>Your first 3 automations</h2>
<ol><li>New form submission → add to sheet + notify you.</li><li>New lead → send a templated intro + create a follow-up task.</li><li>Daily → AI summary of new emails to your inbox.</li></ol>
${peekNote}`,
    full: `
<h2>The rule</h2>
<p>Automate repetitive/rule-based steps; keep humans on judgment. Trigger → Action is the whole model.</p>
<h2>First three</h2>
<ol><li>Form → sheet + notify.</li><li>Lead → intro email + follow-up task.</li><li>Daily AI summary of new email.</li></ol>
<h2>Email automation</h2>
<ul><li>Auto-label/route by sender or keyword; templated replies for FAQs; out-of-office routing to the right person.</li></ul>
<h2>Form & intake automation</h2>
<ul><li>Form → CRM/sheet → confirmation email → task. Validate required fields before accepting.</li></ul>
<h2>Spreadsheet automation</h2>
<ul><li>New row → notify; status change → update dashboard; weekly roll-up email.</li></ul>
<h2>CRM follow-up</h2>
<ul><li>No reply in N days → reminder + draft; won/lost → trigger the right sequence.</li></ul>
<h2>Calendar automation</h2>
<ul><li>Booking link → auto-confirm + reminder + post-meeting follow-up.</li></ul>
<h2>AI summary automation</h2>
<pre>Trigger: daily 8am
Action: gather yesterday's new emails →
"Summarize into: urgent, waiting-on-me, FYI. 5 lines max." → email me</pre>
<h2>Client intake & quote-request</h2>
<ul><li>Intake form → AI cleans/normalizes → quote draft → human approves → send.</li></ul>
<h2>Build checklist</h2>
<ol><li>Map the manual steps.</li><li>Find the trigger.</li><li>Build the action; test with real data.</li><li>Add a failure alert.</li><li>Review weekly; expand.</li></ol>
<h2>Prompt pack (for the AI steps)</h2>
<pre>SUMMARIZE: "Summarize into urgent / waiting / FYI, 5 lines max."
EXTRACT: "From this form text, output JSON: name, need, urgency, budget."
DRAFT: "Write a friendly confirmation referencing their {need}."</pre>`
  },

  'gl-book-living-well': {
    title: 'The Unstubborn Life — Balance, Mastery & the Natural Path',
    format: 'Book · 9 chapters',
    peek: `
<p><em>Most people are not unhappy. They are unconscious — comfortable enough never to look up, never tested enough to find out who they are. This is a short book about waking up on purpose. It promises nothing except a clearer way to think. What you build from there is yours.</em></p>
<h2>1 · Numb by Comfort</h2>
<p>Comfort is the most patient thief. It does not break in; it is invited, and it stays. It takes the years quietly — a warm room, a familiar screen, a life arranged so that nothing ever has to be confronted. Most people live and die without understanding even the first level of their own existence, because comfort kept the question from ever arriving.</p>
<p>There is a difference between a dopamine hit and an awakening. A dopamine hit is comfort with no cost and no growth — a loop that asks nothing of you and returns nothing real. An awakening is discomfort with an upside: the unpleasant moment you choose because, on the other side of it, there is awareness you did not have before. The first numbs you. The second actualizes you. The whole art is learning to walk toward the second on purpose.</p>
<div class="peek-cut"><b>This is the free preview — Chapter 1 of 9.</b> The full book continues: Emotional Intelligence Is Earned · The Two Comfort Traps · Build Yourself First · What Draws People · Grief Is a Phase · Pain Is a Tool · Legacy Over Immortality · The Unstubborn Life. Unlock the full read to keep.</div>`,
    full: `
<p><em>Most people are not unhappy. They are unconscious — comfortable enough never to look up, never tested enough to find out who they are. This is a short book about waking up on purpose: building a self worth living inside, mastering your reactions, holding balance against the two great traps, and letting your life grow the way nature grows things — without forcing, without clinging. It promises nothing except a clearer way to think. What you build from there is yours. — Integrated IT Support</em></p>

<h2>1 · Numb by Comfort</h2>
<p>Comfort is the most patient thief. It does not break in; it is invited, and it stays. It takes the years quietly — a warm room, a familiar screen, a life arranged so that nothing ever has to be confronted. Most people live and leave this world without understanding even the first level of it, because comfort kept the question from ever arriving.</p>
<p>There is a difference between a dopamine hit and an awakening. A dopamine hit is comfort with no cost — a loop that asks nothing and returns nothing real. An awakening is discomfort with an upside: the unpleasant moment you choose because, on the far side of it, there is awareness you did not have before. The first numbs you so quietly you cannot even process that it is happening. The second actualizes you. The whole art is learning to walk toward the second on purpose — to seek the discomfort that pays.</p>

<h2>2 · Emotional Intelligence Is Earned</h2>
<p>Reactions are not the problem; <em>uncontrolled</em> reactions are. The person who feels everything and acts on all of it is not deep — they are loud. What is genuinely attractive, in work and in life, is a reaction held under control and spent only on purpose, only for good. Emotion is fuel. Fuel uncontained is a fire; fuel in an engine is movement.</p>
<p>You do not read this in a weekend. Emotional intelligence is earned through experience, and even then it is never finished — because it is different with every person you meet. The patience that reaches one personality will insult another. The directness that respects one will wound the next. Mastery is not a fixed skill you acquire; it is a sensitivity you keep refining, forever, against real people who are nothing alike.</p>

<h2>3 · The Two Comfort Traps</h2>
<p>There are only two places a person can be truly comfortable: utterly poor, with nothing left to lose, or ultra-rich, with nothing left to want. Both feel like rest. Both are mistakes to stay in. The bottom traps you in survival; the top traps you in a velvet boredom where the muscles that built you slowly forget their job.</p>
<p>Everything good lives in the moving middle — the place with enough tension to keep you sharp and enough freedom to keep you building. Balance is not a compromise between the two traps; it is the refusal to fall asleep in either. Comfort is a fine place to visit and a dangerous place to live.</p>

<h2>4 · Build Yourself First</h2>
<p>Climb past the middle not to prove something to the world, but to prove it to yourself. The point of the assets is not the money — it is the evidence: that you were capable, that you could do the hard thing and make it stand. People who build for the money alone are restless even when they win. People who build to meet their own standard can put the money to work and walk away from the scoreboard. That is why the truly secure end up funding things that pay them nothing — they already got what they came for, which was the proof.</p>
<p>Take the fine things life offers; you earned the right to enjoy them. But hold them with an open hand. Over-indulging life is as dangerous to the mind as comfort is — both dull the edge, both quiet the question. Build first, enjoy with control, and never let either the building or the enjoying become the cage.</p>

<h2>5 · What Draws People</h2>
<p>Respect, trust, even love are rarely won by what you do <em>for</em> someone. They are drawn by what you have done <em>with yourself</em>. People read the results of your life and the manner in which you got them. They watch how you treat the ones around you, whether you carry yourself with positivity, and whether your reality is stable enough that nothing — not even love, not even loss — can knock it over.</p>
<p>That is the quiet test everyone runs and few can name: is this a person whose world holds? Build that world. Make it real, make it kind, make it hard to shake. The people worth having are drawn to a centre of gravity, not to favours.</p>

<h2>6 · Grief Is a Phase, Not a Destination</h2>
<p>Loss is meant to be felt — fully, without rushing it. Sadness and the ending of something that mattered are experiences to move <em>through</em>, slowly, with respect for everything that was good before it ended. The error is not the grief; the error is building a house there and never leaving.</p>
<p>And know the difference between people you release and people you do not. If someone is gone for reasons that are real and settled, honour it and walk on. But if the only thing between you is stubbornness — a position someone has been talked into and could still be talked out of — and you can reach them, then you do not give up. You stay. Knowing which is which is most of the wisdom.</p>

<h2>7 · Pain Is a Tool</h2>
<p>Success runs on pain the way an engine runs on combustion — controlled, directed, converted into motion. Pain is not the enemy of the work; it often <em>is</em> the work. And here is the part most people never learn: you stop when <em>you</em> decide to stop. Not when it hurts. Not when it is hard. The one who can keep going chooses the moment.</p>
<p>But choosing to continue forever is its own trap. The one who can keep going should ask whether the wiser move is to pass the power and the knowledge on — to raise people, to raise children, and let them carry it further than one lifetime can. A torch held too long only burns the hand. A torch passed on lights more than you ever could alone.</p>

<h2>8 · Legacy Over Immortality</h2>
<p>We are built with a limit, and the limit is not a flaw — it is the design. Zoom out from the planet and you cannot see a single person. Zoom out from the galaxy and you cannot see the Earth. Why would anyone fight so hard to become a permanent fixture in a picture where, at full scale, none of us are even visible? The craving to last forever is a misunderstanding of what we are.</p>
<p>Legacy is the honest version of immortality. You do not need to persist; you need to <em>hand off</em> — the knowledge, the standard, the way of seeing — to people who will take it forward in their own form. That is how anything real actually survives. Not by one person refusing to end, but by the next one being ready to begin.</p>

<h2>9 · The Unstubborn Life</h2>
<p>If we fight not to die naturally, or grab to possess everything, we are being stubborn against a course the universe has run for millions of years. Growth is good; forcing is not. If we could evolve and rise, why insist on doing it artificially, against the grain, instead of letting the course of life carry us there? And if a person did grow without limit, something would stop them — or they would stop themselves, exhausted by the reaching, having tried to hold everything and kept none of it.</p>
<p>So here is the whole book in one line: life should be lived naturally, and if something comes to you without even a fraction of forcing — not 0.01% of stubbornness in it — then it is yours, and it is the way. Balance is the key to everything. Stop trying to win the universe. Walk with it.</p>

<p style="margin-top:30px;color:#666;font-style:italic">— The Unstubborn Life · original work by Integrated IT Support Inc. Read it, sit with it, pass it on.</p>`
  }

};

export default CONTENT;
