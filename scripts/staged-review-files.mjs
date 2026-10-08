// staged-review-files.mjs - the June 2026 staged conversion slices and their disposition.
//
// SUPERSEDED 2026-08-12. The 24 entries below were marked local-only, which the CEO digest
// and the senior-director worker regenerate into Ahmad's approval inbox on EVERY run. Because
// nothing ever changed the status, the same 24 approvals were re-filed continuously from June 11-13
// until August 12 - 62 days - and read as 24 separate pending decisions when they were one.
//
// They are marked superseded rather than approved, because the evidence says there is no longer a
// coherent June state to publish:
//   * their target pages have been rewritten many times since (index.html 40 commits, services.html
//     20, aria.html 19, growth-library.html 19, start-here.html 16 - all after 2026-06-14)
//   * spot-checking start-here.html, part of the described slice is ALREADY LIVE ("Make the second
//     step obvious" is present in production), while other parts it claims ("Open the 3-path guide"
//     links on aria.html, lane-aware booking CTAs) exist in neither the working tree nor production
//   * so approving "publish" would publish nothing coherent, and holding them costs Ahmad a
//     recurring 24-item queue that hides the decisions that are real
//
// `superseded` is inert: LOCAL_ONLY_STAGED_REVIEW_FILES filters on 'local_only', the publish package
// filters on 'approved' and 'local_only', and the console agent filters on file existence. The
// review packets stay on disk as the historical record - nothing was deleted. To put any of these
// back in front of Ahmad, set its status to 'local_only' again.

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
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-overflow-conversion-review-2026-06-11.md',
    title: 'overflow conversion slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-aria-conversion-review-2026-06-11.md',
    title: 'ARIA deployment-path slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-helpdesk-blueprint-preview-review-2026-06-11.md',
    title: 'Help Desk Blueprint sample-preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-overflow-support-pilot-preview-review-2026-06-12.md',
    title: 'Overflow Support Pilot preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-m365-tune-up-preview-review-2026-06-12.md',
    title: 'M365 Security & Productivity Tune-Up preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-website-checklist-preview-review-2026-06-11.md',
    title: 'Website Checklist sample-preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-office-move-preview-review-2026-06-11.md',
    title: 'Office Move readiness preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-ai-workflow-audit-preview-review-2026-06-11.md',
    title: 'AI Workflow Audit preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-ai-workflow-quick-win-sprint-preview-review-2026-06-12.md',
    title: 'AI Workflow Quick-Win Sprint preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-msp-partner-overflow-preview-review-2026-06-12.md',
    title: 'MSP / Partner Overflow Coverage preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-product-routeback-conversion-review-2026-06-12.md',
    title: 'product route-back conversion slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-enterprise-reference-compliance-review-2026-06-12.md',
    title: 'enterprise-reference compliance cleanup slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-homepage-proof-shelf-review-2026-06-12.md',
    title: 'homepage proof-shelf conversion slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-monthly-ai-support-preview-review-2026-06-12.md',
    title: 'Monthly AI Support Plan preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-contact-route-reassurance-review-2026-06-12.md',
    title: 'contact route reassurance slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-services-fit-deliverable-review-2026-06-12.md',
    title: 'services fit-and-first-deliverable slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-prompt-engineering-preview-review-2026-06-13.md',
    title: 'Prompt Engineering for Workflows preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-cyber-basics-preview-review-2026-06-13.md',
    title: 'Cybersecurity Basics for Employees preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-meeting-sop-preview-review-2026-06-13.md',
    title: 'Meeting-to-SOP AI pack preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-ai-agent-starter-preview-review-2026-06-13.md',
    title: 'AI Agent Starter Kit preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-nocode-kit-preview-review-2026-06-13.md',
    title: 'No-Code Automation Kit preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-outlook-fix-preview-review-2026-06-13.md',
    title: 'Outlook Fix Guide preview slice',
    status: 'superseded'
  },
  {
    relPath: 'senior-director-state/staged-marketplace-bridge-conversion-review-2026-06-13.md',
    title: 'Marketplace quote-first routeback slice',
    status: 'superseded'
  }
];

export const LOCAL_ONLY_STAGED_REVIEW_FILES = STAGED_REVIEW_FILES.filter(
  (item) => item.status === 'local_only'
);

export function approvalTextForReview(item) {
  return `New local-only ${item.title}: \`${item.relPath}\` is ready for Ahmad to approve publish or hold local only.`;
}
