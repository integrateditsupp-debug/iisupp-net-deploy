# Content Assurance Build-Ready Package

Updated: 2026-07-03
Owner: Integrated IT Support Inc.
Build target: `iisupp-net-deploy` on Netlify

## 1. Outcome

Build an additive, privacy-first `Content Assurance` tool under the existing Services area of `iisupp.net`.

User journey:

1. User lands on a new Services-linked page.
2. User uploads one supported file.
3. User checks at least 3 modules and may choose one goal.
4. IIS generates an on-screen Assurance Report preview.
5. User pays through Stripe or unlocks with an active subscription credit.
6. User downloads a ZIP bundle and can email items to self or client.
7. Temporary content is purged within 15 minutes of delivery or session expiry.
8. Successful checkout pushes checkout email + selected goal to HubSpot as a qualified lead.

This is an additive patch. Do not redesign or restructure the existing site.

## 2. Chosen Services Mechanism

Chosen mechanism: add a new quick-link pill inside the existing `services.html` quick-nav and route it to a dedicated standalone page.

Why this fits the repo:

- `services.html` already uses `svc-quick-nav` pills instead of real tabs.
- The site already maps clean public routes to standalone HTML files through `netlify.toml`.
- A dedicated page keeps the tool isolated and avoids destabilizing the existing Services catalog layout.

Implementation shape:

- Add `Content Assurance` pill to `services.html` quick nav.
- Add one teaser card inside the existing `AI Services` block in `services.html`.
- Add new route:
  - public route: `/services/content-assurance`
  - backing file: `/content-assurance.html`
- Add one redirect entry in `netlify.toml`.

## 3. Surgical Change Rules

Before any implementation work:

1. Verify live current state:
   - `https://iisupp.net/services`
   - existing Services quick-nav behavior
   - existing Stripe checkout flow
2. Create a backup folder:
   - `backups/content-assurance-YYYY-MM-DD/`
3. Copy baseline snapshots into the backup folder:
   - `services.html`
   - `netlify.toml`
   - `netlify/functions/stripe-checkout.js`
   - `netlify/functions/stripe-webhook.js`
   - any shared CSS file that must be touched
4. Keep changes additive:
   - new page file
   - new JS/CSS assets
   - new namespaced Netlify functions
   - only surgical edits to `services.html`, `netlify.toml`, and shared Stripe webhook/checkout plumbing if unavoidable

## 4. Scope Lock

MVP supports:

- `.txt`
- `.pdf`
- `.docx`
- pasted/plain transcripts

MVP does not support:

- image
- audio
- video
- accounts
- saved history
- expert marketplace
- security scanning

Hard limits:

- max file size: 25 MB
- max page count: 20 pages
- max normalized text: about 15,000 words
- one file per report

## 5. UX Definition

### Page layout

Route: `/services/content-assurance`

Page sections in order:

1. Hero/value proposition
   - headline: privacy-first content intelligence and assurance
   - subhead for regulated B2B buyers
   - trust rail with plain-English promise:
     - not stored
     - purged in 15 minutes
     - informational only
     - no forensic or legal verdicts
2. Step rail
   - `Upload`
   - `Choose modules`
   - `Preview`
   - `Unlock + deliver`
3. Upload card
   - drag/drop + file picker
   - accepted file list
   - visible size/page/word limits
   - rights-attestation checkbox required before processing
   - plain-English data-handling statement
4. Module selection
   - checkbox list for 5 modules
   - enforce minimum 3 selected modules before processing
   - optional goal selector:
     - Sales
     - Compliance
     - Hiring
     - Meeting-Content
   - optional expert suggestions toggle
5. Processing state
   - progress stages:
     - normalize
     - analyze
     - build preview
     - ready
   - persistent badge: `File not stored. Temporary session only.`
6. Report preview
   - summary panel
   - AI-likelihood panel with disclaimer banner
   - sensitive-data findings panel with privacy-obligations framing
   - action plan panel
   - templates preview list
   - expert suggestions panel if enabled
7. Unlock panel
   - ask for checkout email
   - detect active subscriber by email
   - show one of:
     - active subscription with remaining credit -> unlock now
     - active subscription with overage -> charge $2
     - no subscription -> choose $5 single or $20/month plan
