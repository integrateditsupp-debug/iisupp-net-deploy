// ARIA Sentinel — first-run user profile (LOCAL-ONLY PII).
// Spec: dev-docs/sentinel-profile-and-session-email-spec.md (A).
// Same fields ARIA web asks: First name, Last name, Company, Email (required + validated), Phone.
// Saved to the app userData dir as profile.json, re-read every launch. The ONLY time it leaves the device is
// to address the user's OWN session-end email (the report goes to that address). No selling, no other use.

export const PROFILE_FIELDS = ["firstName", "lastName", "company", "email", "phone"];
export const PROFILE_FILE = "profile.json";

// One validating regex; intentionally simple + offline (no MX lookups). Matches the web intake gate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DIGITS_RE = /\d/g;

export function normalizeProfile(input = {}) {
  const p = {};
  for (const f of PROFILE_FIELDS) p[f] = typeof input[f] === "string" ? input[f].trim().slice(0, 200) : "";
  return p;
}

// The gate blocks the app until ALL fields are filled (same as ARIA web). Email is also format-validated;
// phone must contain at least a few digits. Returns { valid, errors, profile } — never throws.
export function validateProfile(input = {}) {
  const p = normalizeProfile(input);
  const errors = {};
  if (!p.firstName) errors.firstName = "First name is required";
  if (!p.lastName) errors.lastName = "Last name is required";
  if (!p.company) errors.company = "Company is required";
  if (!p.email) errors.email = "Email is required";
  else if (!EMAIL_RE.test(p.email)) errors.email = "Enter a valid email";
  if (!p.phone) errors.phone = "Phone is required";
  else if ((p.phone.match(PHONE_DIGITS_RE) || []).length < 7) errors.phone = "Enter a valid phone number";
  return { valid: Object.keys(errors).length === 0, errors, profile: p };
}

export function profileComplete(input) {
  return validateProfile(input).valid;
}

// ── persistence (pure helpers — the caller injects fs + the userData dir) ───────────────────────────────
export function profilePath(path, userDataDir) {
  return path.join(userDataDir, PROFILE_FILE);
}

// Returns the saved profile or null. Re-read on EVERY launch by the main process.
export function loadProfile(fs, path, userDataDir) {
  try {
    const raw = fs.readFileSync(profilePath(path, userDataDir), "utf8");
    const p = normalizeProfile(JSON.parse(raw));
    return profileComplete(p) ? Object.assign(p, { savedAt: JSON.parse(raw).savedAt || null }) : null;
  } catch {
    return null;
  }
}

// Persists ONLY when the profile is complete + valid. Returns { ok, errors, profile }.
export function saveProfile(fs, path, userDataDir, input) {
  const { valid, errors, profile } = validateProfile(input);
  if (!valid) return { ok: false, errors, profile };
  const record = Object.assign({}, profile, { savedAt: new Date().toISOString() });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(profilePath(path, userDataDir), JSON.stringify(record, null, 2), "utf8");
  return { ok: true, errors: {}, profile: record };
}

// True when the app must show the mandatory gate (no valid saved profile yet).
export function profileGateRequired(fs, path, userDataDir) {
  return loadProfile(fs, path, userDataDir) == null;
}
