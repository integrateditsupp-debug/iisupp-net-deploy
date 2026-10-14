// tests/axis-one.test.mjs — AXIS ONE guard (2026-10-13). One globe, one voice, one console.
//
// Ahmad: "I tried to update it via lovable but now there is two. I want the new voice and method and
// old useful knowledge to be merged into one functional Autonomous agentic center." This suite fails
// the moment the page grows a second console, a second globe, or a voice path that bypasses the
// director brain — and it fails if any capability of either stack stops being reachable (Rule 15).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const t = (name, ok, why = '') => { if (ok) pass++; else { fail++; console.error('  FAIL ' + name + (why ? ' — ' + why : '')); } };

const shell = read('axis.html');
const mirror = read('aperture-learning.html');
const app = read('assets/axis-app.js');
const exec = read('assets/axis-exec.js');
const collab = read('assets/axis-collab.js');
const grants = read('assets/axis-grants.js');
const css = read('assets/axis-tokens.css');
const queue = read('netlify/functions/axis-brain-queue.mjs');
const worker = read('scripts/axis-brain-worker.mjs');
const intent = read('netlify/functions/axis-intent.mjs');

// ── 1. One shell, served twice ──
t('both shells stay byte-identical', shell === mirror);

// ── 2. The script graph: unify retired, the rest present ──
t('axis-unify.js is no longer loaded by the shell', !/<script[^>]+axis-unify\.js/.test(shell));
for (const f of ['aria-live.js', 'aria-live-voice.js', 'axis-exec.js', 'axis-app.js', 'axis-collab.js'])
  t(`shell loads ${f}`, new RegExp('<script[^>]+/assets/' + f.replace('.', '\\.')).test(shell));
t('axis-unify.js is kept in the repo (Rule 15), marked retired', fs.existsSync(path.join(ROOT, 'assets/axis-unify.js')) && /^\/\/ RETIRED FROM THE SHELL/.test(read('assets/axis-unify.js')));

// ── 3. One globe ──
const globeSlots = shell.match(/data-globe/g) || [];
t('exactly one [data-globe] slot in the shell (the orbit)', globeSlots.length === 1, `found ${globeSlots.length}`);
t('the orbit globe keeps its id', /id="axisOrbGlobe"/.test(shell));
t('console head carries the orb mark, not a second sphere', /<header class="axis-dock-head">[\s\S]*?data-orb[\s\S]*?axis-head-meta/.test(shell));

// ── 4. One console: the dock, tabbed ──
const dock = shell.slice(shell.indexOf('id="axisDock"'), shell.indexOf('id="palette"'));
const TABS = ['talk', 'work', 'todo', 'auto', 'apr', 'pc', 'inbox', 'brief', 'claude', 'setup'];
t('dock has the tab strip', /id="axisTabs"/.test(dock));
for (const id of TABS) t(`tab "${id}" exists in the strip`, new RegExp(`data-axis-tab="${id}"`).test(dock));
t('dock has the tab panel', /id="axisPanel"/.test(dock));
for (const id of ['axisLog', 'axisPri', 'axisBrain', 'axisInput', 'axisMic', 'axisVoice', 'axisWake', 'axisSend', 'axisVoicePick', 'axisVoiceTest', 'axisClose'])
  t(`original dock control #${id} still present`, new RegExp(`id="${id}"`).test(dock));
t('console foot has the live-call control', /id="axisLiveCall"/.test(dock));
t('orbit bar has the live-call control (static, not injected)', /id="axisLiveGlobe"/.test(shell));
for (const id of ['axisQuick', 'axisQuickWake', 'axisQuickHolo', 'axisQuickOpen'])
  t(`orbit control #${id} still present`, new RegExp(`id="${id}"`).test(shell));