8. Delivery panel
   - download ZIP
   - download report PDF
   - send to self
   - send to client
   - purge countdown
9. Purge confirmation state
   - session expired / purged
   - CTA to start a new report
10. Footer legal rail
   - informational only
   - not legal advice
   - not forensic evidence
   - user attests they have rights to upload
   - link to Content Assurance ToS
   - link to Content Assurance Privacy Notice

### Required UI states

- empty/default
- drag-over
- unsupported file rejected
- file too large rejected
- page-count rejected
- word-count rejected
- attestation missing
- fewer than 3 modules selected
- processing
- partial preview with module error badge
- payment choice
- subscriber unlock success
- Stripe redirect return success
- Stripe canceled
- delivery ready
- email sent
- purge complete
- expired session

## 6. File and Route Plan

### New public files

- `content-assurance.html`
- `assets/content-assurance.css`
- `assets/content-assurance.js`

### New legal files

- `content-assurance-terms.html`
- `content-assurance-privacy.html`

### New Netlify functions

- `netlify/functions/ca-analyze.mjs`
- `netlify/functions/ca-expert-search.mjs`
- `netlify/functions/ca-session-state.mjs`
- `netlify/functions/ca-checkout.mjs`
- `netlify/functions/ca-delivery.mjs`
- `netlify/functions/ca-email.mjs`
- `netlify/functions/ca-purge-cron.mjs`
- `netlify/functions/ca-health-cron.mjs`
- `netlify/functions/ca-hubspot.mjs`

### Shared-file edits

- `services.html`
  - add quick-nav pill
  - add AI Services teaser card
- `netlify.toml`
  - add redirects for `/services/content-assurance`
  - add scheduled functions if needed
- `netlify/functions/stripe-webhook.js`
  - add branch for Content Assurance Stripe events if existing webhook is reused

### New internal docs

- `docs/content-assurance-build-ready-package.md`
- optional follow-on runbook:
  - `docs/content-assurance-operations-runbook.md`

## 7. Front-End Flow

### `content-assurance.html`

Responsibilities:

- render marketing + trust framing
- handle upload, rights checkbox, module selection, goal selection
- call `ca-analyze`
- render preview
- call `ca-checkout`
- handle Stripe redirect return
- call `ca-delivery`
- call `ca-email`
- show purge countdown

### `assets/content-assurance.js`

Responsibilities:

- client-side validation
- upload form state machine
- preview rendering
- Stripe handoff
- delivery action wiring
- session countdown and purge UX

### `assets/content-assurance.css`

Responsibilities:

- page-local styles only
- no global overrides
- responsive layout
- trust-first visual language consistent with existing gold/black site palette

## 8. Data Handling Model

### Never persist

- raw uploaded file beyond active request processing
- extracted full source text in any durable store
- extracted PII in logs
- source text in HubSpot
- source text in Stripe metadata

### Persist minimally

- Stripe customer/session/subscription identifiers
- credit ledger
- anonymized usage metadata:
  - file type
  - modules used
  - selected goal
  - timestamp
  - output sizes
- operational logs without content payloads
- checkout email + selected goal in HubSpot

### Temporary session content

Pragmatic implementation decision:

- The source file and normalized text exist only in request memory and local function temp storage during active processing.
- The delivery bundle payload may be stored only as an encrypted short-life session artifact for up to 15 minutes so download and email actions work after checkout.
- That artifact must exclude the raw original file.
- Every session artifact carries `createdAt`, `expiresAt`, `sha256`, `sessionId`, and `purgeState`.

If Ahmad requires literal zero persistence even for derived output, replace delayed download links with immediate stream-only delivery and immediate attachment email only.

## 9. Ephemeral Storage and Purge

### Storage design

Use two layers:

1. Request-local temp files in Netlify function runtime tmp directory
   - upload normalization only
   - deleted before function returns
2. Short-life encrypted session artifact store in `@netlify/blobs`
   - store name: `content-assurance-ephemeral`
   - contents:
     - generated report JSON
     - template outputs
     - expert results
     - rendered PDF bytes
     - ZIP bytes or source for ZIP regeneration
   - never store raw source upload

### Purge rules

- default session TTL: 15 minutes
- purge on:
  - successful delivery completion + 15 minutes
  - session abandonment + 15 minutes
  - explicit user purge button
