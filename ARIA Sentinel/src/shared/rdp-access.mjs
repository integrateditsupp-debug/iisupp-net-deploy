// rdp-access - policy-only foundation for the "Grant Asset RDP Access" rescue flow.
//
// This module deliberately does NOT modify Windows groups or open remote sessions. It owns the
// safe decision layer: admin authorization, corporate authority model checks, device-state
// messaging, temporary grant records, expiry, revoke state, and secret-free audit shape.
import { createHash } from "node:crypto";

export const RDP_AUTHORITY_MODELS = [
  "customer_service_identity",
  "local_endpoint_service",
  "prompted_admin_credentials",
  "enterprise_privileged_workflow"
];

export const RDP_DEVICE_STATES = [
  "available",
  "policy_blocked",
  "agent_unreachable",
  "offline",
  "unknown",
  "os_unhealthy",
  "blue_screen_suspected",
  "not_enrolled"
];

export const DEFAULT_RDP_GRANT_MINUTES = 60;
export const ABSOLUTE_MAX_RDP_GRANT_MINUTES = 8 * 60;

export const SAFE_RDP_RECOVERY_OPTIONS = [
  "Latest ARIA Office/File Safety backups",
  "OneDrive or SharePoint version history",
  "Corporate backup or DLP-approved restore",
  "Intune, MDM, SCCM, PAM/JIT, or AD/Entra workflow",
  "BitLocker recovery through the company's approved process",
  "Onsite IT recovery or approved drive imaging",
  "Out-of-band management only when the company already owns that tooling"
];

const ADMIN_ROLES = new Set(["Owner", "Admin", "SecurityAdmin"]);
const SECRET_KEY_RE = /(password|secret|token|credential|privateKey|clientSecret)/i;

function asText(value, max = 240) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, max);
}

export function redactSecretText(value) {
  return asText(value, 1000)
    .replace(/\b(password|secret|token|credential)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/g, "$1 [redacted]");
}

function collectSecretFields(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (SECRET_KEY_RE.test(key) && child != null && String(child) !== "") out.push(name);
    if (child && typeof child === "object" && !Array.isArray(child)) out.push(...collectSecretFields(child, name));
  }
  return out;
}

export function isAuthorizedRdpAdmin(actor = {}) {
  if (!actor || actor.anonymous) return false;
  const role = asText(actor.role, 64);
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  return ADMIN_ROLES.has(role) || permissions.includes("rdp:grant");
}

export function validateAuthorityConfig(config = {}) {
  const errors = [];
  const model = asText(config.model, 80);

  if (config.enabled !== true) errors.push("authority-not-enabled");
  if (!RDP_AUTHORITY_MODELS.includes(model)) errors.push("authority-model-invalid");

  const secretFields = collectSecretFields(config);
  if (secretFields.length) errors.push("secret-metadata-forbidden");
  if (config.storeCredentials === true || config.rememberCredentials === true) errors.push("credential-storage-forbidden");

  if (model === "customer_service_identity" && config.serviceIdentityOwnedByCustomer !== true) {
    errors.push("service-identity-must-be-customer-owned");
  }
  if (model === "local_endpoint_service") {
    if (config.endpointServiceApproved !== true) errors.push("endpoint-service-not-approved");
    if (config.signedCommandsRequired !== true) errors.push("signed-command-required");
  }
  if (model === "prompted_admin_credentials" && config.promptPerRequest !== true) {
    errors.push("prompted-credentials-must-be-per-request");
  }
  if (model === "enterprise_privileged_workflow" && config.workflowOwnedByCustomer !== true) {
    errors.push("enterprise-workflow-must-be-customer-owned");
  }

  return { ok: errors.length === 0, errors, model };
}

export function classifyDeviceForRdp(device = {}) {
  const host = asText(device.host || device.hostname || device.deviceId || "Unknown device", 120);
  const statusText = `${device.status || ""} ${device.health || ""} ${device.lastSignal || ""} ${device.error || ""}`;

  if (!device || Object.keys(device).length === 0) {
    return unavailable("unknown", host, "ARIA Sentinel does not have enough device state to verify RDP access.");
  }
  if (device.enrolled === false) {
    return unavailable("not_enrolled", host, "The asset is not enrolled, so ARIA Sentinel cannot send a signed rescue command.");
  }
  if (device.blueScreenSuspected === true || device.unbootable === true || /\b(bsod|blue screen|unbootable|inaccessible_boot_device)\b/i.test(statusText)) {
    return unavailable("blue_screen_suspected", host, "RDP is unavailable because Windows/RDP may not be running. ARIA cannot RDP into a true blue screen or pre-boot state.");
  }
  if (device.online === false || /\boffline\b/i.test(statusText)) {
    return unavailable("offline", host, "The asset is offline. RDP requires the computer, Windows, networking, and RDP services to be running.");
  }
  if (device.agentReachable === false) {
    return unavailable("agent_unreachable", host, "The endpoint agent is unreachable, so ARIA cannot verify or perform the request.");
  }
  if (device.windowsReachable === false || device.osHealthy === false) {
    return unavailable("os_unhealthy", host, "Windows is not healthy or reachable enough for a safe RDP grant.");
  }
  if (device.rdpBlockedByPolicy === true || device.rdpPolicy === "blocked") {
    return unavailable("policy_blocked", host, "Corporate policy blocks RDP on this asset. Contact the approved admin/security workflow.");
  }
  if (device.rdpAvailable === false) {
    return unavailable("policy_blocked", host, "RDP is not available on this asset. The grant cannot be attempted safely.");
  }
  if (device.online === true && device.agentReachable === true && device.windowsReachable === true && device.rdpAvailable === true) {
    return {
      state: "available",
      host,
      canRequest: true,
      reason: "Device is online, enrolled, agent-reachable, Windows-reachable, and RDP is not policy-blocked.",
      recoveryOptions: []
    };
  }
  return unavailable("unknown", host, "ARIA Sentinel needs a fresher heartbeat before granting temporary RDP access.");
}

