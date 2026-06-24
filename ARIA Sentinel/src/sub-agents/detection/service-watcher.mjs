// service-watcher — fires SYSTEM.SERVICE.STOPPED.<NAME> when a critical service
// transitions Running -> Stopped. Source: Get-Service · cadence 60s.
// Content-blind: the service set is a FIXED allow-list of Windows service short names
// (not user data), so the name is safe to carry in the symbolic signal.
import { runPowerShellJson, toArray } from "./ps.mjs";

// 8 critical services ARIA watches. Names are Windows service keys, not PII.
export const CRITICAL_SERVICES = [
  "Spooler", // Print Spooler
  "Dnscache", // DNS Client
  "Dhcp", // DHCP Client
  "wuauserv", // Windows Update
  "BITS", // Background Intelligent Transfer
  "WlanSvc", // WLAN AutoConfig
  "Audiosrv", // Windows Audio
  "LanmanWorkstation" // Workstation (SMB)
];

const SERVICE_SET = new Set(CRITICAL_SERVICES.map((s) => s.toLowerCase()));

const QUERY =
  `Get-Service -Name ${CRITICAL_SERVICES.join(",")} -ErrorAction SilentlyContinue | ` +
  "Select-Object Name,Status | ConvertTo-Json -Compress";

/**
 * Pure transition evaluator. `prev` is a map of serviceName -> "Running"|"Stopped".
 * Emits a signal only on a Running->Stopped edge for an allow-listed service.
 */
export function evaluateServices(prev, raw) {
  const prevMap = prev || {};
  const nextMap = { ...prevMap };
  const signals = [];
  for (const row of toArray(raw)) {
    const name = String(row?.Name || "").trim();
    if (!name || !SERVICE_SET.has(name.toLowerCase())) continue; // ignore anything off the allow-list
    const status = normalizeStatus(row?.Status);
    const before = prevMap[name];
    if (before === "Running" && status === "Stopped") {
      signals.push({ signal: `SYSTEM.SERVICE.STOPPED.${name.toUpperCase()}`, hint: "critical-service-stopped" });
    }
    nextMap[name] = status;
  }
  return { state: nextMap, signals };
}

function normalizeStatus(value) {
  // Get-Service Status can serialise as the enum number (4 = Running) or the string.
  const text = String(value ?? "").trim();
  if (text === "4" || /running/i.test(text)) return "Running";
  if (text === "1" || /stopped/i.test(text)) return "Stopped";
  return text || "Unknown";
}

export function createServiceWatcher({ emit, isBlocked }) {
  let state = {};
  return {
    name: "service",
    cadenceMs: 60 * 1000,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const result = evaluateServices(state, raw);
      state = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    }
  };
}
