export const APPROVED_PUBLISH_SUMMARY =
  'Approved-to-publish slices: staged operations conversion slice, homepage contact-intake context upgrade, and staged Growth Library conversion slice. Next live action is deploy/publish when the production publish surface is available.';

export const STAGED_REVIEW_FILES = [
  {
    relPath: 'senior-director-state/staged-conversion-slice-review-2026-06-11.md',
    title: 'Homepage contact-intake context upgrade',
    status: 'approved'
  },
  {
    relPath: 'senior-director-state/staged-operations-conversion-slice-review-2026-06-11.md',
    title: 'Operations conversion slice',
    status: 'approved'
  },
  {
    relPath: 'senior-director-state/staged-growth-library-conversion-review-2026-06-11.md',
    title: 'Growth Library conversion slice',
    status: 'approved'
  },
  {
    relPath: 'senior-director-state/staged-start-here-conversion-review-2026-06-12.md',
    title: 'Start Here route-guide slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-overflow-conversion-review-2026-06-11.md',
    title: 'overflow conversion slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-aria-conversion-review-2026-06-11.md',
    title: 'ARIA deployment-path slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-helpdesk-blueprint-preview-review-2026-06-11.md',
    title: 'Help Desk Blueprint sample-preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-overflow-support-pilot-preview-review-2026-06-12.md',
    title: 'Overflow Support Pilot preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-m365-tune-up-preview-review-2026-06-12.md',
    title: 'M365 Security & Productivity Tune-Up preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-website-checklist-preview-review-2026-06-11.md',
    title: 'Website Checklist sample-preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-office-move-preview-review-2026-06-11.md',
    title: 'Office Move readiness preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-ai-workflow-audit-preview-review-2026-06-11.md',
    title: 'AI Workflow Audit preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-ai-workflow-quick-win-sprint-preview-review-2026-06-12.md',
    title: 'AI Workflow Quick-Win Sprint preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-msp-partner-overflow-preview-review-2026-06-12.md',
    title: 'MSP / Partner Overflow Coverage preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-product-routeback-conversion-review-2026-06-12.md',
    title: 'product route-back conversion slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-enterprise-reference-compliance-review-2026-06-12.md',
    title: 'enterprise-reference compliance cleanup slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-homepage-proof-shelf-review-2026-06-12.md',
    title: 'homepage proof-shelf conversion slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-monthly-ai-support-preview-review-2026-06-12.md',
    title: 'Monthly AI Support Plan preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-contact-route-reassurance-review-2026-06-12.md',
    title: 'contact route reassurance slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-services-fit-deliverable-review-2026-06-12.md',
    title: 'services fit-and-first-deliverable slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-prompt-engineering-preview-review-2026-06-13.md',
    title: 'Prompt Engineering for Workflows preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-cyber-basics-preview-review-2026-06-13.md',
    title: 'Cybersecurity Basics for Employees preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-meeting-sop-preview-review-2026-06-13.md',
    title: 'Meeting-to-SOP AI pack preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-ai-agent-starter-preview-review-2026-06-13.md',
    title: 'AI Agent Starter Kit preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-nocode-kit-preview-review-2026-06-13.md',
    title: 'No-Code Automation Kit preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-outlook-fix-preview-review-2026-06-13.md',
    title: 'Outlook Fix Guide preview slice',
    status: 'local_only'
  },
  {
    relPath: 'senior-director-state/staged-marketplace-bridge-conversion-review-2026-06-13.md',
    title: 'Marketplace quote-first routeback slice',
    status: 'local_only'
  }
];

export const LOCAL_ONLY_STAGED_REVIEW_FILES = STAGED_REVIEW_FILES.filter(
  (item) => item.status === 'local_only'
);

export function approvalTextForReview(item) {
  return `New local-only ${item.title}: \`${item.relPath}\` is ready for Ahmad to approve publish or hold local only.`;
}