- scheduled purge:
  - `ca-purge-cron.mjs` runs every 5 minutes
- purge verification:
  - every purge writes a content-free tombstone record:
    - `sessionId`
    - `purgedAt`
    - `artifactKeysDeleted`
    - `ageSeconds`

### Testability

Required tests:

- artifact expires after TTL
- expired artifact cannot be downloaded
- expired artifact cannot be emailed
- purge cron deletes all expired objects
- purge health endpoint reports zero overdue artifacts

## 10. Processing Pipeline

### Step A. Normalize input

Function: `ca-analyze.mjs`

Responsibilities:

- accept multipart upload or transcript text
- validate type, size, page count
- extract normalized plain text
- reject if estimated words exceed threshold
- compute:
  - `sourceHash`
  - `wordCount`
  - `pageCount`
  - `fileType`

Suggested libraries:

- `busboy` for multipart parsing
- `pdf-parse` for PDF extraction
- `mammoth` for DOCX extraction

### Step B. Module execution plan

All module outputs should be assembled into one server-side `report` JSON contract.

Base report contract:

```json
{
  "sessionId": "ca_...",
  "summary": {},
  "aiLikelihood": {},
  "sensitiveData": {},
  "goalActionPlan": {},
  "templates": [],
  "experts": [],
  "meta": {
    "fileType": "pdf",
    "wordCount": 0,
    "pageCount": 0,
    "selectedModules": [],
    "goal": null,
    "expiresAt": "..."
  }
}
```

## 11. Module-by-Module AI Plan

### Module 1. Summary and key points

Model:

- `claude-haiku-4-5`

Why:

- cheapest useful summarization tier
- enough for concise structured extraction
- low margin impact for every run

Prompt shape:

- system:
  - summarize business content accurately
  - no invention
  - preserve uncertainty
- user payload:
  - normalized text
  - desired JSON schema

Output:

```json
{
  "executiveSummary": "...",
  "keyPoints": ["...", "..."],
  "notableRisks": ["..."],
  "openQuestions": ["..."]
}
```

### Module 2. AI-likelihood signal

Model:

- `claude-haiku-4-5`

Why:

- this is a probabilistic indicator, not a deep reasoning or legal product
- keep cost low

Prompt shape:

- ask for indicator-based analysis only
- forbid certainty language
- require confidence caveats

Output:

```json
{
  "estimatedLikelihoodPercent": 0,
  "indicatorsFor": ["..."],
  "indicatorsAgainst": ["..."],
  "explanation": "...",
  "disclaimer": "Probabilistic signal only. Can be wrong. Not proof."
}
```

Guardrail:

- reject any output containing definitive language like `proves`, `certain`, `confirmed`, `definitely AI`

### Module 3. Personal / sensitive-data scan

Model and rules:

- deterministic pattern scanner first
- `claude-haiku-4-5` second for grouping and obligation framing

Deterministic scan covers:

- names
- emails
- phone numbers
- SIN/SSN-like patterns
- account numbers
- DOB-like patterns
- addresses
- health identifiers

Why split:

- rules are cheaper and more reliable for raw detection
- Haiku is only used to explain why flagged data may trigger privacy obligations

Output:

```json
{
  "findings": [
    {
      "type": "email",
      "severity": "medium",
      "count": 3,
      "sample": "j***@company.com",
      "privacyContext": ["PIPEDA", "GDPR"],
      "note": "May trigger notice, handling, or minimization obligations."
    }
  ],
  "summary": "...",
  "disclaimer": "Flags possible privacy obligations only. Not a compliance certification or legal advice."
}
```

### Module 4. Goal-based action plan

Model:

- `claude-sonnet-4-6`

Why:

- needs better structure, adaptation to goal, and stronger business usefulness than Haiku
- still materially cheaper than Opus

Prompt shape:

- inputs:
  - summary output
  - key points
  - risk list
  - selected goal
  - sensitivity findings
- ask for:
  - practical action plan
  - sequence
  - owner suggestions
  - immediate next steps

Output:

```json
{
  "goal": "Sales",
  "recommendedApproach": "...",
  "next7Days": ["..."],
  "next30Days": ["..."],
  "watchouts": ["..."]
}
```

### Module 5. Seven dynamic templates

Model:

- `claude-sonnet-4-6`

Why:

- this is the product's highest-value generative output
- quality matters more than the cheaper modules

