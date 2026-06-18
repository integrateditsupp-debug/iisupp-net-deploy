import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const today = '2026-06-18';

const entries = [
  ['vertical-education', 'l1-edu-001', 'Student cannot access Google Classroom', 'education', 'L1', 'medium', ['google classroom', 'student', 'login', 'ferpa'], 'Teacher confirms student enrollment but login or class visibility fails.', 'Verify student identity, check account status, confirm class roster sync, avoid exposing student records in screenshots.'],
  ['vertical-education', 'l1-edu-002', 'Chromebook cannot enroll after powerwash', 'education', 'L1', 'medium', ['chromebook', 'enrollment', 'google admin'], 'Device serial does not appear in the expected organizational unit.', 'Confirm Wi-Fi, device serial, enrollment permissions, and OU assignment before escalating to Google Admin.'],
  ['vertical-education', 'l1-edu-003', 'Student password reset with guardian present', 'education', 'L1', 'high', ['student', 'password reset', 'guardian', 'ferpa'], 'Identity proof is incomplete or requester is not authorized.', 'Validate school policy, confirm requester authority, reset through approved IdP, and log the ticket without sensitive notes.'],
  ['vertical-education', 'l1-edu-004', 'Shared classroom projector audio missing', 'education', 'L1', 'low', ['projector', 'audio', 'classroom'], 'Issue persists across devices and cables.', 'Check input source, HDMI audio device, projector volume, adapter, and classroom control panel.'],
  ['vertical-education', 'l1-edu-005', 'Teacher cannot launch video meeting', 'education', 'L1', 'medium', ['meet', 'teams', 'teacher', 'policy'], 'Meeting policy blocks host creation or external guests.', 'Confirm teacher role, calendar policy, meeting license, browser permission, and student join restrictions.'],
  ['vertical-education', 'l2-ferpa-001', 'FERPA-safe student data export request', 'education', 'L2', 'high', ['ferpa', 'student record', 'export'], 'Requester authority or scope is unclear.', 'Confirm authorized requester, define exact data scope, use approved export path, and keep an audit note.'],
  ['vertical-education', 'l2-ferpa-002', 'Accidental gradebook share', 'education', 'L2', 'critical', ['ferpa', 'gradebook', 'share', 'privacy'], 'External recipient or broad student access occurred.', 'Remove sharing, preserve evidence, notify school privacy owner, identify affected records, and follow district notification policy.'],
  ['vertical-education', 'l2-ferpa-003', 'Student account still active after withdrawal', 'education', 'L2', 'high', ['ferpa', 'withdrawn student', 'deprovision'], 'Account retains mailbox, drive, LMS, or SIS access.', 'Disable access, preserve required records, remove active sessions, and confirm SIS-to-IdP lifecycle mapping.'],
  ['vertical-education', 'l2-ferpa-004', 'LMS roster sync mismatch', 'education', 'L2', 'medium', ['lms', 'sis', 'roster', 'sync'], 'Multiple students or classes have incorrect enrollment.', 'Compare SIS source, sync timestamp, scoped OU, and LMS connector logs before manual overrides.'],
  ['vertical-education', 'l2-ferpa-005', 'Guardian portal identity dispute', 'education', 'L2', 'high', ['guardian portal', 'identity', 'ferpa'], 'Guardian relationship or custody restriction is disputed.', 'Do not disclose records. Route to school admin, verify SIS relationship flags, and document only minimal facts.'],
  ['vertical-education', 'l2-ferpa-006', 'OneDrive or Drive folder exposes student records', 'education', 'L2', 'critical', ['ferpa', 'onedrive', 'google drive', 'share'], 'Student records were shared outside the authorized group.', 'Revoke sharing, export access list, preserve audit logs, notify privacy owner, and reset folder permissions.'],
  ['vertical-education', 'l2-ferpa-007', 'Student device lost with local files', 'education', 'L2', 'high', ['lost device', 'student data', 'ferpa'], 'Encryption or remote wipe status cannot be proven.', 'Confirm device management state, remote lock or wipe, collect last sync details, and escalate to privacy lead if records may be exposed.'],
  ['vertical-education', 'l2-ferpa-008', 'Assessment platform outage during exam', 'education', 'L2', 'critical', ['assessment', 'exam', 'outage'], 'Many students cannot complete timed assessment.', 'Verify vendor status, preserve impacted student list, communicate approved workaround, and avoid modifying exam results without school approval.'],
  ['vertical-education', 'l2-ferpa-009', 'Teacher mailbox compromised', 'education', 'L2', 'critical', ['teacher', 'mailbox', 'compromise', 'ferpa'], 'Mailbox contains student records or external forwarding rule.', 'Disable sessions, reset MFA, remove rules, search audit logs, and notify privacy/security owner.'],
  ['vertical-education', 'l2-ferpa-010', 'EdTech vendor access review', 'education', 'L2', 'high', ['edtech', 'vendor', 'access review'], 'Vendor can access student PII without current approval.', 'Collect DPA status, app scopes, active users, data retention terms, and route decision to school authority.'],
  ['vertical-manufacturing', 'l1-ot-001', 'Shop-floor barcode scanner cannot submit jobs', 'manufacturing', 'L1', 'medium', ['barcode scanner', 'mes', 'shop floor'], 'Multiple scanners fail or production line is blocked.', 'Check cradle, Wi-Fi SSID, battery, profile, MES URL, and avoid changing PLC or machine controls.'],
  ['vertical-manufacturing', 'l1-ot-002', 'Label printer missing production template', 'manufacturing', 'L1', 'medium', ['label printer', 'zebra', 'template'], 'Wrong labels can ship product or break traceability.', 'Pause affected print queue, confirm template version, test on blank stock, and escalate before production relabel.'],
  ['vertical-manufacturing', 'l1-ot-003', 'Operator kiosk stuck after Windows update', 'manufacturing', 'L1', 'high', ['operator kiosk', 'windows update', 'production'], 'Kiosk controls production workflow or line is down.', 'Restart kiosk, verify autologon shell, check assigned access, and use rollback only with supervisor approval.'],
  ['vertical-manufacturing', 'l1-ot-004', 'MES terminal loses session every few minutes', 'manufacturing', 'L1', 'medium', ['mes', 'terminal', 'session'], 'Several terminals lose sessions at once.', 'Check local network, browser storage, time sync, proxy, and idle-timeout policy.'],
  ['vertical-manufacturing', 'l1-ot-005', 'Warehouse handheld cannot sync inventory', 'manufacturing', 'L1', 'medium', ['warehouse', 'handheld', 'inventory'], 'Sync errors affect stock counts or shipping cut-off.', 'Confirm network, app version, offline queue, device clock, and WMS endpoint reachability.'],
  ['vertical-manufacturing', 'l2-ics-001', 'PLC programming workstation cannot reach controller', 'manufacturing', 'L2', 'critical', ['plc', 'controller', 'ics'], 'Controller or production cell may be down.', 'Do not change ladder logic. Verify maintenance window, network path, engineering workstation firewall, and escalation owner.'],
  ['vertical-manufacturing', 'l2-ics-002', 'HMI screen freezes during production run', 'manufacturing', 'L2', 'critical', ['hmi', 'scada', 'production'], 'Operator cannot view or control process state.', 'Escalate immediately to OT owner, capture time and screen, verify redundant station, and avoid reboot unless supervisor approves.'],
  ['vertical-manufacturing', 'l2-ics-003', 'SCADA historian stops collecting tags', 'manufacturing', 'L2', 'high', ['scada', 'historian', 'tags'], 'Batch traceability, quality, or compliance records are affected.', 'Check historian service, disk, license, tag source, and notify QA if records are missing.'],
  ['vertical-manufacturing', 'l2-ics-004', 'OT network switch shows port flapping', 'manufacturing', 'L2', 'high', ['ot network', 'switch', 'port flapping'], 'Flapping port connects safety, PLC, HMI, or line equipment.', 'Identify port owner, avoid blind shutdown, inspect cable/transceiver, and coordinate with production lead.'],
  ['vertical-manufacturing', 'l2-ics-005', 'Vendor remote access requested for machine support', 'manufacturing', 'L2', 'high', ['vendor remote access', 'ot', 'support'], 'Vendor wants unattended or broad access.', 'Require approval, time-bound access, MFA, session recording if allowed, and least-privilege route through approved jump host.'],
  ['vertical-manufacturing', 'l2-ics-006', 'Unapproved USB device found on engineering station', 'manufacturing', 'L2', 'critical', ['usb', 'engineering station', 'security'], 'Unknown media touched OT or engineering workstation.', 'Disconnect network if policy allows, preserve device, do not browse files, notify security/OT owner, and collect host details.'],
  ['vertical-manufacturing', 'l2-ics-007', 'Patch reboot risk on production workstation', 'manufacturing', 'L2', 'high', ['patching', 'reboot', 'production'], 'Pending reboot may interrupt production.', 'Confirm maintenance window, suppress automatic restart where policy allows, notify production owner, and document exception.'],
  ['vertical-manufacturing', 'l2-ics-008', 'Quality station cannot upload inspection results', 'manufacturing', 'L2', 'high', ['quality station', 'inspection', 'upload'], 'Quality records are blocked or batch release is delayed.', 'Check app queue, database connectivity, credentials, disk, and QA approval for any manual upload.'],
  ['vertical-manufacturing', 'l2-ics-009', 'Time sync drift between OT systems', 'manufacturing', 'L2', 'high', ['ntp', 'time sync', 'ot'], 'Traceability timestamps or batch records disagree.', 'Compare NTP source, domain time, isolated OT time server, and historian timestamps before correcting clocks.'],
  ['vertical-manufacturing', 'l2-ics-010', 'ERP to MES order feed delayed', 'manufacturing', 'L2', 'high', ['erp', 'mes', 'order feed'], 'Production orders are missing or duplicated.', 'Check integration queue, middleware errors, order IDs, and do not replay messages without production approval.'],
  ['tier3-hybrid', 'l3-aadconnect-006-staging-server-failover', 'AAD Connect staging server failover', 'enterprise', 'L3', 'critical', ['aad connect', 'staging server', 'failover'], 'Primary sync server is down and cloud identity changes are stalled.', 'Confirm export/import status, validate staging mode, switch only during approved window, and capture connector run history.'],
  ['tier3-hybrid', 'l3-exchange-006-hybrid-modern-auth-loop', 'Exchange hybrid modern auth loop', 'exchange', 'L3', 'high', ['exchange hybrid', 'modern auth', 'oauth'], 'Outlook loops after hybrid auth or certificate change.', 'Check OAuth config, virtual directories, federation trust, and EXO service principal status before resetting auth.'],
  ['tier3-hybrid', 'l3-saml-006-signing-cert-rollover', 'SAML signing certificate rollover failure', 'sso-saml', 'L3', 'critical', ['saml', 'signing certificate', 'sso'], 'Users are locked out after IdP or SP certificate rollover.', 'Compare active signing cert thumbprint, metadata URL, clock skew, and rollback path with app owner approval.'],
  ['tier3-hybrid', 'l3-intune-006-autopilot-hybrid-join-timeout', 'Autopilot hybrid join timeout', 'endpoint', 'L3', 'high', ['intune', 'autopilot', 'hybrid join'], 'Devices fail enrollment after domain join or connector timeout.', 'Validate Intune connector health, OU permissions, line-of-sight to DC, ESP timeout, and device object cleanup.'],
  ['tier3-hybrid', 'l3-dns-006-split-brain-m365-records', 'Split-brain DNS breaks Microsoft 365 records', 'dns', 'L3', 'high', ['split brain dns', 'm365', 'autodiscover'], 'Internal users resolve different records than external users.', 'Compare internal/external DNS for autodiscover, MX, SPF, DKIM, Teams, and federation endpoints.'],
  ['tier3-hybrid', 'l3-vpn-006-conditional-access-device-state', 'VPN conditional access device-state mismatch', 'vpn', 'L3', 'high', ['vpn', 'conditional access', 'device compliance'], 'Compliant devices fail VPN or SAML sign-in.', 'Check device ID, Entra compliance, VPN SAML claims, certificate chain, and CA policy report-only logs.'],
  ['tier3-hybrid', 'l3-pki-006-ndes-scep-profile-failure', 'NDES SCEP certificate profile failure', 'certificates', 'L3', 'high', ['ndes', 'scep', 'certificate', 'intune'], 'Managed devices cannot receive certificates for Wi-Fi or VPN.', 'Validate NDES service account, connector cert, profile OIDs, CRL reachability, and Intune certificate connector.'],
  ['tier3-hybrid', 'l3-teams-006-direct-routing-sbc-down', 'Teams Direct Routing SBC down', 'teams', 'L3', 'critical', ['teams direct routing', 'sbc', 'voice'], 'Inbound/outbound calling is unavailable for one or more offices.', 'Check SBC TLS cert, SIP options, firewall, carrier status, Teams PSTN gateway state, and emergency calling impact.'],
  ['tier3-hybrid', 'l3-sharepoint-006-cross-tenant-migration-permission', 'SharePoint cross-tenant migration permission failure', 'sharepoint', 'L3', 'high', ['sharepoint', 'migration', 'permissions'], 'Migrated sites lose access or inherit wrong permissions.', 'Freeze migration batch, compare source/target ACLs, validate mapping file, and restore from backup if required.'],
  ['tier3-hybrid', 'l3-security-006-token-replay-investigation', 'Token replay investigation in hybrid tenant', 'security', 'L3', 'critical', ['token replay', 'security', 'hybrid identity'], 'Risky sign-ins show impossible travel, token reuse, or session persistence.', 'Revoke sessions, rotate credentials, collect sign-in logs, preserve evidence, and escalate to incident response.']
];