// ── 5. axis-app.js owns the console: tabs, events, live call, mic policy ──
t('app defines the tab list', /const AXIS_TABS = \['talk', 'work', 'todo', 'auto', 'apr', 'pc', 'inbox', 'brief', 'claude', 'setup'\]/.test(app));
t('app has setAxisTab()', /function setAxisTab\(tab/.test(app));
t('openDock accepts a tab', /function openDock\(tab\)/.test(app));
for (const ev of ['axis:open', 'axis:say', 'axis:transcript', 'axis:live-state', 'axis:tab'])
  t(`app wires ${ev}`, app.includes(`'${ev}'`));
t('globe click opens the console', /\$\('axisOrbGlobe'\)\?\.addEventListener\('click', axisOpenConsole\)/.test(app));
t('globe double-click starts the live call', /\$\('axisOrbGlobe'\)\?\.addEventListener\('dblclick'/.test(app));
t('live controls are wired', /\$\('axisLiveGlobe'\)\?\.addEventListener\('click', axisLiveToggleFromUi\)/.test(app) && /\$\('axisLiveCall'\)\?\.addEventListener\('click', axisLiveToggleFromUi\)/.test(app));
t('push-to-talk reaches the director brain by default (mic policy, not a takeover)', /window\.axisLiveToggle && axisMicMode\(\) === 'live' && micId === 'axisMic'/.test(app));
t('mic policy persists', /localStorage\.setItem\('axis-mic-mode'/.test(app));
t('quick bar Enter still goes through axisSend (director turn grammar)', /\$\('axisQuick'\)\?\.addEventListener\('keydown'[\s\S]{0,400}axisSend\(\)/.test(app));
t('Aria voice stays primary with browser fallback', /const ARIA_VOICE_URL = 'https:\/\/xoagency\.lovable\.app\/api\/public\/axis-bridge'/.test(app) && /function axisSpeakBrowser/.test(app));
t('voice drop is said out loud (Rule 14)', /axisVoiceNote\(/.test(app) && /credits out/.test(app));
t('a line said from any surface lands in the one transcript', /function axisConsoleSay/.test(app));
t('live transcript is mirrored into the transcript', /axis:transcript[\s\S]{0,200}dockLog\.push/.test(app));
t('kill-switch also ends the live call', /function axisStandDown\(\) \{\s*window\.axisLiveStop\?\.\(\);/.test(app));
t('Grant Radar screen registered', /SCREENS\.grants = \(c\) => renderGrants\(/.test(app) && /import \{ renderGrants \} from '\.\/axis-grants\.js'/.test(app));
t('Growth nav group present', /group: 'Growth', items: \[\s*\{ id: 'grants', label: 'Grant Radar'/.test(app));
t('Settings shows the rails the code enforces', /AXIS rails & voice/.test(app) && /Raymond James/.test(app) && /Kill-switch/.test(app));

// ── 6. axis-exec.js renders into the console when it exists, stands alone otherwise ──
t('exec detects the console', /const dockMode = !!document\.getElementById\('axisPanel'\)/.test(exec));
t('exec listens for the tab strip', /addEventListener\('axis:tab'/.test(exec));
t('exec keeps the stand-alone panel for pages without a console (Rule 15)', /panel\.className = 'axx'/.test(exec) && /\.axx-launch/.test(exec));
t('exec never duplicates the director reply in console mode', /if \(j\?\.text && !dockMode\) lastSay/.test(exec));
t('exec broadcasts live state + transcript', /axis:live-state/.test(exec) && /axis:transcript/.test(exec) && /onTranscript/.test(exec));
for (const tab of ['work', 'todo', 'auto', 'apr', 'pc', 'inbox', 'brief', 'setup'])
  t(`exec still renders tab "${tab}"`, new RegExp(`tab === '${tab}'`).test(exec));
t('exec component styles apply inside the console', /\.axis-panel \.card/.test(exec));

// ── 7. axis-collab.js: console tab + crash guard ──
t('collab detects the console', /const dockMode = !!document\.getElementById\('axisPanel'\)/.test(collab));
t('collab renders as the Claude tab', /e\.detail\?\.tab === 'claude'/.test(collab));
t('collab keeps the floating box for pages without a console', /mountFloating/.test(collab) && /id = 'axCollab'/.test(collab));
t('collab guards a degraded jobs reply (the 15 s TypeError)', /Array\.isArray\(d\.jobs\) \? d\.jobs : \[\]/.test(collab));
t('share / record / capture survive', /getDisplayMedia/.test(collab) && /MediaRecorder/.test(collab) && /axCapBtn/.test(collab));
t('window.axisClaude API survives', /window\.axisClaude = \{/.test(collab));

// ── 8. CSS: the console is docked, the theme leaks are scoped ──
t('tab strip + panel styled', /\.axis-tabs \{/.test(css) && /\.axis-panel \{/.test(css));
t('non-Talk tabs hide the transcript, never remove it', /:root\[data-axis-tab\]:not\(\[data-axis-tab="talk"\]\) \.axis-log/.test(css));
t('title fits its column under the XO theme', /\.topbar \.cc-title \{ font-size:clamp/.test(css));
t('XO theme section padding scoped out of the app', /\.app section, \.login section\.axis-public \{ padding-top:0; padding-bottom:0; \}/.test(css));
t('card-sections keep their padding', /\.app section\.card \{ padding:14px; \}/.test(css));
t('console yields width on desktop, floats on phone', /padding-right:calc\(min\(480px,calc\(100vw - 36px\)\) \+ 30px\)/.test(css) && /@media \(max-width:980px\) \{\s*:root\[data-axis-open="1"\]\[data-axis-dock="open"\] \.content/.test(css));

// ── 9. Grant Radar: honest, approval-first, real work on the worker ──
t('grants module exports renderGrants', /export function renderGrants\(c, opts = \{\}\)/.test(grants));
t('Apply queues the board intent AND the worker packet job', /send\('grant_apply'/.test(grants) && /'grant\.prepare'/.test(grants));
t('Scan is a real research job, not a promise', /'research\.web'/.test(grants));
t('no over-claim on submission', !/AXIS handles fill \+ submit|Let AXIS Handle It|every Monday 7 AM\. /.test(grants));
t('queue allow-list has grant.prepare', /'grant\.prepare'\]/.test(queue));
t('worker handles grant.prepare and stops at the portal', /kind === 'grant\.prepare'/.test(worker) && /NOT including sign-in or Submit/.test(worker));
t('intent known types include the grant intents', /'grant_apply', 'grant_scan', 'grant_report'/.test(intent));

// ── 10. AXIS PRO LOOK (2026-10-13): a skin, with one new door — the Actions menu ──
t('top bar has the Actions button', /id="actionsBtn"/.test(shell));
t('Actions opens the same ⌘K menu', /\$\('actionsBtn'\)\?\.addEventListener\('click', openPalette\)/.test(app));
for (const label of ['Ask AXIS', 'Start a live call', 'Pull up a working doc', 'Add a to-do', 'Automate a task', 'Review approvals', 'Draft outreach', 'Apply for a grant', 'Send Claude a task', 'Give my PC a task', 'Today’s brief', 'Export reports'])
  t(`action menu lists "${label}"`, app.includes(`label: '${label}'`));
t('every nav screen is still reachable from the menu', /const nav = NAV\.flatMap\(g => g\.items\)\.map\(i => \(\{ label: 'Go to ' \+ i\.label/.test(app));
t('cockpit head band (globe left, controls right) is CSS only', /\.axis-orbit \{ display:grid; grid-template-columns:auto minmax\(0,1fr\)/.test(css));
t('theme firewall restores the light theme under the XO overlay', /html\[data-theme\] body \{ background:var\(--bg\) !important/.test(css));
t('sidebar brand subtitle present', /class="brand-sub">Command Center/.test(shell));

console.log(`[axis-one] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