Prompt shape:

- inputs:
  - goal
  - summary
  - key points
  - flagged sensitivities
  - tone and output schema
- strict instruction:
  - content-derived
  - ready to edit
  - not generic boilerplate

Template contract:

- always return 7 templates
- the set varies by goal, but slot types stay stable

Suggested slot map:

- Sales
  - outreach email
  - follow-up email
  - proposal outline
  - discovery-call agenda
  - objection response
  - internal handoff note
  - executive summary memo
- Compliance
  - remediation memo
  - findings register entry
  - stakeholder notice
  - policy update draft
  - risk review agenda
  - evidence-request checklist
  - management summary
- Hiring
  - candidate brief
  - interview guide
  - scorecard
  - recruiter message
  - hiring-manager summary
  - reference-check prompts
  - onboarding note
- Meeting-Content
  - meeting summary
  - action register
  - follow-up email
  - stakeholder memo
  - decision log
  - task handoff note
  - client-ready recap

Output:

```json
{
  "templates": [
    {
      "slot": "outreach-email",
      "title": "Customer outreach email",
      "channel": "email",
      "body": "..."
    }
  ]
}
```

### Module 6. Expert suggestions

No Claude generation allowed for expert identities.

Data source:

- live web-search API only

Permitted model use:

- none required
- optional deterministic query builder only

Output contract:

```json
{
  "results": [
    {
      "name": "...",
      "role": "...",
      "organization": "...",
      "location": "...",
      "contact": "...",
      "rating": "...",
      "sourceLabel": "...",
      "sourceUrl": "https://..."
    }
  ],
  "disclaimer": "These are unverified, automatically-surfaced public search results ..."
}
```

No-fabrication enforcement:

- render only fields returned by the real search payload
- never ask the model to invent missing contact fields
- if field absent, omit it

## 12. Expert Suggestions Service Design

Function: `ca-expert-search.mjs`

Flow:

1. Receive:
   - selected goal
   - file-derived topic summary
   - optional location
2. Build deterministic search queries.
3. Call search provider.
4. Filter to higher-trust result types:
   - professional directories
   - law/accounting/consulting directories
   - company profile pages
   - association listings
5. Normalize fields.
6. Return at most 6 cards.

Search strategy:

- Goal-specific query templates:
  - Sales -> `fractional sales consultant`, `B2B growth advisor`
  - Compliance -> `privacy consultant`, `data protection lawyer`
  - Hiring -> `recruiter`, `talent advisor`
  - Meeting-Content -> `facilitator`, `communications consultant`
- append location where provided

Provider design:

- abstract provider client behind `SEARCH_API_BASE_URL`, `SEARCH_API_KEY`, `SEARCH_API_PROVIDER`
- first implementation can target Brave Search or another approved licensed provider

Regenerate:

- same endpoint
- increment `searchVariant`
- rotate query ordering
- return new real results only

## 13. Checkout and Credit Model

### Products

- subscription: `$20/month`
  - includes 20 report credits per billing cycle
- overage: `$2/credit`
- one-time single report: `$5`

### Credit definition

- 1 credit = 1 supported file within MVP size limits

### Checkout logic

Function: `ca-checkout.mjs`

Input:

- session id
- checkout email
- selected goal
- desired purchase mode

Decision tree:

1. If email has active Content Assurance subscription:
   - if remaining included credits > 0 -> unlock immediately, decrement local ledger
   - else create $2 overage checkout or create metered usage event
2. If no subscription:
   - show:
     - `$5 single report`
     - `$20/month subscription`

### Stripe implementation

Recommended Stripe setup:

- one recurring price for base subscription
- one metered or one-time overage price
- one one-time single-report price

Persisted billing ledger store:

- `content-assurance-billing`

Ledger fields:

- `email`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `billingPeriodStart`
- `billingPeriodEnd`
- `includedCredits`
- `usedCredits`
- `overageCredits`
- `updatedAt`

### Failure handling

- if checkout session fails, keep preview available until session expiry
- if webhook fails, mark `billing_pending_reconcile`
- if refund occurs, do not restore delivery artifact automatically; require manual review

## 14. Stripe Webhook Plan

Preferred approach:

- keep one site Stripe webhook endpoint
- extend existing `stripe-webhook.js` with a namespaced Content Assurance branch

