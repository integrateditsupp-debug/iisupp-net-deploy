const DEFAULT_REQUIRED_DOCUMENTS = [
  'Company profile',
  'Services summary',
  'Owner/contact details',
  'Insurance/certification checklist',
  'Reference and policy readiness note',
];

const VENDOR_REGISTRATION_METADATA = {
  'BMO supplier/vendor portal registration review': {
    prepPack: 'senior-director-state/bmo-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a disciplined relationship-first supplier for Microsoft 365 operations, workflow automation, endpoint/support readiness, documentation, and scoped workplace technology services without core-banking overclaims.',
    nextPrep:
      'Use `senior-director-state/bmo-supplier-registration-prep-pack-2026-06-12.md` plus `senior-director-state/bmo-supplier-send-checklist-2026-06-13.md`, confirm whether IIS has a real BMO sponsor/contact, and stop before Send or any later onboarding step.',
    draftMessage:
      'Integrated IT Support has a grounded BMO supplier clarification lane. The public Canada supplier path requires a BMO internal contact for Coupa onboarding, the older supplier-diversity URL is dead, and the safe next step is Ahmad choosing whether to send the staged Procurement HelpDesk clarification email or hold.',
    requiredDocuments: [
      'Company profile',
      'Services summary',
      'Owner/contact details',
      'Relationship-manager or sponsor status',
      'Banking/tax document readiness note',
      'Privacy/security and AI posture note',
    ],
    blockers: [
      'Confirm whether Ahmad has a real BMO contact or relationship manager who can sponsor supplier setup in Coupa.',
      'If no sponsor exists, decide whether Ahmad wants to send the staged Procurement.HelpDesk@bmo.com clarification email.',
      'Confirm any banking, tax, privacy, security, AI, or supplier-code attestations before final action.',
    ],
    finalAction:
      'Ahmad reviews the BMO packet and checklist, then either sends the staged helpdesk clarification email or holds this lane until a real BMO sponsor/contact exists.',
  },
  'TD supplier/vendor portal registration review': {
    prepPack: 'senior-director-state/td-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a senior-led supplier for Microsoft 365 support, workflow automation, endpoint/readiness work, knowledge-base delivery, and controlled operational improvement without broad financial-platform claims.',
    nextPrep:
      'Use `senior-director-state/td-supplier-registration-prep-pack-2026-06-12.md` plus `senior-director-state/td-supplier-register-checklist-2026-06-13.md`, follow the public SAP Ariba supplier-request path, solve the live reCAPTCHA if Ahmad wants to proceed, and stop before Submit.',
    draftMessage:
      'Integrated IT Support has a grounded TD supplier-request lane through the official SAP Ariba intake path. The safe next step is to keep the legal-name, address, contact, and relationship-to-TD answers ready, preserve the live reCAPTCHA blocker, and stop before Ahmad certifies or submits anything.',
    requiredDocuments: [
      'Company profile',
      'Services summary',
      'Owner/contact details',
      'Legal address',
      'Relationship-to-TD answer',
      'Supplier-code posture note',
      'Final register checklist',
    ],
    blockers: [
      'Solve the live SAP Ariba reCAPTCHA before trying to inspect or enter the actual supplier-request fields.',
      'Confirm whether the live SAP Ariba supplier-request surface asks for any extra fields beyond the four TD lists publicly.',
      'Confirm Ahmad is comfortable certifying alignment with TD Supplier Code of Conduct before any submit action.',
      'Confirm which insurance, privacy/security, accessibility, or due-diligence items are only later-stage requirements.',
    ],
    finalAction:
      'Ahmad reviews the TD request answers, solves the live reCAPTCHA if he wants to proceed, and clicks Submit only if he is comfortable certifying TD Supplier Code of Conduct alignment.',
  },
  'RBC supplier/vendor portal registration review': {
    prepPack: 'senior-director-state/rbc-supplier-registration-prep-pack-2026-06-11.md',
    nextPrep:
      'Use `senior-director-state/rbc-supplier-registration-prep-pack-2026-06-11.md` and the already-open live RBC registration tab; stop before account creation, certification, or Register.',
  },
  'Rogers supplier portal registration review': {
    prepPack: 'senior-director-state/rogers-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a telecom-adjacent operational supplier for Microsoft 365 support, endpoint readiness, documentation, workflow automation, and scoped office/field technology support without carrier-core or national rollout overclaims.',
    nextPrep:
      'Use `senior-director-state/rogers-supplier-registration-prep-pack-2026-06-12.md`, follow the public portal into Ivalua, confirm the CAPTCHA-gated registration flow, and stop before Create Account/Register/Submit.',
    draftMessage:
      'Integrated IT Support has a verified Rogers supplier entry path through the public supplier portal into Ivalua. The safe next step is to review the CAPTCHA-gated registration flow, supplier-code expectations, and required fields before Ahmad creates an account or certifies anything.',
    requiredDocuments: [
      'Company profile',
      'Services summary',
      'Owner/contact details',
      'GST/HST/Tax ID',
      'Reference and policy readiness note',
    ],
    blockers: [
      'Pass the live Ivalua CAPTCHA and inspect the actual self-registration fields before any data entry.',
      'Confirm whether Rogers immediately requests sourcing, banking, invoice, or compliance attestations beyond supplier-database registration.',
    ],
    finalAction:
      'Ahmad reviews the Rogers packet, solves the CAPTCHA if he wants to proceed, and clicks Create Account/Register only if satisfied.',
  },
  'TELUS procurement registration review': {
    prepPack: 'senior-director-state/telus-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a practical supplier for Microsoft 365 support, workflow automation, service documentation, endpoint readiness, and small-scope technology operations work without implying large telecom network or carrier-infrastructure capability.',
    nextPrep:
      'Use `senior-director-state/telus-supplier-registration-prep-pack-2026-06-12.md`, follow the public procurement page into SAP Ariba, and stop before Register/Submit or any later Avetta due-diligence enrollment.',
    draftMessage:
      'Integrated IT Support has a verified TELUS supplier entry path through the public procurement page into SAP Ariba. The safe next step is to compare the registration fields and Supplier Code of Conduct against the prep pack before Ahmad registers or accepts any later due-diligence step.',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    blockers: [
      'Inspect the live SAP Ariba registration fields and capture any mandatory company-profile questions not exposed on the public TELUS page.',
      'Decide whether Ahmad is comfortable registering now given TELUS states later Avetta pre-qualification can carry supplier-paid costs if IIS is invited forward.',
    ],
    finalAction:
      'Ahmad reviews the TELUS packet and clicks Register only if he is comfortable with the free Ariba registration and the possibility of later invited due-diligence costs.',
  },
  'University of Toronto procurement registration review': {
    prepPack: 'senior-director-state/university-of-toronto-procurement-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a responsive education-sector supplier for Microsoft 365 support, endpoint readiness, documentation, workflow cleanup, and practical AI-assisted operational help without overstating broad public-sector procurement history.',
    nextPrep:
      'Use `senior-director-state/university-of-toronto-procurement-registration-prep-pack-2026-06-12.md` plus `senior-director-state/university-of-toronto-procurement-submit-checklist-2026-06-13.md`, preserve the staged public inquiry form at the CAPTCHA boundary, and stop before Submit.',
    draftMessage:
      'Integrated IT Support now has a grounded University of Toronto procurement clarification lane. The public pages point suppliers toward MERX/Biddingo, direct department contact for smaller purchases, and a controlled vendor-account request path, so the safe next step is the staged public inquiry form at the CAPTCHA boundary rather than pretending there is a clean self-registration flow.',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    blockers: [
      'Confirm whether Ahmad wants to send the staged clarification inquiry now or simply hold and monitor MERX/Biddingo plus department-fit targets.',
      'Solve the live public-form CAPTCHA only if Ahmad wants to proceed with the inquiry.',
      'Do not use the Diverse Supplier Portal unless IIS actually qualifies and can prove the status.',
      'Confirm any later vendor-of-record, insurance, accessibility, privacy, security, or conflict-of-interest obligations before any formal vendor-account or bid step.',
    ],
    finalAction:
      'Ahmad reviews the staged University of Toronto clarification form and checklist, then either solves the portal CAPTCHA and clicks Submit or chooses Hold.',
  },
  'University Health Network procurement registration review': {
    prepPack: 'senior-director-state/university-health-network-procurement-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a healthcare-adjacent technology support supplier for Microsoft 365 operations, endpoint/user readiness, documentation cleanup, workflow automation, and controlled operational support without implying clinical-system or hospital-prime scale.',
    nextPrep:
      'Use `senior-director-state/university-health-network-procurement-registration-prep-pack-2026-06-12.md`, confirm whether the correct path is Biddingo, UHN’s vendor-response tool, or a purchasing intake email, and stop before any registration, contact, or submission.',
    draftMessage:
      'Integrated IT Support is preparing for University Health Network procurement access from the public vendor and business-opportunity pages. The safe next step is to confirm the real onboarding path, on-site vendor policy boundaries, and any purchasing, security, insurance, or privacy requirements before Ahmad sends or submits anything.',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    blockers: [
      'Confirm whether UHN procurement onboarding starts through Biddingo, a separate vendor-response system, or a purchasing contact path rather than the on-site vendor-visitor process.',
      'Confirm any healthcare privacy, information-security, insurance, accessibility, conflict-of-interest, or supplier-terms requirements before final action.',
    ],
    finalAction:
      'Ahmad reviews the prepared checklist, then clicks Register/Request Access or sends a purchasing-path message only if satisfied.',
  },
  'CIBC supplier intake review': {
    prepPack: 'senior-director-state/cibc-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a founder-led supplier for Microsoft 365 operations, workflow automation, endpoint/readiness work, documentation delivery, and scoped workplace technology services without claiming core-banking platform specialization.',
    nextPrep:
      'Use `senior-director-state/cibc-supplier-registration-prep-pack-2026-06-12.md`, keep the intake email draft staged from the official CIBC supplier page, and stop before Send.',
    draftMessage:
      'Integrated IT Support is preparing the official CIBC supplier-intake email using the public required-field checklist. The safe next step is to stage the email content and supporting answers so Ahmad can decide later whether to send it.',
    requiredDocuments: [
      'Company profile',
      'Services summary',
      'Primary contact details',
      'Employee-count answer',
      'Uniqueness statement',
      'Mailing address and website',
      'NAICS and SIC code answer',
      'Capabilities sheet PDF',
    ],
    blockers: [
      'Confirm the current IIS employee-count wording, diversity answer, DUNS posture, and SIC code answer before the intake email is sent.',
      "Decide whether the capabilities-sheet PDF honestly satisfies CIBC's requirement for at least one case study similar in size or scope to CIBC before any send action.",
      'Keep the intake email unsent until Ahmad approves the exact positioning, attachments, and any legal/compliance wording.',
    ],
    finalAction:
      'Ahmad reviews the prepared CIBC intake email, the capabilities-sheet posture, and clicks Send only if satisfied.',
  },
  'Rogers supplier self-registration review': {
    prepPack: 'senior-director-state/rogers-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a telecom-adjacent technology operations supplier for endpoint readiness, Microsoft 365 support, documentation, workflow automation, and scoped office/field support without overclaiming carrier-core or national rollout capability.',
    nextPrep:
      'Use `senior-director-state/rogers-supplier-registration-prep-pack-2026-06-12.md`, follow the public portal into Ivalua, confirm the CAPTCHA-gated registration flow and code-of-conduct expectations, and stop before Create Account/Register/Submit.',
    draftMessage:
      'Integrated IT Support is preparing for Rogers supplier self-registration from the public supplier portal. The safe next step is to confirm the CAPTCHA-gated portal fields, contact/support routes, and supplier-code expectations before Ahmad creates an account or certifies anything.',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    blockers: [
      'Pass the live Ivalua CAPTCHA and inspect the actual self-registration fields before any data entry.',
      'Confirm supplier-code, labour/ethics, privacy, insurance, banking, tax, or environmental attestation requirements before final action.',
    ],
    finalAction:
      'Ahmad reviews the Rogers packet, solves the CAPTCHA if he wants to proceed, and clicks Create Account/Register only if satisfied.',
  },
  'TELUS supplier procurement review': {
    prepPack: 'senior-director-state/telus-supplier-registration-prep-pack-2026-06-12.md',
    angle:
      'Integrated IT Support as a practical supplier for Microsoft 365 support, workflow automation, service documentation, endpoint readiness, and small-scope technology operations work without implying large telecom network or carrier-infrastructure capability.',
    nextPrep:
      'Use `senior-director-state/telus-supplier-registration-prep-pack-2026-06-12.md`, follow the public procurement page into SAP Ariba, and stop before Register/Submit or any later Avetta due-diligence enrollment.',
    draftMessage:
      'Integrated IT Support is preparing for TELUS supplier access from the public procurement and supplier-diversity pages. The safe next step is to verify the SAP Ariba intake path, code-of-conduct obligations, and any supplier-diversity or ESG-related requirements before Ahmad takes final action.',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    blockers: [
      'Inspect the live SAP Ariba registration fields and capture any mandatory company-profile questions not exposed on the public TELUS page.',
      'Decide whether Ahmad is comfortable registering now given TELUS states later Avetta pre-qualification can carry supplier-paid costs if IIS is invited forward.',
    ],
    finalAction:
      'Ahmad reviews the TELUS packet and clicks Register only if he is comfortable with the free Ariba registration and the possibility of later invited due-diligence costs.',
  },
};

export function getVendorRegistrationMeta(itemOrTitle) {
  const title = typeof itemOrTitle === 'string' ? itemOrTitle : itemOrTitle?.title;
  return VENDOR_REGISTRATION_METADATA[title] || null;
}