function unavailable(state, host, reason) {
  return { state, host, canRequest: false, reason, recoveryOptions: SAFE_RDP_RECOVERY_OPTIONS.slice() };
}

export function validRdpTargetUser(value, { allowLocalUser = false } = {}) {
  const user = asText(value, 160);
  if (!user) return false;
  if (/^[A-Za-z0-9_.-]+\\[A-Za-z0-9_.@-]+$/.test(user)) return true;
  if (/^AzureAD\\[A-Za-z0-9_.@-]+$/i.test(user)) return true;
  if (/^[^@\s\\]+@[^@\s\\]+\.[^@\s\\]+$/.test(user)) return true;
  return allowLocalUser && /^[A-Za-z0-9_.-]+$/.test(user);
}

export function validateRdpGrantRequest(input = {}) {
  const errors = [];
  const actor = input.actor || {};
  const authority = validateAuthorityConfig(input.authority || {});
  const deviceState = classifyDeviceForRdp(input.device || {});
  const policyMax = Math.min(
    ABSOLUTE_MAX_RDP_GRANT_MINUTES,
    Math.max(5, Number(input.authority && input.authority.maxDurationMinutes) || ABSOLUTE_MAX_RDP_GRANT_MINUTES)
  );
  const durationMinutes = Number(input.durationMinutes || DEFAULT_RDP_GRANT_MINUTES);

  if (!isAuthorizedRdpAdmin(actor)) errors.push("admin-not-authorized");
  if (!authority.ok) errors.push(...authority.errors);
  if (!deviceState.canRequest) errors.push(`device-${deviceState.state}`);
  if (!validRdpTargetUser(input.targetUser, { allowLocalUser: input.allowLocalUser === true })) errors.push("target-user-invalid");
  if (!asText(input.reason, 400)) errors.push("reason-required");
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5) errors.push("duration-too-short");
  if (Number.isFinite(durationMinutes) && durationMinutes > policyMax) errors.push("duration-exceeds-policy");

  return {
    ok: errors.length === 0,
    errors,
    deviceState,
    authorityModel: authority.model,
    policyMaxMinutes: policyMax,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : DEFAULT_RDP_GRANT_MINUTES
  };
}

export function buildRdpGrantRecord(input = {}, { now = Date.now() } = {}) {
  const decision = validateRdpGrantRequest(input);
  if (!decision.ok) return { ok: false, errors: decision.errors, decision, record: null };

  const startedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + decision.durationMinutes * 60 * 1000).toISOString();
  const adminIdentity = asText(input.actor && (input.actor.email || input.actor.name || input.actor.id), 160);
  const targetUser = asText(input.targetUser, 160);
  const targetMachine = decision.deviceState.host;
  const reasonTicket = redactSecretText(input.reason);
  const seed = `${adminIdentity}|${targetUser}|${targetMachine}|${startedAt}|${reasonTicket}`;
  const grantId = `rdp-${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;

  return {
    ok: true,
    errors: [],
    decision,
    record: {
      schema: "rdp-grant.v1",
      grantId,
      adminIdentity,
      targetUser,
      targetMachine,
      reasonTicket,
      authorityModel: decision.authorityModel,
      startedAt,
      expiresAt,
      state: "active",
      revokeStatus: "scheduled",
      audit: secretFreeAudit("RDP_GRANT_REQUESTED", { grantId, adminIdentity, targetUser, targetMachine, reasonTicket })
    }
  };
}

export function markExpiredRdpGrants(records = [], { now = Date.now() } = {}) {
  return (Array.isArray(records) ? records : []).map((record) => {
    if (!record || record.state !== "active") return record;
    const expires = Date.parse(record.expiresAt || "");
    if (!Number.isFinite(expires) || expires > now) return record;
    return {
      ...record,
      state: "expired_pending_revoke",
      revokeStatus: "pending",
      updatedAt: new Date(now).toISOString()
    };
  });
}

export function revokeRdpGrant(record, { by = "", at = Date.now(), ok = true, error = "" } = {}) {
  if (!record || typeof record !== "object") return null;
  const ts = new Date(at).toISOString();
  if (ok) {
    return {
      ...record,
      state: "revoked",
      revokeStatus: "success",
      revokedAt: ts,
      revokedBy: asText(by, 160),
      revokeError: ""
    };
  }
  return {
    ...record,
    state: "revoke_failed",
    revokeStatus: "failed",
    revokedAt: "",
    revokedBy: asText(by, 160),
    revokeError: redactSecretText(error),
    updatedAt: ts
  };
}

export function secretFreeAudit(type, details = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (SECRET_KEY_RE.test(key)) continue;
    safe[key] = redactSecretText(value);
  }
  return { type: asText(type, 80), details: safe, secretFree: true };
}
