---
id: l2-sso-001
title: "SSO onboarding: add a user to an app, or connect a new SaaS app to SSO"
category: sso
support_level: L2
severity: medium
estimated_time_minutes: 45
audience: technician
os_scope: ["N/A — cloud/identity"]
prerequisites: ["Entra ID (Azure AD) admin or delegated app-admin role", "Admin access to the target SaaS app", "Change approved per access-request policy"]
keywords:
  - sso onboarding
  - add user to app
  - assign app
  - new saas app sso
  - saml setup
  - scim provisioning
  - entra enterprise application
  - okta assign
  - single sign-on access
related_articles:
  - l2-onboarding-001
  - l3-sso-saml-001
  - l1-browser-003
escalation_trigger: "Custom SAML claim mapping, federation/trust changes, or tenant-wide identity policy changes — design-level work for L3 identity engineering."
last_updated: 2026-05-26
version: 1.0
---

# SSO onboarding — grant a user access, or wire up a new app

## 1. Symptoms / Requests
- "Please give <user> access to <app> via SSO."
- "We bought a new SaaS tool — set up single sign-on so people log in with their work account."
- New hire can't see an app on their My Apps / launcher.
- "Just-in-time" account isn't being created in the app when the user signs in.

## 2. Likely Causes / Context
1. **User not assigned** to the Enterprise Application (or not in the assigned group).
2. **App not yet integrated** — no SAML/OIDC trust configured between the IdP (Entra ID / Okta) and the SaaS app.
3. **Provisioning gap** — SAML alone authenticates but doesn't create the account; the app needs **SCIM** or JIT to provision the user.
4. **Group-based assignment** mismatch — user not in the security group that grants the app.
5. **Conditional Access / license** blocks (no app license, or a CA policy requiring compliant device/MFA not met).
6. **Attribute/claim mismatch** — the app keys users on an attribute the IdP isn't sending (e.g., expects `mail`, IdP sends UPN).

## 3. Questions To Ask (Intake)
1. Is the app **already integrated** with SSO, or brand new?
2. Are you adding **one user**, or onboarding a **whole app/team**?
3. What does the app expect as the unique identifier — email, UPN, employee ID?
4. Does the app need **automatic account creation** (SCIM/JIT), or do accounts already exist there?
5. Who is the app owner / has admin in the SaaS side for the metadata exchange?
6. Is there a license to assign, and any Conditional Access requirement?

## 4. Triage Steps
1. Confirm the request is **approved** per the access policy (don't grant app access ad hoc).
2. In Entra ID → **Enterprise applications**, search for the app — does it already exist?
3. If it exists: check **Users and groups** (is the user/group assigned?) and **Provisioning** (is SCIM on and healthy?).
4. Verify the user has any required **license** and meets **Conditional Access** (device compliant, MFA registered).

## 5. Resolution Steps
**A) Add an existing user to an already-integrated app (most common):**
1. Entra ID → Enterprise applications → select the app → **Users and groups** → **Add user/group**.
2. Prefer adding the user to the **security group** that grants the app (group-based access) rather than a direct assignment — it scales and audits cleanly.
3. Assign the correct **role** if the app exposes app roles.
4. If the app uses **SCIM provisioning**, confirm the user appears in **Provisioning → on-demand provision** (provision them on demand to avoid waiting for the sync cycle).
5. Confirm a **license** is assigned if the app requires one.

**B) Onboard a brand-new SaaS app to SSO (SAML):**
1. Entra ID → Enterprise applications → **New application** → search the gallery; if present, add it (pre-built claims). If not, "Create your own application" → non-gallery.
2. **Single sign-on → SAML.** Exchange metadata with the app owner:
   - Give the app the **IdP metadata / Login URL / Entity ID / signing certificate**.
   - Enter the app's **Reply URL (ACS)**, **Identifier (Entity ID)**, and **Sign-on URL**.
3. Set **Attributes & Claims** to match what the app keys on (commonly NameID = `user.mail` or `user.userprincipalname`).
4. Download the **federation metadata XML** (or Base64 cert) and hand it to the app owner to finish their side.
5. Assign the pilot user/group under **Users and groups** and test.

**C) Turn on automatic provisioning (SCIM) so accounts auto-create:**
1. App → **Provisioning** → mode **Automatic** → enter the app's **Tenant URL** and **Secret Token** (from the SaaS admin).
2. **Test Connection**, map attributes, set scope to "assigned users and groups", then turn provisioning **On**.

## 6. Verification Steps
- The user sees the app tile at **https://myapps.microsoft.com** and can launch it.
- Sign-in completes end-to-end into the app (not just the IdP) without a redirect loop.
- For SCIM/JIT: the user's account now exists in the SaaS app with correct attributes/role.
- Entra ID → **Sign-in logs** shows a successful interactive sign-in to that app for the user.
- Removing a test user from the group revokes access (de-provision verified) before go-live.

## 7. Escalation Trigger
- App requires **custom claim transformations**, certificate/federation trust changes, or multiple identifiers.
- Tenant-wide **Conditional Access** or identity-policy changes are needed.
- Redirect loops or signature/cert errors that need IdP↔SP protocol debugging (→ l3-sso-saml-001).
- → Escalate to **L3 identity engineering** for SAML/OIDC design and federation work.

## 8. Prevention Tips
- Always grant app access via **groups**, not direct user assignment — easier joiner/mover/leaver handling.
- Tie app groups to the **onboarding** workflow (l2-onboarding-001) so new hires get the right apps automatically.
- Prefer **SCIM** over JIT where supported, so deprovisioning is automatic at offboarding.
- Keep a record of each app's ACS URL, Entity ID, cert expiry, and app owner; calendar the **signing-cert renewal**.

## 9. User-Friendly Explanation
"Single sign-on means you log in once with your work account and the app just lets you in — no separate password. To give you access we add you to the group that's allowed into that app; if the app also needs an account created on its side, our system provisions it automatically. For a brand-new app we set up a trust between our login system and the vendor once, then everyone gets in the same easy way. You'll find your apps at the My Apps portal."

## 10. Internal Technician Notes
- Group-based assignment requires Entra ID P1+; without it you assign users directly.
- NameID format mismatch is the #1 cause of "authenticates but app says user not found" — confirm the SP's expected identifier.
- SCIM on-demand provisioning skips the (default 40-min) sync cycle for urgent onboards.
- For non-gallery apps, watch Reply URL exact-match (trailing slash, http vs https) — a frequent silent failure.
- Document cert expiry; an expired SAML signing cert breaks the whole app for all users (calendar a renewal task).
- Conditional Access "require compliant device" will block onboarding from an unmanaged machine — verify before blaming the SSO config.

## 11. Related KB Articles
- l2-onboarding-001 — New user onboarding
- l3-sso-saml-001 — SAML troubleshooting (protocol-level)
- l1-browser-003 — SAML/SSO redirect loop

## 12. Keywords / Search Tags
sso onboarding, add user to app, assign app, new saas app sso, saml setup, scim provisioning, entra enterprise application, okta assign, single sign-on access, my apps, conditional access, app role, federation metadata