function frontMatter(entry) {
  const [, id, title, category, level, severity, keywords, escalation] = entry;
  return [
    '---',
    `title: ${title}`,
    `category: ${category}`,
    `support_level: ${level}`,
    `severity: ${severity}`,
    `audience: ${category === 'manufacturing' ? 'manufacturing-it' : category === 'education' ? 'education-it' : 'senior-it'}`,
    `keywords: [${keywords.join(', ')}]`,
    `created: ${today}`,
    `escalation_trigger: ${escalation}`,
    '---',
    ''
  ].join('\n');
}

function body(entry) {
  const [, id, title, category, level, severity, keywords, escalation, fix] = entry;
  return `${frontMatter(entry)}# ${title}

## Symptom

The requester reports a ${category} support issue that matches: ${keywords.join(', ')}.

## What ARIA should do first

${fix}

## Guardrails

- Collect only the minimum operational details needed to troubleshoot.
- Do not expose student, patient, employee, or production records in screenshots or notes.
- Do not make privileged changes, production changes, legal claims, or vendor submissions without owner approval.

## Escalation

Escalate when: ${escalation}

## Support tier

Default tier: ${level}. Default severity: ${severity}. Article ID: ${id}.
`;
}

async function writeKb() {
  for (const entry of entries) {
    const [folder, id] = entry;
    const dir = path.join(root, 'knowledge-base', folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, id + '.md'), body(entry), 'utf8');
  }
}