Branch behavior for Content Assurance:

- detect metadata:
  - `product_family = content-assurance`
  - `goal = ...`
  - `session_id = ca_...`
- on success:
  - mark session paid
  - unlock delivery
  - upsert billing ledger
  - send HubSpot lead

## 15. Delivery Plan

Function: `ca-delivery.mjs`

Responsibilities:

- verify paid session or subscriber unlock
- assemble report PDF
- assemble template files
- create ZIP bundle
- create short-life download token

Bundle contents:

- `assurance-report.pdf`
- `summary.md`
- `sensitive-data-findings.md`
- `goal-action-plan.md`
- `templates/01-...`
- `experts.csv` if expert module selected
- `README.txt` with disclaimers and purge timing

Suggested libraries:

- `pdfkit` or `pdf-lib` for PDF generation
- `jszip` for ZIP generation

Download links:

- valid for 15 minutes max
- tied to checkout email + session id

## 16. Email Delivery

Function: `ca-email.mjs`

Provider:

- Resend first
- same operational pattern as existing `aperture-email-report.js`

Options:

- send to self
- send to client

Rules:

- recipient entered each time
- validate email
- add legal/disclaimer footer
- do not include raw upload

## 17. HubSpot Hook

Function: `ca-hubspot.mjs`

Trigger:

- successful Stripe checkout or successful subscriber unlock event

Payload:

- email
- selected goal
- file type
- chosen modules
- source = `content-assurance`
- lifecycle stage / pipeline mapping if approved

Do not send:

- source content
- extracted PII
- AI-likelihood details

## 18. Legal Wrapper

Required page copy:

- rights-attestation checkbox:
  - `I confirm I have the right to upload and analyze this content.`
- AI-signal disclaimer:
  - probabilistic only
  - can be wrong
  - not proof
  - not grounds for accusation
- privacy findings disclaimer:
  - may trigger privacy obligations
  - not certification
  - not legal advice
- expert suggestions disclaimer:
  - unverified public results
  - not endorsements
  - verify independently
- global output disclaimer:
  - informational only
  - not legal, forensic, or compliance advice

## 19. Environment Variables

Required:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CA_SUB_MONTHLY`
- `STRIPE_PRICE_CA_SINGLE_REPORT`
- `STRIPE_PRICE_CA_OVERAGE`
- `ANTHROPIC_API_KEY`
- `CONTENT_ASSURANCE_SESSION_SECRET`
- `CONTENT_ASSURANCE_PURGE_MINUTES`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `HUBSPOT_PRIVATE_APP_TOKEN`
- `HUBSPOT_CONTENT_ASSURANCE_SOURCE`
- `SEARCH_API_PROVIDER`
- `SEARCH_API_BASE_URL`
- `SEARCH_API_KEY`

Suggested:

- `CONTENT_ASSURANCE_NOTIFY_EMAIL`
- `CONTENT_ASSURANCE_MAX_MB`
- `CONTENT_ASSURANCE_MAX_PAGES`
- `CONTENT_ASSURANCE_MAX_WORDS`

## 20. Monitoring Agents

### Agent 1. Purge watchdog

Function:

- verify expired artifacts are actually gone
- notify if any artifact exceeds TTL by more than 5 minutes

Implementation:

- scheduled `ca-purge-cron.mjs`
- alert through Resend to ops email

### Agent 2. Billing alert

Function:

- catch Stripe webhook failures
- catch subscriber unlock mismatches
- catch overage posting failures

Implementation:

- scheduled `ca-health-cron.mjs`
- checks stale `billing_pending_reconcile` records

### Agent 3. Search API health

Function:

- probe expert-search provider
- detect zero-result or auth-failure streaks

Implementation:

- same `ca-health-cron.mjs`
- namespaced health report

## 21. Netlify Integration Plan

### Redirects

Add:

```toml
[[redirects]]
  from = "/services/content-assurance"
  to = "/content-assurance.html"
  status = 200
```

Optional alias:

```toml
[[redirects]]
  from = "/content-assurance"
  to = "/content-assurance.html"
  status = 200
