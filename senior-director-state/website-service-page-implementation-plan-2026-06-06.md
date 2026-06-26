# Website Service Page Implementation Plan

Created: 2026-06-06

Status: planning draft only. No production website files were changed by this plan.

Source drafts:
- `senior-director-state/draft-website-copy-packages-2026-06-05.md`
- `senior-director-state/iis-service-catalog-draft-2026-06-05.md`
- `senior-director-state/revenue-pricing-margin-model-2026-06-05.md`

## Objective

Add three focused IIS service pages that can convert practical SMB buyers without overclaiming:

1. Microsoft 365 and AI Readiness Assessment.
2. AI Service Desk Starter.
3. Fractional IT Director.

The pages should fit the existing IIS/ARIA visual language, stay public-safe, and route visitors toward a simple readiness conversation rather than publishing unapproved pricing or guarantees.

## Recommended URL Structure

- `/m365-ai-readiness`
- `/ai-service-desk-starter`
- `/fractional-it-director`

Optional supporting route after approval:
- `/website-rescue-care`

## Shared Page Pattern

Each page should use the same structure so implementation is fast and consistent:

1. Hero section with service name, one-sentence promise, and two CTAs.
2. Pain section with 3 to 5 concrete buyer problems.
3. What IIS does with public-safe service scope.
4. Deliverables list.
5. Who it is for.
6. Engagement flow: discovery, review/build, roadmap/report, optional support.
7. FAQ with conservative answers.
8. Final CTA.

Do not publish package prices until Ahmad approves pricing posture. Use "request a readiness review" or "book a short review" language instead.

## Page 1: Microsoft 365 and AI Readiness Assessment

Primary buyer:
- SMB owners, operations managers, professional-services firms, clinics, nonprofits, and internal teams using Microsoft 365.

Core message:
- Prepare for practical AI adoption by cleaning up the Microsoft 365 foundation first.

Hero draft:
- Title: Microsoft 365 and AI Readiness Assessment
- Supporting copy: Prepare your business for practical AI adoption by reviewing permissions, files, Teams, SharePoint, workflows, and support risks before adding more tools.
- Primary CTA: Book a readiness review
- Secondary CTA: Ask for the checklist

Key sections:
- Problems: file sprawl, unclear permissions, Teams confusion, staff AI usage without guidance, repeated admin/support questions.
- Deliverables: readiness review, workflow findings, AI risk/opportunity map, quick wins, 30/60/90 day roadmap.
- FAQ: "Do we need Copilot already?", "Is this a security audit?", "Can this lead to implementation support?"

Conversion form fields:
- Company name.
- Number of users.
- Current Microsoft 365 tools.
- Main pain: files, Teams, email, support, security, automation, AI.
- Are staff already using AI tools?
- Contact email.

## Page 2: AI Service Desk Starter

Primary buyer:
- SMBs, clinics, professional-services firms, nonprofits, and internal support teams with repeated questions or messy support routing.

Core message:
- Turn repeated questions and manual triage into a cleaner AI-assisted support workflow with human oversight.

Hero draft:
- Title: AI Service Desk Starter
- Supporting copy: Build a practical support workflow with intake categories, knowledge-base notes, first-response drafts, escalation rules, and monthly improvement reporting.
- Primary CTA: Start a support workflow review
- Secondary CTA: See what the starter includes

Key sections:
- Problems: repeated questions, inconsistent first responses, unclear escalation, no usable knowledge base, lost context.
- Deliverables: intake workflow, ticket categories, KB starter, response draft library, escalation rules, monthly improvement report template.
- FAQ: "Does AI replace staff?", "Can this work with our current help desk?", "Can this start small?"

Conversion form fields:
- Company name.
- Number of staff or users supported.
- Current help desk or intake method.
- Top repeated support issues.
- Internal support, customer support, or both.
- Contact email.

## Page 3: Fractional IT Director

Primary buyer:
- Owner-led businesses that have vendors, Microsoft 365, support issues, and technology decisions but no senior IT leader.

Core message:
- Senior IT direction without a full-time hire.

Hero draft:
- Title: Fractional IT Director
- Supporting copy: Get senior-led technology guidance for Microsoft 365, vendors, support quality, AI adoption, project planning, and monthly executive visibility.
- Primary CTA: Request an IT direction review
- Secondary CTA: Ask about monthly support

Key sections:
- Problems: scattered vendors, unclear support ownership, license waste, weak roadmap, stalled projects, uncertainty about AI.
- Deliverables: monthly leadership call, vendor/license review, roadmap and risk register, project prioritization, monthly executive report.
- FAQ: "Is this managed IT?", "Can you work with our existing vendors?", "Do you support implementation too?"

Conversion form fields:
- Company name.
- Number of users.
- Current IT support model.
- Main concern: cost, support quality, security, AI, vendors, project delivery.
- Microsoft 365/Azure usage if known.
- Contact email.

## Homepage Integration

Add a compact service band, not a large marketing detour:

- Card 1: M365 + AI Readiness
- Card 2: AI Service Desk Starter
- Card 3: Fractional IT Director
- Optional Card 4: Website Rescue + Care

CTA text:
- Primary: Book a readiness review
- Secondary: View service options

Keep the tone direct and operational. The site should feel like a working technology company, not a generic agency page.

## Implementation Notes

- Reuse existing header/footer/navigation patterns from current site files.
- Keep colors, typography, button style, and spacing consistent with the established IIS/ARIA look.
- Avoid unapproved pricing, named case studies, certifications, 24/7 claims, guaranteed savings, or compliance guarantees.
- Add analytics/event names only if already supported by the existing site.
- Use one shared intake pattern if possible so future service pages are easy to add.
- Keep mobile forms short and avoid large nested cards.

## QA Checklist

- Desktop and mobile render without overlapping text.
- CTA buttons fit at narrow widths.
- Contact/intake form has clear required fields.
- No console errors.
- No internal notes, `senior-director-state`, or private operating language appears publicly.
- Public copy avoids overclaims listed in the capability statement.
- Links route correctly under Netlify redirects after deployment.

## Ahmad Approval Needed Before Build

- Confirm pricing posture: no prices, "starting at", or package ranges.
- Confirm whether these pages should be added to main navigation immediately or launched quietly first.
- Confirm if named examples/case studies are allowed or if all proof language stays anonymous.
- Confirm preferred CTA destination: contact form, ARIA chat, email link, or a dedicated booking form.