async function writeManifestAddendum() {
  const records = entries.map((entry) => {
    const [folder, id, title, category, level, severity, , escalation] = entry;
    return {
      id,
      title,
      category,
      support_level: level,
      severity,
      path: `${folder}/${id}.md`,
      escalation_trigger: escalation,
      last_updated: today
    };
  });
  const addendum = {
    version: 'finish100-2026-06-18',
    generated: `${today}T12:00:00Z`,
    count: records.length,
    records
  };
  await fs.writeFile(path.join(root, 'knowledge-base', '_meta', 'finish100-manifest-addendum.json'), JSON.stringify(addendum, null, 2) + '\n', 'utf8');
}

async function writeOpenApi() {
  const functionsDir = path.join(root, 'netlify', 'functions');
  const files = (await fs.readdir(functionsDir)).filter((name) =>
    /\.(js|mjs|mts)$/.test(name) && !name.startsWith('_')
  ).sort();
  const paths = {};
  for (const file of files) {
    const name = file.replace(/\.(js|mjs|mts)$/, '');
    const publicPath = `/.netlify/functions/${name}`;
    const methods = new Set(['post']);
    if (['aria-white-label', 'aria-write-gate', 'aria-slack-install'].includes(name)) methods.add('get');
    paths[publicPath] = {};
    for (const method of methods) {
      paths[publicPath][method] = {
        summary: `${name} Netlify function`,
        operationId: `${method}_${name.replace(/-/g, '_')}`,
        tags: ['netlify-functions'],
        'x-netlify-function-file': file,
        requestBody: method === 'post' ? {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        } : undefined,
        responses: {
          '200': {
            description: 'Function response',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true }
              }
            }
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Authentication required' },
          '405': { description: 'Unsupported method' },
          '500': { description: 'Server error' }
        }
      };
      if (method !== 'post') delete paths[publicPath][method].requestBody;
    }
  }
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Integrated IT Support ARIA API',
      version: '2026-06-18.finish100',
      description: 'Generated OpenAPI index for ARIA Netlify function endpoints. Some endpoints require admin tokens or human approval.'
    },
    servers: [{ url: 'https://iisupp.net' }],
    paths
  };
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs', 'openapi.json'), JSON.stringify(spec, null, 2) + '\n', 'utf8');
}

await writeKb();
await writeManifestAddendum();
await writeOpenApi();
console.log(`Generated ${entries.length} KB entries and OpenAPI spec.`);