```

### Scheduled functions

Add scheduled invocations for:

- `ca-purge-cron`
- `ca-health-cron`

### Build safety

- keep `publish = "."`
- keep existing function bundler behavior
- add only required new external packages

## 22. Dependencies to Add

Add to `package.json`:

- `busboy`
- `pdf-parse`
- `mammoth`
- `jszip`
- `pdfkit` or `pdf-lib`

Do not add large framework dependencies.

## 23. Claude Code Task Breakdown

### Phase 0. Baseline and backup

1. Verify live `/services` and existing Stripe purchase path.
2. Create timestamped backup folder.
3. Copy surgical-touch files into backup folder.
4. Document baseline screenshots.

### Phase 1. Route and page shell

1. Create `content-assurance.html`.
2. Create `assets/content-assurance.css`.
3. Create `assets/content-assurance.js`.
4. Add `/services/content-assurance` redirect.
5. Add Services quick-nav pill.
6. Add Services teaser card under `AI Services`.

### Phase 2. Legal and UX states

1. Add rights-attestation copy.
2. Add data-handling copy.
3. Add AI-signal disclaimer copy.
4. Add privacy disclaimer copy.
5. Add expert disclaimer copy.
6. Create `content-assurance-terms.html`.
7. Create `content-assurance-privacy.html`.

### Phase 3. Upload and normalization

1. Build upload form state machine.
2. Add client validation for type/size/module minimum.
3. Implement `ca-analyze.mjs` multipart parsing.
4. Implement PDF extraction.
5. Implement DOCX extraction.
6. Implement transcript/plain-text path.
7. Add page/word limit enforcement.

### Phase 4. Module execution

1. Implement summary module.
2. Implement AI-likelihood module.
3. Implement deterministic sensitive-data scanner.
4. Implement privacy-obligation phrasing layer.
5. Implement goal action-plan module.
6. Implement 7-template generator.
7. Build unified report JSON.

### Phase 5. Expert suggestions

1. Implement provider adapter.
2. Implement deterministic query builder.
3. Implement response normalization.
4. Enforce no-fabrication field rendering.
5. Add regenerate path.

### Phase 6. Billing and unlock

1. Implement `ca-checkout.mjs`.
2. Create Stripe product metadata contract.
3. Add subscriber-by-email detection.
4. Add included-credit ledger.
5. Add overage behavior.
6. Extend Stripe webhook for Content Assurance.

### Phase 7. Delivery and email

1. Implement `ca-delivery.mjs`.
2. Generate report PDF.
3. Generate template files.
4. Generate ZIP bundle.
5. Implement `ca-email.mjs`.
6. Add self/client email actions.

### Phase 8. Purge and monitoring

1. Implement ephemeral artifact store.
2. Implement explicit purge action.
3. Implement `ca-purge-cron.mjs`.
4. Implement `ca-health-cron.mjs`.
5. Add purge telemetry.

### Phase 9. HubSpot and analytics

1. Implement `ca-hubspot.mjs`.
2. Trigger on successful checkout/unlock.
3. Store minimal usage metadata only.
4. Add health checks for HubSpot failures.

### Phase 10. QA and launch

1. Test all supported file types.
2. Test limit rejections.
3. Test 3-module minimum.
4. Test subscriber unlock.
5. Test one-time checkout.
6. Test overage flow.
7. Test email to self/client.
8. Test purge TTL and expired-link behavior.
9. Confirm no raw content lands in logs, Stripe metadata, or HubSpot.
10. Re-verify Services page remains intact.

## 24. Acceptance Checklist

- user can upload supported file
- unsupported files are rejected clearly
- user must attest upload rights
- user must select at least 3 modules
- preview renders before payment
- AI-likelihood shows probabilistic disclaimer
- privacy findings avoid compliance-certification claims
- expert cards show real source links only
- subscriber email can unlock with remaining credits
- non-subscriber can pay $5
- subscriber overage can charge $2
- bundle downloads successfully
- email send works
- raw file does not persist
- session artifacts purge in 15 minutes
- HubSpot lead fires on successful checkout or subscriber unlock
- Services page still works and no existing route breaks

## 25. Build Order Recommendation

Recommended implementation order for Claude Code:

1. route + page shell
2. upload + normalization
3. summary and action-plan modules
4. preview renderer
5. checkout + unlock
6. delivery
7. purge
8. expert suggestions
9. HubSpot
10. QA

This order gets a working paid MVP fastest while keeping the riskier integrations late and isolated.
